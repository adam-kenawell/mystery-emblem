/**
 * Unit Queries, Consumable Eligibility & Diagnostic Snapshot Builder for `BattleScene`
 */

import {
  directionFromDelta,
  resolveUnitVisualAssetId,
  type PmdDirection,
} from '../../assets/pmdAssetLoader';
import { hasChapterMapOverride } from '../../data/chapterMapRegistry';
import { getItemById } from '../../data/index';
import {
  getHealingMovesForTargetAtDistance,
  getEnemyTargetingMovesAtDistance,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { EXP_PER_LEVEL, MAX_UNIT_LEVEL } from '../../engine/progressionEngine';
import {
  computeUnitMovementAndAttackRange,
  coordKey,
  getEffectiveMovementPoints,
  type MovementRangeResult,
} from '../../engine/terrainAndPathfinding';
import type { DungeonPrepOverlay } from '../../ui/DungeonPrepOverlay';
import { computeDungeonCameraBounds } from '../../ui/gridViewportMath';
import type { BattleDomRefs } from './battleDomShell';
import type { BattleSceneSnapshot } from './battlePublicTypes';
import type { BattleRuntimeState } from './battleTypesAndState';

type FacingUnit = Pick<BattleUnitState, 'id' | 'faction' | 'x' | 'y' | 'currentHp' | 'defeated' | 'isBoss'>;

/**
 * Cardinal direction from `unit` toward the living boss (nearest living enemy once no boss remains).
 * Ties between axes favor horizontal. Returns null when there is no enemy to face.
 */
export function resolveBossFacingDirection(
  units: ReadonlyArray<FacingUnit>,
  unit: Pick<FacingUnit, 'x' | 'y'>
): PmdDirection | null {
  const enemies = units.filter((u) => u.faction === 'enemy' && !u.defeated && u.currentHp > 0);
  const dist = (u: FacingUnit) => Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y);
  const target =
    enemies.find((u) => u.isBoss) ??
    enemies.reduce<FacingUnit | null>((best, u) => (!best || dist(u) < dist(best) ? u : best), null);
  if (!target) return null;
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy)
    ? directionFromDelta(Math.sign(dx), 0)
    : directionFromDelta(0, Math.sign(dy));
}

/** Turns a unit that just finished its action toward the boss. */
export function faceUnitTowardBoss(state: BattleRuntimeState, unit: BattleUnitState): void {
  const dir = resolveBossFacingDirection(state.units, unit);
  if (dir !== null) unit.direction = dir;
}

/** Waited units render grayed, except the player side during Enemy Phase. */
export function isUnitGrayedOut(
  phase: BattleRuntimeState['phase'],
  unit: Pick<BattleUnitState, 'faction' | 'waited'>
): boolean {
  if (!unit.waited) return false;
  return !(phase === 'enemy_phase' && unit.faction !== 'enemy');
}

export interface AwakeningHpBarColors {
  leftRgb: [number, number, number];
  midRgb: [number, number, number];
  rightRgb: [number, number, number];
  leftHex: string;
  midHex: string;
  rightHex: string;
  cssGradient: string;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgbTuple(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerpChannel(a[0], b[0], t), lerpChannel(a[1], b[1], t), lerpChannel(a[2], b[2], t)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Fire Emblem Awakening-style total-HP gradient:
 * - Low max HP (~15): green on the left -> warm yellow -> red/orange on the right.
 * - As max HP increases (up to ~55+), the gradient shifts progressively into cyan and blue.
 */
export function resolveAwakeningHpBarColors(maxHp: number): AwakeningHpBarColors {
  const safeMax = Math.max(1, Number.isFinite(maxHp) ? maxHp : 15);
  const t = Math.max(0, Math.min(1, (safeMax - 15) / 40));

  const lowLeft: [number, number, number] = [72, 232, 104];
  const midLeft: [number, number, number] = [56, 216, 200];
  const highLeft: [number, number, number] = [40, 136, 248];

  const lowMid: [number, number, number] = [248, 196, 56];
  const midMid: [number, number, number] = [80, 232, 148];
  const highMid: [number, number, number] = [56, 200, 255];

  const lowRight: [number, number, number] = [248, 84, 48];
  const midRight: [number, number, number] = [184, 232, 96];
  const highRight: [number, number, number] = [88, 240, 232];

  const leftRgb =
    t <= 0.5 ? lerpRgbTuple(lowLeft, midLeft, t * 2) : lerpRgbTuple(midLeft, highLeft, (t - 0.5) * 2);
  const midRgb =
    t <= 0.5 ? lerpRgbTuple(lowMid, midMid, t * 2) : lerpRgbTuple(midMid, highMid, (t - 0.5) * 2);
  const rightRgb =
    t <= 0.5
      ? lerpRgbTuple(lowRight, midRight, t * 2)
      : lerpRgbTuple(midRight, highRight, (t - 0.5) * 2);

  const leftHex = rgbToHex(leftRgb);
  const midHex = rgbToHex(midRgb);
  const rightHex = rgbToHex(rightRgb);

  return {
    leftRgb,
    midRgb,
    rightRgb,
    leftHex,
    midHex,
    rightHex,
    cssGradient: `linear-gradient(90deg, ${leftHex} 0%, ${midHex} 50%, ${rightHex} 100%)`,
  };
}

/**
 * Returns `0..1` EXP progress toward the next level for player units, or `null` for non-player units.
 */
export function computeUnitExpProgressRatio(
  unit: Pick<BattleUnitState, 'faction' | 'level' | 'exp'>
): number | null {
  if (unit.faction !== 'player') return null;
  if (unit.level >= MAX_UNIT_LEVEL) return 1;
  const rawExp = typeof unit.exp === 'number' && Number.isFinite(unit.exp) ? unit.exp : 0;
  return Math.max(0, Math.min(1, rawExp / EXP_PER_LEVEL));
}

export interface ExpBarColorInfo {
  rgb: [number, number, number];
  hex: string;
  cssBackground: string;
}

/**
 * EXP bar color: darker deep blue at low EXP (`0`), shifting to bright light blue right before leveling up (`1`).
 */
export function resolveExpBarColor(expRatio: number): ExpBarColorInfo {
  const t = Math.max(0, Math.min(1, Number.isFinite(expRatio) ? expRatio : 0));
  const darkBlue: [number, number, number] = [24, 84, 184];
  const lightBlue: [number, number, number] = [144, 232, 255];
  const rgb = lerpRgbTuple(darkBlue, lightBlue, t);
  const hex = rgbToHex(rgb);
  const startHex = rgbToHex(lerpRgbTuple(darkBlue, lightBlue, t * 0.55));
  return {
    rgb,
    hex,
    cssBackground: `linear-gradient(90deg, ${startHex} 0%, ${hex} 100%)`,
  };
}

/** `"x,y"` keys of every `seize` objective tile (`tile_reached` events that `win_battle`) */
export function getSeizeObjectiveCoords(state: BattleRuntimeState): Set<string> {
  const coords = new Set<string>();
  if (state.objectiveType !== 'seize') return coords;
  for (const ev of state.events) {
    const trig = ev.trigger;
    if (trig.type !== 'tile_reached') continue;
    if (!ev.actions.some((a) => a.type === 'win_battle')) continue;
    if (Array.isArray(trig.tiles) && trig.tiles.length > 0) {
      for (const t of trig.tiles) {
        if (Number.isFinite(t.x) && Number.isFinite(t.y)) {
          coords.add(coordKey(t.x, t.y));
        }
      }
    } else if (
      Number.isFinite(trig.x1) &&
      Number.isFinite(trig.x2) &&
      Number.isFinite(trig.y1) &&
      Number.isFinite(trig.y2)
    ) {
      for (let y = Math.min(trig.y1!, trig.y2!); y <= Math.max(trig.y1!, trig.y2!); y++) {
        for (let x = Math.min(trig.x1!, trig.x2!); x <= Math.max(trig.x1!, trig.x2!); x++) {
          coords.add(coordKey(x, y));
        }
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

export function getActiveInspectedAllyRange(state: BattleRuntimeState): MovementRangeResult | null {
  if (!state.inspectedAllyRangeUnitId) return null;
  const unit = getLivingUnits(state).find((u) => u.id === state.inspectedAllyRangeUnitId);
  if (!unit || !(unit.faction === 'npc' || (unit.faction === 'player' && unit.waited))) {
    state.inspectedAllyRangeUnitId = null;
    state.inspectedAllyRange = null;
    return null;
  }
  return state.inspectedAllyRange;
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
  const activeInspectedRange = getActiveInspectedAllyRange(state);
  const effectiveRange = state.currentRange ?? activeInspectedRange;
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
    moveLearnedModalOpen: !dom.moveLearnedModalBackdropEl.hidden,
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
    traversedMoveCoords: effectiveRange ? [...effectiveRange.traversedCosts.keys()] : [],
    attackBorderCoords: state.currentRange ? [...state.currentRange.attackBorderTiles] : [],
    supportBorderCoords: state.currentRange ? [...state.currentRange.supportBorderTiles] : [],
    allAttackableCoords: state.currentRange ? [...state.currentRange.allAttackableTiles] : [],
    dangerCoords: [...state.currentDanger.combinedDangerTiles],
    inspectedAllyRangeUnitId: activeInspectedRange ? state.inspectedAllyRangeUnitId : null,
  };
}
