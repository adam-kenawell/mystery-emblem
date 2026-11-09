/**
 * Native 24x24 Pixel-Art Special Tile Overlays (`tilesetOverlays.ts`)
 *
 * Renders Dungeon Stairs, PMD Wonder Tiles, and Low Barriers at crisp `imageSmoothingEnabled = false`.
 */

import type { TerrainType } from '../types/schemas';
import { normalizeTilesetId, PMD_TILE_NATIVE_PX } from './tilesetCatalog';

let stairsSpriteCanvas: HTMLCanvasElement | null = null;
let wonderTileSpriteCanvas: HTMLCanvasElement | null = null;
let lowBarrierTrimCanvas: HTMLCanvasElement | null = null;

function getStairsOverlayCanvas(): HTMLCanvasElement {
  if (stairsSpriteCanvas) return stairsSpriteCanvas;
  const c = document.createElement('canvas');
  c.width = PMD_TILE_NATIVE_PX;
  c.height = PMD_TILE_NATIVE_PX;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#0c1424';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#24344c';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = '#080e1a';
  ctx.fillRect(4, 4, 16, 16);

  const steps: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: 4, y: 16, w: 16, h: 4 },
    { x: 6, y: 12, w: 14, h: 4 },
    { x: 9, y: 8, w: 11, h: 4 },
    { x: 12, y: 4, w: 8, h: 4 },
  ];
  for (const st of steps) {
    ctx.fillStyle = '#dceaff';
    ctx.fillRect(st.x, st.y, st.w, 1);
    ctx.fillStyle = '#a8c2e0';
    ctx.fillRect(st.x, st.y + 1, st.w, 1);
    ctx.fillStyle = '#5c7698';
    ctx.fillRect(st.x, st.y + 2, st.w, 1);
    ctx.fillStyle = '#2e4260';
    ctx.fillRect(st.x, st.y + 3, st.w, 1);
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(st.x, st.y, 1, 2);
  }

  ctx.fillStyle = '#88d8ff';
  ctx.fillRect(3, 3, 1, 1);
  ctx.fillRect(20, 3, 1, 1);
  ctx.fillRect(3, 20, 1, 1);
  ctx.fillRect(20, 20, 1, 1);

  stairsSpriteCanvas = c;
  return c;
}

function getWonderTileOverlayCanvas(): HTMLCanvasElement {
  if (wonderTileSpriteCanvas) return wonderTileSpriteCanvas;
  const c = document.createElement('canvas');
  c.width = PMD_TILE_NATIVE_PX;
  c.height = PMD_TILE_NATIVE_PX;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#101c34';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#38b8f8';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = '#183864';
  ctx.fillRect(4, 4, 16, 16);

  for (let y = 5; y <= 18; y++) {
    for (let x = 5; x <= 18; x++) {
      const dist = Math.abs(x - 11.5) + Math.abs(y - 11.5);
      if (dist <= 3.2) ctx.fillStyle = '#fff498';
      else if (dist <= 5.2) ctx.fillStyle = '#f878c8';
      else if (dist <= 7.2) ctx.fillStyle = '#58e8ff';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(11, 8, 2, 2);
  ctx.fillRect(9, 10, 2, 2);
  ctx.fillRect(13, 10, 2, 2);
  ctx.fillRect(7, 12, 2, 2);
  ctx.fillRect(15, 12, 2, 2);

  ctx.fillStyle = '#f8d048';
  ctx.fillRect(3, 3, 2, 2);
  ctx.fillRect(19, 3, 2, 2);
  ctx.fillRect(3, 19, 2, 2);
  ctx.fillRect(19, 19, 2, 2);

  wonderTileSpriteCanvas = c;
  return c;
}

function getLowBarrierTrimCanvas(): HTMLCanvasElement {
  if (lowBarrierTrimCanvas) return lowBarrierTrimCanvas;
  const c = document.createElement('canvas');
  c.width = PMD_TILE_NATIVE_PX;
  c.height = PMD_TILE_NATIVE_PX;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = 'rgba(16, 36, 68, 0.55)';
  ctx.fillRect(2, 8, 20, 9);
  ctx.fillStyle = '#48d8ff';
  ctx.fillRect(3, 9, 18, 2);
  ctx.fillRect(4, 6, 3, 11);
  ctx.fillRect(10, 5, 4, 12);
  ctx.fillRect(17, 6, 3, 11);
  ctx.fillStyle = '#d8ffff';
  ctx.fillRect(5, 7, 1, 6);
  ctx.fillRect(11, 6, 2, 7);
  ctx.fillRect(18, 7, 1, 6);

  lowBarrierTrimCanvas = c;
  return c;
}

export function drawSpecialTerrainOverlay(
  ctx: CanvasRenderingContext2D,
  terrainType: TerrainType,
  tilesetId: string,
  destX: number,
  destY: number,
  destSizePx: number
): void {
  ctx.imageSmoothingEnabled = false;
  if (terrainType === 'stairs') {
    ctx.drawImage(
      getStairsOverlayCanvas(),
      0,
      0,
      PMD_TILE_NATIVE_PX,
      PMD_TILE_NATIVE_PX,
      destX,
      destY,
      destSizePx,
      destSizePx
    );
  } else if (terrainType === 'wonder_tile') {
    ctx.drawImage(
      getWonderTileOverlayCanvas(),
      0,
      0,
      PMD_TILE_NATIVE_PX,
      PMD_TILE_NATIVE_PX,
      destX,
      destY,
      destSizePx,
      destSizePx
    );
  } else if (terrainType === 'barrier' && normalizeTilesetId(tilesetId) !== '080') {
    ctx.drawImage(
      getLowBarrierTrimCanvas(),
      0,
      0,
      PMD_TILE_NATIVE_PX,
      PMD_TILE_NATIVE_PX,
      destX,
      destY,
      destSizePx,
      destSizePx
    );
  }
}
