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
  noteWindowEl: HTMLElement;
  compendiumWindowEl: HTMLElement;
  tooltipPillEl: HTMLButtonElement;
  coachPortraitView: PmdPortraitView;
  notePortraitView: PmdPortraitView;
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
  onTooltipPillTap: () => void;
}): TutorialShellElements {
  const backdropEl = document.createElement('div');
  backdropEl.className = 'pmd-tutorial-backdrop';
  backdropEl.dataset.testid = 'tutorial-overlay-backdrop';
  backdropEl.hidden = true;

  const cardWindowEl = document.createElement('div');
  cardWindowEl.className =
    'pmd-dialogue-stage pmd-tutorial-dialogue-stage pmd-tutorial-card pmd-advisor-coach-bar';
  cardWindowEl.dataset.testid = 'tutorial-card-modal';
  cardWindowEl.setAttribute('role', 'dialog');
  cardWindowEl.setAttribute('aria-label', "Quaquaval's Tactical Guidance");
  cardWindowEl.hidden = true;

  const noteWindowEl = createPmdWindow({
    className: 'pmd-tutorial-field-note',
    testId: 'tutorial-field-note-modal',
    role: 'dialog',
    ariaLabel: 'Field Note Details',
  });
  noteWindowEl.hidden = true;

  const compendiumWindowEl = createPmdWindow({
    className: 'pmd-tutorial-compendium',
    testId: 'tutorial-compendium-window',
    role: 'dialog',
    ariaLabel: "Quaquaval's Field Notes",
  });
  compendiumWindowEl.hidden = true;

  const tooltipPillEl = document.createElement('button');
  tooltipPillEl.type = 'button';
  tooltipPillEl.className = 'pmd-window pmd-window--gold pmd-tutorial-tooltip-pill';
  tooltipPillEl.dataset.testid = 'tutorial-tooltip-pill';
  tooltipPillEl.setAttribute('aria-live', 'polite');
  tooltipPillEl.hidden = true;

  const spotlight = new TutorialSpotlightController({ backdropEl, cardWindowEl });

  const coachPortraitView = new PmdPortraitView({
    testId: 'tutorial-advisor-portrait',
  });
  const notePortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'tutorial-note-advisor-portrait',
  });
  const compendiumPortraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: 'tutorial-compendium-advisor-portrait',
  });

  backdropEl.append(spotlight.domSpotlightEl, cardWindowEl, noteWindowEl, compendiumWindowEl);
  opts.parent.append(backdropEl, tooltipPillEl);

  const { signal } = opts;
  bindPointerTap(tooltipPillEl, () => opts.onTooltipPillTap(), {
    signal,
    stopPropagation: true,
  });
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
    noteWindowEl,
    compendiumWindowEl,
    tooltipPillEl,
    coachPortraitView,
    notePortraitView,
    compendiumPortraitView,
    spotlight,
  };
}
