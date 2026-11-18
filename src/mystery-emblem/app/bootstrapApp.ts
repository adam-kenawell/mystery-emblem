/**
 * Mystery Emblem - Application Bootstrap & Scene Lifecycle Coordinator (`bootstrapApp.ts`)
 */

import { getAudioManager } from '../audio/AudioManager';
import { reloadChapterMapsFromStorage } from '../data/chapterMapRegistry';
import { CreditsScene } from '../scenes/CreditsScene';
import { CutsceneScene } from '../scenes/CutsceneScene';
import { SaveStateManager } from '../state/SaveStateManager';
import { DialogueOverlay } from '../ui/DialogueOverlay';
import { destroyAllPmdSpriteActors } from '../ui/PmdSpriteCanvas';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import type { AppRuntimeContext } from './appContext';
import { mountGameplayScenesAndDevTools } from './appSceneFactory';
import {
  bindTitleAndCornerControls,
  createAppBackStack,
  registerAppBackStackLayers,
} from './authAndTitleController';
import { createSceneRouter } from './sceneRouterController';

let activeCtx: AppRuntimeContext | null = null;
let activeAbortController: AbortController | null = null;

function teardownActiveApp(): void {
  destroyAllPmdSpriteActors();
  if (activeCtx) {
    activeCtx.creditsScene?.destroy();
    activeCtx.cutsceneScene?.destroy();
    activeCtx.battleScene?.destroy();
    activeCtx.mapEditorScene?.destroy();
    activeCtx.overworldScene?.destroy();
    activeCtx.quizScene?.destroy();
    activeCtx.tutorialOverlay?.destroy();
    activeCtx.devToolsHarness?.destroy();
    activeCtx.dialogueOverlay?.destroy();
    activeCtx.manager.dispose();
    activeCtx = null;
  }
  activeAbortController?.abort();
  activeAbortController = null;
}

export async function initMysteryEmblemApp(): Promise<void> {
  teardownActiveApp();
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  reloadChapterMapsFromStorage();

  const manager = new SaveStateManager();
  const audioManager = getAudioManager();

  const dom = {
    viewportEl: document.getElementById('mystery-emblem-root'),
    landingBackdrop: document.getElementById('pmd-landing-backdrop'),
    titleScreen: document.getElementById('pmd-title-screen'),
    devToolsBackdrop: document.getElementById('pmd-devtools-backdrop'),
    devToolsModal: document.getElementById('pmd-devtools-modal'),
    devToolsBtn: document.getElementById('pmd-dev-tools-btn'),
    cornerMenuBtn: document.getElementById('pmd-corner-menu-btn') as HTMLButtonElement | null,
    titleAuthBtn: document.getElementById('pmd-title-auth-btn') as HTMLButtonElement | null,
    statusMsgEl: document.getElementById('pmd-status-msg'),
    btnContinue: document.getElementById('btn-continue') as HTMLButtonElement | null,
    btnContinueLabel: document.getElementById('btn-continue-label'),
    btnContinueChapter: document.getElementById('btn-continue-chapter'),
  };

  let ctx!: AppRuntimeContext;
  const backStack = createAppBackStack(dom.cornerMenuBtn, () => ctx);

  const dialogueOverlay = dom.viewportEl
    ? new DialogueOverlay(dom.viewportEl, manager, {
        onStateChange: () => backStack.syncButtonLabel(),
        audioManager,
      })
    : null;

  const cutsceneScene =
    dom.viewportEl && dialogueOverlay
      ? new CutsceneScene({
          viewportEl: dom.viewportEl,
          saveManager: manager,
          dialogueOverlay,
          audioManager,
          onStateChange: () => backStack.syncButtonLabel(),
        })
      : null;

  const creditsScene = dom.viewportEl
    ? new CreditsScene({
        viewportEl: dom.viewportEl,
        saveManager: manager,
        audioManager,
        onStateChange: () => backStack.syncButtonLabel(),
      })
    : null;

  const tutorialOverlay = dom.viewportEl
    ? new TutorialOverlay({
        parent: dom.viewportEl,
        saveManager: manager,
        audioManager,
        onLayerStateChanged: () => backStack.syncButtonLabel(),
      })
    : null;

  ctx = {
    dom,
    manager,
    audioManager,
    signal,
    backStack,
    dialogueOverlay,
    cutsceneScene,
    creditsScene,
    tutorialOverlay,
    quizScene: null,
    battleScene: null,
    mapEditorScene: null,
    overworldScene: null,
    devToolsHarness: null,
    battleReturnTarget: 'overworld',
    pendingPostVictoryDemoNodeId: null,
    overworldReturnTarget: 'title',
    demoLaunchInProgress: false,
  };
  activeCtx = ctx;

  const router = createSceneRouter(ctx);
  mountGameplayScenesAndDevTools(ctx, router);
  registerAppBackStackLayers(ctx, router.closeDevToolsOverlay);

  const { renderAll } = bindTitleAndCornerControls({
    ctx,
    toggleDevTools: router.toggleDevTools,
    closeDevToolsOverlay: router.closeDevToolsOverlay,
    continueCampaignFromTitle: router.continueCampaignFromTitle,
    openDemoQuizFlow: () => router.openDemoQuizFlow(),
  });

  manager.subscribe(() => renderAll());
}
