/**
 * Small DOM Builders for the Cutscene Editor (`editorDom.ts`)
 */

import { bindPointerTap } from '../ui/pointerControls';

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export interface UiContext {
  signal: AbortSignal;
  sfx: (id: 'select' | 'cancel') => void;
}

export function button(
  ui: UiContext,
  label: string,
  onTap: () => void,
  opts: { kind?: 'primary' | 'danger' | 'ghost' | 'chip'; title?: string; testid?: string; disabled?: boolean; active?: boolean } = {}
): HTMLButtonElement {
  const el = h('button', {
    type: 'button',
    class: `cse-btn${opts.kind ? ` cse-btn--${opts.kind}` : ''}${opts.active ? ' is-active' : ''}`,
    title: opts.title,
    'data-testid': opts.testid,
    text: label,
  });
  el.disabled = Boolean(opts.disabled);
  bindPointerTap(
    el,
    () => {
      ui.sfx(opts.kind === 'danger' ? 'cancel' : 'select');
      onTap();
    },
    { signal: ui.signal }
  );
  return el;
}

export function field(label: string, control: Node, hint?: string): HTMLElement {
  return h('label', { class: 'cse-field' }, h('span', { class: 'cse-field-label', text: label }), control, hint ? h('span', { class: 'cse-hint', text: hint }) : null);
}

export function row(...children: Child[]): HTMLElement {
  return h('div', { class: 'cse-row' }, ...children);
}

export function section(title: string, ...children: Child[]): HTMLElement {
  return h('section', { class: 'cse-section' }, h('h4', { class: 'cse-section-title', text: title }), ...children);
}

export function selectInput<T extends string>(
  ui: UiContext,
  options: ReadonlyArray<{ value: T; label: string; group?: string }>,
  value: T | '',
  onChange: (v: T) => void,
  testid?: string
): HTMLSelectElement {
  const el = h('select', { class: 'cse-input', 'data-testid': testid });
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const opt of options) {
    const o = h('option', { value: opt.value, text: opt.label });
    if (opt.group) {
      let g = groups.get(opt.group);
      if (!g) {
        g = h('optgroup', { label: opt.group });
        groups.set(opt.group, g);
        el.append(g);
      }
      g.append(o);
    } else el.append(o);
  }
  el.value = value;
  el.addEventListener('change', () => onChange(el.value as T), { signal: ui.signal });
  return el;
}

export function textInput(
  ui: UiContext,
  value: string,
  onInput: (v: string) => void,
  opts: { placeholder?: string; testid?: string; multiline?: boolean; rows?: number } = {}
): HTMLInputElement | HTMLTextAreaElement {
  const el = opts.multiline
    ? h('textarea', { class: 'cse-input cse-textarea', rows: opts.rows ?? 3, placeholder: opts.placeholder, 'data-testid': opts.testid })
    : h('input', { class: 'cse-input', type: 'text', placeholder: opts.placeholder, 'data-testid': opts.testid });
  el.value = value;
  el.addEventListener('input', () => onInput(el.value), { signal: ui.signal });
  return el;
}

export function numberInput(
  ui: UiContext,
  value: number | undefined,
  onChange: (v: number) => void,
  opts: { step?: number; min?: number; max?: number; placeholder?: string; testid?: string } = {}
): HTMLInputElement {
  const el = h('input', {
    class: 'cse-input cse-input--num',
    type: 'number',
    step: opts.step ?? 1,
    min: opts.min,
    max: opts.max,
    placeholder: opts.placeholder,
    'data-testid': opts.testid,
  });
  el.value = value === undefined || Number.isNaN(value) ? '' : String(value);
  el.addEventListener(
    'change',
    () => {
      const n = Number(el.value);
      if (el.value.trim() !== '' && Number.isFinite(n)) onChange(n);
    },
    { signal: ui.signal }
  );
  return el;
}

export function checkbox(ui: UiContext, label: string, checked: boolean, onChange: (v: boolean) => void, testid?: string): HTMLElement {
  const input = h('input', { type: 'checkbox', 'data-testid': testid });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked), { signal: ui.signal });
  return h('label', { class: 'cse-check' }, input, h('span', { text: label }));
}

export function segmented<T extends string>(
  ui: UiContext,
  options: ReadonlyArray<{ value: T; label: string; title?: string }>,
  value: T,
  onChange: (v: T) => void
): HTMLElement {
  const wrap = h('div', { class: 'cse-seg' });
  for (const opt of options) {
    wrap.append(button(ui, opt.label, () => onChange(opt.value), { kind: 'chip', active: opt.value === value, title: opt.title }));
  }
  return wrap;
}

/** Inserts text at the caret of an input/textarea and fires `input`. */
export function insertAtCaret(el: HTMLInputElement | HTMLTextAreaElement, before: string, after = ''): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const selected = el.value.slice(start, end);
  el.value = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  const caret = start + before.length + selected.length + (selected ? after.length : 0);
  el.focus();
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input'));
}
