/**
 * Tutorial Overlay DOM Shell & Pointer Gesture Surface (`TutorialShellView.ts`)
 */

import { PmdPortraitView } from '../PmdSpriteCanvas';
import { createPmdWindow } from '../PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from '../pointerControls';
import { TutorialSpotlightController } from './TutorialSpotlightController';

export interface TutorialShellElements {
  backdropEl: HTMLElement;
  cardWindowEl: HTMLElement;
  compendiumWindowEl: HTMLElement;
  coachPortraitView: PmdPortraitView;
  compendiumPortraitView: PmdPortraitView;
  spotlight: TutorialSpotlightController;
}

export function buildTutorialShellView(opts: {
  parent: HTMLElement;
  signal: AbortSignal;
  isInteractiveStep: () => boolean;
  onBackdropTap: () => void;
  onCardBodyTap: () => void;
  onBackGesture: () => void;
}): TutorialShellElements {
  const backdropEl = document.createElement('div');
  backdropEl.className = 'pmd-tutorial-backdrop';
  backdropEl.dataset.testid = 'tutorial-overlay-backdrop';
  backdropEl.hidden = true;

  const cardWindowEl = createPmdWindow({
    className: 'pmd-tutorial-card pmd-wimpod-coach-bar',
    testId: 'tutorial-card-modal',
    role: 'dialog',
    ariaLabel: "Wimpod's Tactical Guidance",
  });
  cardWindowEl.hidden = true;

  const compendiumWindowEl = createPmdWindow({
    className: 'pmd-tutorial-compendium',
    testId: 'tutorial-compendium-modal',
    role: 'dialog',
    ariaLabel: 'Ask Wimpod — Survival Notes',
  });
  compendiumWindowEl.hidden = true;

  const spotlight = new TutorialSpotlightController({ backdropEl, cardWindowEl });

  const coachPortraitView = new PmdPortraitView({
    pixelScale: 1.5,
    testId: 'tutorial-wimpod-portrait',
  });
  const compendiumPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'tutorial-compendium-wimpod-portrait',
  });

  backdropEl.append(spotlight.domSpotlightEl, cardWindowEl, compendiumWindowEl);
  opts.parent.appendChild(backdropEl);

  const { signal } = opts;
  bindPointerTap(
    backdropEl,
    (ev: PointerEvent) => {
      if (ev.target !== backdropEl || opts.isInteractiveStep()) return;
      opts.onBackdropTap();
    },
    { signal }
  );
  bindPointerTap(
    cardWindowEl,
    (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest('button')) return;
      opts.onCardBodyTap();
    },
    { signal }
  );
  bindBackGestureSurface(
    backdropEl,
    () => {
      if (!opts.isInteractiveStep()) opts.onBackGesture();
    },
    { signal }
  );
  backdropEl.addEventListener(
    'contextmenu',
    (ev: MouseEvent) => {
      if (opts.isInteractiveStep()) return;
      ev.preventDefault();
      ev.stopPropagation();
    },
    { signal }
  );
  backdropEl.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (opts.isInteractiveStep() && ev.target === backdropEl) return;
      ev.stopPropagation();
    },
    { signal }
  );

  return {
    backdropEl,
    cardWindowEl,
    compendiumWindowEl,
    coachPortraitView,
    compendiumPortraitView,
    spotlight,
  };
}
