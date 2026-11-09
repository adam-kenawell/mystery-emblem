/**
 * Unified Multi-Pointer Pinch-to-Zoom Tracker for Mobile Touchscreens (`pinchZoomTracker.ts`)
 *
 * Strictly obeys Rule 2 (Unified Pointer Events only; zero accidental tap/long-press on pinch release).
 */

import {
  clampMapScale,
  DUNGEON_SCALE_BOUNDS,
  type MapScaleBounds,
} from './mapZoomController';

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
    if (!this.pointers.has(ev.pointerId)) return false;
    this.pointers.set(ev.pointerId, { clientX: ev.clientX, clientY: ev.clientY });
    if (this.pointers.size < 2) return false;

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

    return { activeCount, hadMultiTouch, remainingPointer };
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
    this.pinchBaseDist = Math.max(8, Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY));
    this.pinchBaseScale = clampMapScale(currentScale, this.bounds);
    this.pinchAnchorWorldX = anchor.worldX;
    this.pinchAnchorWorldY = anchor.worldY;
  }
}
