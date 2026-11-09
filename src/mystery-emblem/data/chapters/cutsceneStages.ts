/**
 * Procedural `24x24` PMD Stage Grids for Out-of-Dungeon Story Cutscenes (`cutsceneStages.ts`)
 */

import type { DungeonMapTileCell, TerrainType } from '../../types/schemas';

function cell(
  terrain: TerrainType,
  tilesetId: string,
  chunkIndex: number
): DungeonMapTileCell {
  return { terrainType: terrain, tilesetId, chunkIndex };
}

function buildGrid(
  width: number,
  height: number,
  pickCell: (x: number, y: number) => DungeonMapTileCell
): DungeonMapTileCell[][] {
  const rows: DungeonMapTileCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(pickCell(x, y));
    }
    rows.push(row);
  }
  return rows;
}

/** Stage 1 (`002` Coast/Beach): Sunny tribe shoreline trail overlooking sparkling eastern tidewaters. */
export const STAGE_01_COASTAL_MEADOW = buildGrid(16, 11, (x, y) => {
  const t = '002';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 38);
    if (x === 15) return cell('wall', t, 37);
    return cell('wall', t, 2);
  }
  if (y === 10) {
    if (x === 0) return cell('wall', t, 39);
    if (x >= 12) return cell('water', t, 43);
    return cell('wall', t, 5);
  }
  if (x === 0) return cell('wall', t, 3);
  if (x >= 13 && y >= 2 && y <= 9) return cell('water', t, 43);
  if (x === 12 && (y === 3 || y === 4 || y === 7 || y === 8)) return cell('water', t, 43);
  if ((x === 3 && y === 2) || (x === 10 && y === 2) || (x === 4 && y === 8)) {
    return cell('wall', t, 27);
  }
  if (x === 9 && y === 8) return cell('water', t, 43);
  const pattern = (x * 7 + y * 13) % 9;
  if (pattern === 0) return cell('floor', t, 98);
  if (pattern === 1 || pattern === 2) return cell('floor', t, 32);
  if (pattern === 3) return cell('floor', t, 34);
  return cell('floor', t, 28);
});

/** Stage 2 (`042` Emerald Heartwood): Verdant Commonwealth Sanctuary with crystal spring & flower meadow. */
export const STAGE_02_SANCTUARY_GLADE = buildGrid(16, 12, (x, y) => {
  const t = '042';
  if (y === 0) return cell('wall', t, 1);
  if (y === 1) return cell('wall', t, 2);
  if (y === 11) {
    if (x >= 6 && x <= 9) return cell('floor', t, 126);
    return cell('wall', t, 5);
  }
  if (x === 0 || x === 15) return cell('trees', t, 2);
  if ((x === 1 || x === 14) && (y <= 4 || y >= 9)) return cell('trees', t, 2);
  if ((x >= 3 && x <= 5 && y >= 3 && y <= 4) || (x >= 10 && x <= 12 && y >= 3 && y <= 4)) {
    return cell('water', t, 39);
  }
  if (
    (x === 5 && y === 6) ||
    (x === 10 && y === 6) ||
    (x === 4 && y === 8) ||
    (x === 11 && y === 8) ||
    (x === 7 && y === 2) ||
    (x === 8 && y === 2)
  ) {
    return cell('floor', t, 124);
  }
  if (x >= 7 && x <= 8 && y >= 3 && y <= 10) return cell('floor', t, 126);
  return cell('floor', t, 28);
});

/** Stage 3 (`003` Verdant Bluff): Dusk ridge campsite overlooking the eastern mountain pass. */
export const STAGE_03_BLUFF_CAMP = buildGrid(16, 11, (x, y) => {
  const t = '003';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 34);
    if (x === 15) return cell('wall', t, 33);
    return cell('wall', t, 2);
  }
  if (y === 10) return cell('wall', t, 5);
  if (x === 0) return cell('wall', t, 3);
  if (x === 15 && (y <= 2 || y >= 8)) return cell('wall', t, 21);
  if (x >= 14 && y >= 3 && y <= 7) return cell('water', t, 41);
  if ((x === 3 && y === 3) || (x === 11 && y === 2) || (x === 3 && y === 8)) {
    return cell('wall', t, 27);
  }
  const mix = (x * 5 + y * 11) % 7;
  if (mix === 0) return cell('floor', t, 131);
  if (mix === 1) return cell('floor', t, 9);
  return cell('floor', t, 28);
});

/** Stage 4 (`014` Cleft Mountain): Ancient Dragon Kingdom stone watchtower parapet above misty chasms. */
export const STAGE_04_WATCHTOWER_PARAPET = buildGrid(16, 11, (x, y) => {
  const t = '014';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 55);
    return cell('wall', t, 2);
  }
  if (y === 10) {
    if (x >= 6 && x <= 9) return cell('floor', t, 15);
    return cell('void', t, 73);
  }
  if (x === 0) return cell('wall', t, 3);
  if (x === 15) return cell('wall', t, 22);
  if ((x <= 3 || x >= 12) && y >= 8) return cell('void', t, 73);
  if ((x === 5 && y === 3) || (x === 10 && y === 3)) return cell('mountain', t, 2);
  if ((x + y) % 3 === 0) return cell('floor', t, 15);
  return cell('floor', t, 29);
});

/** Stage 5 (`016` River Shrine): Cleared stone shrine courtyard spanned by clear river channels. */
export const STAGE_05_SHRINE_COURTYARD = buildGrid(16, 12, (x, y) => {
  const t = '016';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 39);
    if (x === 15) return cell('wall', t, 50);
    if (x >= 7 && x <= 8) return cell('floor', t, 64);
    return cell('wall', t, 2);
  }
  if (y === 11) {
    if (x === 0) return cell('wall', t, 37);
    if (x === 15) return cell('wall', t, 49);
    return cell('wall', t, 5);
  }
  if (x === 0) return cell('wall', t, 18);
  if (x === 15) return cell('wall', t, 32);
  if ((x >= 2 && x <= 4 && y >= 2 && y <= 9) || (x >= 11 && x <= 13 && y >= 2 && y <= 9)) {
    if (y === 5 || y === 6) return cell('floor', t, 64);
    return cell('water', t, 42);
  }
  if ((x === 5 && y === 2) || (x === 10 && y === 2) || (x === 5 && y === 9) || (x === 10 && y === 9)) {
    return cell('wall', t, 28);
  }
  if (x >= 7 && x <= 8) return cell('floor', t, 64);
  if ((x + y) % 4 === 0) return cell('floor', t, 47);
  return cell('floor', t, 9);
});

/** Stage 6 (`042` Berry Orchards & Sanctuary Overlook): Lantern-lit twilight orchard plaza. */
export const STAGE_06_ORCHARD_TWILIGHT = buildGrid(18, 12, (x, y) => {
  const t = '042';
  if (y === 0) return cell('wall', t, 1);
  if (y === 1) {
    if (x >= 7 && x <= 10) return cell('water', t, 39);
    return cell('wall', t, 2);
  }
  if (y === 11) return cell('wall', t, 5);
  if (x === 0 || x === 17) return cell('trees', t, 2);
  if (y === 2 && (x === 6 || x === 11)) return cell('water', t, 45);
  if (
    (x === 4 && y === 5) ||
    (x === 13 && y === 5) ||
    (x === 5 && y === 8) ||
    (x === 12 && y === 8) ||
    (x === 8 && y === 4) ||
    (x === 9 && y === 4)
  ) {
    return cell('floor', t, 124);
  }
  if (x >= 8 && x <= 9 && y >= 3 && y <= 10) return cell('floor', t, 126);
  return cell('floor', t, 28);
});
