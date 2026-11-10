/**
 * Wimpod Interactive Tutorial Canvas Tile Spotlight Queries for `BattleScene`
 */

import {
  PROLOGUE_LEVEL_ID,
  PROLOGUE_LORD_TUTORIAL_TILE,
} from '../../data/chapters/prologue/tutorialStaging';
import { getItemById } from '../../data/index';
import type {
  TutorialActionTriggerId,
  TutorialBattleTileFilter,
} from '../../data/tutorialRegistry';
import {
  findBestAttackPlanForTarget,
  manhattanDistance,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { coordKey, parseCoordKey } from '../../engine/terrainAndPathfinding';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import type { BattleRuntimeState } from './battleTypesAndState';
import {
  getAttackableEnemiesFromCurrentTile,
  getLivingEnemies,
  getLivingPlayers,
  getLivingUnits,
  getLordUnit,
  getSelectedUnit,
} from './battleUnitQueries';

/** The healer for scripted heal drills: first living non-lord player unit that knows a heal move. */
export function getTutorialHealerUnit(state: BattleRuntimeState): BattleUnitState | undefined {
  return getLivingPlayers(state).find(
    (u) => !u.isLord && u.activeMoves.some((s) => s.move.supportSubkind === 'heal')
  );
}

/**
 * Prologue lord tutorial moves are forced onto one tile:
 * - Turn 1: the staged tile just inside Sir Empoleon's reach (he then advances and strikes).
 * - Turn 2: the cheapest free tile exactly 2 away from the sparring partner (Special R2 strike,
 *   which his Physical-only [E] cannot counter).
 * Returns null everywhere else (or if no such tile is reachable).
 */
export function getForcedTutorialMoveTile(
  state: BattleRuntimeState
): { x: number; y: number } | null {
  if (state.activeLevelId !== PROLOGUE_LEVEL_ID) return null;
  const selected = getSelectedUnit(state);
  if (!selected?.isLord || !state.currentRange) return null;
  const reachable = state.currentRange.reachableTiles;

  if (state.turnNumber === 1) {
    const tile = PROLOGUE_LORD_TUTORIAL_TILE;
    return reachable.has(coordKey(tile.x, tile.y)) ? { ...tile } : null;
  }
  if (state.turnNumber === 2) {
    const partner = getLivingEnemies(state).find((e) => e.sparring);
    if (!partner) return null;
    const occupied = new Set(
      getLivingUnits(state)
        .filter((u) => u.id !== selected.id)
        .map((u) => coordKey(u.x, u.y))
    );
    let best: { x: number; y: number; cost: number } | null = null;
    for (const [key, info] of reachable) {
      if (occupied.has(key)) continue;
      const pt = parseCoordKey(key);
      if (manhattanDistance(pt.x, pt.y, partner.x, partner.y) !== 2) continue;
      if (!best || info.cost < best.cost) best = { ...pt, cost: info.cost };
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  return null;
}

export function getExpectedTutorialAction(
  tutorialOverlay?: TutorialOverlay
): TutorialActionTriggerId | null {
  return tutorialOverlay?.getExpectedAction() ?? null;
}

export function getAttackableEnemiesForSelectedState(
  state: BattleRuntimeState
): BattleUnitState[] {
  const selected = getSelectedUnit(state);
  if (!selected) return [];
  if (state.interactionState === 'action_menu') {
    return getAttackableEnemiesFromCurrentTile(state, selected).map((entry) => entry.enemy);
  }
  if (state.interactionState === 'unit_selected' && state.currentRange) {
    const livingUnits = getLivingUnits(state);
    return getLivingEnemies(state).filter(
      (enemy) =>
        findBestAttackPlanForTarget(
          state.map,
          selected,
          enemy,
          state.currentRange!.reachableTiles,
          livingUnits
        ) !== null
    );
  }
  return [];
}

export function getHealOrConsumableTutorialUnits(state: BattleRuntimeState): BattleUnitState[] {
  const unwaitedPlayers = getLivingPlayers(state).filter((u) => !u.waited);
  return unwaitedPlayers.filter((u) => {
    const hasSupportHeal = u.activeMoves.some(
      (slot) => slot.move.category === 'Support/Heal' && slot.ppRemaining > 0
    );
    if (hasSupportHeal) return true;
    if (u.consumableItemId) {
      const item = getItemById(u.consumableItemId);
      return item?.category === 'consumable';
    }
    return false;
  });
}

export function resolveTutorialSpotlightTiles(
  state: BattleRuntimeState,
  prepOverlay: DungeonPrepOverlay,
  filter: TutorialBattleTileFilter
): Array<{ x: number; y: number }> {
  if (filter === 'prep_swap_slots') {
    if (state.phase !== 'dungeon_prep' || prepOverlay.getSubMode() !== 'view_map') {
      return [];
    }
    return state.deploymentSlots.map((slot) => ({ x: slot.x, y: slot.y }));
  }

  if (state.phase !== 'player_phase') return [];

  if (filter === 'lord_unit') {
    const lord = getLordUnit(state);
    if (!lord || lord.defeated || lord.currentHp <= 0) return [];
    return [{ x: lord.x, y: lord.y }];
  }

  if (filter === 'healer_unit') {
    const healer = getTutorialHealerUnit(state);
    return healer ? [{ x: healer.x, y: healer.y }] : [];
  }

  if (filter === 'empty_floor') {
    const living = getLivingUnits(state);
    const occupied = new Set(living.map((u) => coordKey(u.x, u.y)));
    const anchor = getLordUnit(state) ?? getLivingPlayers(state)[0];
    const nearTiles: Array<{ x: number; y: number }> = [];
    const fallbackTiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < state.map.height; y++) {
      const row = state.map.tiles[y];
      if (!row) continue;
      for (let x = 0; x < state.map.width; x++) {
        const cell = row[x];
        if (!cell || cell.terrainType !== 'floor') continue;
        if (occupied.has(coordKey(x, y))) continue;
        fallbackTiles.push({ x, y });
        if (anchor) {
          const dist = manhattanDistance(anchor.x, anchor.y, x, y);
          if (dist >= 1 && dist <= 2) nearTiles.push({ x, y });
        }
      }
    }
    return nearTiles.length > 0 ? nearTiles : fallbackTiles.slice(0, 8);
  }

  if (filter === 'reachable_move') {
    const selected = getSelectedUnit(state);
    if (!selected || !state.currentRange || state.interactionState !== 'unit_selected') {
      return [];
    }
    const forced = getForcedTutorialMoveTile(state);
    if (forced) return [forced];
    const occupied = new Set(
      getLivingUnits(state)
        .filter((u) => u.id !== selected.id)
        .map((u) => coordKey(u.x, u.y))
    );
    const nonOrigin: Array<{ x: number; y: number }> = [];
    for (const key of state.currentRange.reachableTiles.keys()) {
      if (occupied.has(key)) continue;
      const pt = parseCoordKey(key);
      if (pt.x !== selected.x || pt.y !== selected.y) nonOrigin.push(pt);
    }
    return nonOrigin.length > 0 ? nonOrigin : [{ x: selected.x, y: selected.y }];
  }

  if (filter === 'attackable_enemy') {
    return getAttackableEnemiesForSelectedState(state).map((e) => ({ x: e.x, y: e.y }));
  }

  if (filter === 'wounded_or_healer') {
    return getHealOrConsumableTutorialUnits(state).map((u) => ({ x: u.x, y: u.y }));
  }

  return [];
}
