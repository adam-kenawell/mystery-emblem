/**
 * Ally & Enemy Phase AI Sequencer, Dungeon Stairs Reinforcements & Start-of-Turn Events
 */

import { equipMoveInItsSlot } from '../../data/equippedMoves';
import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import { buildSingleEnemyBattleUnit } from '../../engine/battleSetup';
import {
  applyPhaseStartStatusTick,
  computeCombatForecast,
  computeStatusMoveForecast,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { chooseEnemyAction, chooseNpcAllyAction } from '../../engine/enemyAi';
import {
  computeUnitMovementAndAttackRange,
  coordKey,
  getMapTerrainAt,
  type MovementRangeResult,
} from '../../engine/terrainAndPathfinding';
import type { ManualEnemyBattleSpawn } from '../../types/schemas';
import {
  dismissBeginBattleCard,
  ensureTilePairVisible,
  playPhaseTransitionAsync,
  waitBattleMs,
} from './battleBannersAndTransitions';
import {
  logPhaseStartStatusTick,
  logPhaseStartWish,
  logShieldExpired,
  logWonderTileRecovery,
} from './battleActionLog';
import { playCombatExchangeAsync } from './battleCombatAnimator';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
} from './battleDangerAndViewportState';
import {
  runPlayerPhaseEndEvents,
  runTurnStartEvents,
  runUnitDefeatedEvents,
} from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd, triggerVictoryModal } from './battleOutcomeModals';
import { getBattleSupportContext } from './battleSupportHelpers';
import {
  triggerReactivePostCombatTutorials,
  triggerTurn2FallbackTerrainTutorial,
} from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  faceUnitTowardBoss,
  getLivingAlliedUnits,
  getLivingEnemies,
  getLivingNpcs,
  getLivingPlayers,
  getLivingUnits,
  getLordUnit,
  getUnitVisualKey,
} from './battleUnitQueries';
import {
  playStatusHexActionAsync,
  playWalkPathAsync,
} from './battleWalkAndHealAnimator';

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

function runFactionPhaseStartStatusTicks(
  ctx: BattleControllerContext,
  units: ReadonlyArray<BattleUnitState>
): void {
  const { state, dom } = ctx;
  for (const unit of units) {
    const wishHeal = unit.pendingWishHeal ?? 0;
    if (wishHeal > 0 && !unit.defeated && unit.currentHp > 0) {
      const healed = Math.min(unit.maxHp - unit.currentHp, wishHeal);
      unit.currentHp += healed;
      unit.pendingWishHeal = 0;
      logPhaseStartWish(state, dom, unit, healed);
    }
    if (unit.activeShields?.length) {
      const nextShields = [];
      for (const s of unit.activeShields) {
        const remaining = s.turnsLeft - 1;
        if (remaining > 0) {
          nextShields.push({ ...s, turnsLeft: remaining });
        } else {
          logShieldExpired(state, dom, unit, s.moveId);
        }
      }
      unit.activeShields = nextShields;
    }
    const statusBefore = unit.status;
    const tick = applyPhaseStartStatusTick(unit);
    if (tick.chipDamage > 0) {
      spawnFloatingText(state, dom, unit.x, unit.y, `-${tick.chipDamage}`, tick.calloutColor, 880);
    }
    if (tick.chipDamage > 0 || tick.clearedStatus) {
      logPhaseStartStatusTick(state, dom, unit, {
        chipDamage: tick.chipDamage,
        status: statusBefore,
        clearedStatus: tick.clearedStatus,
      });
    }
  }
}

async function runAllyNpcPhase(
  ctx: BattleControllerContext,
  runGen: number
): Promise<boolean> {
  const { state, dom, audioManager } = ctx;
  const npcsOrder = [...getLivingNpcs(state)];
  if (npcsOrder.length === 0) {
    return false;
  }

  const initialLiving = getLivingUnits(state);
  const initialSupportCtx = getBattleSupportContext(state);
  const anyNpcActs = npcsOrder.some((npc) => {
    const decision = chooseNpcAllyAction(
      state.map,
      npc,
      initialLiving,
      initialSupportCtx,
      undefined,
      state.turnNumber
    );
    return decision.kind !== 'wait' || decision.path.length > 1;
  });
  if (!anyNpcActs) {
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

    const decision = chooseNpcAllyAction(
      state.map,
      npc,
      getLivingUnits(state),
      getBattleSupportContext(state),
      undefined,
      state.turnNumber
    );
    if (decision.kind === 'wait' && decision.path.length <= 1) {
      continue;
    }

    state.inspectedTile = { x: npc.x, y: npc.y };
    ensureTilePairVisible(state, npc.x, npc.y, npc.x, npc.y);
    updateBattleInfoStrip(ctx);

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
        equipMoveInItsSlot(npc, decision.attack.moveId);
        const liveForecast = computeCombatForecast(
          state.map,
          npc,
          target,
          decision.attack.moveId,
          undefined,
          getBattleSupportContext(state)
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

function activateThreatenedSquads(
  state: BattleControllerContext['state']
): Map<string, MovementRangeResult> {
  const living = getLivingUnits(state);
  const hostiles = living.filter((u) => u.faction === 'player' || u.faction === 'npc');
  const enemyRangeCache = new Map<string, MovementRangeResult>();
  for (const enemy of getLivingEnemies(state)) {
    const range = computeUnitMovementAndAttackRange(state.map, enemy, living);
    enemyRangeCache.set(enemy.id, range);
    if (!enemy.squadId || state.activatedSquadIds.has(enemy.squadId)) continue;
    if (hostiles.some((h) => range.allAttackableTiles.has(coordKey(h.x, h.y)))) {
      state.activatedSquadIds.add(enemy.squadId);
    }
  }
  return enemyRangeCache;
}

export async function runEnemyPhase(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const runGen = state.battleRunGen;
  if (!state.openState || state.phase !== 'player_phase') return;

  dismissBeginBattleCard(state, dom);
  clearBattleSelection(state, dom, prepOverlay);

  await runPlayerPhaseEndEvents(ctx, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;

  if (await runAllyNpcPhase(ctx, runGen)) {
    return;
  }
  if (!state.openState || runGen !== state.battleRunGen) return;

  state.phase = 'enemy_phase';
  state.interactionState = 'enemy_acting';
  for (const u of getLivingUnits(state)) {
    if (u.faction !== 'enemy') faceUnitTowardBoss(state, u);
  }
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
  const enemyRangeCache = activateThreatenedSquads(state);
  const enemiesOrder = [...getLivingEnemies(state)];
  for (const enemy of enemiesOrder) {
    if (!state.openState || runGen !== state.battleRunGen) return;
    if (enemy.defeated || enemy.currentHp <= 0) continue;

    const supportCtx = getBattleSupportContext(state);
    const decision = chooseEnemyAction(
      state.map,
      enemy,
      getLivingUnits(state),
      protectedSet,
      state.activatedSquadIds,
      supportCtx,
      enemyRangeCache.get(enemy.id)
    );
    if (decision.kind === 'wait' && decision.path.length <= 1) {
      continue;
    }

    state.inspectedTile = { x: enemy.x, y: enemy.y };
    ensureTilePairVisible(state, enemy.x, enemy.y, enemy.x, enemy.y);
    updateBattleInfoStrip(ctx);

    if (decision.path.length > 1) {
      enemyRangeCache.clear();
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
          decision.statusHex.moveId,
          undefined,
          getBattleSupportContext(state)
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
          decision.attack.moveId,
          undefined,
          getBattleSupportContext(state)
        );
        if (liveForecast) {
          await waitBattleMs(state, 160);
          if (!state.openState || runGen !== state.battleRunGen) return;
          await playCombatExchangeAsync(ctx, enemy, target, liveForecast, runGen);
          if (!state.openState || runGen !== state.battleRunGen) return;

          await runUnitDefeatedEvents(ctx, [enemy, target], runGen);
          if (!state.openState || runGen !== state.battleRunGen) return;
          if (enemy.defeated || enemy.currentHp <= 0 || target.defeated || target.currentHp <= 0) {
            enemyRangeCache.clear();
          }

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
    if (terrain !== 'wonder_tile') continue;
    let curedStatus = false;
    if (au.status !== null) {
      au.status = null;
      au.statusTurns = 0;
      curedStatus = true;
    }
    let actualHeal = 0;
    if (au.currentHp < au.maxHp) {
      const healAmt = Math.max(1, Math.floor(au.maxHp * 0.2));
      actualHeal = Math.min(au.maxHp - au.currentHp, healAmt);
      au.currentHp += actualHeal;
    }
    if (actualHeal > 0 || curedStatus) {
      logWonderTileRecovery(state, dom, au, actualHeal, curedStatus);
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
  void playPhaseTransitionAsync(state, dom, 'player', runGen).then(async () => {
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    const shownPostCombat = await triggerReactivePostCombatTutorials(ctx, runGen);
    if (!shownPostCombat && state.turnNumber === 2) {
      await triggerTurn2FallbackTerrainTutorial(ctx, runGen);
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
    recomputeDangerArea(ctx);
    ctx.renderNow();
    await waitBattleMs(state, 260);
  }
}
