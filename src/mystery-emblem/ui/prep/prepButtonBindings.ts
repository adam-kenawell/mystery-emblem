/**
 * Mystery Emblem — Chapter Prep Static Pointer Button Bindings (`prepButtonBindings.ts`)
 */

import type { AudioManager } from '../../audio/AudioManager';
import type { TutorialOverlay } from '../TutorialOverlay';
import type { ItemFilterTab } from '../inspector/ItemActionInspector';
import { bindPointerTap } from '../pointerControls';
import type { PrepSubMode } from '../DungeonPrepOverlay';
import type { PrepDomElements } from './prepTemplates';

export function bindPrepStaticButtons(params: {
  dom: PrepDomElements;
  audioManager: AudioManager;
  signal: AbortSignal;
  getTutorialOverlay?: () => TutorialOverlay | undefined;
  getSelectedUnitInstanceId: () => string | null;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  onRosterOrLoadoutMutated: () => void;
  onRefreshAll: () => void;
  onSetSubMode: (mode: PrepSubMode, clearStatus?: 'units' | 'items') => void;
  onEnterViewMap: () => void;
  onExitViewMap: () => void;
  onConfirmEnterDungeon: () => void;
  onToggleGlobalDanger: () => void;
  onSyncMapHudState: () => void;
  onSelectItemFilter: (filter: ItemFilterTab) => void;
}): void {
  const { dom, audioManager, signal, getTutorialOverlay } = params;

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-units"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      const expected = tutorial?.getExpectedAction() ?? null;
      if (expected && expected !== 'prep_open_manage_units') {
        tutorial?.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('select');
      params.onSetSubMode('manage_units', 'units');
      tutorial?.notifyActionCompleted('prep_open_manage_units');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-manage-items"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      if (tutorial?.getExpectedAction()) {
        tutorial.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('select');
      params.onSetSubMode('manage_items', 'items');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-view-map"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      const expected = tutorial?.getExpectedAction() ?? null;
      if (expected && expected !== 'prep_open_view_map') {
        tutorial?.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('select');
      params.onEnterViewMap();
      params.onSetSubMode('view_map');
      tutorial?.notifyActionCompleted('prep_open_view_map');
    },
    { signal }
  );

  bindPointerTap(
    dom.hubBackdropEl.querySelector<HTMLElement>('[data-testid="prep-btn-enter-dungeon"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      if (tutorial?.getExpectedAction()) {
        tutorial.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('select');
      params.onConfirmEnterDungeon();
    },
    { signal }
  );

  bindPointerTap(
    dom.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-units-close-btn"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      const expected = tutorial?.getExpectedAction() ?? null;
      if (expected && expected !== 'prep_close_manage_units') {
        tutorial?.nudgeActiveStep();
        return;
      }
      audioManager.playSfx('cancel');
      params.onSetSubMode('hub');
      tutorial?.notifyActionCompleted('prep_close_manage_units');
    },
    { signal }
  );

  bindPointerTap(
    dom.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-rename-btn"]'),
    () => {
      const targetId = params.getSelectedUnitInstanceId();
      if (!targetId || !params.onRequestRenameUnit) return;
      audioManager.playSfx('select');
      void Promise.resolve(params.onRequestRenameUnit(targetId)).then(() => {
        params.onRosterOrLoadoutMutated();
        params.onRefreshAll();
      });
    },
    { signal }
  );

  bindPointerTap(
    dom.unitsBackdropEl.querySelector<HTMLElement>('[data-testid="prep-unit-open-items-btn"]'),
    () => {
      const tutorial = getTutorialOverlay?.();
      if (tutorial?.getExpectedAction()) {
        tutorial.nudgeActiveStep();
        return;
      }
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
      const tutorial = getTutorialOverlay?.();
      audioManager.playSfx('select');
      params.onExitViewMap();
      params.onSetSubMode('hub');
      tutorial?.notifyActionCompleted('prep_swap_or_finish_view_map');
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
