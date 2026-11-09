/**
 * Green Allied NPC (`faction: 'npc'`) Phase Sequencer (`battleAllyPhaseRunner.ts`)
 *
 * Runs between Player Phase and Enemy Phase whenever living Green `'npc'` units
 * exist on the map (e.g., Paralogue 2 `Kecleon` or Ch. 17 `Baxcalibur`).
 */

import { computeCombatForecast } from '../../engine/combatEngine';
import { chooseNpcAllyAction } from '../../engine/enemyAi';
import {
  ensureTilePairVisible,
  playPhaseTransitionAsync,
  waitBattleMs,
} from './battleBannersAndTransitions';
import { playCombatExchangeAsync } from './battleCombatAnimator';
import { recomputeDangerArea, syncHudControls } from './battleDangerAndViewportState';
import { runUnitDefeatedEvents } from './battleEventRunner';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingNpcs, getLivingUnits } from './battleUnitQueries';
import { playWalkPathAsync } from './battleWalkAndHealAnimator';

export async function runAllyNpcPhase(
  ctx: BattleControllerContext,
  runGen: number
): Promise<boolean> {
  const { state, dom, audioManager } = ctx;
  const npcsOrder = [...getLivingNpcs(state)];
  if (npcsOrder.length === 0) {
    return false;
  }

  state.phase = 'ally_phase';
  state.interactionState = 'enemy_acting';
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  audioManager.playSfx('phase_change');
  await playPhaseTransitionAsync(state, dom, 'ally', runGen);
  if (!state.openState || runGen !== state.battleRunGen) return true;

  for (const npc of npcsOrder) {
    if (!state.openState || runGen !== state.battleRunGen) return true;
    if (npc.defeated || npc.currentHp <= 0) continue;

    state.inspectedTile = { x: npc.x, y: npc.y };
    ensureTilePairVisible(state, npc.x, npc.y, npc.x, npc.y);
    updateBattleInfoStrip(ctx);

    const decision = chooseNpcAllyAction(state.map, npc, getLivingUnits(state));

    if (decision.path.length > 1) {
      await playWalkPathAsync(state, npc, decision.path, true);
      if (!state.openState || runGen !== state.battleRunGen) return true;
      state.inspectedTile = { x: npc.x, y: npc.y };
      updateBattleInfoStrip(ctx);
    }

    if (decision.kind === 'attack' && decision.attack) {
      const target = state.units.find(
        (u) => u.id === decision.attack!.targetUnitId && !u.defeated && u.currentHp > 0
      );
      if (target) {
        npc.equippedMoveId = decision.attack.moveId;
        const liveForecast = computeCombatForecast(
          state.map,
          npc,
          target,
          decision.attack.moveId
        );
        if (liveForecast) {
          await waitBattleMs(state, 150);
          if (!state.openState || runGen !== state.battleRunGen) return true;
          await playCombatExchangeAsync(ctx, npc, target, liveForecast, runGen);
          if (!state.openState || runGen !== state.battleRunGen) return true;

          await runUnitDefeatedEvents(ctx, [npc, target], runGen);
          if (!state.openState || runGen !== state.battleRunGen) return true;

          recomputeDangerArea(ctx);
          if (checkAndTriggerMatchEnd(ctx)) {
            return true;
          }
        }
      }
    }

    if (!npc.defeated && npc.currentHp > 0) {
      npc.waited = true;
      npc.action = 'Idle';
    }
    await waitBattleMs(state, 130);
  }

  return false;
}
