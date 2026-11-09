/**
 * Pure Declarative Dungeon Event Evaluator & `Talk` Path Planner (`eventEvaluator.ts`)
 *
 * Zero DOM dependencies — evaluates `DungeonEventDefinition` triggers and conditions
 * against live `BattleUnitState[]` for `turn_start`, `talk`, `unit_defeated`,
 * `tile_reached`, and `battle_victory`.
 */

import { getSpeciesById } from '../../data/index';
import type {
  BattleObjectiveType,
  DungeonEventDefinition,
  DungeonEventTrigger,
  DungeonMapDefinition,
} from '../../types/schemas';
import { manhattanDistance, type BattleUnitState } from '../combatEngine';
import {
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  type AStarPathStep,
  type ReachableTileInfo,
} from '../terrainAndPathfinding';

export function resolveDefaultObjectiveLabel(
  objectiveType: BattleObjectiveType,
  surviveTurns?: number
): string {
  switch (objectiveType) {
    case 'defeat_boss':
      return 'Defeat the Enemy Leader';
    case 'survive_turns':
      return `Survive ${Math.max(1, surviveTurns ?? 5)} Turns`;
    case 'protect_npc':
      return 'Protect Allied Units & Defeat Foes';
    default:
      return 'Rout All Enemies';
  }
}

function isEventEligibleToFire(
  event: DungeonEventDefinition,
  triggeredEventIds: ReadonlySet<string>,
  units: ReadonlyArray<BattleUnitState>
): boolean {
  if (event.once !== false && triggeredEventIds.has(event.id)) {
    return false;
  }
  if (!event.conditions || event.conditions.length === 0) {
    return true;
  }
  for (const cond of event.conditions) {
    if (cond.kind === 'unit_alive') {
      const u = units.find((item) => item.id === cond.unitId);
      if (!u || u.defeated || u.currentHp <= 0) return false;
    } else if (cond.kind === 'unit_defeated') {
      const u = units.find((item) => item.id === cond.unitId);
      if (u && !u.defeated && u.currentHp > 0) return false;
    } else if (cond.kind === 'event_triggered') {
      const fired = triggeredEventIds.has(cond.eventId);
      if (cond.negated ? fired : !fired) return false;
    }
  }
  return true;
}

export function doesUnitMatchTalkInitiator(
  initiator: Pick<BattleUnitState, 'id' | 'faction' | 'isLord' | 'speciesId'>,
  trigger: Extract<DungeonEventTrigger, { type: 'talk' }>
): boolean {
  if (initiator.faction !== 'player') return false;
  if (trigger.initiator === 'lord' && !initiator.isLord) return false;
  if (
    trigger.allowedInitiatorUnitIds &&
    trigger.allowedInitiatorUnitIds.length > 0 &&
    !trigger.allowedInitiatorUnitIds.includes(initiator.id)
  ) {
    return false;
  }
  if (trigger.allowedInitiatorSpeciesIds && trigger.allowedInitiatorSpeciesIds.length > 0) {
    const initLine = getSpeciesById(initiator.speciesId)?.lineId;
    const matches = trigger.allowedInitiatorSpeciesIds.some((spId) => {
      if (spId === initiator.speciesId) return true;
      const reqLine = getSpeciesById(spId)?.lineId;
      return Boolean(initLine && reqLine && initLine === reqLine);
    });
    if (!matches) return false;
  }
  return true;
}

export function getMatchingTurnStartEvents(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  turnNumber: number,
  phase: 'player_phase' | 'enemy_phase',
  units: ReadonlyArray<BattleUnitState>
): DungeonEventDefinition[] {
  return events.filter(
    (ev) =>
      ev.trigger.type === 'turn_start' &&
      ev.trigger.turnNumber === turnNumber &&
      (ev.trigger.phase ?? 'player_phase') === phase &&
      isEventEligibleToFire(ev, triggeredEventIds, units)
  );
}

export function getAvailableTalkEventsForPair(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  initiator: BattleUnitState,
  target: BattleUnitState,
  units: ReadonlyArray<BattleUnitState>
): DungeonEventDefinition[] {
  if (target.defeated || target.currentHp <= 0 || target.id === initiator.id) {
    return [];
  }
  return events.filter(
    (ev) =>
      ev.trigger.type === 'talk' &&
      ev.trigger.targetUnitId === target.id &&
      doesUnitMatchTalkInitiator(initiator, ev.trigger) &&
      isEventEligibleToFire(ev, triggeredEventIds, units)
  );
}

export function getAvailableTalkTargetIds(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  units: ReadonlyArray<BattleUnitState>
): Set<string> {
  const livingPlayers = units.filter(
    (u) => u.faction === 'player' && !u.defeated && u.currentHp > 0
  );
  const targets = new Set<string>();
  for (const ev of events) {
    if (ev.trigger.type !== 'talk') continue;
    if (!isEventEligibleToFire(ev, triggeredEventIds, units)) continue;
    const target = units.find(
      (u) => u.id === (ev.trigger as { targetUnitId: string }).targetUnitId
    );
    if (!target || target.defeated || target.currentHp <= 0) continue;
    if (livingPlayers.some((p) => doesUnitMatchTalkInitiator(p, ev.trigger as Extract<DungeonEventTrigger, { type: 'talk' }>))) {
      targets.add(target.id);
    }
  }
  return targets;
}

export interface DirectTalkPlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  event: DungeonEventDefinition;
}

export function findBestTalkPlanForTarget(
  map: DungeonMapDefinition,
  initiator: BattleUnitState,
  target: BattleUnitState,
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectTalkPlan | null {
  const matchingEvents = getAvailableTalkEventsForPair(
    events,
    triggeredEventIds,
    initiator,
    target,
    allLivingUnits
  );
  if (matchingEvents.length === 0) return null;

  interface AdjCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
  }

  const candidates: AdjCandidate[] = [];
  for (const stop of reachableTiles.values()) {
    if (manhattanDistance(stop.x, stop.y, target.x, target.y) !== 1) continue;
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, initiator);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === initiator.x && stop.y === initiator.y,
      terrainScore: bonuses.defBonus * 10 + bonuses.avoidBonus,
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
    const path = findShortestPathAStar(map, initiator, cand.stopX, cand.stopY, allLivingUnits);
    if (path) {
      return {
        stopX: cand.stopX,
        stopY: cand.stopY,
        path,
        event: matchingEvents[0]!,
      };
    }
  }
  return null;
}

export function getMatchingUnitDefeatedEvents(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  defeatedUnitId: string,
  units: ReadonlyArray<BattleUnitState>
): DungeonEventDefinition[] {
  return events.filter(
    (ev) =>
      ev.trigger.type === 'unit_defeated' &&
      ev.trigger.targetUnitId === defeatedUnitId &&
      isEventEligibleToFire(ev, triggeredEventIds, units)
  );
}

export function getMatchingTileReachedEvents(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  unit: BattleUnitState,
  units: ReadonlyArray<BattleUnitState>
): DungeonEventDefinition[] {
  if (unit.faction !== 'player' || unit.defeated || unit.currentHp <= 0) return [];
  return events.filter((ev) => {
    if (ev.trigger.type !== 'tile_reached') return false;
    if (ev.trigger.by === 'lord' && !unit.isLord) return false;
    const minX = Math.min(ev.trigger.x1, ev.trigger.x2);
    const maxX = Math.max(ev.trigger.x1, ev.trigger.x2);
    const minY = Math.min(ev.trigger.y1, ev.trigger.y2);
    const maxY = Math.max(ev.trigger.y1, ev.trigger.y2);
    if (unit.x < minX || unit.x > maxX || unit.y < minY || unit.y > maxY) return false;
    return isEventEligibleToFire(ev, triggeredEventIds, units);
  });
}

export function getMatchingVictoryEvents(
  events: ReadonlyArray<DungeonEventDefinition>,
  triggeredEventIds: ReadonlySet<string>,
  units: ReadonlyArray<BattleUnitState>
): DungeonEventDefinition[] {
  return events.filter((ev) => {
    if (ev.trigger.type !== 'battle_victory') return false;
    if (!isEventEligibleToFire(ev, triggeredEventIds, units)) return false;
    if (ev.trigger.requireSurvivedUnitIds && ev.trigger.requireSurvivedUnitIds.length > 0) {
      const allSurvived = ev.trigger.requireSurvivedUnitIds.every((uid) => {
        const u = units.find((item) => item.id === uid);
        return Boolean(u && !u.defeated && u.currentHp > 0);
      });
      if (!allSurvived) return false;
    }
    return true;
  });
}
