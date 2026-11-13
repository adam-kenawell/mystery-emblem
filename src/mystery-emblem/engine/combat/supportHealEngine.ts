/**
 * Support / Heal Forecast & Direct Ally Heal Plan Finder
 */

import type { DungeonMapDefinition, MoveDefinition, TerrainType } from '../../types/schemas';
import {
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  type AStarPathStep,
  type ReachableTileInfo,
} from '../terrainAndPathfinding';
import {
  isHealingMove,
  isShieldMove,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from './combatTypesAndStats';

export function doesUnitNeedHealing(
  target: Pick<BattleUnitState, 'currentHp' | 'maxHp' | 'status'>,
  move: MoveDefinition
): boolean {
  if (isShieldMove(move)) return true;
  const payload = move.supportPayload;
  const curesOnly = Boolean(payload?.cureStatus && !payload.healAmount && !payload.healPercentMaxHp);
  if (!curesOnly && target.currentHp < target.maxHp) return true;
  if (payload?.cureStatus && target.status !== null) return true;
  return false;
}

export function getHealingMovesForTargetAtDistance(
  healer: Pick<BattleUnitState, 'id' | 'activeMoves'>,
  target: Pick<BattleUnitState, 'id' | 'currentHp' | 'maxHp' | 'status'>,
  distance: number
): BattleMoveSlot[] {
  const isSelf = healer.id === target.id;
  return healer.activeMoves.filter((slot) => {
    if (slot.ppRemaining <= 0 || !isHealingMove(slot.move)) return false;
    if (!doesUnitNeedHealing(target, slot.move)) return false;
    if (isSelf) {
      return (
        distance === 0 &&
        (slot.targetType === 'self' || slot.targetType === 'self_or_ally')
      );
    }
    return (
      (slot.targetType === 'ally' || slot.targetType === 'self_or_ally') &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
    );
  });
}

export interface HealForecast {
  distance: number;
  healerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  healerTerrain: TerrainType;
  targetTerrain: TerrainType;
  move: MoveDefinition;
  ppBefore: number;
  ppAfter: number;
  healPower: number;
  actualHeal: number;
  projectedTargetHp: number;
  curesStatus: boolean;
  /** Set for shield moves: damage reduction applied instead of HP. */
  shield: { reduction: number; turns: number; category?: 'Physical' | 'Special' } | null;
}

export function computeHealForecast(
  map: DungeonMapDefinition,
  healer: BattleUnitState,
  target: BattleUnitState,
  moveId: string,
  healerPosOverride?: { x: number; y: number }
): HealForecast | null {
  const hx = healerPosOverride?.x ?? healer.x;
  const hy = healerPosOverride?.y ?? healer.y;
  const distance = healer.id === target.id ? 0 : manhattanDistance(hx, hy, target.x, target.y);

  const validSlots = getHealingMovesForTargetAtDistance(healer, target, distance);
  const slot = validSlots.find((s) => s.id === moveId) ?? validSlots[0];
  if (!slot) return null;

  const payload = slot.move.supportPayload;
  const isShield = isShieldMove(slot.move);
  let healPower = 10;
  if (isShield) {
    healPower = 0;
  } else if (payload?.healPercentMaxHp) {
    healPower = Math.max(1, Math.round((target.maxHp * payload.healPercentMaxHp) / 100));
  } else if (payload?.healAmount) {
    healPower = Math.max(1, payload.healAmount + Math.floor(healer.stats.spa / 2));
  } else if (payload?.cureStatus) {
    healPower = 0;
  }

  const actualHeal = Math.max(0, Math.min(target.maxHp - target.currentHp, healPower));
  const projectedTargetHp = Math.min(target.maxHp, target.currentHp + actualHeal);
  const healerTerrain = getMapTerrainAt(map, hx, hy) ?? 'floor';
  const targetTerrain = getMapTerrainAt(map, target.x, target.y) ?? 'floor';

  return {
    distance,
    healerPos: { x: hx, y: hy },
    targetPos: { x: target.x, y: target.y },
    healerTerrain,
    targetTerrain,
    move: slot.move,
    ppBefore: slot.ppRemaining,
    ppAfter: Math.max(0, slot.ppRemaining - 1),
    healPower,
    actualHeal,
    projectedTargetHp,
    curesStatus: Boolean(payload?.cureStatus && target.status !== null),
    shield: isShield
      ? {
          reduction: payload?.shieldDamageReduction ?? 0,
          turns: Math.max(1, payload?.durationTurns ?? 1),
          category: payload?.shieldCategory,
        }
      : null,
  };
}

export interface DirectHealPlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  defaultMoveId: string;
  availableMoves: BattleMoveSlot[];
}

export function findBestHealPlanForAlly(
  map: DungeonMapDefinition,
  healer: BattleUnitState,
  targetAlly: BattleUnitState,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectHealPlan | null {
  if (healer.id === targetAlly.id) return null;

  interface HealCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
    availableMoves: BattleMoveSlot[];
  }

  const candidates: HealCandidate[] = [];
  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetAlly.x, targetAlly.y);
    const availableMoves = getHealingMovesForTargetAtDistance(healer, targetAlly, dist);
    if (availableMoves.length === 0) continue;

    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, healer);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === healer.x && stop.y === healer.y,
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
    const path = findShortestPathAStar(map, healer, cand.stopX, cand.stopY, allLivingUnits);
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
