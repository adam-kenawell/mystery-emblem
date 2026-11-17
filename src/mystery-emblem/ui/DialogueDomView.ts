/**
 * PMD Dialogue Stage & Portrait Slot DOM Shell (`DialogueDomView.ts`)
 */

import { PmdPortraitView } from './PmdSpriteCanvas';
import { createPmdButton, createPmdWindow } from './PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';

export interface DialogueDomElements {
  rootEl: HTMLElement;
  stageEl: HTMLElement;
  leftActorRowEl: HTMLElement;
  rightActorRowEl: HTMLElement;
  leftSlotEl: HTMLElement;
  rightSlotEl: HTMLElement;
  leftPortrait: PmdPortraitView;
  rightPortrait: PmdPortraitView;
  boxEl: HTMLElement;
  nicknameEl: HTMLElement;
  skipBtn: HTMLButtonElement;
  textEl: HTMLElement;
  textBodyEl: HTMLElement;
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

  const skipBtn = createPmdButton({
    label: 'Skip',
    className: 'pmd-dialogue-skip-btn pmd-dialogue-screen-skip-btn',
    testId: 'dialogue-skip-btn',
    ariaLabel: 'Skip dialogue',
    onTap: () => opts.onSkip(),
    tapOptions: { signal: opts.signal, stopPropagation: true },
  });
  rootEl.appendChild(skipBtn);

  const stageEl = document.createElement('div');
  stageEl.className = 'pmd-dialogue-stage';

  const leftActorRowEl = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-actor-row pmd-dialogue-actor-row--left',
  });

  const leftSlotEl = document.createElement('div');
  leftSlotEl.className = 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--left';
  leftSlotEl.dataset.testid = 'dialogue-portrait-left';
  leftSlotEl.hidden = true;
  const leftPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-left-canvas' });
  leftSlotEl.appendChild(leftPortrait.canvas);
  leftActorRowEl.appendChild(leftSlotEl);

  const rightActorRowEl = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-actor-row pmd-dialogue-actor-row--right',
  });

  const rightSlotEl = document.createElement('div');
  rightSlotEl.className = 'pmd-dialogue-portrait-slot pmd-dialogue-portrait-slot--right';
  rightSlotEl.dataset.testid = 'dialogue-portrait-right';
  rightSlotEl.hidden = true;
  const rightPortrait = new PmdPortraitView({ testId: 'dialogue-portrait-right-canvas' });
  rightSlotEl.appendChild(rightPortrait.canvas);
  rightActorRowEl.appendChild(rightSlotEl);

  const nicknameEl = document.createElement('span');
  nicknameEl.className = 'pmd-dialogue-nickname';
  nicknameEl.dataset.testid = 'dialogue-speaker-nickname';

  const boxEl = createPmdWindow({
    variant: 'translucent',
    className: 'pmd-dialogue-box',
    testId: 'dialogue-box',
  });

  const bodyEl = document.createElement('div');
  bodyEl.className = 'pmd-dialogue-body';

  const textEl = document.createElement('p');
  textEl.className = 'pmd-dialogue-text';

  const textBodyEl = document.createElement('span');
  textBodyEl.className = 'pmd-dialogue-text-body';
  textBodyEl.dataset.testid = 'dialogue-text';
  textEl.append(nicknameEl, textBodyEl);

  const advanceBtn = document.createElement('button');
  advanceBtn.type = 'button';
  advanceBtn.className = 'pmd-dialogue-advance-btn';
  advanceBtn.dataset.testid = 'dialogue-advance-btn';
  advanceBtn.setAttribute('aria-label', 'Advance dialogue');
  advanceBtn.innerHTML = '<span class="pmd-dialogue-caret" aria-hidden="true">▼</span>';
  bindPointerTap(advanceBtn, () => opts.onAdvance(), {
    signal: opts.signal,
    stopPropagation: true,
  });

  bodyEl.append(textEl, advanceBtn);
  boxEl.appendChild(bodyEl);
  stageEl.append(leftActorRowEl, rightActorRowEl, boxEl);
  rootEl.appendChild(stageEl);
  opts.mountParent.appendChild(rootEl);

  for (const surface of [boxEl, leftActorRowEl, rightActorRowEl, leftSlotEl, rightSlotEl]) {
    bindPointerTap(surface, () => opts.onAdvance(), {
      signal: opts.signal,
      stopPropagation: true,
    });
  }
  bindPointerTap(
    rootEl,
    (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target?.closest('[data-testid="dialogue-skip-btn"]')) return;
      opts.onAdvance();
    },
    { signal: opts.signal }
  );
  bindBackGestureSurface(rootEl, () => opts.onCancel(), { signal: opts.signal });

  return {
    rootEl,
    stageEl,
    leftActorRowEl,
    rightActorRowEl,
    leftSlotEl,
    rightSlotEl,
    leftPortrait,
    rightPortrait,
    boxEl,
    nicknameEl,
    skipBtn,
    textEl,
    textBodyEl,
    advanceBtn,
  };
}
