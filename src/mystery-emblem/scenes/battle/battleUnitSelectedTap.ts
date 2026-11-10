/**
 * `unit_selected` Tile Tap Handler (Auto-Path Talk, Dance, Attack, Heal & Walk-to-Tile)
 */

import { directionFromDelta } from '../../assets/pmdAssetLoader';
import type { TutorialActionTriggerId } from '../../data/tutorialRegistry';
import { findBestTalkPlanForTarget } from '../../engine/battleEvents';
import {
  findBestAttackPlanForTarget,
  findBestDancePlanForAlly,
  findBestHealPlanForAlly,
  getEnemyTargetingMovesAtDistance,
  manhattanDistance,
  type BattleUnitState,
} from '../../engine/combatEngine';
import { coordKey, findShortestPathAStar } from '../../engine/terrainAndPathfinding';
import { executeDanceFromCommandMenu } from './battleDanceController';
import {
  clearBattleSelection,
  toggleIndividualEnemyDanger,
} from './battleDangerAndViewportState';
import { executeTalkFromCommandMenu } from './battleEventRunner';
import {
  openCombatForecastModal,
  openHealForecastModal,
} from './battleHealForecastAndConfirm';
import { updateBattleInfoStrip } from './battleHudCards';
import {
  openFloatingCommandMenu,
  selectPlayerUnit,
  startInteractiveWalk,
} from './battleSelectionAndMenu';
import {
  getForcedTutorialMoveTile,
  resolveTutorialSpotlightTiles,
} from './battleTutorialSpotlights';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingEnemies, getSelectedUnit } from './battleUnitQueries';

export function handleSelectedUnitTileTap(
  ctx: BattleControllerContext,
  tx: number,
  ty: number,
  occupant: BattleUnitState | undefined,
  livingUnits: BattleUnitState[],
  expectedTutorialAction: TutorialActionTriggerId | null
): void {
  const { state, dom, prepOverlay, audioManager, tutorialOverlay } = ctx;
  const selected = getSelectedUnit(state);
  if (!selected || !state.currentRange) {
    clearBattleSelection(state, dom, prepOverlay);
    return;
  }

  if (expectedTutorialAction === 'battle_move_to_blue_tile') {
    const targetKey = coordKey(tx, ty);
    const hasNonOriginMove = resolveTutorialSpotlightTiles(
      state,
      prepOverlay,
      'reachable_move'
    ).some((pt) => pt.x !== selected.x || pt.y !== selected.y);
    const isOriginTap = tx === selected.x && ty === selected.y;
    const forced = getForcedTutorialMoveTile(state);
    if (
      occupant ||
      !state.currentRange.reachableTiles.has(targetKey) ||
      (hasNonOriginMove && isOriginTap) ||
      (forced && (tx !== forced.x || ty !== forced.y))
    ) {
      tutorialOverlay?.nudgeActiveStep();
      return;
    }
  } else if (expectedTutorialAction === 'battle_open_heal_forecast') {
    const lord = livingUnits.find((u) => u.isLord && u.faction === 'player');
    if (!occupant || occupant.id !== lord?.id) {
      tutorialOverlay?.nudgeActiveStep();
      return;
    }
  } else if (expectedTutorialAction === 'battle_open_attack_forecast') {
    if (occupant && occupant.faction === 'enemy') {
      const plan = findBestAttackPlanForTarget(
        state.map,
        selected,
        occupant,
        state.currentRange.reachableTiles,
        livingUnits
      );
      if (!plan) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
    } else {
      const targetKey = coordKey(tx, ty);
      const canWalkToInRangeTile =
        !occupant &&
        state.currentRange.reachableTiles.has(targetKey) &&
        getLivingEnemies(state).some(
          (e) =>
            getEnemyTargetingMovesAtDistance(selected, manhattanDistance(tx, ty, e.x, e.y)).length > 0
        );
      if (!canWalkToInRangeTile) {
        tutorialOverlay?.nudgeActiveStep();
        return;
      }
    }
  }

  if (occupant && occupant.id !== selected.id && state.events.length > 0 && !expectedTutorialAction) {
    const talkPlan = findBestTalkPlanForTarget(
      state.map,
      selected,
      occupant,
      state.events,
      state.triggeredEventIds,
      state.currentRange.reachableTiles,
      livingUnits
    );
    if (talkPlan) {
      audioManager.playSfx('select');
      state.uncommittedOrigin = {
        unitId: selected.id,
        x: selected.x,
        y: selected.y,
        direction: selected.direction,
      };
      state.originRangeSnapshot = state.currentRange;
      state.forecastReturnMode = 'unit_selected';
      state.previewPath = talkPlan.path;

      const onTalkArrival = () => {
        selected.direction = directionFromDelta(occupant.x - selected.x, occupant.y - selected.y);
        if (occupant.faction === 'enemy') {
          openFloatingCommandMenu(ctx, selected);
        } else {
          void executeTalkFromCommandMenu(ctx, occupant.id);
        }
      };

      if (talkPlan.path.length <= 1) onTalkArrival();
      else startInteractiveWalk(ctx, selected, talkPlan.path, onTalkArrival);
      return;
    }
  }

  if (occupant && occupant.faction === 'enemy') {
    const plan = findBestAttackPlanForTarget(
      state.map,
      selected,
      occupant,
      state.currentRange.reachableTiles,
      livingUnits
    );
    if (plan) {
      audioManager.playSfx('select');
      state.uncommittedOrigin = {
        unitId: selected.id,
        x: selected.x,
        y: selected.y,
        direction: selected.direction,
      };
      state.originRangeSnapshot = state.currentRange;
      state.forecastReturnMode = 'unit_selected';
      state.previewPath = plan.path;

      const openForecastOnArrival = () => {
        selected.direction = directionFromDelta(occupant.x - selected.x, occupant.y - selected.y);
        openCombatForecastModal(ctx, occupant.id, plan.defaultMoveId);
      };

      if (plan.path.length <= 1) openForecastOnArrival();
      else startInteractiveWalk(ctx, selected, plan.path, openForecastOnArrival);
      return;
    }

    audioManager.playSfx('cancel');
    toggleIndividualEnemyDanger(ctx, occupant.id);
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
    return;
  }

  if (
    occupant &&
    occupant.id !== selected.id &&
    (occupant.faction === 'player' || occupant.faction === 'npc')
  ) {
    if (occupant.faction === 'player') {
      const dancePlan = findBestDancePlanForAlly(
        state.map,
        selected,
        occupant,
        state.currentRange.reachableTiles,
        livingUnits
      );
      if (dancePlan) {
        audioManager.playSfx('select');
        state.uncommittedOrigin = {
          unitId: selected.id,
          x: selected.x,
          y: selected.y,
          direction: selected.direction,
        };
        state.originRangeSnapshot = state.currentRange;
        state.previewPath = dancePlan.path;

        const runDanceOnArrival = () => {
          void executeDanceFromCommandMenu(ctx, occupant.id);
        };

        if (dancePlan.path.length <= 1) runDanceOnArrival();
        else startInteractiveWalk(ctx, selected, dancePlan.path, runDanceOnArrival);
        return;
      }
    }

    const healPlan = findBestHealPlanForAlly(
      state.map,
      selected,
      occupant,
      state.currentRange.reachableTiles,
      livingUnits
    );
    if (healPlan) {
      audioManager.playSfx('select');
      state.uncommittedOrigin = {
        unitId: selected.id,
        x: selected.x,
        y: selected.y,
        direction: selected.direction,
      };
      state.originRangeSnapshot = state.currentRange;
      state.forecastReturnMode = 'unit_selected';
      state.previewPath = healPlan.path;

      const openHealOnArrival = () => {
        selected.direction = directionFromDelta(occupant.x - selected.x, occupant.y - selected.y);
        openHealForecastModal(ctx, occupant.id, healPlan.defaultMoveId);
      };

      if (healPlan.path.length <= 1) openHealOnArrival();
      else startInteractiveWalk(ctx, selected, healPlan.path, openHealOnArrival);
      return;
    }

    if (occupant.faction === 'player' && !occupant.waited) {
      selectPlayerUnit(ctx, occupant);
      return;
    }
    audioManager.playSfx('cancel');
    updateBattleInfoStrip(ctx);
    ctx.renderNow();
    return;
  }

  const targetKey = coordKey(tx, ty);
  if (state.currentRange.reachableTiles.has(targetKey)) {
    const path = findShortestPathAStar(state.map, selected, tx, ty, livingUnits);
    if (path && path.length > 0) {
      state.uncommittedOrigin = {
        unitId: selected.id,
        x: selected.x,
        y: selected.y,
        direction: selected.direction,
      };
      state.originRangeSnapshot = state.currentRange;
      state.previewPath = path;
      audioManager.playSfx('select');

      if (path.length === 1) {
        openFloatingCommandMenu(ctx, selected);
      } else {
        startInteractiveWalk(ctx, selected, path, () => {
          openFloatingCommandMenu(ctx, selected);
        });
      }
      return;
    }
  }

  audioManager.playSfx('cancel');
  clearBattleSelection(state, dom, prepOverlay);
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
  ctx.renderNow();
}
