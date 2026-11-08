/**
 * Chapter & Level Map Catalog + Persistent Dev Tools Map Override Store
 *
 * Covers the 5 playable Demo Chapters:
 * - `prologue`   — Chapter 1: Western Beach
 * - `chapter_01` — Chapter 2: Verdant Bluff
 * - `chapter_02` — Chapter 3: Cleft Mountain
 * - `chapter_03` — Chapter 4: River Shrine
 * - `chapter_04` — Chapter 5: Berry Orchards
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
import map1Raw from './maps/map1.json';
import map2Raw from './maps/map2.json';
import map3Raw from './maps/map3.json';
import map4Raw from './maps/map4.json';
import map5Raw from './maps/map5.json';

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

export const CHAPTER_LEVEL_CATALOG: ReadonlyArray<ChapterLevelCatalogEntry> = [
  {
    id: 'prologue',
    shortCode: 'Ch. 1',
    label: 'Chapter 1 — Western Beach',
    biomeName: 'Western Beach',
    primaryTilesetId: '002',
    bgmCue: 'beach_cave',
    defaultDeploymentCap: 3,
  },
  {
    id: 'chapter_01',
    shortCode: 'Ch. 2',
    label: 'Chapter 2 — Verdant Bluff',
    biomeName: 'Verdant Bluff',
    primaryTilesetId: '003',
    bgmCue: 'drenched_bluff',
    defaultDeploymentCap: 5,
  },
  {
    id: 'chapter_02',
    shortCode: 'Ch. 3',
    label: 'Chapter 3 — Cleft Mountain',
    biomeName: 'Cleft Mountain',
    primaryTilesetId: '014',
    bgmCue: 'mt_bristle',
    defaultDeploymentCap: 6,
  },
  {
    id: 'chapter_03',
    shortCode: 'Ch. 4',
    label: 'Chapter 4 — River Shrine',
    biomeName: 'River Shrine',
    primaryTilesetId: '016',
    bgmCue: 'waterfall_cave',
    defaultDeploymentCap: 6,
  },
  {
    id: 'chapter_04',
    shortCode: 'Ch. 5',
    label: 'Chapter 5 — Berry Orchards',
    biomeName: 'Berry Orchards',
    primaryTilesetId: '042',
    bgmCue: 'apple_woods',
    defaultDeploymentCap: 6,
  },
];

const DEFAULT_CHAPTER_MAPS: ReadonlyArray<DungeonMapDefinition> = [
  map1Raw as unknown as DungeonMapDefinition,
  map2Raw as unknown as DungeonMapDefinition,
  map3Raw as unknown as DungeonMapDefinition,
  map4Raw as unknown as DungeonMapDefinition,
  map5Raw as unknown as DungeonMapDefinition,
];

const catalogById = new Map<string, ChapterLevelCatalogEntry>();
for (const entry of CHAPTER_LEVEL_CATALOG) {
  catalogById.set(entry.id, entry);
}

const defaultMapById = new Map<string, DungeonMapDefinition>();
for (const defMap of DEFAULT_CHAPTER_MAPS) {
  defaultMapById.set(defMap.id, defMap);
}

export function getChapterCatalogEntry(levelId: string): ChapterLevelCatalogEntry | undefined {
  return catalogById.get(levelId);
}

export function getDefaultChapterMap(levelId: string): DungeonMapDefinition {
  const base = defaultMapById.get(levelId) ?? DEFAULT_CHAPTER_MAPS[0]!;
  return cloneDungeonMap(base);
}

const PROLOGUE_002_WALL_CHUNKS = new Set<number>([2, 3, 5, 21, 27, 37, 38, 39, 50]);

/**
 * Detects legacy map editor overrides where the brush terrainType accidentally remained `'water'`
 * across the map or perimeter rock walls, freezing Grounded units in place.
 */
export function isCorruptedAllWaterOverride(map: DungeonMapDefinition): boolean {
  const total = map.width * map.height;
  if (total <= 0) return false;
  let waterCount = 0;
  let perimeterCount = 0;
  let perimeterWaterWallChunkCount = 0;
  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      if (cell.terrainType === 'water') {
        waterCount += 1;
      }
      if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
        perimeterCount += 1;
        if (
          cell.terrainType === 'water' &&
          cell.tilesetId === '002' &&
          PROLOGUE_002_WALL_CHUNKS.has(cell.chunkIndex)
        ) {
          perimeterWaterWallChunkCount += 1;
        }
      }
    }
  }
  if (waterCount / total >= 0.7) {
    return true;
  }
  if (perimeterCount > 0 && perimeterWaterWallChunkCount / perimeterCount >= 0.75) {
    return true;
  }
  return false;
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
      let healedCorrupted = false;
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
          if (isCorruptedAllWaterOverride(v.map)) {
            const healTs = Math.max(ts + 1, Date.now());
            this.resets.set(levelId, healTs);
            if (healTs > this.lastStamp) this.lastStamp = healTs;
            healedCorrupted = true;
            continue;
          }
          this.overrides.set(levelId, {
            map: v.map,
            updatedAt: ts,
          });
          this.resets.delete(levelId);
          if (ts > this.lastStamp) this.lastStamp = ts;
        }
      }
      if (healedCorrupted) {
        this.persistToLocalStorage();
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
      let incResetTs = incResets[levelId] ?? 0;
      if (rawIncOv && typeof rawIncOv === 'object') {
        const v = validateDungeonMapDefinition(rawIncOv.map, levelId);
        if (v.valid && v.map) {
          const rawTs =
            typeof rawIncOv.updatedAt === 'number' &&
            Number.isFinite(rawIncOv.updatedAt) &&
            rawIncOv.updatedAt > 0
              ? rawIncOv.updatedAt
              : 1;
          if (isCorruptedAllWaterOverride(v.map)) {
            const healTs = Math.max(rawTs + 1, localStateTs + 1, Date.now());
            incResetTs = Math.max(incResetTs, healTs);
            cloudOutdated = true;
          } else {
            validIncMap = v.map;
            incOvTs = rawTs;
          }
        }
      }
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
