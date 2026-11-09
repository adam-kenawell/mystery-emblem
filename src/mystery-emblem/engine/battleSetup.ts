/**
 * Mystery Emblem — Battle Deployment & Unit Instantiation Helpers
 *
 * Converts `DungeonMapDefinition` spawns (`playerSpawns`, `enemySpawns`, `npcSpawns`),
 * `PrepDeploymentSlot` selections, and `OwnedPokemonInstance` save entries into live
 * `BattleUnitState` objects. Strictly obeys Rule 1 (manual balance) and Rule 4 (single `[E]` move).
 */

import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import { getSpeciesById } from '../data/index';
import type {
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  OwnedPokemonInstance,
  PrepDeploymentSlot,
  StatBlockSeven,
} from '../types/schemas';
import {
  buildSpawnedBattleUnit,
  buildUnitMoveSlots,
  findNearestFreeSpawnTile,
  resolveDefaultEquippedMoveId,
} from './battleSpawnHelpers';
import type { BattleUnitState } from './combatEngine';
import { createFallbackBattlePrepManager } from './fallbackPrepManager';
import { computeManualScaledStatsForJoinLevel } from './progressionEngine';

export {
  buildSpawnedBattleUnit,
  createFallbackBattlePrepManager,
  findNearestFreeSpawnTile,
  type ManualEnemyBattleSpawn,
  type PrepDeploymentSlot,
};

export const EXTRA_PLAYER_DEPLOYMENT_COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 3, y: 5 },
  { x: 3, y: 3 },
  { x: 3, y: 7 },
  { x: 2, y: 4 },
  { x: 2, y: 6 },
  { x: 2, y: 8 },
  { x: 4, y: 4 },
  { x: 4, y: 6 },
  { x: 2, y: 2 },
  { x: 4, y: 2 },
  { x: 4, y: 8 },
  { x: 2, y: 9 },
];

export function getMapDeploymentCap(map: DungeonMapDefinition): number {
  const spawnCount = Math.max(1, map.playerSpawns.length || EXTRA_PLAYER_DEPLOYMENT_COORDS.length);
  return Math.max(1, Math.min(map.deploymentCap ?? spawnCount, spawnCount));
}

export function createInitialPrepDeploymentSlots(
  map: DungeonMapDefinition,
  roster: ReadonlyArray<OwnedPokemonInstance>
): PrepDeploymentSlot[] {
  const seen = new Set<string>();
  const tileCoords: Array<{ x: number; y: number }> = [];
  const sourceSpawns =
    map.playerSpawns.length > 0 ? map.playerSpawns : EXTRA_PLAYER_DEPLOYMENT_COORDS;

  for (const s of sourceSpawns) {
    const key = `${s.x},${s.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tileCoords.push({ x: s.x, y: s.y });
  }

  const cap = Math.max(1, Math.min(map.deploymentCap ?? tileCoords.length, tileCoords.length));
  const orderedRoster = [...roster].sort((a, b) => {
    if (a.isLord !== b.isLord) return a.isLord ? -1 : 1;
    return 0;
  });

  return tileCoords.map((coord, slotIndex) => ({
    slotIndex,
    x: coord.x,
    y: coord.y,
    unitInstanceId:
      slotIndex < cap && orderedRoster[slotIndex] ? orderedRoster[slotIndex]!.instanceId : null,
  }));
}

export function resolveEnemySpawnsForMap(
  map: DungeonMapDefinition,
  explicitOverrides?: ReadonlyArray<ManualEnemyBattleSpawn>
): ReadonlyArray<ManualEnemyBattleSpawn> {
  if (explicitOverrides) return explicitOverrides;
  if (!map.enemySpawns || map.enemySpawns.length === 0) return [];

  return map.enemySpawns.map((spawn, idx) => {
    const sp = getSpeciesById(spawn.speciesId) ?? getSpeciesById('zigzagoon_galar')!;
    return {
      id: spawn.id ?? `enemy_${idx}`,
      x: spawn.x,
      y: spawn.y,
      speciesId: sp.id,
      nickname: spawn.nickname || sp.name,
      level: spawn.level,
      stats: spawn.stats ? { ...spawn.stats } : computeManualScaledStatsForJoinLevel(sp, spawn.level),
      ...(spawn.moveIds ? { moveIds: [...spawn.moveIds] } : {}),
      ...(spawn.equippedMoveId ? { equippedMoveId: spawn.equippedMoveId } : {}),
      heldItemId: spawn.heldItemId ?? null,
      isBoss: spawn.isBoss,
      stationary: spawn.stationary,
      mustSurvive: spawn.mustSurvive,
      droppableItemId: spawn.droppableItemId ?? null,
      aiMode: spawn.aiMode,
    };
  });
}

export function buildSingleEnemyBattleUnit(
  eSpawn: ManualEnemyBattleSpawn,
  slotIndex: number,
  now: number = typeof performance !== 'undefined' ? performance.now() : 0
): BattleUnitState | null {
  return buildSpawnedBattleUnit(eSpawn, 'enemy', slotIndex, now);
}

export function buildBattleUnitsFromPrepDeployment(
  map: DungeonMapDefinition,
  roster: ReadonlyArray<OwnedPokemonInstance>,
  deploymentSlots: ReadonlyArray<PrepDeploymentSlot>,
  enemyOverrides: ReadonlyArray<ManualEnemyBattleSpawn>
): BattleUnitState[] {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const units: BattleUnitState[] = [];
  const byInstanceId = new Map<string, OwnedPokemonInstance>();
  for (const u of roster) byInstanceId.set(u.instanceId, u);

  let deployedIdx = 0;
  for (const slot of deploymentSlots) {
    if (!slot.unitInstanceId) continue;
    const owned = byInstanceId.get(slot.unitInstanceId);
    if (!owned) continue;
    const sp = getSpeciesById(owned.speciesId);
    if (!sp) continue;

    const moveSlots = buildUnitMoveSlots(owned.activeMoveIds, owned.bonusPpByMoveId);
    const equippedMoveId = resolveDefaultEquippedMoveId(moveSlots, owned.equippedMoveId);
    const stats: StatBlockSeven = { ...owned.currentStats };

    units.push({
      id: `player_${deployedIdx}`,
      slotIndex: slot.slotIndex,
      rosterInstanceId: owned.instanceId,
      faction: 'player',
      isLord: owned.isLord,
      speciesId: sp.id,
      speciesName: sp.name,
      nickname: owned.nickname || sp.name,
      ...(owned.cosmeticForm ? { cosmeticForm: owned.cosmeticForm } : {}),
      level: owned.level,
      exp: owned.exp,
      unlockedMoveIds: [...owned.unlockedMoveIds],
      x: slot.x,
      y: slot.y,
      mov: stats.mov,
      maxHp: stats.hp,
      currentHp: stats.hp,
      stats,
      traversalClass: sp.traversalClass,
      types: sp.types,
      personalSkillId: sp.personalSkillId,
      heldItemId: owned.heldItemId,
      consumableItemId: owned.consumableItemId,
      status: null,
      statusTurns: 0,
      tempBattleBoosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, crit: 0 },
      activeMoves: moveSlots,
      equippedMoveId,
      waited: false,
      defeated: false,
      direction: 2,
      action: 'Idle',
      frameIndex: 0,
      nextFrameAt: now + 140,
      renderWorldX: slot.x * PMD_TILE_NATIVE_PX,
      renderWorldY: slot.y * PMD_TILE_NATIVE_PX,
      hitFlashUntilMs: 0,
      koDissolveProgress: 0,
    });
    deployedIdx += 1;
  }

  if (map.npcSpawns?.length) {
    map.npcSpawns.forEach((npcSpawn, idx) => {
      const built = buildSpawnedBattleUnit(npcSpawn, 'npc', idx, now);
      if (built) units.push(built);
    });
  }

  enemyOverrides.forEach((eSpawn, idx) => {
    const built = buildSingleEnemyBattleUnit(eSpawn, idx, now);
    if (built) units.push(built);
  });

  return units;
}
