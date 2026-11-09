/**
 * Tactical Terrain Traversal Metadata, Move Costs & Defense/Avoid Bonuses
 *
 * Enforces GDD Section 2.2 traversal rules across `Grounded`, `Flying`, and `Levitate`.
 */

import { getItemById } from '../../data/index';
import type {
  DungeonMapDefinition,
  EnemyAiMode,
  MoveTargetType,
  PokemonType,
  StatusCondition,
  TerrainBonuses,
  TerrainType,
  TraversalClass,
  UnitBattleFaction,
} from '../../types/schemas';

export interface ActiveMoveRangeEntry {
  id: string;
  range: [number, number];
  targetType: MoveTargetType;
  ppRemaining: number;
}

export function areBattleFactionsAllied(
  a: UnitBattleFaction,
  b: UnitBattleFaction
): boolean {
  return (a === 'enemy') === (b === 'enemy');
}

export interface PathfindingUnitContext {
  id: string;
  faction: UnitBattleFaction;
  x: number;
  y: number;
  /** Base or stage-configured Mov stat from manual balance registry */
  mov: number;
  /** If true, unit is anchored to `(x, y)` with `0` movement in pathfinding & Danger Area */
  stationary?: boolean;
  aiMode?: EnemyAiMode;
  traversalClass: TraversalClass;
  types: ReadonlyArray<PokemonType>;
  heldItemId: string | null;
  status?: StatusCondition | null;
  activeMoves: ReadonlyArray<ActiveMoveRangeEntry>;
  equippedMoveId: string | null;
}

export interface TerrainMetadata {
  id: TerrainType;
  label: string;
  shortLabel: string;
  summary: string;
}

export const TERRAIN_METADATA: Readonly<Record<TerrainType, TerrainMetadata>> = {
  floor: {
    id: 'floor',
    label: 'Dungeon Floor',
    shortLabel: 'Floor',
    summary: '1 Mov · +0 Def/SpD · 0% Avoid',
  },
  trees: {
    id: 'trees',
    label: 'Trees / Foliage',
    shortLabel: 'Trees',
    summary: '2 Mov Grounded (1 Flying/Levitate/Boots) · +1 Def/SpD, +15% Avoid (Grounded)',
  },
  stairs: {
    id: 'stairs',
    label: 'Dungeon Stairs',
    shortLabel: 'Stairs',
    summary: '1 Mov · +1 Def/SpD, +10% Avoid (All) · Blocks reinforcements when occupied',
  },
  water: {
    id: 'water',
    label: 'Water / Stream',
    shortLabel: 'Water',
    summary: 'Water/Flying/Levitate: 1 Mov (+10% Avoid Water) · Blocks other Grounded',
  },
  lava: {
    id: 'lava',
    label: 'Lava / Magma',
    shortLabel: 'Lava',
    summary: 'Fire/Flying/Levitate: 1 Mov (+10% Avoid Fire) · Blocks other Grounded',
  },
  mountain: {
    id: 'mountain',
    label: 'Mountain / Crag',
    shortLabel: 'Mountain',
    summary: '3 Mov Grounded (2 Rock/Gnd/Fight, 1 Boots/Fly/Lev) · +2 Def/SpD, +20% Avoid (Grounded)',
  },
  void: {
    id: 'void',
    label: 'Void / Chasm',
    shortLabel: 'Void',
    summary: 'Impassable to Grounded & Flying · Only Levitate crosses (1 Mov)',
  },
  wonder_tile: {
    id: 'wonder_tile',
    label: 'Wonder Tile',
    shortLabel: 'Wonder',
    summary: '1 Mov · +2 Def/SpD, +20% Avoid, 20% HP heal & clear debuffs (All)',
  },
  barrier: {
    id: 'barrier',
    label: 'Low Barrier',
    shortLabel: 'Barrier',
    summary: 'Impassable to Grounded & Flying · Levitate crosses at 1 Mov',
  },
  wall: {
    id: 'wall',
    label: 'Dungeon Wall',
    shortLabel: 'Wall',
    summary: 'Impassable to all units (Grounded, Flying, and Levitate)',
  },
};

export const ORTHOGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCoordKey(key: string): { x: number; y: number } {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}

export function isInMapBounds(map: DungeonMapDefinition, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getMapTerrainAt(
  map: DungeonMapDefinition,
  x: number,
  y: number
): TerrainType | null {
  if (!isInMapBounds(map, x, y)) return null;
  return map.tiles[y]?.[x]?.terrainType ?? null;
}

export function hasHeavyDutyBootsEffect(heldItemId: string | null | undefined): boolean {
  if (!heldItemId) return false;
  const item = getItemById(heldItemId);
  return Boolean(item?.effect.ignoreTerrainMovePenalties);
}

export function getEffectiveMovementPoints(unit: PathfindingUnitContext): number {
  if (unit.stationary || unit.aiMode === 'stationary') {
    return 0;
  }
  let mov = unit.mov;
  if (unit.heldItemId) {
    const item = getItemById(unit.heldItemId);
    if (item?.effect.choiceStatBoost?.mov) {
      mov += item.effect.choiceStatBoost.mov;
    }
  }
  if (unit.status === 'FRZ') {
    mov = Math.floor(mov / 2);
  }
  return Math.max(0, mov);
}

/**
 * Computes the exact movement point cost to enter `terrain` for `unit`,
 * or returns `null` if the tile is impassable for that unit.
 */
export function getTerrainMoveCost(
  terrain: TerrainType,
  unit: Pick<PathfindingUnitContext, 'traversalClass' | 'types' | 'heldItemId'>
): number | null {
  if (terrain === 'wall') return null;
  if (terrain === 'floor' || terrain === 'stairs' || terrain === 'wonder_tile') return 1;
  if (unit.traversalClass === 'Levitate') return 1;

  if (unit.traversalClass === 'Flying') {
    return terrain === 'void' || terrain === 'barrier' ? null : 1;
  }

  if (terrain === 'void' || terrain === 'barrier') return null;

  const ignoresPenalties = hasHeavyDutyBootsEffect(unit.heldItemId);
  if (terrain === 'trees') {
    return ignoresPenalties ? 1 : 2;
  }
  if (terrain === 'mountain') {
    if (ignoresPenalties) return 1;
    const hasMountainAffinity = unit.types.some(
      (t) => t === 'Rock' || t === 'Ground' || t === 'Fighting'
    );
    return hasMountainAffinity ? 2 : 3;
  }
  if (terrain === 'water') {
    return unit.types.includes('Water') ? 1 : null;
  }
  if (terrain === 'lava') {
    return unit.types.includes('Fire') ? 1 : null;
  }
  return 1;
}

const ZERO_BONUSES: TerrainBonuses = {
  defBonus: 0,
  spdBonus: 0,
  avoidBonus: 0,
  healPercentPerTurn: 0,
  clearsDebuffs: false,
  spawnsReinforcements: false,
};

/**
 * Computes exact Def/SpD/Avoid and start-of-turn bonuses granted by `terrain` to `unit`
 * per GDD Section 2.2.
 */
export function getTerrainBonuses(
  terrain: TerrainType,
  unit: Pick<PathfindingUnitContext, 'traversalClass' | 'types'>
): TerrainBonuses {
  if (terrain === 'stairs') {
    return {
      defBonus: 1,
      spdBonus: 1,
      avoidBonus: 10,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: true,
    };
  }
  if (terrain === 'wonder_tile') {
    return {
      defBonus: 2,
      spdBonus: 2,
      avoidBonus: 20,
      healPercentPerTurn: 20,
      clearsDebuffs: true,
      spawnsReinforcements: false,
    };
  }
  if (unit.traversalClass === 'Flying' || unit.traversalClass === 'Levitate') {
    return { ...ZERO_BONUSES };
  }
  if (terrain === 'trees') {
    return { ...ZERO_BONUSES, defBonus: 1, spdBonus: 1, avoidBonus: 15 };
  }
  if (terrain === 'mountain') {
    return { ...ZERO_BONUSES, defBonus: 2, spdBonus: 2, avoidBonus: 20 };
  }
  if (terrain === 'water' && unit.types.includes('Water')) {
    return { ...ZERO_BONUSES, avoidBonus: 10 };
  }
  if (terrain === 'lava' && unit.types.includes('Fire')) {
    return { ...ZERO_BONUSES, avoidBonus: 10 };
  }
  return { ...ZERO_BONUSES };
}
