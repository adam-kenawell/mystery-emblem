/**
 * Shared Map Camera Bounds, Pixel-Perfect Scale Stops & Desktop Wheel/Trackpad Zoom (`mapZoomController.ts`)
 *
 * Strictly obeys:
 * - Rule 2: Unified Pointer Events (`pinchZoomTracker.ts`) + Desktop `wheel` parity; ZERO keyboard bindings.
 * - Rule 3: Locks zoom to screen-aware exact physical-pixel stops (`k / devicePixelRatio`) so
 *   every native game pixel maps to an exact integer square of physical screen pixels.
 */

export {
  MultiTouchPinchTracker,
  type PinchDownOutcome,
  type PinchUpOutcome,
  type WorldPoint,
} from './pinchZoomTracker';

export const MAP_DEFAULT_SCALE = 2.0;
export const MAP_MOBILE_DEFAULT_SCALE = 1.35;
export const MAP_MIN_SCALE = 1.0;
export const MAP_MAX_SCALE = 3.0;

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

export const OVERWORLD_MOBILE_DEFAULT_SCALE = 2.0;

export const OVERWORLD_SCALE_BOUNDS: MapScaleBounds = {
  defaultScale: 2.75,
  minScale: 1.5,
  maxScale: 4.0,
};

const SCALE_EPSILON = 1e-4;

export function getViewportDevicePixelRatio(dprOverride?: number): number {
  const raw =
    dprOverride ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(1, Math.min(4, raw));
}

/**
 * Returns every CSS scale `k / dpr` (with integer physical-pixel multiplier `k >= 1`)
 * falling within `bounds`, sorted ascending.
 */
export function getPixelPerfectMapScales(
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS,
  dprOverride?: number
): number[] {
  const dpr = getViewportDevicePixelRatio(dprOverride);
  const minK = Math.max(1, Math.ceil((bounds.minScale - 1e-6) * dpr));
  const maxK = Math.max(1, Math.floor((bounds.maxScale + 1e-6) * dpr));
  const stops: number[] = [];
  for (let k = minK; k <= maxK; k++) {
    stops.push(k / dpr);
  }
  if (stops.length === 0) {
    stops.push(Math.max(1, Math.round(bounds.defaultScale * dpr)) / dpr);
  }
  return stops;
}

export function snapMapScaleToPixelStop(
  scale: number,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS,
  dprOverride?: number
): number {
  const stops = getPixelPerfectMapScales(bounds, dprOverride);
  const target = Number.isFinite(scale) ? scale : bounds.defaultScale;
  let best = stops[0]!;
  let bestDist = Math.abs(target - best);
  for (let i = 1; i < stops.length; i++) {
    const candidate = stops[i]!;
    const dist = Math.abs(target - candidate);
    if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) <= 1e-9 && candidate > best)) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export function isDefaultMapScale(scale: number, defaultScale: number): boolean {
  return Math.abs(scale - defaultScale) < SCALE_EPSILON;
}

export function stepMapScale(
  currentScale: number,
  direction: 1 | -1,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS,
  dprOverride?: number
): number {
  const stops = getPixelPerfectMapScales(bounds, dprOverride);
  const snapped = snapMapScaleToPixelStop(currentScale, bounds, dprOverride);
  let idx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const d = Math.abs(stops[i]! - snapped);
    if (d < bestDist) {
      bestDist = d;
      idx = i;
    }
  }
  const nextIdx = Math.max(0, Math.min(stops.length - 1, idx + direction));
  return stops[nextIdx]!;
}

export function isCompactMobileViewport(viewW?: number, viewH?: number): boolean {
  const w = viewW ?? (typeof window !== 'undefined' ? window.innerWidth : 960);
  const h = viewH ?? (typeof window !== 'undefined' ? window.innerHeight : 540);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return Math.min(w, h) <= 540 || w <= 768;
}

export function resolveInitialDungeonScale(
  viewW?: number,
  viewH?: number,
  dprOverride?: number
): number {
  const target = isCompactMobileViewport(viewW, viewH)
    ? MAP_MOBILE_DEFAULT_SCALE
    : MAP_DEFAULT_SCALE;
  return snapMapScaleToPixelStop(target, DUNGEON_SCALE_BOUNDS, dprOverride);
}

export function resolveInitialOverworldScale(
  viewW?: number,
  viewH?: number,
  dprOverride?: number
): number {
  const target = isCompactMobileViewport(viewW, viewH)
    ? OVERWORLD_MOBILE_DEFAULT_SCALE
    : OVERWORLD_SCALE_BOUNDS.defaultScale;
  return snapMapScaleToPixelStop(target, OVERWORLD_SCALE_BOUNDS, dprOverride);
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
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS,
  dprOverride?: number
): number {
  return snapMapScaleToPixelStop(scale, bounds, dprOverride);
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

function normalizeWheelDeltaPx(ev: WheelEvent): number {
  let deltaPx = ev.deltaY;
  if (ev.deltaMode === 1) deltaPx *= 16;
  else if (ev.deltaMode === 2) deltaPx *= 100;
  return Number.isFinite(deltaPx) ? deltaPx : 0;
}

/**
 * Accumulates wheel / trackpad / ctrl-pinch deltas so each discrete mouse wheel click or
 * deliberate trackpad gesture advances exactly one pixel-perfect zoom stop.
 */
export class WheelZoomStepper {
  private readonly bounds: MapScaleBounds;
  private accumPx = 0;
  private lastEventMs = 0;
  private cooldownUntilMs = 0;

  constructor(bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS) {
    this.bounds = bounds;
  }

  public reset(): void {
    this.accumPx = 0;
    this.lastEventMs = 0;
    this.cooldownUntilMs = 0;
  }

  public nextScaleFromWheel(
    currentScale: number,
    ev: WheelEvent,
    nowMs: number = performance.now()
  ): number {
    const deltaPx = normalizeWheelDeltaPx(ev);
    const snapped = snapMapScaleToPixelStop(currentScale, this.bounds);
    if (deltaPx === 0) return snapped;

    const isTrackpadPinch = ev.ctrlKey;
    const isDiscreteNotch = !isTrackpadPinch && Math.abs(deltaPx) >= 45;

    if (isDiscreteNotch) {
      this.accumPx = 0;
      this.lastEventMs = nowMs;
      this.cooldownUntilMs = 0;
      return stepMapScale(snapped, deltaPx < 0 ? 1 : -1, this.bounds);
    }

    if (nowMs < this.cooldownUntilMs) {
      this.lastEventMs = nowMs;
      return snapped;
    }

    if (nowMs - this.lastEventMs > 180 || (this.accumPx !== 0 && Math.sign(deltaPx) !== Math.sign(this.accumPx))) {
      this.accumPx = 0;
    }
    this.lastEventMs = nowMs;
    this.accumPx += deltaPx;

    const threshold = isTrackpadPinch ? 18 : 70;
    if (Math.abs(this.accumPx) < threshold) {
      return snapped;
    }

    const dir: 1 | -1 = this.accumPx < 0 ? 1 : -1;
    this.accumPx = 0;
    this.cooldownUntilMs = nowMs + 110;
    return stepMapScale(snapped, dir, this.bounds);
  }
}

export function computeWheelZoomScale(
  currentScale: number,
  ev: WheelEvent,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS
): number {
  const deltaPx = normalizeWheelDeltaPx(ev);
  if (deltaPx === 0) return snapMapScaleToPixelStop(currentScale, bounds);
  return stepMapScale(currentScale, deltaPx < 0 ? 1 : -1, bounds);
}
