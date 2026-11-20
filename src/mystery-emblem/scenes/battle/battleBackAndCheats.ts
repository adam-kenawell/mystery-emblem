/**
 * Unified Back / Right-Click / Long-Press Handler & DevTools Cheats
 */

import {
  dismissBeginBattleCard,
  isPhaseTransitionPlaying,
  showPhaseBanner,
} from './battleBannersAndTransitions';
import {
  clearBattleSelection,
  clearInspectedAllyRange,
  recomputeDangerArea,
  syncHudControls,
  syncPrepChromeVisibility,
  toggleGlobalDangerArea,
} from './battleDangerAndViewportState';
import {
  closeSystemMenu,
  openSystemMenu,
  setSystemMenuSubView,
} from './battleFieldMenuController';
import { logSquadFullHeal } from './battleActionLog';
import { cancelCombatForecast } from './battleHealForecastAndConfirm';
import { updateBattleInfoStrip } from './battleHudCards';
import { dismissLevelUpModal, dismissMoveLearnedModal } from './battleLevelUpModal';
import { triggerVictoryModal } from './battleOutcomeModals';
import { confirmEnterDungeonFromPrep } from './battlePrepController';
import { cancelUncommittedMove } from './battleSelectionAndMenu';
import { dismissTalkChoiceModal } from './battleTalkChoiceModal';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getActiveInspectedAllyRange,
  getLivingEnemies,
} from './battleUnitQueries';

export function handleBattleMenuOrBack(
  ctx: BattleControllerContext,
  clientX?: number,
  clientY?: number
): void {
  const { state, dom, prepOverlay, audioManager } = ctx;
  if (!state.openState || state.cutsceneInProgress || isPhaseTransitionPlaying(state)) return;

  if (!dom.beginBattleBackdropEl.hidden) {
    audioManager.playSfx('select');
    dismissBeginBattleCard(state, dom);
    return;
  }

  if (!dom.levelUpModalBackdropEl.hidden) {
    dismissLevelUpModal(ctx);
    return;
  }

  if (!dom.moveLearnedModalBackdropEl.hidden) {
    dismissMoveLearnedModal(ctx);
    return;
  }

  if (!dom.talkChoiceBackdropEl.hidden) {
    audioManager.playSfx('cancel');
    dismissTalkChoiceModal(state, dom, null);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  if (state.systemMenuOpen) {
    audioManager.playSfx('cancel');
    if (state.systemMenuSubView !== 'root') {
      setSystemMenuSubView(ctx, 'root');
    } else {
      closeSystemMenu(ctx);
    }
    return;
  }

  if (state.phase === 'victory' || state.phase === 'defeat') {
    return;
  }

  if (state.phase === 'dungeon_prep') {
    if (state.prepSwapSlotIndex !== null) {
      state.prepSwapSlotIndex = null;
      state.prepMapStatusNotice = null;
      audioManager.playSfx('cancel');
      prepOverlay.syncMapHudState();
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }
    if (getActiveInspectedAllyRange(state) !== null && clearInspectedAllyRange(state)) {
      audioManager.playSfx('cancel');
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }
    if (prepOverlay.handleBack()) {
      syncPrepChromeVisibility(state, dom, prepOverlay);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }
    openSystemMenu(ctx, 'root', clientX, clientY);
    return;
  }

  if (
    state.phase === 'ally_phase' ||
    state.phase === 'enemy_phase' ||
    state.interactionState === 'walking' ||
    state.interactionState === 'combat_animating' ||
    state.interactionState === 'enemy_acting'
  ) {
    return;
  }

  if (state.interactionState === 'combat_forecast') {
    cancelCombatForecast(ctx);
    return;
  }

  if (state.interactionState === 'action_menu') {
    cancelUncommittedMove(ctx);
    return;
  }

  if (state.interactionState === 'unit_selected') {
    audioManager.playSfx('cancel');
    clearBattleSelection(state, dom, prepOverlay);
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  if (getActiveInspectedAllyRange(state) !== null && clearInspectedAllyRange(state)) {
    audioManager.playSfx('cancel');
    updateBattleInfoStrip(ctx);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  toggleGlobalDangerArea(ctx);
}

export function cheatFullHealSquad(ctx: BattleControllerContext): void {
  const { state, dom, audioManager } = ctx;
  if (!state.openState) return;
  for (const u of state.units) {
    if (u.faction !== 'player' || u.defeated) continue;
    u.currentHp = u.maxHp;
    u.status = null;
    u.statusTurns = 0;
    u.waited = false;
    for (const slot of u.activeMoves) {
      slot.ppRemaining = slot.maxPp;
    }
  }
  audioManager.playSfx('heal');
  logSquadFullHeal(state, dom);
  showPhaseBanner(state, dom, 'SQUAD FULLY RESTORED!');
  recomputeDangerArea(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.renderNow();
}

export function cheatInstantWin(ctx: BattleControllerContext): void {
  const { state } = ctx;
  if (!state.openState) return;
  if (state.phase === 'dungeon_prep') {
    confirmEnterDungeonFromPrep(ctx);
  }
  if (state.phase !== 'player_phase' && state.phase !== 'enemy_phase') {
    return;
  }
  state.battleRunGen += 1;
  state.activeWalk = null;
  state.activeStrikeVfx = null;
  for (const enemy of getLivingEnemies(state)) {
    if (enemy.droppableItemId) {
      state.collectedDrops.push(enemy.droppableItemId);
      enemy.droppableItemId = null;
    }
    enemy.currentHp = 0;
    enemy.defeated = true;
    state.trackedEnemyIds.delete(enemy.id);
  }
  recomputeDangerArea(ctx);
  triggerVictoryModal(ctx);
}
