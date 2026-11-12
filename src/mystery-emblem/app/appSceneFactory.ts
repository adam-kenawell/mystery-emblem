/**
 * Mystery Emblem - Gameplay Scene & DevTools Factory (`appSceneFactory.ts`)
 */

import { getDemoChapterByNodeId } from '../data/campaignRegistry';
import { getPreChapterCutsceneIds } from '../data/storyCutscenes';
import { BattleScene } from '../scenes/BattleScene';
import { ChapterMapEditorScene } from '../scenes/ChapterMapEditorScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { DevToolsHarness } from '../ui/DevToolsHarness';
import { QuizScene } from '../ui/QuizScene';
import type { AppRuntimeContext } from './appContext';
import { isAppAdminSignedIn } from './authAndTitleController';
import { launchOverworldNodeBattle, launchSkirmishBattle } from './chapterBattleLauncher';
import type { SceneRouter } from './sceneRouterController';

export function mountGameplayScenesAndDevTools(ctx: AppRuntimeContext, router: SceneRouter): void {
  const { dom, manager, audioManager, tutorialOverlay, recruitNicknameOverlay, backStack, signal } = ctx;

  ctx.quizScene =
    dom.viewportEl && recruitNicknameOverlay
      ? new QuizScene(dom.viewportEl, manager, recruitNicknameOverlay, {
          audioManager,
          onCancel: () => router.showTitleScreen(),
          onStateChange: () => backStack.syncButtonLabel(),
        })
      : null;

  if (dom.viewportEl) {
    ctx.battleScene = new BattleScene({
      viewportEl: dom.viewportEl,
      saveManager: manager,
      audioManager,
      dialogueOverlay: ctx.dialogueOverlay ?? undefined,
      tutorialOverlay: tutorialOverlay ?? undefined,
      onExit: (destination = 'default') => {
        if (destination === 'overworld') {
          ctx.pendingPostVictoryDemoNodeId = null;
          void router.openOverworldScene({ preservePosition: true });
          return;
        }
        if (destination === 'title') {
          ctx.pendingPostVictoryDemoNodeId = null;
          router.showTitleScreen();
          return;
        }
        if (ctx.battleReturnTarget === 'devtools' && isAppAdminSignedIn(ctx)) {
          ctx.pendingPostVictoryDemoNodeId = null;
          if (manager.getSave()) {
            void router.openOverworldScene({ preservePosition: true }).then(() => router.openDevToolsOverlay('maps'));
          } else {
            router.showTitleScreen();
            router.openDevToolsOverlay('maps');
          }
        } else if (ctx.battleReturnTarget === 'overworld') {
          if (ctx.pendingPostVictoryDemoNodeId) {
            const clearedNodeId = ctx.pendingPostVictoryDemoNodeId;
            ctx.pendingPostVictoryDemoNodeId = null;
            void router.runPostChapterStoryFlowAndOpenOverworld(clearedNodeId);
          } else void router.openOverworldScene({ preservePosition: true });
        } else {
          ctx.pendingPostVictoryDemoNodeId = null;
          router.showTitleScreen();
        }
      },
      onLayerStateChanged: () => backStack.syncButtonLabel(),
    });

    ctx.mapEditorScene = new ChapterMapEditorScene({
      viewportEl: dom.viewportEl,
      saveManager: manager,
      audioManager,
      onExit: () => {
        if (isAppAdminSignedIn(ctx)) {
          if (manager.getSave()) {
            void router.openOverworldScene({ preservePosition: true }).then(() => router.openDevToolsOverlay('maps'));
          } else {
            router.showTitleScreen();
            router.openDevToolsOverlay('maps');
          }
        } else router.showTitleScreen();
      },
      onPlayLevel: (targetLevelId) => void router.openBattleScene('devtools', targetLevelId),
      onLayerStateChanged: () => backStack.syncButtonLabel(),
    });

    ctx.overworldScene = new OverworldScene({
      viewportEl: dom.viewportEl,
      saveManager: manager,
      audioManager,
      tutorialOverlay: tutorialOverlay ?? undefined,
      onExit: () => { if (ctx.overworldReturnTarget !== 'suppress') router.showTitleScreen(); },
      onLayerStateChanged: () => backStack.syncButtonLabel(),
      onRequestNewGame: () => router.openDemoQuizFlow(),
      onReplayCutscene: (csId) => void router.replayStoryCutsceneFromOverworld(csId),
      onReplayCredits: () => void router.replayCreditsFromOverworld(),
      onLaunchChapterBattle: ({ nodeId, levelId }) => {
        if (!ctx.battleScene) return;
        const demoChapter = getDemoChapterByNodeId(nodeId);
        if (demoChapter) {
          void (async () => {
            if (getPreChapterCutsceneIds(demoChapter.nodeId).length > 0) {
              await router.playPreChapterStoryCutsceneIfNeeded(demoChapter.nodeId);
            }
            await router.launchDemoChapterBattle(demoChapter);
          })();
          return;
        }
        void launchOverworldNodeBattle(ctx, { nodeId, levelId });
      },
      onLaunchSkirmishBattle: ({ nodeId, customMap, enemyOverrides, goldBounty }) => {
        void launchSkirmishBattle(ctx, { nodeId, customMap, enemyOverrides, goldBounty });
      },
    });
  }

  if (dom.devToolsModal) {
    ctx.devToolsHarness = new DevToolsHarness({
      modalEl: dom.devToolsModal,
      saveManager: manager,
      audioManager,
      isBattleOpen: () => Boolean(ctx.battleScene?.isOpen()),
      onCheatFullHealSquad: () => ctx.battleScene?.cheatFullHealSquad(),
      onCheatInstantWin: () => ctx.battleScene?.cheatInstantWin(),
      onLiveStateMutated: (opts) => {
        if (opts?.snapOverworld && ctx.overworldScene?.isOpen()) ctx.overworldScene.snapToCurrentSaveNode();
        ctx.battleScene?.refreshFromExternalSaveCheat();
      },
      onLaunchMapEditor: (levelId) => void router.openMapEditor(levelId),
      onPlayMapBattle: (levelId) => void router.openBattleScene('devtools', levelId),
      getCutsceneEditorHost: () => ({
        audioManager,
        cutsceneScene: ctx.cutsceneScene,
        dialogueOverlay: ctx.dialogueOverlay,
        mapEditorScene: ctx.mapEditorScene,
      }),
      onHideForEditor: () => {
        if (dom.devToolsBackdrop) dom.devToolsBackdrop.hidden = true;
        backStack.syncButtonLabel();
      },
      onShowAfterEditor: () => router.openDevToolsOverlay('cutscenes'),
      onClose: () => router.closeDevToolsOverlay(),
      signal,
    });
    if (isAppAdminSignedIn(ctx)) {
      window.setTimeout(() => ctx.devToolsHarness?.resumeCutsceneEditorIfNeeded(), 0);
    }
  }
}
