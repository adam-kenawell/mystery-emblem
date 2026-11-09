/**
 * Mystery Emblem — Dev / E2E Test Telemetry Bridge (`e2eDebugBridge.ts`)
 *
 * Strictly gated on DEV / WebDriver / localhost / `?debug`.
 */

import {
  computePmdTileSpritePlacement,
  resolveUnitVisualAssetId,
} from '../assets/pmdAssetLoader';
import { PMD_TILESET_LIST, loadTilesetSheet } from '../assets/tilesetLoader';
import {
  DEMO_CAMPAIGN_CHAPTERS,
  DEMO_INITIAL_CONVOY,
  DEMO_STARTING_LEVEL,
  getDemoChapterByNodeId,
} from '../data/campaignRegistry';
import {
  getDefaultChapterMap,
  getEffectiveChapterMap,
  hasChapterMapOverride,
  resetChapterMapOverride,
  saveChapterMapOverride,
} from '../data/chapterMapRegistry';
import { getRegistryValidationSummary } from '../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../data/overworldMapData';
import {
  DRAGON_LORD_OPTIONS,
  PERSONALITY_QUIZ_QUESTIONS,
  evaluatePersonalityQuiz,
} from '../data/quizData';
import { DEMO_STORY_CUTSCENES } from '../data/storyCutscenes';
import {
  TUTORIAL_TOPICS,
  detectDynamicMapTerrainTutorialIds,
} from '../data/tutorialRegistry';
import {
  computeCombatForecast,
  computeUnitPopupStats,
  getTypeEffectiveness,
} from '../engine/combatEngine';
import {
  computeUnitMovementAndAttackRange,
  getTerrainBonuses,
  getTerrainMoveCost,
} from '../engine/terrainAndPathfinding';
import {
  SaveStateManager,
  getUnitEquippedItemId,
} from '../state/SaveStateManager';
import { InMemoryCloudSyncAdapter } from '../state/firebaseSync';
import { PmdPortraitView, PmdSpriteActor } from '../ui/PmdSpriteCanvas';
import type { AppRuntimeContext } from './appContext';
import type { SceneRouter } from './sceneRouterController';

export function installMysteryEmblemDebugBridge(
  ctx: AppRuntimeContext,
  router: SceneRouter
): void {
  const enableDebugHooks =
    import.meta.env.DEV ||
    navigator.webdriver ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    new URLSearchParams(window.location.search).has('debug');

  if (!enableDebugHooks) return;

  (window as unknown as Record<string, unknown>).__MYSTERY_EMBLEM_DEBUG__ = {
    saveManager: ctx.manager,
    SaveStateManager,
    getUnitEquippedItemId,
    InMemoryCloudSyncAdapter,
    getRegistryValidationSummary,
    audioManager: ctx.audioManager,
    dialogueOverlay: ctx.dialogueOverlay,
    cutsceneScene: ctx.cutsceneScene,
    creditsScene: ctx.creditsScene,
    DEMO_STORY_CUTSCENES,
    tutorialOverlay: ctx.tutorialOverlay,
    quizScene: ctx.quizScene,
    launchDemoChapterBattle: router.launchDemoChapterBattle,
    battleScene: ctx.battleScene,
    mapEditorScene: ctx.mapEditorScene,
    overworldScene: ctx.overworldScene,
    openOverworldScene: router.openOverworldScene,
    DEMO_OVERWORLD_GRAPH,
    DEMO_CAMPAIGN_CHAPTERS,
    DEMO_STARTING_LEVEL,
    DEMO_INITIAL_CONVOY,
    getDemoChapterByNodeId,
    DRAGON_LORD_OPTIONS,
    PERSONALITY_QUIZ_QUESTIONS,
    TUTORIAL_TOPICS,
    detectDynamicMapTerrainTutorialIds,
    evaluatePersonalityQuiz,
    getDefaultChapterMap,
    getEffectiveChapterMap,
    hasChapterMapOverride,
    saveChapterMapOverride,
    resetChapterMapOverride,
    computeCombatForecast,
    computeUnitPopupStats,
    getTypeEffectiveness,
    resolveUnitVisualAssetId,
    computePmdTileSpritePlacement,
    PmdSpriteActor,
    PmdPortraitView,
    PMD_TILESET_LIST,
    loadTilesetSheet,
    getTerrainMoveCost,
    getTerrainBonuses,
    computeUnitMovementAndAttackRange,
  };
}
