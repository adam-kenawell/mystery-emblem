/**
 * Static Controls Population, UI Status Sync, Info Strip & Toast Helper
 */

import { EMPTY_TILESET_ID, PMD_TILESET_LIST } from '../../assets/tilesetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import {
  CHAPTER_LEVEL_CATALOG,
  hasChapterMapOverride,
} from '../../data/chapterMapRegistry';
import { POKEMON_SPECIES_LIST } from '../../data/index';
import { TERRAIN_METADATA } from '../../engine/terrainAndPathfinding';
import { TERRAIN_TYPES, type TerrainType } from '../../types/schemas';
import { bindPointerTap } from '../../ui/pointerControls';
import type { EditorDomRefs } from './editorDomShell';
import {
  BIOME_BRUSH_PRESETS,
  type EditorRuntimeState,
  type MapEditorToolMode,
} from './editorTypesAndState';

export function renderEditorLevelSelectOptions(
  dom: EditorDomRefs,
  activeLevelId: string
): void {
  dom.levelSelectEl.innerHTML = '';

  const chapterGroup = document.createElement('optgroup');
  chapterGroup.label = 'Chapter Maps';
  chapterGroup.dataset.testid = 'editor-optgroup-chapters';
  for (const item of CHAPTER_LEVEL_CATALOG) {
    const opt = document.createElement('option');
    opt.value = item.id;
    const customizedSuffix = hasChapterMapOverride(item.id) ? ' ★ [Custom]' : '';
    opt.textContent = `${item.label}${customizedSuffix}`;
    chapterGroup.appendChild(opt);
  }

  dom.levelSelectEl.append(chapterGroup);
  if ([...dom.levelSelectEl.options].some((o) => o.value === activeLevelId)) {
    dom.levelSelectEl.value = activeLevelId;
  }
}

export function populateEditorStaticControls(
  dom: EditorDomRefs,
  state: EditorRuntimeState,
  audioManager: AudioManager,
  signal: AbortSignal,
  onSelectBrush: (brush: {
    terrainType?: TerrainType;
    tilesetId?: string;
    chunkIndex?: number;
  }) => void
): void {
  renderEditorLevelSelectOptions(dom, state.activeLevelId);

  dom.enemySpeciesSelectEl.innerHTML = '';
  for (const sp of POKEMON_SPECIES_LIST) {
    if (sp.faction === 'playable') continue;
    const opt = document.createElement('option');
    opt.value = sp.id;
    opt.textContent = `${sp.name} (Stage ${sp.stage} · ${sp.types.join('/')})`;
    dom.enemySpeciesSelectEl.appendChild(opt);
  }
  dom.enemySpeciesSelectEl.value = state.spawnEnemySpeciesId;

  const presetsContainer = dom.drawerEl.querySelector<HTMLElement>(
    '[data-editor-biome-presets]'
  )!;
  presetsContainer.innerHTML = '';
  const emptyBtn = document.createElement('button');
  emptyBtn.type = 'button';
  emptyBtn.className = 'pmd-btn pmd-chip-btn';
  emptyBtn.dataset.testid = 'editor-biome-preset-empty';
  emptyBtn.dataset.editorLocationOnly = 'true';
  emptyBtn.textContent = 'Empty (see-through)';
  bindPointerTap(
    emptyBtn,
    () => {
      audioManager.playSfx('select');
      if (state.toolMode !== 'paint' && state.toolMode !== 'stroke') state.toolMode = 'paint';
      onSelectBrush({ terrainType: 'floor', tilesetId: EMPTY_TILESET_ID, chunkIndex: 0 });
    },
    { signal }
  );
  presetsContainer.appendChild(emptyBtn);

  for (const preset of BIOME_BRUSH_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-btn pmd-chip-btn';
    btn.dataset.testid = `editor-biome-preset-${preset.id}`;
    btn.textContent = preset.label;
    bindPointerTap(
      btn,
      () => {
        audioManager.playSfx('select');
        if (state.toolMode !== 'paint' && state.toolMode !== 'stroke') {
          state.toolMode = 'paint';
        }
        onSelectBrush({
          terrainType: preset.terrainType,
          tilesetId: preset.tilesetId,
          chunkIndex: preset.chunkIndex,
        });
      },
      { signal }
    );
    presetsContainer.appendChild(btn);
  }

  const terrainContainer = dom.drawerEl.querySelector<HTMLElement>(
    '[data-editor-terrain-chips]'
  )!;
  terrainContainer.innerHTML = '';
  for (const tType of TERRAIN_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-btn pmd-chip-btn${tType === state.brushTerrainType ? ' is-active' : ''}`;
    btn.dataset.editorTerrain = tType;
    btn.dataset.testid = `editor-terrain-${tType}`;
    btn.textContent = TERRAIN_METADATA[tType].shortLabel;
    bindPointerTap(
      btn,
      () => {
        audioManager.playSfx('select');
        if (state.toolMode !== 'paint' && state.toolMode !== 'stroke') {
          state.toolMode = 'paint';
        }
        onSelectBrush({ terrainType: tType });
      },
      { signal }
    );
    terrainContainer.appendChild(btn);
  }

  dom.tilesetSelectEl.innerHTML = '';
  for (const ts of PMD_TILESET_LIST) {
    const opt = document.createElement('option');
    opt.value = ts.id;
    opt.textContent = ts.label;
    dom.tilesetSelectEl.appendChild(opt);
  }
  dom.tilesetSelectEl.value = state.brushTilesetId;
}

export function syncEditorUiControls(
  dom: EditorDomRefs,
  state: EditorRuntimeState
): void {
  renderEditorLevelSelectOptions(dom, state.activeLevelId);

  const isStoredCustom = hasChapterMapOverride(state.activeLevelId);
  if (state.dirty) {
    dom.statusBadgeEl.textContent = 'UNSAVED EDITS';
    dom.statusBadgeEl.className = 'pmd-editor-status-pill is-unsaved';
  } else if (isStoredCustom) {
    dom.statusBadgeEl.textContent = 'CUSTOMIZED ★';
    dom.statusBadgeEl.className = 'pmd-editor-status-pill is-custom';
  } else {
    dom.statusBadgeEl.textContent = 'DEFAULT';
    dom.statusBadgeEl.className = 'pmd-editor-status-pill';
  }

  const toolLabels: Record<MapEditorToolMode, string> = {
    paint: 'Tool: Paint',
    stroke: 'Tool: Stroke',
    eyedropper: 'Tool: Pick',
    player_spawn: 'Tool: Blue',
    enemy_spawn: 'Tool: Enemy',
    stairs_wave: 'Tool: Stairs',
    pan: 'Tool: Pan',
  };
  dom.hudToolBtnEl.textContent = toolLabels[state.toolMode];
  dom.hudUndoBtnEl.disabled = state.undoStack.length === 0;
  dom.hudUndoBtnEl.textContent =
    state.undoStack.length > 0 ? `Undo (${state.undoStack.length})` : 'Undo';

  const isCutscene = state.editorTargetKind === 'location';
  dom.rootEl.dataset.editorKind = state.editorTargetKind;
  dom.locationBarEl.hidden = !isCutscene;
  dom.chapterOnlyEl.hidden = isCutscene;
  dom.locationTitleEl.textContent = `Painting location: ${state.locationSession?.locationName ?? state.map.name}`;
  dom.hudSaveBtnEl.textContent = isCutscene ? 'Done' : 'Save';
  dom.sysSaveBtnEl.textContent = isCutscene ? 'Done — Back to Cutscene' : 'Save Map to Game';
  dom.sysSaveProjectBtnEl.hidden = isCutscene || dom.saveProjectBtnEl.hidden;
  dom.biomePresetsEl.querySelectorAll<HTMLElement>('[data-editor-location-only]').forEach((el) => {
    el.hidden = !isCutscene;
  });

  dom.hudPlayBtnEl.hidden = isCutscene;
  dom.hudPlayBtnEl.disabled = isCutscene;
  dom.savePlayBtnEl.hidden = isCutscene;
  dom.savePlayBtnEl.disabled = isCutscene;
  dom.sysPlayBtnEl.hidden = isCutscene;
  dom.sysPlayBtnEl.disabled = isCutscene;
  dom.deployCapItemEl.hidden = isCutscene;

  dom.drawerEl.querySelectorAll<HTMLButtonElement>('[data-editor-tool]').forEach((btn) => {
    const tool = btn.dataset.editorTool;
    const spawnOrWave =
      tool === 'player_spawn' || tool === 'enemy_spawn' || tool === 'stairs_wave';
    btn.hidden = isCutscene && spawnOrWave;
    btn.disabled = isCutscene && spawnOrWave;
    btn.classList.toggle('is-active', tool === state.toolMode);
  });
  dom.enemyConfigBoxEl.hidden =
    isCutscene || (state.toolMode !== 'enemy_spawn' && state.toolMode !== 'stairs_wave');
  dom.waveTurnRowEl.hidden = isCutscene || state.toolMode !== 'stairs_wave';
  dom.enemyLevelValEl.textContent = String(state.spawnEnemyLevel);
  dom.waveTurnValEl.textContent = String(state.spawnWaveTurn);

  dom.drawerEl.querySelectorAll<HTMLElement>('[data-editor-terrain]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.editorTerrain === state.brushTerrainType);
  });

  dom.gridToggleBtnEl.textContent = state.showGrid ? 'Grid: ON' : 'Grid: OFF';
  dom.gridToggleBtnEl.classList.toggle('is-active', state.showGrid);

  dom.spawnsToggleBtnEl.textContent = isCutscene
    ? state.showSpawns
      ? 'Actors: ON'
      : 'Actors: OFF'
    : state.showSpawns
      ? 'Spawns: ON'
      : 'Spawns: OFF';
  dom.spawnsToggleBtnEl.classList.toggle('is-active', state.showSpawns);

  const tMeta = TERRAIN_METADATA[state.brushTerrainType];
  dom.activeBrushSummaryEl.textContent =
    state.brushTilesetId === EMPTY_TILESET_ID
      ? 'Active Brush: Empty (see-through)'
      : `Active Brush: ${tMeta.label} · Sheet #${state.brushTilesetId} · Chunk #${state.brushChunkIndex}`;

  dom.mapWidthValEl.textContent = String(state.map.width);
  dom.mapHeightValEl.textContent = String(state.map.height);
  if (isCutscene) {
    dom.deployCapValEl.textContent = '—';
  } else {
    const cap = Math.max(
      1,
      Math.min(
        state.map.deploymentCap ?? state.map.playerSpawns.length,
        state.map.playerSpawns.length
      )
    );
    dom.deployCapValEl.textContent = `${cap} / ${state.map.playerSpawns.length}`;
  }
}

export function updateEditorInfoStrip(
  dom: EditorDomRefs,
  state: EditorRuntimeState
): void {
  const { x, y } = state.inspectedTile;
  const cell = state.map.tiles[y]?.[x];
  const tLabel = cell
    ? `${TERRAIN_METADATA[cell.terrainType].label} (#${cell.tilesetId}:${cell.chunkIndex})`
    : 'Out of bounds';

  const pIdx = state.map.playerSpawns.findIndex((p) => p.x === x && p.y === y);
  const eSpawn = state.map.enemySpawns.find((e) => e.x === x && e.y === y);
  const nSpawn = state.map.npcSpawns?.find((n) => n.x === x && n.y === y);
  const wavesAtTile = (state.map.reinforcements ?? []).filter(
    (w) => w.stairsX === x && w.stairsY === y
  );
  const spawnDesc =
    pIdx >= 0
      ? ` · Blue Spawn P${pIdx + 1}`
      : eSpawn
        ? ` · Enemy: ${eSpawn.nickname ?? eSpawn.speciesId} Lv.${eSpawn.level}`
        : nSpawn
          ? ` · Ally NPC: ${nSpawn.nickname ?? nSpawn.speciesId} Lv.${nSpawn.level}`
          : '';
  const waveDesc =
    wavesAtTile.length > 0
      ? ` · Waves: ${wavesAtTile.map((w) => `T${w.turnNumber} ${w.enemy.speciesId}`).join(', ')}`
      : '';

  const actorsAtTile =
    state.editorTargetKind === 'location'
      ? state.referenceMarkers.filter((m) => m.x === x && m.y === y)
      : [];
  const actorDesc =
    actorsAtTile.length > 0
      ? ` · Cast: ${actorsAtTile.map((m) => m.label).join(', ')}`
      : '';

  dom.infoStripEl.textContent = `${state.map.name} (${state.map.width}×${state.map.height}) · Tile (${x},${y}): ${tLabel}${spawnDesc}${waveDesc}${actorDesc} · Brush: ${TERRAIN_METADATA[state.brushTerrainType].shortLabel} (#${state.brushTilesetId}:${state.brushChunkIndex})`;
}

export function showEditorToast(
  dom: EditorDomRefs,
  state: EditorRuntimeState,
  text: string
): void {
  dom.toastBannerEl.textContent = text;
  dom.toastBannerEl.hidden = false;
  if (state.toastTimer !== null) {
    window.clearTimeout(state.toastTimer);
  }
  state.toastTimer = window.setTimeout(() => {
    dom.toastBannerEl.hidden = true;
    state.toastTimer = null;
  }, 1500);
}
