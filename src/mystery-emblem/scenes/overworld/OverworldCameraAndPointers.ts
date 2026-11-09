/**
 * Mystery Emblem — Overworld Camera Bounds & Zoom Controller (`OverworldCameraAndPointers.ts`)
 */

import type {
  OverworldGraphDefinition,
  OverworldNodeDefinition,
} from '../../data/overworldMapData';
import type { OverworldRouteResult } from '../../engine/overworldEngine';
import type { SaveStateManager } from '../../state/SaveStateManager';
import {
  MAP_OVERSCROLL_NATIVE_PX,
  OVERWORLD_SCALE_BOUNDS,
  clampMapScale,
  computeCenteredMapCameraBounds,
  type MapCameraBounds,
} from '../../ui/mapZoomController';
import {
  bindOverworldCanvasPointers,
  clearOverworldLongPressTimer,
  createOverworldGestureState,
  type OverworldPointerGestureState,
} from './overworldCanvasPointers';

export interface OverworldCameraControllerHooks {
  rootEl: HTMLElement;
  canvasStageEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  saveManager: SaveStateManager;
  getGraph: () => OverworldGraphDefinition;
  isOpen: () => boolean;
  canInteractWithCanvas: () => boolean;
  isModalOpen: () => boolean;
  isTraveling: () => boolean;
  onRenderFrame: () => void;
  onMenuOrBack: () => void;
  onNodeTapped: (node: OverworldNodeDefinition) => void;
}

export class OverworldCameraAndPointersController {
  public viewWidthPx = 960;
  public viewHeightPx = 540;
  public canvasDpr = 1;
  public displayScale = OVERWORLD_SCALE_BOUNDS.defaultScale;
  public cameraX = 0;
  public cameraY = 0;
  public hasInitializedCamera = false;
  public hoveredNodeId: string | null = null;
  public hoverRoutePreview: OverworldRouteResult | null = null;

  private readonly hooks: OverworldCameraControllerHooks;
  private readonly gs: OverworldPointerGestureState = createOverworldGestureState();
  private resizeObserver: ResizeObserver | null = null;

  constructor(hooks: OverworldCameraControllerHooks, signal: AbortSignal) {
    this.hooks = hooks;
    bindOverworldCanvasPointers(this, hooks, this.gs, signal);
  }

  public resetGestureState(resetScaleToDefault = false): void {
    clearOverworldLongPressTimer(this.gs);
    this.gs.pinchTracker.reset();
    this.gs.activePointerId = null;
    this.gs.isDraggingCamera = false;
    this.gs.longPressFired = false;
    if (resetScaleToDefault) {
      this.displayScale = OVERWORLD_SCALE_BOUNDS.defaultScale;
    }
  }

  public destroy(): void {
    clearOverworldLongPressTimer(this.gs);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  public syncViewportDimensions(): void {
    const rect = this.hooks.canvasStageEl.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth || 960));
    const h = Math.max(240, Math.round(rect.height || window.innerHeight || 540));
    this.viewWidthPx = w;
    this.viewHeightPx = h;
    this.displayScale = clampMapScale(this.displayScale, OVERWORLD_SCALE_BOUNDS);

    const dpr = Math.min(
      3,
      Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    );
    this.canvasDpr = dpr;
    const backingW = Math.round(w * dpr);
    const backingH = Math.round(h * dpr);
    if (this.hooks.canvas.width !== backingW || this.hooks.canvas.height !== backingH) {
      this.hooks.canvas.width = backingW;
      this.hooks.canvas.height = backingH;
    }
    this.hooks.canvas.style.width = `${w}px`;
    this.hooks.canvas.style.height = `${h}px`;
    this.hooks.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hooks.ctx.imageSmoothingEnabled = false;
    this.clampCamera();

    if (!this.resizeObserver && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.hooks.isOpen()) return;
        this.syncViewportDimensions();
        this.hooks.onRenderFrame();
      });
      this.resizeObserver.observe(this.hooks.canvasStageEl);
    }
  }

  public getMaxCameraBounds(): MapCameraBounds {
    const graph = this.hooks.getGraph();
    return computeCenteredMapCameraBounds(
      graph.imageWidth,
      graph.imageHeight,
      this.viewWidthPx / this.displayScale,
      this.viewHeightPx / this.displayScale,
      MAP_OVERSCROLL_NATIVE_PX
    );
  }

  public clampCamera(): void {
    const { minX, maxX, minY, maxY } = this.getMaxCameraBounds();
    this.cameraX = Math.max(minX, Math.min(maxX, this.cameraX));
    this.cameraY = Math.max(minY, Math.min(maxY, this.cameraY));
  }

  public centerCameraInitiallyOnPoint(worldX: number, worldY: number): void {
    const graph = this.hooks.getGraph();
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    this.cameraX =
      graph.imageWidth <= visibleNativeW
        ? (graph.imageWidth - visibleNativeW) / 2
        : worldX - visibleNativeW / 2;
    this.cameraY =
      graph.imageHeight <= visibleNativeH
        ? (graph.imageHeight - visibleNativeH) / 2
        : worldY - visibleNativeH / 2;
    this.clampCamera();
  }

  public centerCameraOnMapPoint(mapX: number, mapY: number): void {
    this.cameraX = mapX - this.viewWidthPx / this.displayScale / 2;
    this.cameraY = mapY - this.viewHeightPx / this.displayScale / 2;
    this.clampCamera();
  }

  public ensurePointComfortableInCamera(mapX: number, mapY: number): void {
    const visibleNativeW = this.viewWidthPx / this.displayScale;
    const visibleNativeH = this.viewHeightPx / this.displayScale;
    const padX = Math.min(64, visibleNativeW * 0.25);
    const padY = Math.min(52, visibleNativeH * 0.25);
    if (mapX < this.cameraX + padX) this.cameraX = mapX - padX;
    else if (mapX > this.cameraX + visibleNativeW - padX)
      this.cameraX = mapX - (visibleNativeW - padX);
    if (mapY < this.cameraY + padY) this.cameraY = mapY - padY;
    else if (mapY > this.cameraY + visibleNativeH - padY)
      this.cameraY = mapY - (visibleNativeH - padY);
    this.clampCamera();
  }

  public clientPointToWorld(clientX: number, clientY: number): { worldX: number; worldY: number } {
    const rect = this.hooks.canvas.getBoundingClientRect();
    return {
      worldX: this.cameraX + (clientX - rect.left) / this.displayScale,
      worldY: this.cameraY + (clientY - rect.top) / this.displayScale,
    };
  }

  public applyZoomWithWorldAnchor(
    nextScale: number,
    clientX: number,
    clientY: number,
    anchorWorldX: number,
    anchorWorldY: number
  ): void {
    this.displayScale = clampMapScale(nextScale, OVERWORLD_SCALE_BOUNDS);
    const rect = this.hooks.canvas.getBoundingClientRect();
    this.cameraX = anchorWorldX - (clientX - rect.left) / this.displayScale;
    this.cameraY = anchorWorldY - (clientY - rect.top) / this.displayScale;
    this.clampCamera();
  }
}
