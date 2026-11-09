/**
 * Pixel-Art Canvas Frame & Mini Preview Renderer for `ChapterMapEditorScene`
 */

import { computePmdTileSpritePlacement } from '../../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import type { DungeonMapDefinition } from '../../types/schemas';
import type { EditorRuntimeState } from './editorTypesAndState';

function drawEditorUnitPreviewSprite(
  ctx: CanvasRenderingContext2D,
  state: EditorRuntimeState,
  speciesId: string,
  tileX: number,
  tileY: number,
  direction: 2 | 6
): void {
  const bundle = state.spriteBundles.get(speciesId);
  const anim = bundle ? (bundle.actions.Idle ?? bundle.actions.Walk) : undefined;
  if (!anim) return;
  const row = anim.rowCount >= 8 ? direction : direction % Math.max(1, anim.rowCount);
  const sy = row * anim.frameHeight;
  const screenTileX = tileX * PMD_TILE_NATIVE_PX - state.cam.cameraX;
  const screenTileY = tileY * PMD_TILE_NATIVE_PX - state.cam.cameraY;
  const pos = computePmdTileSpritePlacement(
    screenTileX,
    screenTileY,
    anim.frameWidth,
    anim.frameHeight,
    PMD_TILE_NATIVE_PX
  );
  ctx.drawImage(
    anim.source,
    0,
    sy,
    anim.frameWidth,
    anim.frameHeight,
    pos.drawX,
    pos.drawY,
    anim.frameWidth,
    anim.frameHeight
  );
}

export function renderEditorFrame(
  ctx: CanvasRenderingContext2D,
  state: EditorRuntimeState
): void {
  const { cam, map } = state;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, cam.bufferWidth, cam.bufferHeight);

  const startCol = Math.max(0, Math.floor(cam.cameraX / PMD_TILE_NATIVE_PX));
  const endCol = Math.min(
    map.width - 1,
    Math.ceil((cam.cameraX + cam.bufferWidth) / PMD_TILE_NATIVE_PX)
  );
  const startRow = Math.max(0, Math.floor(cam.cameraY / PMD_TILE_NATIVE_PX));
  const endRow = Math.min(
    map.height - 1,
    Math.ceil((cam.cameraY + cam.bufferHeight) / PMD_TILE_NATIVE_PX)
  );

  for (let ty = startRow; ty <= endRow; ty++) {
    const row = map.tiles[ty];
    if (!row) continue;
    for (let tx = startCol; tx <= endCol; tx++) {
      const cell = row[tx];
      if (!cell) continue;
      const dx = tx * PMD_TILE_NATIVE_PX - cam.cameraX;
      const dy = ty * PMD_TILE_NATIVE_PX - cam.cameraY;

      const sheet = state.loadedSheets.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(ctx, sheet, cell.chunkIndex, dx, dy, PMD_TILE_NATIVE_PX);
      } else {
        ctx.fillStyle = cell.terrainType === 'wall' ? '#1c2638' : '#2a4234';
        ctx.fillRect(dx, dy, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
      }
      drawSpecialTerrainOverlay(
        ctx,
        cell.terrainType,
        cell.tilesetId,
        dx,
        dy,
        PMD_TILE_NATIVE_PX
      );

      if (state.showGrid) {
        ctx.strokeStyle = 'rgba(144, 216, 248, 0.24)';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 0.5, dy + 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
      }
    }
  }

  if (state.showSpawns) {
    const cap = Math.max(
      1,
      Math.min(map.deploymentCap ?? map.playerSpawns.length, map.playerSpawns.length)
    );

    map.playerSpawns.forEach((spawn, idx) => {
      const dx = spawn.x * PMD_TILE_NATIVE_PX - cam.cameraX;
      const dy = spawn.y * PMD_TILE_NATIVE_PX - cam.cameraY;
      const withinCap = idx < cap;

      ctx.fillStyle = withinCap ? 'rgba(56, 152, 248, 0.42)' : 'rgba(56, 152, 248, 0.2)';
      ctx.fillRect(dx + 1, dy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
      ctx.strokeStyle = idx === 0 ? '#f8d048' : '#78d8ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 1.5, dy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);

      drawEditorUnitPreviewSprite(ctx, state, spawn.speciesId, spawn.x, spawn.y, 2);
    });

    map.enemySpawns.forEach((spawn) => {
      const dx = spawn.x * PMD_TILE_NATIVE_PX - cam.cameraX;
      const dy = spawn.y * PMD_TILE_NATIVE_PX - cam.cameraY;

      ctx.fillStyle = 'rgba(232, 72, 72, 0.38)';
      ctx.fillRect(dx + 1, dy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
      ctx.strokeStyle = '#ff8888';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 1.5, dy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);

      drawEditorUnitPreviewSprite(ctx, state, spawn.speciesId, spawn.x, spawn.y, 6);
    });

    (map.npcSpawns ?? []).forEach((spawn) => {
      const dx = spawn.x * PMD_TILE_NATIVE_PX - cam.cameraX;
      const dy = spawn.y * PMD_TILE_NATIVE_PX - cam.cameraY;

      ctx.fillStyle = 'rgba(56, 216, 128, 0.38)';
      ctx.fillRect(dx + 1, dy + 1, PMD_TILE_NATIVE_PX - 2, PMD_TILE_NATIVE_PX - 2);
      ctx.strokeStyle = '#68f8a8';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 1.5, dy + 1.5, PMD_TILE_NATIVE_PX - 3, PMD_TILE_NATIVE_PX - 3);

      drawEditorUnitPreviewSprite(ctx, state, spawn.speciesId, spawn.x, spawn.y, 2);
    });

    (map.reinforcements ?? []).forEach((wave) => {
      const dx = wave.stairsX * PMD_TILE_NATIVE_PX - cam.cameraX;
      const dy = wave.stairsY * PMD_TILE_NATIVE_PX - cam.cameraY;
      ctx.strokeStyle = '#ffd860';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 2.5, dy + 2.5, PMD_TILE_NATIVE_PX - 5, PMD_TILE_NATIVE_PX - 5);
      ctx.fillStyle = '#081020';
      ctx.fillRect(dx + 2, dy + 2, 11, 7);
      ctx.fillStyle = '#ffd860';
      ctx.font = 'bold 6px monospace';
      ctx.fillText(`T${wave.turnNumber}`, dx + 3, dy + 8);
    });
  }

  const focusTile = state.hoveredTile ?? state.inspectedTile;
  if (focusTile) {
    const fx = focusTile.x * PMD_TILE_NATIVE_PX - cam.cameraX;
    const fy = focusTile.y * PMD_TILE_NATIVE_PX - cam.cameraY;
    ctx.strokeStyle = '#f8d048';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 0.5, fy + 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
  }
}

/**
 * Renders a crisp `image-rendering: pixelated` mini preview of any `DungeonMapDefinition`
 * onto a Dev Tools `<canvas>` element.
 */
export async function renderDungeonMapPreviewCanvas(
  canvas: HTMLCanvasElement,
  map: DungeonMapDefinition
): Promise<void> {
  const sheetIds = new Set<string>();
  for (const row of map.tiles) {
    for (const cell of row) {
      sheetIds.add(normalizeTilesetId(cell.tilesetId));
    }
  }

  const loaded = new Map<string, LoadedTilesetSheet>();
  await Promise.all(
    [...sheetIds].map(async (id) => {
      const sheet = await loadTilesetSheet(id);
      loaded.set(id, sheet);
    })
  );

  canvas.width = map.width * PMD_TILE_NATIVE_PX;
  canvas.height = map.height * PMD_TILE_NATIVE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080e1c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      const dx = x * PMD_TILE_NATIVE_PX;
      const dy = y * PMD_TILE_NATIVE_PX;
      const sheet = loaded.get(normalizeTilesetId(cell.tilesetId));
      if (sheet) {
        drawTilesetChunk(ctx, sheet, cell.chunkIndex, dx, dy, PMD_TILE_NATIVE_PX);
      }
      drawSpecialTerrainOverlay(
        ctx,
        cell.terrainType,
        cell.tilesetId,
        dx,
        dy,
        PMD_TILE_NATIVE_PX
      );
    }
  }

  for (const p of map.playerSpawns) {
    const dx = p.x * PMD_TILE_NATIVE_PX;
    const dy = p.y * PMD_TILE_NATIVE_PX;
    ctx.fillStyle = 'rgba(56, 168, 255, 0.55)';
    ctx.fillRect(dx + 3, dy + 3, PMD_TILE_NATIVE_PX - 6, PMD_TILE_NATIVE_PX - 6);
    ctx.strokeStyle = '#d8f4ff';
    ctx.strokeRect(dx + 3.5, dy + 3.5, PMD_TILE_NATIVE_PX - 7, PMD_TILE_NATIVE_PX - 7);
  }
  for (const e of map.enemySpawns) {
    const dx = e.x * PMD_TILE_NATIVE_PX;
    const dy = e.y * PMD_TILE_NATIVE_PX;
    ctx.fillStyle = 'rgba(240, 72, 72, 0.6)';
    ctx.fillRect(dx + 3, dy + 3, PMD_TILE_NATIVE_PX - 6, PMD_TILE_NATIVE_PX - 6);
    ctx.strokeStyle = '#ffd0d0';
    ctx.strokeRect(dx + 3.5, dy + 3.5, PMD_TILE_NATIVE_PX - 7, PMD_TILE_NATIVE_PX - 7);
  }
}
