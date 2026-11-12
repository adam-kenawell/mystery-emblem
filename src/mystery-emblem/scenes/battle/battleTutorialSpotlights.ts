/**
 * Quaquaval Interactive Tutorial Canvas Tile Spotlight Queries for `BattleScene`
 */

import {
  PROLOGUE_LEVEL_ID,
  PROLOGUE_PARTNER_TUTORIAL_TILE,
} from '../../data/chapters/prologue/tutorialStaging';
import { getItemById, getSpeciesById } from '../../data/index';
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

/** The partner (Quaxly line) for scripted Prologue footwork & Paralyze Heal drills. */
export function getTutorialPartnerUnit(state: BattleRuntimeState): BattleUnitState | undefined {
  const players = getLivingPlayers(state);
  const byLine = players.find((u) => getSpeciesById(u.speciesId)?.lineId === 'quaxly_line');
  if (byLine) return byLine;
  const healerId = getTutorialHealerUnit(state)?.id;
  return players.find((u) => !u.isLord && u.id !== healerId) ?? players[1];
}

/**
 * Prologue tutorial moves are forced onto exact tiles when appropriate:
 * - Turn 1 ({partner}): `PROLOGUE_PARTNER_TUTORIAL_TILE` inside Quaquaval's reach.
 * - Turn 2 ({lord}): cheapest free tile exactly 2 spaces from sparring Quaquaval (Range-2 Dragon Breath).
 * - Turn 3 ({partner} holding Paralyze Heal): stay on current tile `{ x: selected.x, y: selected.y }` to open Item menu immediately.
 */
export function getForcedTutorialMoveTile(
  state: BattleRuntimeState
): { x: number; y: number } | null {
  if (state.activeLevelId !== PROLOGUE_LEVEL_ID) return null;
  const selected = getSelectedUnit(state);
  if (!selected || !state.currentRange) return null;
  const reachable = state.currentRange.reachableTiles;

  if (state.turnNumber === 1) {
    const partner = getTutorialPartnerUnit(state);
    if (partner && selected.id === partner.id) {
      const tile = PROLOGUE_PARTNER_TUTORIAL_TILE;
      return reachable.has(coordKey(tile.x, tile.y)) ? { ...tile } : null;
    }
    return null;
  }

  if (state.turnNumber === 2 && selected.isLord) {
    const mentor = getLivingEnemies(state).find((e) => e.sparring);
    if (!mentor) return null;
    const occupied = new Set(
      getLivingUnits(state)
        .filter((u) => u.id !== selected.id)
        .map((u) => coordKey(u.x, u.y))
    );
    let best: { x: number; y: number; cost: number } | null = null;
    for (const [key, info] of reachable) {
      if (occupied.has(key)) continue;
      const pt = parseCoordKey(key);
      if (manhattanDistance(pt.x, pt.y, mentor.x, mentor.y) !== 2) continue;
      if (!best || info.cost < best.cost) best = { ...pt, cost: info.cost };
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  if (state.turnNumber === 3 && selected.consumableItemId === 'paralyze_heal') {
    return { x: selected.x, y: selected.y };
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

  if (filter === 'partner_unit') {
    const partner = getTutorialPartnerUnit(state);
    if (!partner || partner.defeated || partner.currentHp <= 0) return [];
    return [{ x: partner.x, y: partner.y }];
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
