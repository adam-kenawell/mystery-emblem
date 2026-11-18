/**
 * Mystery Emblem - Title Screen & Google Auth Corner Button Controls (`authAndTitleController.ts`)
 *
 * Strictly binds Google `signInWithPopup` to native `'click'` (never `'pointerup'`)
 * so iOS Safari & Android Chrome never popup-block authentication.
 */

import { bindBackGestureSurface, bindPointerTap } from '../ui/pointerControls';
import { openSaveSlotOverlay } from '../ui/SaveSlotOverlay';
import type { AppRuntimeContext } from './appContext';
import {
  GOOGLE_G_SVG_MARKUP,
  createAppBackStack,
  isAppAdminSignedIn,
  isAppDevToolsOpen,
  registerAppBackStackLayers,
} from './appBackStackWiring';

export {
  createAppBackStack,
  isAppAdminSignedIn,
  isAppDevToolsOpen,
  registerAppBackStackLayers,
};

export function bindTitleAndCornerControls(params: {
  ctx: AppRuntimeContext;
  toggleDevTools: () => void;
  closeDevToolsOverlay: () => void;
  continueCampaignFromTitle: () => Promise<void>;
  openDemoQuizFlow: () => void;
}): { renderAll: () => void } {
  const { ctx, toggleDevTools, closeDevToolsOverlay, continueCampaignFromTitle, openDemoQuizFlow } =
    params;
  const { dom, manager, audioManager, backStack, signal } = ctx;

  const setStatus = (msg: string): void => {
    if (!dom.statusMsgEl) return;
    const trimmed = msg.trim();
    dom.statusMsgEl.textContent = trimmed;
    dom.statusMsgEl.hidden = trimmed.length === 0;
  };

  dom.devToolsBackdrop?.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.target === dom.devToolsBackdrop) {
        ev.stopPropagation();
        audioManager.playSfx('cancel');
        closeDevToolsOverlay();
      }
    },
    { signal }
  );
  dom.devToolsModal?.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => ev.stopPropagation(),
    { signal }
  );

  let cornerPressedInNavMode = false;
  dom.cornerMenuBtn?.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.stopPropagation();
      const mode = dom.cornerMenuBtn?.dataset.cornerMode;
      cornerPressedInNavMode = mode === 'back' || mode === 'menu';
    },
    { signal }
  );

  bindPointerTap(
    dom.cornerMenuBtn,
    () => {
      const mode = dom.cornerMenuBtn?.dataset.cornerMode;
      if (mode === 'back' || mode === 'menu') {
        backStack.triggerMenuOrBack();
      }
    },
    { signal, stopPropagation: true }
  );

  const handleGoogleAuthClick = (): void => {
    const sync = manager.getSyncStatus();
    if (!sync.isFirebaseConfigured) {
      setStatus('Google Sign-In is not configured in this environment.');
      return;
    }
    setStatus('');
    if (sync.user) {
      audioManager.playSfx('cancel');
      void manager.signOutFromGoogle();
    } else {
      audioManager.playSfx('select');
      void manager.signInWithGoogleAndSync().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '';
        if (msg && !msg.toLowerCase().includes('popup-closed-by-user')) {
          setStatus(`Could not complete sign-in: ${msg}`);
        }
      });
    }
  };

  dom.cornerMenuBtn?.addEventListener(
    'click',
    (ev: MouseEvent) => {
      ev.stopPropagation();
      if (cornerPressedInNavMode) {
        cornerPressedInNavMode = false;
        return;
      }
      const mode = dom.cornerMenuBtn?.dataset.cornerMode;
      if (mode !== 'login' && mode !== 'logout') return;
      handleGoogleAuthClick();
    },
    { signal }
  );

  dom.titleAuthBtn?.addEventListener('pointerdown', (ev: PointerEvent) => ev.stopPropagation(), { signal });
  dom.titleAuthBtn?.addEventListener(
    'click',
    (ev: MouseEvent) => {
      ev.stopPropagation();
      handleGoogleAuthClick();
    },
    { signal }
  );

  bindPointerTap(dom.devToolsBtn, () => toggleDevTools(), { signal, stopPropagation: true });
  bindBackGestureSurface(dom.viewportEl, () => backStack.triggerMenuOrBack(), { signal });

  bindPointerTap(
    dom.btnContinue,
    () => {
      audioManager.playSfx('select');
      setStatus('');
      if (!manager.hasAnySave()) {
        openDemoQuizFlow();
        return;
      }
      openSaveSlotOverlay({
        manager,
        audioManager,
        mode: 'load',
        onPickSlot: (slot, summary) => {
          manager.loadSlot(slot);
          if (summary.isEmpty || manager.getSave() === null) openDemoQuizFlow();
          else void continueCampaignFromTitle();
        },
        onClose: () => renderAll(),
      });
    },
    { signal }
  );

  const renderAll = (): void => {
    const hasAnySave = manager.hasAnySave();
    const adminActive = isAppAdminSignedIn(ctx);
    const anySceneOpen =
      Boolean(ctx.cutsceneScene?.isOpen()) ||
      Boolean(ctx.creditsScene?.isOpen()) ||
      Boolean(ctx.quizScene?.isOpen()) ||
      Boolean(ctx.dialogueOverlay?.isOpen()) ||
      Boolean(ctx.battleScene?.isOpen()) ||
      Boolean(ctx.mapEditorScene?.isOpen()) ||
      Boolean(ctx.overworldScene?.isOpen());
    if (!anySceneOpen && dom.titleScreen) dom.titleScreen.hidden = false;
    if (dom.devToolsBtn) dom.devToolsBtn.hidden = !adminActive;
    if (!adminActive) {
      if (ctx.mapEditorScene?.isOpen()) ctx.mapEditorScene.close();
      if (isAppDevToolsOpen(ctx)) closeDevToolsOverlay();
    }
    if (hasAnySave) {
      if (dom.btnContinueLabel) dom.btnContinueLabel.textContent = 'Continue';
      if (dom.btnContinueChapter) {
        const active = manager.getSaveSlotSummaries().find((s) => s.isActive && !s.isEmpty);
        dom.btnContinueChapter.textContent = active ? (active.chapterLabel ?? 'Prologue') : '';
        dom.btnContinueChapter.hidden = !active;
      }
    } else {
      if (dom.btnContinueLabel) dom.btnContinueLabel.textContent = 'New Game';
      if (dom.btnContinueChapter) {
        dom.btnContinueChapter.textContent = '';
        dom.btnContinueChapter.hidden = true;
      }
    }
    if (dom.titleAuthBtn) {
      const user = manager.getSyncStatus().user;
      const who = user?.email ?? user?.displayName ?? 'Google Account';
      dom.titleAuthBtn.innerHTML = `${GOOGLE_G_SVG_MARKUP}<span>${user ? 'Log Out' : 'Log In'}</span>`;
      dom.titleAuthBtn.setAttribute('aria-label', user ? `Signed in as ${who} - Log out` : 'Log in with Google');
      if (user) dom.titleAuthBtn.title = `Signed in as ${who}`;
      else dom.titleAuthBtn.removeAttribute('title');
    }
    ctx.devToolsHarness?.onSaveChanged();
    backStack.syncButtonLabel();
  };

  return { renderAll };
}
