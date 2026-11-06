/**
 * PMD: Explorers of Sky 24x24 Dungeon Tileset Parser & Special Tile Overlay Renderer (Step 5)
 *
 * Parses flat `384x600` (`16x25` cells of `24x24`px) PMD2 chunk sheets from `/assets/tilesets/`,
 * automatically strips empty trailing key-color cells matching chunk `(0,0)`, and renders crisp
 * `image-rendering: pixelated` chunks plus authentic `24x24` pixel-art overlays for `Dungeon Stairs`,
 * `Wonder Tile`, and `Low Barrier` tiles.
 */

import type { TerrainType } from '../types/schemas';

export const PMD_TILE_NATIVE_PX = 24;
export const PMD_TILESET_SHEET_COLS = 16;
export const PMD_TILESET_SHEET_ROWS = 25;
export const PMD_TILESET_MAX_CHUNKS = PMD_TILESET_SHEET_COLS * PMD_TILESET_SHEET_ROWS;

export interface TilesetManifestEntry {
  id: string;
  label: string;
  fileName: string;
  url: string;
}

export interface LoadedTilesetSheet {
  id: string;
  label: string;
  url: string;
  width: number;
  height: number;
  source: HTMLCanvasElement;
  keyColorRgba: [number, number, number, number];
  /** Non-empty chunk indices (`1..399`) that do not match the `(0,0)` solid background fill */
  validChunkIndices: ReadonlyArray<number>;
  validChunkSet: ReadonlySet<number>;
}

const rawTilesetModules = import.meta.glob<string>('/assets/tilesets/tileset_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Curated biome labels for commonly used PMD: Explorers of Sky dungeon sheets */
const CURATED_TILESET_NAMES: Readonly<Record<string, string>> = {
  '000': 'Debug Wireframe Grid',
  '001': 'Beach Cave',
  '003': 'Drenched Bluff',
  '014': 'Mt. Bristle / Crag',
  '016': 'Waterfall Cave',
  '017': 'Northern Desert',
  '018': 'Volcanic Rim',
  '020': 'Dusk Forest',
  '025': 'Crystal Crossing',
  '026': 'Chasm Cave (Dark)',
  '027': 'Chasm Cave (Deep)',
  '042': 'Apple Woods',
  '050': 'Sealed Ruin',
  '061': 'Abyssal Chasm / Void',
  '064': 'Dark Hill',
  '068': 'Treeshroud Ruin',
  '072': 'Labyrinth Cave',
  '075': 'Serenity River',
  '079': 'Blizzard Island',
  '080': 'Crystal Cave',
  '082': 'Crystal Lake',
  '085': 'Quicksand Cave',
  '096': 'Foggy Forest',
  '108': 'Craggy Coast',
  '110': 'Steam Cave (Lava)',
  '112': 'Dark Crater (Magma)',
  '120': 'Oran Forest',
  '138': 'Aegis Cave',
  '141': 'Temporal Spire',
  '142': 'Lush Prairie',
  '143': 'Snowy Peak',
};

function parseTilesetManifestEntry(globPath: string, url: string): TilesetManifestEntry {
  const fileName = globPath.split('/').pop() ?? globPath;
  const match = fileName.match(/tileset_(\d{1,3})\.png$/i);
  const id = match ? match[1]!.padStart(3, '0') : fileName.replace(/\.png$/i, '');
  const biomeName = CURATED_TILESET_NAMES[id];
  const label = biomeName ? `#${id} · ${biomeName}` : `#${id} · Dungeon Sheet ${id}`;
  return { id, label, fileName, url };
}

export const PMD_TILESET_LIST: ReadonlyArray<TilesetManifestEntry> = Object.entries(
  rawTilesetModules
)
  .map(([globPath, url]) => parseTilesetManifestEntry(globPath, url))
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

const tilesetManifestById = new Map<string, TilesetManifestEntry>();
for (const entry of PMD_TILESET_LIST) {
  tilesetManifestById.set(entry.id, entry);
}

export function normalizeTilesetId(rawId: string): string {
  const trimmed = rawId.trim().toLowerCase();
  const match = trimmed.match(/(?:tileset_)?(\d{1,3})(?:\.png)?$/);
  if (match) {
    return match[1]!.padStart(3, '0');
  }
  return trimmed;
}

export function getTilesetManifestEntry(rawId: string): TilesetManifestEntry | undefined {
  return tilesetManifestById.get(normalizeTilesetId(rawId));
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
  // Populate chunk 1 with a crisp stone tile fallback
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

  const entry = tilesetManifestById.get(id) ?? tilesetManifestById.get('001');
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

      // Sample `(0,0)` key fill color used by PMD2 sheets for empty chunk slots
      const r0 = imageData[0] ?? 0;
      const g0 = imageData[1] ?? 0;
      const b0 = imageData[2] ?? 0;
      const a0 = imageData[3] ?? 255;

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

        if (!matchesKeyFill) {
          validChunkIndices.push(idx);
        }
      }

      if (validChunkIndices.length === 0) {
        validChunkIndices.push(1);
      }

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

export function clearTilesetSheetCache(): void {
  loadedSheetCache.clear();
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

// ============================================================================
// Native 24x24 Pixel-Art Special Tile Overlays (Dungeon Stairs, Wonder Tile, Low Barrier)
// ============================================================================

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

  // Classic PMD: Explorers of Sky recessed stone staircase (24x24 pixel-art)
  // Outer dark bevel frame
  ctx.fillStyle = '#0c1424';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#24344c';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = '#080e1a';
  ctx.fillRect(4, 4, 16, 16);

  // 4 stepped stone treads ascending from bottom-left to top-right
  const steps: Array<{ x: number; y: number; w: number; h: number }> = [
    { x: 4, y: 16, w: 16, h: 4 },
    { x: 6, y: 12, w: 14, h: 4 },
    { x: 9, y: 8, w: 11, h: 4 },
    { x: 12, y: 4, w: 8, h: 4 },
  ];
  for (const st of steps) {
    // Top lit stone tread
    ctx.fillStyle = '#dceaff';
    ctx.fillRect(st.x, st.y, st.w, 1);
    ctx.fillStyle = '#a8c2e0';
    ctx.fillRect(st.x, st.y + 1, st.w, 1);
    // Riser shadow
    ctx.fillStyle = '#5c7698';
    ctx.fillRect(st.x, st.y + 2, st.w, 1);
    ctx.fillStyle = '#2e4260';
    ctx.fillRect(st.x, st.y + 3, st.w, 1);
    // Left step edge highlight
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(st.x, st.y, 1, 2);
  }

  // Subtle gold/cyan corner rivets matching PMD dungeon stairs
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

  // Authentic PMD: Explorers of Sky Wonder Tile (cyan/gold/magenta chevron pad)
  ctx.fillStyle = '#101c34';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#38b8f8';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = '#183864';
  ctx.fillRect(4, 4, 16, 16);

  // Outer radiant diamond ring
  const diamondCoords: Array<[number, number, string]> = [];
  for (let y = 5; y <= 18; y++) {
    for (let x = 5; x <= 18; x++) {
      const dist = Math.abs(x - 11.5) + Math.abs(y - 11.5);
      if (dist <= 3.2) {
        diamondCoords.push([x, y, '#fff498']);
      } else if (dist <= 5.2) {
        diamondCoords.push([x, y, '#f878c8']);
      } else if (dist <= 7.2) {
        diamondCoords.push([x, y, '#58e8ff']);
      }
    }
  }
  for (const [px, py, color] of diamondCoords) {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, 1, 1);
  }

  // Upward chevron motif in center
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(11, 8, 2, 2);
  ctx.fillRect(9, 10, 2, 2);
  ctx.fillRect(13, 10, 2, 2);
  ctx.fillRect(7, 12, 2, 2);
  ctx.fillRect(15, 12, 2, 2);

  // Gold corner accents
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

  // Low crystal/rune barrier rail (visually shows Levitate units can float over it)
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
