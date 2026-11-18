/**
 * Async Tile-by-Tile Walk Path & Support-Heal VFX Animator
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import {
  STATUS_ACTION_CALLOUTS,
  STATUS_BADGE_COLORS,
  applyInflictedStatusToUnit,
  type BattleUnitState,
  type HealForecast,
  type StatusMoveForecast,
} from '../../engine/combatEngine';
import { computeSupportHealExpGain } from '../../engine/progressionEngine';
import type { AStarPathStep } from '../../engine/terrainAndPathfinding';
import { ensureTilePairVisible, waitBattleMs } from './battleBannersAndTransitions';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import {
  awardBattleAllyPairSupportPoint,
  awardBattleCombatSupportPoints,
} from './battleSupportHelpers';
import { getBattleRng, type BattleControllerContext, type BattleRuntimeState } from './battleTypesAndState';

export function playWalkPathAsync(
  state: BattleRuntimeState,
  unit: BattleUnitState,
  path: AStarPathStep[],
  followCamera: boolean
): Promise<void> {
  if (path.length <= 1) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    unit.action = 'Walk';
    unit.frameIndex = 0;
    state.activeWalk = {
      unitId: unit.id,
      steps: path,
      segmentIndex: 0,
      segmentElapsedMs: 0,
      lastTickMs: performance.now(),
      followCamera,
      onComplete: () => {
        unit.action = 'Idle';
        unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
        unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
        resolve();
      },
    };
  });
}

export async function playHealActionAsync(
  ctx: BattleControllerContext,
  healer: BattleUnitState,
  target: BattleUnitState,
  healForecast: HealForecast,
  runGen = ctx.state.battleRunGen
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  ensureTilePairVisible(state, healer.x, healer.y, target.x, target.y);

  if (target.id !== healer.id) {
    healer.direction = directionFromDelta(target.x - healer.x, target.y - healer.y);
  }
  healer.action = 'Special';
  healer.frameIndex = 0;

  const slot = healer.activeMoves.find((s) => s.id === healForecast.move.id);
  if (slot) {
    slot.ppRemaining = healForecast.ppAfter;
  }

  const fromCenterX = healer.x * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const fromCenterY = healer.y * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const toCenterX = target.x * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const toCenterY = target.y * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;

  state.activeStrikeVfx = {
    kind: target.id === healer.id ? 'impact_burst' : 'ranged',
    fromWorldX: fromCenterX,
    fromWorldY: fromCenterY,
    toWorldX: toCenterX,
    toWorldY: toCenterY,
    color: '#68f8a8',
    startedAtMs: performance.now(),
    durationMs: 280,
  };

  await waitBattleMs(state, 200);
  if (!state.openState || runGen !== state.battleRunGen) return;

  audioManager.playSfx('heal');
  const isDelayedHeal = Boolean(healForecast.move.supportPayload?.delayedHeal);
  const shield = healForecast.shield;
  if (shield) {
    const others = (target.activeShields ?? []).filter((s) => s.moveId !== healForecast.move.id);
    target.activeShields = [
      ...others,
      {
        moveId: healForecast.move.id,
        reduction: shield.reduction,
        category: shield.category,
        turnsLeft: shield.turns,
      },
    ];
  } else if (isDelayedHeal) {
    target.pendingWishHeal = healForecast.healPower;
  } else {
    target.currentHp = healForecast.projectedTargetHp;
  }
  if (healForecast.curesStatus) {
    target.status = null;
    target.statusTurns = 0;
  }

  state.activeStrikeVfx = {
    kind: 'impact_burst',
    fromWorldX: toCenterX,
    fromWorldY: toCenterY,
    toWorldX: toCenterX,
    toWorldY: toCenterY,
    color: '#68f8a8',
    startedAtMs: performance.now(),
    durationMs: 300,
  };

  const healMsg = shield
    ? `${healForecast.move.name.toUpperCase()}!`
    : isDelayedHeal
    ? 'WISH!'
    : healForecast.actualHeal > 0
      ? `+${healForecast.actualHeal} HP${healForecast.curesStatus ? ' · CURED!' : ''}`
      : 'CURED!';
  spawnFloatingText(state, dom, target.x, target.y, healMsg, '#68f8a8');
  updateBattleInfoStrip(ctx);

  await waitBattleMs(state, 320);
  if (!state.openState || runGen !== state.battleRunGen) return;

  state.activeStrikeVfx = null;
  healer.action = 'Idle';

  if (healer.faction === 'player' && !healer.defeated && healer.currentHp > 0) {
    awardBattleAllyPairSupportPoint(ctx, healer, target);
    const enemies = state.units.filter((u) => u.faction === 'enemy');
    const chapterLv =
      enemies.length > 0
        ? Math.max(1, Math.round(enemies.reduce((s, e) => s + e.level, 0) / enemies.length))
        : healer.level;
    const healExp = computeSupportHealExpGain(healer.level, chapterLv);
    await grantExpAndHandleLevelUps(ctx, healer, healExp, runGen);
  }
}

export async function playStatusHexActionAsync(
  ctx: BattleControllerContext,
  caster: BattleUnitState,
  target: BattleUnitState,
  forecast: StatusMoveForecast,
  runGen = ctx.state.battleRunGen
): Promise<boolean> {
  const { state, dom, audioManager } = ctx;
  if (caster.faction !== 'enemy' && target.faction === 'enemy' && target.squadId) {
    state.activatedSquadIds.add(target.squadId);
  }
  ensureTilePairVisible(state, caster.x, caster.y, target.x, target.y);

  caster.direction = directionFromDelta(target.x - caster.x, target.y - caster.y);
  target.direction = directionFromDelta(caster.x - target.x, caster.y - target.y);
  caster.action = 'Special';
  caster.frameIndex = 0;

  const slot = caster.activeMoves.find((s) => s.id === forecast.move.id);
  if (slot) slot.ppRemaining = forecast.ppAfter;

  const fxColor = STATUS_BADGE_COLORS[forecast.inflictStatus];
  const tx = target.x * PMD_TILE_NATIVE_PX + 12;
  const ty = target.y * PMD_TILE_NATIVE_PX + 12;
  state.activeStrikeVfx = {
    kind: 'ranged',
    fromWorldX: caster.x * PMD_TILE_NATIVE_PX + 12,
    fromWorldY: caster.y * PMD_TILE_NATIVE_PX + 12,
    toWorldX: tx,
    toWorldY: ty,
    color: fxColor,
    startedAtMs: performance.now(),
    durationMs: 250,
  };
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return false;

  const r = getBattleRng(state)();
  const roll = Math.floor(Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5)) * 100) + 1;
  const didHit = !forecast.blockedReason && roll <= forecast.hitRate;

  if (!didHit) {
    audioManager.playSfx('attack_miss');
    spawnFloatingText(
      state,
      dom,
      target.x,
      target.y,
      forecast.blockedReason?.toUpperCase() ?? 'MISS',
      '#90d8f8'
    );
  } else {
    const res = applyInflictedStatusToUnit(target, forecast.inflictStatus);
    target.hitFlashUntilMs = performance.now() + 220;
    state.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: tx,
      fromWorldY: ty,
      toWorldX: tx,
      toWorldY: ty,
      color: fxColor,
      startedAtMs: performance.now(),
      durationMs: 220,
    };
    if (res.lumBerryConsumed) {
      audioManager.playSfx('heal');
      spawnFloatingText(state, dom, target.x, target.y, 'LUM BERRY!', '#68f8a8', 900);
    } else {
      audioManager.playSfx('attack_hit');
      spawnFloatingText(
        state,
        dom,
        target.x,
        target.y,
        STATUS_ACTION_CALLOUTS[forecast.inflictStatus],
        fxColor,
        920
      );
    }
  }

  updateBattleInfoStrip(ctx);
  await waitBattleMs(state, 280);
  if (!state.openState || runGen !== state.battleRunGen) return didHit;

  state.activeStrikeVfx = null;
  caster.action = 'Idle';
  if (caster.faction === 'player' && !caster.defeated && caster.currentHp > 0) {
    awardBattleCombatSupportPoints(ctx, caster, target);
    if (didHit) {
      await grantExpAndHandleLevelUps(
        ctx,
        caster,
        computeSupportHealExpGain(caster.level, target.level),
        runGen
      );
    }
  } else if (target.faction === 'player' && !target.defeated && target.currentHp > 0) {
    awardBattleCombatSupportPoints(ctx, target, caster);
  }
  return didHit;
}
