/**
 * Mystery Emblem — LIFO BackStack & Corner Button State Wiring (`appBackStackWiring.ts`)
 */

import { hasAdminDevToolsAccess } from '../data/accessControl';
import { BackStackController } from '../ui/pointerControls';
import type { AppRuntimeContext } from './appContext';

const GOOGLE_G_SVG_MARKUP = `<svg class="pmd-google-g-icon" data-testid="google-g-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>`;

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function isRunningOnLocalhost(): boolean {
  return typeof window !== 'undefined' && LOCALHOST_HOSTNAMES.has(window.location.hostname);
}

export function isAppAdminSignedIn(ctx: AppRuntimeContext): boolean {
  return isRunningOnLocalhost() || hasAdminDevToolsAccess(ctx.manager.getSyncStatus().user?.email);
}

export function isAppDevToolsOpen(ctx: AppRuntimeContext): boolean {
  return Boolean(ctx.dom.devToolsBackdrop && !ctx.dom.devToolsBackdrop.hidden);
}

export function createAppBackStack(
  cornerMenuBtn: HTMLButtonElement | null,
  getCtx: () => AppRuntimeContext
): BackStackController {
  const backStack = new BackStackController(
    cornerMenuBtn,
    () => {
      const ctx = getCtx();
      if (ctx.battleScene?.isOpen()) ctx.battleScene.handleMenuOrBack();
      else if (ctx.overworldScene?.isOpen()) ctx.overworldScene.handleMenuOrBack();
      else if (ctx.mapEditorScene?.isOpen()) ctx.mapEditorScene.handleMenuOrBack();
    },
    {
      shouldHideCornerButton: () => {
        const ctx = getCtx();
        return Boolean(
          ((ctx.battleScene?.isOpen() && ctx.battleScene.getSnapshot().phase !== 'dungeon_prep') ||
            ctx.cutsceneScene?.isOpen() ||
            ctx.creditsScene?.isOpen()) &&
            !isAppDevToolsOpen(ctx) &&
            !ctx.recruitNicknameOverlay?.isOpen()
        );
      },
      syncIdleButton: (btn) => {
        const ctx = getCtx();
        if (ctx.battleScene?.isOpen()) {
          if (ctx.battleScene.getSnapshot().phase === 'dungeon_prep') {
            btn.hidden = false;
            btn.textContent = 'Menu';
            btn.dataset.cornerMode = 'menu';
            btn.setAttribute('aria-label', 'Open System Menu');
            btn.removeAttribute('title');
          } else {
            btn.hidden = true;
            btn.dataset.cornerMode = 'hidden';
          }
          return;
        }
        if (ctx.mapEditorScene?.isOpen() || ctx.overworldScene?.isOpen()) {
          btn.hidden = false;
          btn.textContent = 'Menu';
          btn.dataset.cornerMode = 'menu';
          btn.setAttribute('aria-label', 'Open System Menu');
          btn.removeAttribute('title');
          return;
        }

        btn.hidden = false;
        const sync = ctx.manager.getSyncStatus();
        if (sync.user) {
          const who = sync.user.email ?? sync.user.displayName ?? 'Google Account';
          btn.innerHTML = `${GOOGLE_G_SVG_MARKUP}<span>Log Out</span>`;
          btn.dataset.cornerMode = 'logout';
          btn.setAttribute('aria-label', `Signed in as ${who} — Log out`);
          btn.setAttribute('title', `Signed in as ${who}`);
        } else {
          btn.innerHTML = `${GOOGLE_G_SVG_MARKUP}<span>Log In</span>`;
          btn.dataset.cornerMode = 'login';
          btn.setAttribute('aria-label', 'Log in with Google');
          btn.removeAttribute('title');
        }
      },
    }
  );

  const origSync = backStack.syncButtonLabel.bind(backStack);
  backStack.syncButtonLabel = () => {
    const ctx = getCtx();
    if (ctx.dom.landingBackdrop) {
      const inGameplay =
        Boolean(ctx.cutsceneScene?.isOpen()) ||
        Boolean(ctx.creditsScene?.isOpen()) ||
        Boolean(ctx.battleScene?.isOpen()) ||
        Boolean(ctx.mapEditorScene?.isOpen()) ||
        Boolean(ctx.overworldScene?.isOpen()) ||
        Boolean(ctx.quizScene?.isOpen());
      ctx.dom.landingBackdrop.hidden = inGameplay || Boolean(ctx.dom.titleScreen?.hidden);
    }
    origSync();
  };

  return backStack;
}

export function registerAppBackStackLayers(
  ctx: AppRuntimeContext,
  closeDevToolsOverlay: () => void
): void {
  const { backStack, audioManager } = ctx;
  backStack.registerLayer({
    id: 'battle-scene-sublayer',
    isActive: () => Boolean(ctx.battleScene?.isOpen() && ctx.battleScene.hasActiveSubLayer()),
    onBack: () => ctx.battleScene?.handleMenuOrBack(),
  });
  backStack.registerLayer({
    id: 'map-editor-sublayer',
    isActive: () => Boolean(ctx.mapEditorScene?.isOpen() && ctx.mapEditorScene.hasActiveSubLayer()),
    onBack: () => ctx.mapEditorScene?.handleMenuOrBack(),
  });
  backStack.registerLayer({
    id: 'overworld-scene-sublayer',
    isActive: () => Boolean(ctx.overworldScene?.isOpen() && ctx.overworldScene.hasActiveSubLayer()),
    onBack: () => ctx.overworldScene?.handleMenuOrBack(),
  });
  backStack.registerLayer({
    id: 'quiz-scene',
    isActive: () => Boolean(ctx.quizScene?.isOpen()),
    onBack: () => ctx.quizScene?.handleBack(),
  });
  backStack.registerLayer({
    id: 'devtools-modal',
    isActive: () => isAppDevToolsOpen(ctx),
    onBack: () => {
      audioManager.playSfx('cancel');
      closeDevToolsOverlay();
    },
  });
  backStack.registerLayer({
    id: 'cutscene-scene',
    isActive: () => Boolean(ctx.cutsceneScene?.isOpen()),
    onBack: () => ctx.cutsceneScene?.handleBack(),
  });
  backStack.registerLayer({
    id: 'credits-scene',
    isActive: () => Boolean(ctx.creditsScene?.isOpen()),
    onBack: () => ctx.creditsScene?.handleBack(),
  });
  backStack.registerLayer({
    id: 'dialogue-overlay',
    isActive: () => Boolean(ctx.dialogueOverlay?.isOpen()),
    onBack: () => ctx.dialogueOverlay?.close('cancelled'),
  });
  backStack.registerLayer({
    id: 'recruit-nickname-modal',
    isActive: () => Boolean(ctx.recruitNicknameOverlay?.isOpen()),
    onBack: () => ctx.recruitNicknameOverlay?.handleBack(),
  });
  backStack.registerLayer({
    id: 'tutorial-overlay',
    isActive: () => Boolean(ctx.tutorialOverlay?.isBlockingSceneInput()),
    onBack: () => ctx.tutorialOverlay?.handleBack(),
  });
}
