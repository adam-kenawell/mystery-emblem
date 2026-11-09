/**
 * Dijkstra Movement Range, Attack/Support Borders & Enemy Danger Area Envelope
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  ORTHOGONAL_DIRS,
  areBattleFactionsAllied,
  coordKey,
  getEffectiveMovementPoints,
  getMapTerrainAt,
  getTerrainMoveCost,
  isInMapBounds,
  type PathfindingUnitContext,
} from './terrainRules';

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
    if (areBattleFactionsAllied(other.faction, unit.faction)) {
      allyOccupied.add(key);
    } else {
      enemyOccupied.add(key);
    }
  }

  const traversedCosts = new Map<string, number>();
  const reachableTiles = new Map<string, ReachableTileInfo>();

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

        if (!allyOccupied.has(nKey)) {
          reachableTiles.set(nKey, { x: nx, y: ny, cost: nextCost });
        }
      }
    }
  }

  const enemyRanges: Array<[number, number]> = [];
  const supportRanges: Array<[number, number]> = [];

  for (const mv of unit.activeMoves) {
    if (mv.ppRemaining <= 0 || unit.status === 'SLP') continue;
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

export interface DangerAreaResult {
  globalDangerTiles: Set<string>;
  individualDangerTiles: Set<string>;
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
