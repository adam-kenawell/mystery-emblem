/**
 * Direct-Click Offensive Attack Plan & Stop-Tile Planner
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  type AStarPathStep,
  type PathfindingUnitContext,
  type ReachableTileInfo,
} from '../terrainAndPathfinding';
import {
  getOffensiveMovesAtDistance,
  isOffensiveMove,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from './combatTypesAndStats';

export interface DirectAttackPlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  defaultMoveId: string;
  availableMoves: BattleMoveSlot[];
}

/**
 * When a player selects `attacker` and directly taps/clicks `targetEnemy`, finds the optimal
 * reachable Blue stopping tile and default offensive move to open the Combat Forecast.
 */
export function findBestAttackPlanForTarget(
  map: DungeonMapDefinition,
  attacker: BattleUnitState,
  targetEnemy: BattleUnitState,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectAttackPlan | null {
  interface Candidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    usesEquippedMove: boolean;
    terrainScore: number;
    availableMoves: BattleMoveSlot[];
  }

  const candidates: Candidate[] = [];

  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
    const availableMoves = getOffensiveMovesAtDistance(attacker, dist);
    if (availableMoves.length === 0) continue;

    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, attacker);
    const terrainScore = bonuses.defBonus * 10 + bonuses.avoidBonus;
    const staysOnOrigin = stop.x === attacker.x && stop.y === attacker.y;
    const usesEquippedMove = availableMoves.some((m) => m.id === attacker.equippedMoveId);

    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin,
      usesEquippedMove,
      terrainScore,
      availableMoves,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.usesEquippedMove !== b.usesEquippedMove) return a.usesEquippedMove ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(map, attacker, cand.stopX, cand.stopY, allLivingUnits);
    if (path) {
      return {
        stopX: cand.stopX,
        stopY: cand.stopY,
        path,
        defaultMoveId: cand.availableMoves[0]!.id,
        availableMoves: cand.availableMoves,
      };
    }
  }

  return null;
}

/**
 * Returns all offensive move slots (`ppRemaining > 0`) on `attacker` that can strike `targetEnemy`
 * from at least one legal stopping tile in `reachableTiles`.
 */
export function getOffensiveMovesReachableForTarget(
  attacker: Pick<BattleUnitState, 'activeMoves' | 'equippedMoveId'>,
  targetEnemy: Pick<BattleUnitState, 'x' | 'y'>,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>
): BattleMoveSlot[] {
  const available: BattleMoveSlot[] = [];
  for (const slot of attacker.activeMoves) {
    if (slot.ppRemaining <= 0 || !isOffensiveMove(slot.move)) continue;
    let canUse = false;
    for (const stop of reachableTiles.values()) {
      const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
      if (dist >= slot.range[0] && dist <= slot.range[1]) {
        canUse = true;
        break;
      }
    }
    if (canUse) {
      available.push(slot);
    }
  }
  available.sort((a, b) => {
    const aEq = a.id === attacker.equippedMoveId ? 0 : 1;
    const bEq = b.id === attacker.equippedMoveId ? 0 : 1;
    return aEq - bEq;
  });
  return available;
}

/**
 * Finds the best legal stopping tile in `reachableTiles` from which `attacker` can execute `moveSlot`
 * against `targetEnemy`, preferring `preferredOrigin` (no movement) or lowest A* cost + best terrain.
 */
export function findBestStopTileForOffensiveMove(
  map: DungeonMapDefinition,
  attackerFromOrigin: PathfindingUnitContext,
  targetEnemy: Pick<BattleUnitState, 'x' | 'y'>,
  moveSlot: BattleMoveSlot,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): { stopX: number; stopY: number; path: AStarPathStep[] } | null {
  interface StopCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
  }
  const candidates: StopCandidate[] = [];

  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
    if (dist < moveSlot.range[0] || dist > moveSlot.range[1]) continue;
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, attackerFromOrigin);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === attackerFromOrigin.x && stop.y === attackerFromOrigin.y,
      terrainScore: bonuses.defBonus * 10 + bonuses.avoidBonus,
    });
  }

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(
      map,
      attackerFromOrigin,
      cand.stopX,
      cand.stopY,
      allLivingUnits
    );
    if (path) {
      return { stopX: cand.stopX, stopY: cand.stopY, path };
    }
  }
  return null;
}
