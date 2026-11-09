/**
 * PMD: Explorers of Sky 24x24 Dungeon Tileset Sheet Loader (`tilesetLoader.ts`)
 */

import {
  getTilesetManifestEntry,
  normalizeTilesetId,
  PMD_TILE_NATIVE_PX,
  PMD_TILESET_MAX_CHUNKS,
  PMD_TILESET_SHEET_COLS,
  PMD_TILESET_SHEET_ROWS,
} from './tilesetCatalog';

export * from './tilesetCatalog';
export * from './tilesetOverlays';

export interface LoadedTilesetSheet {
  id: string;
  label: string;
  url: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
  keyColorRgba: [number, number, number, number];
  validChunkIndices: ReadonlyArray<number>;
  validChunkSet: ReadonlySet<number>;
}

const loadedSheetCache = new Map<string, Promise<LoadedTilesetSheet>>();

export function clearTilesetCache(): void {
  loadedSheetCache.clear();
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tileset PNG: ${url}`));
    img.src = url;
  });
}

function buildFallbackTilesetSheet(id: string, label: string, url: string): LoadedTilesetSheet {
  const canvas = document.createElement('canvas');
  canvas.width = PMD_TILESET_SHEET_COLS * PMD_TILE_NATIVE_PX;
  canvas.height = PMD_TILESET_SHEET_ROWS * PMD_TILE_NATIVE_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#203048';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#486080';
  ctx.fillRect(PMD_TILE_NATIVE_PX, 0, PMD_TILE_NATIVE_PX, PMD_TILE_NATIVE_PX);
  ctx.strokeStyle = '#7090b8';
  ctx.strokeRect(PMD_TILE_NATIVE_PX + 0.5, 0.5, PMD_TILE_NATIVE_PX - 1, PMD_TILE_NATIVE_PX - 1);
  const valid = [1];
  return {
    id,
    label,
    url,
    width: canvas.width,
    height: canvas.height,
    source: canvas,
    keyColorRgba: [32, 48, 72, 255],
    validChunkIndices: valid,
    validChunkSet: new Set(valid),
  };
}

export async function loadTilesetSheet(rawId: string): Promise<LoadedTilesetSheet> {
  const id = normalizeTilesetId(rawId);
  const existing = loadedSheetCache.get(id);
  if (existing) return existing;

  const entry = getTilesetManifestEntry(id) ?? getTilesetManifestEntry('001');
  if (!entry) {
    return buildFallbackTilesetSheet(id, `#${id}`, '');
  }

  const promise = (async (): Promise<LoadedTilesetSheet> => {
    try {
      const img = await loadImageElement(entry.url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || PMD_TILESET_SHEET_COLS * PMD_TILE_NATIVE_PX;
      canvas.height = img.naturalHeight || PMD_TILESET_SHEET_ROWS * PMD_TILE_NATIVE_PX;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

      const cols = Math.max(1, Math.floor(canvas.width / PMD_TILE_NATIVE_PX));
      const rows = Math.max(1, Math.floor(canvas.height / PMD_TILE_NATIVE_PX));
      const maxChunks = cols * rows;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const [r0 = 0, g0 = 0, b0 = 0, a0 = 255] = imageData;

      const validChunkIndices: number[] = [];
      for (let idx = 1; idx < maxChunks; idx++) {
        const cellX = (idx % cols) * PMD_TILE_NATIVE_PX;
        const cellY = Math.floor(idx / cols) * PMD_TILE_NATIVE_PX;
        let matchesKeyFill = true;

        outer: for (let py = 0; py < PMD_TILE_NATIVE_PX; py++) {
          const rowBase = (cellY + py) * canvas.width;
          for (let px = 0; px < PMD_TILE_NATIVE_PX; px++) {
            const p = (rowBase + cellX + px) * 4;
            if (
              imageData[p] !== r0 ||
              imageData[p + 1] !== g0 ||
              imageData[p + 2] !== b0 ||
              imageData[p + 3] !== a0
            ) {
              matchesKeyFill = false;
              break outer;
            }
          }
        }
        if (!matchesKeyFill) validChunkIndices.push(idx);
      }

      if (validChunkIndices.length === 0) validChunkIndices.push(1);
      return {
        id: entry.id,
        label: entry.label,
        url: entry.url,
        width: canvas.width,
        height: canvas.height,
        source: canvas,
        keyColorRgba: [r0, g0, b0, a0],
        validChunkIndices,
        validChunkSet: new Set(validChunkIndices),
      };
    } catch {
      return buildFallbackTilesetSheet(entry.id, entry.label, entry.url);
    }
  })();

  loadedSheetCache.set(id, promise);
  return promise;
}

export function getChunkSourceRect(chunkIndex: number): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
} {
  const safeIdx = Math.max(0, Math.min(PMD_TILESET_MAX_CHUNKS - 1, Math.floor(chunkIndex)));
  const col = safeIdx % PMD_TILESET_SHEET_COLS;
  const row = Math.floor(safeIdx / PMD_TILESET_SHEET_COLS);
  return {
    sx: col * PMD_TILE_NATIVE_PX,
    sy: row * PMD_TILE_NATIVE_PX,
    sw: PMD_TILE_NATIVE_PX,
    sh: PMD_TILE_NATIVE_PX,
  };
}

export function drawTilesetChunk(
  ctx: CanvasRenderingContext2D,
  sheet: LoadedTilesetSheet,
  chunkIndex: number,
  destX: number,
  destY: number,
  destSizePx: number
): void {
  const resolvedIdx = sheet.validChunkSet.has(chunkIndex)
    ? chunkIndex
    : (sheet.validChunkIndices[0] ?? 1);
  const { sx, sy, sw, sh } = getChunkSourceRect(resolvedIdx);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.source, sx, sy, sw, sh, destX, destY, destSizePx, destSizePx);
}
