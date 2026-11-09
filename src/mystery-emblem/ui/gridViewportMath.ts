/**
 * Shared 1x Native Pixel Buffer + CSS Scale Viewport & Tile Coordinate Math
 *
 * Used by both `BattleScene` and `ChapterMapEditorScene` to guarantee:
 * - Zero fractional tile seams (`1x` `24x24`px native canvas backing buffer + CSS width/height scaling)
 * - `imageSmoothingEnabled = false` nearest-neighbor pixel art
 * - Unified client <-> world <-> tile coordinate conversions and centered camera bounds
 */

import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import {
  MAP_DEFAULT_SCALE,
  MAP_OVERSCROLL_NATIVE_PX,
  clampMapScale,
  computeCenteredMapCameraBounds,
  type MapCameraBounds,
} from './mapZoomController';

export interface DungeonGridCameraState {
  bufferWidth: number;
  bufferHeight: number;
  cameraX: number;
  cameraY: number;
  displayScale: number;
}

export function createInitialDungeonGridCamera(
  defaultScale = MAP_DEFAULT_SCALE
): DungeonGridCameraState {
  return {
    bufferWidth: 480,
    bufferHeight: 320,
    cameraX: 0,
    cameraY: 0,
    displayScale: defaultScale,
  };
}

/**
 * Resizes `canvas` to the integer `1x` native world buffer matching `stageEl` divided by `displayScale`,
 * and sets `canvas.style.width/height` to the exact CSS scaled size.
 */
export function syncDungeonCanvasBuffer(
  stageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cam: DungeonGridCameraState
): { stageW: number; stageH: number } {
  const stageRect = stageEl.getBoundingClientRect();
  const stageW = Math.max(
    240,
    Math.floor(stageRect.width || stageEl.clientWidth || window.innerWidth || 640)
  );
  const stageH = Math.max(
    180,
    Math.floor(stageRect.height || stageEl.clientHeight || window.innerHeight || 480)
  );
  cam.displayScale = clampMapScale(cam.displayScale);

  cam.bufferWidth = Math.max(96, Math.ceil(stageW / cam.displayScale));
  cam.bufferHeight = Math.max(72, Math.ceil(stageH / cam.displayScale));

  if (canvas.width !== cam.bufferWidth || canvas.height !== cam.bufferHeight) {
    canvas.width = cam.bufferWidth;
    canvas.height = cam.bufferHeight;
    ctx.imageSmoothingEnabled = false;
  }
  canvas.style.width = `${Math.round(cam.bufferWidth * cam.displayScale * 100) / 100}px`;
  canvas.style.height = `${Math.round(cam.bufferHeight * cam.displayScale * 100) / 100}px`;

  return { stageW, stageH };
}

export function computeDungeonCameraBounds(
  mapWidthTiles: number,
  mapHeightTiles: number,
  cam: Pick<DungeonGridCameraState, 'bufferWidth' | 'bufferHeight'>,
  overscrollWorldPx = MAP_OVERSCROLL_NATIVE_PX
): MapCameraBounds {
  const worldW = mapWidthTiles * PMD_TILE_NATIVE_PX;
  const worldH = mapHeightTiles * PMD_TILE_NATIVE_PX;
  const raw = computeCenteredMapCameraBounds(
    worldW,
    worldH,
    cam.bufferWidth,
    cam.bufferHeight,
    overscrollWorldPx
  );
  return {
    minX: Math.round(raw.minX),
    minY: Math.round(raw.minY),
    maxX: Math.round(raw.maxX),
    maxY: Math.round(raw.maxY),
  };
}

export function clampDungeonCameraPosition(
  cam: DungeonGridCameraState,
  mapWidthTiles: number,
  mapHeightTiles: number,
  worldX: number,
  worldY: number,
  overscrollWorldPx = MAP_OVERSCROLL_NATIVE_PX
): void {
  const { minX, minY, maxX, maxY } = computeDungeonCameraBounds(
    mapWidthTiles,
    mapHeightTiles,
    cam,
    overscrollWorldPx
  );
  cam.cameraX = Math.round(Math.max(minX, Math.min(maxX, worldX)));
  cam.cameraY = Math.round(Math.max(minY, Math.min(maxY, worldY)));
}

export function centerDungeonCameraOnTile(
  cam: DungeonGridCameraState,
  mapWidthTiles: number,
  mapHeightTiles: number,
  tx: number,
  ty: number
): void {
  const targetWorldX =
    tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - cam.bufferWidth / 2;
  const targetWorldY =
    ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2 - cam.bufferHeight / 2;
  clampDungeonCameraPosition(cam, mapWidthTiles, mapHeightTiles, targetWorldX, targetWorldY);
}

export function clientPointToDungeonWorld(
  canvas: HTMLCanvasElement,
  cam: Pick<DungeonGridCameraState, 'cameraX' | 'cameraY' | 'displayScale'>,
  clientX: number,
  clientY: number
): { worldX: number; worldY: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    worldX: cam.cameraX + (clientX - rect.left) / cam.displayScale,
    worldY: cam.cameraY + (clientY - rect.top) / cam.displayScale,
  };
}

export function clientPointToDungeonTile(
  canvas: HTMLCanvasElement,
  cam: Pick<DungeonGridCameraState, 'cameraX' | 'cameraY' | 'displayScale'>,
  mapWidthTiles: number,
  mapHeightTiles: number,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const worldX = cam.cameraX + (clientX - rect.left) / cam.displayScale;
  const worldY = cam.cameraY + (clientY - rect.top) / cam.displayScale;
  const tx = Math.floor(worldX / PMD_TILE_NATIVE_PX);
  const ty = Math.floor(worldY / PMD_TILE_NATIVE_PX);
  if (tx < 0 || ty < 0 || tx >= mapWidthTiles || ty >= mapHeightTiles) {
    return null;
  }
  return { x: tx, y: ty };
}

export function tileCenterToClientPoint(
  canvas: HTMLCanvasElement,
  cam: Pick<DungeonGridCameraState, 'cameraX' | 'cameraY' | 'displayScale'>,
  tx: number,
  ty: number
): { clientX: number; clientY: number } {
  const rect = canvas.getBoundingClientRect();
  const worldCenterX = tx * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  const worldCenterY = ty * PMD_TILE_NATIVE_PX + PMD_TILE_NATIVE_PX / 2;
  return {
    clientX: rect.left + (worldCenterX - cam.cameraX) * cam.displayScale,
    clientY: rect.top + (worldCenterY - cam.cameraY) * cam.displayScale,
  };
}

export function applyDungeonZoomWithWorldAnchor(
  stageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  cam: DungeonGridCameraState,
  mapWidthTiles: number,
  mapHeightTiles: number,
  nextScale: number,
  clientX: number,
  clientY: number,
  anchorWorldX: number,
  anchorWorldY: number
): void {
  cam.displayScale = clampMapScale(nextScale);
  const { stageW, stageH } = syncDungeonCanvasBuffer(stageEl, canvas, ctx, cam);
  const stageRect = stageEl.getBoundingClientRect();
  const canvasCssW = cam.bufferWidth * cam.displayScale;
  const canvasCssH = cam.bufferHeight * cam.displayScale;
  const canvasLeft = stageRect.left + (stageW - canvasCssW) / 2;
  const canvasTop = stageRect.top + (stageH - canvasCssH) / 2;
  const localCssX = clientX - canvasLeft;
  const localCssY = clientY - canvasTop;

  clampDungeonCameraPosition(
    cam,
    mapWidthTiles,
    mapHeightTiles,
    anchorWorldX - localCssX / cam.displayScale,
    anchorWorldY - localCssY / cam.displayScale
  );
}
