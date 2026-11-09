/**
 * PMD: Explorers of Sky 24x24 Dungeon Tileset Catalog (`tilesetCatalog.ts`)
 */

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

const rawTilesetModules = import.meta.glob<string>('/assets/tilesets/tileset_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

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

const tilesetManifestById = new Map<string, TilesetManifestEntry>(
  PMD_TILESET_LIST.map((entry) => [entry.id, entry])
);

export function normalizeTilesetId(rawId: string): string {
  const trimmed = rawId.trim().toLowerCase();
  const match = trimmed.match(/(?:tileset_)?(\d{1,3})(?:\.png)?$/);
  return match ? match[1]!.padStart(3, '0') : trimmed;
}

export function getTilesetManifestEntry(rawId: string): TilesetManifestEntry | undefined {
  return tilesetManifestById.get(normalizeTilesetId(rawId));
}
