/**
 * Terrain-Aware Reverse-Dijkstra Pursuit Field for `'aggressive'` Enemy AI
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  isOffensiveMove,
  manhattanDistance,
  type BattleUnitState,
} from '../combatEngine';
import {
  areBattleFactionsAllied,
  coordKey,
  getMapTerrainAt,
  getTerrainBonuses,
  getTerrainMoveCost,
  isInMapBounds,
  type ReachableTileInfo,
} from '../terrainAndPathfinding';

const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

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

  const hostileOccupied = new Set<string>();
  const otherAllyOccupied = new Set<string>();
  for (const u of allLivingUnits) {
    if (u.id === actor.id || u.defeated || u.currentHp <= 0) continue;
    const k = coordKey(u.x, u.y);
    if (!areBattleFactionsAllied(u.faction, actor.faction)) {
      hostileOccupied.add(k);
    } else {
      otherAllyOccupied.add(k);
    }
  }

  const distField = new Map<string, number>();
  const queue: Array<{ x: number; y: number; cost: number }> = [];

  const seedGoalsAtDistances = (distances: Iterable<number>, allowOccupiedByAlly: boolean) => {
    for (const pu of hostileUnits) {
      for (const r of distances) {
        for (let dy = -r; dy <= r; dy++) {
          const rem = r - Math.abs(dy);
          for (const dx of rem === 0 ? [0] : [-rem, rem]) {
            const gx = pu.x + dx;
            const gy = pu.y + dy;
            if (!isInMapBounds(map, gx, gy)) continue;
            const gKey = coordKey(gx, gy);
            if (hostileOccupied.has(gKey)) continue;
            if (!allowOccupiedByAlly && otherAllyOccupied.has(gKey)) continue;
            const terrain = getMapTerrainAt(map, gx, gy);
            if (!terrain || getTerrainMoveCost(terrain, actor) === null) continue;
            if (!distField.has(gKey)) {
              distField.set(gKey, 0);
              queue.push({ x: gx, y: gy, cost: 0 });
            }
          }
        }
      }
    }
  };

  seedGoalsAtDistances(preferredDistances, false);
  if (queue.length === 0) {
    seedGoalsAtDistances([1, 2], true);
  }

  while (queue.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.cost < queue[bestIdx]!.cost) {
        bestIdx = i;
      }
    }
    const cur = queue.splice(bestIdx, 1)[0]!;
    const curKey = coordKey(cur.x, cur.y);
    const known = distField.get(curKey);
    if (known !== undefined && cur.cost > known) continue;

    const curTerrain = getMapTerrainAt(map, cur.x, cur.y);
    const enterCurCost = curTerrain ? getTerrainMoveCost(curTerrain, actor) : null;
    if (enterCurCost === null) continue;

    for (const [dx, dy] of ORTHO_DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isInMapBounds(map, nx, ny)) continue;
      const nKey = coordKey(nx, ny);
      if (hostileOccupied.has(nKey)) continue;

      const nTerrain = getMapTerrainAt(map, nx, ny);
      if (!nTerrain) continue;
      if ((nx !== actor.x || ny !== actor.y) && getTerrainMoveCost(nTerrain, actor) === null) {
        continue;
      }

      const nextCost = cur.cost + enterCurCost;
      const prev = distField.get(nKey);
      if (prev === undefined || nextCost < prev) {
        distField.set(nKey, nextCost);
        queue.push({ x: nx, y: ny, cost: nextCost });
      }
    }
  }

  const originKey = coordKey(actor.x, actor.y);
  const originGoalDist = distField.get(originKey) ?? Number.POSITIVE_INFINITY;

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
    const k = coordKey(stop.x, stop.y);
    const gDist = distField.get(k);
    const manh = nearestHostileManhattan(stop.x, stop.y);
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, actor);
    const tScore = bonuses.defBonus * 5 + bonuses.avoidBonus * 0.25;

    const effectiveGoalDist = gDist ?? 10000 + manh;

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

  if (
    bestStop &&
    Number.isFinite(originGoalDist) &&
    bestGoalDist > originGoalDist
  ) {
    return reachableTiles.get(originKey) ?? bestStop;
  }

  return bestStop;
}
