/**
 * Viewport Interactivity Gates, Selection Reset & Enemy Danger Area State
 */

import {
  computeEnemyDangerArea,
  computeUnitMovementAndAttackRange,
} from '../../engine/terrainAndPathfinding';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import {
  isDefaultMapScale,
  resolveInitialDungeonScale,
} from '../../ui/mapZoomController';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import type { BattleDomRefs } from './battleDomShell';
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
    !dom.moveLearnedModalBackdropEl.hidden ||
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

export function syncBattleZoomResetButton(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay
): void {
  const rect = dom.canvasStageEl.getBoundingClientRect();
  const defaultScale = resolveInitialDungeonScale(
    rect.width || window.innerWidth,
    rect.height || window.innerHeight
  );
  const canShowInPhase =
    state.phase === 'dungeon_prep'
      ? prepOverlay.isOpen() && prepOverlay.getSubMode() === 'view_map'
      : state.phase !== 'victory' && state.phase !== 'defeat';
  const show =
    state.openState &&
    canShowInPhase &&
    !state.cutsceneInProgress &&
    state.interactionState !== 'combat_forecast' &&
    !isDefaultMapScale(state.cam.displayScale, defaultScale);
  dom.zoomResetBtnEl.hidden = !show;
}

export function syncPrepChromeVisibility(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay
): void {
  if (state.phase === 'dungeon_prep') {
    const inViewMap = prepOverlay.isOpen() && prepOverlay.getSubMode() === 'view_map';
    dom.infoStripEl.hidden = !inViewMap;
    dom.battleLogDockEl.hidden = true;
    if (!inViewMap) {
      dom.unitPopupEl.hidden = true;
    }
  } else if (state.phase === 'victory' || state.phase === 'defeat') {
    dom.infoStripEl.hidden = true;
    dom.battleLogDockEl.hidden = true;
    dom.unitPopupEl.hidden = true;
  } else {
    const hideHudCards = state.interactionState === 'combat_forecast';
    dom.infoStripEl.hidden = hideHudCards;
    dom.battleLogDockEl.hidden = hideHudCards;
    if (hideHudCards) {
      dom.unitPopupEl.hidden = true;
    }
  }
  syncBattleZoomResetButton(state, dom, prepOverlay);
}

export function syncHudControls(state: BattleRuntimeState, dom: BattleDomRefs): void {
  const canEndPhase =
    state.phase === 'player_phase' &&
    (state.interactionState === 'idle' || state.interactionState === 'unit_selected');
  dom.fieldEndPhaseBtnEl.disabled = !canEndPhase;
}

export function clearInspectedAllyRange(state: BattleRuntimeState): boolean {
  const hadRange =
    state.inspectedAllyRangeUnitId !== null ||
    state.inspectedAllyRange !== null ||
    state.hoveredPlayerRangeUnitId !== null ||
    state.hoveredPlayerRange !== null;
  state.inspectedAllyRangeUnitId = null;
  state.inspectedAllyRange = null;
  state.hoveredPlayerRangeUnitId = null;
  state.hoveredPlayerRange = null;
  return hadRange;
}

export function toggleInspectedAllyRange(ctx: BattleControllerContext, unitId: string): void {
  const { state, audioManager } = ctx;
  if (state.inspectedAllyRangeUnitId === unitId) {
    clearInspectedAllyRange(state);
    audioManager.playSfx('cancel');
    return;
  }
  const living = getLivingUnits(state);
  const unit = living.find(
    (u) => u.id === unitId && (u.faction === 'npc' || (u.faction === 'player' && u.waited))
  );
  if (!unit) {
    clearInspectedAllyRange(state);
    return;
  }
  state.inspectedAllyRangeUnitId = unit.id;
  state.inspectedAllyRange = computeUnitMovementAndAttackRange(state.map, unit, living);
  state.selectionPulseStartMs = performance.now();
  audioManager.playSfx('select');
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
  clearInspectedAllyRange(state);
  state.hoveredPlayerRangeUnitId = null;
  state.hoveredPlayerRange = null;
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

export function syncHoverPlayerRange(ctx: BattleControllerContext): boolean {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
  const canInteract = canInteractWithBattleViewport(state, dom, prepOverlay, tutorialOverlay);
  const inValidPhase =
    state.phase === 'player_phase' ||
    (state.phase === 'dungeon_prep' &&
      prepOverlay.isOpen() &&
      prepOverlay.getSubMode() === 'view_map' &&
      state.prepSwapSlotIndex === null);

  if (!canInteract || state.interactionState !== 'idle' || !inValidPhase || !state.hoveredTile) {
    if (state.hoveredPlayerRangeUnitId !== null || state.hoveredPlayerRange !== null) {
      state.hoveredPlayerRangeUnitId = null;
      state.hoveredPlayerRange = null;
      return true;
    }
    return false;
  }

  const { x, y } = state.hoveredTile;
  const living = getLivingUnits(state);
  const occupant = living.find(
    (u) => u.x === x && u.y === y && u.faction === 'player' && !u.waited
  );

  if (!occupant) {
    if (state.hoveredPlayerRangeUnitId !== null || state.hoveredPlayerRange !== null) {
      state.hoveredPlayerRangeUnitId = null;
      state.hoveredPlayerRange = null;
      return true;
    }
    return false;
  }

  if (state.hoveredPlayerRangeUnitId === occupant.id) {
    return false;
  }

  state.hoveredPlayerRangeUnitId = occupant.id;
  state.hoveredPlayerRange = computeUnitMovementAndAttackRange(state.map, occupant, living);
  if (
    !state.selectedUnitId &&
    !state.inspectedAllyRangeUnitId &&
    !state.globalDangerEnabled &&
    state.trackedEnemyIds.size === 0 &&
    !state.lastComputedHoverEnemyId
  ) {
    state.selectionPulseStartMs = performance.now();
  }
  return true;
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

export function recomputeDangerArea(ctx: BattleControllerContext, invalidateCache = true): void {
  const { state, prepOverlay } = ctx;
  if (invalidateCache) {
    state.dangerRangeCache.clear();
  }
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
    precomputedEnemyRanges: state.dangerRangeCache,
  });
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
    !state.inspectedAllyRangeUnitId &&
    !state.globalDangerEnabled &&
    state.trackedEnemyIds.size === 0
  ) {
    state.selectionPulseStartMs = performance.now();
  }
  recomputeDangerArea(ctx, false);
  return true;
}

export function toggleGlobalDangerArea(ctx: BattleControllerContext): void {
  const { state, audioManager } = ctx;
  state.globalDangerEnabled = !state.globalDangerEnabled;
  if (state.globalDangerEnabled && !state.selectedUnitId && !state.inspectedAllyRangeUnitId) {
    state.selectionPulseStartMs = performance.now();
  }
  audioManager.playSfx('select');
  recomputeDangerArea(ctx, false);
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
    if (!state.selectedUnitId && !state.inspectedAllyRangeUnitId) {
      state.selectionPulseStartMs = performance.now();
    }
  }
  recomputeDangerArea(ctx, false);
}
