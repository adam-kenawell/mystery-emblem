/**
 * Terrain-Aware Reverse-Dijkstra Pursuit Field for `'aggressive'` Enemy AI
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  isOffensiveMove,
  manhattanDistance,
  type BattleUnitState,
} from '../combatEngine';
import type { ReachableTileInfo } from '../pathfinding/attackEnvelope';
import {
  CostMinHeap,
  areBattleFactionsAllied,
  coordKey,
  getMapTerrainAt,
  getTerrainBonuses,
  getTerrainMoveCost,
  isInMapBounds,
} from '../pathfinding/terrainRules';

const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const INF_DIST = 0x3fffffff;

export function pickBestPursuitTile(
  map: DungeonMapDefinition,
  actor: BattleUnitState,
  hostileUnits: ReadonlyArray<BattleUnitState>,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): ReachableTileInfo | null {
  const offensiveMoves = actor.activeMoves.filter(
    (s) => s.ppRemaining > 0 && isOffensiveMove(s.move)
  );
  const preferredDistances = new Set<number>();
  for (const m of offensiveMoves) {
    preferredDistances.add(m.range[0]);
  }
  if (preferredDistances.size === 0) {
    preferredDistances.add(1);
  }

  const w = map.width;
  const h = map.height;
  const total = w * h;
  const hostileOccupied = new Uint8Array(total);
  const otherAllyOccupied = new Uint8Array(total);

  for (const u of allLivingUnits) {
    if (u.id === actor.id || u.defeated || u.currentHp <= 0) continue;
    if (u.x < 0 || u.y < 0 || u.x >= w || u.y >= h) continue;
    const uIdx = u.y * w + u.x;
    if (!areBattleFactionsAllied(u.faction, actor.faction)) {
      hostileOccupied[uIdx] = 1;
    } else {
      otherAllyOccupied[uIdx] = 1;
    }
  }

  const distField = new Int32Array(total);
  distField.fill(INF_DIST);
  const heap = new CostMinHeap();

  const seedGoalsAtDistances = (distances: Iterable<number>, allowOccupiedByAlly: boolean) => {
    for (const pu of hostileUnits) {
      for (const r of distances) {
        for (let dy = -r; dy <= r; dy++) {
          const gy = pu.y + dy;
          if (gy < 0 || gy >= h) continue;
          const rem = r - Math.abs(dy);
          for (const dx of rem === 0 ? [0] : [-rem, rem]) {
            const gx = pu.x + dx;
            if (gx < 0 || gx >= w) continue;
            const gIdx = gy * w + gx;
            if (hostileOccupied[gIdx]) continue;
            if (!allowOccupiedByAlly && otherAllyOccupied[gIdx]) continue;
            const terrain = getMapTerrainAt(map, gx, gy);
            if (!terrain || getTerrainMoveCost(terrain, actor) === null) continue;
            if (distField[gIdx] === INF_DIST) {
              distField[gIdx] = 0;
              heap.push(gIdx, 0);
            }
          }
        }
      }
    }
  };

  seedGoalsAtDistances(preferredDistances, false);
  if (heap.length === 0) {
    seedGoalsAtDistances([1, 2], true);
  }

  while (heap.length > 0) {
    const curIdx = heap.pop();
    const curCost = heap.lastCost;
    if (curCost > distField[curIdx]!) continue;

    const cx = curIdx % w;
    const cy = (curIdx - cx) / w;
    const curTerrain = getMapTerrainAt(map, cx, cy);
    const enterCurCost = curTerrain ? getTerrainMoveCost(curTerrain, actor) : null;
    if (enterCurCost === null) continue;

    for (let d = 0; d < ORTHO_DIRS.length; d++) {
      const [dx, dy] = ORTHO_DIRS[d]!;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (hostileOccupied[nIdx]) continue;

      const nTerrain = getMapTerrainAt(map, nx, ny);
      if (!nTerrain) continue;
      if ((nx !== actor.x || ny !== actor.y) && getTerrainMoveCost(nTerrain, actor) === null) {
        continue;
      }

      const nextCost = curCost + enterCurCost;
      if (nextCost < distField[nIdx]!) {
        distField[nIdx] = nextCost;
        heap.push(nIdx, nextCost);
      }
    }
  }

  const originGoalDist = isInMapBounds(map, actor.x, actor.y)
    ? distField[actor.y * w + actor.x]!
    : INF_DIST;

  const nearestHostileManhattan = (tx: number, ty: number): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const pu of hostileUnits) {
      const d = manhattanDistance(tx, ty, pu.x, pu.y);
      if (d < best) best = d;
    }
    return best;
  };

  let bestStop: ReachableTileInfo | null = null;
  let bestGoalDist = Number.POSITIVE_INFINITY;
  let bestManhattan = Number.POSITIVE_INFINITY;
  let bestTerrainScore = Number.NEGATIVE_INFINITY;

  for (const stop of reachableTiles.values()) {
    const gDist =
      stop.x >= 0 && stop.y >= 0 && stop.x < w && stop.y < h
        ? distField[stop.y * w + stop.x]!
        : INF_DIST;
    const manh = nearestHostileManhattan(stop.x, stop.y);
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, actor);
    const tScore = bonuses.defBonus * 5 + bonuses.avoidBonus * 0.25;

    const effectiveGoalDist = gDist < INF_DIST ? gDist : 10000 + manh;

    if (
      effectiveGoalDist < bestGoalDist ||
      (effectiveGoalDist === bestGoalDist &&
        (manh < bestManhattan || (manh === bestManhattan && tScore > bestTerrainScore)))
    ) {
      bestGoalDist = effectiveGoalDist;
      bestManhattan = manh;
      bestTerrainScore = tScore;
      bestStop = stop;
    }
  }

  if (bestStop && originGoalDist < INF_DIST && bestGoalDist > originGoalDist) {
    return reachableTiles.get(coordKey(actor.x, actor.y)) ?? bestStop;
  }

  return bestStop;
}
