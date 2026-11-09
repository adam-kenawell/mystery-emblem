/**
 * Level Selection, Override Save/Reset & Cloud Sync Helpers for `ChapterMapEditorScene`
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import {
  CHAPTER_LEVEL_CATALOG,
  cloneDungeonMap,
  getChapterCatalogEntry,
  getEffectiveChapterMap,
  resetChapterMapOverride,
  saveChapterMapOverride,
} from '../../data/chapterMapRegistry';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DungeonMapDefinition } from '../../types/schemas';
import { centerDungeonCameraOnTile } from '../../ui/gridViewportMath';
import {
  preloadEditorMapAndUnitAssets,
  refreshEditorChunkPalette,
} from './editorAssetsAndPalette';
import { pushEditorUndoSnapshot } from './editorBrushAndUndo';
import type { EditorDomRefs } from './editorDomShell';
import {
  renderEditorLevelSelectOptions,
  showEditorToast,
} from './editorSidebarAndStatus';
import type { EditorRuntimeState } from './editorTypesAndState';

export async function selectEditorLevel(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  audioManager: AudioManager;
  signal: AbortSignal;
  levelId: string;
  recenterCamera: boolean;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
}): Promise<void> {
  const { dom, state, audioManager, signal, levelId, recenterCamera } = params;
  const entry = getChapterCatalogEntry(levelId) ?? CHAPTER_LEVEL_CATALOG[0]!;
  state.activeLevelId = entry.id;
  renderEditorLevelSelectOptions(dom, state.activeLevelId);
  dom.levelSelectEl.value = state.activeLevelId;

  state.map = getEffectiveChapterMap(state.activeLevelId);
  state.undoStack = [];
  state.dirty = false;

  const preferredSheet = normalizeTilesetId(entry.primaryTilesetId);
  state.brushTilesetId = preferredSheet;
  dom.tilesetSelectEl.value = preferredSheet;

  state.inspectedTile = {
    x: state.map.playerSpawns[0]?.x ?? Math.floor(state.map.width / 2),
    y: state.map.playerSpawns[0]?.y ?? Math.floor(state.map.height / 2),
  };

  params.syncUiAndInfo();

  if (recenterCamera) {
    centerDungeonCameraOnTile(
      state.cam,
      state.map.width,
      state.map.height,
      Math.floor(state.map.width / 2),
      Math.floor(state.map.height / 2)
    );
  }

  if (state.openState && state.map.bgmCue) {
    audioManager.playBgm(state.map.bgmCue, { fadeMs: 280 });
  }

  await Promise.all([
    preloadEditorMapAndUnitAssets(state),
    refreshEditorChunkPalette(dom, state, signal, params.syncUiAndInfo),
  ]);
  params.renderFrame();
}

export function saveEditorMapToGame(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  saveManager: SaveStateManager;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
}): DungeonMapDefinition {
  const { dom, state, saveManager } = params;
  const saved = saveChapterMapOverride(state.activeLevelId, state.map);
  state.map = cloneDungeonMap(saved);
  state.dirty = false;
  params.syncUiAndInfo();
  const isSignedIn = Boolean(saveManager.getSyncStatus().user);
  showEditorToast(
    dom,
    state,
    isSignedIn
      ? `SAVED — ${state.map.name} (Syncing to Cloud...)`
      : `SAVED LOCALLY — ${state.map.name}`
  );
  void saveManager.syncCustomMapsWithActiveSave().then((res) => {
    if (!state.openState) return;
    if (res === 'pushed_newer_local') {
      showEditorToast(dom, state, `SAVED & SYNCED TO CLOUD — ${state.map.name}`);
    } else if (res === 'cloud_error') {
      const err = saveManager.getSyncStatus().errorMessage ?? 'Sync error';
      showEditorToast(dom, state, `SAVED LOCALLY (Cloud Error: ${err})`);
    }
  });
  params.renderFrame();
  return saved;
}

export function resetEditorMapToDefault(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  saveManager: SaveStateManager;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
}): DungeonMapDefinition {
  const { dom, state, saveManager } = params;
  pushEditorUndoSnapshot(state);
  const def = resetChapterMapOverride(state.activeLevelId);
  state.map = cloneDungeonMap(def);
  state.dirty = false;
  params.syncUiAndInfo();
  void preloadEditorMapAndUnitAssets(state).then(() => params.renderFrame());
  const isSignedIn = Boolean(saveManager.getSyncStatus().user);
  showEditorToast(
    dom,
    state,
    isSignedIn ? 'RESET TO DEFAULT (Syncing Cloud...)' : 'RESET TO DEFAULT MAP'
  );
  void saveManager.syncCustomMapsWithActiveSave().then((res) => {
    if (!state.openState) return;
    if (res === 'pushed_newer_local') {
      showEditorToast(dom, state, 'RESET TO DEFAULT & SYNCED TO CLOUD');
    }
  });
  params.renderFrame();
  return def;
}
