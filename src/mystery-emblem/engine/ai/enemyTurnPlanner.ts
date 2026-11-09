/**
 * Tactical Enemy & Green Allied NPC Phase Action Scoring & Turn Planner
 */

import type { DungeonMapDefinition } from '../../types/schemas';
import {
  computeCombatForecast,
  getOffensiveMovesAtDistance,
  manhattanDistance,
  type BattleUnitState,
  type CombatForecast,
} from '../combatEngine';
import {
  areBattleFactionsAllied,
  computeUnitMovementAndAttackRange,
  coordKey,
  findShortestPathAStar,
  type AStarPathStep,
} from '../terrainAndPathfinding';
import { pickBestPursuitTile } from './aiPursuitField';

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

function chooseAiUnitAction(
  map: DungeonMapDefinition,
  actor: BattleUnitState,
  allLivingUnits: ReadonlyArray<BattleUnitState>,
  priorityTargetIds?: ReadonlySet<string>
): EnemyTurnDecision {
  const stayPath: AStarPathStep[] = [{ x: actor.x, y: actor.y, cumulativeCost: 0 }];

  if (actor.defeated || actor.currentHp <= 0 || actor.status === 'SLP') {
    return {
      kind: 'wait',
      enemyId: actor.id,
      stopX: actor.x,
      stopY: actor.y,
      path: stayPath,
      attack: null,
    };
  }

  const hostileTargets = allLivingUnits.filter(
    (u) => !areBattleFactionsAllied(u.faction, actor.faction) && !u.defeated && u.currentHp > 0
  );
  if (hostileTargets.length === 0) {
    return {
      kind: 'wait',
      enemyId: actor.id,
      stopX: actor.x,
      stopY: actor.y,
      path: stayPath,
      attack: null,
    };
  }

  const range = computeUnitMovementAndAttackRange(map, actor, allLivingUnits);

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
    for (const target of hostileTargets) {
      const dist = manhattanDistance(stopTile.x, stopTile.y, target.x, target.y);
      const validMoves = getOffensiveMovesAtDistance(actor, dist);
      if (validMoves.length === 0) continue;

      for (const moveSlot of validMoves) {
        const forecast = computeCombatForecast(map, actor, target, moveSlot.id, {
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
        const isHighValue =
          target.isLord ||
          Boolean(target.mustSurvive) ||
          Boolean(target.isBoss) ||
          Boolean(priorityTargetIds?.has(target.id));

        let score = 0;
        if (killsTarget) {
          score += 1000;
          if (isHighValue) score += 500;
        }
        if (isHighValue) {
          score += 14;
        }
        score += expectedDamageDealt * 5;
        if (!forecast.defenderCanCounter) {
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

        if (moveSlot.id === actor.equippedMoveId) {
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
        actor,
        best.stopX,
        best.stopY,
        allLivingUnits
      );
      if (path) {
        return {
          kind: 'attack',
          enemyId: actor.id,
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

  const effectiveAiMode =
    actor.stationary || actor.aiMode === 'stationary'
      ? 'stationary'
      : (actor.aiMode ?? 'wait_until_in_range');

  if (effectiveAiMode !== 'aggressive') {
    return {
      kind: 'wait',
      enemyId: actor.id,
      stopX: actor.x,
      stopY: actor.y,
      path: stayPath,
      attack: null,
    };
  }

  const pursuitTile = pickBestPursuitTile(
    map,
    actor,
    hostileTargets,
    range.reachableTiles,
    allLivingUnits
  );

  if (pursuitTile && (pursuitTile.x !== actor.x || pursuitTile.y !== actor.y)) {
    const path = findShortestPathAStar(
      map,
      actor,
      pursuitTile.x,
      pursuitTile.y,
      allLivingUnits
    );
    if (path && path.length > 1) {
      return {
        kind: 'pursue',
        enemyId: actor.id,
        stopX: pursuitTile.x,
        stopY: pursuitTile.y,
        path,
        attack: null,
      };
    }
  }

  return {
    kind: 'wait',
    enemyId: actor.id,
    stopX: actor.x,
    stopY: actor.y,
    path: stayPath,
    attack: null,
  };
}

export function chooseEnemyAction(
  map: DungeonMapDefinition,
  enemy: BattleUnitState,
  allLivingUnits: ReadonlyArray<BattleUnitState>,
  protectedUnitIds?: ReadonlySet<string>
): EnemyTurnDecision {
  return chooseAiUnitAction(map, enemy, allLivingUnits, protectedUnitIds);
}

export function chooseNpcAllyAction(
  map: DungeonMapDefinition,
  npcUnit: BattleUnitState,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): EnemyTurnDecision {
  return chooseAiUnitAction(map, npcUnit, allLivingUnits);
}
