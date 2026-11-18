/**
 * Optimal Orthogonal A* Pathfinding with Turn-Minimizing Tie-Breaking
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  CostMinHeap,
  ORTHOGONAL_DIRS,
  areBattleFactionsAllied,
  getEffectiveMovementPoints,
  getMapTerrainAt,
  getTerrainMoveCost,
  isInMapBounds,
  type PathfindingUnitContext,
} from './terrainRules';

export interface AStarPathStep {
  x: number;
  y: number;
  cumulativeCost: number;
}

const INF_G = 0x3fffffff;

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
  if (!isInMapBounds(map, targetX, targetY) || !isInMapBounds(map, unit.x, unit.y)) return null;
  if (targetX === unit.x && targetY === unit.y) {
    return [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
  }

  const w = map.width;
  const h = map.height;
  const total = w * h;
  const effectiveMov = getEffectiveMovementPoints(unit);

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

  const targetIdx = targetY * w + targetX;
  if (allyOccupied[targetIdx] || enemyOccupied[targetIdx]) {
    return null;
  }

  const startIdx = unit.y * w + unit.x;
  const gScore = new Int32Array(total);
  gScore.fill(INF_G);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const lastDirArr = new Int8Array(total);
  lastDirArr.fill(-1);
  const turnsArr = new Int32Array(total);
  const closed = new Uint8Array(total);

  gScore[startIdx] = 0;

  // Pack (f, -g, turns) into an exact integer key so the binary min-heap matches original A* tie-breaking.
  const packPriority = (f: number, g: number, turns: number): number =>
    f * 16_777_216 + Math.max(0, 4095 - Math.min(4095, g)) * 4096 + Math.min(4095, turns);

  const heap = new CostMinHeap();
  const startH = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
  heap.push(startIdx, packPriority(startH, 0, 0));

  while (heap.length > 0) {
    const curIdx = heap.pop();
    if (closed[curIdx]) continue;
    closed[curIdx] = 1;

    if (curIdx === targetIdx) {
      const steps: AStarPathStep[] = [];
      let trace = curIdx;
      while (trace !== -1) {
        const tx = trace % w;
        const ty = (trace - tx) / w;
        steps.push({
          x: tx,
          y: ty,
          cumulativeCost: gScore[trace]!,
        });
        trace = cameFrom[trace]!;
      }
      steps.reverse();
      return steps;
    }

    const cx = curIdx % w;
    const cy = (curIdx - cx) / w;
    const curG = gScore[curIdx]!;
    const curDir = lastDirArr[curIdx]!;
    const curTurns = turnsArr[curIdx]!;

    for (let dirIdx = 0; dirIdx < ORTHOGONAL_DIRS.length; dirIdx++) {
      const [dx, dy] = ORTHOGONAL_DIRS[dirIdx]!;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

      const nIdx = ny * w + nx;
      if (closed[nIdx] || enemyOccupied[nIdx]) continue;

      const terrain = getMapTerrainAt(map, nx, ny);
      if (!terrain) continue;

      const stepCost = getTerrainMoveCost(terrain, unit);
      if (stepCost === null) continue;

      const tentativeG = curG + stepCost;
      if (tentativeG > effectiveMov) continue;

      if (tentativeG < gScore[nIdx]!) {
        const nextTurns = curDir === -1 || curDir === dirIdx ? curTurns : curTurns + 1;
        gScore[nIdx] = tentativeG;
        cameFrom[nIdx] = curIdx;
        lastDirArr[nIdx] = dirIdx;
        turnsArr[nIdx] = nextTurns;
        const f = tentativeG + Math.abs(nx - targetX) + Math.abs(ny - targetY);
        heap.push(nIdx, packPriority(f, tentativeG, nextTurns));
      }
    }
  }

  return null;
}
