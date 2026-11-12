/**
 * PMD Dialogue Stage & Portrait Slot DOM Shell (`DialogueDomView.ts`)
 */

import { PmdPortraitView } from './PmdSpriteCanvas';
import { createPmdButton, createPmdWindow } from './PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';

export interface DialogueDomElements {
  rootEl: HTMLElement;
  stageEl: HTMLElement;
  leftSlotEl: HTMLElement;
  rightSlotEl: HTMLElement;
  leftPortrait: PmdPortraitView;
  rightPortrait: PmdPortraitView;
  boxEl: HTMLElement;
  nicknameEl: HTMLElement;
  skipBtn: HTMLButtonElement;
  textEl: HTMLElement;
  advanceBtn: HTMLButtonElement;
}

export function buildDialogueDomView(opts: {
  mountParent: HTMLElement;
  signal: AbortSignal;
  onAdvance: () => void;
  onSkip: () => void;
  onCancel: () => void;
}): DialogueDomElements {
  const rootEl = document.createElement('div');
  rootEl.id = 'pmd-dialogue-overlay';
  rootEl.className = 'pmd-dialogue-overlay';
  rootEl.dataset.testid = 'dialogue-overlay';
  rootEl.hidden = true;
  rootEl.setAttribute('role', 'dialog');
  rootEl.setAttribute('aria-modal', 'true');
  rootEl.setAttribute('aria-label', 'Story Dialogue');

  const stageEl = document.createElement('div');
  stageEl.className = 'pmd-dialogue-stage';

  const leftSlotEl = createPmdWindow({
    variant: 'compact-translucent',
    className: 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--left',
    testId: 'dialogue-portrait-left',
  });
  leftSlotEl.hidden = true;
  const leftPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-left-canvas' });
  leftSlotEl.appendChild(leftPortrait.canvas);

  const rightSlotEl = createPmdWindow({
    variant: 'compact-translucent',
    className: 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--right',
    testId: 'dialogue-portrait-right',
  });
  rightSlotEl.hidden = true;
  const rightPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-right-canvas' });
  rightSlotEl.appendChild(rightPortrait.canvas);

  const boxEl = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-box',
    testId: 'dialogue-box',
  });

  const headerEl = document.createElement('div');
  headerEl.className = 'pmd-dialogue-header';

  const speakerGroup = document.createElement('div');
  speakerGroup.className = 'pmd-dialogue-speaker-group';

  const nicknameEl = document.createElement('span');
  nicknameEl.className = 'pmd-dialogue-nickname';
  nicknameEl.dataset.testid = 'dialogue-speaker-nickname';

  speakerGroup.append(nicknameEl);

  const controlsGroup = document.createElement('div');
  controlsGroup.className = 'pmd-dialogue-controls';

  const skipBtn = createPmdButton({
    label: 'Skip',
    className: 'pmd-dialogue-skip-btn',
    testId: 'dialogue-skip-btn',
    ariaLabel: 'Skip dialogue',
    onTap: () => opts.onSkip(),
    tapOptions: { signal: opts.signal, stopPropagation: true },
  });

  controlsGroup.appendChild(skipBtn);
  headerEl.append(speakerGroup, controlsGroup);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'pmd-dialogue-body';

  const textEl = document.createElement('p');
  textEl.className = 'pmd-dialogue-text';
  textEl.dataset.testid = 'dialogue-text';

  const advanceBtn = createPmdButton({
    label: 'Next ▼',
    variant: 'primary',
    className: 'pmd-dialogue-advance-btn',
    testId: 'dialogue-advance-btn',
    ariaLabel: 'Advance dialogue',
    onTap: () => opts.onAdvance(),
    tapOptions: { signal: opts.signal, stopPropagation: true },
  });
  advanceBtn.innerHTML =
    '<span>Next</span><span class="pmd-dialogue-caret" aria-hidden="true">▼</span>';

  bodyEl.append(textEl, advanceBtn);
  boxEl.append(headerEl, bodyEl);
  stageEl.append(leftSlotEl, rightSlotEl, boxEl);
  rootEl.appendChild(stageEl);
  opts.mountParent.appendChild(rootEl);

  for (const surface of [boxEl, leftSlotEl, rightSlotEl]) {
    bindPointerTap(surface, () => opts.onAdvance(), {
      signal: opts.signal,
      stopPropagation: true,
    });
  }
  bindPointerTap(
    rootEl,
    (ev) => {
      if (ev.target === rootEl || ev.target === stageEl) opts.onAdvance();
    },
    { signal: opts.signal }
  );
  bindBackGestureSurface(rootEl, () => opts.onCancel(), { signal: opts.signal });

  return {
    rootEl,
    stageEl,
    leftSlotEl,
    rightSlotEl,
    leftPortrait,
    rightPortrait,
    boxEl,
    nicknameEl,
    skipBtn,
    textEl,
    advanceBtn,
  };
}
