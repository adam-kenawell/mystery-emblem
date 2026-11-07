/**
 * Reusable Icon-First Item Grid Cells & Mini Item Sprite Badges
 *
 * Strictly obeys:
 * - Rule 2: Unified Pointer Events ONLY (`pointerenter`, `pointerleave` + `bindPointerTap`),
 *   ZERO keyboard listeners, >= 44x44px hitboxes across Desktop & Mobile.
 * - Rule 3: Authentic PMD: Explorers of Sky `image-rendering: pixelated` item icons,
 *   selection-locked Inspector Banner ergonomics (mouse hover highlights without hijacking).
 */

import { loadItemIcon } from '../assets/pmdAssetLoader';
import { getItemById } from '../data/index';
import { bindPointerTap } from './pointerControls';

export function extractTmNumberCode(itemId: string): string | null {
  const m = /^tm(\d{2})_/i.exec(itemId.trim());
  return m ? m[1]! : null;
}

function drawItemAssetOntoCanvas(
  canvas: HTMLCanvasElement,
  sizePx: number,
  cropped: boolean,
  asset: {
    source: CanvasImageSource;
    width: number;
    height: number;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  }
): void {
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.imageSmoothingEnabled = false;

  const sx = cropped ? asset.cropX : 0;
  const sy = cropped ? asset.cropY : 0;
  const sw = cropped ? asset.cropW : asset.width;
  const sh = cropped ? asset.cropH : asset.height;

  const scale = Math.min(sizePx / Math.max(1, sw), sizePx / Math.max(1, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const dx = Math.floor((sizePx - dw) / 2);
  const dy = Math.floor((sizePx - dh) / 2);

  ctx.drawImage(asset.source, sx, sy, sw, sh, dx, dy, dw, dh);
}

export interface CreateMiniItemIconOptions {
  sizePx?: number;
  cropped?: boolean;
  title?: string;
  testId?: string;
  quantityBadge?: number;
  decorative?: boolean;
}

export function createMiniItemIcon(
  itemId: string,
  options: CreateMiniItemIconOptions = {}
): HTMLElement {
  const item = getItemById(itemId);
  const sizePx = options.sizePx ?? 24;
  const cropped = options.cropped ?? false;
  const label = options.title ?? item?.name ?? itemId;

  const wrap = document.createElement('span');
  wrap.className = 'pmd-mini-item-icon';
  wrap.dataset.itemId = itemId;
  wrap.style.width = `${sizePx + 4}px`;
  wrap.style.height = `${sizePx + 4}px`;
  if (options.decorative) {
    wrap.setAttribute('aria-hidden', 'true');
  } else {
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', label);
    wrap.title = label;
  }
  if (options.testId) {
    wrap.dataset.testid = options.testId;
  }

  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  canvas.className = 'pmd-item-icon-canvas';
  wrap.appendChild(canvas);

  if (typeof options.quantityBadge === 'number' && options.quantityBadge > 1) {
    const qtyEl = document.createElement('span');
    qtyEl.className = 'pmd-mini-item-qty';
    qtyEl.setAttribute('aria-hidden', 'true');
    qtyEl.textContent = `×${options.quantityBadge}`;
    wrap.appendChild(qtyEl);
  }

  void loadItemIcon(itemId).then((asset) => {
    drawItemAssetOntoCanvas(canvas, sizePx, cropped, asset);
    canvas.dataset.loaded = 'true';
  });

  return wrap;
}

export interface CreateItemIconCellOptions {
  itemId: string;
  ariaLabel?: string;
  testId?: string;
  isSelected?: boolean;
  isEquippedOnSelected?: boolean;
  isHeldByOther?: boolean;
  isDepleted?: boolean;
  /** Stack count in Bag/Convoy */
  quantity?: number;
  /** When true (e.g. Prep Manage Items), displays `×0` when all copies are held by squad units */
  showZeroQuantity?: boolean;
  /** Displayed ONLY on Kecleon Shop cells */
  priceGold?: number;
  iconSizePx?: number;
  onSelect: () => void;
  signal?: AbortSignal;
}

export function createItemIconCell(options: CreateItemIconCellOptions): HTMLButtonElement {
  const item = getItemById(options.itemId);
  const label = options.ariaLabel ?? item?.name ?? options.itemId;
  const iconSizePx = options.iconSizePx ?? 30;

  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['pmd-btn', 'pmd-item-icon-cell'];
  if (options.isSelected) classes.push('is-selected', 'is-active');
  if (options.isEquippedOnSelected) classes.push('is-equipped');
  if (options.isHeldByOther) classes.push('is-held-other');
  if (options.isDepleted) classes.push('is-depleted');
  if (typeof options.priceGold === 'number') classes.push('has-price');
  btn.className = classes.join(' ');
  btn.dataset.itemId = options.itemId;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  if (options.testId) {
    btn.dataset.testid = options.testId;
  }

  const inner = document.createElement('span');
  inner.className = 'pmd-item-icon-cell-inner';

  const canvas = document.createElement('canvas');
  canvas.width = iconSizePx;
  canvas.height = iconSizePx;
  canvas.className = 'pmd-item-icon-canvas';
  inner.appendChild(canvas);
  btn.appendChild(inner);

  void loadItemIcon(options.itemId).then((asset) => {
    drawItemAssetOntoCanvas(canvas, iconSizePx, false, asset);
    canvas.dataset.loaded = 'true';
  });

  // 1. TM `01`..`24` top-left micro-tag so same-type discs (e.g. TM01/TM02/TM03) are distinct
  const tmCode = item?.category === 'tm' ? extractTmNumberCode(item.id) : null;
  if (tmCode) {
    const tmPip = document.createElement('span');
    tmPip.className = 'pmd-item-cell-pip is-tm';
    tmPip.setAttribute('aria-hidden', 'true');
    tmPip.textContent = tmCode;
    btn.appendChild(tmPip);
  }

  // 2. Equipped / Held top-right pip
  if (options.isEquippedOnSelected) {
    const eqPip = document.createElement('span');
    eqPip.className = 'pmd-item-cell-pip is-equipped';
    eqPip.setAttribute('aria-hidden', 'true');
    eqPip.textContent = 'E';
    btn.appendChild(eqPip);
  } else if (options.isHeldByOther) {
    const heldPip = document.createElement('span');
    heldPip.className = 'pmd-item-cell-pip is-held-other';
    heldPip.setAttribute('aria-hidden', 'true');
    heldPip.textContent = '•';
    btn.appendChild(heldPip);
  }

  // 3. Stack count bottom-right pip (`×N` when > 1, or `×0` when showZeroQuantity is true)
  if (typeof options.quantity === 'number') {
    if (options.quantity > 1 || (options.showZeroQuantity && options.quantity === 0)) {
      const qtyPip = document.createElement('span');
      qtyPip.className = `pmd-item-cell-pip is-qty${options.quantity === 0 ? ' is-zero' : ''}`;
      qtyPip.setAttribute('aria-hidden', 'true');
      qtyPip.textContent = `×${options.quantity}`;
      btn.appendChild(qtyPip);
    }
  }

  // 4. Kecleon Shop price chip
  if (typeof options.priceGold === 'number') {
    const priceTag = document.createElement('span');
    priceTag.className = 'pmd-item-cell-price';
    priceTag.setAttribute('aria-hidden', 'true');
    priceTag.textContent = `${options.priceGold}G`;
    btn.appendChild(priceTag);
  }

  const listenerOpts = options.signal ? { signal: options.signal } : undefined;

  btn.addEventListener(
    'pointerenter',
    (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      btn.classList.add('is-hovered');
    },
    listenerOpts
  );

  btn.addEventListener(
    'pointerleave',
    (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      btn.classList.remove('is-hovered');
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
