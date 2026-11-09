/**
 * Unified Pointer, Pinch-Zoom, Camera Drag, Hover & Long-Press Gestures on `BattleScene` Canvas Stage
 */

import {
  applyDungeonZoomWithWorldAnchor,
  clampDungeonCameraPosition,
  clientPointToDungeonTile,
  clientPointToDungeonWorld,
} from '../../ui/gridViewportMath';
import { computeWheelZoomScale } from '../../ui/mapZoomController';
import { handleBattleMenuOrBack } from './battleBackAndCheats';
import { canInteractWithBattleViewport } from './battleDangerAndViewportState';
import { positionFieldMenuCard } from './battleFieldMenuController';
import { updateHoveredTile } from './battleHoverPreview';
import { positionActiveUnitHoverPopup, updateBattleInfoStrip } from './battleHudCards';
import { positionFloatingActionMenu } from './battleSelectionAndMenu';
import { handleBattleTileTap } from './battleTileTapHandler';
import {
  BATTLE_DRAG_THRESHOLD_PX,
  BATTLE_LONG_PRESS_MS,
  type BattleControllerContext,
} from './battleTypesAndState';
import { getLivingUnits } from './battleUnitQueries';

export function applyBattleAnchoredZoom(
  ctx: BattleControllerContext,
  nextScale: number,
  clientX: number,
  clientY: number,
  anchorWorldX: number,
  anchorWorldY: number
): void {
  const { state, dom } = ctx;
  applyDungeonZoomWithWorldAnchor(
    dom.canvasStageEl,
    dom.canvas,
    dom.ctx,
    state.cam,
    state.map.width,
    state.map.height,
    nextScale,
    clientX,
    clientY,
    anchorWorldX,
    anchorWorldY
  );
  if (state.interactionState === 'action_menu') positionFloatingActionMenu(ctx);
  positionActiveUnitHoverPopup(ctx);
}

export function bindBattleCanvasStagePointers(
  ctx: BattleControllerContext
): ResizeObserver | null {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay, abortSignal: signal } = ctx;
  const canInteract = () => canInteractWithBattleViewport(state, dom, prepOverlay, tutorialOverlay);
  const toTile = (cx: number, cy: number) =>
    clientPointToDungeonTile(dom.canvas, state.cam, state.map.width, state.map.height, cx, cy);
  const toWorld = (cx: number, cy: number) =>
    clientPointToDungeonWorld(dom.canvas, state.cam, cx, cy);

  let activePointerId: number | null = null;
  let downClientX = 0;
  let downClientY = 0;
  let startCameraX = 0;
  let startCameraY = 0;
  let isDraggingCamera = false;
  let longPressTriggered = false;
  let longPressTimer: number | null = null;

  const clearLongPress = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  dom.canvasStageEl.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleBattleMenuOrBack(ctx, e.clientX, e.clientY);
    },
    { signal }
  );

  dom.canvasStageEl.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (!canInteract()) return;
      e.preventDefault();
      const nextScale = computeWheelZoomScale(state.cam.displayScale, e);
      if (nextScale === state.cam.displayScale) return;
      const anchor = toWorld(e.clientX, e.clientY);
      applyBattleAnchoredZoom(ctx, nextScale, e.clientX, e.clientY, anchor.worldX, anchor.worldY);
      updateHoveredTile(ctx, toTile(e.clientX, e.clientY));
      ctx.renderNow();
    },
    { passive: false, signal }
  );

  dom.canvasStageEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (!state.openState) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      try {
        dom.canvasStageEl.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic Playwright events may omit pointer capture
      }

      if (canInteract()) {
        const pinchDown = state.pinchTracker.onPointerDown(e, state.cam.displayScale, toWorld);
        if (pinchDown.isMultiTouch) {
          clearLongPress();
          activePointerId = null;
          isDraggingCamera = false;
          longPressTriggered = false;
          return;
        }
      }

      if (activePointerId !== null) return;

      activePointerId = e.pointerId;
      downClientX = e.clientX;
      downClientY = e.clientY;
      startCameraX = state.cam.cameraX;
      startCameraY = state.cam.cameraY;
      isDraggingCamera = false;
      longPressTriggered = false;
      clearLongPress();

      if (e.pointerType === 'mouse') {
        state.touchInspectedUnitId = null;
        updateHoveredTile(ctx, toTile(e.clientX, e.clientY));
      } else {
        state.hoveredTile = null;
        state.suppressedHoverEnemyId = null;
        longPressTimer = window.setTimeout(() => {
          if (
            isDraggingCamera ||
            activePointerId !== e.pointerId ||
            state.pinchTracker.isMultiTouchSession()
          ) {
            return;
          }
          longPressTriggered = true;
          const lpTile = toTile(downClientX, downClientY);
          const lpUnit = lpTile
            ? getLivingUnits(state).find((u) => u.x === lpTile.x && u.y === lpTile.y)
            : undefined;
          if (
            lpUnit &&
            lpTile &&
            canInteract() &&
            state.interactionState !== 'action_menu' &&
            state.interactionState !== 'combat_forecast'
          ) {
            state.inspectedTile = { x: lpTile.x, y: lpTile.y };
            state.touchInspectedUnitId = lpUnit.id;
            audioManager.playSfx('select');
            updateBattleInfoStrip(ctx);
            ctx.renderNow();
          } else {
            handleBattleMenuOrBack(ctx, downClientX, downClientY);
          }
        }, BATTLE_LONG_PRESS_MS);
      }
    },
    { signal }
  );

  dom.canvasStageEl.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!state.openState) return;

      if (canInteract()) {
        const handledPinch = state.pinchTracker.onPointerMove(
          e,
          () => state.cam.displayScale,
          toWorld,
          (p) =>
            applyBattleAnchoredZoom(
              ctx,
              p.nextScale,
              p.midClientX,
              p.midClientY,
              p.anchorWorldX,
              p.anchorWorldY
            )
        );
        if (handledPinch) {
          clearLongPress();
          ctx.renderNow();
          return;
        }
      }
      if (state.pinchTracker.isMultiTouchSession() && activePointerId !== e.pointerId) return;

      if (activePointerId === null && e.pointerType === 'mouse') {
        updateHoveredTile(ctx, toTile(e.clientX, e.clientY));
        return;
      }

      if (e.pointerId !== activePointerId) return;

      const dx = e.clientX - downClientX;
      const dy = e.clientY - downClientY;

      if (!isDraggingCamera && Math.hypot(dx, dy) > BATTLE_DRAG_THRESHOLD_PX) {
        isDraggingCamera = true;
        clearLongPress();
      }

      if (isDraggingCamera) {
        clampDungeonCameraPosition(
          state.cam,
          state.map.width,
          state.map.height,
          startCameraX - dx / state.cam.displayScale,
          startCameraY - dy / state.cam.displayScale
        );
        if (state.interactionState === 'action_menu') positionFloatingActionMenu(ctx);
        positionActiveUnitHoverPopup(ctx);
        ctx.renderNow();
      }
    },
    { signal }
  );

  dom.canvasStageEl.addEventListener(
    'pointerleave',
    (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && activePointerId === null) updateHoveredTile(ctx, null);
    },
    { signal }
  );

  const finishPointer = (e: PointerEvent, commitTap: boolean) => {
    try {
      if (dom.canvasStageEl.hasPointerCapture(e.pointerId)) {
        dom.canvasStageEl.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    const pinchUp = state.pinchTracker.onPointerUp(e);
    if (pinchUp.hadMultiTouch) {
      clearLongPress();
      longPressTriggered = false;
      if (pinchUp.remainingPointer) {
        activePointerId = pinchUp.remainingPointer.pointerId;
        downClientX = pinchUp.remainingPointer.clientX;
        downClientY = pinchUp.remainingPointer.clientY;
        startCameraX = state.cam.cameraX;
        startCameraY = state.cam.cameraY;
        isDraggingCamera = true;
      } else {
        activePointerId = null;
        isDraggingCamera = false;
      }
      return;
    }

    if (e.pointerId !== activePointerId) return;
    const wasDrag = isDraggingCamera;
    const wasLongPress = longPressTriggered;
    activePointerId = null;
    isDraggingCamera = false;
    longPressTriggered = false;
    clearLongPress();

    if (commitTap && !wasDrag && !wasLongPress) {
      const tile = toTile(e.clientX, e.clientY);
      if (tile) handleBattleTileTap(ctx, tile.x, tile.y, e.clientX, e.clientY);
    } else if (wasDrag && e.pointerType === 'mouse') {
      updateHoveredTile(ctx, toTile(e.clientX, e.clientY));
    }
  };

  dom.canvasStageEl.addEventListener('pointerup', (e) => finishPointer(e, true), { signal });
  dom.canvasStageEl.addEventListener('pointercancel', (e) => finishPointer(e, false), { signal });

  if (typeof ResizeObserver === 'undefined') return null;
  const resizeObserver = new ResizeObserver(() => {
    if (!state.openState) return;
    ctx.syncViewportDimensions();
    if (state.interactionState === 'action_menu') positionFloatingActionMenu(ctx);
    if (state.systemMenuOpen && state.systemMenuSubView === 'root') positionFieldMenuCard(ctx);
    positionActiveUnitHoverPopup(ctx);
    ctx.renderNow();
  });
  resizeObserver.observe(dom.canvasStageEl);
  return resizeObserver;
}
