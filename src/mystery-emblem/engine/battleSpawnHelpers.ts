/**
 * Mystery Emblem - Non-Player & Scripted Event Spawn Instantiation Helpers (`battleSpawnHelpers.ts`)
 */

import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import {
  buildEquippedSlotsFromSeed,
  equipMoveInItsSlot,
  reconcileEquippedMoves,
  type EquippedMoveSlots,
} from '../data/equippedMoves';
import { getMoveById, getSpeciesById } from '../data/index';
import type {
  DungeonMapDefinition,
  DungeonUnitSpawn,
  SaveData,
  StatBlockSeven,
  UnitBattleFaction,
} from '../types/schemas';
import { type BattleMoveSlot, type BattleUnitState } from './combatEngine';
import { computeManualScaledStatsForJoinLevel } from './progressionEngine';
import {
  coordKey,
  getMapTerrainAt,
  getTerrainMoveCost,
  isInMapBounds,
} from './terrainAndPathfinding';

export function resolveSeededSpawnSpeciesId(
  spawn: Pick<DungeonUnitSpawn, 'speciesId' | 'seedKey'>,
  save?: SaveData | null
): string {
  if (spawn.seedKey && save?.campaign?.quizSeeds?.[spawn.seedKey]?.length) {
    const seeded = save.campaign.quizSeeds[spawn.seedKey][0];
    if (seeded && getSpeciesById(seeded)) {
      return seeded;
    }
  }
  return spawn.speciesId;
}

export function buildUnitMoveSlots(
  moveIds: ReadonlyArray<string>,
  bonusPpByMoveId?: Record<string, number>
): BattleMoveSlot[] {
  const slots: BattleMoveSlot[] = [];
  for (const moveId of moveIds.slice(0, 4)) {
    const mv = getMoveById(moveId);
    if (!mv) continue;
    const maxPp = mv.pp + (bonusPpByMoveId?.[mv.id] ?? 0);
    slots.push({
      id: mv.id,
      range: mv.range,
      targetType: mv.targetType,
      ppRemaining: maxPp,
      maxPp,
      move: mv,
    });
  }
  return slots;
}

export function resolveEquippedSlotsForOwnedUnit(
  slots: ReadonlyArray<BattleMoveSlot>,
  owned: EquippedMoveSlots
): EquippedMoveSlots {
  const resolved: EquippedMoveSlots = {
    equippedPhysicalMoveId: owned.equippedPhysicalMoveId,
    equippedSpecialMoveId: owned.equippedSpecialMoveId,
  };
  // Respect deliberately empty slots; only clear stale references.
  reconcileEquippedMoves(
    resolved,
    slots.map((s) => s.id),
    { fillEmpty: false }
  );
  return resolved;
}

export function buildSpawnedBattleUnit(
  spawn: DungeonUnitSpawn,
  faction: UnitBattleFaction,
  slotIndex: number,
  now: number = typeof performance !== 'undefined' ? performance.now() : 0,
  opts?: { addToPermanentRoster?: boolean; save?: SaveData | null }
): BattleUnitState | null {
  const resolvedSpeciesId = resolveSeededSpawnSpeciesId(spawn, opts?.save);
  const sp = getSpeciesById(resolvedSpeciesId) ?? getSpeciesById(spawn.speciesId);
  if (!sp) return null;
  const resolvedNickname = sp.name;
  const allLearnedMoveIds = sp.learnset
    .filter((l) => l.level <= Math.max(spawn.level, sp.defaultJoinLevel))
    .map((l) => l.moveId);
  const rawMoveIds =
    !spawn.seedKey && spawn.moveIds && spawn.moveIds.length > 0
      ? spawn.moveIds
      : allLearnedMoveIds.slice(-4);
  const moveSlots = buildUnitMoveSlots(rawMoveIds);
  const equippedSlots: EquippedMoveSlots =
    !spawn.seedKey && spawn.equippedMoveIds
      ? { equippedPhysicalMoveId: null, equippedSpecialMoveId: null }
      : buildEquippedSlotsFromSeed(
          moveSlots.map((s) => s.id),
          spawn.seedKey ? undefined : spawn.equippedMoveId
        );
  if (!spawn.seedKey && spawn.equippedMoveIds) {
    for (const id of spawn.equippedMoveIds) {
      if (moveSlots.some((s) => s.id === id)) equipMoveInItsSlot(equippedSlots, id);
    }
  }
  const stats: StatBlockSeven =
    !spawn.seedKey && spawn.stats
      ? { ...spawn.stats }
      : computeManualScaledStatsForJoinLevel(sp, spawn.level);
  const defaultPrefix = faction === 'npc' ? 'npc' : faction === 'player' ? 'ally' : 'enemy';

  return {
    id: spawn.id || `${defaultPrefix}_${slotIndex}`,
    slotIndex,
    faction,
    isLord: false,
    isBoss: Boolean(spawn.isBoss),
    stationary: Boolean(spawn.stationary),
    mustSurvive: Boolean(spawn.mustSurvive),
    ...(spawn.sparring ? { sparring: true } : {}),
    ...(opts?.addToPermanentRoster ? { recruitedMidBattle: true } : {}),
    aiMode: spawn.stationary ? 'stationary' : (spawn.aiMode ?? 'wait_until_in_range'),
    ...(spawn.squadId ? { squadId: spawn.squadId } : {}),
    droppableItemId: spawn.droppableItemId ?? null,
    speciesId: sp.id,
    speciesName: sp.name,
    nickname: resolvedNickname,
    level: spawn.level,
    exp: 0,
    unlockedMoveIds: [...new Set([...allLearnedMoveIds, ...rawMoveIds])],
    x: spawn.x,
    y: spawn.y,
    mov: stats.mov,
    maxHp: stats.hp,
    currentHp: stats.hp,
    stats,
    traversalClass: sp.traversalClass,
    types: sp.types,
    personalSkillId: sp.personalSkillId,
    heldItemId: spawn.heldItemId ?? null,
    consumableItemId: null,
    status: null,
    statusTurns: 0,
    tempBattleBoosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, crit: 0 },
    activeMoves: moveSlots,
    ...equippedSlots,
    waited: false,
    defeated: false,
    direction: faction === 'enemy' ? 6 : 2,
    action: 'Idle',
    frameIndex: 0,
    nextFrameAt: now + 140,
    renderWorldX: spawn.x * PMD_TILE_NATIVE_PX,
    renderWorldY: spawn.y * PMD_TILE_NATIVE_PX,
    hitFlashUntilMs: 0,
    koDissolveProgress: 0,
  };
}

export function findNearestFreeSpawnTile(
  map: DungeonMapDefinition,
  preferredX: number,
  preferredY: number,
  unit: Pick<BattleUnitState, 'traversalClass' | 'types' | 'heldItemId'>,
  occupiedCoords: ReadonlySet<string>
): { x: number; y: number } | null {
  const maxRadius = Math.max(map.width, map.height);
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const rem = r - Math.abs(dy);
      const dxs = rem === 0 ? [0] : [-rem, rem];
      for (const dx of dxs) {
        const tx = preferredX + dx;
        const ty = preferredY + dy;
        if (!isInMapBounds(map, tx, ty)) continue;
        if (occupiedCoords.has(coordKey(tx, ty))) continue;
        const terrain = getMapTerrainAt(map, tx, ty);
        if (!terrain || getTerrainMoveCost(terrain, unit) === null) continue;
        return { x: tx, y: ty };
      }
    }
  }
  return null;
}
