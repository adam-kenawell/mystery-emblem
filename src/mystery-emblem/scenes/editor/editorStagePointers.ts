/**
 * Unified Pointer & Pinch-Zoom Gesture Controller for `ChapterMapEditorScene` Canvas Stage
 */

import {
  applyDungeonZoomWithWorldAnchor,
  clampDungeonCameraPosition,
  clientPointToDungeonTile,
  clientPointToDungeonWorld,
} from '../../ui/gridViewportMath';
import { computeWheelZoomScale } from '../../ui/mapZoomController';
import type { EditorDomRefs } from './editorDomShell';
import {
  EDITOR_DRAG_THRESHOLD_PX,
  type EditorRuntimeState,
} from './editorTypesAndState';

export interface EditorStagePointerHooks {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  signal: AbortSignal;
  syncViewportDimensions: () => void;
  applyStrokeAtTile: (tx: number, ty: number) => void;
  handleTileTap: (tx: number, ty: number) => void;
  renderFrame: () => void;
}

export function bindEditorCanvasStagePointers(
  hooks: EditorStagePointerHooks
): ResizeObserver | null {
  const { dom, state, signal } = hooks;
  const canInteract = () =>
    state.openState && !state.systemMenuOpen && !state.jsonModalOpen;

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!state.openState) return;
      hooks.syncViewportDimensions();
      hooks.renderFrame();
    });
    resizeObserver.observe(dom.canvasStageEl);
  }

  dom.canvasStageEl.addEventListener(
    'wheel',
    (ev: WheelEvent) => {
      if (!canInteract()) return;
      ev.preventDefault();
      const nextScale = computeWheelZoomScale(state.cam.displayScale, ev);
      if (nextScale === state.cam.displayScale) return;
      const anchor = clientPointToDungeonWorld(
        dom.canvas,
        state.cam,
        ev.clientX,
        ev.clientY
      );
      applyDungeonZoomWithWorldAnchor(
        dom.canvasStageEl,
        dom.canvas,
        dom.ctx,
        state.cam,
        state.map.width,
        state.map.height,
        nextScale,
        ev.clientX,
        ev.clientY,
        anchor.worldX,
        anchor.worldY
      );
      hooks.renderFrame();
    },
    { passive: false, signal }
  );

  dom.canvasStageEl.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (!canInteract()) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;

      try {
        dom.canvasStageEl.setPointerCapture(ev.pointerId);
      } catch {
        // Synthetic pointer events in tests may omit capture support
      }

      const pinchDown = state.pinchTracker.onPointerDown(
        ev,
        state.cam.displayScale,
        (cx, cy) => clientPointToDungeonWorld(dom.canvas, state.cam, cx, cy)
      );
      if (pinchDown.isMultiTouch) {
        state.activePointerId = null;
        state.pointerMoved = false;
        state.strokeUndoPushed = false;
        state.lastStrokedCoordKey = null;
        return;
      }

      state.activePointerId = ev.pointerId;
      state.pointerStartX = ev.clientX;
      state.pointerStartY = ev.clientY;
      state.pointerStartCamX = state.cam.cameraX;
      state.pointerStartCamY = state.cam.cameraY;
      state.pointerMoved = false;
      state.strokeUndoPushed = false;
      state.lastStrokedCoordKey = null;

      if (state.toolMode === 'stroke') {
        const tile = clientPointToDungeonTile(
          dom.canvas,
          state.cam,
          state.map.width,
          state.map.height,
          ev.clientX,
          ev.clientY
        );
        if (tile) {
          hooks.applyStrokeAtTile(tile.x, tile.y);
        }
      }
    },
    { signal }
  );

  dom.canvasStageEl.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (!canInteract()) return;

      const handledPinch = state.pinchTracker.onPointerMove(
        ev,
        () => state.cam.displayScale,
        (cx, cy) => clientPointToDungeonWorld(dom.canvas, state.cam, cx, cy),
        ({ nextScale, midClientX, midClientY, anchorWorldX, anchorWorldY }) => {
          applyDungeonZoomWithWorldAnchor(
            dom.canvasStageEl,
            dom.canvas,
            dom.ctx,
            state.cam,
            state.map.width,
            state.map.height,
            nextScale,
            midClientX,
            midClientY,
            anchorWorldX,
            anchorWorldY
          );
        }
      );
      if (handledPinch) {
        hooks.renderFrame();
        return;
      }
      if (state.pinchTracker.isMultiTouchSession() && state.activePointerId !== ev.pointerId) {
        return;
      }

      if (state.activePointerId === null && ev.pointerType === 'mouse') {
        const hover = clientPointToDungeonTile(
          dom.canvas,
          state.cam,
          state.map.width,
          state.map.height,
          ev.clientX,
          ev.clientY
        );
        if (
          hover?.x !== state.hoveredTile?.x ||
          hover?.y !== state.hoveredTile?.y
        ) {
          state.hoveredTile = hover;
          hooks.renderFrame();
        }
        return;
      }

      if (ev.pointerId !== state.activePointerId) return;

      if (state.toolMode === 'stroke') {
        const tile = clientPointToDungeonTile(
          dom.canvas,
          state.cam,
          state.map.width,
          state.map.height,
          ev.clientX,
          ev.clientY
        );
        if (tile) {
          state.hoveredTile = tile;
          hooks.applyStrokeAtTile(tile.x, tile.y);
        }
        return;
      }

      const dx = ev.clientX - state.pointerStartX;
      const dy = ev.clientY - state.pointerStartY;
      if (!state.pointerMoved && Math.hypot(dx, dy) > EDITOR_DRAG_THRESHOLD_PX) {
        state.pointerMoved = true;
      }
      if (state.pointerMoved) {
        clampDungeonCameraPosition(
          state.cam,
          state.map.width,
          state.map.height,
          state.pointerStartCamX - dx / state.cam.displayScale,
          state.pointerStartCamY - dy / state.cam.displayScale
        );
        hooks.renderFrame();
      }
    },
    { signal }
  );

  const finishPointer = (ev: PointerEvent, cancelled: boolean) => {
    try {
      if (dom.canvasStageEl.hasPointerCapture(ev.pointerId)) {
        dom.canvasStageEl.releasePointerCapture(ev.pointerId);
      }
    } catch {
      // Ignore
    }

    const pinchUp = state.pinchTracker.onPointerUp(ev);
    if (pinchUp.hadMultiTouch) {
      state.strokeUndoPushed = false;
      state.lastStrokedCoordKey = null;
      if (pinchUp.remainingPointer && state.toolMode !== 'stroke') {
        state.activePointerId = pinchUp.remainingPointer.pointerId;
        state.pointerStartX = pinchUp.remainingPointer.clientX;
        state.pointerStartY = pinchUp.remainingPointer.clientY;
        state.pointerStartCamX = state.cam.cameraX;
        state.pointerStartCamY = state.cam.cameraY;
        state.pointerMoved = true;
      } else {
        state.activePointerId = null;
        state.pointerMoved = false;
      }
      return;
    }

    if (ev.pointerId !== state.activePointerId) return;
    const wasDrag = state.pointerMoved;
    const usedStroke = state.toolMode === 'stroke';
    state.activePointerId = null;
    state.pointerMoved = false;
    state.strokeUndoPushed = false;
    state.lastStrokedCoordKey = null;

    if (cancelled || wasDrag || usedStroke) return;
    const tile = clientPointToDungeonTile(
      dom.canvas,
      state.cam,
      state.map.width,
      state.map.height,
      ev.clientX,
      ev.clientY
    );
    if (tile) {
      hooks.handleTileTap(tile.x, tile.y);
    }
  };

  dom.canvasStageEl.addEventListener(
    'pointerup',
    (ev: PointerEvent) => finishPointer(ev, false),
    { signal }
  );
  dom.canvasStageEl.addEventListener(
    'pointercancel',
    (ev: PointerEvent) => finishPointer(ev, true),
    { signal }
  );

  return resizeObserver;
}
