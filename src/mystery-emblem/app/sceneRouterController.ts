/**
 * Mystery Emblem — Scene Router & Campaign Cutscene/Battle Sequencer (`sceneRouterController.ts`)
 */

import {
  DEMO_INITIAL_CONVOY,
  DEMO_STARTING_LEVEL,
  getDemoChapterByNodeId,
  type CampaignChapterConfig,
} from '../data/campaignRegistry';
import { DEMO_OVERWORLD_GRAPH } from '../data/overworldMapData';
import {
  POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID,
  PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID,
  getStoryCutsceneById,
} from '../data/storyCutscenes';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { AppRuntimeContext } from './appContext';
import { isAppAdminSignedIn, isAppDevToolsOpen } from './authAndTitleController';
import { launchCampaignChapterBattle } from './chapterBattleLauncher';

export interface SceneRouter {
  showTitleScreen: () => void;
  closeDevToolsOverlay: () => void;
  openDevToolsOverlay: (tab?: 'cheats' | 'maps') => void;
  toggleDevTools: () => void;
  openBattleScene: (source?: 'devtools' | 'overworld', levelId?: string) => Promise<void>;
  openOverworldScene: (opts?: {
    preservePosition?: boolean;
    announceCurrentChapter?: boolean;
  }) => Promise<void>;
  openDemoQuizFlow: (opts?: { skipNicknamePrompts?: boolean }) => void;
  playPreChapterStoryCutsceneIfNeeded: (nodeId: string) => Promise<void>;
  runPostChapterStoryFlowAndOpenOverworld: (clearedNodeId: string) => Promise<void>;
  replayStoryCutsceneFromOverworld: (cutsceneId: string) => Promise<void>;
  replayCreditsFromOverworld: () => Promise<void>;
  launchDemoChapterBattle: (demoChapter: CampaignChapterConfig) => Promise<void>;
  openMapEditor: (levelId?: string) => Promise<void>;
  promptRenameUnit: (instanceId: string, overrideManager?: SaveStateManager) => Promise<void>;
}

export function createSceneRouter(ctx: AppRuntimeContext): SceneRouter {
  const { dom, manager, audioManager, backStack } = ctx;

  function showTitleScreen(): void {
    ctx.tutorialOverlay?.closeAll(null);
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    if (dom.titleScreen) dom.titleScreen.hidden = false;
    backStack.syncButtonLabel();
  }

  function closeDevToolsOverlay(): void {
    if (!dom.devToolsBackdrop) return;
    dom.devToolsBackdrop.hidden = true;
    const anySceneOpen =
      Boolean(ctx.cutsceneScene?.isOpen()) ||
      Boolean(ctx.creditsScene?.isOpen()) ||
      Boolean(ctx.battleScene?.isOpen()) ||
      Boolean(ctx.overworldScene?.isOpen()) ||
      Boolean(ctx.mapEditorScene?.isOpen()) ||
      Boolean(ctx.quizScene?.isOpen());
    if (!anySceneOpen && dom.titleScreen) dom.titleScreen.hidden = false;
    backStack.syncButtonLabel();
  }

  function openDevToolsOverlay(tab?: 'cheats' | 'maps'): void {
    if (!isAppAdminSignedIn(ctx) || !dom.devToolsBackdrop) return;
    dom.devToolsBackdrop.hidden = false;
    ctx.devToolsHarness?.onSaveChanged();
    if (tab) ctx.devToolsHarness?.switchSubTab(tab);
    backStack.syncButtonLabel();
  }

  function toggleDevTools(): void {
    if (!isAppAdminSignedIn(ctx) || !dom.devToolsBackdrop) return;
    if (isAppDevToolsOpen(ctx)) {
      audioManager.playSfx('cancel');
      closeDevToolsOverlay();
    } else {
      audioManager.playSfx('select');
      openDevToolsOverlay();
    }
  }

  async function openBattleScene(
    source: 'devtools' | 'overworld' = 'devtools',
    levelId = 'prologue'
  ): Promise<void> {
    if (!ctx.battleScene) return;
    if (source === 'devtools' && !isAppAdminSignedIn(ctx)) return;
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (ctx.mapEditorScene?.isOpen()) ctx.mapEditorScene.close();
    if (ctx.quizScene?.isOpen()) ctx.quizScene.close();
    ctx.battleReturnTarget = source;
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.battleScene.open({ levelId });
    backStack.syncButtonLabel();
  }

  async function openOverworldScene(opts?: {
    preservePosition?: boolean;
    announceCurrentChapter?: boolean;
  }): Promise<void> {
    if (!ctx.overworldScene) return;
    ctx.overworldReturnTarget = 'title';
    if (!manager.getSave()) {
      manager.createNewCampaignSave({
        campaignMode: 'demo',
        lordSpeciesId: 'axew',
        startingLevel: DEMO_STARTING_LEVEL,
        scaleStatsToLevel: true,
        initialConvoy: DEMO_INITIAL_CONVOY,
        overworldGraph: DEMO_OVERWORLD_GRAPH,
      });
    }
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.overworldScene.open({
      graph: DEMO_OVERWORLD_GRAPH,
      preservePosition: opts?.preservePosition ?? true,
      announceCurrentChapter: opts?.announceCurrentChapter ?? false,
    });
    backStack.syncButtonLabel();
  }

  async function playPreChapterStoryCutsceneIfNeeded(nodeId: string): Promise<void> {
    const demoCh = getDemoChapterByNodeId(nodeId);
    const csId = demoCh?.preStoryCutsceneId ?? PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID[nodeId];
    const def = csId ? getStoryCutsceneById(csId) : undefined;
    if (!def || !ctx.cutsceneScene || manager.hasSeenStoryCutscene(def.id)) return;
    ctx.tutorialOverlay?.closeAll(null);
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.cutsceneScene.play(def);
    manager.markStoryCutsceneSeen(def.id);
  }

  async function runPostChapterStoryFlowAndOpenOverworld(clearedNodeId: string): Promise<void> {
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;

    const demoCh = getDemoChapterByNodeId(clearedNodeId);
    const postId =
      demoCh?.postStoryCutsceneId ?? POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID[clearedNodeId];
    const postDef = postId ? getStoryCutsceneById(postId) : undefined;
    if (postDef && ctx.cutsceneScene && !manager.hasSeenStoryCutscene(postDef.id)) {
      await ctx.cutsceneScene.play(postDef);
      manager.markStoryCutsceneSeen(postDef.id);
    }
    if (demoCh?.isDemoFinale && ctx.creditsScene && !manager.hasSeenCredits()) {
      await ctx.creditsScene.play();
      manager.markCreditsSeen();
    }
    await openOverworldScene({ preservePosition: true });
  }

  async function replayStoryCutsceneFromOverworld(cutsceneId: string): Promise<void> {
    const def = getStoryCutsceneById(cutsceneId);
    if (!def || !ctx.cutsceneScene) return;
    ctx.tutorialOverlay?.closeAll(null);
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.cutsceneScene.play(def);
    manager.markStoryCutsceneSeen(def.id);
    await openOverworldScene({ preservePosition: true });
  }

  async function replayCreditsFromOverworld(): Promise<void> {
    if (!ctx.creditsScene) return;
    ctx.tutorialOverlay?.closeAll(null);
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.creditsScene.play();
    manager.markCreditsSeen();
    await openOverworldScene({ preservePosition: true });
  }

  function launchDemoChapterBattle(demoChapter: CampaignChapterConfig): Promise<void> {
    return launchCampaignChapterBattle(ctx, demoChapter);
  }

  function openDemoQuizFlow(opts?: { skipNicknamePrompts?: boolean }): void {
    if (!ctx.quizScene) return;
    ctx.tutorialOverlay?.closeAll(null);
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (ctx.battleScene?.isOpen()) {
      ctx.battleReturnTarget = 'title';
      ctx.battleScene.close();
    }
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    ctx.quizScene.open({
      campaignMode: 'demo',
      startingLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      initialConvoy: DEMO_INITIAL_CONVOY,
      overworldGraph: DEMO_OVERWORLD_GRAPH,
      skipNicknamePrompts: opts?.skipNicknamePrompts,
      onComplete: () => {
        void (async () => {
          await playPreChapterStoryCutsceneIfNeeded('prologue');
          const prologueChapter = getDemoChapterByNodeId('prologue');
          if (prologueChapter) await launchDemoChapterBattle(prologueChapter);
          else await openOverworldScene({ preservePosition: false });
        })();
      },
    });
    backStack.syncButtonLabel();
  }

  async function openMapEditor(levelId = 'prologue'): Promise<void> {
    if (!ctx.mapEditorScene || !isAppAdminSignedIn(ctx)) return;
    ctx.tutorialOverlay?.closeAll(null);
    if (ctx.overworldScene?.isOpen()) {
      ctx.overworldReturnTarget = 'suppress';
      ctx.overworldScene.close();
    }
    if (ctx.battleScene?.isOpen()) {
      ctx.battleReturnTarget = 'title';
      ctx.battleScene.close();
    }
    if (ctx.quizScene?.isOpen()) ctx.quizScene.close();
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
    await ctx.mapEditorScene.open(levelId);
    backStack.syncButtonLabel();
  }

  async function promptRenameUnit(
    instanceId: string,
    overrideManager?: SaveStateManager
  ): Promise<void> {
    if (!ctx.recruitNicknameOverlay) return;
    await ctx.recruitNicknameOverlay.promptRenameUnit(instanceId, overrideManager);
    ctx.battleScene?.refreshFromExternalSaveCheat();
    ctx.devToolsHarness?.onSaveChanged();
  }

  return {
    showTitleScreen,
    closeDevToolsOverlay,
    openDevToolsOverlay,
    toggleDevTools,
    openBattleScene,
    openOverworldScene,
    openDemoQuizFlow,
    playPreChapterStoryCutsceneIfNeeded,
    runPostChapterStoryFlowAndOpenOverworld,
    replayStoryCutsceneFromOverworld,
    replayCreditsFromOverworld,
    launchDemoChapterBattle,
    openMapEditor,
    promptRenameUnit,
  };
}
