/**
 * Dungeon Map Validator & Corruption Healer (`mapValidator.ts`)
 *
 * Validates custom Map Editor imports/overrides against bounds, terrain types,
 * Rule 5 faction separation, Stairs reinforcement waves, Green NPCs & events.
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import { MAX_UNIT_LEVEL, MIN_UNIT_LEVEL } from '../campaignConfig';
import { getSpeciesById } from '../index';
import {
  BATTLE_OBJECTIVE_TYPES,
  TERRAIN_TYPES,
  type BattleObjectiveType,
  type DungeonEventDefinition,
  type DungeonMapDefinition,
  type DungeonMapTileCell,
  type DungeonUnitSpawn,
  type ReinforcementWaveDefinition,
  type TerrainType,
} from '../../types/schemas';
import { decodeTileRows } from './chapterCodec';

const PROLOGUE_002_WALL_CHUNKS = new Set<number>([2, 3, 5, 21, 27, 37, 38, 39, 50]);
const VALID_TERRAIN_SET = new Set<string>(TERRAIN_TYPES);
const VALID_OBJECTIVE_SET = new Set<string>(BATTLE_OBJECTIVE_TYPES);

export function isCorruptedAllWaterOverride(map: DungeonMapDefinition): boolean {
  const total = map.width * map.height;
  if (total <= 0) return false;
  let waterCount = 0;
  let perimeterCount = 0;
  let perimeterWaterWall = 0;
  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const cell = row[x];
      if (!cell) continue;
      if (cell.terrainType === 'water') waterCount += 1;
      if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
        perimeterCount += 1;
        if (
          cell.terrainType === 'water' &&
          cell.tilesetId === '002' &&
          PROLOGUE_002_WALL_CHUNKS.has(cell.chunkIndex)
        ) {
          perimeterWaterWall += 1;
        }
      }
    }
  }
  return (
    waterCount / total >= 0.7 ||
    (perimeterCount > 0 && perimeterWaterWall / perimeterCount >= 0.75)
  );
}

function normalizeSpawnFields(sp: Partial<DungeonUnitSpawn>, fallbackName: string): Omit<DungeonUnitSpawn, 'x' | 'y' | 'speciesId'> {
  return {
    ...(sp.id ? { id: String(sp.id) } : {}),
    level: Math.max(MIN_UNIT_LEVEL, Math.min(MAX_UNIT_LEVEL, Math.floor(Number(sp.level ?? 1)))),
    nickname: sp.nickname ? String(sp.nickname).slice(0, 22) : fallbackName,
    ...(sp.stats ? { stats: { ...sp.stats } } : {}),
    ...(Array.isArray(sp.moveIds) ? { moveIds: sp.moveIds.map(String) } : {}),
    ...(sp.equippedMoveId ? { equippedMoveId: String(sp.equippedMoveId) } : {}),
    heldItemId: sp.heldItemId ?? null,
    ...(sp.isBoss ? { isBoss: true } : {}),
    ...(sp.stationary ? { stationary: true } : {}),
    ...(sp.mustSurvive ? { mustSurvive: true } : {}),
    ...(sp.droppableItemId ? { droppableItemId: String(sp.droppableItemId) } : {}),
    ...(sp.aiMode ? { aiMode: sp.aiMode } : {}),
  };
}

export function validateDungeonMapDefinition(
  candidate: unknown,
  expectedLevelId?: string,
  catalogDefaults?: { label?: string; bgmCue?: string; defaultDeploymentCap?: number }
): { valid: boolean; errors: string[]; map?: DungeonMapDefinition } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Map payload must be a JSON object.'] };
  }

  const raw = candidate as Partial<DungeonMapDefinition> & {
    rows?: string[];
    defaultTilesetId?: string;
  };
  const resolvedId = (expectedLevelId ?? raw.id ?? '').trim();
  if (!resolvedId) errors.push('Map is missing an id.');

  const width = Number(raw.width);
  const height = Number(raw.height);
  if (!Number.isInteger(width) || width < 8 || width > 40)
    errors.push(`Map width (${String(raw.width)}) must be 8..40.`);
  if (!Number.isInteger(height) || height < 8 || height > 32)
    errors.push(`Map height (${String(raw.height)}) must be 8..32.`);

  const sourceTiles = Array.isArray(raw.tiles)
    ? raw.tiles
    : Array.isArray(raw.rows)
      ? decodeTileRows(raw.rows, raw.defaultTilesetId ?? '142')
      : null;
  if (!sourceTiles || sourceTiles.length !== height)
    errors.push(`Map tiles array must have ${height} rows.`);

  const normalizedTiles: DungeonMapTileCell[][] = [];
  if (sourceTiles && errors.length === 0) {
    for (let y = 0; y < height; y++) {
      const row = sourceTiles[y];
      if (!Array.isArray(row) || row.length !== width) {
        errors.push(`Row y=${y} must have exactly ${width} tile cells.`);
        break;
      }
      const normRow: DungeonMapTileCell[] = [];
      for (let x = 0; x < width; x++) {
        const cell = row[x] as Partial<DungeonMapTileCell> | undefined;
        if (
          !cell ||
          typeof cell !== 'object' ||
          !cell.terrainType ||
          !VALID_TERRAIN_SET.has(cell.terrainType)
        ) {
          errors.push(`Tile (${x},${y}) has invalid terrainType "${String(cell?.terrainType)}".`);
          break;
        }
        normRow.push({
          terrainType: cell.terrainType as TerrainType,
          tilesetId: normalizeTilesetId(String(cell.tilesetId ?? '142')),
          chunkIndex: Math.max(0, Math.min(399, Math.floor(Number(cell.chunkIndex ?? 1)))),
        });
      }
      normalizedTiles.push(normRow);
      if (errors.length > 0) break;
    }
  }

  const inBounds = (x: number, y: number) =>
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;

  const normPlayerSpawns: DungeonUnitSpawn[] = [];
  if (!Array.isArray(raw.playerSpawns) || raw.playerSpawns.length < 1) {
    errors.push('Map must define at least 1 blue player starting spawn.');
  } else if (errors.length === 0) {
    for (const sp of raw.playerSpawns) {
      const x = Math.floor(Number(sp?.x));
      const y = Math.floor(Number(sp?.y));
      if (!inBounds(x, y)) {
        errors.push(`Player spawn (${String(sp?.x)},${String(sp?.y)}) is out of map bounds.`);
        continue;
      }
      const rawSpId = String(sp?.speciesId || 'dratini');
      const def = getSpeciesById(rawSpId) ?? getSpeciesById('dratini')!;
      if (def.faction === 'enemy') {
        errors.push(`Player spawn species "${rawSpId}" is enemy-only.`);
        continue;
      }
      normPlayerSpawns.push({
        x,
        y,
        speciesId: def.id,
        level: Math.max(MIN_UNIT_LEVEL, Math.min(MAX_UNIT_LEVEL, Math.floor(Number(sp?.level ?? 1)))),
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
      if (!inBounds(x, y)) {
        errors.push(`Enemy spawn (${String(sp?.x)},${String(sp?.y)}) is out of map bounds.`);
        continue;
      }
      const speciesId = String(sp?.speciesId || 'zigzagoon_galar');
      const def = getSpeciesById(speciesId);
      if (!def || def.faction === 'playable' || def.faction === 'ally_npc') {
        errors.push(`Rule 5: Enemy spawn species "${speciesId}" must be an enemy/convertible species.`);
        continue;
      }
      normEnemySpawns.push({
        x,
        y,
        speciesId: def.id,
        ...normalizeSpawnFields(sp, def.name),
      });
    }
  }

  const normNpcSpawns: DungeonUnitSpawn[] = [];
  if (Array.isArray(raw.npcSpawns) && errors.length === 0) {
    for (const sp of raw.npcSpawns) {
      const x = Math.floor(Number(sp?.x));
      const y = Math.floor(Number(sp?.y));
      if (!inBounds(x, y)) {
        errors.push(`NPC spawn (${String(sp?.x)},${String(sp?.y)}) is out of map bounds.`);
        continue;
      }
      const speciesId = String(sp?.speciesId || 'kecleon');
      const def = getSpeciesById(speciesId);
      if (!def || def.faction === 'enemy') {
        errors.push(`NPC spawn species "${speciesId}" cannot be an enemy-only species.`);
        continue;
      }
      normNpcSpawns.push({ x, y, speciesId: def.id, ...normalizeSpawnFields(sp, def.name) });
    }
  }

  const normReinforcements: ReinforcementWaveDefinition[] = [];
  if (Array.isArray(raw.reinforcements) && errors.length === 0) {
    for (const wave of raw.reinforcements) {
      const sx = Math.floor(Number(wave?.stairsX));
      const sy = Math.floor(Number(wave?.stairsY));
      if (!inBounds(sx, sy)) {
        errors.push(`Reinforcement stairs (${String(wave?.stairsX)},${String(wave?.stairsY)}) out of bounds.`);
        continue;
      }
      const spId = String(wave?.enemy?.speciesId || 'zigzagoon_galar');
      const def = getSpeciesById(spId);
      if (!def || def.faction === 'playable' || def.faction === 'ally_npc') {
        errors.push(`Rule 5: Reinforcement species "${spId}" must be an enemy/convertible species.`);
        continue;
      }
      const normFields = normalizeSpawnFields(wave.enemy ?? {}, def.name);
      normReinforcements.push({
        id: String(wave.id || `wave_${normReinforcements.length}`),
        turnNumber: Math.max(1, Math.floor(Number(wave.turnNumber ?? 2))),
        stairsX: sx,
        stairsY: sy,
        enemy: {
          ...normFields,
          id: normFields.id || String(wave.id || `reinf_${normReinforcements.length}`),
          x: sx,
          y: sy,
          speciesId: def.id,
          nickname: normFields.nickname ?? def.name,
        },
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  const rawCap =
    raw.deploymentCap !== undefined
      ? Math.floor(Number(raw.deploymentCap))
      : (catalogDefaults?.defaultDeploymentCap ?? normPlayerSpawns.length);
  const deploymentCap = Math.max(1, Math.min(12, Math.min(rawCap, normPlayerSpawns.length)));
  const normObj =
    raw.objectiveType && VALID_OBJECTIVE_SET.has(raw.objectiveType)
      ? (raw.objectiveType as BattleObjectiveType)
      : undefined;
  const normEvents = Array.isArray(raw.events)
    ? (JSON.parse(JSON.stringify(raw.events)) as DungeonEventDefinition[])
    : undefined;

  return {
    valid: true,
    errors: [],
    map: {
      id: resolvedId,
      name: String(raw.name || catalogDefaults?.label || resolvedId),
      bgmCue: raw.bgmCue ? String(raw.bgmCue) : catalogDefaults?.bgmCue,
      ...(normObj ? { objectiveType: normObj } : {}),
      ...(raw.objectiveLabel ? { objectiveLabel: String(raw.objectiveLabel) } : {}),
      ...(raw.surviveTurns !== undefined
        ? { surviveTurns: Math.max(1, Math.floor(Number(raw.surviveTurns))) }
        : {}),
      ...(Array.isArray(raw.defeatIfUnitIdsFall)
        ? { defeatIfUnitIdsFall: raw.defeatIfUnitIdsFall.map(String) }
        : {}),
      deploymentCap,
      width,
      height,
      tiles: normalizedTiles,
      playerSpawns: normPlayerSpawns,
      enemySpawns: normEnemySpawns,
      ...(normNpcSpawns.length > 0 ? { npcSpawns: normNpcSpawns } : {}),
      ...(normReinforcements.length > 0 ? { reinforcements: normReinforcements } : {}),
      ...(normEvents && normEvents.length > 0 ? { events: normEvents } : {}),
    },
  };
}
