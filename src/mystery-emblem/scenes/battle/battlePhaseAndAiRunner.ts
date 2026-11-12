/**
 * Ally & Enemy Phase AI Sequencer, Dungeon Stairs Reinforcements & Start-of-Turn Events
 */

import { equipMoveInItsSlot } from '../../data/equippedMoves';
import { PROLOGUE_LEVEL_ID } from '../../data/chapters/prologue/tutorialStaging';
import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { buildSingleEnemyBattleUnit } from '../../engine/battleSetup';
import { computeCombatForecast, computeStatusMoveForecast } from '../../engine/combatEngine';
import { chooseEnemyAction } from '../../engine/enemyAi';
import {
  computeUnitMovementAndAttackRange,
  coordKey,
  getMapTerrainAt,
} from '../../engine/terrainAndPathfinding';
import type { ManualEnemyBattleSpawn } from '../../types/schemas';
import { runAllyNpcPhase } from './battleAllyPhaseRunner';
import {
  dismissBeginBattleCard,
  ensureTilePairVisible,
  playPhaseTransitionAsync,
  waitBattleMs,
} from './battleBannersAndTransitions';
import { playCombatExchangeAsync } from './battleCombatAnimator';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
} from './battleDangerAndViewportState';
import { runTurnStartEvents, runUnitDefeatedEvents } from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd, triggerVictoryModal } from './battleOutcomeModals';
import {
  playStatusHexActionAsync,
  runFactionPhaseStartStatusTicks,
} from './battleStatusHexController';
import {
  triggerPrologueTurn2Drills,
  triggerPrologueTurn3ItemDrill,
} from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getLivingAlliedUnits,
  getLivingEnemies,
  getLivingPlayers,
  getLivingUnits,
  getLordUnit,
  getUnitVisualKey,
} from './battleUnitQueries';
import { playWalkPathAsync } from './battleWalkAndHealAnimator';

export async function requestManualEndPhase(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  if (
    !state.openState ||
    state.phase !== 'player_phase' ||
    (state.interactionState !== 'idle' && state.interactionState !== 'unit_selected')
  ) {
    return;
  }
  audioManager.playSfx('select');
  clearBattleSelection(state, dom, prepOverlay);
  await runEnemyPhase(ctx);
}

function activateThreatenedSquads(state: BattleControllerContext['state']): void {
  const living = getLivingUnits(state);
  const hostiles = living.filter((u) => u.faction === 'player' || u.faction === 'npc');
  for (const enemy of getLivingEnemies(state)) {
    if (!enemy.squadId || state.activatedSquadIds.has(enemy.squadId)) continue;
    const { allAttackableTiles } = computeUnitMovementAndAttackRange(state.map, enemy, living);
    if (hostiles.some((h) => allAttackableTiles.has(coordKey(h.x, h.y)))) {
      state.activatedSquadIds.add(enemy.squadId);
    }
  }
}

export async function runEnemyPhase(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const runGen = state.battleRunGen;
  if (!state.openState || state.phase !== 'player_phase') return;

  dismissBeginBattleCard(state, dom);
  clearBattleSelection(state, dom, prepOverlay);

  if (await runAllyNpcPhase(ctx, runGen)) {
    return;
  }
  if (!state.openState || runGen !== state.battleRunGen) return;

  state.phase = 'enemy_phase';
  state.interactionState = 'enemy_acting';
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  audioManager.playSfx('phase_change');
  await playPhaseTransitionAsync(state, dom, 'enemy', runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await runTurnStartEvents(ctx, state.turnNumber, 'enemy_phase', runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  runFactionPhaseStartStatusTicks(ctx, getLivingEnemies(state));
  if (!state.openState || runGen !== state.battleRunGen) return;

  const protectedSet = new Set(state.defeatIfUnitIdsFall);
  activateThreatenedSquads(state);
  const enemiesOrder = [...getLivingEnemies(state)];
  for (const enemy of enemiesOrder) {
    if (!state.openState || runGen !== state.battleRunGen) return;
    if (enemy.defeated || enemy.currentHp <= 0) continue;

    state.inspectedTile = { x: enemy.x, y: enemy.y };
    ensureTilePairVisible(state, enemy.x, enemy.y, enemy.x, enemy.y);
    updateBattleInfoStrip(ctx);

    const decision = chooseEnemyAction(
      state.map,
      enemy,
      getLivingUnits(state),
      protectedSet,
      state.activatedSquadIds
    );

    if (decision.path.length > 1) {
      await playWalkPathAsync(state, enemy, decision.path, true);
      if (!state.openState || runGen !== state.battleRunGen) return;
      state.inspectedTile = { x: enemy.x, y: enemy.y };
      recomputeDangerArea(ctx);
      updateBattleInfoStrip(ctx);
    }

    if (decision.kind === 'status' && decision.statusHex) {
      const target = state.units.find(
        (u) => u.id === decision.statusHex!.targetUnitId && !u.defeated && u.currentHp > 0
      );
      if (target) {
        const stForecast = computeStatusMoveForecast(
          state.map,
          enemy,
          target,
          decision.statusHex.moveId
        );
        if (stForecast && !stForecast.blockedReason) {
          await waitBattleMs(state, 150);
          if (!state.openState || runGen !== state.battleRunGen) return;
          await playStatusHexActionAsync(ctx, enemy, target, stForecast, runGen);
          if (!state.openState || runGen !== state.battleRunGen) return;
          recomputeDangerArea(ctx);
        }
      }
    } else if (decision.kind === 'attack' && decision.attack) {
      const target = state.units.find(
        (u) => u.id === decision.attack!.targetUnitId && !u.defeated && u.currentHp > 0
      );
      if (target) {
        equipMoveInItsSlot(enemy, decision.attack.moveId);
        const liveForecast = computeCombatForecast(
          state.map,
          enemy,
          target,
          decision.attack.moveId
        );
        if (liveForecast) {
          await waitBattleMs(state, 160);
          if (!state.openState || runGen !== state.battleRunGen) return;
          await playCombatExchangeAsync(ctx, enemy, target, liveForecast, runGen);
          if (!state.openState || runGen !== state.battleRunGen) return;

          await runUnitDefeatedEvents(ctx, [enemy, target], runGen);
          if (!state.openState || runGen !== state.battleRunGen) return;

          recomputeDangerArea(ctx);
          if (checkAndTriggerMatchEnd(ctx)) {
            return;
          }
        }
      }
    }

    if (!enemy.defeated && enemy.currentHp > 0) {
      enemy.waited = true;
      enemy.action = 'Idle';
    }
    await waitBattleMs(state, 140);
  }

  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;

  if (
    state.objectiveType === 'survive_turns' &&
    state.surviveTurns !== undefined &&
    state.turnNumber >= state.surviveTurns
  ) {
    triggerVictoryModal(ctx);
    return;
  }

  state.turnNumber += 1;
  for (const unit of getLivingUnits(state)) {
    unit.waited = false;
    unit.action = 'Idle';
  }

  await processTurnReinforcements(ctx, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await runTurnStartEvents(ctx, state.turnNumber, 'player_phase', runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;

  runFactionPhaseStartStatusTicks(ctx, getLivingAlliedUnits(state));
  for (const au of getLivingAlliedUnits(state)) {
    const terrain = getMapTerrainAt(state.map, au.x, au.y);
    if (terrain === 'wonder_tile' && au.status !== null) {
      au.status = null;
      au.statusTurns = 0;
      spawnFloatingText(state, dom, au.x, Math.max(0, au.y - 1), 'CURED!', '#68f8a8');
    }
    if (terrain === 'wonder_tile' && au.currentHp < au.maxHp) {
      const healAmt = Math.max(1, Math.floor(au.maxHp * 0.2));
      const actualHeal = Math.min(au.maxHp - au.currentHp, healAmt);
      au.currentHp += actualHeal;
      spawnFloatingText(state, dom, au.x, au.y, `+${actualHeal} HP`, '#68f098');
    }
  }

  recomputeDangerArea(ctx);
  const lord = getLordUnit(state) ?? getLivingPlayers(state)[0];
  if (lord) {
    ensureTilePairVisible(state, lord.x, lord.y, lord.x, lord.y);
    state.inspectedTile = { x: lord.x, y: lord.y };
  }

  state.phase = 'player_phase';
  state.interactionState = 'idle';
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  audioManager.playSfx('phase_change');
  void playPhaseTransitionAsync(state, dom, 'player', runGen).then(() => {
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    if (state.activeLevelId === PROLOGUE_LEVEL_ID) {
      if (state.turnNumber === 2) void triggerPrologueTurn2Drills(ctx, runGen);
      else if (state.turnNumber === 3) void triggerPrologueTurn3ItemDrill(ctx, runGen);
      return;
    }
  });
}

async function processTurnReinforcements(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  if (state.reinforcements.length === 0) return;
  const dueWaves = state.reinforcements.filter(
    (w) =>
      w.turnNumber === state.turnNumber &&
      !state.spawnedReinforcementIds.has(w.id) &&
      !state.blockedReinforcementIds.has(w.id)
  );
  if (dueWaves.length === 0) return;

  for (const wave of dueWaves) {
    if (!state.openState || runGen !== state.battleRunGen) return;
    const occupant = getLivingUnits(state).find(
      (u) => u.x === wave.stairsX && u.y === wave.stairsY
    );
    if (occupant) {
      state.blockedReinforcementIds.add(wave.id);
      audioManager.playSfx('select');
      spawnFloatingText(state, dom, wave.stairsX, wave.stairsY, 'STAIRS BLOCKED!', '#88f8b8', 1050);
      await waitBattleMs(state, 200);
      continue;
    }

    const spawnDef: ManualEnemyBattleSpawn = {
      ...wave.enemy,
      id: wave.enemy.id || wave.id,
      x: wave.stairsX,
      y: wave.stairsY,
    };
    const newEnemy = buildSingleEnemyBattleUnit(spawnDef, state.units.length, performance.now());
    if (!newEnemy) continue;
    const enemyVisKey = getUnitVisualKey(newEnemy);
    if (!state.spriteBundles.has(enemyVisKey)) {
      state.spriteBundles.set(enemyVisKey, await loadSpeciesSpriteBundle(enemyVisKey));
    }
    state.units.push(newEnemy);
    state.spawnedReinforcementIds.add(wave.id);
    ensureTilePairVisible(state, newEnemy.x, newEnemy.y, newEnemy.x, newEnemy.y);
    audioManager.playSfx('phase_change');
    spawnFloatingText(state, dom, newEnemy.x, newEnemy.y, 'REINFORCEMENT!', '#ff8090', 1050);
    recomputeDangerArea(ctx);
    ctx.renderNow();
    await waitBattleMs(state, 260);
  }
}
