/**
 * Shared Map Camera Bounds, Desktop Wheel/Trackpad Zoom & Mobile Two-Finger Pinch Controller
 *
 * Strictly obeys:
 * - Rule 2: Unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`)
 *   + Desktop `wheel` parity, with ZERO keyboard event listeners.
 * - Rule 3: Preserves crisp pixel-art scaling (`2.0x` default across Overworld & Dungeons,
 *   bounded tightly to `1.5x–2.5x` so players can zoom slightly in/out without distortion).
 */

export const MAP_DEFAULT_SCALE = 2.0;
export const MAP_MIN_SCALE = 1.5;
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

export const OVERWORLD_SCALE_BOUNDS: MapScaleBounds = {
  defaultScale: 2.75,
  minScale: 2.25,
  maxScale: 3.25,
};

/** 6 native PMD tiles (`6 * 24 = 144` native world px) of comfortable edge/HUD overscroll */
export const MAP_OVERSCROLL_NATIVE_PX = 6 * 24;

export interface MapCameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Clamps a map zoom scale to `[minScale, maxScale]`, snapping cleanly to `defaultScale` when within `0.002`.
 */
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

/**
 * Computes dungeon-style camera bounds that center maps smaller than the viewport on `#080e1c`
 * while providing subtle overscroll padding so edge nodes/units never get trapped under HUD bars.
 */
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

/**
 * Converts a mouse scroll-wheel or laptop trackpad pinch `WheelEvent` into the next clamped zoom scale.
 */
export function computeWheelZoomScale(
  currentScale: number,
  ev: WheelEvent,
  bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS
): number {
  let deltaPx = ev.deltaY;
  if (ev.deltaMode === 1) {
    deltaPx *= 16;
  } else if (ev.deltaMode === 2) {
    deltaPx *= 100;
  }
  if (!Number.isFinite(deltaPx) || deltaPx === 0) {
    return clampMapScale(currentScale, bounds);
  }
  // Trackpad pinch gestures emit wheel events with ctrlKey=true and smaller deltaY steps
  const sensitivity = ev.ctrlKey ? 0.0085 : 0.0018;
  const clampedDelta = Math.max(-240, Math.min(240, deltaPx));
  const factor = Math.exp(-clampedDelta * sensitivity);
  return clampMapScale(currentScale * factor, bounds);
}

export interface WorldPoint {
  worldX: number;
  worldY: number;
}

export interface PinchDownOutcome {
  activeCount: number;
  isMultiTouch: boolean;
  enteredMultiTouch: boolean;
}

export interface PinchUpOutcome {
  activeCount: number;
  hadMultiTouch: boolean;
  remainingPointer: {
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null;
}

/**
 * Unified multi-pointer pinch-to-zoom tracker for mobile touchscreens.
 *
 * - Smoothly zooms & pans around the two-finger pinch midpoint within `[1.5x, 2.5x]`.
 * - Re-baselines immediately when hitting `1.5x` or `2.5x` so reversing pinch direction has zero dead-zone.
 * - Flags `hadMultiTouch` until all fingers lift so releasing a pinch never triggers an accidental tap or long-press.
 */
export class MultiTouchPinchTracker {
  private readonly bounds: MapScaleBounds;
  private readonly pointers = new Map<number, { clientX: number; clientY: number }>();
  private multiTouchInSession = false;
  private pinchPairIds: [number, number] | null = null;
  private pinchBaseDist = 0;
  private pinchBaseScale: number;
  private pinchAnchorWorldX = 0;
  private pinchAnchorWorldY = 0;

  constructor(bounds: MapScaleBounds = DUNGEON_SCALE_BOUNDS) {
    this.bounds = bounds;
    this.pinchBaseScale = bounds.defaultScale;
  }

  public reset(): void {
    this.pointers.clear();
    this.multiTouchInSession = false;
    this.pinchPairIds = null;
    this.pinchBaseDist = 0;
    this.pinchBaseScale = this.bounds.defaultScale;
    this.pinchAnchorWorldX = 0;
    this.pinchAnchorWorldY = 0;
  }

  public getActiveCount(): number {
    return this.pointers.size;
  }

  public isMultiTouchSession(): boolean {
    return this.multiTouchInSession;
  }

  public onPointerDown(
    ev: PointerEvent,
    currentScale: number,
    clientToWorld: (clientX: number, clientY: number) => WorldPoint
  ): PinchDownOutcome {
    const wasMulti = this.pointers.size >= 2;
    this.pointers.set(ev.pointerId, { clientX: ev.clientX, clientY: ev.clientY });

    if (this.pointers.size >= 2) {
      this.multiTouchInSession = true;
      this.capturePinchBaseline(currentScale, clientToWorld);
      return {
        activeCount: this.pointers.size,
        isMultiTouch: true,
        enteredMultiTouch: !wasMulti,
      };
    }

    return {
      activeCount: this.pointers.size,
      isMultiTouch: false,
      enteredMultiTouch: false,
    };
  }

  /**
   * Updates pointer coordinates and, when `>= 2` pointers are active, invokes `applyZoomAndAnchor`
   * with the clamped scale, current midpoint, and locked world anchor point.
   * Returns `true` when the event was handled as a multi-touch pinch gesture.
   */
  public onPointerMove(
    ev: PointerEvent,
    getCurrentScale: () => number,
    clientToWorld: (clientX: number, clientY: number) => WorldPoint,
    applyZoomAndAnchor: (params: {
      nextScale: number;
      midClientX: number;
      midClientY: number;
      anchorWorldX: number;
      anchorWorldY: number;
    }) => void
  ): boolean {
    if (!this.pointers.has(ev.pointerId)) {
      return false;
    }
    this.pointers.set(ev.pointerId, { clientX: ev.clientX, clientY: ev.clientY });

    if (this.pointers.size < 2) {
      return false;
    }

    const entries = [...this.pointers.entries()];
    const [id1, p1] = entries[0]!;
    const [id2, p2] = entries[1]!;

    if (
      !this.pinchPairIds ||
      this.pinchPairIds[0] !== id1 ||
      this.pinchPairIds[1] !== id2 ||
      this.pinchBaseDist <= 0
    ) {
      this.capturePinchBaseline(getCurrentScale(), clientToWorld);
    }

    const midClientX = (p1.clientX + p2.clientX) / 2;
    const midClientY = (p1.clientY + p2.clientY) / 2;
    const curDist = Math.max(8, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));

    const rawScale = this.pinchBaseScale * (curDist / Math.max(8, this.pinchBaseDist));
    const nextScale = clampMapScale(rawScale, this.bounds);

    applyZoomAndAnchor({
      nextScale,
      midClientX,
      midClientY,
      anchorWorldX: this.pinchAnchorWorldX,
      anchorWorldY: this.pinchAnchorWorldY,
    });

    // Eliminate clamp dead-zones if fingers pinch beyond [minScale, maxScale] and then reverse direction
    if (rawScale < this.bounds.minScale || rawScale > this.bounds.maxScale) {
      this.pinchBaseScale = nextScale;
      this.pinchBaseDist = curDist;
      const refreshedAnchor = clientToWorld(midClientX, midClientY);
      this.pinchAnchorWorldX = refreshedAnchor.worldX;
      this.pinchAnchorWorldY = refreshedAnchor.worldY;
    }

    return true;
  }

  public onPointerUp(ev: PointerEvent): PinchUpOutcome {
    this.pointers.delete(ev.pointerId);
    this.pinchPairIds = null;

    const hadMultiTouch = this.multiTouchInSession;
    const activeCount = this.pointers.size;
    let remainingPointer: PinchUpOutcome['remainingPointer'] = null;

    if (activeCount === 1) {
      const [remId, remPt] = [...this.pointers.entries()][0]!;
      remainingPointer = {
        pointerId: remId,
        clientX: remPt.clientX,
        clientY: remPt.clientY,
      };
    } else if (activeCount === 0) {
      this.multiTouchInSession = false;
    }

    return {
      activeCount,
      hadMultiTouch,
      remainingPointer,
    };
  }

  private capturePinchBaseline(
    currentScale: number,
    clientToWorld: (clientX: number, clientY: number) => WorldPoint
  ): void {
    const entries = [...this.pointers.entries()];
    if (entries.length < 2) return;
    const [id1, p1] = entries[0]!;
    const [id2, p2] = entries[1]!;
    const midX = (p1.clientX + p2.clientX) / 2;
    const midY = (p1.clientY + p2.clientY) / 2;
    const anchor = clientToWorld(midX, midY);

    this.pinchPairIds = [id1, id2];
    this.pinchBaseDist = Math.max(
      8,
      Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY)
    );
    this.pinchBaseScale = clampMapScale(currentScale, this.bounds);
    this.pinchAnchorWorldX = anchor.worldX;
    this.pinchAnchorWorldY = anchor.worldY;
  }
}
