/**
 * Reusable PMD: Explorers of Sky UI Window Component Builders (Step 2, Rule 3)
 */

import { bindPointerTap, type BindPointerTapOptions } from './pointerControls';

export type PmdWindowVariant = 'default' | 'gold' | 'compact';

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
  if (options.variant === 'gold') classes.push('pmd-window--gold');
  if (options.variant === 'compact') classes.push('pmd-window--compact');
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
