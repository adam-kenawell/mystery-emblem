/**
 * Player/Enemy Spawn Toggles, Map Resizing & Deployment Cap Controls
 */

import { getSpeciesById } from '../../data/index';
import type { DungeonMapTileCell } from '../../types/schemas';
import { clampDungeonCameraPosition } from '../../ui/gridViewportMath';
import { ensureEditorSpriteBundle } from './editorAssetsAndPalette';
import { pushEditorUndoSnapshot, type EditorMutationHooks } from './editorBrushAndUndo';

export function toggleEditorPlayerSpawnAt(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number
): void {
  const { state, audioManager } = hooks;
  if (state.editorTargetKind === 'cutscene') return;
  const existingIdx = state.map.playerSpawns.findIndex((s) => s.x === tx && s.y === ty);
  if (existingIdx >= 0) {
    if (state.map.playerSpawns.length <= 1) {
      hooks.showToast('Map requires at least 1 Blue Starting Tile');
      return;
    }
    pushEditorUndoSnapshot(state);
    state.map.playerSpawns.splice(existingIdx, 1);
    if ((state.map.deploymentCap ?? 1) > state.map.playerSpawns.length) {
      state.map.deploymentCap = state.map.playerSpawns.length;
    }
    state.dirty = true;
    audioManager.playSfx('cancel');
    hooks.syncUiAndInfo();
    hooks.renderFrame();
    return;
  }

  if (state.map.playerSpawns.length >= 12) {
    hooks.showToast('Maximum 12 Blue Starting Tiles');
    return;
  }
  if (state.map.enemySpawns.some((e) => e.x === tx && e.y === ty)) {
    hooks.showToast('Remove enemy spawn on this tile first');
    return;
  }

  const cell = state.map.tiles[ty]?.[tx];
  pushEditorUndoSnapshot(state);
  if (cell && cell.terrainType === 'wall') {
    state.map.tiles[ty]![tx] = {
      terrainType: 'floor',
      tilesetId: state.brushTilesetId,
      chunkIndex: 59,
    };
  }

  const defaultPool = ['dratini', 'piplup', 'flabebe', 'sewaddle', 'pidgey', 'duskull'];
  const spId = defaultPool[state.map.playerSpawns.length % defaultPool.length] ?? 'dratini';
  const sp = getSpeciesById(spId);

  state.map.playerSpawns.push({
    x: tx,
    y: ty,
    speciesId: spId,
    level: 1,
    nickname: sp?.name ?? 'Ally',
    heldItemId: null,
  });
  state.map.deploymentCap = Math.min(
    12,
    Math.max(state.map.deploymentCap ?? 1, state.map.playerSpawns.length)
  );
  state.dirty = true;
  audioManager.playSfx('select');
  void ensureEditorSpriteBundle(state, spId).then(() => hooks.renderFrame());
  hooks.syncUiAndInfo();
  hooks.renderFrame();
}

export function toggleEditorEnemySpawnAt(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number
): void {
  const { state, audioManager } = hooks;
  if (state.editorTargetKind === 'cutscene') return;
  const existingIdx = state.map.enemySpawns.findIndex((e) => e.x === tx && e.y === ty);
  if (existingIdx >= 0) {
    const existing = state.map.enemySpawns[existingIdx]!;
    if (
      existing.speciesId !== state.spawnEnemySpeciesId ||
      existing.level !== state.spawnEnemyLevel
    ) {
      const sp = getSpeciesById(state.spawnEnemySpeciesId);
      if (!sp || sp.faction === 'playable') return;
      pushEditorUndoSnapshot(state);
      state.map.enemySpawns[existingIdx] = {
        ...existing,
        speciesId: sp.id,
        level: state.spawnEnemyLevel,
        nickname: sp.name,
      };
      state.dirty = true;
      audioManager.playSfx('select');
      void ensureEditorSpriteBundle(state, sp.id).then(() => hooks.renderFrame());
      hooks.syncUiAndInfo();
      hooks.renderFrame();
      return;
    }

    if (state.map.enemySpawns.length <= 1) {
      hooks.showToast('Map requires at least 1 Enemy Spawn');
      return;
    }
    pushEditorUndoSnapshot(state);
    state.map.enemySpawns.splice(existingIdx, 1);
    state.dirty = true;
    audioManager.playSfx('cancel');
    hooks.syncUiAndInfo();
    hooks.renderFrame();
    return;
  }

  if (state.map.playerSpawns.some((p) => p.x === tx && p.y === ty)) {
    hooks.showToast('Cannot place enemy on a Blue Starting Tile');
    return;
  }

  const sp = getSpeciesById(state.spawnEnemySpeciesId);
  if (!sp || sp.faction === 'playable') return;

  pushEditorUndoSnapshot(state);
  const cell = state.map.tiles[ty]?.[tx];
  if (cell && cell.terrainType === 'wall') {
    state.map.tiles[ty]![tx] = {
      terrainType: 'floor',
      tilesetId: state.brushTilesetId,
      chunkIndex: 59,
    };
  }
  state.map.enemySpawns.push({
    x: tx,
    y: ty,
    speciesId: sp.id,
    level: state.spawnEnemyLevel,
    nickname: sp.name,
    heldItemId: null,
  });
  state.dirty = true;
  audioManager.playSfx('select');
  void ensureEditorSpriteBundle(state, sp.id).then(() => hooks.renderFrame());
  hooks.syncUiAndInfo();
  hooks.renderFrame();
}

export function resizeEditorMap(
  hooks: EditorMutationHooks,
  nextWidth: number,
  nextHeight: number
): void {
  const { state, audioManager } = hooks;
  const clampedW = Math.max(10, Math.min(36, Math.floor(nextWidth)));
  const clampedH = Math.max(8, Math.min(26, Math.floor(nextHeight)));
  if (clampedW === state.map.width && clampedH === state.map.height) return;

  pushEditorUndoSnapshot(state);
  const isCutscene = state.editorTargetKind === 'cutscene';
  const newTiles: DungeonMapTileCell[][] = [];
  for (let y = 0; y < clampedH; y++) {
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < clampedW; x++) {
      const isBorder = x === 0 || y === 0 || x === clampedW - 1 || y === clampedH - 1;
      const old = state.map.tiles[y]?.[x];
      if (isCutscene) {
        row.push(
          old
            ? { ...old }
            : isBorder
              ? { terrainType: 'wall', tilesetId: state.brushTilesetId, chunkIndex: 1 }
              : { terrainType: 'floor', tilesetId: state.brushTilesetId, chunkIndex: 28 }
        );
      } else if (
        old &&
        !(x === state.map.width - 1 && clampedW > state.map.width && old.terrainType === 'wall') &&
        !(y === state.map.height - 1 && clampedH > state.map.height && old.terrainType === 'wall')
      ) {
        row.push(
          isBorder
            ? { terrainType: 'wall', tilesetId: old.tilesetId, chunkIndex: 1 }
            : { ...old }
        );
      } else {
        row.push(
          isBorder
            ? { terrainType: 'wall', tilesetId: state.brushTilesetId, chunkIndex: 1 }
            : { terrainType: 'floor', tilesetId: state.brushTilesetId, chunkIndex: 59 }
        );
      }
    }
    newTiles.push(row);
  }

  state.map.width = clampedW;
  state.map.height = clampedH;
  state.map.tiles = newTiles;

  for (const p of state.map.playerSpawns) {
    p.x = Math.max(1, Math.min(clampedW - 2, p.x));
    p.y = Math.max(1, Math.min(clampedH - 2, p.y));
    state.map.tiles[p.y]![p.x] = {
      terrainType: 'floor',
      tilesetId: state.brushTilesetId,
      chunkIndex: 59,
    };
  }
  for (const e of state.map.enemySpawns) {
    e.x = Math.max(1, Math.min(clampedW - 2, e.x));
    e.y = Math.max(1, Math.min(clampedH - 2, e.y));
    if (state.map.tiles[e.y]![e.x]!.terrainType === 'wall') {
      state.map.tiles[e.y]![e.x] = {
        terrainType: 'floor',
        tilesetId: state.brushTilesetId,
        chunkIndex: 59,
      };
    }
  }
  for (const n of state.map.npcSpawns ?? []) {
    n.x = Math.max(1, Math.min(clampedW - 2, n.x));
    n.y = Math.max(1, Math.min(clampedH - 2, n.y));
  }
  for (const w of state.map.reinforcements ?? []) {
    w.stairsX = Math.max(1, Math.min(clampedW - 2, w.stairsX));
    w.stairsY = Math.max(1, Math.min(clampedH - 2, w.stairsY));
    w.enemy.x = w.stairsX;
    w.enemy.y = w.stairsY;
  }

  state.dirty = true;
  audioManager.playSfx('select');
  clampDungeonCameraPosition(
    state.cam,
    state.map.width,
    state.map.height,
    state.cam.cameraX,
    state.cam.cameraY
  );
  hooks.syncUiAndInfo();
  hooks.renderFrame();
}

export function adjustEditorDeploymentCap(
  hooks: EditorMutationHooks,
  delta: number
): void {
  const { state, audioManager } = hooks;
  if (state.editorTargetKind === 'cutscene') return;
  const maxCap = Math.min(12, Math.max(1, state.map.playerSpawns.length));
  const current = Math.max(1, Math.min(maxCap, state.map.deploymentCap ?? maxCap));
  const next = Math.max(1, Math.min(maxCap, current + delta));
  if (next === current) {
    if (delta > 0 && next >= state.map.playerSpawns.length && next < 12) {
      hooks.showToast('Add another Blue Spawn tile to raise Deployment Cap further');
    }
    return;
  }
  pushEditorUndoSnapshot(state);
  state.map.deploymentCap = next;
  state.dirty = true;
  audioManager.playSfx('select');
  hooks.syncUiAndInfo();
}
