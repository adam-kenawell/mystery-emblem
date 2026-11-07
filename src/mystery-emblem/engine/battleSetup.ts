/**
 * Mystery Emblem — Battle Deployment & Unit Instantiation Helpers
 *
 * Converts `DungeonMapDefinition` spawns, `PrepDeploymentSlot` selections, and
 * `OwnedPokemonInstance` save entries into live `BattleUnitState` objects.
 * Strictly obeys Rule 1 (100% manual balance registries) and Rule 4 (single `[E]` move).
 */

import { PMD_TILE_NATIVE_PX } from '../assets/tilesetLoader';
import { getMoveById, getSpeciesById } from '../data/index';
import { InMemoryCloudSyncAdapter } from '../state/firebaseSync';
import { SaveStateManager, type StorageLike } from '../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  OwnedPokemonInstance,
  PrepDeploymentSlot,
  StatBlockSeven,
} from '../types/schemas';
import { isOffensiveMove, type BattleMoveSlot, type BattleUnitState } from './combatEngine';
import { computeManualScaledStatsForJoinLevel } from './progressionEngine';

export type { ManualEnemyBattleSpawn, PrepDeploymentSlot };

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

function buildMoveSlots(
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

function resolveDefaultEquippedMove(
  slots: ReadonlyArray<BattleMoveSlot>,
  preferredId: string | null | undefined
): string | null {
  if (preferredId !== undefined) {
    if (preferredId === null) return null;
    const found = slots.find((s) => s.id === preferredId && isOffensiveMove(s.move));
    if (found) return found.id;
  }
  const firstOff = slots.find((s) => isOffensiveMove(s.move));
  return firstOff ? firstOff.id : null;
}

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
  if (explicitOverrides) {
    return explicitOverrides;
  }
  if (!map.enemySpawns || map.enemySpawns.length === 0) {
    return [];
  }

  return map.enemySpawns.map((spawn, idx) => {
    const sp = getSpeciesById(spawn.speciesId) ?? getSpeciesById('zigzagoon_galar')!;
    return {
      id: `enemy_${idx}`,
      x: spawn.x,
      y: spawn.y,
      speciesId: sp.id,
      nickname: spawn.nickname || sp.name,
      level: spawn.level,
      stats: computeManualScaledStatsForJoinLevel(sp, spawn.level),
      heldItemId: spawn.heldItemId ?? null,
      isBoss: spawn.isBoss,
      stationary: spawn.stationary,
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
  const sp = getSpeciesById(eSpawn.speciesId);
  if (!sp) return null;
  const rawMoveIds =
    eSpawn.moveIds && eSpawn.moveIds.length > 0
      ? eSpawn.moveIds
      : sp.learnset
          .filter((l) => l.level <= Math.max(eSpawn.level, sp.defaultJoinLevel))
          .map((l) => l.moveId)
          .slice(-4);
  const moveSlots = buildMoveSlots(rawMoveIds);
  const equippedMoveId = resolveDefaultEquippedMove(moveSlots, eSpawn.equippedMoveId);
  const stats: StatBlockSeven = eSpawn.stats
    ? { ...eSpawn.stats }
    : computeManualScaledStatsForJoinLevel(sp, eSpawn.level);

  return {
    id: eSpawn.id || `enemy_${slotIndex}`,
    slotIndex,
    faction: 'enemy',
    isLord: false,
    isBoss: Boolean(eSpawn.isBoss),
    stationary: Boolean(eSpawn.stationary),
    aiMode: eSpawn.stationary ? 'stationary' : (eSpawn.aiMode ?? 'wait_until_in_range'),
    droppableItemId: eSpawn.droppableItemId ?? null,
    speciesId: sp.id,
    speciesName: sp.name,
    nickname: eSpawn.nickname || sp.name,
    level: eSpawn.level,
    x: eSpawn.x,
    y: eSpawn.y,
    mov: stats.mov,
    maxHp: stats.hp,
    currentHp: stats.hp,
    stats,
    traversalClass: sp.traversalClass,
    types: sp.types,
    personalSkillId: sp.personalSkillId,
    heldItemId: eSpawn.heldItemId ?? null,
    consumableItemId: null,
    status: null,
    statusTurns: 0,
    tempBattleBoosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, crit: 0 },
    activeMoves: moveSlots,
    equippedMoveId,
    waited: false,
    defeated: false,
    direction: 6, // West
    action: 'Idle',
    frameIndex: 0,
    nextFrameAt: now + 140,
    renderWorldX: eSpawn.x * PMD_TILE_NATIVE_PX,
    renderWorldY: eSpawn.y * PMD_TILE_NATIVE_PX,
    hitFlashUntilMs: 0,
    koDissolveProgress: 0,
  };
}

export function buildBattleUnitsFromPrepDeployment(
  _map: DungeonMapDefinition,
  roster: ReadonlyArray<OwnedPokemonInstance>,
  deploymentSlots: ReadonlyArray<PrepDeploymentSlot>,
  enemyOverrides: ReadonlyArray<ManualEnemyBattleSpawn>
): BattleUnitState[] {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const units: BattleUnitState[] = [];
  const byInstanceId = new Map<string, OwnedPokemonInstance>();
  for (const u of roster) {
    byInstanceId.set(u.instanceId, u);
  }

  let deployedIdx = 0;
  for (const slot of deploymentSlots) {
    if (!slot.unitInstanceId) continue;
    const owned = byInstanceId.get(slot.unitInstanceId);
    if (!owned) continue;
    const sp = getSpeciesById(owned.speciesId);
    if (!sp) continue;

    const moveSlots = buildMoveSlots(owned.activeMoveIds, owned.bonusPpByMoveId);
    const equippedMoveId = resolveDefaultEquippedMove(moveSlots, owned.equippedMoveId);
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
      direction: 2, // East
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

  enemyOverrides.forEach((eSpawn, idx) => {
    const built = buildSingleEnemyBattleUnit(eSpawn, idx, now);
    if (built) units.push(built);
  });

  return units;
}

/**
 * Isolated in-memory `SaveStateManager` used only when launching Map Editor `Test Battle`
 * while no campaign save exists yet.
 */
export function createFallbackBattlePrepManager(minSquadSize = 5): SaveStateManager {
  const mem = new Map<string, string>();
  const memStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
  const mgr = new SaveStateManager(memStorage, new InMemoryCloudSyncAdapter(new Map()));
  mgr.createNewCampaignSave({
    lordSpeciesId: 'dratini',
    partnerSpeciesId: 'bulbasaur',
    healerSpeciesId: 'happiny',
    startingLevel: 9,
    scaleStatsToLevel: true,
    campaignMode: 'demo',
  });

  const extraPool = ['caterpie', 'pidgey', 'duskull', 'abra', 'shinx'];
  let idx = 0;
  while ((mgr.getSave()?.roster.length ?? 0) < Math.min(8, minSquadSize) && idx < extraPool.length) {
    mgr.recruitPokemon({ speciesId: extraPool[idx]!, level: 9, scaleStatsToLevel: true });
    idx += 1;
  }

  mgr.addConvoyItem('evolution_stone', 1);
  mgr.addConvoyItem('super_potion', 1);
  return mgr;
}
