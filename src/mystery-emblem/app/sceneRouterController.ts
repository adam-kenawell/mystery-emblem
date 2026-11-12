/**
 * Mystery Emblem - Scene Router & Campaign Cutscene/Battle Sequencer (`sceneRouterController.ts`)
 */

import {
  DEMO_INITIAL_CONVOY,
  DEMO_STARTING_LEVEL,
  getDemoChapterByNodeId,
  type CampaignChapterConfig,
} from '../data/campaignRegistry';
import { getSpeciesById } from '../data/index';
import { DEMO_OVERWORLD_GRAPH } from '../data/overworldMapData';
import {
  getPostChapterCutsceneIds,
  getPreChapterCutsceneIds,
  getStoryCutsceneById,
} from '../data/storyCutscenes';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { AppRuntimeContext } from './appContext';
import { isAppAdminSignedIn, isAppDevToolsOpen } from './authAndTitleController';
import { launchCampaignChapterBattle } from './chapterBattleLauncher';

export interface SceneRouter {
  showTitleScreen: () => void;
  closeDevToolsOverlay: () => void;
  openDevToolsOverlay: (tab?: 'cheats' | 'maps' | 'cutscenes') => void;
  toggleDevTools: () => void;
  openBattleScene: (source?: 'devtools' | 'overworld', levelId?: string) => Promise<void>;
  openOverworldScene: (opts?: {
    preservePosition?: boolean;
    announceCurrentChapter?: boolean;
  }) => Promise<void>;
  continueCampaignFromTitle: () => Promise<void>;
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

  function openDevToolsOverlay(tab?: 'cheats' | 'maps' | 'cutscenes'): void {
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
    if (!ctx.cutsceneScene) return;
    const csIds = getPreChapterCutsceneIds(nodeId);
    let preparedStage = false;
    for (const csId of csIds) {
      const def = getStoryCutsceneById(csId);
      if (!def || manager.hasSeenStoryCutscene(def.id)) continue;
      if (!preparedStage) {
        ctx.tutorialOverlay?.closeAll(null);
        if (ctx.overworldScene?.isOpen()) {
          ctx.overworldReturnTarget = 'suppress';
          ctx.overworldScene.close();
        }
        if (dom.titleScreen) dom.titleScreen.hidden = true;
        if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
        preparedStage = true;
      }
      await ctx.cutsceneScene.play(def);
      manager.markStoryCutsceneSeen(def.id);
    }
  }

  async function runPostChapterStoryFlowAndOpenOverworld(clearedNodeId: string): Promise<void> {
    if (dom.titleScreen) dom.titleScreen.hidden = true;
    if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;

    const demoCh = getDemoChapterByNodeId(clearedNodeId);
    for (const postId of getPostChapterCutsceneIds(clearedNodeId)) {
      const postDef = getStoryCutsceneById(postId);
      if (postDef && ctx.cutsceneScene && !manager.hasSeenStoryCutscene(postDef.id)) {
        await ctx.cutsceneScene.play(postDef);
        manager.markStoryCutsceneSeen(postDef.id);
      }
    }

    if (demoCh?.postCutsceneRecruits?.length) {
      for (const spec of demoCh.postCutsceneRecruits) {
        const sp = getSpeciesById(spec.speciesId);
        if (!sp) continue;
        const alreadyOwned = manager.getSave()?.roster.some(
          (u) => getSpeciesById(u.speciesId)?.lineId === sp.lineId
        );
        if (alreadyOwned) continue;
        manager.recruitPokemon({
          speciesId: spec.speciesId,
          level: spec.level,
          scaleStatsToLevel: spec.scaleStatsToLevel,
        });
      }
    }

    if (demoCh?.chainsDirectlyIntoNodeId) {
      const nextNodeId = demoCh.chainsDirectlyIntoNodeId;
      const nextChapter = getDemoChapterByNodeId(nextNodeId);
      if (nextChapter && !manager.getSave()?.campaign.completedChapterIds.includes(nextNodeId)) {
        await playPreChapterStoryCutsceneIfNeeded(nextNodeId);
        await launchDemoChapterBattle(nextChapter);
        return;
      }
    }

    if (demoCh?.isDemoFinale && ctx.creditsScene && !manager.hasSeenCredits()) {
      await ctx.creditsScene.play();
      manager.markCreditsSeen();
    }
    await openOverworldScene({ preservePosition: true });
  }

  async function continueCampaignFromTitle(): Promise<void> {
    const save = manager.getSave();
    if (!save) {
      openDemoQuizFlow();
      return;
    }
    const completed = new Set(save.campaign.completedChapterIds);
    if (!completed.has('prologue')) {
      const prologueCh = getDemoChapterByNodeId('prologue');
      if (prologueCh) {
        await playPreChapterStoryCutsceneIfNeeded('prologue');
        await launchDemoChapterBattle(prologueCh);
        return;
      }
    }
    if (!completed.has('chapter_01')) {
      const ch1 = getDemoChapterByNodeId('chapter_01');
      if (ch1) {
        await playPreChapterStoryCutsceneIfNeeded('chapter_01');
        await launchDemoChapterBattle(ch1);
        return;
      }
    }
    await openOverworldScene({ preservePosition: true, announceCurrentChapter: true });
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
    continueCampaignFromTitle,
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
