/**
 * Quaquaval Interactive Tutorial Action Availability & Topic Triggers in `BattleScene`
 */

import { PROLOGUE_LEVEL_ID } from '../../data/chapters/prologue/tutorialStaging';
import {
  PROLOGUE_HEAL_DRILL_TOPIC_ID,
  PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID,
  PROLOGUE_RANGED_DRILL_TOPIC_ID,
  evaluatePrepTutorialTopics,
  evaluateTurn1TutorialTopics,
  isQuaquavalAbsentFromLevel,
} from '../../data/tutorialRegistry';
import { getMapDeploymentCap } from '../../engine/battleSetup';
import { getEligibleEvolutionBranches } from '../../engine/progressionEngine';
import {
  getAttackableEnemiesForSelectedState,
  getExpectedTutorialAction,
  getHealOrConsumableTutorialUnits,
  getTutorialHealerUnit,
  getTutorialPartnerUnit,
  resolveTutorialSpotlightTiles,
} from './battleTutorialSpotlights';
import type { BattleControllerContext } from './battleTypesAndState';
import { canUseUnitEquippedConsumable, getLordUnit, getSelectedUnit } from './battleUnitQueries';

export {
  getAttackableEnemiesForSelectedState,
  getExpectedTutorialAction,
  getHealOrConsumableTutorialUnits,
  getTutorialHealerUnit,
  getTutorialPartnerUnit,
  resolveTutorialSpotlightTiles,
};

export function registerBattleTutorialAvailabilityProvider(ctx: BattleControllerContext): void {
  const { state, dom, prepOverlay, tutorialOverlay } = ctx;
  if (!tutorialOverlay) return;
  tutorialOverlay.setActionAvailabilityProvider({
    isActionAlreadyDone: (action) => {
      if (!state.openState) return false;
      switch (action) {
        case 'battle_open_field_menu':
          return (
            state.phase === 'player_phase' &&
            state.systemMenuOpen &&
            state.systemMenuSubView === 'root'
          );
        case 'battle_toggle_danger_area':
          return state.phase === 'player_phase' && state.globalDangerEnabled;
        case 'battle_select_lord':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'unit_selected' &&
            getSelectedUnit(state)?.id === getLordUnit(state)?.id
          );
        case 'battle_select_partner': {
          const partner = getTutorialPartnerUnit(state);
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'unit_selected' &&
            Boolean(partner && getSelectedUnit(state)?.id === partner.id)
          );
        }
        case 'battle_move_to_blue_tile':
          return state.phase === 'player_phase' && state.interactionState === 'action_menu';
        case 'battle_open_attack_forecast':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'combat_forecast' &&
            state.forecastMode === 'attack' &&
            !dom.forecastModalBackdropEl.hidden
          );
        case 'battle_select_healer': {
          const healer = getTutorialHealerUnit(state);
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'unit_selected' &&
            Boolean(healer && getSelectedUnit(state)?.id === healer.id)
          );
        }
        case 'battle_open_heal_forecast':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'combat_forecast' &&
            state.forecastMode === 'heal' &&
            !dom.forecastModalBackdropEl.hidden
          );
        case 'prep_open_manage_units':
          return (
            state.phase === 'dungeon_prep' &&
            prepOverlay.isOpen() &&
            prepOverlay.getSubMode() === 'manage_units'
          );
        case 'prep_open_view_map':
          return (
            state.phase === 'dungeon_prep' &&
            prepOverlay.isOpen() &&
            prepOverlay.getSubMode() === 'view_map'
          );
        default:
          return false;
      }
    },
    canPerformActionNow: (action) => {
      if (!state.openState) return false;
      switch (action) {
        case 'battle_open_field_menu':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'idle' &&
            !state.systemMenuOpen
          );
        case 'battle_toggle_danger_area':
          return (
            state.phase === 'player_phase' &&
            ((state.systemMenuOpen && state.systemMenuSubView === 'root') ||
              (!state.systemMenuOpen && state.interactionState === 'idle'))
          );
        case 'battle_select_lord': {
          const lord = getLordUnit(state);
          return (
            state.phase === 'player_phase' &&
            !state.systemMenuOpen &&
            Boolean(lord && !lord.defeated && lord.currentHp > 0 && !lord.waited)
          );
        }
        case 'battle_select_partner': {
          const partner = getTutorialPartnerUnit(state);
          return (
            state.phase === 'player_phase' &&
            !state.systemMenuOpen &&
            Boolean(partner && !partner.defeated && partner.currentHp > 0 && !partner.waited)
          );
        }
        case 'battle_move_to_blue_tile':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'unit_selected' &&
            Boolean(state.currentRange && state.currentRange.reachableTiles.size > 0)
          );
        case 'battle_confirm_wait':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'action_menu' &&
            !dom.actionMenuEl.hidden
          );
        case 'battle_confirm_item': {
          const sel = getSelectedUnit(state);
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'action_menu' &&
            !dom.actionMenuEl.hidden &&
            !dom.cmdItemBtnEl.hidden &&
            Boolean(sel && canUseUnitEquippedConsumable(sel))
          );
        }
        case 'battle_open_attack_forecast':
          return (
            state.phase === 'player_phase' &&
            (state.interactionState === 'unit_selected' ||
              state.interactionState === 'action_menu') &&
            getAttackableEnemiesForSelectedState(state).length > 0
          );
        case 'battle_confirm_attack':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'combat_forecast' &&
            state.forecastMode === 'attack' &&
            !dom.forecastModalBackdropEl.hidden
          );
        case 'battle_inspect_heal_or_item':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'idle' &&
            !state.systemMenuOpen &&
            getHealOrConsumableTutorialUnits(state).length > 0
          );
        case 'battle_select_healer': {
          const healer = getTutorialHealerUnit(state);
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'idle' &&
            !state.systemMenuOpen &&
            Boolean(healer && !healer.waited)
          );
        }
        case 'battle_open_heal_forecast': {
          const healer = getTutorialHealerUnit(state);
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'unit_selected' &&
            Boolean(healer && getSelectedUnit(state)?.id === healer.id)
          );
        }
        case 'battle_confirm_heal':
          return (
            state.phase === 'player_phase' &&
            state.interactionState === 'combat_forecast' &&
            state.forecastMode === 'heal' &&
            !dom.forecastModalBackdropEl.hidden
          );
        case 'prep_open_manage_units':
        case 'prep_open_view_map':
          return (
            state.phase === 'dungeon_prep' &&
            prepOverlay.isOpen() &&
            prepOverlay.getSubMode() === 'hub'
          );
        case 'prep_close_manage_units':
          return (
            state.phase === 'dungeon_prep' &&
            prepOverlay.isOpen() &&
            prepOverlay.getSubMode() === 'manage_units'
          );
        case 'prep_swap_or_finish_view_map':
          return (
            state.phase === 'dungeon_prep' &&
            prepOverlay.isOpen() &&
            prepOverlay.getSubMode() === 'view_map'
          );
        default:
          return false;
      }
    },
  });
}

export function triggerBattleTutorial(
  ctx: BattleControllerContext,
  topicId: string
): Promise<boolean> {
  const { state, tutorialOverlay } = ctx;
  if (!tutorialOverlay || !state.openState || state.cutsceneInProgress) {
    return Promise.resolve(false);
  }
  const isPrologue = state.activeLevelId === PROLOGUE_LEVEL_ID;
  if (DUPLICATE_PROLOGUE_LESSON_TOPIC_IDS.has(topicId)) {
    return Promise.resolve(false);
  }
  if (isQuaquavalAbsentFromLevel(state.activeLevelId)) {
    return Promise.resolve(false);
  }
  return tutorialOverlay.presentTopicIfNeeded(topicId, {
    sceneFastMode: state.fastMode,
    presenter: isPrologue ? 'mentor' : 'advisor',
  });
}

/** Already taught live by the Prologue drills, so never auto-trigger them again. */
const DUPLICATE_PROLOGUE_LESSON_TOPIC_IDS: ReadonlySet<string> = new Set([
  'ch1_first_combat_forecast',
  'ch1_healing_and_items',
]);

/** Prologue Turn 2: heal {partner} with {healer}, then strike Quaquaval from Range 2 with {lord}. */
export async function triggerPrologueTurn2Drills(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state } = ctx;
  for (const topicId of [PROLOGUE_HEAL_DRILL_TOPIC_ID, PROLOGUE_RANGED_DRILL_TOPIC_ID]) {
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await triggerBattleTutorial(ctx, topicId);
  }
}

/** Prologue Turn 3: cure {partner}'s Paralysis using Paralyze Heal. */
export async function triggerPrologueTurn3ItemDrill(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state } = ctx;
  if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
    return;
  }
  await triggerBattleTutorial(ctx, PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID);
}

export function triggerPrepHubTutorials(ctx: BattleControllerContext): void {
  const { state, saveManager, tutorialOverlay } = ctx;
  if (!tutorialOverlay || !state.openState || state.phase !== 'dungeon_prep') return;
  const save = saveManager.getSave();
  if (!save) return;

  const cap = getMapDeploymentCap(state.map);
  const hasConvoyStone = save.convoy.some((c) => c.itemId === 'evolution_stone' && c.quantity > 0);
  const hasConvoyGem = save.convoy.some((c) => c.itemId === 'evolution_gem' && c.quantity > 0);
  const anyUnitCanPromoteNow = save.roster.some((u) => {
    const stoneBranches = getEligibleEvolutionBranches(u.speciesId, u.level, 'evolution_stone');
    const gemBranches = getEligibleEvolutionBranches(u.speciesId, u.level, 'evolution_gem');
    return (
      stoneBranches.some((b) => u.consumableItemId === b.requiredItemId || hasConvoyStone) ||
      gemBranches.some((b) => u.consumableItemId === b.requiredItemId || hasConvoyGem)
    );
  });

  const topics = evaluatePrepTutorialTopics({
    levelId: state.activeLevelId,
    map: state.map,
    save,
    deploymentCap: cap,
    anyUnitCanPromoteNow,
  });
  for (const topicId of topics) {
    void triggerBattleTutorial(ctx, topicId);
  }
}

export async function triggerTurn1BattleTutorials(
  ctx: BattleControllerContext,
  runGen: number
): Promise<void> {
  const { state, saveManager, tutorialOverlay } = ctx;
  if (!tutorialOverlay || !state.openState || runGen !== state.battleRunGen) return;

  const topics = evaluateTurn1TutorialTopics({
    levelId: state.activeLevelId,
    map: state.map,
    save: saveManager.getSave(),
  });
  for (const topicId of topics) {
    if (!state.openState || runGen !== state.battleRunGen || state.phase !== 'player_phase') {
      return;
    }
    await triggerBattleTutorial(ctx, topicId);
  }
}
