/**
 * Mystery Emblem - Chapter Prep Static Pointer Button Bindings (`prepButtonBindings.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import type { ItemFilterTab } from '../inspector/ItemActionInspector';
import { bindPointerTap } from '../pointerControls';
import type { PrepSubMode } from '../DungeonPrepOverlay';
import type { PrepDomElements } from './prepTemplates';

export function bindPrepStaticButtons(params: {
  dom: PrepDomElements;
  audioManager: AudioManager;
  signal: AbortSignal;
  getSelectedUnitInstanceId: () => string | null;
  onRosterOrLoadoutMutated: () => void;
  onRefreshAll: () => void;
  onSetSubMode: (mode: PrepSubMode, clearStatus?: 'units' | 'items') => void;
  onEnterViewMap: () => void;
  onExitViewMap: () => void;
  onConfirmEnterDungeon: () => void;
  onSaveProgress?: () => void;
  onToggleGlobalDanger: () => void;
  onSyncMapHudState: () => void;
  onSelectItemFilter: (filter: ItemFilterTab) => void;
}): void {
  const { dom, audioManager, signal } = params;

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-units"]'),
    () => {
      audioManager.playSfx('select');
      params.onSetSubMode('manage_units', 'units');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-items"]'),
    () => {
      audioManager.playSfx('select');
      params.onSetSubMode('manage_items', 'items');
    },
    { signal }
  );

  bindPointerTap(
    dom.supportsBtnEl,
    () => {
      audioManager.playSfx('select');
      params.onSetSubMode('supports');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-view-map"]'),
    () => {
      audioManager.playSfx('select');
      params.onEnterViewMap();
      params.onSetSubMode('view_map');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-save-progress"]'),
    () => {
      audioManager.playSfx('select');
      params.onSaveProgress?.();
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-enter-dungeon"]'),
    () => {
      audioManager.playSfx('select');
      params.onConfirmEnterDungeon();
    },
    { signal }
  );

  bindPointerTap(
    dom.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-units-close-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      params.onSetSubMode('hub');
    },
    { signal }
  );

  bindPointerTap(
    dom.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-open-items-btn"]'),
    () => {
      audioManager.playSfx('select');
      params.onSetSubMode('manage_items', 'items');
    },
    { signal }
  );

  bindPointerTap(
    dom.itemsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-items-close-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      params.onSetSubMode('hub');
    },
    { signal }
  );

  bindPointerTap(
    dom.supportsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-supports-close-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      params.onSetSubMode('hub');
    },
    { signal }
  );

  const filterBtns =
    dom.itemsBackdropEl.querySelectorAll<HTMLButtonElement>('[data-item-filter]');
  filterBtns.forEach((btn) => {
    bindPointerTap(
      btn,
      () => {
        const filter = (btn.dataset.itemFilter as ItemFilterTab) || 'all';
        audioManager.playSfx('select');
        filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        params.onSelectItemFilter(filter);
      },
      { signal }
    );
  });

  bindPointerTap(
    dom.mapReturnBtnEl,
    () => {
      audioManager.playSfx('select');
      params.onExitViewMap();
      params.onSetSubMode('hub');
    },
    { signal }
  );

  bindPointerTap(
    dom.mapDangerBtnEl,
    () => {
      params.onToggleGlobalDanger();
      params.onSyncMapHudState();
    },
    { signal }
  );
}
