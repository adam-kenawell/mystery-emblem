/**
 * Tileset Sheet, Sprite Bundle Preloading & Chunk Palette Renderer
 */

import { loadSpeciesSpriteBundle } from '../../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawTilesetChunk,
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../../assets/tilesetLoader';
import { bindPointerTap } from '../../ui/pointerControls';
import type { EditorDomRefs } from './editorDomShell';
import type { EditorRuntimeState } from './editorTypesAndState';

export async function ensureEditorTilesetLoaded(
  state: EditorRuntimeState,
  tilesetId: string
): Promise<LoadedTilesetSheet> {
  const norm = normalizeTilesetId(tilesetId);
  const cached = state.loadedSheets.get(norm);
  if (cached) return cached;
  const sheet = await loadTilesetSheet(norm);
  state.loadedSheets.set(norm, sheet);
  return sheet;
}

export async function ensureEditorSpriteBundle(
  state: EditorRuntimeState,
  speciesId: string
): Promise<void> {
  if (state.spriteBundles.has(speciesId)) return;
  try {
    const bundle = await loadSpeciesSpriteBundle(speciesId);
    state.spriteBundles.set(speciesId, bundle);
  } catch {
    // Fallback marker renders if unavailable
  }
}

export async function preloadEditorMapAndUnitAssets(
  state: EditorRuntimeState
): Promise<void> {
  const sheetIds = new Set<string>([state.brushTilesetId]);
  for (const row of state.map.tiles) {
    for (const cell of row) {
      sheetIds.add(normalizeTilesetId(cell.tilesetId));
    }
  }
  const spIds = new Set<string>([state.spawnEnemySpeciesId]);
  for (const p of state.map.playerSpawns) spIds.add(p.speciesId);
  for (const e of state.map.enemySpawns) spIds.add(e.speciesId);
  for (const n of state.map.npcSpawns ?? []) spIds.add(n.speciesId);
  for (const w of state.map.reinforcements ?? []) spIds.add(w.enemy.speciesId);

  await Promise.all([
    ...[...sheetIds].map((id) => ensureEditorTilesetLoaded(state, id)),
    ...[...spIds].map((id) => ensureEditorSpriteBundle(state, id)),
  ]);
}

export function highlightEditorChunkCell(
  dom: EditorDomRefs,
  brushChunkIndex: number
): void {
  dom.chunkPaletteEl.querySelectorAll<HTMLElement>('[data-chunk-idx]').forEach((cell) => {
    cell.classList.toggle('is-active', Number(cell.dataset.chunkIdx) === brushChunkIndex);
  });
}

export async function refreshEditorChunkPalette(
  dom: EditorDomRefs,
  state: EditorRuntimeState,
  signal: AbortSignal,
  onChunkSelected: () => void
): Promise<void> {
  const requestedId = state.brushTilesetId;
  const sheet = await ensureEditorTilesetLoaded(state, requestedId);
  if (state.brushTilesetId !== requestedId) return;

  dom.chunkPaletteEl.innerHTML = '';
  const chunks = sheet.validChunkIndices.slice(0, 140);
  if (!sheet.validChunkSet.has(state.brushChunkIndex) && chunks[0] !== undefined) {
    state.brushChunkIndex = chunks[0];
  }

  for (const chunkIdx of chunks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-chunk-cell${chunkIdx === state.brushChunkIndex ? ' is-active' : ''}`;
    btn.dataset.chunkIdx = String(chunkIdx);
    btn.dataset.testid = `editor-chunk-${chunkIdx}`;
    btn.title = `Tileset #${sheet.id} · Chunk ${chunkIdx}`;

    const thumb = document.createElement('canvas');
    thumb.width = PMD_TILE_NATIVE_PX;
    thumb.height = PMD_TILE_NATIVE_PX;
    thumb.className = 'pmd-chunk-thumb pmd-pixelated';
    const tCtx = thumb.getContext('2d');
    if (tCtx) {
      tCtx.imageSmoothingEnabled = false;
      drawTilesetChunk(tCtx, sheet, chunkIdx, 0, 0, PMD_TILE_NATIVE_PX);
    }

    const badge = document.createElement('span');
    badge.className = 'pmd-chunk-idx';
    badge.textContent = String(chunkIdx);

    btn.append(thumb, badge);
    bindPointerTap(
      btn,
      () => {
        state.brushChunkIndex = chunkIdx;
        if (state.toolMode !== 'paint' && state.toolMode !== 'stroke') {
          state.toolMode = 'paint';
        }
        highlightEditorChunkCell(dom, state.brushChunkIndex);
        onChunkSelected();
      },
      { signal }
    );
    dom.chunkPaletteEl.appendChild(btn);
  }
}
