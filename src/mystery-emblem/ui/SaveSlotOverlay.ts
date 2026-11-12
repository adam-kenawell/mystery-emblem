/**
 * Mystery Emblem - 3-Slot Save File Picker (`SaveSlotOverlay`)
 *
 * `load` mode backs the title screen's "Continue" file select (load / new game / delete).
 * `save` mode backs every in-game "Save Progress" button (pick a slot, confirm overwrites).
 */

import type { AudioManager } from '../audio/AudioManager';
import type { SaveSlotSummary, SaveStateManager } from '../state/SaveStateManager';
import { bindPointerTap } from './pointerControls';

export type SaveSlotOverlayMode = 'load' | 'save';

export interface OpenSaveSlotOverlayOptions {
  manager: SaveStateManager;
  audioManager?: AudioManager;
  mode: SaveSlotOverlayMode;
  /** `load`: a slot was chosen (filled = load it, empty = start a new game there). */
  onPickSlot?: (slot: number, summary: SaveSlotSummary) => void;
  /** `save`: perform the save for `slot`; throw to show an error. */
  onSaveToSlot?: (slot: number) => void;
  /** `save`: shown instead of the slot list when saving is currently impossible. */
  blockedReason?: string | null;
  onClose?: () => void;
}

let activeOverlay: { el: HTMLElement; close: () => void } | null = null;

export function isSaveSlotOverlayOpen(): boolean {
  return activeOverlay !== null;
}

export function closeSaveSlotOverlay(): void {
  activeOverlay?.close();
}

function formatSavedAt(ts: number | null): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string, testId: string): HTMLButtonElement {
  const b = el('button', `pmd-btn ${cls}`.trim(), text);
  b.type = 'button';
  b.dataset.testid = testId;
  return b;
}

export function openSaveSlotOverlay(opts: OpenSaveSlotOverlayOptions): void {
  closeSaveSlotOverlay();
  const host = document.getElementById('mystery-emblem-root') ?? document.body;
  const { manager, audioManager, mode } = opts;
  const abort = new AbortController();
  const signal = abort.signal;

  const backdrop = el('div', 'pmd-save-slot-backdrop');
  backdrop.dataset.testid = 'save-slot-overlay';
  backdrop.dataset.mode = mode;
  const dialog = el('div', 'pmd-window pmd-save-slot-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  backdrop.appendChild(dialog);

  // Keep taps/right-clicks from reaching the viewport's back-gesture surface or the canvases beneath.
  for (const evt of ['pointerdown', 'pointerup', 'click'] as const) {
    backdrop.addEventListener(evt, (e) => e.stopPropagation(), { signal });
  }
  backdrop.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      audioManager?.playSfx('cancel');
      close();
    },
    { signal }
  );

  let confirm: { kind: 'overwrite' | 'delete'; slot: number } | null = null;
  let status: { text: string; isError: boolean } | null = null;

  function close(): void {
    abort.abort();
    backdrop.remove();
    if (activeOverlay?.el === backdrop) activeOverlay = null;
    opts.onClose?.();
  }

  function performSave(slot: number): void {
    try {
      opts.onSaveToSlot?.(slot);
      audioManager?.playSfx('select');
      status = { text: `Progress saved to File ${slot}.`, isError: false };
    } catch (err) {
      audioManager?.playSfx('cancel');
      status = { text: err instanceof Error ? err.message : 'Could not save.', isError: true };
    }
    confirm = null;
    render();
  }

  function renderSlotCard(summary: SaveSlotSummary): HTMLElement {
    const card = el('div', 'pmd-save-slot-card');
    card.dataset.testid = `save-slot-${summary.slot}`;
    const main = button(
      `pmd-save-slot-main${summary.isActive && mode === 'save' ? ' is-active' : ''}`,
      '',
      `save-slot-${summary.slot}-select`
    );
    const heading = el('span', 'pmd-save-slot-heading', `File ${summary.slot}`);
    if (summary.isActive && mode === 'save' && !summary.isEmpty) {
      heading.appendChild(el('span', 'pmd-save-slot-tag', 'CURRENT'));
    }
    if (summary.hasBattleSuspend) {
      heading.appendChild(el('span', 'pmd-save-slot-tag is-battle', 'MID-BATTLE'));
    }
    main.appendChild(heading);
    if (summary.isEmpty) {
      main.appendChild(el('span', 'pmd-save-slot-meta', mode === 'load' ? 'Empty - Start a New Game' : 'Empty'));
    } else {
      main.appendChild(
        el('span', 'pmd-save-slot-meta', `${summary.lordName ?? '???'} · ${summary.chapterLabel ?? ''}`)
      );
      main.appendChild(
        el(
          'span',
          'pmd-save-slot-meta',
          `${summary.rosterCount} Pokémon · ${summary.gold} G · ${formatSavedAt(summary.lastUpdated)}`
        )
      );
    }
    bindPointerTap(
      main,
      () => {
        if (mode === 'load') {
          audioManager?.playSfx('select');
          const pick = opts.onPickSlot;
          close();
          pick?.(summary.slot, summary);
          return;
        }
        if (summary.isEmpty || summary.isActive) {
          performSave(summary.slot);
        } else {
          audioManager?.playSfx('select');
          confirm = { kind: 'overwrite', slot: summary.slot };
          status = null;
          render();
        }
      },
      { signal }
    );
    card.appendChild(main);

    if (mode === 'load' && !summary.isEmpty) {
      const del = button('pmd-btn-danger pmd-save-slot-side', 'Delete', `save-slot-${summary.slot}-delete`);
      bindPointerTap(
        del,
        () => {
          audioManager?.playSfx('select');
          confirm = { kind: 'delete', slot: summary.slot };
          status = null;
          render();
        },
        { signal }
      );
      card.appendChild(del);
    }
    return card;
  }

  function renderConfirm(c: { kind: 'overwrite' | 'delete'; slot: number }): HTMLElement {
    const box = el('div', 'pmd-save-slot-confirm');
    box.dataset.testid = 'save-slot-confirm';
    box.appendChild(
      el(
        'p',
        'pmd-subcard-text',
        c.kind === 'delete'
          ? `Delete File ${c.slot}? This also removes it from your linked Google account and cannot be undone.`
          : `Overwrite File ${c.slot} with your current progress?`
      )
    );
    const actions = el('div', 'pmd-battle-outcome-actions');
    const yes = button(
      c.kind === 'delete' ? 'pmd-btn-danger' : 'pmd-btn-primary',
      c.kind === 'delete' ? 'Delete' : 'Overwrite',
      'save-slot-confirm-yes'
    );
    const no = button('', 'Cancel', 'save-slot-confirm-no');
    bindPointerTap(
      yes,
      () => {
        if (c.kind === 'overwrite') {
          performSave(c.slot);
          return;
        }
        audioManager?.playSfx('cancel');
        confirm = null;
        status = { text: `File ${c.slot} deleted.`, isError: false };
        void manager
          .deleteSaveSlot(c.slot)
          .catch(() => {
            status = { text: `File ${c.slot} was deleted on this device, but the cloud copy could not be removed.`, isError: true };
          })
          .finally(() => {
            if (!signal.aborted) render();
          });
        render();
      },
      { signal }
    );
    bindPointerTap(
      no,
      () => {
        audioManager?.playSfx('cancel');
        confirm = null;
        render();
      },
      { signal }
    );
    actions.append(yes, no);
    box.appendChild(actions);
    return box;
  }

  function render(): void {
    dialog.replaceChildren();
    dialog.setAttribute('aria-label', mode === 'load' ? 'Choose a Save File' : 'Save Progress');
    dialog.appendChild(
      el('h3', 'pmd-panel-title', mode === 'load' ? 'CHOOSE A SAVE FILE' : 'SAVE PROGRESS')
    );

    if (mode === 'save' && opts.blockedReason) {
      dialog.appendChild(el('p', 'pmd-subcard-text', opts.blockedReason));
    } else if (confirm) {
      dialog.appendChild(renderConfirm(confirm));
    } else {
      const list = el('div', 'pmd-save-slot-list');
      for (const summary of manager.getSaveSlotSummaries()) list.appendChild(renderSlotCard(summary));
      dialog.appendChild(list);
    }

    const statusEl = el('p', `pmd-save-slot-status${status?.isError ? ' is-error' : ''}`, status?.text ?? '');
    statusEl.dataset.testid = 'save-slot-status';
    dialog.appendChild(statusEl);

    const actions = el('div', 'pmd-battle-outcome-actions');
    const closeBtn = button('', mode === 'load' ? 'Back' : 'Close', 'save-slot-close');
    bindPointerTap(
      closeBtn,
      () => {
        audioManager?.playSfx('cancel');
        close();
      },
      { signal }
    );
    actions.appendChild(closeBtn);
    dialog.appendChild(actions);
  }

  render();
  host.appendChild(backdrop);
  activeOverlay = { el: backdrop, close };
}
