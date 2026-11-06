/**
 * Mystery Emblem — Tactical Enemy Phase AI Controller (`enemyAi.ts`)
 *
 * Implements active Pursue & Attack tactical AI:
 * 1. Scores all legal `(stopTile, move, target)` attack options using `computeCombatForecast`
 *    (prioritizing KOs, Dragon Lord pressure, free hits where the defender's `[E]` move
 *    cannot counter-attack at that range, terrain defense/avoid, and counter survival).
 * 2. When no player unit is currently within attack range, computes a full-map terrain-aware
 *    Dijkstra distance field from player attack positions so Grounded, Flying, and Levitate
 *    enemies route intelligently around walls, rivers, lava, and chasms toward the squad.
 */

import type { DungeonMapDefinition } from '../types/schemas';
import {
  computeCombatForecast,
  getOffensiveMovesAtDistance,
  isOffensiveMove,
  manhattanDistance,
  type BattleUnitState,
  type CombatForecast,
} from './combatEngine';
import {
  computeUnitMovementAndAttackRange,
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  getTerrainMoveCost,
  isInMapBounds,
  type AStarPathStep,
  type ReachableTileInfo,
} from './terrainAndPathfinding';

export interface EnemyAttackDecision {
  targetUnitId: string;
  moveId: string;
  forecast: CombatForecast;
  score: number;
}

export interface EnemyTurnDecision {
  kind: 'attack' | 'pursue' | 'wait';
  enemyId: string;
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  attack: EnemyAttackDecision | null;
}

const ORTHO_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Selects the optimal movement path and optional attack for `enemy` on Enemy Phase.
 */
export function chooseEnemyAction(
  map: DungeonMapDefinition,
  enemy: BattleUnitState,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): EnemyTurnDecision {
  const stayPath: AStarPathStep[] = [{ x: enemy.x, y: enemy.y, cumulativeCost: 0 }];

  if (enemy.defeated || enemy.currentHp <= 0 || enemy.status === 'SLP') {
    return {
      kind: 'wait',
      enemyId: enemy.id,
      stopX: enemy.x,
      stopY: enemy.y,
      path: stayPath,
      attack: null,
    };
  }

  const playerUnits = allLivingUnits.filter(
    (u) => u.faction === 'player' && !u.defeated && u.currentHp > 0
  );
  if (playerUnits.length === 0) {
    return {
      kind: 'wait',
      enemyId: enemy.id,
      stopX: enemy.x,
      stopY: enemy.y,
      path: stayPath,
      attack: null,
    };
  }

  const range = computeUnitMovementAndAttackRange(map, enemy, allLivingUnits);

  // --------------------------------------------------------------------------
  // 1. Evaluate all reachable attack candidates `(stopTile, move, playerTarget)`
  // --------------------------------------------------------------------------
  interface ScoredAttackCandidate {
    stopX: number;
    stopY: number;
    stopCost: number;
    targetUnitId: string;
    moveId: string;
    forecast: CombatForecast;
    score: number;
  }

  const attackCandidates: ScoredAttackCandidate[] = [];

  for (const stopTile of range.reachableTiles.values()) {
    for (const target of playerUnits) {
      const dist = manhattanDistance(stopTile.x, stopTile.y, target.x, target.y);
      const validMoves = getOffensiveMovesAtDistance(enemy, dist);
      if (validMoves.length === 0) continue;

      for (const moveSlot of validMoves) {
        const forecast = computeCombatForecast(map, enemy, target, moveSlot.id, {
          x: stopTile.x,
          y: stopTile.y,
        });
        if (!forecast) continue;

        const expectedDamageDealt =
          forecast.attackerSide.damage *
          forecast.attackerSide.strikes *
          (forecast.attackerSide.hitRate / 100);

        const expectedDamageTaken = forecast.defenderSide
          ? forecast.defenderSide.damage *
            forecast.defenderSide.strikes *
            (forecast.defenderSide.hitRate / 100)
          : 0;

        const killsTarget = forecast.projectedDefenderHp <= 0;
        const diesOnCounter = !killsTarget && forecast.projectedAttackerHp <= 0;

        let score = 0;
        if (killsTarget) {
          score += 1000;
          if (target.isLord) score += 500;
        }
        if (target.isLord) {
          score += 14;
        }
        score += expectedDamageDealt * 5;
        if (!forecast.defenderCanCounter) {
          // Prioritize unanswered strikes where player's [E] move cannot counter at this range
          score += 28;
        }
        score -= expectedDamageTaken * 2;
        if (diesOnCounter) {
          score -= 180;
        }
        score +=
          forecast.attackerTerrainBonuses.defBonus * 6 +
          forecast.attackerTerrainBonuses.avoidBonus * 0.4;
        score -= stopTile.cost * 0.45;

        // Slight tie-breaker for continuing to use already-equipped move
        if (moveSlot.id === enemy.equippedMoveId) {
          score += 0.2;
        }

        attackCandidates.push({
          stopX: stopTile.x,
          stopY: stopTile.y,
          stopCost: stopTile.cost,
          targetUnitId: target.id,
          moveId: moveSlot.id,
          forecast,
          score,
        });
      }
    }
  }

  if (attackCandidates.length > 0) {
    attackCandidates.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
      if (a.stopCost !== b.stopCost) return a.stopCost - b.stopCost;
      return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
    });

    for (const best of attackCandidates) {
      const path = findShortestPathAStar(
        map,
        enemy,
        best.stopX,
        best.stopY,
        allLivingUnits
      );
      if (path) {
        return {
          kind: 'attack',
          enemyId: enemy.id,
          stopX: best.stopX,
          stopY: best.stopY,
          path,
          attack: {
            targetUnitId: best.targetUnitId,
            moveId: best.moveId,
            forecast: best.forecast,
            score: best.score,
          },
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. No player unit in immediate attack range -> Terrain-Aware Pursuit
  // --------------------------------------------------------------------------
  const pursuitTile = pickBestPursuitTile(
    map,
    enemy,
    playerUnits,
    range.reachableTiles,
    allLivingUnits
  );

  if (pursuitTile && (pursuitTile.x !== enemy.x || pursuitTile.y !== enemy.y)) {
    const path = findShortestPathAStar(
      map,
      enemy,
      pursuitTile.x,
      pursuitTile.y,
      allLivingUnits
    );
    if (path && path.length > 1) {
      return {
        kind: 'pursue',
        enemyId: enemy.id,
        stopX: pursuitTile.x,
        stopY: pursuitTile.y,
        path,
        attack: null,
      };
    }
  }

  return {
    kind: 'wait',
    enemyId: enemy.id,
    stopX: enemy.x,
    stopY: enemy.y,
    path: stayPath,
    attack: null,
  };
}

function pickBestPursuitTile(
  map: DungeonMapDefinition,
  enemy: BattleUnitState,
  playerUnits: ReadonlyArray<BattleUnitState>,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): ReachableTileInfo | null {
  const offensiveMoves = enemy.activeMoves.filter(
    (s) => s.ppRemaining > 0 && isOffensiveMove(s.move)
  );
  // Preferred engagement distance (`1` if enemy has a melee move, `2` if pure Special caster)
  const preferredDistances = new Set<number>();
  for (const m of offensiveMoves) {
    preferredDistances.add(m.range[0]);
  }
  if (preferredDistances.size === 0) {
    preferredDistances.add(1);
  }

  const playerOccupied = new Set<string>();
  const otherEnemyOccupied = new Set<string>();
  for (const u of allLivingUnits) {
    if (u.id === enemy.id || u.defeated || u.currentHp <= 0) continue;
    const k = coordKey(u.x, u.y);
    if (u.faction === 'player') {
      playerOccupied.add(k);
    } else {
      otherEnemyOccupied.add(k);
    }
  }

  // Seed goal tiles around living player units at `preferredDistances`
  const distField = new Map<string, number>();
  const queue: Array<{ x: number; y: number; cost: number }> = [];

  const seedGoalsAtDistances = (distances: Iterable<number>, allowOccupiedByAlly: boolean) => {
    for (const pu of playerUnits) {
      for (const r of distances) {
        for (let dy = -r; dy <= r; dy++) {
          const rem = r - Math.abs(dy);
          for (let dx of rem === 0 ? [0] : [-rem, rem]) {
            const gx = pu.x + dx;
            const gy = pu.y + dy;
            if (!isInMapBounds(map, gx, gy)) continue;
            const gKey = coordKey(gx, gy);
            if (playerOccupied.has(gKey)) continue;
            if (!allowOccupiedByAlly && otherEnemyOccupied.has(gKey)) continue;
            const terrain = getMapTerrainAt(map, gx, gy);
            if (!terrain || getTerrainMoveCost(terrain, enemy) === null) continue;
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

  // Reverse Dijkstra: cost to advance from `(nx, ny)` into `(cur.x, cur.y)` is `stepCost(cur.x, cur.y)`
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
    const enterCurCost = curTerrain ? getTerrainMoveCost(curTerrain, enemy) : null;
    if (enterCurCost === null) continue;

    for (const [dx, dy] of ORTHO_DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isInMapBounds(map, nx, ny)) continue;
      const nKey = coordKey(nx, ny);
      // Enemy cannot pass through player units
      if (playerOccupied.has(nKey)) continue;

      const nTerrain = getMapTerrainAt(map, nx, ny);
      if (!nTerrain) continue;
      // Starting tile `(enemy.x, enemy.y)` is always valid; other tiles must be passable for `enemy`
      if ((nx !== enemy.x || ny !== enemy.y) && getTerrainMoveCost(nTerrain, enemy) === null) {
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

  const originKey = coordKey(enemy.x, enemy.y);
  const originGoalDist = distField.get(originKey) ?? Number.POSITIVE_INFINITY;

  const nearestPlayerManhattan = (tx: number, ty: number): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const pu of playerUnits) {
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
    const manh = nearestPlayerManhattan(stop.x, stop.y);
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, enemy);
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

  // Only move if it makes real progress or improves position
  if (
    bestStop &&
    Number.isFinite(originGoalDist) &&
    bestGoalDist > originGoalDist
  ) {
    return reachableTiles.get(originKey) ?? bestStop;
  }

  return bestStop;
}
