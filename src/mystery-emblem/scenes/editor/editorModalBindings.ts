/**
 * System Menu & JSON Import/Export Modal Pointer Bindings for `ChapterMapEditorScene`
 */

import {
  cloneDungeonMap,
  validateDungeonMapDefinition,
} from '../../data/chapterMapRegistry';
import { bindPointerTap } from '../../ui/pointerControls';
import { preloadEditorMapAndUnitAssets } from './editorAssetsAndPalette';
import { pushEditorUndoSnapshot } from './editorBrushAndUndo';
import type { EditorControlCallbacks } from './editorHudAndDrawerBindings';

export function bindEditorModalInteractions(cb: EditorControlCallbacks): void {
  const { dom, state, audioManager, signal } = cb;

  for (const el of [dom.drawerEl, dom.systemMenuBackdropEl, dom.jsonModalBackdropEl]) {
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation(), { signal });
    el.addEventListener('wheel', (ev: WheelEvent) => ev.stopPropagation(), { signal });
  }

  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-save-btn"]'),
    () => {
      audioManager.playSfx('select');
      cb.saveCurrentMapToGame();
      state.systemMenuOpen = false;
      dom.systemMenuBackdropEl.hidden = true;
      cb.onLayerStateChanged();
    },
    { signal }
  );
  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-play-btn"]'),
    () => {
      audioManager.playSfx('select');
      state.systemMenuOpen = false;
      dom.systemMenuBackdropEl.hidden = true;
      cb.saveAndPlayCurrentLevel();
    },
    { signal }
  );
  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-drawer-btn"]'),
    () => {
      audioManager.playSfx('select');
      state.systemMenuOpen = false;
      dom.systemMenuBackdropEl.hidden = true;
      cb.setDrawerOpen(true);
    },
    { signal }
  );
  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-reset-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      cb.resetCurrentMapToDefault();
      state.systemMenuOpen = false;
      dom.systemMenuBackdropEl.hidden = true;
      cb.onLayerStateChanged();
    },
    { signal }
  );
  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-exit-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      cb.closeScene();
    },
    { signal }
  );
  bindPointerTap(
    dom.systemMenuBackdropEl.querySelector<HTMLElement>('[data-testid="editor-sys-resume-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      state.systemMenuOpen = false;
      dom.systemMenuBackdropEl.hidden = true;
      cb.onLayerStateChanged();
    },
    { signal }
  );

  bindPointerTap(
    dom.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-apply-btn"]'),
    () => {
      try {
        const parsed = JSON.parse(dom.jsonTextareaEl.value) as unknown;
        const v = validateDungeonMapDefinition(parsed, state.activeLevelId);
        if (!v.valid || !v.map) {
          dom.jsonStatusEl.textContent = `Validation failed: ${v.errors.join(' ')}`;
          dom.jsonStatusEl.hidden = false;
          return;
        }
        pushEditorUndoSnapshot(state);
        state.map = cloneDungeonMap(v.map);
        cb.saveCurrentMapToGame();
        state.jsonModalOpen = false;
        dom.jsonModalBackdropEl.hidden = true;
        cb.onLayerStateChanged();
        void preloadEditorMapAndUnitAssets(state).then(() => cb.renderFrame());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON';
        dom.jsonStatusEl.textContent = `JSON error: ${msg}`;
        dom.jsonStatusEl.hidden = false;
      }
    },
    { signal }
  );

  bindPointerTap(
    dom.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-copy-btn"]'),
    () => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(dom.jsonTextareaEl.value);
      }
      dom.jsonStatusEl.textContent = 'Copied map JSON to clipboard.';
      dom.jsonStatusEl.hidden = false;
    },
    { signal }
  );

  bindPointerTap(
    dom.jsonModalBackdropEl.querySelector<HTMLElement>('[data-testid="editor-json-close-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      state.jsonModalOpen = false;
      dom.jsonModalBackdropEl.hidden = true;
      cb.onLayerStateChanged();
    },
    { signal }
  );
}
