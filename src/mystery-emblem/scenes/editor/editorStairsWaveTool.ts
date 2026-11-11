/**
 * Stairs Reinforcement Wave Tool for `ChapterMapEditorScene` (`editorStairsWaveTool.ts`)
 *
 * Places or removes declarative `ReinforcementWaveDefinition` entries on `stairs` tiles
 * in `state.map.reinforcements`, automatically converting the target cell to `'stairs'` terrain.
 */

import { getSpeciesById } from '../../data/index';
import { ensureEditorSpriteBundle } from './editorAssetsAndPalette';
import { pushEditorUndoSnapshot, type EditorMutationHooks } from './editorBrushAndUndo';

export function toggleEditorStairsWaveAt(
  hooks: EditorMutationHooks,
  tx: number,
  ty: number
): void {
  const { state, audioManager } = hooks;
  if (state.editorTargetKind === 'location') return;
  if (tx <= 0 || ty <= 0 || tx >= state.map.width - 1 || ty >= state.map.height - 1) {
    hooks.showToast('Place Stairs Waves inside the map perimeter');
    return;
  }

  const waves = state.map.reinforcements ? [...state.map.reinforcements] : [];
  const existingIdx = waves.findIndex(
    (w) => w.stairsX === tx && w.stairsY === ty && w.turnNumber === state.spawnWaveTurn
  );

  if (existingIdx >= 0) {
    const existing = waves[existingIdx]!;
    if (
      existing.enemy.speciesId !== state.spawnEnemySpeciesId ||
      existing.enemy.level !== state.spawnEnemyLevel
    ) {
      const sp = getSpeciesById(state.spawnEnemySpeciesId);
      if (!sp || sp.faction === 'playable') return;
      pushEditorUndoSnapshot(state);
      waves[existingIdx] = {
        ...existing,
        enemy: {
          ...existing.enemy,
          speciesId: sp.id,
          level: state.spawnEnemyLevel,
          nickname: sp.name,
        },
      };
      state.map.reinforcements = waves;
      state.dirty = true;
      audioManager.playSfx('select');
      void ensureEditorSpriteBundle(state, sp.id).then(() => hooks.renderFrame());
      hooks.syncUiAndInfo();
      hooks.renderFrame();
      return;
    }

    pushEditorUndoSnapshot(state);
    waves.splice(existingIdx, 1);
    state.map.reinforcements = waves;
    state.dirty = true;
    audioManager.playSfx('cancel');
    hooks.showToast(`REMOVED T${state.spawnWaveTurn} STAIRS WAVE`);
    hooks.syncUiAndInfo();
    hooks.renderFrame();
    return;
  }

  const sp = getSpeciesById(state.spawnEnemySpeciesId);
  if (!sp || sp.faction === 'playable') return;

  pushEditorUndoSnapshot(state);
  const cell = state.map.tiles[ty]?.[tx];
  if (!cell || cell.terrainType !== 'stairs') {
    state.map.tiles[ty]![tx] = {
      terrainType: 'stairs',
      tilesetId: cell?.tilesetId ?? state.brushTilesetId,
      chunkIndex: 59,
    };
  }

  const waveId = `wave_${tx}_${ty}_t${state.spawnWaveTurn}`;
  waves.push({
    id: waveId,
    turnNumber: state.spawnWaveTurn,
    stairsX: tx,
    stairsY: ty,
    enemy: {
      id: `${waveId}_unit`,
      x: tx,
      y: ty,
      speciesId: sp.id,
      level: state.spawnEnemyLevel,
      nickname: sp.name,
      aiMode: 'aggressive',
      heldItemId: null,
    },
  });
  state.map.reinforcements = waves;
  state.dirty = true;
  audioManager.playSfx('select');
  hooks.showToast(`STAIRS WAVE T${state.spawnWaveTurn}: ${sp.name.toUpperCase()}`);
  void ensureEditorSpriteBundle(state, sp.id).then(() => hooks.renderFrame());
  hooks.syncUiAndInfo();
  hooks.renderFrame();
}
