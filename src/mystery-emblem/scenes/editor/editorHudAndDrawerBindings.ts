/**
 * Top HUD & Collapsible Drawer Pointer Bindings for `ChapterMapEditorScene`
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { bindPointerTap } from '../../ui/pointerControls';
import { ensureEditorSpriteBundle } from './editorAssetsAndPalette';
import type { EditorDomRefs } from './editorDomShell';
import type { EditorRuntimeState, MapEditorToolMode } from './editorTypesAndState';

export interface EditorControlCallbacks {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  audioManager: AudioManager;
  signal: AbortSignal;
  setDrawerOpen: (open: boolean) => void;
  setToolMode: (mode: MapEditorToolMode) => void;
  selectLevel: (levelId: string, opts?: { recenterCamera?: boolean }) => Promise<void>;
  undo: () => boolean;
  saveCurrentMapToGame: () => void;
  saveAndPlayCurrentLevel: () => void;
  resetCurrentMapToDefault: () => void;
  resizeMap: (w: number, h: number) => void;
  adjustDeploymentCap: (delta: number) => void;
  refreshChunkPaletteAndSync: () => void;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
  showToast: (msg: string) => void;
  closeScene: () => void;
  onLayerStateChanged: () => void;
}

export function bindEditorHudAndDrawerInteractions(cb: EditorControlCallbacks): void {
  const { dom, state, audioManager, signal } = cb;

  bindPointerTap(
    dom.hudPaletteBtnEl,
    () => {
      audioManager.playSfx('select');
      cb.setDrawerOpen(!state.drawerOpen);
    },
    { signal, stopPropagation: true }
  );

  bindPointerTap(
    dom.hudToolBtnEl,
    () => {
      audioManager.playSfx('select');
      const cycle: MapEditorToolMode[] = ['paint', 'stroke', 'eyedropper', 'pan'];
      const idx = cycle.indexOf(state.toolMode);
      cb.setToolMode(cycle[(idx + 1) % cycle.length] ?? 'paint');
    },
    { signal, stopPropagation: true }
  );

  bindPointerTap(
    dom.hudUndoBtnEl,
    () => {
      if (cb.undo()) {
        audioManager.playSfx('cancel');
        cb.showToast('UNDO');
      }
    },
    { signal, stopPropagation: true }
  );

  bindPointerTap(
    dom.hudSaveBtnEl,
    () => {
      audioManager.playSfx('select');
      cb.saveCurrentMapToGame();
    },
    { signal, stopPropagation: true }
  );

  bindPointerTap(
    dom.hudPlayBtnEl,
    () => {
      audioManager.playSfx('select');
      cb.saveAndPlayCurrentLevel();
    },
    { signal, stopPropagation: true }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-drawer-close-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      cb.setDrawerOpen(false);
    },
    { signal }
  );

  dom.levelSelectEl.addEventListener(
    'change',
    () => {
      audioManager.playSfx('select');
      void cb.selectLevel(dom.levelSelectEl.value, { recenterCamera: true });
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-save-btn"]'),
    () => {
      audioManager.playSfx('select');
      cb.saveCurrentMapToGame();
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-save-play-btn"]'),
    () => {
      audioManager.playSfx('select');
      cb.saveAndPlayCurrentLevel();
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-reset-default-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      cb.resetCurrentMapToDefault();
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-json-modal-btn"]'),
    () => {
      audioManager.playSfx('select');
      dom.jsonTextareaEl.value = JSON.stringify(state.map, null, 2);
      dom.jsonStatusEl.hidden = true;
      dom.jsonStatusEl.textContent = '';
      state.jsonModalOpen = true;
      dom.jsonModalBackdropEl.hidden = false;
      cb.onLayerStateChanged();
    },
    { signal }
  );

  dom.drawerEl.querySelectorAll<HTMLElement>('[data-editor-tool]').forEach((btn) => {
    bindPointerTap(
      btn,
      () => {
        const tool = btn.dataset.editorTool as MapEditorToolMode | undefined;
        if (!tool) return;
        audioManager.playSfx('select');
        cb.setToolMode(tool);
      },
      { signal }
    );
  });

  dom.enemySpeciesSelectEl.addEventListener(
    'change',
    () => {
      state.spawnEnemySpeciesId = dom.enemySpeciesSelectEl.value;
      void ensureEditorSpriteBundle(state, state.spawnEnemySpeciesId);
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-enemy-lv-dec"]'),
    () => {
      state.spawnEnemyLevel = Math.max(1, state.spawnEnemyLevel - 1);
      dom.enemyLevelValEl.textContent = String(state.spawnEnemyLevel);
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-enemy-lv-inc"]'),
    () => {
      state.spawnEnemyLevel = Math.min(40, state.spawnEnemyLevel + 1);
      dom.enemyLevelValEl.textContent = String(state.spawnEnemyLevel);
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-wave-turn-dec"]'),
    () => {
      state.spawnWaveTurn = Math.max(2, state.spawnWaveTurn - 1);
      dom.waveTurnValEl.textContent = String(state.spawnWaveTurn);
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-wave-turn-inc"]'),
    () => {
      state.spawnWaveTurn = Math.min(30, state.spawnWaveTurn + 1);
      dom.waveTurnValEl.textContent = String(state.spawnWaveTurn);
    },
    { signal }
  );

  bindPointerTap(
    dom.gridToggleBtnEl,
    () => {
      audioManager.playSfx('select');
      state.showGrid = !state.showGrid;
      cb.syncUiAndInfo();
      cb.renderFrame();
    },
    { signal }
  );

  bindPointerTap(
    dom.spawnsToggleBtnEl,
    () => {
      audioManager.playSfx('select');
      state.showSpawns = !state.showSpawns;
      cb.syncUiAndInfo();
      cb.renderFrame();
    },
    { signal }
  );

  dom.tilesetSelectEl.addEventListener(
    'change',
    () => {
      state.brushTilesetId = normalizeTilesetId(dom.tilesetSelectEl.value);
      cb.refreshChunkPaletteAndSync();
    },
    { signal }
  );

  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-width-dec"]'),
    () => cb.resizeMap(state.map.width - 1, state.map.height),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-width-inc"]'),
    () => cb.resizeMap(state.map.width + 1, state.map.height),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-height-dec"]'),
    () => cb.resizeMap(state.map.width, state.map.height - 1),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-height-inc"]'),
    () => cb.resizeMap(state.map.width, state.map.height + 1),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-cap-dec"]'),
    () => cb.adjustDeploymentCap(-1),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-cap-inc"]'),
    () => cb.adjustDeploymentCap(1),
    { signal }
  );
  bindPointerTap(
    dom.drawerEl.querySelector<HTMLElement>('[data-testid="editor-exit-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      cb.closeScene();
    },
    { signal }
  );
}
