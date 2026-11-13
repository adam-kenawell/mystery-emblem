/**
 * Shared Map Camera Bounds, Scale Clamping & Desktop Wheel/Trackpad Zoom (`mapZoomController.ts`)
 *
 * Strictly obeys:
 * - Rule 2: Unified Pointer Events (`pinchZoomTracker.ts`) + Desktop `wheel` parity; ZERO keyboard bindings.
 * - Rule 3: Preserves crisp pixel-art scaling (`2.0x` Dungeon `[1.5x, 2.5x]`, `2.75x` Overworld `[2.25x, 3.25x]`).
 */

export {
  MultiTouchPinchTracker,
  type PinchDownOutcome,
  type PinchUpOutcome,
  type WorldPoint,
} from './pinchZoomTracker';

export const MAP_DEFAULT_SCALE = 2.0;
export const MAP_MOBILE_DEFAULT_SCALE = 1.35;
export const MAP_MIN_SCALE = 1.15;
export const MAP_MAX_SCALE = 2.5;

export interface MapScaleBounds {
  defaultScale: number;
  minScale: number;
  maxScale: number;
}

export const DUNGEON_SCALE_BOUNDS: MapScaleBounds = {
  defaultScale: MAP_DEFAULT_SCALE,
  minScale: MAP_MIN_SCALE,
  maxScale: MAP_MAX_SCALE,
};

export const OVERWORLD_MOBILE_DEFAULT_SCALE = 1.9;

export const OVERWORLD_SCALE_BOUNDS: MapScaleBounds = {
  defaultScale: 2.75,
  minScale: 1.6,
  maxScale: 3.25,
};

export function isCompactMobileViewport(viewW?: number, viewH?: number): boolean {
  const w = viewW ?? (typeof window !== 'undefined' ? window.innerWidth : 960);
  const h = viewH ?? (typeof window !== 'undefined' ? window.innerHeight : 540);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return Math.min(w, h) <= 540 || w <= 768;
}

export function resolveInitialDungeonScale(viewW?: number, viewH?: number): number {
  return isCompactMobileViewport(viewW, viewH) ? MAP_MOBILE_DEFAULT_SCALE : MAP_DEFAULT_SCALE;
}

export function resolveInitialOverworldScale(viewW?: number, viewH?: number): number {
  return isCompactMobileViewport(viewW, viewH)
    ? OVERWORLD_MOBILE_DEFAULT_SCALE
    : OVERWORLD_SCALE_BOUNDS.defaultScale;
}

/** 6 native PMD tiles (`6 * 24 = 144` native world px) of comfortable edge/HUD overscroll */
export const MAP_OVERSCROLL_NATIVE_PX = 6 * 24;

export interface MapCameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function clampMapScale(
  scale: number,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS
): number {
  if (!Number.isFinite(scale)) return bounds.defaultScale;
  const clamped = Math.max(bounds.minScale, Math.min(bounds.maxScale, scale));
  if (Math.abs(clamped - bounds.defaultScale) < 0.002) {
    return bounds.defaultScale;
  }
  return Math.round(clamped * 10000) / 10000;
}

export function computeCenteredMapCameraBounds(
  worldW: number,
  worldH: number,
  visibleWorldW: number,
  visibleWorldH: number,
  overscrollWorldPx = MAP_OVERSCROLL_NATIVE_PX
): MapCameraBounds {
  let minX: number;
  let maxX: number;
  if (worldW <= visibleWorldW) {
    const centerCamX = (worldW - visibleWorldW) / 2;
    minX = centerCamX - overscrollWorldPx;
    maxX = centerCamX + overscrollWorldPx;
  } else {
    minX = -overscrollWorldPx / 2;
    maxX = worldW - visibleWorldW + overscrollWorldPx / 2;
  }

  let minY: number;
  let maxY: number;
  if (worldH <= visibleWorldH) {
    const centerCamY = (worldH - visibleWorldH) / 2;
    minY = centerCamY - overscrollWorldPx;
    maxY = centerCamY + overscrollWorldPx;
  } else {
    minY = -overscrollWorldPx / 2;
    maxY = worldH - visibleWorldH + overscrollWorldPx / 2;
  }

  return { minX, maxX, minY, maxY };
}

export function computeWheelZoomScale(
  currentScale: number,
  ev: WheelEvent,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS
): number {
  let deltaPx = ev.deltaY;
  if (ev.deltaMode === 1) deltaPx *= 16;
  else if (ev.deltaMode === 2) deltaPx *= 100;
  if (!Number.isFinite(deltaPx) || deltaPx === 0) {
    return clampMapScale(currentScale, bounds);
  }
  const sensitivity = ev.ctrlKey ? 0.0085 : 0.0018;
  const clampedDelta = Math.max(-240, Math.min(240, deltaPx));
  const factor = Math.exp(-clampedDelta * sensitivity);
  return clampMapScale(currentScale * factor, bounds);
}
