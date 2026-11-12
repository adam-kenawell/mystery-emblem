/**
 * Open, Close, Sub-Layer Query & Match Restart Lifecycle for `BattleScene`
 */

import {
  cloneDungeonMap,
  getEffectiveChapterMap,
} from '../../data/chapterMapRegistry';
import { resolveDefaultObjectiveLabel } from '../../engine/battleEvents';
import {
  createFallbackBattlePrepManager,
  getMapDeploymentCap,
  resolveEnemySpawnsForMap,
} from '../../engine/battleSetup';
import { MAP_DEFAULT_SCALE } from '../../ui/mapZoomController';
import {
  clearBattleSelection,
  syncPrepChromeVisibility,
} from './battleDangerAndViewportState';
import { clearFloatingTexts } from './battleFloatingCallouts';
import {
  confirmEnterDungeonFromPrep,
  hideAllBattleModals,
  setupFreshBattleState,
} from './battlePrepAndAssets';
import type {
  BattleExitDestination,
  BattleOpenOptions,
} from './battlePublicTypes';
import {
  registerBattleTutorialAvailabilityProvider,
  triggerPrepHubTutorials,
} from './battleTutorialIntegration';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { getLordUnit } from './battleUnitQueries';
import { applyBattleSuspendSnapshot, parseBattleSuspendJson } from './battleSuspend';

function hydrateBattleRulesFromMap(state: BattleRuntimeState): void {
  state.objectiveType = state.explicitObjectiveType ?? state.map.objectiveType ?? 'rout';
  state.surviveTurns = state.explicitSurviveTurns ?? state.map.surviveTurns;
  state.objectiveLabel =
    state.explicitObjectiveLabel ??
    state.map.objectiveLabel ??
    resolveDefaultObjectiveLabel(state.objectiveType, state.surviveTurns);
  state.reinforcements = state.explicitReinforcements ?? state.map.reinforcements ?? [];
  state.events = state.explicitEvents ?? state.map.events ?? [];
  state.enemySpawnDefs = resolveEnemySpawnsForMap(state.map, state.explicitEnemyOverrides);
}

export function hasBattleActiveSubLayer(ctx: BattleControllerContext): boolean {
  const { state, dom, prepOverlay } = ctx;
  if (!state.openState) return false;
  if (!dom.levelUpModalBackdropEl.hidden || !dom.talkChoiceBackdropEl.hidden) return true;
  if (state.systemMenuOpen) return true;
  if (state.phase === 'dungeon_prep') {
    return state.prepSwapSlotIndex !== null || prepOverlay.hasActiveSubLayer();
  }
  return (
    state.interactionState === 'combat_forecast' ||
    state.interactionState === 'action_menu' ||
    state.interactionState === 'unit_selected'
  );
}

export async function openBattleScene(
  ctx: BattleControllerContext,
  options?: BattleOpenOptions
): Promise<void> {
  const { state, dom, prepOverlay, saveManager, audioManager, viewportEl } = ctx;
  const runGen = ++state.battleRunGen;
  state.activeLevelId = options?.levelId?.trim() || options?.customMap?.id || 'prologue';
  state.explicitCustomMap = options?.customMap ? cloneDungeonMap(options.customMap) : null;
  state.explicitEnemyOverrides = options?.enemyOverrides;
  state.explicitObjectiveType = options?.objectiveType;
  state.explicitObjectiveLabel = options?.objectiveLabel;
  state.explicitSurviveTurns = options?.surviveTurns;
  state.explicitDefeatIfUnitIdsFall = options?.defeatIfUnitIdsFall;
  state.explicitReinforcements = options?.reinforcements;
  state.explicitEvents = options?.events;
  state.eventScripts = options?.eventScripts ?? {};
  state.commitToSaveOnVictory = Boolean(options?.commitToSaveOnVictory);
  state.clearRewardItems = options?.clearRewardItems ?? [];
  state.pauseOnLevelUpInFastMode = Boolean(options?.pauseOnLevelUpInFastMode);
  state.skipPrepPhase = Boolean(options?.skipPrepPhase);
  state.currentOnDungeonEnteredBeforePrep = options?.onDungeonEnteredBeforePrep;
  state.currentOnVictory = options?.onVictory;
  state.currentOnBeforeVictoryModal = options?.onBeforeVictoryModal;
  state.suspendSource = options?.suspendSource ?? null;
  const resumeSnap = parseBattleSuspendJson(options?.resumeSuspendJson);
  if (resumeSnap) state.currentOnDungeonEnteredBeforePrep = undefined;
  state.cutsceneInProgress = Boolean(state.currentOnDungeonEnteredBeforePrep);
  state.victoryCallbackFired = false;

  const exitLabel = options?.exitButtonLabel ?? 'Return to Menu';
  const hideReplay = Boolean(options?.hideReplayOnVictory);
  const victoryReplayBtn = dom.victoryModalBackdropEl.querySelector<HTMLElement>(
    '[data-testid="victory-replay-btn"]'
  );
  if (victoryReplayBtn) victoryReplayBtn.hidden = hideReplay;
  const victoryExitBtn = dom.victoryModalBackdropEl.querySelector<HTMLElement>(
    '[data-testid="victory-exit-btn"]'
  );
  if (victoryExitBtn) victoryExitBtn.textContent = exitLabel;
  const defeatExitBtn = dom.defeatModalBackdropEl.querySelector<HTMLElement>(
    '[data-testid="defeat-exit-btn"]'
  );
  if (defeatExitBtn) defeatExitBtn.textContent = exitLabel;

  state.map = state.explicitCustomMap
    ? cloneDungeonMap(state.explicitCustomMap)
    : getEffectiveChapterMap(state.activeLevelId);
  hydrateBattleRulesFromMap(state);

  if (saveManager.getSave() === null) {
    state.guestPrepManager?.dispose();
    state.guestPrepManager = createFallbackBattlePrepManager(
      Math.max(5, getMapDeploymentCap(state.map) + 2)
    );
  }

  if (!state.openState) {
    state.previousBgmId = audioManager.getCurrentTrackId();
  }

  state.openState = true;
  state.cam.displayScale = MAP_DEFAULT_SCALE;
  state.pinchTracker.reset();
  dom.rootEl.hidden = false;
  viewportEl.classList.add('is-battle-active');
  registerBattleTutorialAvailabilityProvider(ctx);

  await setupFreshBattleState(ctx, {
    showPrepOverlay: !resumeSnap && !state.cutsceneInProgress && !state.skipPrepPhase,
    preferredDeployInstanceIds: options?.preferredDeployInstanceIds,
  });
  if (!state.openState || runGen !== state.battleRunGen) return;

  ctx.syncViewportDimensions();
  const lord = getLordUnit(state) ?? state.units[0];
  ctx.centerCameraOnTile(lord?.x ?? 3, lord?.y ?? 5);

  audioManager.playBgm(state.map.bgmCue || 'drenched_bluff', { fadeMs: 300 });
  ctx.startLoop();
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (resumeSnap) {
    await applyBattleSuspendSnapshot(ctx, resumeSnap);
    return;
  }

  if (!state.currentOnDungeonEnteredBeforePrep && state.skipPrepPhase) {
    confirmEnterDungeonFromPrep(ctx);
    return;
  }

  if (state.currentOnDungeonEnteredBeforePrep) {
    const introHook = state.currentOnDungeonEnteredBeforePrep;
    state.currentOnDungeonEnteredBeforePrep = undefined;
    try {
      await introHook();
    } finally {
      if (state.openState && runGen === state.battleRunGen) {
        state.cutsceneInProgress = false;
      }
    }
    if (!state.openState || runGen !== state.battleRunGen) return;
    audioManager.playBgm(state.map.bgmCue || 'drenched_bluff', { fadeMs: 300 });
    if (state.skipPrepPhase) {
      confirmEnterDungeonFromPrep(ctx);
      return;
    }
    prepOverlay.show();
    syncPrepChromeVisibility(state, dom, prepOverlay);
    ctx.onLayerStateChanged();
    ctx.renderNow();
    triggerPrepHubTutorials(ctx);
  }
}

export function closeBattleScene(
  ctx: BattleControllerContext,
  destination: BattleExitDestination = 'default'
): void {
  const { state, dom, prepOverlay, audioManager, viewportEl, saveManager } = ctx;
  if (!state.openState) return;
  // Leaving a battle for anywhere but the title abandons it, so its mid-battle save is stale.
  if (destination !== 'title' && state.suspendSource && saveManager.getSave()) {
    saveManager.clearBattleSuspend();
  }
  state.battleRunGen += 1;
  state.openState = false;
  state.cutsceneInProgress = false;
  ctx.stopLoop();
  state.pinchTracker.reset();
  state.activeWalk = null;
  state.activeStrikeVfx = null;
  clearFloatingTexts(state, dom);
  state.prepSwapSlotIndex = null;
  state.hoveredTile = null;
  state.lastComputedHoverEnemyId = null;
  state.suppressedHoverEnemyId = null;
  hideAllBattleModals(ctx);
  clearBattleSelection(state, dom, prepOverlay);
  dom.rootEl.hidden = true;
  viewportEl.classList.remove('is-battle-active');

  if (state.previousBgmId) {
    audioManager.playBgm(state.previousBgmId, { fadeMs: 280 });
  } else {
    audioManager.playBgm('top_menu', { fadeMs: 280 });
  }

  ctx.onLayerStateChanged();
  ctx.tutorialOverlay?.closeAll(null);
  ctx.onExitCallback(destination);
}

export async function restartBattleMatch(ctx: BattleControllerContext): Promise<void> {
  const { state, audioManager, saveManager } = ctx;
  if (!state.openState) return;
  if (state.suspendSource && saveManager.getSave()) saveManager.clearBattleSuspend();
  state.battleRunGen += 1;
  audioManager.playSfx('select');
  state.map = state.explicitCustomMap
    ? cloneDungeonMap(state.explicitCustomMap)
    : getEffectiveChapterMap(state.activeLevelId);
  hydrateBattleRulesFromMap(state);

  await setupFreshBattleState(ctx, { showPrepOverlay: !state.skipPrepPhase });
  if (state.skipPrepPhase) {
    audioManager.playBgm(state.map.bgmCue || 'drenched_bluff', {
      fadeMs: 250,
      restart: true,
    });
    confirmEnterDungeonFromPrep(ctx);
    return;
  }
  const lord = getLordUnit(state) ?? state.units[0];
  ctx.centerCameraOnTile(lord?.x ?? 3, lord?.y ?? 5);
  audioManager.playBgm(state.map.bgmCue || 'drenched_bluff', {
    fadeMs: 250,
    restart: true,
  });
  ctx.onLayerStateChanged();
  ctx.renderNow();
}
