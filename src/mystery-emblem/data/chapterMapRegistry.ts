/**
 * Chapter & Level Map Catalog + Persistent Dev Tools Map Override Store
 *
 * Covers every playable level & chapter in Mystery Emblem:
 * - `drenched_bluff_vanguard` — Drenched Bluff (Test Dungeon) [Default selected in Dev Tools]
 * - `skirmish_test_convergence` — Convergence Ruins (Skirmish Sandbox)
 * - `prologue` — Prologue: Beach Cave
 * - `chapter_01`..`chapter_25` — Main Campaign Chapters 1–25 across Acts 1–4
 * - `paralogue_01`..`paralogue_06` — Optional Paralogues 1–6
 *
 * Persists customized maps immediately to `localStorage` (`mystery_emblem_map_overrides_v1`)
 * and syncs via `SaveData.customMaps` to Cloud Firestore (`saves/{uid}`) when signed in.
 */

import { normalizeTilesetId } from '../assets/tilesetLoader';
import {
  TERRAIN_TYPES,
  type CustomMapOverrideEntry,
  type DungeonMapDefinition,
  type DungeonMapTileCell,
  type DungeonUnitSpawn,
  type TerrainType,
} from '../types/schemas';
import { getSpeciesById } from './index';
import { createPlayableVanguardBattleMap } from './playableBattleMap';
import {
  DEFAULT_TERRAIN_PALETTE,
  cloneDungeonMap,
  createDefaultTestDungeonMap,
} from './testDungeonMap';

export const MAP_OVERRIDES_STORAGE_KEY = 'mystery_emblem_map_overrides_v1';

export type ChapterLevelGroup = 'test' | 'act1' | 'act2' | 'act3' | 'act4' | 'paralogue';

export interface ChapterLevelCatalogEntry {
  id: string;
  shortCode: string;
  label: string;
  group: ChapterLevelGroup;
  groupLabel: string;
  biomeName: string;
  primaryTilesetId: string;
  bgmCue: string;
  defaultDeploymentCap: number;
}

interface GeneratedChapterSpec {
  entry: ChapterLevelCatalogEntry;
  wallTilesetId: string;
  floorTilesetId: string;
  altFloorTilesetId: string;
  waterTilesetId?: string;
  treeTilesetId?: string;
  mountainTilesetId?: string;
  ascii: ReadonlyArray<string>;
  enemies: ReadonlyArray<{
    x: number;
    y: number;
    speciesId: string;
    level: number;
    nickname: string;
  }>;
}

const STANDARD_18X12_COASTAL: ReadonlyArray<string> = [
  '##################',
  '#....~~~..MM,,,,.#',
  '#..T.~~~..MM,,,S.#',
  '#....~~~...T,,,,.#',
  '#..T.......,,,,,M#',
  '#.....,.,,.,,,,,.#',
  '#.....,.W,.,,,,,.#',
  '#....T~~~...,,,,.#',
  '#....~~~..TT,,,,.#',
  '#..T.~~~...T...M.#',
  '#................#',
  '##################',
];

const STANDARD_20X12_WOODLAND: ReadonlyArray<string> = [
  '####################',
  '#...TT....~~...,,,,#',
  '#.T....T..~~..T,,,S#',
  '#....T....~~...,,,,#',
  '#..T....W......,,,M#',
  '#......,,,,...,,,,,#',
  '#......,,,,W..,,,,,#',
  '#..T....~~....T,,,,#',
  '#.TT....~~...TT,,,S#',
  '#.......~~.....,,,,#',
  '#...T..........T...#',
  '####################',
];

const STANDARD_20X13_FORTRESS: ReadonlyArray<string> = [
  '####################',
  '#..MM....#...,,,,S.#',
  '#..MM..T.#...,,,,,M#',
  '#........B...,,,,,,#',
  '#..T.....B..T,,,,,,#',
  '#.....,,,.,,,.,,,,,,#',
  '#.....,,W.,,,.,,,,,,#',
  '#.....,,,.,,,.,,,,,,#',
  '#..T.....B..T,,,,,,#',
  '#........B...,,,,,,#',
  '#..MM..T.#...,,,,,S#',
  '#..MM....#...,,,,,,#',
  '####################',
];

const STANDARD_20X13_VOLCANIC: ReadonlyArray<string> = [
  '####################',
  '#..MM...LLLL..,,,,.#',
  '#..MM...LLLL..,,,S.#',
  '#.......LL....,,,,M#',
  '#..M.........M,,,,,#',
  '#.....,,,,,,,.,,,,,#',
  '#.....,,,W,,,.,,,,,#',
  '#.....,,,,,,,.,,,,,#',
  '#..M....LL...M,,,,,#',
  '#.......LLLL..,,,,M#',
  '#..MM...LLLL..,,,S.#',
  '#................,.#',
  '####################',
];

const STANDARD_22X14_ABYSS: ReadonlyArray<string> = [
  '######################',
  '#...VVVV....MM..,,,,.#',
  '#...VVVV..T.MM..,,,S.#',
  '#....VV.........,,,,M#',
  '#..T......B....T,,,,,#',
  '#......,,,,,,,..,,,,,#',
  '#......,,,W,,,..,,,,,#',
  '#......,,,,,,,..,,,,,#',
  '#..T......B....T,,,,,#',
  '#....VV....LL...,,,,M#',
  '#...VVVV...LL...,,,S.#',
  '#...VVVV........,,,,W#',
  '#....................#',
  '######################',
];

const DEFAULT_PLAYER_SPAWN_POOL: ReadonlyArray<{
  x: number;
  y: number;
  speciesId: string;
  nickname: string;
}> = [
  { x: 3, y: 5, speciesId: 'dratini', nickname: 'Dratini' },
  { x: 3, y: 3, speciesId: 'bulbasaur', nickname: 'Bulbasaur' },
  { x: 3, y: 7, speciesId: 'happiny', nickname: 'Happiny' },
  { x: 2, y: 4, speciesId: 'caterpie', nickname: 'Caterpie' },
  { x: 2, y: 6, speciesId: 'pidgey', nickname: 'Pidgey' },
  { x: 2, y: 8, speciesId: 'duskull', nickname: 'Duskull' },
  { x: 4, y: 4, speciesId: 'abra', nickname: 'Abra' },
  { x: 4, y: 6, speciesId: 'shinx', nickname: 'Shinx' },
  { x: 2, y: 2, speciesId: 'machop', nickname: 'Machop' },
  { x: 4, y: 2, speciesId: 'geodude', nickname: 'Geodude' },
  { x: 4, y: 8, speciesId: 'poliwag', nickname: 'Poliwag' },
  { x: 2, y: 9, speciesId: 'magby', nickname: 'Magby' },
];

function makeCell(
  terrainType: TerrainType,
  tilesetId?: string,
  chunkIndex?: number
): DungeonMapTileCell {
  const fallback = DEFAULT_TERRAIN_PALETTE[terrainType];
  return {
    terrainType,
    tilesetId: normalizeTilesetId(tilesetId ?? fallback.tilesetId),
    chunkIndex: chunkIndex ?? fallback.chunkIndex,
  };
}

function buildGeneratedChapterMap(spec: GeneratedChapterSpec): DungeonMapDefinition {
  const height = spec.ascii.length;
  const width = spec.ascii[0]!.length;
  const tiles: DungeonMapTileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const rowStr = spec.ascii[y]!;
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < width; x++) {
      const ch = rowStr[x] ?? '.';
      const parity = (x * 7 + y * 13) % 3;
      switch (ch) {
        case '#':
          row.push(makeCell('wall', spec.wallTilesetId, parity === 0 ? 1 : 19));
          break;
        case '.':
          row.push(makeCell('floor', spec.floorTilesetId, parity === 0 ? 27 : 59));
          break;
        case ',':
          row.push(makeCell('floor', spec.altFloorTilesetId, parity === 1 ? 25 : 59));
          break;
        case 'T':
          row.push(makeCell('trees', spec.treeTilesetId ?? '142', parity === 1 ? 10 : 1));
          break;
        case '~':
          row.push(makeCell('water', spec.waterTilesetId ?? '142', 88));
          break;
        case 'M':
          row.push(makeCell('mountain', spec.mountainTilesetId ?? '110', parity === 1 ? 36 : 1));
          break;
        case 'L':
          row.push(makeCell('lava', '110', parity === 0 ? 98 : 106));
          break;
        case 'V':
          row.push(makeCell('void', '061', parity === 0 ? 86 : 100));
          break;
        case 'B':
          row.push(makeCell('barrier', '080', parity === 0 ? 15 : 26));
          break;
        case 'S':
          row.push(makeCell('stairs', spec.altFloorTilesetId, 59));
          break;
        case 'W':
          row.push(makeCell('wonder_tile', spec.floorTilesetId, 59));
          break;
        default:
          row.push(makeCell('floor', spec.floorTilesetId, 59));
          break;
      }
    }
    tiles.push(row);
  }

  const cap = spec.entry.defaultDeploymentCap;
  const playerSpawns: DungeonUnitSpawn[] = DEFAULT_PLAYER_SPAWN_POOL.slice(0, cap).map((s) => {
    const safeX = Math.max(1, Math.min(width - 2, s.x));
    const safeY = Math.max(1, Math.min(height - 2, s.y));
    // Ensure spawn sits on a walkable floor tile
    tiles[safeY]![safeX] = makeCell('floor', spec.floorTilesetId, 59);
    return {
      x: safeX,
      y: safeY,
      speciesId: s.speciesId,
      level: 1,
      nickname: s.nickname,
      heldItemId: null,
    };
  });

  const enemySpawns: DungeonUnitSpawn[] = spec.enemies.map((e) => {
    const safeX = Math.max(1, Math.min(width - 2, e.x));
    const safeY = Math.max(1, Math.min(height - 2, e.y));
    if (tiles[safeY]![safeX]!.terrainType === 'wall') {
      tiles[safeY]![safeX] = makeCell('floor', spec.altFloorTilesetId, 59);
    }
    return {
      x: safeX,
      y: safeY,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      heldItemId: null,
    };
  });

  return {
    id: spec.entry.id,
    name: spec.entry.label,
    bgmCue: spec.entry.bgmCue,
    deploymentCap: cap,
    width,
    height,
    tiles,
    playerSpawns,
    enemySpawns,
  };
}

const GENERATED_CHAPTER_SPECS: ReadonlyArray<GeneratedChapterSpec> = [
  // --- ACT 1: Prologue - Chapter 6 ---
  {
    entry: {
      id: 'prologue',
      shortCode: 'Prologue',
      label: 'Prologue — Beach Cave',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Beach Cave',
      primaryTilesetId: '001',
      bgmCue: 'beach_cave',
      defaultDeploymentCap: 3,
    },
    wallTilesetId: '001',
    floorTilesetId: '001',
    altFloorTilesetId: '108',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 10, y: 5, speciesId: 'zigzagoon_galar', level: 1, nickname: 'Beach Scout' },
      { x: 12, y: 3, speciesId: 'rookidee', level: 1, nickname: 'Sky Sentry' },
      { x: 13, y: 7, speciesId: 'pawniard', level: 2, nickname: 'Ironscale Vanguard' },
    ],
  },
  {
    entry: {
      id: 'chapter_01',
      shortCode: 'Ch. 1',
      label: 'Chapter 1 — Drenched Bluff',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Drenched Bluff',
      primaryTilesetId: '003',
      bgmCue: 'drenched_bluff',
      defaultDeploymentCap: 5,
    },
    wallTilesetId: '003',
    floorTilesetId: '003',
    altFloorTilesetId: '142',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 10, y: 4, speciesId: 'zigzagoon_galar', level: 2, nickname: 'Bluff Raider' },
      { x: 12, y: 6, speciesId: 'seedot', level: 2, nickname: 'Coastal Guerilla' },
      { x: 14, y: 3, speciesId: 'rookidee', level: 2, nickname: 'Bluff Harrier' },
      { x: 14, y: 8, speciesId: 'aron', level: 3, nickname: 'Ironscale Shield' },
    ],
  },
  {
    entry: {
      id: 'chapter_02',
      shortCode: 'Ch. 2',
      label: 'Chapter 2 — Mt. Bristle',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Mt. Bristle',
      primaryTilesetId: '014',
      bgmCue: 'mt_bristle',
      defaultDeploymentCap: 6,
    },
    wallTilesetId: '014',
    floorTilesetId: '014',
    altFloorTilesetId: '110',
    mountainTilesetId: '014',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 12, y: 4, speciesId: 'rolycoly', level: 3, nickname: 'Crag Sapper' },
      { x: 14, y: 7, speciesId: 'zubat', level: 3, nickname: 'Peak Flier' },
      { x: 16, y: 5, speciesId: 'gothita', level: 4, nickname: 'Commander Gothita' },
    ],
  },
  {
    entry: {
      id: 'chapter_03',
      shortCode: 'Ch. 3',
      label: 'Chapter 3 — Waterfall Cave',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Waterfall Cave',
      primaryTilesetId: '016',
      bgmCue: 'waterfall_cave',
      defaultDeploymentCap: 6,
    },
    wallTilesetId: '016',
    floorTilesetId: '016',
    altFloorTilesetId: '075',
    waterTilesetId: '075',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 10, y: 5, speciesId: 'spheal', level: 4, nickname: 'Falls Guard' },
      { x: 13, y: 3, speciesId: 'croagunk', level: 4, nickname: 'Cavern Striker' },
      { x: 14, y: 6, speciesId: 'pawniard', level: 5, nickname: 'Garrison Captain' },
    ],
  },
  {
    entry: {
      id: 'chapter_04',
      shortCode: 'Ch. 4',
      label: 'Chapter 4 — Apple Woods',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Apple Woods',
      primaryTilesetId: '042',
      bgmCue: 'apple_woods',
      defaultDeploymentCap: 7,
    },
    wallTilesetId: '042',
    floorTilesetId: '042',
    altFloorTilesetId: '142',
    treeTilesetId: '142',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 12, y: 3, speciesId: 'seedot', level: 5, nickname: 'Woods Guerilla' },
      { x: 13, y: 8, speciesId: 'venipede', level: 5, nickname: 'Thicket Stalker' },
      { x: 16, y: 5, speciesId: 'rookidee', level: 5, nickname: 'Canopy Wing' },
      { x: 17, y: 6, speciesId: 'nuzleaf', level: 6, nickname: 'Ambush Leader' },
    ],
  },
  {
    entry: {
      id: 'chapter_05',
      shortCode: 'Ch. 5',
      label: 'Chapter 5 — Craggy Coast',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Craggy Coast',
      primaryTilesetId: '108',
      bgmCue: 'craggy_coast',
      defaultDeploymentCap: 8,
    },
    wallTilesetId: '108',
    floorTilesetId: '108',
    altFloorTilesetId: '003',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 10, y: 5, speciesId: 'sandile', level: 6, nickname: 'Cliff Raider' },
      { x: 12, y: 3, speciesId: 'zigzagoon_galar', level: 6, nickname: 'Coast Outrider' },
      { x: 13, y: 8, speciesId: 'impidimp', level: 6, nickname: 'Shadow Trickster' },
      { x: 15, y: 6, speciesId: 'timburr', level: 7, nickname: 'Breaker Enforcer' },
    ],
  },
  {
    entry: {
      id: 'chapter_06',
      shortCode: 'Ch. 6',
      label: 'Chapter 6 — Mt. Horn',
      group: 'act1',
      groupLabel: 'Act 1',
      biomeName: 'Mt. Horn',
      primaryTilesetId: '018',
      bgmCue: 'mt_horn',
      defaultDeploymentCap: 8,
    },
    wallTilesetId: '018',
    floorTilesetId: '018',
    altFloorTilesetId: '014',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'aron', level: 7, nickname: 'Traitor Guard' },
      { x: 14, y: 8, speciesId: 'corvisquire', level: 8, nickname: 'Sky Vanguard' },
      { x: 16, y: 5, speciesId: 'lairon', level: 8, nickname: 'Cragforge Captain' },
      { x: 17, y: 7, speciesId: 'carkol', level: 9, nickname: 'Siege Lieutenant' },
    ],
  },

  // --- ACT 2: Chapters 7 - 13 ---
  {
    entry: {
      id: 'chapter_07',
      shortCode: 'Ch. 7',
      label: 'Chapter 7 — Foggy Forest',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Foggy Forest',
      primaryTilesetId: '096',
      bgmCue: 'foggy_forest',
      defaultDeploymentCap: 9,
    },
    wallTilesetId: '096',
    floorTilesetId: '096',
    altFloorTilesetId: '142',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 12, y: 4, speciesId: 'impidimp', level: 9, nickname: 'Mist Stalker' },
      { x: 14, y: 7, speciesId: 'venipede', level: 9, nickname: 'Fog Ambusher' },
      { x: 16, y: 5, speciesId: 'honedge', level: 10, nickname: 'Cursed Blade' },
    ],
  },
  {
    entry: {
      id: 'chapter_08',
      shortCode: 'Ch. 8',
      label: 'Chapter 8 — Steam Cave',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Steam Cave',
      primaryTilesetId: '110',
      bgmCue: 'steam_cave',
      defaultDeploymentCap: 9,
    },
    wallTilesetId: '110',
    floorTilesetId: '110',
    altFloorTilesetId: '018',
    ascii: STANDARD_20X13_VOLCANIC,
    enemies: [
      { x: 13, y: 4, speciesId: 'rolycoly', level: 10, nickname: 'Magma Sentry' },
      { x: 14, y: 8, speciesId: 'elekid', level: 10, nickname: 'Vent Raider' },
      { x: 17, y: 6, speciesId: 'carkol', level: 11, nickname: 'Boss Carkol' },
    ],
  },
  {
    entry: {
      id: 'chapter_09',
      shortCode: 'Ch. 9',
      label: 'Chapter 9 — Amp Plains',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Amp Plains',
      primaryTilesetId: '036',
      bgmCue: 'amp_plains',
      defaultDeploymentCap: 9,
    },
    wallTilesetId: '042',
    floorTilesetId: '142',
    altFloorTilesetId: '120',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 12, y: 3, speciesId: 'tynamo', level: 11, nickname: 'Plains Spark' },
      { x: 14, y: 8, speciesId: 'elekid', level: 11, nickname: 'Storm Raider' },
      { x: 17, y: 5, speciesId: 'gothorita', level: 12, nickname: 'Saboteur Gothorita' },
    ],
  },
  {
    entry: {
      id: 'chapter_10',
      shortCode: 'Ch. 10',
      label: 'Chapter 10 — Northern Desert',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Northern Desert',
      primaryTilesetId: '017',
      bgmCue: 'craggy_coast',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '017',
    floorTilesetId: '017',
    altFloorTilesetId: '085',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'sandile', level: 12, nickname: 'Dune Stalker' },
      { x: 14, y: 8, speciesId: 'skarmory', level: 12, nickname: 'Iron Wing' },
      { x: 17, y: 6, speciesId: 'krokorok', level: 13, nickname: 'Boss Krokorok' },
    ],
  },
  {
    entry: {
      id: 'chapter_11',
      shortCode: 'Ch. 11',
      label: 'Chapter 11 — Quicksand Cave',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Quicksand Cave',
      primaryTilesetId: '085',
      bgmCue: 'depths_of_the_pit',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '085',
    floorTilesetId: '085',
    altFloorTilesetId: '017',
    ascii: STANDARD_22X14_ABYSS,
    enemies: [
      { x: 14, y: 4, speciesId: 'krokorok', level: 13, nickname: 'Sand Sapper' },
      { x: 15, y: 9, speciesId: 'haunter', level: 14, nickname: 'Shadow Assassin' },
      { x: 18, y: 6, speciesId: 'morgrem', level: 14, nickname: 'Cabal Captain' },
    ],
  },
  {
    entry: {
      id: 'chapter_12',
      shortCode: 'Ch. 12',
      label: 'Chapter 12 — Crystal Cave',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Crystal Cave',
      primaryTilesetId: '080',
      bgmCue: 'cave_and_side_path',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '080',
    floorTilesetId: '080',
    altFloorTilesetId: '082',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'honedge', level: 14, nickname: 'Prism Guard' },
      { x: 14, y: 9, speciesId: 'lairon', level: 15, nickname: 'Crystal Warden' },
      { x: 17, y: 6, speciesId: 'doublade', level: 16, nickname: 'Boss Doublade' },
    ],
  },
  {
    entry: {
      id: 'chapter_13',
      shortCode: 'Ch. 13',
      label: 'Chapter 13 — Crystal Crossing',
      group: 'act2',
      groupLabel: 'Act 2',
      biomeName: 'Crystal Crossing',
      primaryTilesetId: '025',
      bgmCue: 'boss_battle',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '025',
    floorTilesetId: '025',
    altFloorTilesetId: '079',
    waterTilesetId: '082',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 11, y: 4, speciesId: 'sealeo', level: 15, nickname: 'Frost Guard' },
      { x: 13, y: 8, speciesId: 'bisharp', level: 16, nickname: 'Imperial Blade' },
      { x: 15, y: 6, speciesId: 'krookodile', level: 17, nickname: 'General Krookodile' },
    ],
  },

  // --- ACT 3: Chapters 14 - 20 ---
  {
    entry: {
      id: 'chapter_14',
      shortCode: 'Ch. 14',
      label: 'Chapter 14 — Chasm Cave',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Chasm Cave',
      primaryTilesetId: '026',
      bgmCue: 'depths_of_the_pit',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '026',
    floorTilesetId: '026',
    altFloorTilesetId: '027',
    ascii: STANDARD_22X14_ABYSS,
    enemies: [
      { x: 14, y: 4, speciesId: 'golbat', level: 17, nickname: 'Abyss Wing' },
      { x: 16, y: 9, speciesId: 'corvisquire', level: 17, nickname: 'Bridge Guard' },
      { x: 18, y: 6, speciesId: 'skarmory', level: 18, nickname: 'Chasm Warden' },
    ],
  },
  {
    entry: {
      id: 'chapter_15',
      shortCode: 'Ch. 15',
      label: 'Chapter 15 — Dark Hill',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Dark Hill',
      primaryTilesetId: '064',
      bgmCue: 'growing_anxiety',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '064',
    floorTilesetId: '064',
    altFloorTilesetId: '061',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'haunter', level: 18, nickname: 'Feral Phantom' },
      { x: 15, y: 8, speciesId: 'morgrem', level: 18, nickname: 'Night Stalker' },
      { x: 17, y: 6, speciesId: 'gothitelle', level: 19, nickname: 'Oracle Gothitelle' },
    ],
  },
  {
    entry: {
      id: 'chapter_16',
      shortCode: 'Ch. 16',
      label: 'Chapter 16 — Sealed Ruin',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Sealed Ruin',
      primaryTilesetId: '050',
      bgmCue: 'time_gear_remix',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '050',
    floorTilesetId: '050',
    altFloorTilesetId: '138',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 3, speciesId: 'spiritomb', level: 19, nickname: 'Bound Wraith' },
      { x: 15, y: 9, speciesId: 'doublade', level: 20, nickname: 'Ruin Executioner' },
      { x: 17, y: 6, speciesId: 'bisharp', level: 20, nickname: 'Seal Breaker' },
    ],
  },
  {
    entry: {
      id: 'chapter_17',
      shortCode: 'Ch. 17',
      label: 'Chapter 17 — Dusk Forest',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Dusk Forest',
      primaryTilesetId: '020',
      bgmCue: 'foggy_forest',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '020',
    floorTilesetId: '020',
    altFloorTilesetId: '096',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 13, y: 4, speciesId: 'lairon', level: 20, nickname: 'Ironclad Veteran' },
      { x: 15, y: 8, speciesId: 'gurdurr', level: 20, nickname: 'Crag Breaker' },
      { x: 17, y: 6, speciesId: 'aggron', level: 21, nickname: 'Warlord Aggron' },
    ],
  },
  {
    entry: {
      id: 'chapter_18',
      shortCode: 'Ch. 18',
      label: 'Chapter 18 — Treeshroud Forest',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Treeshroud Forest',
      primaryTilesetId: '068',
      bgmCue: 'boss_battle',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '068',
    floorTilesetId: '068',
    altFloorTilesetId: '020',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 13, y: 4, speciesId: 'shiftry', level: 21, nickname: 'Canopy Stalker' },
      { x: 15, y: 8, speciesId: 'scolipede', level: 21, nickname: 'Venom Lancer' },
      { x: 17, y: 6, speciesId: 'coalossal', level: 22, nickname: 'Warden Coalossal' },
    ],
  },
  {
    entry: {
      id: 'chapter_19',
      shortCode: 'Ch. 19',
      label: 'Chapter 19 — Brine Cave',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Brine Cave',
      primaryTilesetId: '108',
      bgmCue: 'waterfall_cave',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '108',
    floorTilesetId: '108',
    altFloorTilesetId: '016',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 11, y: 4, speciesId: 'walrein', level: 22, nickname: 'Fleet Bastion' },
      { x: 13, y: 8, speciesId: 'eelektross', level: 22, nickname: 'Brine Eel' },
      { x: 15, y: 6, speciesId: 'obstagoon', level: 23, nickname: 'Port Admiral' },
    ],
  },
  {
    entry: {
      id: 'chapter_20',
      shortCode: 'Ch. 20',
      label: 'Chapter 20 — Blizzard Island',
      group: 'act3',
      groupLabel: 'Act 3',
      biomeName: 'Blizzard Island',
      primaryTilesetId: '079',
      bgmCue: 'boss_battle',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '079',
    floorTilesetId: '079',
    altFloorTilesetId: '143',
    ascii: STANDARD_22X14_ABYSS,
    enemies: [
      { x: 14, y: 4, speciesId: 'walrein', level: 23, nickname: 'Glacier Guard' },
      { x: 16, y: 9, speciesId: 'grimmsnarl', level: 23, nickname: 'Cabal Enforcer' },
      { x: 18, y: 6, speciesId: 'gothitelle', level: 24, nickname: 'Grand Oracle Gothitelle' },
    ],
  },

  // --- ACT 4: Chapters 21 - 25 ---
  {
    entry: {
      id: 'chapter_21',
      shortCode: 'Ch. 21',
      label: 'Chapter 21 — Miracle Sea',
      group: 'act4',
      groupLabel: 'Act 4',
      biomeName: 'Miracle Sea',
      primaryTilesetId: '082',
      bgmCue: 'craggy_coast',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '082',
    floorTilesetId: '082',
    altFloorTilesetId: '075',
    waterTilesetId: '082',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 11, y: 4, speciesId: 'crobat', level: 24, nickname: 'Sea Interceptor' },
      { x: 13, y: 8, speciesId: 'electivire', level: 25, nickname: 'Deck Dynamo' },
      { x: 15, y: 6, speciesId: 'corviknight', level: 26, nickname: 'Marshal Corviknight' },
    ],
  },
  {
    entry: {
      id: 'chapter_22',
      shortCode: 'Ch. 22',
      label: 'Chapter 22 — Aegis Cave',
      group: 'act4',
      groupLabel: 'Act 4',
      biomeName: 'Aegis Cave',
      primaryTilesetId: '138',
      bgmCue: 'depths_of_the_pit',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '138',
    floorTilesetId: '138',
    altFloorTilesetId: '050',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'aggron', level: 26, nickname: 'Armor Remnant' },
      { x: 15, y: 9, speciesId: 'conkeldurr', level: 26, nickname: 'Gate Pillar' },
      { x: 17, y: 6, speciesId: 'coalossal', level: 27, nickname: 'Siege Warden Coalossal' },
    ],
  },
  {
    entry: {
      id: 'chapter_23',
      shortCode: 'Ch. 23',
      label: 'Chapter 23 — Dark Crater',
      group: 'act4',
      groupLabel: 'Act 4',
      biomeName: 'Dark Crater',
      primaryTilesetId: '112',
      bgmCue: 'monster_house',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '112',
    floorTilesetId: '112',
    altFloorTilesetId: '110',
    ascii: STANDARD_20X13_VOLCANIC,
    enemies: [
      { x: 13, y: 4, speciesId: 'spiritomb', level: 27, nickname: 'Rift Keeper' },
      { x: 15, y: 9, speciesId: 'grimmsnarl', level: 27, nickname: 'Abyssal Herald' },
      { x: 17, y: 6, speciesId: 'gengar', level: 28, nickname: 'Tactician Gengar' },
    ],
  },
  {
    entry: {
      id: 'chapter_24',
      shortCode: 'Ch. 24',
      label: 'Chapter 24 — Temporal Spire',
      group: 'act4',
      groupLabel: 'Act 4',
      biomeName: 'Temporal Spire',
      primaryTilesetId: '141',
      bgmCue: 'time_gear_remix',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '141',
    floorTilesetId: '141',
    altFloorTilesetId: '061',
    ascii: STANDARD_22X14_ABYSS,
    enemies: [
      { x: 14, y: 4, speciesId: 'bisharp', level: 28, nickname: 'Royal Honour Guard' },
      { x: 16, y: 9, speciesId: 'bewear', level: 28, nickname: 'Spire Sentinel' },
      { x: 18, y: 6, speciesId: 'aegislash', level: 29, nickname: 'Protector Aegislash' },
    ],
  },
  {
    entry: {
      id: 'chapter_25',
      shortCode: 'Ch. 25',
      label: 'Chapter 25 — Throne Pinnacle',
      group: 'act4',
      groupLabel: 'Act 4',
      biomeName: 'Sky Peak Pinnacle',
      primaryTilesetId: '061',
      bgmCue: 'boss_battle',
      defaultDeploymentCap: 12,
    },
    wallTilesetId: '141',
    floorTilesetId: '061',
    altFloorTilesetId: '141',
    ascii: STANDARD_22X14_ABYSS,
    enemies: [
      { x: 15, y: 4, speciesId: 'corviknight', level: 29, nickname: 'Imperial Wing' },
      { x: 15, y: 9, speciesId: 'aegislash', level: 29, nickname: 'Throne Shield' },
      { x: 19, y: 6, speciesId: 'kingambit', level: 30, nickname: 'Emperor Kingambit' },
    ],
  },

  // --- PARALOGUES 1 - 6 ---
  {
    entry: {
      id: 'paralogue_01',
      shortCode: 'Para. 1',
      label: 'Paralogue 1 — Lush Prairie (Slakoth)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Lush Prairie',
      primaryTilesetId: '142',
      bgmCue: 'apple_woods',
      defaultDeploymentCap: 6,
    },
    wallTilesetId: '042',
    floorTilesetId: '142',
    altFloorTilesetId: '120',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 13, y: 4, speciesId: 'zigzagoon_galar', level: 5, nickname: 'Prairie Bandit' },
      { x: 15, y: 8, speciesId: 'stufful', level: 5, nickname: 'Feral Bruiser' },
    ],
  },
  {
    entry: {
      id: 'paralogue_02',
      shortCode: 'Para. 2',
      label: 'Paralogue 2 — Oran Forest (Eevee & Kecleon)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Oran Forest',
      primaryTilesetId: '120',
      bgmCue: 'kecleon_shop',
      defaultDeploymentCap: 8,
    },
    wallTilesetId: '120',
    floorTilesetId: '120',
    altFloorTilesetId: '142',
    ascii: STANDARD_20X12_WOODLAND,
    enemies: [
      { x: 13, y: 4, speciesId: 'croagunk', level: 8, nickname: 'Shrine Poacher' },
      { x: 16, y: 7, speciesId: 'pawniard', level: 9, nickname: 'Caravan Captor' },
    ],
  },
  {
    entry: {
      id: 'paralogue_03',
      shortCode: 'Para. 3',
      label: 'Paralogue 3 — Serenity River (Twin Horns)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Serenity River',
      primaryTilesetId: '075',
      bgmCue: 'waterfall_cave',
      defaultDeploymentCap: 9,
    },
    wallTilesetId: '075',
    floorTilesetId: '075',
    altFloorTilesetId: '142',
    waterTilesetId: '075',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      { x: 11, y: 4, speciesId: 'toxicroak', level: 11, nickname: 'River Hunter' },
      { x: 14, y: 7, speciesId: 'linoone_galar', level: 11, nickname: 'Bank Outrider' },
    ],
  },
  {
    entry: {
      id: 'paralogue_04',
      shortCode: 'Para. 4',
      label: 'Paralogue 4 — Labyrinth Cave (Teddiursa)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Labyrinth Cave',
      primaryTilesetId: '072',
      bgmCue: 'cave_and_side_path',
      defaultDeploymentCap: 10,
    },
    wallTilesetId: '072',
    floorTilesetId: '072',
    altFloorTilesetId: '014',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'aron', level: 13, nickname: 'Pass Blocker' },
      { x: 16, y: 7, speciesId: 'lairon', level: 14, nickname: 'Raider Captain' },
    ],
  },
  {
    entry: {
      id: 'paralogue_05',
      shortCode: 'Para. 5',
      label: 'Paralogue 5 — Mt. Travail (Hoppip)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Mt. Travail',
      primaryTilesetId: '143',
      bgmCue: 'mt_horn',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '143',
    floorTilesetId: '143',
    altFloorTilesetId: '014',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 13, y: 4, speciesId: 'golbat', level: 18, nickname: 'Gale Rider' },
      { x: 16, y: 7, speciesId: 'corvisquire', level: 19, nickname: 'Peak Talon' },
    ],
  },
  {
    entry: {
      id: 'paralogue_06',
      shortCode: 'Para. 6',
      label: 'Paralogue 6 — Concealed Ruins (Defecting Gastly)',
      group: 'paralogue',
      groupLabel: 'Paralogues',
      biomeName: 'Concealed Ruins',
      primaryTilesetId: '050',
      bgmCue: 'growing_anxiety',
      defaultDeploymentCap: 11,
    },
    wallTilesetId: '050',
    floorTilesetId: '050',
    altFloorTilesetId: '064',
    ascii: STANDARD_20X13_FORTRESS,
    enemies: [
      { x: 12, y: 5, speciesId: 'gastly', level: 18, nickname: 'Defecting Gastly' },
      { x: 16, y: 4, speciesId: 'doublade', level: 21, nickname: 'Ruin Warden' },
      { x: 17, y: 8, speciesId: 'bisharp', level: 22, nickname: 'Inquisitor Blade' },
    ],
  },
];

export const CHAPTER_LEVEL_CATALOG: ReadonlyArray<ChapterLevelCatalogEntry> = [
  {
    id: 'drenched_bluff_vanguard',
    shortCode: 'Test 1',
    label: 'Drenched Bluff (Test Dungeon)',
    group: 'test',
    groupLabel: 'Test & Sandbox',
    biomeName: 'Drenched Bluff / Lush Stream',
    primaryTilesetId: '003',
    bgmCue: 'drenched_bluff',
    defaultDeploymentCap: 3,
  },
  {
    id: 'skirmish_test_convergence',
    shortCode: 'Test 2',
    label: 'Convergence Ruins (Skirmish Sandbox)',
    group: 'test',
    groupLabel: 'Test & Sandbox',
    biomeName: 'Multi-Biome Sandbox',
    primaryTilesetId: '142',
    bgmCue: 'apple_woods',
    defaultDeploymentCap: 3,
  },
  ...GENERATED_CHAPTER_SPECS.map((s) => s.entry),
];

const catalogById = new Map<string, ChapterLevelCatalogEntry>();
for (const entry of CHAPTER_LEVEL_CATALOG) {
  catalogById.set(entry.id, entry);
}

const generatedSpecById = new Map<string, GeneratedChapterSpec>();
for (const spec of GENERATED_CHAPTER_SPECS) {
  generatedSpecById.set(spec.entry.id, spec);
}

export function getChapterCatalogEntry(levelId: string): ChapterLevelCatalogEntry | undefined {
  return catalogById.get(levelId);
}

export function getDefaultChapterMap(levelId: string): DungeonMapDefinition {
  if (levelId === 'drenched_bluff_vanguard') {
    return createPlayableVanguardBattleMap();
  }
  if (levelId === 'skirmish_test_convergence') {
    return createDefaultTestDungeonMap();
  }
  const spec = generatedSpecById.get(levelId);
  if (spec) {
    return buildGeneratedChapterMap(spec);
  }
  return createPlayableVanguardBattleMap();
}

const VALID_TERRAIN_SET = new Set<string>(TERRAIN_TYPES);

export function validateDungeonMapDefinition(
  candidate: unknown,
  expectedLevelId?: string
): { valid: boolean; errors: string[]; map?: DungeonMapDefinition } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Map payload must be a JSON object.'] };
  }

  const raw = candidate as Partial<DungeonMapDefinition>;
  const resolvedId = (expectedLevelId ?? raw.id ?? '').trim();
  if (!resolvedId) {
    errors.push('Map is missing an id.');
  }

  const width = Number(raw.width);
  const height = Number(raw.height);
  if (!Number.isInteger(width) || width < 8 || width > 40) {
    errors.push(`Map width (${String(raw.width)}) must be an integer between 8 and 40.`);
  }
  if (!Number.isInteger(height) || height < 8 || height > 32) {
    errors.push(`Map height (${String(raw.height)}) must be an integer between 8 and 32.`);
  }

  if (!Array.isArray(raw.tiles) || raw.tiles.length !== height) {
    errors.push(`Map tiles array must have ${height} rows.`);
  }

  const normalizedTiles: DungeonMapTileCell[][] = [];
  if (Array.isArray(raw.tiles) && errors.length === 0) {
    for (let y = 0; y < height; y++) {
      const row = raw.tiles[y];
      if (!Array.isArray(row) || row.length !== width) {
        errors.push(`Row y=${y} must have exactly ${width} tile cells.`);
        break;
      }
      const normRow: DungeonMapTileCell[] = [];
      for (let x = 0; x < width; x++) {
        const cell = row[x] as Partial<DungeonMapTileCell> | undefined;
        if (!cell || typeof cell !== 'object') {
          errors.push(`Tile (${x},${y}) is not an object.`);
          break;
        }
        if (!cell.terrainType || !VALID_TERRAIN_SET.has(cell.terrainType)) {
          errors.push(`Tile (${x},${y}) has invalid terrainType "${String(cell.terrainType)}".`);
          break;
        }
        const tilesetId = normalizeTilesetId(String(cell.tilesetId ?? '142'));
        const chunkIndex = Math.max(0, Math.min(399, Math.floor(Number(cell.chunkIndex ?? 1))));
        normRow.push({
          terrainType: cell.terrainType as TerrainType,
          tilesetId,
          chunkIndex,
        });
      }
      normalizedTiles.push(normRow);
      if (errors.length > 0) break;
    }
  }

  const normPlayerSpawns: DungeonUnitSpawn[] = [];
  if (!Array.isArray(raw.playerSpawns) || raw.playerSpawns.length < 1) {
    errors.push('Map must define at least 1 blue player starting spawn.');
  } else if (errors.length === 0) {
    for (const sp of raw.playerSpawns) {
      const x = Math.floor(Number(sp?.x));
      const y = Math.floor(Number(sp?.y));
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
        errors.push(`Player spawn (${String(sp?.x)},${String(sp?.y)}) is out of map bounds.`);
        continue;
      }
      const speciesId = String(sp?.speciesId || 'dratini');
      const def = getSpeciesById(speciesId);
      if (!def || def.faction === 'enemy') {
        errors.push(`Player spawn species "${speciesId}" is unknown or enemy-only.`);
        continue;
      }
      normPlayerSpawns.push({
        x,
        y,
        speciesId: def.id,
        level: Math.max(1, Math.min(40, Math.floor(Number(sp?.level ?? 1)))),
        nickname: sp?.nickname ? String(sp.nickname).slice(0, 16) : def.name,
        heldItemId: sp?.heldItemId ?? null,
      });
    }
  }

  const normEnemySpawns: DungeonUnitSpawn[] = [];
  if (!Array.isArray(raw.enemySpawns) || raw.enemySpawns.length < 1) {
    errors.push('Map must define at least 1 enemy spawn.');
  } else if (errors.length === 0) {
    for (const sp of raw.enemySpawns) {
      const x = Math.floor(Number(sp?.x));
      const y = Math.floor(Number(sp?.y));
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
        errors.push(`Enemy spawn (${String(sp?.x)},${String(sp?.y)}) is out of map bounds.`);
        continue;
      }
      const speciesId = String(sp?.speciesId || 'zigzagoon_galar');
      const def = getSpeciesById(speciesId);
      // Rule 5: Enemy spawns must come from enemy lines (or shared_paralogue6 Gastly line)
      if (!def || def.faction === 'playable') {
        errors.push(
          `Rule 5: Enemy spawn species "${speciesId}" must be an enemy faction species.`
        );
        continue;
      }
      normEnemySpawns.push({
        x,
        y,
        speciesId: def.id,
        level: Math.max(1, Math.min(40, Math.floor(Number(sp?.level ?? 1)))),
        nickname: sp?.nickname ? String(sp.nickname).slice(0, 22) : def.name,
        heldItemId: sp?.heldItemId ?? null,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const catalogMeta = getChapterCatalogEntry(resolvedId);
  const rawCap =
    raw.deploymentCap !== undefined
      ? Math.floor(Number(raw.deploymentCap))
      : (catalogMeta?.defaultDeploymentCap ?? normPlayerSpawns.length);
  const deploymentCap = Math.max(1, Math.min(12, Math.min(rawCap, normPlayerSpawns.length)));

  return {
    valid: true,
    errors: [],
    map: {
      id: resolvedId,
      name: String(raw.name || catalogMeta?.label || resolvedId),
      bgmCue: raw.bgmCue ? String(raw.bgmCue) : catalogMeta?.bgmCue,
      deploymentCap,
      width,
      height,
      tiles: normalizedTiles,
      playerSpawns: normPlayerSpawns,
      enemySpawns: normEnemySpawns,
    },
  };
}

type MapStoreListener = (changedLevelId: string | null) => void;

class ChapterMapOverrideStore {
  private overrides = new Map<string, CustomMapOverrideEntry>();
  private readonly listeners = new Set<MapStoreListener>();
  private loadedFromStorage = false;

  private ensureLoaded(): void {
    if (this.loadedFromStorage) return;
    this.loadedFromStorage = true;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(MAP_OVERRIDES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CustomMapOverrideEntry>;
      if (!parsed || typeof parsed !== 'object') return;
      for (const [levelId, entry] of Object.entries(parsed)) {
        if (!entry || typeof entry !== 'object') continue;
        const v = validateDungeonMapDefinition(entry.map, levelId);
        if (v.valid && v.map) {
          this.overrides.set(levelId, {
            map: v.map,
            updatedAt:
              typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
                ? entry.updatedAt
                : Date.now(),
          });
        }
      }
    } catch {
      // Ignore malformed storage entries safely
    }
  }

  private persistToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (this.overrides.size === 0) {
        window.localStorage.removeItem(MAP_OVERRIDES_STORAGE_KEY);
        return;
      }
      const serializable: Record<string, CustomMapOverrideEntry> = {};
      for (const [id, entry] of this.overrides.entries()) {
        serializable[id] = {
          map: cloneDungeonMap(entry.map),
          updatedAt: entry.updatedAt,
        };
      }
      window.localStorage.setItem(MAP_OVERRIDES_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // Quota or sandbox fallback
    }
  }

  private emit(changedLevelId: string | null): void {
    for (const fn of this.listeners) {
      fn(changedLevelId);
    }
  }

  public reloadFromLocalStorage(): void {
    this.loadedFromStorage = false;
    this.overrides.clear();
    this.ensureLoaded();
    this.emit(null);
  }

  public hasOverride(levelId: string): boolean {
    this.ensureLoaded();
    return this.overrides.has(levelId);
  }

  public getOverrideEntry(levelId: string): CustomMapOverrideEntry | null {
    this.ensureLoaded();
    const found = this.overrides.get(levelId);
    return found ? { map: cloneDungeonMap(found.map), updatedAt: found.updatedAt } : null;
  }

  public getEffectiveMap(levelId: string): DungeonMapDefinition {
    this.ensureLoaded();
    const override = this.overrides.get(levelId);
    if (override) {
      return cloneDungeonMap(override.map);
    }
    return cloneDungeonMap(getDefaultChapterMap(levelId));
  }

  public getAllOverridesRecord(): Record<string, CustomMapOverrideEntry> {
    this.ensureLoaded();
    const out: Record<string, CustomMapOverrideEntry> = {};
    for (const [id, entry] of this.overrides.entries()) {
      out[id] = {
        map: cloneDungeonMap(entry.map),
        updatedAt: entry.updatedAt,
      };
    }
    return out;
  }

  public saveOverride(
    levelId: string,
    candidateMap: DungeonMapDefinition,
    updatedAt = Date.now()
  ): DungeonMapDefinition {
    this.ensureLoaded();
    const validation = validateDungeonMapDefinition(candidateMap, levelId);
    if (!validation.valid || !validation.map) {
      throw new Error(`Invalid map for "${levelId}": ${validation.errors.join(' ')}`);
    }
    const storedMap = cloneDungeonMap(validation.map);
    this.overrides.set(levelId, {
      map: storedMap,
      updatedAt,
    });
    this.persistToLocalStorage();
    this.emit(levelId);
    return cloneDungeonMap(storedMap);
  }

  public resetOverride(levelId: string): DungeonMapDefinition {
    this.ensureLoaded();
    const existed = this.overrides.delete(levelId);
    if (existed) {
      this.persistToLocalStorage();
      this.emit(levelId);
    }
    return cloneDungeonMap(getDefaultChapterMap(levelId));
  }

  public resetAllOverrides(): void {
    this.ensureLoaded();
    if (this.overrides.size === 0) return;
    this.overrides.clear();
    this.persistToLocalStorage();
    this.emit(null);
  }

  public mergeFromSaveRecord(incoming: Record<string, CustomMapOverrideEntry> | undefined): boolean {
    if (!incoming || typeof incoming !== 'object') return false;
    this.ensureLoaded();
    let changed = false;
    for (const [levelId, entry] of Object.entries(incoming)) {
      if (!entry || typeof entry !== 'object') continue;
      const incomingTs =
        typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
          ? entry.updatedAt
          : 0;
      const current = this.overrides.get(levelId);
      if (current && current.updatedAt >= incomingTs) continue;
      const v = validateDungeonMapDefinition(entry.map, levelId);
      if (v.valid && v.map) {
        this.overrides.set(levelId, {
          map: v.map,
          updatedAt: incomingTs || Date.now(),
        });
        changed = true;
      }
    }
    if (changed) {
      this.persistToLocalStorage();
      this.emit(null);
    }
    return changed;
  }

  public subscribe(listener: MapStoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const singletonStore = new ChapterMapOverrideStore();

export function hasChapterMapOverride(levelId: string): boolean {
  return singletonStore.hasOverride(levelId);
}

export function getChapterMapOverrideEntry(levelId: string): CustomMapOverrideEntry | null {
  return singletonStore.getOverrideEntry(levelId);
}

export function getEffectiveChapterMap(levelId: string): DungeonMapDefinition {
  return singletonStore.getEffectiveMap(levelId);
}

export function getAllCustomMapOverrides(): Record<string, CustomMapOverrideEntry> {
  return singletonStore.getAllOverridesRecord();
}

export function saveChapterMapOverride(
  levelId: string,
  map: DungeonMapDefinition,
  updatedAt?: number
): DungeonMapDefinition {
  return singletonStore.saveOverride(levelId, map, updatedAt);
}

export function resetChapterMapOverride(levelId: string): DungeonMapDefinition {
  return singletonStore.resetOverride(levelId);
}

export function resetAllChapterMapOverrides(): void {
  singletonStore.resetAllOverrides();
}

export function mergeCustomMapsRecord(
  incoming: Record<string, CustomMapOverrideEntry> | undefined
): boolean {
  return singletonStore.mergeFromSaveRecord(incoming);
}

export function reloadChapterMapsFromStorage(): void {
  singletonStore.reloadFromLocalStorage();
}

export function exportChapterMapJson(levelId: string): string {
  return JSON.stringify(getEffectiveChapterMap(levelId), null, 2);
}

export function importChapterMapJson(
  rawJson: string,
  targetLevelId?: string
): DungeonMapDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Malformed JSON';
    throw new Error(`Could not parse Map JSON: ${msg}`);
  }
  const resolvedId =
    targetLevelId ??
    (parsed && typeof parsed === 'object' && typeof (parsed as { id?: unknown }).id === 'string'
      ? ((parsed as { id: string }).id.trim() || 'drenched_bluff_vanguard')
      : 'drenched_bluff_vanguard');
  return saveChapterMapOverride(resolvedId, parsed as DungeonMapDefinition);
}

export function subscribeChapterMapChanges(
  listener: (changedLevelId: string | null) => void
): () => void {
  return singletonStore.subscribe(listener);
}
