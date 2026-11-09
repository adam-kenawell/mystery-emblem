/**
 * Tile Painting, Drag Stroke, Undo & Tap Dispatch for `ChapterMapEditorScene`
 */

import type { AudioManager } from '../../audio/AudioManager';
import { cloneDungeonMap } from '../../data/chapterMapRegistry';
import { TERRAIN_METADATA } from '../../engine/terrainAndPathfinding';
import type { TerrainType } from '../../types/schemas';
import {
  ensureEditorTilesetLoaded,
  preloadEditorMapAndUnitAssets,
} from './editorAssetsAndPalette';
import {
  toggleEditorEnemySpawnAt,
  toggleEditorPlayerSpawnAt,
} from './editorSpawnsAndResize';
import { toggleEditorStairsWaveAt } from './editorStairsWaveTool';
import { EDITOR_MAX_UNDO_STEPS, type EditorRuntimeState } from './editorTypesAndState';

export interface EditorMutationHooks {
  state: EditorRuntimeState;
  audioManager: AudioManager;
  syncUiAndInfo: () => void;
  renderFrame: () => void;
  showToast: (msg: string) => void;
  setBrush: (brush: {
    terrainType?: TerrainType;
    tilesetId?: string;
    chunkIndex?: number;
  }) => void;
}

export function pushEditorUndoSnapshot(state: EditorRuntimeState): void {
  state.undoStack.push(cloneDungeonMap(state.map));
  if (state.undoStack.length > EDITOR_MAX_UNDO_STEPS) {
    state.undoStack.shift();
  }
}

export function paintEditorTileAt(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number,
  pushUndo = true
): boolean {
  const { state } = hooks;
  if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) return false;
  const existing = state.map.tiles[ty]?.[tx];
  if (
    existing &&
    existing.terrainType === state.brushTerrainType &&
    existing.tilesetId === state.brushTilesetId &&
    existing.chunkIndex === state.brushChunkIndex
  ) {
    return false;
  }
  if (pushUndo) {
    pushEditorUndoSnapshot(state);
  }
  state.map.tiles[ty]![tx] = {
    terrainType: state.brushTerrainType,
    tilesetId: state.brushTilesetId,
    chunkIndex: state.brushChunkIndex,
  };
  state.dirty = true;
  state.inspectedTile = { x: tx, y: ty };
  void ensureEditorTilesetLoaded(state, state.brushTilesetId).then(() => hooks.renderFrame());
  hooks.syncUiAndInfo();
  hooks.renderFrame();
  return true;
}

export function applyEditorStrokeAtTile(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number
): void {
  const { state } = hooks;
  const key = `${tx},${ty}`;
  if (state.lastStrokedCoordKey === key) return;
  state.lastStrokedCoordKey = key;

  if (tx < 0 || ty < 0 || tx >= state.map.width || ty >= state.map.height) return;
  const cell = state.map.tiles[ty]?.[tx];
  if (
    cell &&
    cell.terrainType === state.brushTerrainType &&
    cell.tilesetId === state.brushTilesetId &&
    cell.chunkIndex === state.brushChunkIndex
  ) {
    return;
  }

  if (!state.strokeUndoPushed) {
    pushEditorUndoSnapshot(state);
    state.strokeUndoPushed = true;
  }
  paintEditorTileAt(hooks, tx, ty, false);
}

export function undoEditorStep(hooks: EditorMutationHooks): boolean {
  const prev = hooks.state.undoStack.pop();
  if (!prev) return false;
  hooks.state.map = prev;
  hooks.state.dirty = true;
  hooks.syncUiAndInfo();
  void preloadEditorMapAndUnitAssets(hooks.state).then(() => hooks.renderFrame());
  hooks.renderFrame();
  return true;
}

export function handleEditorTileTap(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number
): void {
  const { state, audioManager } = hooks;
  state.inspectedTile = { x: tx, y: ty };

  if (state.toolMode === 'pan') {
    hooks.syncUiAndInfo();
    hooks.renderFrame();
    return;
  }

  if (state.toolMode === 'eyedropper') {
    const cell = state.map.tiles[ty]?.[tx];
    if (!cell) return;
    audioManager.playSfx('select');
    hooks.setBrush({
      terrainType: cell.terrainType,
      tilesetId: cell.tilesetId,
      chunkIndex: cell.chunkIndex,
    });
    state.toolMode = 'paint';
    hooks.syncUiAndInfo();
    hooks.showToast(
      `PICKED ${TERRAIN_METADATA[cell.terrainType].shortLabel.toUpperCase()} (#${cell.tilesetId}:${cell.chunkIndex})`
    );
    hooks.renderFrame();
    return;
  }

  if (state.toolMode === 'player_spawn') {
    toggleEditorPlayerSpawnAt(hooks, tx, ty);
    return;
  }

  if (state.toolMode === 'enemy_spawn') {
    toggleEditorEnemySpawnAt(hooks, tx, ty);
    return;
  }

  if (state.toolMode === 'stairs_wave') {
    toggleEditorStairsWaveAt(hooks, tx, ty);
    return;
  }

  if (paintEditorTileAt(hooks, tx, ty, true)) {
    audioManager.playSfx('select');
  } else {
    hooks.syncUiAndInfo();
    hooks.renderFrame();
  }
}
