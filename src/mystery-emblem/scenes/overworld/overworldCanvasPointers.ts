/**
 * Mystery Emblem — Unified Pointer, Wheel Zoom & Pinch Bindings for Overworld Canvas (`overworldCanvasPointers.ts`)
 *
 * Strictly obeys Rule 2 (Unified Pointer Events ONLY — zero keyboard listeners,
 * PC right-click + mobile long-press parity).
 */

import type { OverworldNodeDefinition } from '../../data/overworldMapData';
import {
  ensureOverworldGraphState,
  findOverworldRoute,
} from '../../engine/overworldEngine';
import {
  MultiTouchPinchTracker,
  OVERWORLD_SCALE_BOUNDS,
  computeWheelZoomScale,
} from '../../ui/mapZoomController';
import type { OverworldCameraAndPointersController, OverworldCameraControllerHooks } from './OverworldCameraAndPointers';

const DRAG_THRESHOLD_PX = 8;
const LONG_PRESS_MS = 520;

export interface OverworldPointerGestureState {
  pinchTracker: MultiTouchPinchTracker;
  activePointerId: number | null;
  pointerStartX: number;
  pointerStartY: number;
  pointerStartCamX: number;
  pointerStartCamY: number;
  isDraggingCamera: boolean;
  longPressFired: boolean;
  longPressTimer: number | null;
}

export function createOverworldGestureState(): OverworldPointerGestureState {
  return {
    pinchTracker: new MultiTouchPinchTracker(OVERWORLD_SCALE_BOUNDS),
    activePointerId: null,
    pointerStartX: 0,
    pointerStartY: 0,
    pointerStartCamX: 0,
    pointerStartCamY: 0,
    isDraggingCamera: false,
    longPressFired: false,
    longPressTimer: null,
  };
}

export function clearOverworldLongPressTimer(gs: OverworldPointerGestureState): void {
  if (gs.longPressTimer !== null) {
    window.clearTimeout(gs.longPressTimer);
    gs.longPressTimer = null;
  }
}

function hitTestNodeAtLocalCss(
  ctrl: OverworldCameraAndPointersController,
  hooks: OverworldCameraControllerHooks,
  localCssX: number,
  localCssY: number
): OverworldNodeDefinition | null {
  const hitRadiusCss = Math.max(26, 9 * ctrl.displayScale);
  let best: OverworldNodeDefinition | null = null;
  let bestDist = hitRadiusCss;
  for (const def of hooks.getGraph().nodes) {
    const nodeCssX = (def.x - ctrl.cameraX) * ctrl.displayScale;
    const nodeCssY = (def.y - ctrl.cameraY) * ctrl.displayScale;
    const d = Math.hypot(localCssX - nodeCssX, localCssY - nodeCssY);
    if (d <= bestDist) {
      bestDist = d;
      best = def;
    }
  }
  return best;
}

export function bindOverworldCanvasPointers(
  ctrl: OverworldCameraAndPointersController,
  hooks: OverworldCameraControllerHooks,
  gs: OverworldPointerGestureState,
  signal: AbortSignal
): void {
  const { rootEl, canvas } = hooks;

  rootEl.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (hooks.isOpen()) hooks.onMenuOrBack();
    },
    { signal }
  );

  canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (!hooks.canInteractWithCanvas()) return;
      e.preventDefault();
      const nextScale = computeWheelZoomScale(ctrl.displayScale, e, OVERWORLD_SCALE_BOUNDS);
      if (nextScale === ctrl.displayScale) return;
      const anchor = ctrl.clientPointToWorld(e.clientX, e.clientY);
      ctrl.applyZoomWithWorldAnchor(nextScale, e.clientX, e.clientY, anchor.worldX, anchor.worldY);
      hooks.onRenderFrame();
    },
    { passive: false, signal }
  );

  canvas.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (!hooks.canInteractWithCanvas()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // synthetic events
      }

      const pinchDown = gs.pinchTracker.onPointerDown(e, ctrl.displayScale, (cx, cy) =>
        ctrl.clientPointToWorld(cx, cy)
      );
      if (pinchDown.isMultiTouch) {
        clearOverworldLongPressTimer(gs);
        gs.activePointerId = null;
        gs.isDraggingCamera = false;
        gs.longPressFired = false;
        return;
      }

      gs.activePointerId = e.pointerId;
      gs.pointerStartX = e.clientX;
      gs.pointerStartY = e.clientY;
      gs.pointerStartCamX = ctrl.cameraX;
      gs.pointerStartCamY = ctrl.cameraY;
      gs.isDraggingCamera = false;
      gs.longPressFired = false;
      clearOverworldLongPressTimer(gs);

      if (e.pointerType !== 'mouse') {
        gs.longPressTimer = window.setTimeout(() => {
          gs.longPressTimer = null;
          if (
            gs.activePointerId === e.pointerId &&
            !gs.isDraggingCamera &&
            !gs.pinchTracker.isMultiTouchSession()
          ) {
            gs.longPressFired = true;
            hooks.onMenuOrBack();
          }
        }, LONG_PRESS_MS);
      }
    },
    { signal }
  );

  canvas.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!hooks.canInteractWithCanvas()) return;

      const handledPinch = gs.pinchTracker.onPointerMove(
        e,
        () => ctrl.displayScale,
        (cx, cy) => ctrl.clientPointToWorld(cx, cy),
        ({ nextScale, midClientX, midClientY, anchorWorldX, anchorWorldY }) => {
          ctrl.applyZoomWithWorldAnchor(nextScale, midClientX, midClientY, anchorWorldX, anchorWorldY);
        }
      );
      if (handledPinch) {
        clearOverworldLongPressTimer(gs);
        hooks.onRenderFrame();
        return;
      }
      if (gs.pinchTracker.isMultiTouchSession() && gs.activePointerId !== e.pointerId) return;

      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (gs.activePointerId === e.pointerId) {
        const dx = e.clientX - gs.pointerStartX;
        const dy = e.clientY - gs.pointerStartY;
        if (!gs.isDraggingCamera && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          gs.isDraggingCamera = true;
          clearOverworldLongPressTimer(gs);
        }
        if (gs.isDraggingCamera) {
          ctrl.cameraX = gs.pointerStartCamX - dx / ctrl.displayScale;
          ctrl.cameraY = gs.pointerStartCamY - dy / ctrl.displayScale;
          ctrl.clampCamera();
          hooks.onRenderFrame();
        }
        return;
      }

      if (e.pointerType === 'mouse' && !hooks.isTraveling()) {
        const hovered = hitTestNodeAtLocalCss(ctrl, hooks, localX, localY);
        const nextHoverId = hovered?.id ?? null;
        if (nextHoverId !== ctrl.hoveredNodeId) {
          ctrl.hoveredNodeId = nextHoverId;
          const save = hooks.saveManager.getSave();
          const graph = hooks.getGraph();
          if (save && nextHoverId) {
            const reconciled = ensureOverworldGraphState(save, graph);
            ctrl.hoverRoutePreview =
              nextHoverId !== reconciled.currentNodeId && reconciled.nodes[nextHoverId]?.unlocked
                ? findOverworldRoute(graph, reconciled.nodes, reconciled.currentNodeId, nextHoverId)
                : null;
          } else {
            ctrl.hoverRoutePreview = null;
          }
          hooks.onRenderFrame();
        }
      }
    },
    { signal }
  );

  const finishPointer = (e: PointerEvent, cancelled: boolean) => {
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const pinchUp = gs.pinchTracker.onPointerUp(e);
    if (pinchUp.hadMultiTouch) {
      clearOverworldLongPressTimer(gs);
      gs.longPressFired = false;
      if (pinchUp.remainingPointer) {
        gs.activePointerId = pinchUp.remainingPointer.pointerId;
        gs.pointerStartX = pinchUp.remainingPointer.clientX;
        gs.pointerStartY = pinchUp.remainingPointer.clientY;
        gs.pointerStartCamX = ctrl.cameraX;
        gs.pointerStartCamY = ctrl.cameraY;
        gs.isDraggingCamera = true;
      } else {
        gs.activePointerId = null;
        gs.isDraggingCamera = false;
      }
      return;
    }

    if (gs.activePointerId !== e.pointerId) return;
    clearOverworldLongPressTimer(gs);
    const wasDrag = gs.isDraggingCamera;
    const wasLongPress = gs.longPressFired;
    gs.activePointerId = null;
    gs.isDraggingCamera = false;
    gs.longPressFired = false;

    if (cancelled || wasDrag || wasLongPress || !hooks.isOpen() || hooks.isModalOpen()) return;
    const rect = canvas.getBoundingClientRect();
    const tappedNode = hitTestNodeAtLocalCss(ctrl, hooks, e.clientX - rect.left, e.clientY - rect.top);
    if (tappedNode) hooks.onNodeTapped(tappedNode);
  };

  canvas.addEventListener('pointerup', (e) => finishPointer(e, false), { signal });
  canvas.addEventListener('pointercancel', (e) => finishPointer(e, true), { signal });
}
