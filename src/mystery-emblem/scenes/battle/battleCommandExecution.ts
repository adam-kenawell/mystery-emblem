/**
 * Floating Command Menu Actions: Attack/Heal Forecast Entry, Mid-Battle Item/Promotion & Wait
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getItemById } from '../../data/index';
import { waitBattleMs } from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  recomputeDangerArea,
  syncHudControls,
} from './battleDangerAndViewportState';
import { runTileReachedEvents, runUnitHealedEvents } from './battleEventRunner';
import { spawnFloatingText } from './battleFloatingCallouts';
import {
  openCombatForecastModal,
  openHealForecastModal,
} from './battleHealForecastAndConfirm';
import { updateBattleInfoStrip } from './battleHudCards';
import { checkAndTriggerMatchEnd } from './battleOutcomeModals';
import { runEnemyPhase } from './battlePhaseAndAiRunner';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  areAllLivingPlayersWaited,
  canUseUnitEquippedConsumable,
  getAttackableEnemiesFromCurrentTile,
  getHealableTargetsFromCurrentTile,
  getSelectedUnit,
} from './battleUnitQueries';

export async function useEquippedBattleConsumable(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const unit = getSelectedUnit(state);
  if (!unit || !unit.consumableItemId || !canUseUnitEquippedConsumable(unit)) return;
  const item = getItemById(unit.consumableItemId);
  if (!item) return;

  const runGen = state.battleRunGen;
  let calloutText = item.name;

  if (item.category === 'x_item') {
    if (!unit.tempBattleBoosts) {
      unit.tempBattleBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, crit: 0 };
    }
    if (item.effect.battleStatBoost) {
      const appliedLabels: string[] = [];
      for (const key of ['atk', 'def', 'spa', 'spd', 'spe'] as const) {
        const amt = item.effect.battleStatBoost[key];
        if (typeof amt === 'number' && amt !== 0) {
          unit.tempBattleBoosts[key] += amt;
          appliedLabels.push(`${key.toUpperCase()} +${amt}`);
        }
      }
      if (appliedLabels.length > 0) {
        calloutText = `${appliedLabels.join(' ')}!`;
      }
    }
    if (typeof item.effect.battleCritBoost === 'number' && item.effect.battleCritBoost !== 0) {
      unit.tempBattleBoosts.crit += item.effect.battleCritBoost;
      calloutText = `CRIT +${item.effect.battleCritBoost}%!`;
    }
  } else if (item.category === 'consumable') {
    let healed = 0;
    if (item.effect.healFull) {
      healed = unit.maxHp - unit.currentHp;
      unit.currentHp = unit.maxHp;
    } else if (item.effect.healFlat) {
      const nextHp = Math.min(unit.maxHp, unit.currentHp + item.effect.healFlat);
      healed = nextHp - unit.currentHp;
      unit.currentHp = nextHp;
    }
    if (
      (item.effect.cureStatus && unit.status !== null) ||
      (item.effect.cureSpecificStatus && unit.status === item.effect.cureSpecificStatus)
    ) {
      unit.status = null;
      unit.statusTurns = 0;
    }
    calloutText = healed > 0 ? `+${healed} HP` : 'CURED!';
  }

  unit.consumableItemId = null;
  unit.waited = true;
  unit.action = 'Idle';
  unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
  unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;

  audioManager.playSfx('heal');
  spawnFloatingText(state, dom, unit.x, unit.y, calloutText, '#68f8a8', 820);
  clearBattleSelection(state, dom, prepOverlay);
  ctx.tutorialOverlay?.notifyActionCompleted('battle_confirm_item');
  await runTileReachedEvents(ctx, unit, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;
  recomputeDangerArea(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (!state.openState || runGen !== state.battleRunGen) return;
  if (item.category === 'consumable') {
    await runUnitHealedEvents(ctx, runGen);
    if (!state.openState || runGen !== state.battleRunGen) return;
  }

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 200);
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await runEnemyPhase(ctx);
  }
}

export function openForecastFromCommandMenu(ctx: BattleControllerContext): void {
  const { state, dom, audioManager } = ctx;
  const unit = getSelectedUnit(state);
  if (!unit) return;
  const targets = getAttackableEnemiesFromCurrentTile(state, unit);
  if (targets.length === 0) return;

  audioManager.playSfx('select');
  state.forecastReturnMode = 'action_menu';
  dom.actionMenuEl.hidden = true;
  const first = targets[0]!;
  unit.direction = directionFromDelta(first.enemy.x - unit.x, first.enemy.y - unit.y);
  openCombatForecastModal(ctx, first.enemy.id, first.moves[0]!.id);
}

export function openHealForecastFromCommandMenu(ctx: BattleControllerContext): void {
  const { state, dom, audioManager } = ctx;
  const unit = getSelectedUnit(state);
  if (!unit) return;
  const healTargets = getHealableTargetsFromCurrentTile(state, unit);
  if (healTargets.length === 0) return;

  audioManager.playSfx('select');
  state.forecastReturnMode = 'action_menu';
  dom.actionMenuEl.hidden = true;
  const first = healTargets[0]!;
  if (first.ally.id !== unit.id) {
    unit.direction = directionFromDelta(first.ally.x - unit.x, first.ally.y - unit.y);
  }
  openHealForecastModal(ctx, first.ally.id, first.moves[0]!.id);
}

export async function confirmUnitWait(ctx: BattleControllerContext): Promise<void> {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  const unit = getSelectedUnit(state);
  if (!unit) return;
  const runGen = state.battleRunGen;

  unit.waited = true;
  unit.action = 'Idle';
  unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
  unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
  audioManager.playSfx('select');
  clearBattleSelection(state, dom, prepOverlay);
  await runTileReachedEvents(ctx, unit, runGen);
  if (!state.openState || runGen !== state.battleRunGen) return;
  if (checkAndTriggerMatchEnd(ctx)) return;
  recomputeDangerArea(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  tutorialOverlay?.notifyActionCompleted('battle_confirm_wait');
  ctx.renderNow();

  if (areAllLivingPlayersWaited(state)) {
    await waitBattleMs(state, 200);
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await runEnemyPhase(ctx);
  }
}
