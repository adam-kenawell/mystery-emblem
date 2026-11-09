/**
 * Dancer Turn-Refresh Engine (`Oricorio` — `SupportMoveSubkind: 'dance'`)
 *
 * Enforces Lore Bible Dancer rules:
 * - Refreshes an adjacent (`range [1, 1]`) living `'player'` ally who has already waited (`waited === true`)
 * - Strictly forbids Dancer-on-Dancer infinite loops (`!isDancerUnit(target)`)
 */

import type { DungeonMapDefinition, MoveDefinition } from '../../types/schemas';
import {
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  type AStarPathStep,
  type ReachableTileInfo,
} from '../terrainAndPathfinding';
import {
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from './combatTypesAndStats';

export function isDanceMove(move: MoveDefinition | undefined | null): move is MoveDefinition {
  return Boolean(
    move &&
      move.category === 'Support/Heal' &&
      (move.supportSubkind === 'dance' || move.supportPayload?.refreshAllyTurn)
  );
}

export function isDancerUnit(
  unit: Pick<BattleUnitState, 'speciesId' | 'activeMoves'>
): boolean {
  return unit.speciesId === 'oricorio' || unit.activeMoves.some((slot) => isDanceMove(slot.move));
}

export function canUnitBeRefreshedByDance(
  dancer: Pick<BattleUnitState, 'id' | 'speciesId' | 'activeMoves'>,
  target: Pick<
    BattleUnitState,
    'id' | 'faction' | 'defeated' | 'currentHp' | 'waited' | 'speciesId' | 'activeMoves'
  >
): boolean {
  if (dancer.id === target.id) return false;
  if (target.faction !== 'player' || target.defeated || target.currentHp <= 0) return false;
  if (!target.waited) return false;
  if (isDancerUnit(target)) return false;
  return true;
}

export function getDanceMovesForTargetAtDistance(
  dancer: Pick<BattleUnitState, 'id' | 'speciesId' | 'activeMoves'>,
  target: Pick<
    BattleUnitState,
    'id' | 'faction' | 'defeated' | 'currentHp' | 'waited' | 'speciesId' | 'activeMoves'
  >,
  distance: number
): BattleMoveSlot[] {
  if (!canUnitBeRefreshedByDance(dancer, target)) return [];
  return dancer.activeMoves.filter(
    (slot) =>
      slot.ppRemaining > 0 &&
      isDanceMove(slot.move) &&
      (slot.targetType === 'ally' || slot.targetType === 'self_or_ally') &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
  );
}

export interface DirectDancePlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  defaultMoveId: string;
  availableMoves: BattleMoveSlot[];
}

export function findBestDancePlanForAlly(
  map: DungeonMapDefinition,
  dancer: BattleUnitState,
  targetAlly: BattleUnitState,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectDancePlan | null {
  if (!canUnitBeRefreshedByDance(dancer, targetAlly)) return null;

  interface DanceCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
    availableMoves: BattleMoveSlot[];
  }

  const candidates: DanceCandidate[] = [];
  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetAlly.x, targetAlly.y);
    const availableMoves = getDanceMovesForTargetAtDistance(dancer, targetAlly, dist);
    if (availableMoves.length === 0) continue;

    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, dancer);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === dancer.x && stop.y === dancer.y,
      terrainScore: bonuses.defBonus * 10 + bonuses.avoidBonus,
      availableMoves,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(map, dancer, cand.stopX, cand.stopY, allLivingUnits);
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
