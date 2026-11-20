/**
 * Strike-by-Strike Animated Combat Exchange, Item Drop & EXP Award Sequencer
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import {
  buildUnitFaintDialogueScript,
  isPlayableFaintUnit,
} from '../../data/faintMessages';
import { getItemById } from '../../data/index';
import {
  applyInflictedStatusToUnit,
  resolveCombatExchange,
  type BattleUnitState,
  type CombatForecast,
} from '../../engine/combatEngine';
import { computeCombatExpGain } from '../../engine/progressionEngine';
import {
  logBerryStolen,
  logCombatHit,
  logCombatImmune,
  logCombatMiss,
  logItemDrop,
  logParalyzedSkip,
  logStatusInflicted,
  logUnitFainted,
} from './battleActionLog';
import { ensureTilePairVisible, showPhaseBanner, waitBattleMs } from './battleBannersAndTransitions';
import { syncHudControls } from './battleDangerAndViewportState';
import { runUnitDamagedEvents } from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import { awardBattleCombatSupportPoints } from './battleSupportHelpers';
import { getBattleRng, type BattleControllerContext } from './battleTypesAndState';

async function dissolveDefeatedUnitAsync(
  ctx: BattleControllerContext,
  target: BattleUnitState,
  runGen: number
): Promise<void> {
  const { state, audioManager } = ctx;
  if (target.defeated) return;
  audioManager.playSfx('unit_ko');
  const koSteps = 6;
  for (let s = 1; s <= koSteps; s++) {
    if (!state.openState || runGen !== state.battleRunGen) return;
    target.koDissolveProgress = s / koSteps;
    await waitBattleMs(state, 55);
  }
  target.defeated = true;
  state.trackedEnemyIds.delete(target.id);
}

async function playPlayableUnitFaintSequenceAsync(
  ctx: BattleControllerContext,
  target: BattleUnitState,
  runGen: number
): Promise<void> {
  const { state, dom, dialogueOverlay } = ctx;
  if (!dialogueOverlay) {
    await dissolveDefeatedUnitAsync(ctx, target, runGen);
    return;
  }

  ensureTilePairVisible(state, target.x, target.y, target.x, target.y);
  const causesDefeat = Boolean(
    target.isLord || target.mustSurvive || state.defeatIfUnitIdsFall.includes(target.id)
  );
  const script = buildUnitFaintDialogueScript(target, {
    restorePreviousBgmOnClose: !causesDefeat,
    turnNumber: state.turnNumber,
  });

  const narratorLineIdx = script.lines.length - 1;
  let dissolvePromise: Promise<void> | null = null;

  state.cutsceneInProgress = true;
  syncHudControls(state, dom);
  ctx.onLayerStateChanged();
  ctx.renderNow();
  try {
    await dialogueOverlay.playScript(script, {
      onLineStart: (lineIndex) => {
        if (lineIndex === narratorLineIdx && !dissolvePromise) {
          dissolvePromise = dissolveDefeatedUnitAsync(ctx, target, runGen);
        }
      },
    });
  } finally {
    if (state.openState && runGen === state.battleRunGen) {
      state.cutsceneInProgress = false;
      syncHudControls(state, dom);
      ctx.onLayerStateChanged();
      ctx.renderNow();
    }
  }

  if (!state.openState || runGen !== state.battleRunGen) return;
  if (dissolvePromise) {
    await dissolvePromise;
  } else if (!target.defeated) {
    await dissolveDefeatedUnitAsync(ctx, target, runGen);
  }
}

export async function playCombatExchangeAsync(
  ctx: BattleControllerContext,
  attacker: BattleUnitState,
  defender: BattleUnitState,
  forecast: CombatForecast,
  runGen = ctx.state.battleRunGen
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  if (attacker.faction !== 'enemy' && defender.faction === 'enemy' && defender.squadId) {
    state.activatedSquadIds.add(defender.squadId);
  }
  const rng = getBattleRng(state);
  const outcome = resolveCombatExchange(forecast, attacker, defender, rng);

  ensureTilePairVisible(state, attacker.x, attacker.y, defender.x, defender.y);

  for (const strike of outcome.strikes) {
    if (!state.openState || runGen !== state.battleRunGen) return;

    const actor = strike.actorId === attacker.id ? attacker : defender;
    const target = strike.targetId === attacker.id ? attacker : defender;
    if (actor.defeated || target.defeated) break;

    actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
    target.direction = directionFromDelta(actor.x - target.x, actor.y - target.y);

    const actorMoveSlot = actor.activeMoves.find((s) => s.id === strike.move.id);
    if (actorMoveSlot) {
      actorMoveSlot.ppRemaining = strike.actorPpAfter;
    }

    if (strike.paralyzedSkip) {
      audioManager.playSfx('cancel');
      logParalyzedSkip(state, dom, actor);
      await waitBattleMs(state, 340);
      continue;
    }

    const isPhysical = strike.move.category === 'Physical';
    actor.action = isPhysical ? 'Attack' : 'Special';
    actor.frameIndex = 0;
    actor.nextFrameAt = performance.now() + 70;

    const dxNorm = Math.sign(target.x - actor.x);
    const dyNorm = Math.sign(target.y - actor.y);

    if (isPhysical) {
      actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX + dxNorm * 6;
      actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX + dyNorm * 6;
      state.activeStrikeVfx = {
        kind: 'melee',
        fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
        fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
        toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        color: strike.isCrit ? '#f8d048' : '#ffffff',
        startedAtMs: performance.now(),
        durationMs: 220,
      };
      await waitBattleMs(state, 190);
    } else {
      state.activeStrikeVfx = {
        kind: 'ranged',
        fromWorldX: actor.x * PMD_TILE_NATIVE_PX + 12,
        fromWorldY: actor.y * PMD_TILE_NATIVE_PX + 12,
        toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
        toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
        color: strike.isCrit ? '#f8d048' : '#68e0ff',
        startedAtMs: performance.now(),
        durationMs: 260,
      };
      await waitBattleMs(state, 240);
    }

    if (!state.openState || runGen !== state.battleRunGen) return;

    actor.renderWorldX = actor.x * PMD_TILE_NATIVE_PX;
    actor.renderWorldY = actor.y * PMD_TILE_NATIVE_PX;

    if (!strike.didHit) {
      audioManager.playSfx('attack_miss');
      target.renderWorldX = target.x * PMD_TILE_NATIVE_PX + (dyNorm !== 0 ? 4 : 0);
      target.renderWorldY = target.y * PMD_TILE_NATIVE_PX + (dxNorm !== 0 ? -3 : 0);
      spawnFloatingText(state, dom, target.x, target.y, 'MISS', '#90d8f8');
      logCombatMiss(state, dom, actor, target, strike.move.name);
      await waitBattleMs(state, 260);
      target.renderWorldX = target.x * PMD_TILE_NATIVE_PX;
      target.renderWorldY = target.y * PMD_TILE_NATIVE_PX;
      actor.action = 'Idle';
      continue;
    }

    target.currentHp = strike.targetHpAfter;
    target.action = 'Hurt';
    target.frameIndex = 0;
    target.hitFlashUntilMs = performance.now() + 230;

    state.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
      fromWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
      toWorldX: target.x * PMD_TILE_NATIVE_PX + 12,
      toWorldY: target.y * PMD_TILE_NATIVE_PX + 12,
      color: strike.isCrit ? '#f8d048' : '#ff6878',
      startedAtMs: performance.now(),
      durationMs: 210,
    };

    if (strike.typeMultiplier === 0) {
      audioManager.playSfx('attack_miss');
      logCombatImmune(state, dom, actor, target, strike.move.name);
    } else if (strike.isCrit) {
      audioManager.playSfx('critical_hit');
      spawnFloatingText(state, dom, target.x, target.y, `CRIT! -${strike.damageDealt}`, '#f8d048');
      logCombatHit(state, dom, actor, target, strike.move.name, strike.damageDealt, true);
    } else {
      audioManager.playSfx('attack_hit');
      spawnFloatingText(state, dom, target.x, target.y, `-${strike.damageDealt}`, '#ff7888');
      logCombatHit(state, dom, actor, target, strike.move.name, strike.damageDealt, false);
    }

    if (strike.consumedBerryItemId) {
      target.heldItemId = null;
      const healed = strike.actorHpAfter - actor.currentHp;
      actor.currentHp = strike.actorHpAfter;
      if (strike.actorStatusCured) {
        actor.status = null;
        actor.statusTurns = 0;
      }
      const berryName = getItemById(strike.consumedBerryItemId)?.name ?? 'Berry';
      audioManager.playSfx('heal');
      logBerryStolen(state, dom, actor, target, berryName, healed, Boolean(strike.actorStatusCured));
    }

    updateBattleInfoStrip(ctx);
    await waitBattleMs(state, 310);
    if (!state.openState || runGen !== state.battleRunGen) return;

    actor.action = 'Idle';
    state.activeStrikeVfx = null;

    if (strike.targetDefeated) {
      logUnitFainted(state, dom, target);
      if (target.faction === 'enemy' && target.droppableItemId) {
        const dropId = target.droppableItemId;
        target.droppableItemId = null;
        state.collectedDrops.push(dropId);
        const dropDef = getItemById(dropId);
        const dropName = dropDef?.name ?? dropId;
        audioManager.playSfx('heal');
        showPhaseBanner(state, dom, `Obtained ${dropName}!`);
        logItemDrop(state, dom, dropName);
      }
      if (isPlayableFaintUnit(target)) {
        await playPlayableUnitFaintSequenceAsync(ctx, target, runGen);
      } else {
        await dissolveDefeatedUnitAsync(ctx, target, runGen);
      }
      if (!state.openState || runGen !== state.battleRunGen) return;
      break;
    } else {
      target.action = 'Idle';
      if (strike.inflictedStatus) {
        const stRes = applyInflictedStatusToUnit(target, strike.inflictedStatus);
        logStatusInflicted(state, dom, target, strike.inflictedStatus, stRes.lumBerryConsumed);
      }
    }
  }

  state.activeStrikeVfx = null;

  const playerUnit =
    attacker.faction === 'player' ? attacker : defender.faction === 'player' ? defender : null;
  const enemyUnit =
    attacker.faction === 'enemy' ? attacker : defender.faction === 'enemy' ? defender : null;

  if (
    playerUnit &&
    enemyUnit &&
    !playerUnit.defeated &&
    playerUnit.currentHp > 0 &&
    outcome.strikes.some((s) => s.actorId === playerUnit.id)
  ) {
    awardBattleCombatSupportPoints(ctx, playerUnit, enemyUnit);
    const playerStrikes = outcome.strikes.filter((s) => s.actorId === playerUnit.id);
    const landedHit = playerStrikes.some((s) => s.didHit);
    const dealtDamage = playerStrikes.some((s) => s.didHit && s.damageDealt > 0);
    const defeatedEnemy = enemyUnit.defeated || enemyUnit.currentHp <= 0;
    const expGain = computeCombatExpGain({
      playerLevel: playerUnit.level,
      enemyLevel: enemyUnit.level,
      landedHit,
      dealtDamage,
      defeatedEnemy,
    });
    await grantExpAndHandleLevelUps(ctx, playerUnit, expGain, runGen);
  } else if (
    playerUnit &&
    enemyUnit &&
    !playerUnit.defeated &&
    playerUnit.currentHp > 0 &&
    outcome.strikes.length > 0
  ) {
    awardBattleCombatSupportPoints(ctx, playerUnit, enemyUnit);
  }

  if (!state.openState || runGen !== state.battleRunGen) return;

  const damagedTargetIds = new Set<string>();
  for (const strike of outcome.strikes) {
    if (strike.didHit && strike.damageDealt > 0) {
      damagedTargetIds.add(strike.targetId);
    }
  }
  const damagedUnitIds = [attacker, defender]
    .filter((u) => damagedTargetIds.has(u.id) && !u.defeated && u.currentHp > 0)
    .map((u) => u.id);
  if (damagedUnitIds.length > 0) {
    await runUnitDamagedEvents(ctx, damagedUnitIds, runGen);
  }
}
