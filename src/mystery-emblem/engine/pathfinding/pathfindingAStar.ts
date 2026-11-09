/**
 * Optimal Orthogonal A* Pathfinding with Turn-Minimizing Tie-Breaking
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
  parseCoordKey,
  type PathfindingUnitContext,
} from './terrainRules';

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
    if (areBattleFactionsAllied(other.faction, unit.faction)) {
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
