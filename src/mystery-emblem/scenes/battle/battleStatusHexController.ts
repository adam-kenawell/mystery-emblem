/**
 * Step 7 Status Hex Forecast View, Cast Animator & Phase-Start Status Tick Runner
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import {
  STATUS_ACTION_CALLOUTS,
  STATUS_BADGE_COLORS,
  applyInflictedStatusToUnit,
  applyPhaseStartStatusTick,
  computeStatusMoveForecast,
  type BattleMoveSlot,
  type BattleUnitState,
  type StatusMoveForecast,
} from '../../engine/combatEngine';
import { computeSupportHealExpGain } from '../../engine/progressionEngine';
import { ensureTilePairVisible, waitBattleMs } from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { runTileReachedEvents } from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import {
  buildHexForecastLines,
  renderForecastLog,
  setForecastConfirm,
  setForecastHpBars,
  positionForecastFrame,
  setForecastSidePortrait,
  setForecastSideStats,
  setForecastSideVisible,
} from './battleForecastLog';
import { renderForecastMoveList } from './battleForecastMoveList';
import { updateBattleInfoStrip } from './battleHudCards';
import { grantExpAndHandleLevelUps } from './battleLevelUpModal';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import {
  awardBattleCombatSupportPoints,
  getBattleSupportContext,
} from './battleSupportHelpers';
import { getBattleRng, type BattleControllerContext } from './battleTypesAndState';
import {
  areAllLivingPlayersWaited,
  getSelectedUnit,
} from './battleUnitQueries';

export function renderStatusHexForecastModalDom(
  ctx: BattleControllerContext,
  caster: BattleUnitState,
  defender: BattleUnitState,
  chosenSlot: BattleMoveSlot,
  validMoves: ReadonlyArray<BattleMoveSlot>,
  onRefresh: () => void
): void {
  const { state, dom } = ctx;
  const forecast = computeStatusMoveForecast(
    state.map,
    caster,
    defender,
    chosenSlot.id,
    undefined,
    getBattleSupportContext(state)
  );
  if (!forecast) return;
  state.currentForecast = null;

  const backdrop = dom.forecastModalBackdropEl;
  setForecastConfirm(backdrop, 'Hex!', Boolean(forecast.blockedReason));
  renderForecastMoveList(ctx, caster, validMoves, chosenSlot.id, onRefresh);
  renderForecastLog(backdrop, buildHexForecastLines(defender, forecast));
  setForecastSideStats(backdrop, 'attacker', null);
  setForecastSideStats(backdrop, 'defender', { note: 'No Counter' });
  setForecastSideVisible(backdrop, 'defender', true);
  setForecastSidePortrait(backdrop, 'attacker', caster);
  setForecastSidePortrait(backdrop, 'defender', defender);
  setForecastHpBars(backdrop, 'attacker', caster, caster.currentHp);
  setForecastHpBars(backdrop, 'defender', defender, defender.currentHp);
  positionForecastFrame(backdrop, dom.canvas, state.cam, [caster, defender]);
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
    durationMs: state.fastMode ? 60 : 250,
  };
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return false;

  const r = getBattleRng(state)();
  const roll = Math.floor(Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5)) * 100) + 1;
  const didHit = !forecast.blockedReason && roll <= forecast.hitRate;

  if (!didHit) {
    audioManager.playSfx('attack_miss');
    spawnFloatingText(state, dom, target.x, target.y, forecast.blockedReason?.toUpperCase() ?? 'MISS', '#90d8f8');
  } else {
    const res = applyInflictedStatusToUnit(target, forecast.inflictStatus);
    target.hitFlashUntilMs = performance.now() + (state.fastMode ? 60 : 220);
    state.activeStrikeVfx = {
      kind: 'impact_burst',
      fromWorldX: tx,
      fromWorldY: ty,
      toWorldX: tx,
      toWorldY: ty,
      color: fxColor,
      startedAtMs: performance.now(),
      durationMs: state.fastMode ? 60 : 220,
    };
    if (res.lumBerryConsumed) {
      audioManager.playSfx('heal');
      spawnFloatingText(state, dom, target.x, target.y, 'LUM BERRY!', '#68f8a8', 900);
    } else {
      audioManager.playSfx('attack_hit');
      spawnFloatingText(state, dom, target.x, target.y, STATUS_ACTION_CALLOUTS[forecast.inflictStatus], fxColor, 920);
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
      await grantExpAndHandleLevelUps(ctx, caster, computeSupportHealExpGain(caster.level, target.level), runGen);
    }
  } else if (target.faction === 'player' && !target.defeated && target.currentHp > 0) {
    awardBattleCombatSupportPoints(ctx, target, caster);
  }
  return didHit;
}

export async function confirmForecastStatusHex(
  ctx: BattleControllerContext,
  onRunEnemyPhase: (ctx: BattleControllerContext) => Promise<void>
): Promise<void> {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  const caster = getSelectedUnit(state);
  const target = state.units.find((u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0);
  if (!caster || !target || !state.forecastMoveId) return;

  const forecast = computeStatusMoveForecast(
    state.map,
    caster,
    target,
    state.forecastMoveId,
    undefined,
    getBattleSupportContext(state)
  );
  if (!forecast || forecast.blockedReason) return;

  const runGen = state.battleRunGen;
  tutorialOverlay?.notifyActionCompleted('battle_confirm_attack');
  audioManager.playSfx('select');
  dom.forecastModalBackdropEl.hidden = true;
  dom.actionMenuEl.hidden = true;
  state.currentRange = null;
  state.previewPath = null;
  state.interactionState = 'combat_animating';
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  await playStatusHexActionAsync(ctx, caster, target, forecast, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  caster.waited = true;
  caster.action = 'Idle';
  caster.renderWorldX = caster.x * PMD_TILE_NATIVE_PX;
  caster.renderWorldY = caster.y * PMD_TILE_NATIVE_PX;

  recomputeDangerArea(ctx);
  clearBattleSelection(state, dom, prepOverlay);
  await runTileReachedEvents(ctx, caster, runGen);
  if (!state.openState || runGen !== state.battleRunGen || checkAndTriggerMatchEnd(ctx)) return;

  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 240);
    if (state.openState && runGen === state.battleRunGen && state.phase === 'player_phase') {
      await onRunEnemyPhase(ctx);
    }
  }
}

export function runFactionPhaseStartStatusTicks(
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
      spawnFloatingText(state, dom, unit.x, unit.y, `WISH +${healed} HP`, '#68f8a8', 880);
    }
    if (unit.activeShields?.length) {
      unit.activeShields = unit.activeShields
        .map((s) => ({ ...s, turnsLeft: s.turnsLeft - 1 }))
        .filter((s) => s.turnsLeft > 0);
    }
    const tick = applyPhaseStartStatusTick(unit);
    if (tick.calloutText) {
      spawnFloatingText(state, dom, unit.x, unit.y, tick.calloutText, tick.calloutColor, 880);
    }
  }
}
