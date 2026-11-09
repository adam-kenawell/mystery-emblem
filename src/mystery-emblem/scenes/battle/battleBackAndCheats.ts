/**
 * Unified Back / Right-Click / Long-Press Handler, DevTools Cheats & Playwright Test Mutators
 */

import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { isInMapBounds } from '../../engine/terrainAndPathfinding';
import {
  dismissBeginBattleCard,
  showPhaseBanner,
} from './battleBannersAndTransitions';
import {
  clearBattleSelection,
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
import { spawnFloatingText } from './battleFloatingCallouts';
import { cancelCombatForecast } from './battleHealForecastAndConfirm';
import { updateBattleInfoStrip } from './battleHudCards';
import { dismissLevelUpModal } from './battleLevelUpModal';
import { triggerVictoryModal } from './battleOutcomeModals';
import { confirmEnterDungeonFromPrep } from './battlePrepAndAssets';
import { cancelUncommittedMove } from './battleSelectionAndMenu';
import { dismissTalkChoiceModal } from './battleTalkChoiceModal';
import { getExpectedTutorialAction } from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getLivingEnemies,
  recomputeSelectedUnitRange,
} from './battleUnitQueries';

export function handleBattleMenuOrBack(
  ctx: BattleControllerContext,
  clientX?: number,
  clientY?: number
): void {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  if (!state.openState || state.cutsceneInProgress) return;

  if (!dom.beginBattleBackdropEl.hidden && !state.fastMode) {
    audioManager.playSfx('select');
    dismissBeginBattleCard(state, dom);
    return;
  }

  if (!dom.levelUpModalBackdropEl.hidden) {
    dismissLevelUpModal(ctx);
    return;
  }

  if (!dom.talkChoiceBackdropEl.hidden) {
    audioManager.playSfx('cancel');
    dismissTalkChoiceModal(state, dom, null);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    return;
  }

  const expectedTutorialAction = getExpectedTutorialAction(tutorialOverlay);
  if (expectedTutorialAction) {
    const allowPrepBack =
      state.phase === 'dungeon_prep' &&
      (expectedTutorialAction === 'prep_close_manage_units' ||
        expectedTutorialAction === 'prep_swap_or_finish_view_map');
    const allowDangerToggle =
      expectedTutorialAction === 'battle_toggle_danger_area' &&
      state.phase === 'player_phase' &&
      (state.interactionState === 'idle' || state.systemMenuOpen);
    if (!allowPrepBack && !allowDangerToggle) {
      tutorialOverlay?.nudgeActiveStep();
      return;
    }
  }

  if (
    expectedTutorialAction === 'battle_toggle_danger_area' &&
    state.phase === 'player_phase'
  ) {
    toggleGlobalDangerArea(ctx);
    if (state.systemMenuOpen) {
      closeSystemMenu(ctx);
    }
    tutorialOverlay?.notifyActionCompleted('battle_toggle_danger_area');
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

  toggleGlobalDangerArea(ctx);
}

export function forceUnitHpForTest(
  ctx: BattleControllerContext,
  unitId: string,
  nextHp: number
): void {
  const u = ctx.state.units.find((item) => item.id === unitId);
  if (!u) return;
  u.currentHp = Math.max(0, Math.min(u.maxHp, Math.round(nextHp)));
  if (u.currentHp <= 0) {
    u.defeated = true;
  } else {
    u.defeated = false;
    u.koDissolveProgress = 0;
  }
  recomputeDangerArea(ctx);
  updateBattleInfoStrip(ctx);
  ctx.renderNow();
}

export function forceUnitPositionForTest(
  ctx: BattleControllerContext,
  unitId: string,
  x: number,
  y: number
): void {
  const { state } = ctx;
  const u = state.units.find((item) => item.id === unitId);
  if (!u || !isInMapBounds(state.map, x, y)) return;
  u.x = x;
  u.y = y;
  u.renderWorldX = x * PMD_TILE_NATIVE_PX;
  u.renderWorldY = y * PMD_TILE_NATIVE_PX;
  recomputeDangerArea(ctx);
  if (state.selectedUnitId === unitId) {
    recomputeSelectedUnitRange(state);
  }
  updateBattleInfoStrip(ctx);
  ctx.renderNow();
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
    spawnFloatingText(state, dom, u.x, u.y, 'FULL HEAL!', '#68f8a8', 900);
  }
  audioManager.playSfx('heal');
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
