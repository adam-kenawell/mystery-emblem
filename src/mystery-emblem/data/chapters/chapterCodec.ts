/**
 * Compact Chapter Tile Row Codec & Default Hydrator (`chapterCodec.ts`)
 *
 * Encodes/decodes compact `rows: string[]` (`"F:59 X:2 W:016:88"`) <-> `DungeonMapTileCell[][]`
 * with 100% lossless round-trip and hydrates default `DungeonMapDefinition` objects.
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import { getSpeciesById } from '../index';
import type {
  DungeonEventDefinition,
  DungeonMapDefinition,
  DungeonMapTileCell,
  DungeonUnitSpawn,
  ReinforcementWaveDefinition,
  TerrainType,
} from '../../types/schemas';
import type { CompactChapterJson } from './chapterTypes';

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

const TERRAIN_TO_CODE: Readonly<Record<TerrainType, string>> = {
  floor: 'F',
  trees: 'T',
  stairs: 'S',
  water: 'W',
  lava: 'L',
  mountain: 'M',
  void: 'V',
  wonder_tile: 'WT',
  wall: 'X',
  barrier: 'B',
};

const CODE_TO_TERRAIN: Readonly<Record<string, TerrainType>> = Object.fromEntries(
  Object.entries(TERRAIN_TO_CODE).map(([k, v]) => [v, k as TerrainType])
);

export function encodeTileRows(
  tiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>,
  defaultTilesetId: string
): string[] {
  return tiles.map((row) =>
    row
      .map((cell) => {
        const code = TERRAIN_TO_CODE[cell.terrainType] ?? 'F';
        return cell.tilesetId === defaultTilesetId
          ? `${code}:${cell.chunkIndex}`
          : `${code}:${cell.tilesetId}:${cell.chunkIndex}`;
      })
      .join(' ')
  );
}

export function decodeTileRows(
  rows: ReadonlyArray<string>,
  defaultTilesetId: string
): DungeonMapTileCell[][] {
  const normDefault = normalizeTilesetId(defaultTilesetId);
  return rows.map((line) =>
    line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const parts = token.split(':');
        const terrainType = CODE_TO_TERRAIN[parts[0] ?? ''] ?? 'floor';
        const tilesetId =
          parts.length === 3 ? normalizeTilesetId(parts[1] ?? normDefault) : normDefault;
        const chunkIndex = Math.max(
          0,
          Math.min(399, Math.floor(Number(parts[parts.length - 1] ?? 1)))
        );
        return { terrainType, tilesetId, chunkIndex };
      })
  );
}

function cloneSpawn(s: DungeonUnitSpawn): DungeonUnitSpawn {
  return {
    ...s,
    ...(s.stats ? { stats: { ...s.stats } } : {}),
    ...(s.moveIds ? { moveIds: [...s.moveIds] } : {}),
  };
}

function cloneReinforcement(w: ReinforcementWaveDefinition): ReinforcementWaveDefinition {
  return {
    ...w,
    enemy: {
      ...w.enemy,
      ...(w.enemy.stats ? { stats: { ...w.enemy.stats } } : {}),
      ...(w.enemy.moveIds ? { moveIds: [...w.enemy.moveIds] } : {}),
    },
  };
}

function cloneEvents(
  events: ReadonlyArray<DungeonEventDefinition>
): DungeonEventDefinition[] {
  return JSON.parse(JSON.stringify(events)) as DungeonEventDefinition[];
}

export function hydrateChapterDefaultMap(raw: CompactChapterJson): DungeonMapDefinition {
  const defaultAllies = ['dratini', 'piplup', 'flabebe', 'pidgey', 'sewaddle', 'ralts', 'elekid'];
  return {
    id: raw.id,
    name: raw.label,
    bgmCue: raw.bgmCue,
    objectiveType: raw.objectiveType,
    objectiveLabel: raw.objectiveLabel,
    ...(raw.surviveTurns !== undefined ? { surviveTurns: raw.surviveTurns } : {}),
    ...(raw.defeatIfUnitIdsFall ? { defeatIfUnitIdsFall: [...raw.defeatIfUnitIdsFall] } : {}),
    deploymentCap: raw.deploymentCap,
    width: raw.width,
    height: raw.height,
    tiles: decodeTileRows(raw.rows, raw.defaultTilesetId),
    playerSpawns: raw.playerSlots.map((slot, idx) => {
      const spId = slot.speciesId ?? defaultAllies[idx % defaultAllies.length]!;
      const sp = getSpeciesById(spId);
      return {
        x: slot.x,
        y: slot.y,
        speciesId: sp?.id ?? 'dratini',
        level: raw.recommendedLevel,
        nickname: sp?.name ?? 'Ally',
        heldItemId: null,
      };
    }),
    enemySpawns: raw.enemySpawns.map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      ...(e.stats ? { stats: { ...e.stats } } : {}),
      ...(e.moveIds ? { moveIds: [...e.moveIds] } : {}),
      ...(e.equippedMoveId ? { equippedMoveId: e.equippedMoveId } : {}),
      heldItemId: e.heldItemId ?? null,
      ...(e.isBoss ? { isBoss: true } : {}),
      ...(e.stationary ? { stationary: true } : {}),
      ...(e.mustSurvive ? { mustSurvive: true } : {}),
      droppableItemId: e.droppableItemId ?? null,
      ...(e.aiMode ? { aiMode: e.aiMode } : {}),
    })),
    ...(raw.npcSpawns?.length ? { npcSpawns: raw.npcSpawns.map(cloneSpawn) } : {}),
    ...(raw.reinforcements?.length
      ? { reinforcements: raw.reinforcements.map(cloneReinforcement) }
      : {}),
    ...(raw.events?.length ? { events: cloneEvents(raw.events) } : {}),
  };
}

export function cloneDungeonMap(map: DungeonMapDefinition): DungeonMapDefinition {
  return {
    id: map.id,
    name: map.name,
    bgmCue: map.bgmCue,
    objectiveType: map.objectiveType,
    ...(map.objectiveLabel ? { objectiveLabel: map.objectiveLabel } : {}),
    ...(map.surviveTurns !== undefined ? { surviveTurns: map.surviveTurns } : {}),
    ...(map.defeatIfUnitIdsFall ? { defeatIfUnitIdsFall: [...map.defeatIfUnitIdsFall] } : {}),
    deploymentCap: map.deploymentCap,
    width: map.width,
    height: map.height,
    tiles: map.tiles.map((row) => row.map((c) => ({ ...c }))),
    playerSpawns: map.playerSpawns.map(cloneSpawn),
    enemySpawns: map.enemySpawns.map(cloneSpawn),
    ...(map.npcSpawns?.length ? { npcSpawns: map.npcSpawns.map(cloneSpawn) } : {}),
    ...(map.reinforcements?.length
      ? { reinforcements: map.reinforcements.map(cloneReinforcement) }
      : {}),
    ...(map.events?.length ? { events: cloneEvents(map.events) } : {}),
  };
}
