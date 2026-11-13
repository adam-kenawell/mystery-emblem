/**
 * Player Phase Tile Tap Router (Prep View Map, Idle Selection & `action_menu` Shortcuts)
 */

import { getAvailableTalkEventsForPair } from '../../engine/battleEvents';
import {
  getDanceMovesForTargetAtDistance,
  getHealingMovesForTargetAtDistance,
  getOffensiveMovesAtDistance,
  manhattanDistance,
} from '../../engine/combatEngine';
import { isInMapBounds } from '../../engine/terrainAndPathfinding';
import { isPhaseTransitionPlaying } from './battleBannersAndTransitions';
import { executeDanceFromCommandMenu } from './battleDanceController';
import {
  clearInspectedAllyRange,
  toggleIndividualEnemyDanger,
  toggleInspectedAllyRange,
} from './battleDangerAndViewportState';
import { executeTalkFromCommandMenu } from './battleEventRunner';
import { openSystemMenu } from './battleFieldMenuController';
import {
  openCombatForecastModal,
  openHealForecastModal,
} from './battleHealForecastAndConfirm';
import { updateBattleInfoStrip } from './battleHudCards';
import { handlePrepViewMapTileTap } from './battlePrepSlotActions';
import {
  cancelUncommittedMove,
  selectPlayerUnit,
} from './battleSelectionAndMenu';
import {
  getExpectedTutorialAction,
  getHealOrConsumableTutorialUnits,
  getTutorialHealerUnit,
  getTutorialPartnerUnit,
} from './battleTutorialSpotlights';
import type { BattleControllerContext } from './battleTypesAndState';
import {
  getActiveInspectedAllyRange,
  getLivingAlliedUnits,
  getLivingEnemies,
  getLivingUnits,
  getLordUnit,
  getSelectedUnit,
} from './battleUnitQueries';
import { handleSelectedUnitTileTap } from './battleUnitSelectedTap';

export function handleBattleTileTap(
  ctx: BattleControllerContext,
  tx: number,
  ty: number,
  clientX?: number,
  clientY?: number
): void {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  if (
    !state.openState ||
    state.cutsceneInProgress ||
    isPhaseTransitionPlaying(state) ||
    !isInMapBounds(state.map, tx, ty) ||
    state.systemMenuOpen
  ) {
    return;
  }

  if (state.phase === 'dungeon_prep') {
    if (!prepOverlay.isOpen() || prepOverlay.getSubMode() !== 'view_map') return;
    handlePrepViewMapTileTap(ctx, tx, ty);
    return;
  }

  if (
    state.phase !== 'player_phase' ||
    state.interactionState === 'walking' ||
    state.interactionState === 'combat_forecast' ||
    state.interactionState === 'combat_animating' ||
    state.interactionState === 'enemy_acting'
  ) {
    return;
  }

  const expectedTutorialAction = getExpectedTutorialAction(tutorialOverlay);

  if (state.interactionState === 'action_menu') {
    if (
      expectedTutorialAction === 'battle_confirm_wait' ||
      expectedTutorialAction === 'battle_confirm_item'
    ) {
      tutorialOverlay?.nudgeActiveStep();
      return;
    }

    const selected = getSelectedUnit(state);
    const tappedUnit = getLivingUnits(state).find((u) => u.x === tx && u.y === ty);
    if (selected && tappedUnit && tappedUnit.id !== selected.id) {
      const dist = manhattanDistance(selected.x, selected.y, tappedUnit.x, tappedUnit.y);
      if (
        dist === 1 &&
        tappedUnit.faction !== 'enemy' &&
        getAvailableTalkEventsForPair(
          state.events,
          state.triggeredEventIds,
          selected,
          tappedUnit,
          state.units
        ).length > 0
      ) {
        state.forecastReturnMode = 'action_menu';
        void executeTalkFromCommandMenu(ctx, tappedUnit.id);
        return;
      }
    }

    const tappedEnemy = getLivingEnemies(state).find((e) => e.x === tx && e.y === ty);
    if (selected && tappedEnemy) {
      const dist = manhattanDistance(selected.x, selected.y, tappedEnemy.x, tappedEnemy.y);
      const validMoves = getOffensiveMovesAtDistance(selected, dist);
      if (validMoves.length > 0) {
        state.forecastReturnMode = 'action_menu';
        dom.actionMenuEl.hidden = true;
        openCombatForecastModal(ctx, tappedEnemy.id, validMoves[0]!.id);
        return;
      }
    }

    if (expectedTutorialAction === 'battle_open_attack_forecast') {
      tutorialOverlay?.nudgeActiveStep();
      return;
    }

    const tappedAlly = getLivingAlliedUnits(state).find((p) => p.x === tx && p.y === ty);
    if (selected && tappedAlly) {
      const dist =
        tappedAlly.id === selected.id
          ? 0
          : manhattanDistance(selected.x, selected.y, tappedAlly.x, tappedAlly.y);
      if (tappedAlly.faction === 'player' && tappedAlly.id !== selected.id) {
        const danceMoves = getDanceMovesForTargetAtDistance(selected, tappedAlly, dist);
        if (danceMoves.length > 0) {
          void executeDanceFromCommandMenu(ctx, tappedAlly.id);
          return;
        }
      }
      const validHealMoves = getHealingMovesForTargetAtDistance(selected, tappedAlly, dist);
      if (validHealMoves.length > 0) {
        state.forecastReturnMode = 'action_menu';
        dom.actionMenuEl.hidden = true;
        openHealForecastModal(ctx, tappedAlly.id, validHealMoves[0]!.id);
        return;
      }
    }

    cancelUncommittedMove(ctx);
    return;
  }

  state.inspectedTile = { x: tx, y: ty };
  const livingUnits = getLivingUnits(state);
  const occupant = livingUnits.find((u) => u.x === tx && u.y === ty);
  state.touchInspectedUnitId = state.hoveredTile === null && occupant ? occupant.id : null;

  if (state.interactionState === 'idle') {
    if (expectedTutorialAction === 'battle_open_field_menu') {
      if (occupant) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      openSystemMenu(ctx, 'root', clientX, clientY);
      ctx.renderNow();
      return;
    }

    if (expectedTutorialAction === 'battle_select_lord') {
      const lord = getLordUnit(state);
      if (!occupant || occupant.id !== lord?.id || occupant.waited) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      selectPlayerUnit(ctx, occupant);
      return;
    }

    if (expectedTutorialAction === 'battle_select_partner') {
      const partner = getTutorialPartnerUnit(state);
      if (!occupant || occupant.id !== partner?.id || occupant.waited) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      selectPlayerUnit(ctx, occupant);
      return;
    }

    if (expectedTutorialAction === 'battle_select_healer') {
      const healer = getTutorialHealerUnit(state);
      if (!occupant || occupant.id !== healer?.id || occupant.waited) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      selectPlayerUnit(ctx, occupant);
      return;
    }

    if (expectedTutorialAction === 'battle_inspect_heal_or_item') {
      const validIds = new Set(getHealOrConsumableTutorialUnits(state).map((u) => u.id));
      if (!occupant || !validIds.has(occupant.id) || occupant.waited) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
      selectPlayerUnit(ctx, occupant);
      return;
    }

    if (occupant && occupant.faction === 'player') {
      if (occupant.waited) {
        toggleInspectedAllyRange(ctx, occupant.id);
        updateBattleInfoStrip(ctx);
        ctx.onLayerStateChanged();
        ctx.renderNow();
        return;
      }
      selectPlayerUnit(ctx, occupant);
      return;
    }

    if (occupant && occupant.faction === 'npc') {
      toggleInspectedAllyRange(ctx, occupant.id);
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    if (occupant && occupant.faction === 'enemy') {
      toggleIndividualEnemyDanger(ctx, occupant.id);
      updateBattleInfoStrip(ctx);
      ctx.renderNow();
      return;
    }

    if (getActiveInspectedAllyRange(state) !== null) {
      clearInspectedAllyRange(state);
      audioManager.playSfx('cancel');
      updateBattleInfoStrip(ctx);
      ctx.onLayerStateChanged();
      ctx.renderNow();
      return;
    }

    openSystemMenu(ctx, 'root', clientX, clientY);
    ctx.renderNow();
    return;
  }

  if (state.interactionState === 'unit_selected') {
    handleSelectedUnitTileTap(ctx, tx, ty, occupant, livingUnits, expectedTutorialAction);
  }
}
