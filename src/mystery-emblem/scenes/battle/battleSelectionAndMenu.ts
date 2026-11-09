/**
 * Player Unit Selection, Interactive Walk Trigger, Floating Command Menu & Cancel Undo
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import { PMD_TILE_NATIVE_PX } from '../../assets/tilesetLoader';
import { getItemById } from '../../data/index';
import type { BattleUnitState } from '../../engine/combatEngine';
import type { AStarPathStep } from '../../engine/terrainAndPathfinding';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { getDanceableTargetsFromCurrentTile } from './battleDanceController';
import { syncHudControls, syncPrepChromeVisibility } from './battleDangerAndViewportState';
import { getTalkableTargetsFromCurrentTile } from './battleEventRunner';
import { updateBattleInfoStrip } from './battleHudCards';
import {
  getAttackableEnemiesForSelectedState,
  getHealOrConsumableTutorialUnits,
  triggerBattleTutorial,
} from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  canUseUnitEquippedConsumable,
  getAttackableEnemiesFromCurrentTile,
  getHealableTargetsFromCurrentTile,
  getLordUnit,
  getSelectedUnit,
  recomputeSelectedUnitRange,
} from './battleUnitQueries';

export function selectPlayerUnit(ctx: BattleControllerContext, unit: BattleUnitState): void {
  const { state, dom, audioManager, tutorialOverlay } = ctx;
  state.selectedUnitId = unit.id;
  state.touchInspectedUnitId = state.hoveredTile === null ? unit.id : null;
  state.interactionState = 'unit_selected';
  state.selectionPulseStartMs = performance.now();
  state.inspectedTile = { x: unit.x, y: unit.y };
  recomputeSelectedUnitRange(state);
  state.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
  audioManager.playSfx('select');
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();

  let satisfiedTutorialStep = false;
  if (unit.id === getLordUnit(state)?.id) {
    satisfiedTutorialStep =
      Boolean(tutorialOverlay?.notifyActionCompleted('battle_select_lord')) ||
      satisfiedTutorialStep;
  }
  if (getHealOrConsumableTutorialUnits(state).some((u) => u.id === unit.id)) {
    satisfiedTutorialStep =
      Boolean(tutorialOverlay?.notifyActionCompleted('battle_inspect_heal_or_item')) ||
      satisfiedTutorialStep;
  }
  ctx.renderNow();

  if (!satisfiedTutorialStep && getAttackableEnemiesForSelectedState(state).length > 0) {
    void triggerBattleTutorial(ctx, 'ch1_first_combat_forecast');
  }
}

export function startInteractiveWalk(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  path: AStarPathStep[],
  onComplete: () => void
): void {
  const { state, dom } = ctx;
  state.interactionState = 'walking';
  state.touchInspectedUnitId = null;
  unit.action = 'Walk';
  unit.frameIndex = 0;
  state.activeWalk = {
    unitId: unit.id,
    steps: path,
    segmentIndex: 0,
    segmentElapsedMs: 0,
    lastTickMs: performance.now(),
    followCamera: false,
    onComplete,
  };
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
}

export function positionFloatingActionMenu(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const unit = getSelectedUnit(state);
  if (!unit) return;

  const stageW = dom.canvasStageEl.clientWidth || 640;
  const stageH = dom.canvasStageEl.clientHeight || 480;
  const { bufferWidth, bufferHeight, displayScale, cameraX, cameraY } = state.cam;
  const canvasOffsetX = (stageW - bufferWidth * displayScale) / 2;
  const canvasOffsetY = (stageH - bufferHeight * displayScale) / 2;
  const tileDisplayPx = PMD_TILE_NATIVE_PX * displayScale;
  const unitScreenX =
    canvasOffsetX + (unit.x * PMD_TILE_NATIVE_PX - cameraX) * displayScale;
  const unitScreenY =
    canvasOffsetY + (unit.y * PMD_TILE_NATIVE_PX - cameraY) * displayScale;

  const visibleBtnCount =
    2 +
    (dom.cmdTalkBtnEl.hidden ? 0 : 1) +
    (dom.cmdAttackBtnEl.hidden ? 0 : 1) +
    (dom.cmdHealBtnEl.hidden ? 0 : 1) +
    (dom.cmdDanceBtnEl.hidden ? 0 : 1) +
    (dom.cmdItemBtnEl.hidden ? 0 : 1);
  const menuW = 144;
  const menuH = visibleBtnCount * 50 + 14;

  let left = unitScreenX + tileDisplayPx + 8;
  if (left + menuW > stageW - 8) {
    left = unitScreenX - menuW - 8;
  }
  left = Math.max(8, Math.min(stageW - menuW - 8, left));

  let top = unitScreenY - 8;
  const minTop = stageW <= 720 && stageH > 500 ? 110 : 58;
  const maxTop = Math.max(minTop, stageH - menuH - 44);
  top = Math.max(minTop, Math.min(maxTop, top));

  dom.actionMenuEl.style.left = `${Math.round(left)}px`;
  dom.actionMenuEl.style.top = `${Math.round(top)}px`;
}

export function openFloatingCommandMenu(
  ctx: BattleControllerContext,
  unit: BattleUnitState
): void {
  const { state, dom, tutorialOverlay } = ctx;
  state.activeWalk = null;
  unit.action = 'Idle';
  unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
  unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
  state.inspectedTile = { x: unit.x, y: unit.y };
  state.interactionState = 'action_menu';

  const talkTargets = getTalkableTargetsFromCurrentTile(ctx, unit);
  const targets = getAttackableEnemiesFromCurrentTile(state, unit);
  const healTargets = getHealableTargetsFromCurrentTile(state, unit);
  const danceTargets = getDanceableTargetsFromCurrentTile(state, unit);
  const canUseItem = canUseUnitEquippedConsumable(unit);
  dom.cmdTalkBtnEl.hidden = talkTargets.length === 0;
  dom.cmdAttackBtnEl.hidden = targets.length === 0;
  dom.cmdHealBtnEl.hidden = healTargets.length === 0;
  dom.cmdDanceBtnEl.hidden = danceTargets.length === 0;
  dom.cmdItemBtnEl.hidden = !canUseItem;
  if (canUseItem && unit.consumableItemId) {
    const heldItem = getItemById(unit.consumableItemId);
    const labelText = heldItem?.category === 'promotion' ? 'Evolve!' : 'Item';
    dom.cmdItemBtnEl.innerHTML = '';
    dom.cmdItemBtnEl.appendChild(
      createMiniItemIcon(unit.consumableItemId, {
        sizePx: 16,
        cropped: true,
        decorative: true,
      })
    );
    const lblSpan = document.createElement('span');
    lblSpan.textContent = labelText;
    dom.cmdItemBtnEl.appendChild(lblSpan);
  } else {
    dom.cmdItemBtnEl.textContent = 'Item';
  }

  if (talkTargets.length > 0) {
    const talkTgt = talkTargets[0]!.target;
    unit.direction = directionFromDelta(talkTgt.x - unit.x, talkTgt.y - unit.y);
  } else if (targets.length > 0) {
    const target = targets[0]!.enemy;
    unit.direction = directionFromDelta(target.x - unit.x, target.y - unit.y);
  } else if (danceTargets.length > 0) {
    const ally = danceTargets[0]!.ally;
    unit.direction = directionFromDelta(ally.x - unit.x, ally.y - unit.y);
  } else if (healTargets.length > 0 && healTargets[0]!.ally.id !== unit.id) {
    const ally = healTargets[0]!.ally;
    unit.direction = directionFromDelta(ally.x - unit.x, ally.y - unit.y);
  }

  dom.actionMenuEl.hidden = false;
  positionFloatingActionMenu(ctx);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  const completedMoveStep = Boolean(
    tutorialOverlay?.notifyActionCompleted('battle_move_to_blue_tile')
  );
  ctx.renderNow();

  if (!completedMoveStep && targets.length > 0) {
    void triggerBattleTutorial(ctx, 'ch1_first_combat_forecast');
  }
}

export function cancelUncommittedMove(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, audioManager } = ctx;
  const unit = getSelectedUnit(state);
  if (unit && state.uncommittedOrigin && state.uncommittedOrigin.unitId === unit.id) {
    unit.x = state.uncommittedOrigin.x;
    unit.y = state.uncommittedOrigin.y;
    unit.direction = state.uncommittedOrigin.direction;
    unit.action = 'Idle';
    unit.renderWorldX = unit.x * PMD_TILE_NATIVE_PX;
    unit.renderWorldY = unit.y * PMD_TILE_NATIVE_PX;
    state.inspectedTile = { x: unit.x, y: unit.y };
  }
  state.uncommittedOrigin = null;
  state.originRangeSnapshot = null;
  state.currentForecast = null;
  state.currentHealForecast = null;
  dom.actionMenuEl.hidden = true;
  dom.forecastModalBackdropEl.hidden = true;
  audioManager.playSfx('cancel');

  if (unit) {
    state.interactionState = 'unit_selected';
    state.touchInspectedUnitId = state.hoveredTile === null ? unit.id : null;
    state.selectionPulseStartMs = performance.now();
    recomputeSelectedUnitRange(state);
    state.previewPath = [{ x: unit.x, y: unit.y, cumulativeCost: 0 }];
  } else {
    state.interactionState = 'idle';
  }
  syncPrepChromeVisibility(state, dom, prepOverlay);
  syncHudControls(state, dom);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}
