/**
 * Viewport Interactivity Gates, Selection Reset & Enemy Danger Area State
 */

import { computeEnemyDangerArea } from '../../engine/terrainAndPathfinding';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import type { BattleDomRefs } from './battleDomShell';
import { getBattleSaveBlockReason } from './battleSuspend';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getLivingEnemies, getLivingUnits } from './battleUnitQueries';

export function canInteractWithBattleViewport(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay,
  tutorialOverlay?: TutorialOverlay
): boolean {
  if (
    !state.openState ||
    state.cutsceneInProgress ||
    state.systemMenuOpen ||
    !dom.levelUpModalBackdropEl.hidden ||
    !dom.talkChoiceBackdropEl.hidden ||
    Boolean(tutorialOverlay?.isBlockingSceneInput())
  ) {
    return false;
  }
  if (state.phase === 'dungeon_prep') {
    return prepOverlay.isOpen() && prepOverlay.getSubMode() === 'view_map';
  }
  return (
    (state.phase === 'player_phase' ||
      state.phase === 'ally_phase' ||
      state.phase === 'enemy_phase') &&
    state.interactionState !== 'combat_forecast'
  );
}

export function syncPrepChromeVisibility(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay
): void {
  if (state.phase === 'dungeon_prep') {
    const inViewMap = prepOverlay.isOpen() && prepOverlay.getSubMode() === 'view_map';
    dom.infoStripEl.hidden = !inViewMap;
    if (!inViewMap) {
      dom.unitPopupEl.hidden = true;
    }
  } else if (state.phase === 'victory' || state.phase === 'defeat') {
    dom.infoStripEl.hidden = true;
    dom.unitPopupEl.hidden = true;
  } else {
    const hideHudCards = state.interactionState === 'combat_forecast';
    dom.infoStripEl.hidden = hideHudCards;
    if (hideHudCards) {
      dom.unitPopupEl.hidden = true;
    }
  }
}

export function syncHudControls(state: BattleRuntimeState, dom: BattleDomRefs): void {
  const canEndPhase =
    state.phase === 'player_phase' &&
    (state.interactionState === 'idle' || state.interactionState === 'unit_selected');
  dom.fieldEndPhaseBtnEl.disabled = !canEndPhase;
  dom.fieldSaveBtnEl.hidden = !state.suspendSource;
  const saveBlock = getBattleSaveBlockReason(state);
  dom.fieldSaveBtnEl.disabled = saveBlock !== null;
  dom.fieldSaveBtnEl.title = saveBlock ?? '';
}

export function clearBattleSelection(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay
): void {
  state.selectedUnitId = null;
  state.touchInspectedUnitId = null;
  state.uncommittedOrigin = null;
  state.originRangeSnapshot = null;
  state.currentRange = null;
  state.previewPath = null;
  state.forecastMode = 'attack';
  state.forecastTargetId = null;
  state.forecastMoveId = null;
  state.currentForecast = null;
  state.currentHealForecast = null;
  dom.actionMenuEl.hidden = true;
  dom.forecastModalBackdropEl.hidden = true;
  if (state.phase === 'player_phase') {
    state.interactionState = 'idle';
  }
  syncPrepChromeVisibility(state, dom, prepOverlay);
}

export function getHoveredEnemyDangerId(ctx: BattleControllerContext): string | null {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
  if (
    !canInteractWithBattleViewport(state, dom, prepOverlay, tutorialOverlay) ||
    state.hoveredTile === null
  ) {
    return null;
  }
  const inViewMap =
    state.phase === 'dungeon_prep' &&
    prepOverlay.isOpen() &&
    prepOverlay.getSubMode() === 'view_map';
  if (state.phase !== 'player_phase' && !inViewMap) {
    return null;
  }
  if (state.interactionState !== 'idle' && state.interactionState !== 'unit_selected') {
    return null;
  }
  const { x, y } = state.hoveredTile;
  const hoveredEnemy = getLivingEnemies(state).find((e) => e.x === x && e.y === y);
  if (!hoveredEnemy || hoveredEnemy.id === state.suppressedHoverEnemyId) {
    return null;
  }
  return hoveredEnemy.id;
}

export function recomputeDangerArea(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay } = ctx;
  const hoveredEnemyId = getHoveredEnemyDangerId(ctx);
  let effectiveTracked: Set<string> = state.trackedEnemyIds;
  if (hoveredEnemyId && !state.trackedEnemyIds.has(hoveredEnemyId)) {
    effectiveTracked = new Set(state.trackedEnemyIds);
    effectiveTracked.add(hoveredEnemyId);
  }
  state.lastComputedHoverEnemyId = hoveredEnemyId;
  state.currentDanger = computeEnemyDangerArea(state.map, getLivingUnits(state), {
    globalEnabled: state.globalDangerEnabled,
    trackedEnemyIds: effectiveTracked,
  });
  dom.fieldDangerBtnEl.textContent = state.globalDangerEnabled
    ? 'Danger Area: ON'
    : 'Danger Area: OFF';
  dom.fieldDangerBtnEl.classList.toggle('is-active', state.globalDangerEnabled);
  prepOverlay.syncMapHudState();
}

export function syncHoverDangerArea(ctx: BattleControllerContext): boolean {
  const { state } = ctx;
  const nextHoverEnemyId = getHoveredEnemyDangerId(ctx);
  if (nextHoverEnemyId === state.lastComputedHoverEnemyId) {
    return false;
  }
  if (
    nextHoverEnemyId !== null &&
    !state.selectedUnitId &&
    !state.globalDangerEnabled &&
    state.trackedEnemyIds.size === 0
  ) {
    state.selectionPulseStartMs = performance.now();
  }
  recomputeDangerArea(ctx);
  return true;
}

export function toggleGlobalDangerArea(ctx: BattleControllerContext): void {
  const { state, audioManager } = ctx;
  state.globalDangerEnabled = !state.globalDangerEnabled;
  if (state.globalDangerEnabled && !state.selectedUnitId) {
    state.selectionPulseStartMs = performance.now();
  }
  audioManager.playSfx('select');
  recomputeDangerArea(ctx);
  ctx.renderNow();
}

export function toggleIndividualEnemyDanger(
  ctx: BattleControllerContext,
  enemyId: string
): void {
  const { state } = ctx;
  if (state.trackedEnemyIds.has(enemyId)) {
    state.trackedEnemyIds.delete(enemyId);
    state.suppressedHoverEnemyId = enemyId;
  } else {
    state.trackedEnemyIds.add(enemyId);
    if (state.suppressedHoverEnemyId === enemyId) {
      state.suppressedHoverEnemyId = null;
    }
    if (!state.selectedUnitId) {
      state.selectionPulseStartMs = performance.now();
    }
  }
  recomputeDangerArea(ctx);
}
