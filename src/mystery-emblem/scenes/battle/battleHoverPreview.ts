/**
 * Live PC Mouse Hover Tile, Danger Area Preview & A* Attack/Heal/Move Path Preview
 */

import { findBestTalkPlanForTarget } from '../../engine/battleEvents';
import {
  findBestAttackPlanForTarget,
  findBestDancePlanForAlly,
  findBestHealPlanForAlly,
} from '../../engine/combatEngine';
import { coordKey, findShortestPathAStar } from '../../engine/terrainAndPathfinding';
import { updateBattleInfoStrip } from './battleHudCards';
import { getExpectedTutorialAction } from './battleTutorialSpotlights';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingUnits, getSelectedUnit } from './battleUnitQueries';

export function updateHoveredTile(
  ctx: BattleControllerContext,
  tile: { x: number; y: number } | null
): void {
  const { state, tutorialOverlay } = ctx;
  if (tile?.x === state.hoveredTile?.x && tile?.y === state.hoveredTile?.y) {
    return;
  }
  state.hoveredTile = tile;
  state.suppressedHoverEnemyId = null;
  state.touchInspectedUnitId = null;
  if (state.prepSwapSlotIndex === null) {
    state.prepMapStatusNotice = null;
  }

  if (
    state.phase === 'player_phase' &&
    state.interactionState === 'unit_selected' &&
    state.currentRange &&
    tile
  ) {
    const unit = getSelectedUnit(state);
    const key = coordKey(tile.x, tile.y);
    const living = getLivingUnits(state);
    const occupant = living.find(
      (u) => u.x === tile.x && u.y === tile.y && u.id !== unit?.id
    );
    const expectedTutorialAction = getExpectedTutorialAction(tutorialOverlay);
    const talkPlan =
      unit && occupant && state.events.length > 0 && !expectedTutorialAction
        ? findBestTalkPlanForTarget(
            state.map,
            unit,
            occupant,
            state.events,
            state.triggeredEventIds,
            state.currentRange.reachableTiles,
            living
          )
        : null;

    if (talkPlan) {
      state.previewPath = talkPlan.path;
    } else if (unit && occupant && occupant.faction === 'enemy') {
      const plan = findBestAttackPlanForTarget(
        state.map,
        unit,
        occupant,
        state.currentRange.reachableTiles,
        living
      );
      state.previewPath = plan ? plan.path : null;
    } else if (unit && occupant && (occupant.faction === 'player' || occupant.faction === 'npc')) {
      const dancePlan =
        occupant.faction === 'player'
          ? findBestDancePlanForAlly(
              state.map,
              unit,
              occupant,
              state.currentRange.reachableTiles,
              living
            )
          : null;
      if (dancePlan) {
        state.previewPath = dancePlan.path;
      } else {
        const healPlan = findBestHealPlanForAlly(
          state.map,
          unit,
          occupant,
          state.currentRange.reachableTiles,
          living
        );
        state.previewPath = healPlan ? healPlan.path : null;
      }
    } else if (unit && state.currentRange.reachableTiles.has(key) && !occupant) {
      state.previewPath = findShortestPathAStar(state.map, unit, tile.x, tile.y, living);
    } else {
      state.previewPath = null;
    }
  }

  const prevHoverEnemyId = state.lastComputedHoverEnemyId;
  updateBattleInfoStrip(ctx);
  if (
    state.lastComputedHoverEnemyId !== prevHoverEnemyId ||
    (state.phase === 'player_phase' && state.interactionState === 'unit_selected')
  ) {
    ctx.renderNow();
  }
}
