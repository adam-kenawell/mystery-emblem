/**
 * Unit Queries, Consumable Eligibility & Diagnostic Snapshot Builder for `BattleScene`
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import { hasChapterMapOverride } from '../../data/chapterMapRegistry';
import { getItemById } from '../../data/index';
import {
  getHealingMovesForTargetAtDistance,
  getEnemyTargetingMovesAtDistance,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { getEligibleEvolutionBranches } from '../../engine/progressionEngine';
import {
  computeUnitMovementAndAttackRange,
  coordKey,
  getEffectiveMovementPoints,
} from '../../engine/terrainAndPathfinding';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import { computeDungeonCameraBounds } from '../../ui/gridViewportMath';
import type { BattleDomRefs } from './battleDomShell';
import type { BattleSceneSnapshot } from './battlePublicTypes';
import type { BattleRuntimeState } from './battleTypesAndState';

/** `"x,y"` keys of every `seize` objective tile (`tile_reached` events that `win_battle`) */
export function getSeizeObjectiveCoords(state: BattleRuntimeState): Set<string> {
  const coords = new Set<string>();
  if (state.objectiveType !== 'seize') return coords;
  for (const ev of state.events) {
    const trig = ev.trigger;
    if (trig.type !== 'tile_reached') continue;
    if (!ev.actions.some((a) => a.type === 'win_battle')) continue;
    for (let y = Math.min(trig.y1, trig.y2); y <= Math.max(trig.y1, trig.y2); y++) {
      for (let x = Math.min(trig.x1, trig.x2); x <= Math.max(trig.x1, trig.x2); x++) {
        coords.add(coordKey(x, y));
      }
    }
  }
  return coords;
}

export function getUnitVisualKey(
  unit: Pick<BattleUnitState, 'speciesId' | 'cosmeticForm'>
): string {
  return resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);
}

export function getLivingUnits(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter((u) => !u.defeated && u.currentHp > 0);
}

export function getRenderableUnits(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter((u) => !u.defeated);
}

export function getLivingPlayers(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter((u) => u.faction === 'player' && !u.defeated && u.currentHp > 0);
}

export function getLivingNpcs(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter((u) => u.faction === 'npc' && !u.defeated && u.currentHp > 0);
}

export function getLivingAlliedUnits(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter(
    (u) => (u.faction === 'player' || u.faction === 'npc') && !u.defeated && u.currentHp > 0
  );
}

export function getLivingEnemies(state: BattleRuntimeState): BattleUnitState[] {
  return state.units.filter((u) => u.faction === 'enemy' && !u.defeated && u.currentHp > 0);
}

export function getLordUnit(state: BattleRuntimeState): BattleUnitState | undefined {
  return (
    state.units.find((u) => u.faction === 'player' && u.isLord) ??
    state.units.find((u) => u.faction === 'player')
  );
}

export function getSelectedUnit(state: BattleRuntimeState): BattleUnitState | null {
  if (!state.selectedUnitId) return null;
  return (
    state.units.find((u) => u.id === state.selectedUnitId && !u.defeated && u.currentHp > 0) ??
    null
  );
}

export function isLordDefeated(state: BattleRuntimeState): boolean {
  const lord = getLordUnit(state);
  if (!lord) return getLivingPlayers(state).length === 0;
  return lord.defeated || lord.currentHp <= 0;
}

export function areAllLivingPlayersWaited(state: BattleRuntimeState): boolean {
  const livingPlayers = getLivingPlayers(state);
  return livingPlayers.length > 0 && livingPlayers.every((u) => u.waited);
}

export function recomputeSelectedUnitRange(state: BattleRuntimeState): void {
  const unit = getSelectedUnit(state);
  if (!unit) {
    state.currentRange = null;
    return;
  }
  state.currentRange = computeUnitMovementAndAttackRange(state.map, unit, getLivingUnits(state));
}

export function getAttackableEnemiesFromCurrentTile(
  state: BattleRuntimeState,
  unit: BattleUnitState
): Array<{ enemy: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> {
  const out: Array<{ enemy: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> = [];
  for (const enemy of getLivingEnemies(state)) {
    const dist = manhattanDistance(unit.x, unit.y, enemy.x, enemy.y);
    const moves = getEnemyTargetingMovesAtDistance(unit, dist);
    if (moves.length > 0) out.push({ enemy, distance: dist, moves });
  }
  return out;
}

export function getHealableTargetsFromCurrentTile(
  state: BattleRuntimeState,
  unit: BattleUnitState
): Array<{ ally: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> {
  const out: Array<{ ally: BattleUnitState; distance: number; moves: BattleMoveSlot[] }> = [];
  for (const ally of getLivingAlliedUnits(state)) {
    if (ally.id === unit.id) continue;
    const dist = manhattanDistance(unit.x, unit.y, ally.x, ally.y);
    const moves = getHealingMovesForTargetAtDistance(unit, ally, dist);
    if (moves.length > 0) out.push({ ally, distance: dist, moves });
  }
  const selfMoves = getHealingMovesForTargetAtDistance(unit, unit, 0);
  if (selfMoves.length > 0) out.push({ ally: unit, distance: 0, moves: selfMoves });
  return out;
}

export function canUseUnitEquippedConsumable(unit: BattleUnitState): boolean {
  if (!unit.consumableItemId) return false;
  const item = getItemById(unit.consumableItemId);
  if (!item) return false;
  if (item.category === 'x_item') return true;
  if (item.category === 'promotion') {
    return getEligibleEvolutionBranches(unit.speciesId, unit.level, item.id).length > 0;
  }
  if (item.category === 'consumable') {
    const canHeal =
      Boolean(item.effect.healFlat || item.effect.healFull) && unit.currentHp < unit.maxHp;
    const canCureAny = Boolean(item.effect.cureStatus) && unit.status !== null;
    const canCureSpecific =
      Boolean(item.effect.cureSpecificStatus) && unit.status === item.effect.cureSpecificStatus;
    return canHeal || canCureAny || canCureSpecific;
  }
  return false;
}

export function escapeHudHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBattleSceneSnapshot(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  prepOverlay: DungeonPrepOverlay
): BattleSceneSnapshot {
  const bounds = computeDungeonCameraBounds(state.map.width, state.map.height, state.cam);
  return {
    isOpen: state.openState,
    phase: state.phase,
    cutsceneInProgress: state.cutsceneInProgress,
    objectiveType: state.objectiveType,
    objectiveLabel: state.objectiveLabel,
    surviveTurns: state.surviveTurns ?? null,
    defeatIfUnitIdsFall: [...state.defeatIfUnitIdsFall],
    prepSubMode:
      state.phase === 'dungeon_prep' && prepOverlay.isOpen() ? prepOverlay.getSubMode() : null,
    deploymentSlots: state.deploymentSlots.map((s) => ({ ...s })),
    prepSwapSlotIndex: state.prepSwapSlotIndex,
    interactionState: state.interactionState,
    turnNumber: state.turnNumber,
    selectedUnitId: state.selectedUnitId,
    forecastMode: state.interactionState === 'combat_forecast' ? state.forecastMode : null,
    forecastTargetId: state.forecastTargetId,
    forecastMoveId: state.forecastMoveId,
    systemMenuOpen: state.systemMenuOpen,
    levelUpModalOpen: !dom.levelUpModalBackdropEl.hidden,
    talkChoiceModalOpen: !dom.talkChoiceBackdropEl.hidden,
    levelUpHistory: state.levelUpHistory.map((h) => ({
      ...h,
      statGains: { ...h.statGains },
      statsBefore: { ...h.statsBefore },
      statsAfter: { ...h.statsAfter },
      newlyLearnedMoveIds: [...h.newlyLearnedMoveIds],
    })),
    collectedDrops: [...state.collectedDrops],
    spawnedReinforcementIds: [...state.spawnedReinforcementIds],
    blockedReinforcementIds: [...state.blockedReinforcementIds],
    triggeredEventIds: [...state.triggeredEventIds],
    globalDangerEnabled: state.globalDangerEnabled,
    trackedEnemyIds: [...state.trackedEnemyIds],
    fastMode: state.fastMode,
    camera: {
      x: state.cam.cameraX,
      y: state.cam.cameraY,
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      bufferWidth: state.cam.bufferWidth,
      bufferHeight: state.cam.bufferHeight,
      displayScale: state.cam.displayScale,
      imageSmoothingEnabled: dom.ctx.imageSmoothingEnabled,
    },
    map: {
      id: state.map.id,
      name: state.map.name,
      width: state.map.width,
      height: state.map.height,
      isCustomized: hasChapterMapOverride(state.map.id),
    },
    units: state.units.map((u) => ({
      id: u.id,
      rosterInstanceId: u.rosterInstanceId ?? null,
      faction: u.faction,
      isLord: u.isLord,
      isBoss: Boolean(u.isBoss),
      mustSurvive: Boolean(u.mustSurvive),
      stationary: Boolean(u.stationary),
      droppableItemId: u.droppableItemId ?? null,
      aiMode: u.aiMode ?? (u.stationary ? 'stationary' : 'wait_until_in_range'),
      speciesId: u.speciesId,
      speciesName: u.speciesName,
      cosmeticForm: u.cosmeticForm,
      spriteAssetKey: getUnitVisualKey(u),
      nickname: u.nickname,
      level: u.level,
      exp: u.exp ?? 0,
      x: u.x,
      y: u.y,
      currentHp: u.currentHp,
      maxHp: u.maxHp,
      mov: u.mov,
      effectiveMov: getEffectiveMovementPoints(u),
      traversalClass: u.traversalClass,
      types: u.types,
      activeMoveIds: u.activeMoves.map((m) => m.id),
      equippedPhysicalMoveId: u.equippedPhysicalMoveId,
      equippedSpecialMoveId: u.equippedSpecialMoveId,
      equippedItemId: u.heldItemId ?? u.consumableItemId ?? null,
      status: u.status,
      waited: u.waited,
      defeated: u.defeated,
    })),
    reachableCoords: state.currentRange ? [...state.currentRange.reachableTiles.keys()] : [],
    attackBorderCoords: state.currentRange ? [...state.currentRange.attackBorderTiles] : [],
    supportBorderCoords: state.currentRange ? [...state.currentRange.supportBorderTiles] : [],
    allAttackableCoords: state.currentRange ? [...state.currentRange.allAttackableTiles] : [],
    dangerCoords: [...state.currentDanger.combinedDangerTiles],
  };
}
