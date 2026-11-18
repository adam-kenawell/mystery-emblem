/**
 * Quaquaval Interactive Tutorial Topic Triggers in `BattleScene`
 */

import {
  PROLOGUE_HEAL_DRILL_TOPIC_ID,
  PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID,
  PROLOGUE_RANGED_DRILL_TOPIC_ID,
  detectDynamicMapTerrainTutorialIds,
  detectNearbyTerrainTutorialId,
  evaluatePrepTutorialTopics,
  evaluateTurn1TutorialTopics,
  isQuaquavalAbsentFromLevel,
} from '../../data/tutorialRegistry';
import { getMapDeploymentCap } from '../../engine/battleSetup';
import { ensureTilePairVisible } from './battleBannersAndTransitions';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import type { BattleControllerContext } from './battleTypesAndState';
import { getLivingPlayers } from './battleUnitQueries';

export function triggerBattleTutorial(
  ctx: BattleControllerContext,
  topicId: string,
  opts?: { forceIfAlreadySeen?: boolean; tokens?: Readonly<Record<string, string>> }
): Promise<boolean> {
  const { state, tutorialOverlay } = ctx;
  if (!tutorialOverlay || !state.openState || state.cutsceneInProgress) {
    return Promise.resolve(false);
  }
  const isPrologue = state.activeLevelId === 'prologue';
  if (isQuaquavalAbsentFromLevel(state.activeLevelId)) {
    return Promise.resolve(false);
  }
  return tutorialOverlay.presentTopicIfNeeded(topicId, {
    presenter: isPrologue ? 'mentor' : 'advisor',
    forceIfAlreadySeen: opts?.forceIfAlreadySeen,
    tokens: opts?.tokens,
  });
}

/** Fires once when the player first opens a combat forecast so Quaquaval explains range & [E] counters. */
export function triggerReactiveForecastTutorial(ctx: BattleControllerContext): void {
  const { state, saveManager } = ctx;
  if (
    !state.openState ||
    state.cutsceneInProgress ||
    isQuaquavalAbsentFromLevel(state.activeLevelId)
  ) {
    return;
  }
  if (!saveManager.hasSeenTutorial(PROLOGUE_RANGED_DRILL_TOPIC_ID)) {
    void triggerBattleTutorial(ctx, PROLOGUE_RANGED_DRILL_TOPIC_ID);
  }
}

/**
 * Checks player units after combat or at the start of Player Phase and fires at most one
 * reactive Quaquaval one-liner (Paralysis/status cure takes priority over general healing).
 */
export async function triggerReactivePostCombatTutorials(
  ctx: BattleControllerContext,
  runGen: number
): Promise<boolean> {
  const { state, dom, saveManager, audioManager } = ctx;
  if (
    !state.openState ||
    runGen !== state.battleRunGen ||
    state.phase !== 'player_phase' ||
    isQuaquavalAbsentFromLevel(state.activeLevelId)
  ) {
    return false;
  }
  const players = getLivingPlayers(state);
  const isPrologue = state.activeLevelId === 'prologue';

  if (isPrologue) {
    const paralyzedUnit = players.find((u) => u.status === 'PAR');
    if (paralyzedUnit && !state.prologueParalyzeCureGranted) {
      state.prologueParalyzeCureGranted = true;
      if (paralyzedUnit.consumableItemId !== 'paralyze_heal') {
        if (paralyzedUnit.heldItemId) {
          state.eventBonusItems.push({ itemId: paralyzedUnit.heldItemId, quantity: 1 });
          paralyzedUnit.heldItemId = null;
        }
        if (paralyzedUnit.consumableItemId) {
          state.eventBonusItems.push({ itemId: paralyzedUnit.consumableItemId, quantity: 1 });
        }
        paralyzedUnit.consumableItemId = 'paralyze_heal';
        ensureTilePairVisible(
          state,
          paralyzedUnit.x,
          paralyzedUnit.y,
          paralyzedUnit.x,
          paralyzedUnit.y
        );
        state.inspectedTile = { x: paralyzedUnit.x, y: paralyzedUnit.y };
        audioManager.playSfx('heal');
        spawnFloatingText(
          state,
          dom,
          paralyzedUnit.x,
          Math.max(0, paralyzedUnit.y - 1),
          'PARALYZE HEAL!',
          '#68f8a8',
          950
        );
        updateBattleInfoStrip(ctx);
        ctx.renderNow();
      }
      return triggerBattleTutorial(ctx, PROLOGUE_ITEM_CURE_DRILL_TOPIC_ID, {
        forceIfAlreadySeen: true,
        tokens: { afflicted: paralyzedUnit.nickname },
      });
    }
  } else if (
    players.some((u) => u.status !== null) &&
    !saveManager.hasSeenTutorial('status_conditions_and_cures')
  ) {
    return triggerBattleTutorial(ctx, 'status_conditions_and_cures');
  }

  if (
    players.some((u) => u.currentHp < u.maxHp) &&
    !saveManager.hasSeenTutorial(PROLOGUE_HEAL_DRILL_TOPIC_ID)
  ) {
    return triggerBattleTutorial(ctx, PROLOGUE_HEAL_DRILL_TOPIC_ID);
  }
  return false;
}

/** Triggers a terrain coaching one-liner when a player unit steps onto or adjacent to special terrain. */
export async function triggerReactiveTerrainTutorialAt(
  ctx: BattleControllerContext,
  x: number,
  y: number,
  runGen: number
): Promise<boolean> {
  const { state, saveManager } = ctx;
  if (
    !state.openState ||
    runGen !== state.battleRunGen ||
    state.phase !== 'player_phase' ||
    state.activeLevelId === 'prologue' ||
    isQuaquavalAbsentFromLevel(state.activeLevelId)
  ) {
    return false;
  }
  const topicId = detectNearbyTerrainTutorialId(state.map, x, y);
  if (!topicId || saveManager.hasSeenTutorial(topicId)) {
    return false;
  }
  return triggerBattleTutorial(ctx, topicId);
}

/** On Turn 2 of non-Prologue chapters, gently introduces the first unseen special terrain on the map. */
export async function triggerTurn2FallbackTerrainTutorial(
  ctx: BattleControllerContext,
  runGen: number
): Promise<boolean> {
  const { state, saveManager } = ctx;
  if (
    !state.openState ||
    runGen !== state.battleRunGen ||
    state.phase !== 'player_phase' ||
    state.activeLevelId === 'prologue' ||
    isQuaquavalAbsentFromLevel(state.activeLevelId)
  ) {
    return false;
  }
  for (const topicId of detectDynamicMapTerrainTutorialIds(state.map)) {
    if (!saveManager.hasSeenTutorial(topicId)) {
      return triggerBattleTutorial(ctx, topicId);
    }
  }
  return false;
}

export function triggerPrepHubTutorials(ctx: BattleControllerContext): void {
  const { state, saveManager, tutorialOverlay } = ctx;
  if (!tutorialOverlay || !state.openState || state.phase !== 'dungeon_prep') return;
  const save = saveManager.getSave();
  if (!save) return;

  const cap = getMapDeploymentCap(state.map);
  const topics = evaluatePrepTutorialTopics({
    levelId: state.activeLevelId,
    map: state.map,
    save,
    deploymentCap: cap,
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
