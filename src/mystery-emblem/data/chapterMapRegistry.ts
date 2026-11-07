/**
 * Chapter & Level Map Catalog + Persistent Dev Tools Map Override Store
 *
 * Covers the 5 playable Demo Dungeons:
 * - `prologue`   — Dungeon 1: Beach Cave
 * - `chapter_01` — Dungeon 2: Drenched Bluff
 * - `chapter_02` — Dungeon 3: Mt. Bristle
 * - `chapter_03` — Dungeon 4: Waterfall Cave
 * - `chapter_04` — Dungeon 5: Apple Woods
 *
 * Persists customized maps immediately to `localStorage` (`mystery_emblem_map_overrides_v1`)
 * and syncs via `SaveData.customMaps` / `customMapsEnvelopeJson` to Cloud Firestore (`saves/{uid}`).
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

export const MAP_OVERRIDES_STORAGE_KEY = 'mystery_emblem_map_overrides_v1';

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

export function cloneDungeonMap(map: DungeonMapDefinition): DungeonMapDefinition {
  return {
    id: map.id,
    name: map.name,
    bgmCue: map.bgmCue,
    objectiveType: map.objectiveType,
    deploymentCap: map.deploymentCap,
    width: map.width,
    height: map.height,
    tiles: map.tiles.map((row) => row.map((c) => ({ ...c }))),
    playerSpawns: map.playerSpawns.map((s) => ({ ...s })),
    enemySpawns: map.enemySpawns.map((s) => ({ ...s })),
  };
}

export interface ChapterLevelCatalogEntry {
  id: string;
  shortCode: string;
  label: string;
  biomeName: string;
  primaryTilesetId: string;
  bgmCue: string;
  defaultDeploymentCap: number;
}

interface GeneratedChapterSpec {
  entry: ChapterLevelCatalogEntry;
  objectiveType: 'rout' | 'defeat_boss';
  wallTilesetId: string;
  floorTilesetId: string;
  altFloorTilesetId: string;
  waterTilesetId?: string;
  treeTilesetId?: string;
  mountainTilesetId?: string;
  ascii: ReadonlyArray<string>;
  enemies: ReadonlyArray<DungeonUnitSpawn>;
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

const MT_BRISTLE_20X12_LAYOUT: ReadonlyArray<string> = [
  '####################',
  '#...TT....~~...,,,,#',
  '#.T....S..~~..T,,,S#',
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

const APPLE_WOODS_20X12_LAYOUT: ReadonlyArray<string> = [
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
    tiles[safeY]![safeX] = makeCell('floor', spec.floorTilesetId, 59);
    return {
      x: safeX,
      y: safeY,
      speciesId: s.speciesId,
      level: 9,
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
      ...e,
      x: safeX,
      y: safeY,
      heldItemId: e.heldItemId ?? null,
    };
  });

  return {
    id: spec.entry.id,
    name: spec.entry.label,
    bgmCue: spec.entry.bgmCue,
    objectiveType: spec.objectiveType,
    deploymentCap: cap,
    width,
    height,
    tiles,
    playerSpawns,
    enemySpawns,
  };
}

const DEMO_CHAPTER_SPECS: ReadonlyArray<GeneratedChapterSpec> = [
  {
    entry: {
      id: 'prologue',
      shortCode: 'D1',
      label: 'Dungeon 1 — Beach Cave',
      biomeName: 'Beach Cave',
      primaryTilesetId: '001',
      bgmCue: 'beach_cave',
      defaultDeploymentCap: 3,
    },
    objectiveType: 'rout',
    wallTilesetId: '001',
    floorTilesetId: '001',
    altFloorTilesetId: '108',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      {
        x: 12,
        y: 5,
        speciesId: 'zigzagoon_galar',
        level: 9,
        nickname: 'Coastal Scout',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 12,
        y: 3,
        speciesId: 'impidimp',
        level: 10,
        nickname: 'Treasure Raider',
        droppableItemId: 'evolution_stone',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 13,
        y: 7,
        speciesId: 'pawniard',
        level: 10,
        nickname: 'Ironscale Vanguard',
        aiMode: 'wait_until_in_range',
      },
    ],
  },
  {
    entry: {
      id: 'chapter_01',
      shortCode: 'D2',
      label: 'Dungeon 2 — Drenched Bluff',
      biomeName: 'Drenched Bluff',
      primaryTilesetId: '003',
      bgmCue: 'drenched_bluff',
      defaultDeploymentCap: 5,
    },
    objectiveType: 'defeat_boss',
    wallTilesetId: '003',
    floorTilesetId: '003',
    altFloorTilesetId: '142',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      {
        x: 12,
        y: 4,
        speciesId: 'zigzagoon_galar',
        level: 9,
        nickname: 'Bluff Outrider',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 11,
        y: 7,
        speciesId: 'seedot',
        level: 9,
        nickname: 'Cliff Guerilla',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 13,
        y: 3,
        speciesId: 'rookidee',
        level: 10,
        nickname: 'Bluff Harrier',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 15,
        y: 5,
        speciesId: 'aron',
        level: 11,
        nickname: 'Captain Aron',
        isBoss: true,
        stationary: true,
        droppableItemId: 'oran_berry',
        aiMode: 'stationary',
      },
    ],
  },
  {
    entry: {
      id: 'chapter_02',
      shortCode: 'D3',
      label: 'Dungeon 3 — Mt. Bristle',
      biomeName: 'Mt. Bristle',
      primaryTilesetId: '014',
      bgmCue: 'mt_bristle',
      defaultDeploymentCap: 6,
    },
    objectiveType: 'rout',
    wallTilesetId: '014',
    floorTilesetId: '014',
    altFloorTilesetId: '110',
    mountainTilesetId: '014',
    ascii: MT_BRISTLE_20X12_LAYOUT,
    enemies: [
      {
        x: 12,
        y: 4,
        speciesId: 'rolycoly',
        level: 10,
        nickname: 'Crag Sapper',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 13,
        y: 7,
        speciesId: 'zubat',
        level: 10,
        nickname: 'Peak Flier',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 16,
        y: 5,
        speciesId: 'gothita',
        level: 11,
        nickname: 'Hexer Gothita',
        droppableItemId: 'super_potion',
        aiMode: 'wait_until_in_range',
      },
    ],
  },
  {
    entry: {
      id: 'chapter_03',
      shortCode: 'D4',
      label: 'Dungeon 4 — Waterfall Cave',
      biomeName: 'Waterfall Cave',
      primaryTilesetId: '016',
      bgmCue: 'waterfall_cave',
      defaultDeploymentCap: 6,
    },
    objectiveType: 'rout',
    wallTilesetId: '016',
    floorTilesetId: '016',
    altFloorTilesetId: '075',
    waterTilesetId: '075',
    ascii: STANDARD_18X12_COASTAL,
    enemies: [
      {
        x: 10,
        y: 5,
        speciesId: 'spheal',
        level: 10,
        nickname: 'Falls Guard',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 12,
        y: 3,
        speciesId: 'tynamo',
        level: 10,
        nickname: 'Current Spark',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 13,
        y: 7,
        speciesId: 'croagunk',
        level: 11,
        nickname: 'Cavern Striker',
        droppableItemId: 'protein',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 15,
        y: 5,
        speciesId: 'lairon',
        level: 11,
        nickname: 'Ironclad Warden',
        droppableItemId: 'evolution_stone',
        aiMode: 'wait_until_in_range',
      },
    ],
  },
  {
    entry: {
      id: 'chapter_04',
      shortCode: 'D5',
      label: 'Dungeon 5 — Apple Woods',
      biomeName: 'Apple Woods',
      primaryTilesetId: '042',
      bgmCue: 'apple_woods',
      defaultDeploymentCap: 7,
    },
    objectiveType: 'defeat_boss',
    wallTilesetId: '042',
    floorTilesetId: '042',
    altFloorTilesetId: '142',
    treeTilesetId: '142',
    ascii: APPLE_WOODS_20X12_LAYOUT,
    enemies: [
      {
        x: 12,
        y: 3,
        speciesId: 'seedot',
        level: 11,
        nickname: 'Orchard Ranger',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 13,
        y: 8,
        speciesId: 'venipede',
        level: 11,
        nickname: 'Thicket Lancer',
        droppableItemId: 'sitrus_berry',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 15,
        y: 4,
        speciesId: 'corvisquire',
        level: 11,
        nickname: 'Canopy Captain',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 15,
        y: 7,
        speciesId: 'morgrem',
        level: 11,
        nickname: 'Shadow Envoy',
        aiMode: 'wait_until_in_range',
      },
      {
        x: 17,
        y: 5,
        speciesId: 'nuzleaf',
        level: 12,
        nickname: 'Commander Nuzleaf',
        heldItemId: 'oran_berry',
        isBoss: true,
        stationary: false,
        droppableItemId: 'carbos',
        aiMode: 'wait_until_in_range',
      },
    ],
  },
];

export const CHAPTER_LEVEL_CATALOG: ReadonlyArray<ChapterLevelCatalogEntry> =
  DEMO_CHAPTER_SPECS.map((s) => s.entry);

const catalogById = new Map<string, ChapterLevelCatalogEntry>();
for (const entry of CHAPTER_LEVEL_CATALOG) {
  catalogById.set(entry.id, entry);
}

const generatedSpecById = new Map<string, GeneratedChapterSpec>();
for (const spec of DEMO_CHAPTER_SPECS) {
  generatedSpecById.set(spec.entry.id, spec);
}

export function getChapterCatalogEntry(levelId: string): ChapterLevelCatalogEntry | undefined {
  return catalogById.get(levelId);
}

export function getDefaultChapterMap(levelId: string): DungeonMapDefinition {
  const spec = generatedSpecById.get(levelId) ?? DEMO_CHAPTER_SPECS[0]!;
  return buildGeneratedChapterMap(spec);
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
        ...(sp?.isBoss ? { isBoss: true } : {}),
        ...(sp?.stationary ? { stationary: true } : {}),
        ...(sp?.droppableItemId ? { droppableItemId: String(sp.droppableItemId) } : {}),
        ...(sp?.aiMode ? { aiMode: sp.aiMode } : {}),
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
      ...(raw.objectiveType === 'defeat_boss' || raw.objectiveType === 'rout'
        ? { objectiveType: raw.objectiveType }
        : {}),
      deploymentCap,
      width,
      height,
      tiles: normalizedTiles,
      playerSpawns: normPlayerSpawns,
      enemySpawns: normEnemySpawns,
    },
  };
}

export interface CustomMapsSyncEnvelope {
  version: 2;
  overrides: Record<string, CustomMapOverrideEntry>;
  resets: Record<string, number>;
}

type MapStoreListener = (changedLevelId: string | null) => void;

function normalizeIncomingEnvelope(
  candidate: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
): { overrides: Record<string, CustomMapOverrideEntry>; resets: Record<string, number> } {
  if (!candidate || typeof candidate !== 'object') {
    return { overrides: {}, resets: {} };
  }
  const maybeEnv = candidate as Partial<CustomMapsSyncEnvelope>;
  if (maybeEnv.version === 2 && maybeEnv.overrides && typeof maybeEnv.overrides === 'object') {
    const cleanResets: Record<string, number> = {};
    if (maybeEnv.resets && typeof maybeEnv.resets === 'object') {
      for (const [id, ts] of Object.entries(maybeEnv.resets)) {
        if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
          cleanResets[id] = ts;
        }
      }
    }
    return {
      overrides: maybeEnv.overrides,
      resets: cleanResets,
    };
  }
  return {
    overrides: candidate as Record<string, CustomMapOverrideEntry>,
    resets: {},
  };
}

class ChapterMapOverrideStore {
  private overrides = new Map<string, CustomMapOverrideEntry>();
  private resets = new Map<string, number>();
  private readonly listeners = new Set<MapStoreListener>();
  private loadedFromStorage = false;
  private lastStamp = 0;

  private nextMonotonicTimestamp(requested?: number): number {
    const base =
      typeof requested === 'number' && Number.isFinite(requested) && requested > 0
        ? requested
        : Date.now();
    this.lastStamp = Math.max(base, this.lastStamp + 1);
    return this.lastStamp;
  }

  private ensureLoaded(): void {
    if (this.loadedFromStorage) return;
    this.loadedFromStorage = true;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(MAP_OVERRIDES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const { overrides, resets } = normalizeIncomingEnvelope(
        parsed as CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry>
      );
      for (const [levelId, resetTs] of Object.entries(resets)) {
        this.resets.set(levelId, resetTs);
        if (resetTs > this.lastStamp) this.lastStamp = resetTs;
      }
      for (const [levelId, entry] of Object.entries(overrides)) {
        if (!entry || typeof entry !== 'object') continue;
        const ts =
          typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt) && entry.updatedAt > 0
            ? entry.updatedAt
            : Date.now();
        const resetTs = this.resets.get(levelId) ?? 0;
        if (resetTs >= ts) continue;
        const v = validateDungeonMapDefinition(entry.map, levelId);
        if (v.valid && v.map) {
          this.overrides.set(levelId, {
            map: v.map,
            updatedAt: ts,
          });
          this.resets.delete(levelId);
          if (ts > this.lastStamp) this.lastStamp = ts;
        }
      }
    } catch {
      // Ignore malformed storage entries safely
    }
  }

  private persistToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (this.overrides.size === 0 && this.resets.size === 0) {
        window.localStorage.removeItem(MAP_OVERRIDES_STORAGE_KEY);
        return;
      }
      const envelope = this.getSyncEnvelope();
      window.localStorage.setItem(MAP_OVERRIDES_STORAGE_KEY, JSON.stringify(envelope));
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
    this.resets.clear();
    this.ensureLoaded();
    this.emit(null);
  }

  public hasOverride(levelId: string): boolean {
    this.ensureLoaded();
    return this.overrides.has(levelId);
  }

  public hasAnySyncState(): boolean {
    this.ensureLoaded();
    return this.overrides.size > 0 || this.resets.size > 0;
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

  public getSyncEnvelope(): CustomMapsSyncEnvelope {
    this.ensureLoaded();
    const overrides = this.getAllOverridesRecord();
    const resets: Record<string, number> = {};
    for (const [id, ts] of this.resets.entries()) {
      resets[id] = ts;
    }
    return {
      version: 2,
      overrides,
      resets,
    };
  }

  public saveOverride(
    levelId: string,
    candidateMap: DungeonMapDefinition,
    updatedAt?: number
  ): DungeonMapDefinition {
    this.ensureLoaded();
    const validation = validateDungeonMapDefinition(candidateMap, levelId);
    if (!validation.valid || !validation.map) {
      throw new Error(`Invalid map for "${levelId}": ${validation.errors.join(' ')}`);
    }
    const stamp = this.nextMonotonicTimestamp(updatedAt);
    const storedMap = cloneDungeonMap(validation.map);
    this.overrides.set(levelId, {
      map: storedMap,
      updatedAt: stamp,
    });
    this.resets.delete(levelId);
    this.persistToLocalStorage();
    this.emit(levelId);
    return cloneDungeonMap(storedMap);
  }

  public resetOverride(levelId: string, resetAt?: number): DungeonMapDefinition {
    this.ensureLoaded();
    const existed = this.overrides.delete(levelId);
    const prevReset = this.resets.get(levelId) ?? 0;
    if (existed || resetAt !== undefined || prevReset === 0) {
      const stamp = this.nextMonotonicTimestamp(resetAt);
      this.resets.set(levelId, stamp);
      this.persistToLocalStorage();
      if (existed) {
        this.emit(levelId);
      }
    }
    return cloneDungeonMap(getDefaultChapterMap(levelId));
  }

  public resetAllOverrides(clearResetsToo = false): void {
    this.ensureLoaded();
    if (clearResetsToo) {
      const hadAny = this.overrides.size > 0 || this.resets.size > 0;
      this.overrides.clear();
      this.resets.clear();
      this.persistToLocalStorage();
      if (hadAny) this.emit(null);
      return;
    }
    if (this.overrides.size === 0) return;
    const stamp = this.nextMonotonicTimestamp();
    for (const id of this.overrides.keys()) {
      this.resets.set(id, stamp);
    }
    this.overrides.clear();
    this.persistToLocalStorage();
    this.emit(null);
  }

  public mergeFromSaveRecord(incoming: Record<string, CustomMapOverrideEntry> | undefined): boolean {
    if (!incoming || typeof incoming !== 'object') return false;
    return this.reconcileEnvelope(incoming).localChanged;
  }

  public reconcileEnvelope(
    incoming: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
  ): { localChanged: boolean; cloudOutdated: boolean } {
    this.ensureLoaded();
    const { overrides: incOverrides, resets: incResets } = normalizeIncomingEnvelope(incoming);
    const allIds = new Set<string>([
      ...this.overrides.keys(),
      ...this.resets.keys(),
      ...Object.keys(incOverrides),
      ...Object.keys(incResets),
    ]);

    let localChanged = false;
    let cloudOutdated = false;

    for (const levelId of allIds) {
      const localOv = this.overrides.get(levelId);
      const localOvTs = localOv?.updatedAt ?? 0;
      const localResetTs = this.resets.get(levelId) ?? 0;
      const localKind: 'override' | 'reset' | 'none' =
        localResetTs >= localOvTs && localResetTs > 0
          ? 'reset'
          : localOv
            ? 'override'
            : 'none';
      const localStateTs = localKind === 'reset' ? localResetTs : localOvTs;

      const rawIncOv = incOverrides[levelId];
      let validIncMap: DungeonMapDefinition | null = null;
      let incOvTs = 0;
      if (rawIncOv && typeof rawIncOv === 'object') {
        const v = validateDungeonMapDefinition(rawIncOv.map, levelId);
        if (v.valid && v.map) {
          validIncMap = v.map;
          incOvTs =
            typeof rawIncOv.updatedAt === 'number' &&
            Number.isFinite(rawIncOv.updatedAt) &&
            rawIncOv.updatedAt > 0
              ? rawIncOv.updatedAt
              : 1;
        }
      }
      const incResetTs = incResets[levelId] ?? 0;
      const incKind: 'override' | 'reset' | 'none' =
        incResetTs >= incOvTs && incResetTs > 0
          ? 'reset'
          : validIncMap
            ? 'override'
            : 'none';
      const incStateTs = incKind === 'reset' ? incResetTs : incOvTs;

      if (incStateTs > localStateTs) {
        if (incKind === 'reset') {
          const hadOv = this.overrides.delete(levelId);
          this.resets.set(levelId, incResetTs);
          if (incResetTs > this.lastStamp) this.lastStamp = incResetTs;
          if (hadOv || localResetTs !== incResetTs) localChanged = true;
        } else if (incKind === 'override' && validIncMap) {
          this.overrides.set(levelId, {
            map: validIncMap,
            updatedAt: incOvTs,
          });
          this.resets.delete(levelId);
          if (incOvTs > this.lastStamp) this.lastStamp = incOvTs;
          localChanged = true;
        }
      } else if (localStateTs > incStateTs) {
        cloudOutdated = true;
      } else if (localStateTs > 0 && localKind !== incKind) {
        if (incKind === 'reset') {
          this.overrides.delete(levelId);
          this.resets.set(levelId, incResetTs);
          localChanged = true;
        } else if (localKind === 'reset') {
          cloudOutdated = true;
        }
      }
    }

    if (localChanged) {
      this.persistToLocalStorage();
      this.emit(null);
    }

    return { localChanged, cloudOutdated };
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

export function hasAnyCustomMapSyncState(): boolean {
  return singletonStore.hasAnySyncState();
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

export function getCustomMapsSyncEnvelope(): CustomMapsSyncEnvelope {
  return singletonStore.getSyncEnvelope();
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

export function resetAllChapterMapOverrides(clearResetsToo = false): void {
  singletonStore.resetAllOverrides(clearResetsToo);
}

export function mergeCustomMapsRecord(
  incoming: Record<string, CustomMapOverrideEntry> | undefined
): boolean {
  return singletonStore.mergeFromSaveRecord(incoming);
}

export function reconcileCustomMapsEnvelope(
  incoming: CustomMapsSyncEnvelope | Record<string, CustomMapOverrideEntry> | null | undefined
): { localChanged: boolean; cloudOutdated: boolean } {
  return singletonStore.reconcileEnvelope(incoming);
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
      ? ((parsed as { id: string }).id.trim() || 'prologue')
      : 'prologue');
  return saveChapterMapOverride(resolvedId, parsed as DungeonMapDefinition);
}

export function subscribeChapterMapChanges(
  listener: (changedLevelId: string | null) => void
): () => void {
  return singletonStore.subscribe(listener);
}
