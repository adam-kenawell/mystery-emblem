/**
 * Handcrafted Multi-Biome Skirmish Sandbox Map (`28x18` = `1344x864px` at `2x` scale)
 *
 * Combines verified 24x24 chunks from PMD: Explorers of Sky tilesets:
 * - `142` (Lush Prairie: grass floor, standalone foliage trees, sparkling water)
 * - `110` (Steam Cave: sandy stone floor, rocky mountain crags, molten lava)
 * - `061` (Abyssal Chasm: dark ruin floor, pitch-black Void/Chasm)
 * - `080` (Crystal Cave: glowing cyan Low Barrier crystals)
 * - `001` (Beach Cave: thick cavern perimeter Walls)
 * Plus `Dungeon Stairs` and `Wonder Tile` overlays so all 10 Step 5 terrain types
 * sit immediately around the 3 initial player Pokémon (`Grounded`, `Flying`, `Levitate`)
 * and 2 stationary dummy Ironscale enemies (for Danger Area & ZOC blocking).
 */

import type {
  DungeonMapDefinition,
  DungeonMapTileCell,
  TerrainType,
} from '../types/schemas';

export const DEFAULT_TERRAIN_PALETTE: Readonly<
  Record<TerrainType, { tilesetId: string; chunkIndex: number }>
> = {
  floor: { tilesetId: '142', chunkIndex: 59 },
  trees: { tilesetId: '142', chunkIndex: 1 },
  stairs: { tilesetId: '142', chunkIndex: 59 },
  water: { tilesetId: '142', chunkIndex: 88 },
  lava: { tilesetId: '110', chunkIndex: 106 },
  mountain: { tilesetId: '110', chunkIndex: 1 },
  void: { tilesetId: '061', chunkIndex: 100 },
  wonder_tile: { tilesetId: '142', chunkIndex: 59 },
  wall: { tilesetId: '001', chunkIndex: 1 },
  barrier: { tilesetId: '080', chunkIndex: 15 },
};

function cell(
  terrainType: TerrainType,
  tilesetId?: string,
  chunkIndex?: number
): DungeonMapTileCell {
  const def = DEFAULT_TERRAIN_PALETTE[terrainType];
  return {
    terrainType,
    tilesetId: tilesetId ?? def.tilesetId,
    chunkIndex: chunkIndex ?? def.chunkIndex,
  };
}

/**
 * ASCII Legend (`28` cols x `18` rows):
 * - `#` = Thick Dungeon Wall (`wall`, impassable to all 3 classes)
 * - `.` = Lush Grass Floor (`floor`, `142:58`/`59`/`60`)
 * - `,` = Stone / Volcanic Floor (`floor`, `110:58`/`59`)
 * - `_` = Abyssal Sanctum Floor (`floor`, `061:59`/`60`)
 * - `T` = Trees / Foliage (`trees`, `142:21`/`22`/`24`)
 * - `~` = Water / Stream (`water`, `142:88`/`101`)
 * - `M` = Mountain / Crag (`mountain`, `110:22`/`23`/`24`)
 * - `L` = Lava / Magma (`lava`, `110:106`/`108`)
 * - `V` = Void / Chasm (`void`, `061:100` — ONLY Levitate can cross!)
 * - `B` = Crystal Low Barrier (`barrier`, `080:15`/`26` — ONLY Levitate crosses at 1 Mov!)
 * - `S` = Dungeon Stairs (`stairs`)
 * - `W` = Wonder Tile (`wonder_tile`)
 *
 * Initial Player Spawns:
 * - Slot 0 (`Dratini`, Grounded): `(8, 8)`
 * - Slot 1 (`Pidgey`, Flying):    `(8, 6)`
 * - Slot 2 (`Duskull`, Levitate): `(8, 10)`
 * Initial Enemy Spawns:
 * - Enemy 0 (`Pawniard`, R1):     `(19, 7)`
 * - Enemy 1 (`Gothita`, R2):      `(20, 10)`
 */
const ASCII_LAYOUT: ReadonlyArray<string> = [
  '############################', // y=0
  '#..~~..MMMMMM,,,,LLLL,,,,,,#', // y=1
  '#..~~..MMMMMM,,,,LLLL,,MM,,#', // y=2
  '#..~~..MMMMMM,,LLLLLL,,MM,,#', // y=3
  '#..~~....TT,,,,LL,,LL,,,,,,#', // y=4
  '#..~~..TT.....,,,,,,T,,,,,,#', // y=5
  '#..~~.TT......B..#....T,,T,#', // y=6  <- Pidgey at (8,6) on floor
  '#..~~.TT......B.......,,,,S#', // y=7  <- Pawniard at (19,7) on floor
  '#..~~.TT.WS.#.B.......,,,,,#', // y=8  <- Dratini at (8,8) on floor, Wonder(9,8), Stairs(10,8), Wall(12,8)
  '#..~~.TT......B.......,,,,W#', // y=9
  '#..~~.TT......B..#....,,,,,#', // y=10 <- Duskull at (8,10) on floor, Gothita at (20,10) on floor
  '#......TT...............TT.#', // y=11
  '#.....VVVVVVVVVV........TT.#', // y=12 <- Void Chasm trench y=12..13!
  '#.....VVVVVVVVVV....MM.....#', // y=13
  '#.....____W_____....MM.....#', // y=14 <- Isolated Void Sanctum y=14..15!
  '#.....______S___...........#', // y=15
  '#..........................#', // y=16
  '############################', // y=17
];

function tileFromAscii(ch: string, x: number, y: number): DungeonMapTileCell {
  const parity = (x * 7 + y * 13) % 3;
  switch (ch) {
    case '#':
      return cell('wall', '001', parity === 0 ? 1 : 19);
    case '.': {
      const grassChunks = [27, 59, 138] as const;
      return cell('floor', '142', grassChunks[parity]);
    }
    case ',': {
      const stoneChunks = [25, 59, 96] as const;
      return cell('floor', '110', stoneChunks[parity]);
    }
    case '_': {
      const darkChunks = [59, 60, 61] as const;
      return cell('floor', '061', darkChunks[parity]);
    }
    case 'T': {
      const treeChunks = [1, 10, 15] as const;
      return cell('trees', '142', treeChunks[parity]);
    }
    case '~':
      return cell('water', '142', 88);
    case 'M': {
      const mtChunks = [1, 36, 1] as const;
      return cell('mountain', '110', mtChunks[parity]);
    }
    case 'L': {
      const lavaChunks = [98, 106, 98] as const;
      return cell('lava', '110', lavaChunks[parity]);
    }
    case 'V': {
      const voidChunks = [86, 100, 104] as const;
      return cell('void', '061', voidChunks[parity]);
    }
    case 'B':
      return cell('barrier', '080', parity === 0 ? 15 : 26);
    case 'S':
      return cell('stairs', x >= 18 ? '110' : y >= 14 ? '061' : '142', 59);
    case 'W':
      return cell('wonder_tile', x >= 18 ? '110' : y >= 14 ? '061' : '142', 59);
    default:
      return cell('floor', '142', 59);
  }
}

export function createDefaultTestDungeonMap(): DungeonMapDefinition {
  const height = ASCII_LAYOUT.length;
  const width = ASCII_LAYOUT[0]!.length;
  const tiles: DungeonMapTileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const rowStr = ASCII_LAYOUT[y]!;
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(tileFromAscii(rowStr[x] ?? '.', x, y));
    }
    tiles.push(row);
  }

  return {
    id: 'skirmish_test_convergence',
    name: 'Test Skirmish — Convergence Ruins',
    bgmCue: 'apple_woods',
    width,
    height,
    tiles,
    playerSpawns: [
      {
        x: 8,
        y: 8,
        speciesId: 'dratini',
        level: 5,
        nickname: 'Bahamut',
        heldItemId: null,
      },
      {
        x: 8,
        y: 6,
        speciesId: 'pidgey',
        level: 5,
        nickname: 'Zephyr',
        heldItemId: null,
      },
      {
        x: 8,
        y: 10,
        speciesId: 'duskull',
        level: 5,
        nickname: 'Wisp',
        heldItemId: null,
      },
    ],
    enemySpawns: [
      {
        x: 19,
        y: 7,
        speciesId: 'pawniard',
        level: 5,
        nickname: 'Ironscale Blade',
        heldItemId: null,
      },
      {
        x: 20,
        y: 10,
        speciesId: 'gothita',
        level: 5,
        nickname: 'Shadow Scout',
        heldItemId: null,
      },
    ],
  };
}

export function cloneDungeonMap(map: DungeonMapDefinition): DungeonMapDefinition {
  return {
    id: map.id,
    name: map.name,
    bgmCue: map.bgmCue,
    width: map.width,
    height: map.height,
    tiles: map.tiles.map((row) => row.map((c) => ({ ...c }))),
    playerSpawns: map.playerSpawns.map((s) => ({ ...s })),
    enemySpawns: map.enemySpawns.map((s) => ({ ...s })),
  };
}
