/**
 * Level Selection, Override Save/Reset & Cloud Sync Helpers for `ChapterMapEditorScene`
 */

import { normalizeTilesetId } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import {
  CHAPTER_LEVEL_CATALOG,
  cloneDungeonMap,
  encodeTileRows,
  getChapterCatalogEntry,
  getEffectiveChapterMap,
  resetChapterMapOverride,
  saveChapterMapOverride,
} from '../../data/chapterMapRegistry';
import { applyEditedChapterJson, getRawChapterJson } from '../../data/chapters/index';
import type { CompactChapterJson } from '../../data/chapters/chapterTypes';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DungeonMapDefinition, DungeonUnitSpawn } from '../../types/schemas';
import { writeChapterJsonFile } from '../../ui/devtools/projectFileClient';
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
import type { EditorRuntimeState, LocationEditSession } from './editorTypesAndState';

/** Loads a cutscene location's tile layer for painting (hand-off from the Cutscene Editor). */
export async function openEditorLocationSession(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  signal: AbortSignal;
  map: DungeonMapDefinition;
  session: LocationEditSession;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
}): Promise<void> {
  const { dom, state, signal, session } = params;
  state.activeLevelId = params.map.id;
  state.editorTargetKind = 'location';
  state.locationSession = session;
  state.referenceMarkers = session.markers;
  state.map = cloneDungeonMap(params.map);
  state.undoStack = [];
  state.dirty = false;
  if (state.toolMode !== 'stroke' && state.toolMode !== 'eyedropper' && state.toolMode !== 'pan') {
    state.toolMode = 'paint';
  }
  state.brushTilesetId = normalizeTilesetId(session.defaultTilesetId);
  dom.tilesetSelectEl.value = state.brushTilesetId;
  state.inspectedTile = { x: Math.floor(state.map.width / 2), y: Math.floor(state.map.height / 2) };
  params.syncUiAndInfo();
  centerDungeonCameraOnTile(state.cam, state.map.width, state.map.height, state.inspectedTile.x, state.inspectedTile.y);
  await Promise.all([
    preloadEditorMapAndUnitAssets(state),
    refreshEditorChunkPalette(dom, state, signal, params.syncUiAndInfo),
  ]);
  params.renderFrame();
}

function compactSpawn(spawn: DungeonUnitSpawn): Record<string, unknown> {
  const out: Record<string, unknown> = { ...spawn };
  if (out.droppableItemId === null) delete out.droppableItemId;
  return out;
}

/** Applies edited spawn fields onto the original JSON object, keeping its key order and extras. */
function mergeSpawns<T extends { id?: string }>(
  originals: ReadonlyArray<T> | undefined,
  edited: ReadonlyArray<DungeonUnitSpawn>
): Array<Record<string, unknown>> {
  return edited.map((spawn) => {
    const original = spawn.id ? originals?.find((o) => o.id === spawn.id) : undefined;
    const next = compactSpawn(spawn);
    if (!original) return next;
    const merged: Record<string, unknown> = JSON.parse(JSON.stringify(original));
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      if (JSON.stringify(merged[k]) !== JSON.stringify(v)) merged[k] = v;
    }
    return merged;
  });
}

/** Writes the edited battle map into the chapter's `chapter.json` (events and story untouched). */
export async function saveEditorMapToProject(params: {
  dom: EditorDomRefs;
  state: EditorRuntimeState;
  syncUiAndInfo: () => void;
}): Promise<void> {
  const { dom, state } = params;
  const raw = getRawChapterJson(state.activeLevelId);
  if (!raw) {
    showEditorToast(dom, state, 'Only chapter maps can be saved to the project');
    return;
  }
  const map = state.map;
  const next: CompactChapterJson = {
    ...JSON.parse(JSON.stringify(raw)),
    deploymentCap: map.deploymentCap ?? raw.deploymentCap,
    width: map.width,
    height: map.height,
    rows: encodeTileRows(map.tiles, raw.defaultTilesetId),
    playerSlots: map.playerSpawns.map((p, i) => {
      const original = raw.playerSlots[i];
      return original && original.x === p.x && original.y === p.y && (original.speciesId ?? p.speciesId) === p.speciesId
        ? original
        : { x: p.x, y: p.y, speciesId: p.speciesId };
    }),
    enemySpawns: mergeSpawns(raw.enemySpawns, map.enemySpawns) as unknown as CompactChapterJson['enemySpawns'],
    ...(map.npcSpawns?.length ? { npcSpawns: mergeSpawns(raw.npcSpawns, map.npcSpawns) as unknown as DungeonUnitSpawn[] } : {}),
    reinforcements: (map.reinforcements ?? []).map((w) => {
      const original = raw.reinforcements.find((o) => o.id === w.id);
      return original && JSON.stringify({ ...original, enemy: undefined }) === JSON.stringify({ ...w, enemy: undefined }) &&
        original.enemy.speciesId === w.enemy.speciesId && original.enemy.level === w.enemy.level
        ? original
        : w;
    }),
  };
  if (!map.npcSpawns?.length) delete next.npcSpawns;
  try {
    await writeChapterJsonFile(raw.id, next);
    applyEditedChapterJson(next);
    resetChapterMapOverride(raw.id);
    state.map = getEffectiveChapterMap(raw.id);
    state.dirty = false;
    params.syncUiAndInfo();
    showEditorToast(dom, state, `SAVED TO PROJECT — ${raw.title} (commit & push to go live)`);
  } catch (err) {
    showEditorToast(dom, state, err instanceof Error ? err.message : 'Save to project failed');
  }
}

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
  state.editorTargetKind = 'chapter';
  state.locationSession = null;
  state.referenceMarkers = [];
  const preferredSheet = normalizeTilesetId(entry.primaryTilesetId);

  renderEditorLevelSelectOptions(dom, state.activeLevelId);
  dom.levelSelectEl.value = state.activeLevelId;

  state.map = getEffectiveChapterMap(state.activeLevelId);
  state.undoStack = [];
  state.dirty = false;

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
