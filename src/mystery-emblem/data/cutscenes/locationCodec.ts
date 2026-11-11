/**
 * Location Tile Layer Codec (`locationCodec.ts`)
 *
 * Tile layers reuse the compact chapter row format (`"F:28 X:003:2"`) plus `.` for an
 * empty, see-through cell that lets the layers underneath show.
 */

import { EMPTY_TILESET_ID } from '../../assets/tilesetCatalog';
import type { DungeonMapTileCell } from '../../types/schemas';
import { decodeTileRows, encodeTileRows } from '../chapters/chapterCodec';

export type LocationTileGrid = Array<Array<DungeonMapTileCell | null>>;

export const EMPTY_TILE_CELL: Readonly<DungeonMapTileCell> = {
  terrainType: 'floor',
  tilesetId: EMPTY_TILESET_ID,
  chunkIndex: 0,
};

export function isEmptyTileCell(cell: DungeonMapTileCell | null | undefined): boolean {
  return !cell || cell.tilesetId === EMPTY_TILESET_ID;
}

export function decodeLocationTileRows(
  rows: ReadonlyArray<string>,
  defaultTilesetId: string,
  width: number,
  height: number
): LocationTileGrid {
  const grid: LocationTileGrid = [];
  for (let y = 0; y < height; y++) {
    const tokens = (rows[y] ?? '').trim().split(/\s+/).filter(Boolean);
    const row: Array<DungeonMapTileCell | null> = [];
    for (let x = 0; x < width; x++) {
      const token = tokens[x];
      if (!token || token === '.') {
        row.push(null);
        continue;
      }
      row.push(decodeTileRows([token], defaultTilesetId)[0]?.[0] ?? null);
    }
    grid.push(row);
  }
  return grid;
}

export function encodeLocationTileRows(grid: LocationTileGrid, defaultTilesetId: string): string[] {
  return grid.map((row) =>
    row
      .map((cell) =>
        isEmptyTileCell(cell) ? '.' : encodeTileRows([[cell!]], defaultTilesetId)[0]!
      )
      .join(' ')
  );
}

/** Converts `null` cells to the editor's see-through placeholder cell (and back). */
export function toEditableTileGrid(grid: LocationTileGrid): DungeonMapTileCell[][] {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : { ...EMPTY_TILE_CELL })));
}

export function fromEditableTileGrid(
  tiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>
): LocationTileGrid {
  return tiles.map((row) => row.map((cell) => (isEmptyTileCell(cell) ? null : { ...cell })));
}

/** Most common tileset in a grid, used as the row encoding default. */
export function pickDominantTileset(grid: LocationTileGrid, fallback = '042'): string {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      counts.set(cell.tilesetId, (counts.get(cell.tilesetId) ?? 0) + 1);
    }
  }
  let best = fallback;
  let bestCount = -1;
  for (const [id, n] of counts) {
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  return best;
}
