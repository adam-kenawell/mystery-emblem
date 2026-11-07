/**
 * Reusable Portrait-First Unit Grid Cells & Mini Species Portrait Badges
 *
 * Strictly obeys:
 * - Rule 2: Unified Pointer Events ONLY (`pointerenter`, `pointerleave` + `bindPointerTap`),
 *   ZERO keyboard listeners, >= 44x44px hitboxes across Desktop & Mobile.
 * - Rule 3: Authentic PMD: Explorers of Sky `image-rendering: pixelated` portraits,
 *   base `'Normal'` emotion swapping to `'Happy'` + gold pixel frame on hover/selection.
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import { getItemById } from '../data/index';
import { createMiniItemIcon } from './PmdItemIconGrid';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { bindPointerTap } from './pointerControls';

export interface CreateUnitPortraitCellOptions {
  speciesIdOrAssetId: string;
  ariaLabel: string;
  testId?: string;
  portraitTestId?: string;
  isSelected?: boolean;
  isLord?: boolean;
  isDeployed?: boolean;
  isBenched?: boolean;
  hasItem?: boolean;
  equippedItemId?: string | null;
  onSelect: () => void;
  signal?: AbortSignal;
}

export function createUnitPortraitCell(
  options: CreateUnitPortraitCellOptions
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['pmd-btn', 'pmd-unit-portrait-cell'];
  if (options.isSelected) classes.push('is-selected', 'is-active');
  if (options.isBenched) classes.push('is-benched');
  btn.className = classes.join(' ');
  btn.setAttribute('aria-label', options.ariaLabel);
  if (options.testId) {
    btn.dataset.testid = options.testId;
  }

  const frameWrap = document.createElement('span');
  frameWrap.className = 'pmd-unit-portrait-inner';

  const portraitView = new PmdPortraitView({
    pixelScale: 1,
    testId: options.portraitTestId,
  });
  frameWrap.appendChild(portraitView.canvas);
  btn.appendChild(frameWrap);

  const initialEmotion: PmdPortraitEmotion = options.isSelected ? 'Happy' : 'Normal';
  void portraitView.setPortrait({
    speciesIdOrAssetId: options.speciesIdOrAssetId,
    emotion: initialEmotion,
  });

  if (options.isLord) {
    const pip = document.createElement('span');
    pip.className = 'pmd-portrait-pip is-lord';
    pip.setAttribute('aria-hidden', 'true');
    pip.textContent = '★';
    btn.appendChild(pip);
  } else if (options.isDeployed) {
    const pip = document.createElement('span');
    pip.className = 'pmd-portrait-pip is-deployed';
    pip.setAttribute('aria-hidden', 'true');
    pip.textContent = '✓';
    btn.appendChild(pip);
  }

  if (options.equippedItemId) {
    const itemDef = getItemById(options.equippedItemId);
    const itemPip = document.createElement('span');
    itemPip.className = 'pmd-portrait-pip is-item has-icon';
    itemPip.dataset.itemId = options.equippedItemId;
    itemPip.title = itemDef?.name ?? options.equippedItemId;
    itemPip.setAttribute('aria-hidden', 'true');
    const mini = createMiniItemIcon(options.equippedItemId, {
      sizePx: 14,
      cropped: true,
      decorative: true,
    });
    itemPip.appendChild(mini);
    btn.appendChild(itemPip);
  } else if (options.hasItem) {
    const itemDot = document.createElement('span');
    itemDot.className = 'pmd-portrait-pip is-item';
    itemDot.setAttribute('aria-hidden', 'true');
    itemDot.textContent = '◆';
    btn.appendChild(itemDot);
  }

  const listenerOpts = options.signal ? { signal: options.signal } : undefined;

  btn.addEventListener(
    'pointerenter',
    (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      btn.classList.add('is-hovered');
      void portraitView.setPortrait({
        speciesIdOrAssetId: options.speciesIdOrAssetId,
        emotion: 'Happy',
      });
    },
    listenerOpts
  );

  btn.addEventListener(
    'pointerleave',
    (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      btn.classList.remove('is-hovered');
      if (!options.isSelected) {
        void portraitView.setPortrait({
          speciesIdOrAssetId: options.speciesIdOrAssetId,
          emotion: 'Normal',
        });
      }
    },
    listenerOpts
  );

  bindPointerTap(
    btn,
    () => {
      options.onSelect();
    },
    listenerOpts
  );

  return btn;
}

export interface CreateMiniSpeciesPortraitOptions {
  title?: string;
  testId?: string;
  emotion?: PmdPortraitEmotion;
  sizePx?: number;
}

export function createMiniSpeciesPortrait(
  speciesIdOrAssetId: string,
  options: CreateMiniSpeciesPortraitOptions = {}
): HTMLElement {
  const sizePx = options.sizePx ?? 24;
  const wrap = document.createElement('span');
  wrap.className = 'pmd-mini-portrait-icon';
  wrap.style.width = `${sizePx + 4}px`;
  wrap.style.height = `${sizePx + 4}px`;
  if (options.title) {
    wrap.title = options.title;
  } else {
    wrap.setAttribute('aria-hidden', 'true');
  }
  if (options.testId) {
    wrap.dataset.testid = options.testId;
  }

  const view = new PmdPortraitView({
    pixelScale: sizePx / 40,
  });
  wrap.appendChild(view.canvas);
  void view.setPortrait({
    speciesIdOrAssetId,
    emotion: options.emotion ?? 'Normal',
  });

  return wrap;
}
