/**
 * Reusable PMD: Explorers of Sky UI Window Component Builders (Step 2, Rule 3)
 */

import { bindPointerTap, type BindPointerTapOptions } from './pointerControls';

export type PmdWindowVariant =
  | 'default'
  | 'translucent'
  | 'gold'
  | 'compact'
  | 'compact-translucent';

export interface CreatePmdWindowOptions {
  tag?: 'div' | 'section' | 'article' | 'aside';
  variant?: PmdWindowVariant;
  className?: string;
  id?: string;
  testId?: string;
  role?: string;
  ariaLabel?: string;
}

export function createPmdWindow(options: CreatePmdWindowOptions = {}): HTMLElement {
  const el = document.createElement(options.tag ?? 'div');
  const classes = ['pmd-window'];
  if (options.variant === 'translucent') classes.push('pmd-window--translucent');
  if (options.variant === 'gold') classes.push('pmd-window--gold');
  if (options.variant === 'compact') classes.push('pmd-window--compact');
  if (options.variant === 'compact-translucent') {
    classes.push('pmd-window--compact', 'pmd-window--translucent');
  }
  if (options.className) classes.push(options.className);
  el.className = classes.join(' ');
  if (options.id) el.id = options.id;
  if (options.testId) el.dataset.testid = options.testId;
  if (options.role) el.setAttribute('role', options.role);
  if (options.ariaLabel) el.setAttribute('aria-label', options.ariaLabel);
  return el;
}

export interface CreatePmdButtonOptions {
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  menuRow?: boolean;
  className?: string;
  id?: string;
  testId?: string;
  ariaLabel?: string;
  onTap?: (ev: PointerEvent) => void;
  tapOptions?: BindPointerTapOptions;
}

export function createPmdButton(options: CreatePmdButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['pmd-btn'];
  if (options.variant === 'primary') classes.push('pmd-btn-primary');
  if (options.variant === 'danger') classes.push('pmd-btn-danger');
  if (options.menuRow) classes.push('pmd-menu-row');
  if (options.className) classes.push(options.className);
  btn.className = classes.join(' ');
  btn.textContent = options.label;
  if (options.id) btn.id = options.id;
  if (options.testId) btn.dataset.testid = options.testId;
  if (options.ariaLabel) btn.setAttribute('aria-label', options.ariaLabel);
  if (options.onTap) {
    bindPointerTap(btn, options.onTap, options.tapOptions);
  }
  return btn;
}

/** 10x10 native-texel crisp pixel-art red `X` with 1-texel `#000000` outline. */
export const PMD_CLOSE_X_SVG =
  '<svg viewBox="0 0 10 10" width="18" height="18" aria-hidden="true" shape-rendering="crispEdges">' +
  '<path fill="#000000" d="M1,0H3V1H4V2H6V1H7V0H9V1H10V3H9V4H8V6H9V7H10V9H9V10H7V9H6V8H4V9H3V10H1V9H0V7H1V6H2V4H1V3H0V1H1Z"/>' +
  '<path fill="currentColor" d="M1,1H3V2H4V3H6V2H7V1H9V2H8V3H7V4H6V6H7V7H8V8H9V9H7V8H6V7H4V8H3V9H1V8H2V7H3V6H4V4H3V3H2V2H1Z"/>' +
  '</svg>';

export interface PmdCloseXButtonOptions {
  testId?: string;
  ariaLabel?: string;
  corner?: boolean;
  className?: string;
  onTap?: (ev: PointerEvent) => void;
  tapOptions?: BindPointerTapOptions;
}

export function buildPmdCloseXButtonHtml(options: PmdCloseXButtonOptions = {}): string {
  const classes = ['pmd-close-x-btn'];
  if (options.corner) classes.push('is-corner');
  if (options.className) classes.push(options.className);
  const label = (options.ariaLabel ?? 'Close').replace(/"/g, '&quot;');
  const testIdAttr = options.testId ? ` data-testid="${options.testId}"` : '';
  return `<button type="button" class="${classes.join(' ')}"${testIdAttr} aria-label="${label}">${PMD_CLOSE_X_SVG}</button>`;
}

export function createPmdCloseXButton(options: PmdCloseXButtonOptions = {}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['pmd-close-x-btn'];
  if (options.corner) classes.push('is-corner');
  if (options.className) classes.push(options.className);
  btn.className = classes.join(' ');
  if (options.testId) btn.dataset.testid = options.testId;
  btn.setAttribute('aria-label', options.ariaLabel ?? 'Close');
  btn.innerHTML = PMD_CLOSE_X_SVG;
  if (options.onTap) {
    bindPointerTap(btn, options.onTap, options.tapOptions);
  }
  return btn;
}
