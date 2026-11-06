/**
 * Step 5 Tactical Terrain Traversal, Dijkstra Range & A* Pathfinding Engine
 *
 * Enforces all rules from GDD Section 2.2 & Section 3.6 (Step 5):
 * - 3 Terrain Traversal Classes (`Grounded`, `Flying`, `Levitate`)
 * - Grounded exceptions:
 *   - `Water`-type crosses `water` at `1 Mov` (+10% Avoid)
 *   - `Fire`-type crosses `lava` at `1 Mov` (+10% Avoid)
 *   - `Rock` / `Ground` / `Fighting` crosses `mountain` at `2 Mov` instead of `3`
 *   - `Heavy-Duty Boots` (`ignoreTerrainMovePenalties`) ignores `trees` & `mountain` penalties (`1 Mov`)
 * - Flying: `1 Mov` across `trees`, `water`, `lava`, `mountain`; `0` bonuses; blocked by `void`, `barrier`, and `wall`
 * - Levitate: `1 Mov` across `void`, `lava`, `water`, `trees`, `mountain`, and low `barrier`;
 *   blocked only by thick `wall`; `0` bonuses except on `wonder_tile` and `stairs`
 * - Pure Fire Emblem passability & Range 2:
 *   - Pass through allied units (never stop on an occupied tile); blocked by enemy units
 *   - Union all active `targetType === 'enemy'` moves (`PP > 0`) for Red attack highlights & Enemy Danger Area
 *   - Union active `ally` / `self_or_ally` Support/Heal moves (`PP > 0`) for Green support highlights
 */

import { getItemById } from '../data/index';
import type {
  DungeonMapDefinition,
  MoveTargetType,
  PokemonType,
  StatusCondition,
  TerrainBonuses,
  TerrainType,
  TraversalClass,
} from '../types/schemas';

export interface ActiveMoveRangeEntry {
  id: string;
  range: [number, number];
  targetType: MoveTargetType;
  ppRemaining: number;
}

export interface PathfindingUnitContext {
  id: string;
  faction: 'player' | 'enemy';
  x: number;
  y: number;
  /** Base or stage-configured Mov stat from manual balance registry */
  mov: number;
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
  // Thick Dungeon Walls block ALL 3 traversal classes
  if (terrain === 'wall') {
    return null;
  }

  // Standard 1-Mov universal tiles
  if (terrain === 'floor' || terrain === 'stairs' || terrain === 'wonder_tile') {
    return 1;
  }

  // Levitate omni-traversal: 1 Mov across Void/Chasm, Lava, Water, Trees, Mountain, and Low Barriers
  if (unit.traversalClass === 'Levitate') {
    return 1;
  }

  // Flying traversal: blocked by Void/Chasm and Low Barriers (and Walls above); 1 Mov across everything else
  if (unit.traversalClass === 'Flying') {
    if (terrain === 'void' || terrain === 'barrier') {
      return null;
    }
    return 1;
  }

  // Grounded traversal
  if (terrain === 'void' || terrain === 'barrier') {
    return null;
  }

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

/**
 * Computes exact Def/SpD/Avoid and start-of-turn bonuses granted by `terrain` to `unit`
 * per GDD Section 2.2.
 */
export function getTerrainBonuses(
  terrain: TerrainType,
  unit: Pick<PathfindingUnitContext, 'traversalClass' | 'types'>
): TerrainBonuses {
  // Stairs & Wonder Tiles apply to ALL units (Grounded, Flying, and Levitate)
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

  // Flying & Levitate receive 0 terrain bonuses on all other tiles
  if (unit.traversalClass === 'Flying' || unit.traversalClass === 'Levitate') {
    return {
      defBonus: 0,
      spdBonus: 0,
      avoidBonus: 0,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: false,
    };
  }

  // Grounded terrain bonuses
  if (terrain === 'trees') {
    return {
      defBonus: 1,
      spdBonus: 1,
      avoidBonus: 15,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: false,
    };
  }

  if (terrain === 'mountain') {
    return {
      defBonus: 2,
      spdBonus: 2,
      avoidBonus: 20,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: false,
    };
  }

  if (terrain === 'water' && unit.types.includes('Water')) {
    return {
      defBonus: 0,
      spdBonus: 0,
      avoidBonus: 10,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: false,
    };
  }

  if (terrain === 'lava' && unit.types.includes('Fire')) {
    return {
      defBonus: 0,
      spdBonus: 0,
      avoidBonus: 10,
      healPercentPerTurn: 0,
      clearsDebuffs: false,
      spawnsReinforcements: false,
    };
  }

  return {
    defBonus: 0,
    spdBonus: 0,
    avoidBonus: 0,
    healPercentPerTurn: 0,
    clearsDebuffs: false,
    spawnsReinforcements: false,
  };
}

export interface ReachableTileInfo {
  x: number;
  y: number;
  cost: number;
}

export interface MovementRangeResult {
  effectiveMov: number;
  /** Legal Blue stopping tiles (`key = "x,y"`), excluding ally-occupied tiles (except unit's own origin) */
  reachableTiles: Map<string, ReachableTileInfo>;
  /** Full minimum-cost table including pass-through allied tiles */
  traversedCosts: Map<string, number>;
  /** Red enemy-targetable tiles outside `reachableTiles` */
  attackBorderTiles: Set<string>;
  /** Complete set of tiles this unit can strike with enemy-targeting moves from any reachable tile */
  allAttackableTiles: Set<string>;
  /** Green ally-support/heal tiles outside `reachableTiles` and `attackBorderTiles` */
  supportBorderTiles: Set<string>;
}

const ORTHOGONAL_DIRS: ReadonlyArray< readonly [number, number] > = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Runs Dijkstra's algorithm to compute all legal stopping tiles (`Blue`), plus projects
 * `Red` offensive range and `Green` ally-support range across the 4-move loadout (`PP > 0`).
 */
export function computeUnitMovementAndAttackRange(
  map: DungeonMapDefinition,
  unit: PathfindingUnitContext,
  allUnits: ReadonlyArray<PathfindingUnitContext>
): MovementRangeResult {
  const effectiveMov = getEffectiveMovementPoints(unit);

  const allyOccupied = new Set<string>();
  const enemyOccupied = new Set<string>();
  for (const other of allUnits) {
    if (other.id === unit.id) continue;
    const key = coordKey(other.x, other.y);
    if (other.faction === unit.faction) {
      allyOccupied.add(key);
    } else {
      enemyOccupied.add(key);
    }
  }

  const traversedCosts = new Map<string, number>();
  const reachableTiles = new Map<string, ReachableTileInfo>();

  // Simple min-priority queue (grid sizes <= ~1000 cells)
  const queue: Array<{ x: number; y: number; cost: number }> = [
    { x: unit.x, y: unit.y, cost: 0 },
  ];
  const originKey = coordKey(unit.x, unit.y);
  traversedCosts.set(originKey, 0);
  reachableTiles.set(originKey, { x: unit.x, y: unit.y, cost: 0 });

  while (queue.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.cost < queue[bestIdx]!.cost) {
        bestIdx = i;
      }
    }
    const current = queue.splice(bestIdx, 1)[0]!;
    const curKey = coordKey(current.x, current.y);
    const knownBest = traversedCosts.get(curKey);
    if (knownBest !== undefined && current.cost > knownBest) {
      continue;
    }

    for (const [dx, dy] of ORTHOGONAL_DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isInMapBounds(map, nx, ny)) continue;

      const nKey = coordKey(nx, ny);
      // Enemies completely block movement & pass-through
      if (enemyOccupied.has(nKey)) continue;

      const terrain = getMapTerrainAt(map, nx, ny);
      if (!terrain) continue;

      const stepCost = getTerrainMoveCost(terrain, unit);
      if (stepCost === null) continue;

      const nextCost = current.cost + stepCost;
      if (nextCost > effectiveMov) continue;

      const prevCost = traversedCosts.get(nKey);
      if (prevCost === undefined || nextCost < prevCost) {
        traversedCosts.set(nKey, nextCost);
        queue.push({ x: nx, y: ny, cost: nextCost });

        // Units can pass through allies, but cannot stop on an ally-occupied tile
        if (!allyOccupied.has(nKey)) {
          reachableTiles.set(nKey, { x: nx, y: ny, cost: nextCost });
        }
      }
    }
  }

  // Project offensive (`enemy`) and support (`ally` / `self_or_ally`) ranges from all reachable stopping tiles
  const enemyRanges: Array<[number, number]> = [];
  const supportRanges: Array<[number, number]> = [];

  for (const mv of unit.activeMoves) {
    if (mv.ppRemaining <= 0) continue;
    if (mv.targetType === 'enemy') {
      enemyRanges.push(mv.range);
    } else if (
      (mv.targetType === 'ally' || mv.targetType === 'self_or_ally') &&
      mv.range[1] >= 1
    ) {
      supportRanges.push([Math.max(1, mv.range[0]), mv.range[1]]);
    }
  }

  const allAttackableTiles = new Set<string>();
  const attackBorderTiles = new Set<string>();
  const supportBorderTiles = new Set<string>();

  if (enemyRanges.length > 0 || supportRanges.length > 0) {
    for (const stopTile of reachableTiles.values()) {
      for (const [minR, maxR] of enemyRanges) {
        for (let dy = -maxR; dy <= maxR; dy++) {
          const rem = maxR - Math.abs(dy);
          for (let dx = -rem; dx <= rem; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < minR || dist > maxR) continue;
            const tx = stopTile.x + dx;
            const ty = stopTile.y + dy;
            if (!isInMapBounds(map, tx, ty)) continue;
            const tKey = coordKey(tx, ty);
            allAttackableTiles.add(tKey);
            if (!reachableTiles.has(tKey)) {
              attackBorderTiles.add(tKey);
            }
          }
        }
      }

      for (const [minR, maxR] of supportRanges) {
        for (let dy = -maxR; dy <= maxR; dy++) {
          const rem = maxR - Math.abs(dy);
          for (let dx = -rem; dx <= rem; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < minR || dist > maxR) continue;
            const tx = stopTile.x + dx;
            const ty = stopTile.y + dy;
            if (!isInMapBounds(map, tx, ty)) continue;
            const tKey = coordKey(tx, ty);
            if (!reachableTiles.has(tKey) && !attackBorderTiles.has(tKey)) {
              supportBorderTiles.add(tKey);
            }
          }
        }
      }
    }
  }

  return {
    effectiveMov,
    reachableTiles,
    traversedCosts,
    attackBorderTiles,
    allAttackableTiles,
    supportBorderTiles,
  };
}

export interface AStarPathStep {
  x: number;
  y: number;
  cumulativeCost: number;
}

/**
 * Finds the minimum-cost legal orthogonal path from `(unit.x, unit.y)` to `(targetX, targetY)`
 * using A* with Manhattan heuristic (`min step cost >= 1`, so strictly admissible & optimal).
 * Returns `null` if the destination is unreachable or occupied by another unit.
 */
export function findShortestPathAStar(
  map: DungeonMapDefinition,
  unit: PathfindingUnitContext,
  targetX: number,
  targetY: number,
  allUnits: ReadonlyArray<PathfindingUnitContext>
): AStarPathStep[] | null {
  if (!isInMapBounds(map, targetX, targetY)) return null;
  if (targetX === unit.x && targetY === unit.y) {
    return [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
  }

  const effectiveMov = getEffectiveMovementPoints(unit);
  const allyOccupied = new Set<string>();
  const enemyOccupied = new Set<string>();
  for (const other of allUnits) {
    if (other.id === unit.id) continue;
    const key = coordKey(other.x, other.y);
    if (other.faction === unit.faction) {
      allyOccupied.add(key);
    } else {
      enemyOccupied.add(key);
    }
  }

  const targetKey = coordKey(targetX, targetY);
  if (allyOccupied.has(targetKey) || enemyOccupied.has(targetKey)) {
    return null;
  }

  interface OpenNode {
    x: number;
    y: number;
    g: number;
    f: number;
    lastDir: number;
    turns: number;
  }

  const startKey = coordKey(unit.x, unit.y);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, string>();
  const heuristic = (x: number, y: number) => Math.abs(x - targetX) + Math.abs(y - targetY);

  const open: OpenNode[] = [
    {
      x: unit.x,
      y: unit.y,
      g: 0,
      f: heuristic(unit.x, unit.y),
      lastDir: -1,
      turns: 0,
    },
  ];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i]!;
      const b = open[bestIdx]!;
      if (a.f < b.f || (a.f === b.f && (a.g > b.g || (a.g === b.g && a.turns < b.turns)))) {
        bestIdx = i;
      }
    }

    const current = open.splice(bestIdx, 1)[0]!;
    const curKey = coordKey(current.x, current.y);

    if (current.x === targetX && current.y === targetY) {
      const steps: AStarPathStep[] = [];
      let traceKey: string | undefined = curKey;
      while (traceKey !== undefined) {
        const pt = parseCoordKey(traceKey);
        steps.push({
          x: pt.x,
          y: pt.y,
          cumulativeCost: gScore.get(traceKey) ?? 0,
        });
        traceKey = cameFrom.get(traceKey);
      }
      steps.reverse();
      return steps;
    }

    const bestKnownG = gScore.get(curKey);
    if (bestKnownG !== undefined && current.g > bestKnownG) {
      continue;
    }

    for (let dirIdx = 0; dirIdx < ORTHOGONAL_DIRS.length; dirIdx++) {
      const [dx, dy] = ORTHOGONAL_DIRS[dirIdx]!;
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!isInMapBounds(map, nx, ny)) continue;

      const nKey = coordKey(nx, ny);
      if (enemyOccupied.has(nKey)) continue;

      const terrain = getMapTerrainAt(map, nx, ny);
      if (!terrain) continue;

      const stepCost = getTerrainMoveCost(terrain, unit);
      if (stepCost === null) continue;

      const tentativeG = current.g + stepCost;
      if (tentativeG > effectiveMov) continue;

      const prevG = gScore.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, curKey);
        const nextTurns =
          current.lastDir === -1 || current.lastDir === dirIdx
            ? current.turns
            : current.turns + 1;
        open.push({
          x: nx,
          y: ny,
          g: tentativeG,
          f: tentativeG + heuristic(nx, ny),
          lastDir: dirIdx,
          turns: nextTurns,
        });
      }
    }
  }

  return null;
}

export interface DangerAreaResult {
  /** Union of attackable tiles across all enemies when `globalEnabled` is true */
  globalDangerTiles: Set<string>;
  /** Union of attackable tiles across individually toggled enemies (`trackedEnemyIds`) */
  individualDangerTiles: Set<string>;
  /** Combined set of all active Danger Area tiles (`globalDangerTiles ∪ individualDangerTiles`) */
  combinedDangerTiles: Set<string>;
}

/**
 * Computes the Fire Emblem Awakening purple/red Enemy Danger Area overlay (global toggle +
 * per-enemy individual threat range toggle).
 */
export function computeEnemyDangerArea(
  map: DungeonMapDefinition,
  allUnits: ReadonlyArray<PathfindingUnitContext>,
  options: {
    globalEnabled: boolean;
    trackedEnemyIds?: ReadonlySet<string>;
  }
): DangerAreaResult {
  const globalDangerTiles = new Set<string>();
  const individualDangerTiles = new Set<string>();
  const combinedDangerTiles = new Set<string>();
  const tracked = options.trackedEnemyIds;

  if (!options.globalEnabled && (!tracked || tracked.size === 0)) {
    return { globalDangerTiles, individualDangerTiles, combinedDangerTiles };
  }

  for (const unit of allUnits) {
    if (unit.faction !== 'enemy') continue;
    const isIndividuallyTracked = Boolean(tracked?.has(unit.id));
    if (!options.globalEnabled && !isIndividuallyTracked) continue;

    const range = computeUnitMovementAndAttackRange(map, unit, allUnits);
    for (const key of range.allAttackableTiles) {
      if (options.globalEnabled) {
        globalDangerTiles.add(key);
        combinedDangerTiles.add(key);
      }
      if (isIndividuallyTracked) {
        individualDangerTiles.add(key);
        combinedDangerTiles.add(key);
      }
    }
  }

  return { globalDangerTiles, individualDangerTiles, combinedDangerTiles };
}
