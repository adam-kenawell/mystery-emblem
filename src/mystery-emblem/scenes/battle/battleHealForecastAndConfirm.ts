/**
 * Forecast Open / Cancel / Confirm Controllers (`Attack!`, `Heal!` & Status Hexes)
 */

import { equipMoveInItsSlot } from '../../data/equippedMoves';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getMoveById } from '../../data/index';
import {
  computeCombatForecast,
  computeHealForecast,
  computeStatusMoveForecast,
  isEnemyStatusMove,
} from '../../engine/combatEngine';
import { playCombatExchangeAsync } from './battleCombatAnimator';
import { finalizePlayerUnitAction } from './battleCommandExecution';
import {
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import {
  refreshCombatForecastModalDom,
  refreshHealForecastModalDom,
  setForecastMovePickerOpen,
} from './battleForecastView';
import { updateBattleInfoStrip } from './battleHudCards';
import {
  cancelUncommittedMove,
  openFloatingCommandMenu,
} from './battleSelectionAndMenu';
import { getBattleSupportContext } from './battleSupportHelpers';
import { triggerReactiveForecastTutorial } from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import { getSelectedUnit } from './battleUnitQueries';
import {
  playHealActionAsync,
  playStatusHexActionAsync,
} from './battleWalkAndHealAnimator';

export function openCombatForecastModal(
  ctx: BattleControllerContext,
  targetEnemyId: string,
  moveId: string
): void {
  const { state, dom, prepOverlay } = ctx;
  const attacker = getSelectedUnit(state);
  const defender = state.units.find(
    (u) => u.id === targetEnemyId && !u.defeated && u.currentHp > 0
  );
  if (!attacker || !defender) return;

  state.activeWalk = null;
  attacker.action = 'Idle';
  attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
  attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;

  state.forecastMode = 'attack';
  state.currentHealForecast = null;
  state.interactionState = 'combat_forecast';
  state.forecastTargetId = defender.id;
  state.forecastMoveId = moveId;

  // Unhide first: the refresh measures the frame to place it beside the units.
  dom.forecastModalBackdropEl.hidden = false;
  refreshCombatForecastModalDom(ctx);
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
  triggerReactiveForecastTutorial(ctx);
}

export function openHealForecastModal(
  ctx: BattleControllerContext,
  targetAllyId: string,
  moveId: string
): void {
  const { state, dom, prepOverlay } = ctx;
  const healer = getSelectedUnit(state);
  const targetAlly = state.units.find(
    (u) => u.id === targetAllyId && !u.defeated && u.currentHp > 0
  );
  if (!healer || !targetAlly) return;

  state.activeWalk = null;
  healer.action = 'Idle';
  healer.renderWorldX = healer.x * PMD_TILE_NATIVE_PX;
  healer.renderWorldY = healer.y * PMD_TILE_NATIVE_PX;

  state.forecastMode = 'heal';
  state.currentForecast = null;
  state.interactionState = 'combat_forecast';
  state.forecastTargetId = targetAlly.id;
  state.forecastMoveId = moveId;

  dom.forecastModalBackdropEl.hidden = false;
  refreshHealForecastModalDom(ctx);
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}

export function cancelCombatForecast(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, audioManager } = ctx;
  dom.forecastModalBackdropEl.hidden = true;
  setForecastMovePickerOpen(dom.forecastModalBackdropEl, false);
  state.forecastTargetId = null;
  state.forecastMoveId = null;
  state.currentForecast = null;
  state.currentHealForecast = null;

  if (state.forecastReturnMode === 'action_menu') {
    const selected = getSelectedUnit(state);
    if (selected) {
      audioManager.playSfx('cancel');
      openFloatingCommandMenu(ctx, selected);
      syncPrepChromeVisibility(state, dom, prepOverlay);
      return;
    }
  }
  cancelUncommittedMove(ctx);
}

export async function confirmForecastAction(ctx: BattleControllerContext): Promise<void> {
  if (ctx.state.forecastMode === 'heal') {
    await confirmForecastHeal(ctx);
    return;
  }
  if (ctx.state.forecastMoveId && isEnemyStatusMove(getMoveById(ctx.state.forecastMoveId))) {
    await confirmForecastStatusHex(ctx);
    return;
  }
  await confirmForecastAttack(ctx);
}

async function confirmForecastAttack(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const attacker = getSelectedUnit(state);
  const defender = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!attacker || !defender || !state.forecastMoveId) return;

  const forecast = computeCombatForecast(
    state.map,
    attacker,
    defender,
    state.forecastMoveId,
    undefined,
    getBattleSupportContext(state)
  );
  if (!forecast) return;

  const runGen = state.battleRunGen;
  equipMoveInItsSlot(attacker, forecast.attackerSide.move.id);

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

  await playCombatExchangeAsync(ctx, attacker, defender, forecast, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await finalizePlayerUnitAction(ctx, attacker, runGen, {
    defeatedCheckUnits: [attacker, defender],
    checkPostCombatTutorials: true,
    autoEndDelayMs: 240,
  });
}

async function confirmForecastHeal(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const healer = getSelectedUnit(state);
  const target = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!healer || !target || !state.forecastMoveId) return;

  const healForecast = computeHealForecast(
    state.map,
    healer,
    target,
    state.forecastMoveId,
    undefined,
    getBattleSupportContext(state)
  );
  if (!healForecast) return;

  const runGen = state.battleRunGen;
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

  await playHealActionAsync(ctx, healer, target, healForecast, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await finalizePlayerUnitAction(ctx, healer, runGen, {
    checkUnitHealedEvents: true,
    autoEndDelayMs: 240,
  });
}

async function confirmForecastStatusHex(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const caster = getSelectedUnit(state);
  const target = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
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

  await finalizePlayerUnitAction(ctx, caster, runGen, {
    autoEndDelayMs: 240,
  });
}
