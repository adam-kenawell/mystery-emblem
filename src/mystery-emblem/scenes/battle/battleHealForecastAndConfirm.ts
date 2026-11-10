/**
 * Forecast Open / Cancel / Confirm Controllers (`Attack!`, `Heal!` & Status Hexes)
 */

import { equipMoveInItsSlot } from '../../data/equippedMoves';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getMoveById } from '../../data/index';
import {
  computeCombatForecast,
  computeHealForecast,
  isEnemyStatusMove,
} from '../../engine/combatEngine';
import { refreshCombatForecastModalDom } from './battleAttackForecastView';
import { waitBattleMs } from './battleBannersAndTransitions';
import { playCombatExchangeAsync } from './battleCombatAnimator';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import {
  runTileReachedEvents,
  runUnitDefeatedEvents,
  runUnitHealedEvents,
} from './battleEventRunner';
import { refreshHealForecastModalDom } from './battleHealForecastView';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import { runEnemyPhase } from './battlePhaseAndAiRunner';
import {
  cancelUncommittedMove,
  openFloatingCommandMenu,
} from './battleSelectionAndMenu';
import { confirmForecastStatusHex } from './battleStatusHexController';
import { triggerBattleTutorial } from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import { areAllLivingPlayersWaited, getLivingPlayers, getSelectedUnit } from './battleUnitQueries';
import { playHealActionAsync } from './battleWalkAndHealAnimator';

export function openCombatForecastModal(
  ctx: BattleControllerContext,
  targetEnemyId: string,
  moveId: string
): void {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
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

  refreshCombatForecastModalDom(ctx);
  dom.forecastModalBackdropEl.hidden = false;
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  tutorialOverlay?.notifyActionCompleted('battle_open_attack_forecast');
  ctx.renderNow();
  void triggerBattleTutorial(ctx, 'ch1_first_combat_forecast');
}

export function openHealForecastModal(
  ctx: BattleControllerContext,
  targetAllyId: string,
  moveId: string
): void {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
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

  refreshHealForecastModalDom(ctx);
  dom.forecastModalBackdropEl.hidden = false;
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
  tutorialOverlay?.notifyActionCompleted('battle_open_heal_forecast');
  void triggerBattleTutorial(ctx, 'ch1_healing_and_items');
}

export function cancelCombatForecast(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, audioManager } = ctx;
  dom.forecastModalBackdropEl.hidden = true;
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
    await confirmForecastStatusHex(ctx, runEnemyPhase);
    return;
  }
  await confirmForecastAttack(ctx);
}

async function confirmForecastAttack(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  const attacker = getSelectedUnit(state);
  const defender = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!attacker || !defender || !state.forecastMoveId) return;

  const forecast = computeCombatForecast(state.map, attacker, defender, state.forecastMoveId);
  if (!forecast) return;

  const runGen = state.battleRunGen;
  equipMoveInItsSlot(attacker, forecast.attackerSide.move.id);

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

  await playCombatExchangeAsync(ctx, attacker, defender, forecast, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  await runUnitDefeatedEvents(ctx, [attacker, defender], runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;

  recomputeDangerArea(ctx);
  if (checkAndTriggerMatchEnd(ctx)) {
    return;
  }

  if (!attacker.defeated && attacker.currentHp > 0) {
    attacker.waited = true;
    attacker.action = 'Idle';
    attacker.renderWorldX = attacker.x * PMD_TILE_NATIVE_PX;
    attacker.renderWorldY = attacker.y * PMD_TILE_NATIVE_PX;
  }

  clearBattleSelection(state, dom, prepOverlay);
  if (!attacker.defeated && attacker.currentHp > 0) {
    await runTileReachedEvents(ctx, attacker, runGen);
    if (!state.openState || runGen !== state.battleRunGen) return;
    if (checkAndTriggerMatchEnd(ctx)) return;
  }
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (getLivingPlayers(state).some((u) => u.currentHp < u.maxHp)) {
    // e.g. the Prologue sparring counter: teach healing right after the first hit lands.
    void triggerBattleTutorial(ctx, 'ch1_healing_and_items');
  }

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 240);
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await runEnemyPhase(ctx);
  }
}

async function confirmForecastHeal(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const healer = getSelectedUnit(state);
  const target = state.units.find(
    (u) => u.id === state.forecastTargetId && !u.defeated && u.currentHp > 0
  );
  if (!healer || !target || !state.forecastMoveId) return;

  const healForecast = computeHealForecast(state.map, healer, target, state.forecastMoveId);
  if (!healForecast) return;

  const runGen = state.battleRunGen;
  ctx.tutorialOverlay?.notifyActionCompleted('battle_confirm_heal');
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

  healer.waited = true;
  healer.action = 'Idle';
  healer.renderWorldX = healer.x * PMD_TILE_NATIVE_PX;
  healer.renderWorldY = healer.y * PMD_TILE_NATIVE_PX;

  recomputeDangerArea(ctx);
  clearBattleSelection(state, dom, prepOverlay);
  await runTileReachedEvents(ctx, healer, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;
  await runUnitHealedEvents(ctx, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 240);
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await runEnemyPhase(ctx);
  }
}
