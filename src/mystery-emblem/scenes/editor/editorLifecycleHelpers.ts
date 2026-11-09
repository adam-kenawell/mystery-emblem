/**
 * Open/Close Lifecycle, Menu/Back Stack & Brush Helpers for `ChapterMapEditorScene`
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import type { TerrainType } from '../../types/schemas';
import { MAP_DEFAULT_SCALE } from '../../ui/mapZoomController';
import {
  highlightEditorChunkCell,
  refreshEditorChunkPalette,
} from './editorAssetsAndPalette';
import type { EditorDomRefs } from './editorDomShell';
import type { EditorRuntimeState } from './editorTypesAndState';

export function prepareEditorOpenState(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  viewportEl: HTMLElement;
  audioManager: AudioManager;
  startDrawerOpen?: boolean;
}): void {
  const { dom, state, viewportEl, audioManager, startDrawerOpen } = params;
  if (!state.openState) {
    state.previousBgmId = audioManager.getCurrentTrackId();
  }
  state.openState = true;
  state.cam.displayScale = MAP_DEFAULT_SCALE;
  state.pinchTracker.reset();
  state.drawerOpen = startDrawerOpen ?? true;
  state.systemMenuOpen = false;
  state.jsonModalOpen = false;
  dom.systemMenuBackdropEl.hidden = true;
  dom.jsonModalBackdropEl.hidden = true;
  dom.drawerEl.hidden = !state.drawerOpen;
  dom.rootEl.hidden = false;
  viewportEl.classList.add('is-battle-active');
}

export function performEditorCloseState(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  viewportEl: HTMLElement;
  audioManager: AudioManager;
  stopLoop: () => void;
  onLayerStateChanged: () => void;
  onExitCallback: () => void;
}): void {
  const { dom, state, viewportEl, audioManager } = params;
  if (!state.openState) return;
  state.openState = false;
  params.stopLoop();
  state.pinchTracker.reset();
  state.systemMenuOpen = false;
  state.jsonModalOpen = false;
  dom.systemMenuBackdropEl.hidden = true;
  dom.jsonModalBackdropEl.hidden = true;
  dom.rootEl.hidden = true;
  viewportEl.classList.remove('is-battle-active');

  audioManager.playBgm(state.previousBgmId ?? 'top_menu', { fadeMs: 260 });
  params.onLayerStateChanged();
  params.onExitCallback();
}

export function handleEditorMenuOrBackAction(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  audioManager: AudioManager;
  setDrawerOpen: (open: boolean) => void;
  onLayerStateChanged: () => void;
}): void {
  const { dom, state, audioManager } = params;
  if (!state.openState) return;
  if (state.jsonModalOpen) {
    audioManager.playSfx('cancel');
    state.jsonModalOpen = false;
    dom.jsonModalBackdropEl.hidden = true;
    params.onLayerStateChanged();
    return;
  }
  if (state.systemMenuOpen) {
    audioManager.playSfx('cancel');
    state.systemMenuOpen = false;
    dom.systemMenuBackdropEl.hidden = true;
    params.onLayerStateChanged();
    return;
  }
  if (state.drawerOpen) {
    audioManager.playSfx('cancel');
    params.setDrawerOpen(false);
    return;
  }
  audioManager.playSfx('select');
  state.systemMenuOpen = true;
  dom.systemMenuBackdropEl.hidden = false;
  params.onLayerStateChanged();
}

export function applyEditorBrushUpdate(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  signal: AbortSignal;
  brush: {
    terrainType?: TerrainType;
    tilesetId?: string;
    chunkIndex?: number;
  };
  syncUiAndInfo: () => void;
}): void {
  const { dom, state, signal, brush } = params;
  if (brush.terrainType) state.brushTerrainType = brush.terrainType;
  if (brush.tilesetId) {
    state.brushTilesetId = normalizeTilesetId(brush.tilesetId);
    dom.tilesetSelectEl.value = state.brushTilesetId;
    void refreshEditorChunkPalette(dom, state, signal, params.syncUiAndInfo);
  }
  if (typeof brush.chunkIndex === 'number') {
    state.brushChunkIndex = Math.max(0, Math.min(399, Math.floor(brush.chunkIndex)));
    highlightEditorChunkCell(dom, state.brushChunkIndex);
  }
  params.syncUiAndInfo();
}
