/**
 * Dijkstra Movement Range, Attack/Support Borders & Enemy Danger Area Envelope
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  CostMinHeap,
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
  /** Full minimum-cost table including pass-through allied tiles (rendered as the Blue movement zone) */
  traversedCosts: Map<string, number>;
  /** Red enemy-targetable tiles outside `traversedCosts` reachable from any legal stopping tile */
  attackBorderTiles: Set<string>;
  /** Complete set of tiles this unit can strike with enemy-targeting moves from any reachable tile */
  allAttackableTiles: Set<string>;
  /** Green ally-support/heal tiles outside `traversedCosts` reachable from any legal stopping tile (independent of `attackBorderTiles`) */
  supportBorderTiles: Set<string>;
}

const INF_COST = 0x3fffffff;

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
  const w = map.width;
  const h = map.height;
  const total = w * h;

  const allyOccupied = new Uint8Array(total);
  const enemyOccupied = new Uint8Array(total);
  for (const other of allUnits) {
    if (other.id === unit.id) continue;
    if (other.x < 0 || other.y < 0 || other.x >= w || other.y >= h) continue;
    const oIdx = other.y * w + other.x;
    if (areBattleFactionsAllied(other.faction, unit.faction)) {
      allyOccupied[oIdx] = 1;
    } else {
      enemyOccupied[oIdx] = 1;
    }
  }

  const bestCosts = new Int32Array(total);
  bestCosts.fill(INF_COST);
  const traversedMask = new Uint8Array(total);

  const traversedCosts = new Map<string, number>();
  const reachableTiles = new Map<string, ReachableTileInfo>();
  const originKey = coordKey(unit.x, unit.y);
  traversedCosts.set(originKey, 0);
  reachableTiles.set(originKey, { x: unit.x, y: unit.y, cost: 0 });

  if (isInMapBounds(map, unit.x, unit.y)) {
    const originIdx = unit.y * w + unit.x;
    bestCosts[originIdx] = 0;
    traversedMask[originIdx] = 1;

    const heap = new CostMinHeap();
    heap.push(originIdx, 0);

    while (heap.length > 0) {
      const curIdx = heap.pop();
      const curCost = heap.lastCost;
      if (curCost > bestCosts[curIdx]!) continue;

      const cx = curIdx % w;
      const cy = (curIdx - cx) / w;

      for (let d = 0; d < ORTHOGONAL_DIRS.length; d++) {
        const [dx, dy] = ORTHOGONAL_DIRS[d]!;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

        const nIdx = ny * w + nx;
        if (enemyOccupied[nIdx]) continue;

        const terrain = getMapTerrainAt(map, nx, ny);
        if (!terrain) continue;

        const stepCost = getTerrainMoveCost(terrain, unit);
        if (stepCost === null) continue;

        const nextCost = curCost + stepCost;
        if (nextCost > effectiveMov || nextCost >= bestCosts[nIdx]!) continue;

        const isFirstVisit = bestCosts[nIdx] === INF_COST;
        bestCosts[nIdx] = nextCost;
        traversedMask[nIdx] = 1;
        heap.push(nIdx, nextCost);

        const nKey = coordKey(nx, ny);
        traversedCosts.set(nKey, nextCost);
        if (!allyOccupied[nIdx] && (isFirstVisit || reachableTiles.has(nKey))) {
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
    const attackMask = new Uint8Array(total);
    const supportMask = new Uint8Array(total);

    for (const stopTile of reachableTiles.values()) {
      for (let rIdx = 0; rIdx < enemyRanges.length; rIdx++) {
        const [minR, maxR] = enemyRanges[rIdx]!;
        for (let dy = -maxR; dy <= maxR; dy++) {
          const ty = stopTile.y + dy;
          if (ty < 0 || ty >= h) continue;
          const rem = maxR - Math.abs(dy);
          for (let dx = -rem; dx <= rem; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < minR || dist > maxR) continue;
            const tx = stopTile.x + dx;
            if (tx < 0 || tx >= w) continue;
            const tIdx = ty * w + tx;
            if (attackMask[tIdx]) continue;
            attackMask[tIdx] = 1;
            const tKey = coordKey(tx, ty);
            allAttackableTiles.add(tKey);
            if (!traversedMask[tIdx]) {
              attackBorderTiles.add(tKey);
            }
          }
        }
      }

      for (let rIdx = 0; rIdx < supportRanges.length; rIdx++) {
        const [minR, maxR] = supportRanges[rIdx]!;
        for (let dy = -maxR; dy <= maxR; dy++) {
          const ty = stopTile.y + dy;
          if (ty < 0 || ty >= h) continue;
          const rem = maxR - Math.abs(dy);
          for (let dx = -rem; dx <= rem; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < minR || dist > maxR) continue;
            const tx = stopTile.x + dx;
            if (tx < 0 || tx >= w) continue;
            const tIdx = ty * w + tx;
            if (traversedMask[tIdx] || supportMask[tIdx]) continue;
            supportMask[tIdx] = 1;
            supportBorderTiles.add(coordKey(tx, ty));
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
    precomputedEnemyRanges?: Map<string, MovementRangeResult>;
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

    let range = options.precomputedEnemyRanges?.get(unit.id);
    if (!range) {
      range = computeUnitMovementAndAttackRange(map, unit, allUnits);
      options.precomputedEnemyRanges?.set(unit.id, range);
    }
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
