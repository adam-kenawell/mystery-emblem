/**
 * Mystery Emblem — Admin Dev Tools Map Editor Preview Tab Controller
 */

import type { AudioManager } from '../../audio/AudioManager';
import {
  CHAPTER_LEVEL_CATALOG,
  CUTSCENE_STAGE_CATALOG,
  getChapterCatalogEntry,
  getCutsceneStageActorMarkers,
  getCutsceneStageCatalogEntry,
  getEffectiveChapterMap,
  hasChapterMapOverride,
  isCutsceneStageId,
  resetChapterMapOverride,
} from '../../data/chapterMapRegistry';
import { renderDungeonMapPreviewCanvas } from '../../scenes/ChapterMapEditorScene';
import type { SaveStateManager } from '../../state/SaveStateManager';
import { bindPointerTap } from '../pointerControls';

export interface DevToolsMapsDeps {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  onLaunchMapEditor: (levelId: string) => void;
  onPlayMapBattle: (levelId: string) => void;
  signal: AbortSignal;
}

export class DevToolsMapsController {
  private readonly deps: DevToolsMapsDeps;
  private selectedMapLevelId = 'prologue';
  private mapPreviewGen = 0;

  private readonly mapLevelSelectEl: HTMLSelectElement | null;
  private readonly mapStatusBadgeEl: HTMLElement | null;
  private readonly mapPreviewCanvasEl: HTMLCanvasElement | null;
  private readonly mapMetaEl: HTMLElement | null;
  private readonly playMapBtnEl: HTMLButtonElement | null;

  constructor(deps: DevToolsMapsDeps) {
    this.deps = deps;
    const { modalEl } = deps;
    this.mapLevelSelectEl = modalEl.querySelector('#devtools-map-level-select');
    this.mapStatusBadgeEl = modalEl.querySelector('#devtools-map-status-badge');
    this.mapPreviewCanvasEl = modalEl.querySelector('#devtools-map-preview-canvas');
    this.mapMetaEl = modalEl.querySelector('#devtools-map-meta');
    this.playMapBtnEl = modalEl.querySelector('#devtools-play-selected-map');

    this.bindControls();
  }

  private bindControls(): void {
    const { modalEl, saveManager, audioManager, signal } = this.deps;

    this.mapLevelSelectEl?.addEventListener(
      'change',
      () => {
        audioManager.playSfx('select');
        this.selectedMapLevelId = this.mapLevelSelectEl?.value || 'prologue';
        this.refresh();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('#devtools-open-map-editor'),
      () => {
        audioManager.playSfx('select');
        this.deps.onLaunchMapEditor(this.selectedMapLevelId);
      },
      { signal }
    );

    bindPointerTap(
      this.playMapBtnEl,
      () => {
        if (isCutsceneStageId(this.selectedMapLevelId)) return;
        audioManager.playSfx('select');
        this.deps.onPlayMapBattle(this.selectedMapLevelId);
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('#devtools-sync-cloud-maps'),
      async () => {
        audioManager.playSfx('select');
        const res = await saveManager.syncCustomMapsWithActiveSave();
        if (this.mapMetaEl) {
          this.mapMetaEl.textContent =
            res === 'pushed_newer_local'
              ? 'Synced custom maps to Cloud.'
              : res === 'pulled_newer_cloud'
                ? 'Pulled newer custom maps from Cloud.'
                : res === 'already_in_sync'
                  ? 'Cloud maps already in sync.'
                  : 'Sign in with Google to sync maps to Cloud.';
        }
        this.refresh();
      },
      { signal }
    );

    bindPointerTap(
      modalEl.querySelector('#devtools-reset-selected-map'),
      () => {
        audioManager.playSfx('cancel');
        resetChapterMapOverride(this.selectedMapLevelId);
        void saveManager.syncCustomMapsWithActiveSave();
        this.refresh();
      },
      { signal }
    );
  }

  public refresh(): void {
    const selectEl = this.mapLevelSelectEl;
    const badgeEl = this.mapStatusBadgeEl;
    const canvasEl = this.mapPreviewCanvasEl;
    const metaEl = this.mapMetaEl;
    if (!selectEl || !badgeEl || !canvasEl || !metaEl) return;

    selectEl.innerHTML = '';

    const chapterGroup = document.createElement('optgroup');
    chapterGroup.label = 'Chapter Maps';
    chapterGroup.dataset.testid = 'devtools-optgroup-chapters';
    for (const entry of CHAPTER_LEVEL_CATALOG) {
      const opt = document.createElement('option');
      opt.value = entry.id;
      const customMark = hasChapterMapOverride(entry.id) ? ' ★ [Custom]' : '';
      opt.textContent = `${entry.label}${customMark}`;
      chapterGroup.appendChild(opt);
    }

    const cutsceneGroup = document.createElement('optgroup');
    cutsceneGroup.label = 'Cutscene Stages';
    cutsceneGroup.dataset.testid = 'devtools-optgroup-cutscenes';
    for (const stage of CUTSCENE_STAGE_CATALOG) {
      const opt = document.createElement('option');
      opt.value = stage.id;
      const customMark = hasChapterMapOverride(stage.id) ? ' ★ [Custom]' : '';
      opt.textContent = `${stage.label}${customMark}`;
      cutsceneGroup.appendChild(opt);
    }
    selectEl.append(chapterGroup, cutsceneGroup);

    const isKnown =
      Boolean(getChapterCatalogEntry(this.selectedMapLevelId)) ||
      isCutsceneStageId(this.selectedMapLevelId);
    if (!isKnown) {
      this.selectedMapLevelId = CHAPTER_LEVEL_CATALOG[0]!.id;
    }
    selectEl.value = this.selectedMapLevelId;

    const stageEntry = getCutsceneStageCatalogEntry(this.selectedMapLevelId);
    const isCutscene = Boolean(stageEntry);
    const targetId = stageEntry?.id ?? (getChapterCatalogEntry(this.selectedMapLevelId) ?? CHAPTER_LEVEL_CATALOG[0]!).id;
    const map = getEffectiveChapterMap(targetId);
    const isCustom = hasChapterMapOverride(targetId);

    if (this.playMapBtnEl) {
      this.playMapBtnEl.hidden = isCutscene;
      this.playMapBtnEl.disabled = isCutscene;
    }

    badgeEl.textContent = isCustom ? 'CUSTOMIZED ★' : 'DEFAULT';
    badgeEl.className = `pmd-editor-status-pill${isCustom ? ' is-custom' : ''}`;

    const actorMarkers = stageEntry ? getCutsceneStageActorMarkers(stageEntry.id) : undefined;
    if (stageEntry && actorMarkers) {
      metaEl.textContent = `${map.name} · ${map.width}×${map.height} · Cutscene Stage (${stageEntry.cutsceneIds.join(', ')}) · ${actorMarkers.length} Actors`;
    } else {
      const cap = Math.max(
        1,
        Math.min(map.deploymentCap ?? map.playerSpawns.length, map.playerSpawns.length)
      );
      metaEl.textContent = `${map.name} · ${map.width}×${map.height} · Cap ${cap}/${map.playerSpawns.length} · ${map.enemySpawns.length} Enemies`;
    }

    const gen = ++this.mapPreviewGen;
    void renderDungeonMapPreviewCanvas(canvasEl, map, actorMarkers).then(() => {
      if (gen !== this.mapPreviewGen) return;
    });
  }
}
