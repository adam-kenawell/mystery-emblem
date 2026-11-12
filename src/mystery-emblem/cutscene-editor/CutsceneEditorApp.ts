/**
 * Dev Tools Cutscene Editor App (`CutsceneEditorApp.ts`)
 *
 * Desktop-only, full-screen editor for story cutscenes and battle dialogues. Lazy-loaded from the
 * Dev Tools "Cutscenes" tab. Saves straight into the project's JSON files through the dev-only
 * save endpoints; on the live site it opens read-only (preview only).
 */

import './cutsceneEditor.css';
import type { AudioManager } from '../audio/AudioManager';
import { getEffectiveChapterMap } from '../data/chapterMapRegistry';
import { applyEditedChapterJson, getRawChapterJson } from '../data/chapters/index';
import type { CompactChapterJson } from '../data/chapters/chapterTypes';
import type {
  Beat,
  CutsceneDoc,
  DialogueDoc,
  LocationDoc,
  StageAction,
} from '../data/cutscenes/cutsceneDocTypes';
import { NARRATOR_SPEAKER_ID } from '../data/cutscenes/cutsceneDocTypes';
import {
  chapterDialogueFolder,
  CUTSCENE_DOC_FOLDER,
  getCutsceneDoc,
  getDialogueDoc,
  getLocationDoc,
  listCutsceneDocs,
  listDialogueDocs,
  listLocationDocs,
  LOCATION_DOC_FOLDER,
  removeCutsceneDoc,
  removeDialogueDoc,
  upsertCutsceneDoc,
  upsertDialogueDoc,
  upsertLocationDoc,
} from '../data/cutscenes/cutsceneRegistry';
import {
  buildBeatDialogueLine,
  castIdentityToSpeakerRef,
  compileDialogueDoc,
  describeCastMember,
  interpolateCastNames,
  resolveBeatSides,
  showIfPasses,
} from '../data/cutscenes/dialogueCompiler';
import {
  decodeLocationTileRows,
  encodeLocationTileRows,
  fromEditableTileGrid,
  toEditableTileGrid,
} from '../data/cutscenes/locationCodec';
import { buildPreviewSave } from '../data/cutscenes/previewSave';
import { findStoryCutsceneLink } from '../data/storyCutscenes';
import { interpolateCampaignText, resolveSpeakerIdentity } from '../engine/speakerResolver';
import type { ChapterMapEditorScene } from '../scenes/ChapterMapEditorScene';
import type { CutsceneScene } from '../scenes/CutsceneScene';
import {
  createCutsceneAssetCaches,
  preloadCutsceneAssets,
} from '../scenes/cutscene/cutsceneActorResolver';
import { CutsceneStageRuntime } from '../scenes/cutscene/cutsceneChoreographer';
import type { DungeonEventDefinition, DungeonMapDefinition } from '../types/schemas';
import type { DialogueOverlay } from '../ui/DialogueOverlay';
import { checkProjectSaveAvailable, deleteProjectFile, writeChapterJsonFile, writeProjectJson } from '../ui/devtools/projectFileClient';
import { parseRichDialogueText } from '../ui/typewriterController';
import { loadSpeciesPortrait } from '../assets/pmdAssetLoader';
import type { EditorContext, EditorSelection, UpdateOptions } from './editorContext';
import { button, checkbox, h, segmented, type UiContext } from './editorDom';
import { stopAllPreviewAudio } from './editorPickers';
import {
  EditorSession,
  readDraft,
  RESUME_KEY,
  sessionKey,
  slugifyId,
  uniqueId,
  type SessionData,
  type StorySessionData,
} from './editorSession';
import { EditorStageView, facingToDirection, type StageOverlay } from './editorStageView';
import { validateSession } from './editorValidation';
import { renderBeatInspector, renderBeatList } from './panelBeats';
import { renderCastPanel } from './panelCast';
import { blankLocation, renderLocationPanel } from './panelLocation';
import { renderDialogueSettingsPanel, renderStoryScenePanel } from './panelScene';

export interface CutsceneEditorHost {
  audioManager: AudioManager;
  cutsceneScene: CutsceneScene | null;
  dialogueOverlay: DialogueOverlay | null;
  mapEditorScene: ChapterMapEditorScene | null;
  onExit: () => void;
}

export type CutsceneEditorTarget =
  | { kind: 'story'; id: string }
  | { kind: 'dialogue'; chapterId: string; id: string }
  | { kind: 'new-story' }
  | { kind: 'duplicate-story'; id: string }
  | { kind: 'new-dialogue'; chapterId: string };

type SideTab = 'beat' | 'cast' | 'location' | 'scene';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function findDialogueEvent(chapterId: string, dialogueId: string): DungeonEventDefinition | null {
  const raw = getRawChapterJson(chapterId);
  const ev = raw?.events?.find((e) => e.actions.some((a) => a.type === 'play_dialogue' && a.scriptId === dialogueId));
  return ev ? clone(ev) : null;
}

/** Sets a story link key, inserting it where chapter files keep it (just before the map size). */
function setChapterLink(chapter: CompactChapterJson, key: 'preStoryCutsceneId' | 'postStoryCutsceneId', value: string): CompactChapterJson {
  if (key in chapter) {
    chapter[key] = value;
    return chapter;
  }
  const out: Record<string, unknown> = {};
  let inserted = false;
  for (const [k, v] of Object.entries(chapter)) {
    if (!inserted && (k === 'width' || (key === 'preStoryCutsceneId' && k === 'postStoryCutsceneId'))) {
      out[key] = value;
      inserted = true;
    }
    out[k] = v;
  }
  if (!inserted) out[key] = value;
  return out as unknown as CompactChapterJson;
}

function defaultStoryDoc(id: string, title: string): CutsceneDoc {
  const location = listLocationDocs()[0]?.id ?? 'new_location';
  return {
    id,
    title,
    music: 'calm_cutscene',
    location,
    banner: title,
    lighting: 'clear',
    camera: { x: 7.5, y: 5.5 },
    cast: [
      { id: 'lord', who: { kind: 'lord' } },
      { id: 'partner', who: { kind: 'partner' } },
      { id: 'healer', who: { kind: 'healer' } },
      { id: 'advisor', who: { kind: 'advisor' } },
    ],
    placements: [
      { id: 'lord', x: 7, y: 5, facing: 'Down' },
      { id: 'partner', x: 8, y: 5, facing: 'Down' },
      { id: 'healer', x: 6, y: 5, facing: 'Down' },
      { id: 'advisor', x: 7, y: 6, facing: 'Up' },
    ],
    beats: [{ id: 'beat_1', say: { speaker: 'lord', emotion: 'Normal', side: 'auto', text: '' } }],
  };
}

function storySessionFor(doc: CutsceneDoc, link: StorySessionData['link']): StorySessionData {
  const locations: Record<string, LocationDoc> = {};
  const ids = new Set<string>([doc.location]);
  for (const b of doc.beats) for (const a of b.actions ?? []) if (a.type === 'location') ids.add(a.location);
  for (const id of ids) {
    const loc = getLocationDoc(id);
    locations[id] = loc ? clone(loc) : blankLocation(id, id);
  }
  return { kind: 'story', doc: clone(doc), locations, link };
}

export class CutsceneEditorApp {
  public readonly rootEl: HTMLElement;
  private readonly abort = new AbortController();
  private renderAbort = new AbortController();
  private session!: EditorSession;
  private originalId = '';
  private sel: EditorSelection = { beatIndex: 0, actionIndex: null, castId: null };
  private tab: SideTab = 'beat';
  private canSave = false;
  private readonly previewSave = buildPreviewSave();
  private readonly caches = createCutsceneAssetCaches();
  private stage!: EditorStageView;
  private stageGen = 0;
  private runtime: CutsceneStageRuntime | null = null;
  private aimingCamera = false;
  private pickingArea: { first: { x: number; y: number } | null } | null = null;
  private editingLocationId = '';
  private toastTimer: number | null = null;

  private readonly topbarEl: HTMLElement;
  private readonly beatsColEl: HTMLElement;
  private readonly sideTabsEl: HTMLElement;
  private readonly sideBodyEl: HTMLElement;
  private readonly issuesEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly stageColEl: HTMLElement;

  constructor(private readonly host: CutsceneEditorHost) {
    this.topbarEl = h('header', { class: 'cse-topbar' });
    this.stageColEl = h('div', { class: 'cse-stage-col' });
    this.beatsColEl = h('div', { class: 'cse-beats-col', 'data-testid': 'cse-beats-col' });
    this.sideTabsEl = h('nav', { class: 'cse-tabs' });
    this.sideBodyEl = h('div', { class: 'cse-side-body', 'data-testid': 'cse-side-body' });
    this.issuesEl = h('div', { class: 'cse-issues', 'data-testid': 'cse-issues' });
    this.toastEl = h('div', { class: 'cse-toast', 'data-testid': 'cse-toast' });
    this.toastEl.hidden = true;
    this.rootEl = h('div', { class: 'cse-root', id: 'pmd-cutscene-editor', 'data-testid': 'cutscene-editor' },
      this.topbarEl,
      h('div', { class: 'cse-main' }, this.stageColEl, this.beatsColEl, h('aside', { class: 'cse-side-col' }, this.sideTabsEl, this.sideBodyEl)),
      this.issuesEl,
      this.toastEl);
  }

  // ---------------------------------------------------------------- lifecycle

  public async open(target: CutsceneEditorTarget): Promise<boolean> {
    const data = this.buildInitialData(target);
    if (!data) return false;
    this.canSave = await checkProjectSaveAvailable();
    this.session = new EditorSession(data.data, { isNew: data.isNew });
    this.originalId = data.isNew ? '' : data.data.doc.id;
    const draft = readDraft(sessionKey(data.data));
    if (draft && JSON.stringify(draft.data) !== JSON.stringify(data.data)) {
      const when = new Date(draft.savedAt).toLocaleString();
      if (window.confirm(`You have unsaved changes to this ${data.data.kind === 'story' ? 'cutscene' : 'dialogue'} from ${when}. Restore them?`)) {
        this.session.replaceData(draft.data);
      }
    }
    this.sel = { beatIndex: data.data.kind === 'story' ? -1 : 0, actionIndex: null, castId: null };
    if (data.data.kind === 'story') this.editingLocationId = data.data.doc.location;
    this.tab = 'beat';

    document.body.append(this.rootEl);
    this.stage = new EditorStageView({
      onTapTile: (x, y) => this.onStageTap(x, y),
      onSelectCast: (id) => this.select({ castId: id }),
      onDragCast: (id, x, y, done) => this.onDragCast(id, x, y, done),
      onDragProp: (id, x, y, done) => this.onDragProp(id, x, y, done),
    }, this.abort.signal);
    this.stageColEl.append(this.stage.rootEl);
    this.stage.onMapTileTap = (x, y) => this.onMapTileTap(x, y);
    this.stage.start();

    this.session.subscribe(() => {
      this.afterChange(this.lastUpdateOpts);
      this.lastUpdateOpts = undefined;
    });
    document.addEventListener('keydown', (ev) => this.onKeyDown(ev), { signal: this.abort.signal });
    window.addEventListener('beforeunload', () => this.session.dispose(), { signal: this.abort.signal });
    this.writeResume(target);

    if (window.innerWidth < 900) this.showDesktopOnlyNotice();
    this.rerender();
    return true;
  }

  private writeResume(target: CutsceneEditorTarget): void {
    const d = this.session.data;
    const resume: CutsceneEditorTarget =
      this.session.isNew ? target : d.kind === 'story' ? { kind: 'story', id: d.doc.id } : { kind: 'dialogue', chapterId: d.doc.chapter, id: d.doc.id };
    try {
      window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(resume));
    } catch {
      // ignore
    }
  }

  private buildInitialData(target: CutsceneEditorTarget): { data: SessionData; isNew: boolean } | null {
    switch (target.kind) {
      case 'story': {
        const doc = getCutsceneDoc(target.id);
        if (!doc) return null;
        return { data: storySessionFor(doc, findStoryCutsceneLink(doc.id)), isNew: false };
      }
      case 'duplicate-story': {
        const src = getCutsceneDoc(target.id);
        if (!src) return null;
        const id = uniqueId(`${src.id}_copy`, (c) => Boolean(getCutsceneDoc(c)));
        return { data: storySessionFor({ ...clone(src), id, title: `${src.title} (copy)` }, null), isNew: true };
      }
      case 'new-story': {
        const title = window.prompt('Title for the new cutscene:', 'A New Scene');
        if (!title) return null;
        const id = uniqueId(`cs_${slugifyId(title)}`, (c) => Boolean(getCutsceneDoc(c)));
        return { data: storySessionFor(defaultStoryDoc(id, title), null), isNew: true };
      }
      case 'dialogue': {
        const doc = getDialogueDoc(target.chapterId, target.id);
        if (!doc) return null;
        return { data: { kind: 'dialogue', doc: clone(doc), event: findDialogueEvent(doc.chapter, doc.id) }, isNew: false };
      }
      case 'new-dialogue': {
        const title = window.prompt('Name for the new battle dialogue:', 'Mid-battle talk');
        if (!title) return null;
        const id = uniqueId(`${target.chapterId.replace('chapter_', 'ch').replace('paralogue_', 'p')}_${slugifyId(title)}`, (c) => Boolean(getDialogueDoc(target.chapterId, c)));
        const doc: DialogueDoc = {
          id,
          chapter: target.chapterId,
          role: 'event',
          title,
          cast: [{ id: 'lord', who: { kind: 'lord' } }, { id: 'advisor', who: { kind: 'advisor' } }],
          beats: [{ id: 'beat_1', say: { speaker: 'lord', emotion: 'Normal', side: 'auto', text: '' } }],
        };
        const event: DungeonEventDefinition = {
          id: `ev_${id}`,
          once: true,
          trigger: { type: 'turn_start', turnNumber: 2, phase: 'player_phase' },
          actions: [{ type: 'play_dialogue', scriptId: id }],
        };
        return { data: { kind: 'dialogue', doc, event }, isNew: true };
      }
    }
  }

  private showDesktopOnlyNotice(): void {
    const ui = this.uiContext(this.abort.signal);
    const notice = h('div', { class: 'cse-desktop-only', 'data-testid': 'cse-desktop-only' },
      h('h2', { text: 'Open on a computer to edit' }),
      h('p', { text: 'The cutscene editor needs a wider screen. You can still preview this scene.' }),
      h('div', { class: 'cse-row' },
        button(ui, '▶ Preview', () => this.previewFrom(0), { kind: 'primary' }),
        button(ui, '◀ Back', () => void this.exit(), {})));
    this.rootEl.append(notice);
  }

  public async exit(): Promise<void> {
    if (this.session.isDirty() && !window.confirm('Leave without saving? Your changes are kept as a draft and offered next time you open this.')) return;
    stopAllPreviewAudio();
    this.session.dispose();
    this.stage.destroy();
    this.abort.abort();
    this.renderAbort.abort();
    this.rootEl.remove();
    try {
      window.sessionStorage.removeItem(RESUME_KEY);
    } catch {
      // ignore
    }
    this.host.onExit();
  }

  // ---------------------------------------------------------------- context

  private uiContext(signal: AbortSignal): UiContext {
    return { signal, sfx: (id) => this.host.audioManager.playSfx(id) };
  }

  private lastUpdateOpts: UpdateOptions | undefined;

  private context(signal: AbortSignal): EditorContext {
    return {
      ui: this.uiContext(signal),
      session: this.session,
      sel: this.sel,
      canSave: this.canSave,
      previewSave: this.previewSave,
      update: (mutator, opts) => {
        this.lastUpdateOpts = opts;
        this.session.mutate(mutator, opts?.coalesce ? { coalesceKey: opts.coalesce } : {});
        this.lastUpdateOpts = undefined;
      },
      select: (next) => this.select(next),
      nameOf: (id) => this.nameOf(id),
      visualKeyOf: (id) => this.visualKeyOf(id),
      toast: (msg) => this.toast(msg),
      openLocationPainter: (locId, layerIndex) => this.openLocationPainter(locId, layerIndex),
      previewFrom: (i) => this.previewFrom(i),
      rerender: () => this.rerender(),
    };
  }

  private nameOf(castId: string): string {
    if (castId === NARRATOR_SPEAKER_ID) return 'Narrator';
    const member = this.session.data.doc.cast.find((c) => c.id === castId);
    if (!member) return `${castId}?`;
    const info = describeCastMember(member, this.previewSave);
    return info.name;
  }

  private visualKeyOf(castId: string): string | null {
    const member = this.session.data.doc.cast.find((c) => c.id === castId);
    if (!member) return null;
    const ref = castIdentityToSpeakerRef(member.who, this.previewSave);
    if (!ref) return null;
    const id = resolveSpeakerIdentity(ref, this.previewSave);
    return id.visualAssetId ?? id.speciesId ?? id.pmdAssetId;
  }

  private select(next: Partial<EditorSelection>): void {
    const beatChanged = next.beatIndex !== undefined && next.beatIndex !== this.sel.beatIndex;
    Object.assign(this.sel, next);
    if (beatChanged && next.actionIndex === undefined) this.sel.actionIndex = null;
    if (next.beatIndex !== undefined && this.tab !== 'beat' && next.castId === undefined) this.tab = 'beat';
    this.aimingCamera = false;
    this.rerender();
  }

  private afterChange(opts: UpdateOptions | undefined): void {
    const beats = this.session.data.doc.beats.length;
    if (this.sel.beatIndex >= beats) this.sel.beatIndex = beats - 1;
    if (this.sel.beatIndex < 0 && this.session.data.kind === 'dialogue') this.sel.beatIndex = 0;
    const beat = this.session.data.doc.beats[this.sel.beatIndex];
    if (this.sel.actionIndex !== null && !beat?.actions?.[this.sel.actionIndex]) this.sel.actionIndex = null;
    if (opts?.keepInspector) this.rerender({ keepSide: true });
    else this.rerender();
  }

  // ---------------------------------------------------------------- rendering

  private rerender(opts: { keepSide?: boolean } = {}): void {
    if (!opts.keepSide) {
      this.renderAbort.abort();
      this.renderAbort = new AbortController();
    }
    const ctx = this.context(this.renderAbort.signal);
    this.renderTopbar(ctx);
    renderBeatList(ctx, this.beatsColEl);
    if (!opts.keepSide) this.renderSide(ctx);
    this.renderIssues();
    void this.syncStage();
    this.renderDialoguePreview();
  }

  private renderTopbar(ctx: EditorContext): void {
    const { ui } = ctx;
    const d = this.session.data;
    const dirty = this.session.isDirty();
    const title = d.kind === 'story' ? d.doc.title : `${d.doc.title ?? d.doc.id} · ${d.doc.chapter}`;
    this.topbarEl.innerHTML = '';
    this.topbarEl.append(
      button(ui, '◀ Dev Tools', () => void this.exit(), { kind: 'ghost', testid: 'cse-exit' }),
      h('div', { class: 'cse-title' },
        h('strong', { text: title || '(untitled)' }),
        h('span', { class: 'cse-hint', text: d.kind === 'story' ? `cutscene · ${d.doc.id}` : `battle dialogue · ${d.doc.role}` }),
        dirty ? h('span', { class: 'cse-dirty', 'data-testid': 'cse-dirty', text: '● unsaved' }) : null),
      h('div', { class: 'cse-row' },
        button(ui, '↶ Undo', () => this.session.undo(), { disabled: !this.session.canUndo(), title: 'Ctrl+Z', testid: 'cse-undo' }),
        button(ui, '↷ Redo', () => this.session.redo(), { disabled: !this.session.canRedo(), title: 'Ctrl+Y' }),
        button(ui, '▶ Play from start', () => this.previewFrom(0), { testid: 'cse-play-all' }),
        button(ui, this.canSave ? '💾 Save' : 'Save (local only)', () => void this.save(), {
          kind: 'primary',
          disabled: !this.canSave,
          testid: 'cse-save',
          title: this.canSave ? 'Writes the JSON files into the project (Ctrl+S)' : 'Saving only works when running the game locally with npm run dev',
        })));
  }

  private renderSide(ctx: EditorContext): void {
    const d = this.session.data;
    const tabs: Array<{ value: SideTab; label: string }> =
      d.kind === 'story'
        ? [{ value: 'beat', label: 'Beat' }, { value: 'cast', label: 'Cast' }, { value: 'location', label: 'Location' }, { value: 'scene', label: 'Scene' }]
        : [{ value: 'beat', label: 'Line' }, { value: 'cast', label: 'Cast' }, { value: 'scene', label: d.doc.role === 'event' ? 'Trigger & settings' : 'Settings' }];
    this.sideTabsEl.innerHTML = '';
    this.sideTabsEl.append(segmented(ctx.ui, tabs, this.tab, (v) => {
      this.tab = v;
      this.rerender();
    }));
    const body = this.sideBodyEl;
    if (this.tab === 'beat') renderBeatInspector(ctx, body);
    else if (this.tab === 'cast') renderCastPanel(ctx, body);
    else if (this.tab === 'location' && d.kind === 'story') {
      renderLocationPanel(ctx, body, this.editingLocationId || d.doc.location, (id) => {
        this.editingLocationId = id;
        this.rerender();
      });
    } else if (d.kind === 'story') {
      renderStoryScenePanel(ctx, body, {
        onDelete: () => void this.deleteCurrent(),
        onAimCamera: () => {
          this.aimingCamera = !this.aimingCamera;
          this.sel.beatIndex = -1;
          this.rerender();
        },
        aimingCamera: this.aimingCamera,
        onRenameId: (next) => this.renameStoryId(next),
      });
    } else {
      renderDialogueSettingsPanel(ctx, body, {
        onDelete: () => void this.deleteCurrent(),
        pickingArea: Boolean(this.pickingArea),
        onPickArea: () => {
          this.pickingArea = this.pickingArea ? null : { first: null };
          this.rerender();
        },
      });
    }
  }

  private renderIssues(): void {
    const issues = validateSession(this.session.data);
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    this.issuesEl.textContent = '';
    if (!issues.length) {
      this.issuesEl.append(h('span', { class: 'cse-ok', text: '✓ No problems found' }));
      return;
    }
    this.issuesEl.append(h('span', { class: errors.length ? 'cse-err' : 'cse-warn', text: `${errors.length ? `${errors.length} error${errors.length === 1 ? '' : 's'} (fix before saving)` : ''}${errors.length && warnings.length ? ' · ' : ''}${warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}: ` }));
    this.issuesEl.append(h('span', { text: issues.slice(0, 3).map((i) => i.message).join('  •  ') + (issues.length > 3 ? '  …' : '') }));
    this.issuesEl.title = issues.map((i) => `${i.level === 'error' ? '✖' : '⚠'} ${i.message}`).join('\n');
  }

  private renderStageToolbar(): void {
    const ui = this.uiContext(this.renderAbort.signal);
    const tb = this.stage.toolbarEl;
    tb.innerHTML = '';
    if (this.session.data.kind !== 'story') return;
    tb.append(
      checkbox(ui, 'Grid', this.stage.showGrid, (v) => { this.stage.showGrid = v; }),
      checkbox(ui, 'Phone frame', this.stage.showPhoneFrame, (v) => { this.stage.showPhoneFrame = v; }),
      checkbox(ui, '½-tile snap', this.stage.halfTileSnap, (v) => { this.stage.halfTileSnap = v; }),
      segmented(ui, [{ value: 'fit', label: 'Fit location' }, { value: 'game', label: 'Game camera' }], this.stage.view, (v) => {
        this.stage.view = v;
        this.stage.refreshLayout();
        this.renderStageToolbar();
      })
    );
  }

  private async syncStage(): Promise<void> {
    const gen = ++this.stageGen;
    const data = this.session.data;
    this.renderStageToolbar();
    if (data.kind === 'dialogue') {
      const map = getEffectiveChapterMap(data.doc.chapter);
      const hint = this.pickingArea
        ? (this.pickingArea.first ? 'Tap the opposite corner of the area.' : 'Tap the first corner of the area.')
        : 'Battle dialogue plays over this map. The box preview is below.';
      if (this.stageMapId !== data.doc.chapter) {
        this.stageMapId = data.doc.chapter;
        await this.stage.setMapBackdrop(map, hint);
      } else {
        this.stage.setMapBackdropHint(hint);
      }
      return;
    }
    this.stageMapId = null;
    const doc = clone(data.doc);
    const overrides = new Map(Object.entries(data.locations).map(([id, loc]) => [id, clone(loc)]));
    const runtime = new CutsceneStageRuntime(doc, this.previewSave, this.caches);
    await preloadCutsceneAssets({ doc, actors: runtime.actors, caches: this.caches, locationOverrides: overrides });
    if (gen !== this.stageGen) return;
    const overlay = this.positionRuntime(runtime, doc);
    this.runtime = runtime;
    this.stage.setRuntime(runtime, overlay);
  }

  private stageMapId: string | null = null;

  /** Puts the runtime in the state shown for the current selection and builds the overlay. */
  private positionRuntime(rt: CutsceneStageRuntime, doc: CutsceneDoc): StageOverlay {
    const sel = this.sel;
    const overlay: StageOverlay = {
      paths: [],
      ghosts: [],
      markers: [],
      draggable: new Set(),
      draggableProps: new Set(),
      hint: '',
      selectedCastId: sel.castId,
    };
    if (sel.beatIndex < 0) {
      rt.resetToStart();
      for (const p of doc.placements) overlay.draggable.add(p.id);
      for (const p of doc.props ?? []) overlay.draggableProps.add(p.id);
      overlay.markers.push({ x: doc.camera.x, y: doc.camera.y, label: 'Start camera', color: '#ff8898' });
      overlay.hint = this.aimingCamera
        ? 'Tap the stage to aim the starting camera.'
        : 'Opening setup: drag characters and props to set where they start.';
      return overlay;
    }
    const beat = doc.beats[sel.beatIndex];
    rt.fastForwardTo(sel.beatIndex);
    if (!beat) return overlay;
    const actions = beat.actions ?? [];
    const selected = sel.actionIndex !== null ? actions[sel.actionIndex] : undefined;
    if (selected?.type === 'location') {
      rt.runBeatActions({ ...beat, actions: actions.slice(0, (sel.actionIndex ?? 0) + 1) }, true);
      for (const p of selected.placements) overlay.draggable.add(p.id);
      for (const p of selected.props ?? []) overlay.draggableProps.add(p.id);
      overlay.hint = 'After the location change: drag characters to place them here.';
      return overlay;
    }
    const projected = new Map<string, { x: number; y: number }>();
    for (const a of rt.actors) if (a.visible) projected.set(a.actorId, { x: a.x, y: a.y });
    for (const p of rt.props) projected.set(`prop:${p.id}`, { x: p.x, y: p.y });
    actions.forEach((a, ai) => {
      const highlighted = ai === sel.actionIndex;
      if (a.type === 'walk') {
        const from = projected.get(a.who) ?? { x: 0, y: 0 };
        const points = [from, ...a.path.map(([x, y]) => ({ x, y }))];
        overlay.paths.push({ points, highlighted });
        const end = points[points.length - 1]!;
        if (a.path.length) {
          overlay.ghosts.push({ castId: a.who, x: end.x, y: end.y, facing: a.facing ? facingToDirection(a.facing) : undefined });
        }
        projected.set(a.who, end);
      } else if (a.type === 'place') {
        overlay.ghosts.push({ castId: a.who, x: a.x, y: a.y, facing: facingToDirection(a.facing) });
        projected.set(a.who, { x: a.x, y: a.y });
      } else if (a.type === 'camera') {
        overlay.markers.push({ x: a.x, y: a.y, label: 'Camera', color: highlighted ? '#f8e048' : '#ff8898' });
      } else if (a.type === 'prop' && a.path?.length) {
        const from = projected.get(`prop:${a.prop}`) ?? { x: 0, y: 0 };
        overlay.paths.push({ points: [from, ...a.path.map(([x, y]) => ({ x, y }))], highlighted, color: 'rgba(152, 232, 168, 0.7)' });
      }
    });
    for (const a of rt.actors) if (a.visible && !a.offStage) overlay.draggable.add(a.actorId);
    overlay.hint = this.hintForAction(selected);
    return overlay;
  }

  private hintForAction(a: StageAction | undefined): string {
    if (!a) return 'Showing the stage as this beat starts. Drag a character to make them walk; faded sprites show where walks end.';
    switch (a.type) {
      case 'walk':
        return 'Tap tiles to add steps to this walk (or drag the character).';
      case 'place':
        return 'Tap where the character should appear.';
      case 'camera':
        return 'Tap where the camera should aim.';
      case 'prop':
        return 'Tap tiles to move the prop along a path.';
      default:
        return 'Showing the stage as this beat starts.';
    }
  }

  private renderDialoguePreview(): void {
    const el = this.stage.dialoguePreviewEl;
    el.innerHTML = '';
    const data = this.session.data;
    const beat = data.doc.beats[this.sel.beatIndex];
    if (!beat) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (!beat.say) {
      el.append(h('div', { class: 'cse-dlg-silent', text: '🎬 Silent beat: the dialogue box is hidden while this plays.' }));
      return;
    }
    const save = this.previewSave;
    const sides = resolveBeatSides(data.doc.beats);
    const slots: Record<'left' | 'right', { speaker: string; emotion: string } | null> = { left: null, right: null };
    for (let i = 0; i <= this.sel.beatIndex; i++) {
      const b = data.doc.beats[i]!;
      if (!b.say || b.say.speaker === NARRATOR_SPEAKER_ID || !showIfPasses(b.showIf, data.doc.cast, save)) continue;
      const side = sides.get(b.id) ?? 'left';
      slots[side] = { speaker: b.say.speaker, emotion: b.say.emotion };
      if (b.say.hideOtherPortrait) slots[side === 'left' ? 'right' : 'left'] = null;
    }
    const line = buildBeatDialogueLine({ beat, side: sides.get(beat.id) ?? 'left', cast: data.doc.cast, save, includeMusicAndSound: false });
    const isNarrator = beat.say.speaker === NARRATOR_SPEAKER_ID;
    const identity = line && !isNarrator ? resolveSpeakerIdentity(line.speaker, save) : null;
    const text = interpolateCampaignText(interpolateCastNames(beat.say.text, data.doc.cast, save), save, identity?.nickname);
    const textEl = h('p', { class: 'cse-dlg-text' });
    for (const seg of parseRichDialogueText(text)) {
      if (seg.kind === 'pause') textEl.append(h('span', { class: 'cse-dlg-pause', title: `${seg.ms / 1000}s pause`, text: '⏸' }));
      else if (seg.style) textEl.append(h('span', { class: `pmd-text-${seg.style}`, text: seg.text }));
      else textEl.append(document.createTextNode(seg.text));
    }
    const portrait = (side: 'left' | 'right') => {
      const slot = isNarrator ? null : slots[side];
      const wrap = h('div', { class: `cse-dlg-portrait cse-dlg-portrait--${side}${slot && line?.side === side ? ' is-speaking' : ''}` });
      if (!slot) {
        wrap.classList.add('is-empty');
        return wrap;
      }
      const key = this.visualKeyOf(slot.speaker);
      if (key) {
        void loadSpeciesPortrait(key, slot.emotion as never).then((asset) => {
          const c = document.createElement('canvas');
          c.width = 80;
          c.height = 80;
          c.className = 'pmd-pixelated';
          const cx = c.getContext('2d')!;
          cx.imageSmoothingEnabled = false;
          if (side === 'right') {
            cx.translate(80, 0);
            cx.scale(-1, 1);
          }
          cx.drawImage(asset.source, 0, 0, asset.width, asset.height, 0, 0, 80, 80);
          wrap.append(c);
        });
      }
      return wrap;
    };
    el.append(
      portrait('left'),
      h('div', { class: `cse-dlg-box${isNarrator ? ' is-narrator' : ''}` },
        isNarrator ? null : h('div', { class: 'cse-dlg-name' }, h('span', { text: identity?.nickname ?? '?' }), identity && identity.speciesName.toLowerCase() !== identity.nickname.toLowerCase() ? h('span', { class: 'cse-dlg-species', text: identity.speciesName }) : null),
        textEl),
      portrait('right'));
  }

  // ---------------------------------------------------------------- stage interaction

  private mutate(mutator: (d: SessionData) => void | boolean, opts?: UpdateOptions): void {
    this.lastUpdateOpts = opts;
    this.session.mutate(mutator, opts?.coalesce ? { coalesceKey: opts.coalesce } : {});
    this.lastUpdateOpts = undefined;
  }

  private currentBeat(d: SessionData): Beat | undefined {
    return d.doc.beats[this.sel.beatIndex];
  }

  private onStageTap(x: number, y: number): void {
    const story = this.session.story;
    if (!story) return;
    if (this.aimingCamera) {
      this.aimingCamera = false;
      this.mutate((d) => { (d as StorySessionData).doc.camera = { x, y }; });
      return;
    }
    if (this.sel.beatIndex < 0 || this.sel.actionIndex === null) return;
    const ai = this.sel.actionIndex;
    const action = this.currentBeat(story)?.actions?.[ai];
    if (!action) return;
    this.mutate((d) => {
      const a = this.currentBeat(d)!.actions![ai]!;
      if (a.type === 'walk') a.path.push([x, y]);
      else if (a.type === 'place' || a.type === 'camera') {
        a.x = x;
        a.y = y;
      } else if (a.type === 'prop') a.path = [...(a.path ?? []), [x, y]];
      else return false;
    });
  }

  private onDragCast(castId: string, x: number, y: number, done: boolean): void {
    if (!done) return;
    const story = this.session.story;
    if (!story) return;
    if (this.sel.beatIndex < 0) {
      this.mutate((d) => {
        const p = (d as StorySessionData).doc.placements.find((pl) => pl.id === castId);
        if (!p) return false;
        p.x = x;
        p.y = y;
      });
      return;
    }
    const beat = this.currentBeat(story);
    if (!beat) return;
    const ai = this.sel.actionIndex;
    const selected = ai !== null ? beat.actions?.[ai] : undefined;
    if (selected?.type === 'location') {
      this.mutate((d) => {
        const a = this.currentBeat(d)!.actions![ai!]! as Extract<StageAction, { type: 'location' }>;
        const p = a.placements.find((pl) => pl.id === castId);
        if (p) {
          p.x = x;
          p.y = y;
        } else a.placements.push({ id: castId, x, y, facing: 'Down' });
      });
      return;
    }
    if (selected?.type === 'walk' && selected.who === castId) {
      this.mutate((d) => { (this.currentBeat(d)!.actions![ai!]! as Extract<StageAction, { type: 'walk' }>).path.push([x, y]); });
      return;
    }
    const nextIndex = beat.actions?.length ?? 0;
    this.mutate((d) => {
      const b = this.currentBeat(d)!;
      b.actions = [...(b.actions ?? []), { type: 'walk', who: castId, path: [[x, y]], speed: 'walk' }];
    });
    this.select({ actionIndex: nextIndex, castId });
  }

  private onDragProp(propId: string, x: number, y: number, done: boolean): void {
    if (!done) return;
    const story = this.session.story;
    if (!story) return;
    if (this.sel.beatIndex < 0) {
      this.mutate((d) => {
        const p = (d as StorySessionData).doc.props?.find((pp) => pp.id === propId);
        if (!p) return false;
        p.x = x;
        p.y = y;
      });
      return;
    }
    const ai = this.sel.actionIndex;
    const selected = ai !== null ? this.currentBeat(story)?.actions?.[ai] : undefined;
    if (selected?.type === 'location') {
      this.mutate((d) => {
        const a = this.currentBeat(d)!.actions![ai!]! as Extract<StageAction, { type: 'location' }>;
        const p = a.props?.find((pp) => pp.id === propId);
        if (!p) return false;
        p.x = x;
        p.y = y;
      });
    }
  }

  private onMapTileTap(x: number, y: number): void {
    const dlg = this.session.dialogue;
    if (!dlg || !this.pickingArea || dlg.event?.trigger.type !== 'tile_reached') return;
    if (!this.pickingArea.first) {
      this.pickingArea.first = { x, y };
      this.toast(`First corner (${x}, ${y}). Tap the opposite corner.`);
      this.rerender({ keepSide: true });
      return;
    }
    const a = this.pickingArea.first;
    this.pickingArea = null;
    this.mutate((d) => {
      const t = (d as typeof dlg).event!.trigger as Extract<DungeonEventDefinition['trigger'], { type: 'tile_reached' }>;
      t.x1 = Math.min(a.x, x);
      t.y1 = Math.min(a.y, y);
      t.x2 = Math.max(a.x, x);
      t.y2 = Math.max(a.y, y);
    });
  }

  private onKeyDown(ev: KeyboardEvent): void {
    if (!this.rootEl.isConnected || this.rootEl.hidden) return;
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return;
    const key = ev.key.toLowerCase();
    const target = ev.target as HTMLElement | null;
    const inText = Boolean(target && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text')));
    if (key === 's') {
      ev.preventDefault();
      void this.save();
    } else if (key === 'z' && !ev.shiftKey && !inText) {
      ev.preventDefault();
      this.session.undo();
    } else if ((key === 'y' || (key === 'z' && ev.shiftKey)) && !inText) {
      ev.preventDefault();
      this.session.redo();
    }
  }

  // ---------------------------------------------------------------- map editor hand-off

  private openLocationPainter(locationId: string, layerIndex: number): void {
    const story = this.session.story;
    const mapEditor = this.host.mapEditorScene;
    const loc = story?.locations[locationId];
    const layer = loc?.layers[layerIndex];
    if (!story || !mapEditor || !loc || !layer || layer.kind !== 'tiles') return;
    const grid = decodeLocationTileRows(layer.rows, layer.tileset, loc.width, loc.height);
    const map: DungeonMapDefinition = {
      id: `location:${loc.id}`,
      name: loc.name,
      deploymentCap: 0,
      width: loc.width,
      height: loc.height,
      tiles: toEditableTileGrid(grid),
      playerSpawns: [],
      enemySpawns: [],
    };
    const markers = story.doc.placements.map((p) => ({
      label: this.nameOf(p.id),
      previewAssetId: this.visualKeyOf(p.id) ?? 'axew',
      x: p.x,
      y: p.y,
      direction: facingToDirection(p.facing) ?? 0,
    }));
    this.rootEl.hidden = true;
    this.stage.stop();
    void mapEditor.openLocationLayer(map, {
      locationName: loc.name,
      defaultTilesetId: layer.tileset,
      markers,
      onDone: (edited) => {
        this.rootEl.hidden = false;
        this.stage.start();
        this.mutate((d) => {
          const target = (d as StorySessionData).locations[locationId]!;
          const resized = edited.width !== target.width || edited.height !== target.height;
          if (resized) {
            for (const other of target.layers) {
              if (other.kind !== 'tiles' || other === target.layers[layerIndex]) continue;
              const g = decodeLocationTileRows(other.rows, other.tileset, target.width, target.height);
              other.rows = encodeLocationTileRows(Array.from({ length: edited.height }, (_, y) => Array.from({ length: edited.width }, (_, x) => g[y]?.[x] ?? null)), other.tileset);
            }
          }
          target.width = edited.width;
          target.height = edited.height;
          const l = target.layers[layerIndex];
          if (l?.kind === 'tiles') l.rows = encodeLocationTileRows(fromEditableTileGrid(edited.tiles), l.tileset);
        });
        this.toast('Tiles updated. Save to write them to the project.');
      },
      onCancel: () => {
        this.rootEl.hidden = false;
        this.stage.start();
        this.rerender();
      },
    });
  }

  // ---------------------------------------------------------------- preview

  private previewFrom(beatIndex: number): void {
    const data = this.session.data;
    const start = Math.max(0, beatIndex);
    stopAllPreviewAudio();
    if (data.kind === 'story') {
      const scene = this.host.cutsceneScene;
      if (!scene) return;
      this.rootEl.hidden = true;
      this.stage.stop();
      const overrides = new Map(Object.entries(data.locations).map(([id, loc]) => [id, clone(loc)]));
      void scene.play(clone(data.doc), { saveOverride: this.previewSave, startBeat: start, locationOverrides: overrides }).finally(() => {
        this.host.audioManager.stopBgm({ fadeMs: 200 });
        this.rootEl.hidden = false;
        this.stage.start();
      });
      return;
    }
    const overlay = this.host.dialogueOverlay;
    if (!overlay) return;
    const doc = clone(data.doc);
    doc.beats = doc.beats.slice(start);
    const script = compileDialogueDoc(doc, this.previewSave);
    if (!script.lines.length) {
      this.toast('Nothing to preview from here.');
      return;
    }
    this.rootEl.hidden = true;
    void overlay.playScript(script, { saveOverride: this.previewSave }).finally(() => {
      this.rootEl.hidden = false;
    });
  }

  // ---------------------------------------------------------------- saving

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.hidden = false;
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.hidden = true;
      this.toastTimer = null;
    }, 3600);
  }

  private renameStoryId(raw: string): void {
    const story = this.session.story;
    if (!story) return;
    const next = slugifyId(raw, story.doc.id);
    if (next === story.doc.id) return;
    if (getCutsceneDoc(next)) {
      this.toast(`A cutscene called "${next}" already exists.`);
      this.rerender();
      return;
    }
    this.mutate((d) => { d.doc.id = next; });
  }

  private async writeChapterJson(next: CompactChapterJson): Promise<void> {
    await writeChapterJsonFile(next.id, next);
    applyEditedChapterJson(next);
  }

  private async save(): Promise<void> {
    if (!this.canSave) {
      this.toast('Saving only works when running locally (npm run dev).');
      return;
    }
    const issues = validateSession(this.session.data);
    const errors = issues.filter((i) => i.level === 'error');
    if (errors.length) {
      this.toast(`Can't save yet: ${errors[0]!.message}`);
      return;
    }
    try {
      if (this.session.data.kind === 'story') await this.saveStory(this.session.data);
      else await this.saveDialogue(this.session.data);
      this.session.markSaved();
      this.writeResume(this.session.data.kind === 'story' ? { kind: 'story', id: this.session.data.doc.id } : { kind: 'dialogue', chapterId: this.session.data.doc.chapter, id: this.session.data.doc.id });
      this.toast(`Saved to the project${issues.length ? ` (${issues.length} warning${issues.length === 1 ? '' : 's'})` : ''}. Commit & push to make it live.`);
      this.rerender();
    } catch (err) {
      this.toast(err instanceof Error ? `Save failed: ${err.message}` : 'Save failed');
    }
  }

  private async saveStory(data: StorySessionData): Promise<void> {
    const doc = data.doc;
    const renamedFrom = this.originalId && this.originalId !== doc.id ? this.originalId : null;
    for (const loc of Object.values(data.locations)) {
      const onDisk = getLocationDoc(loc.id);
      if (onDisk && JSON.stringify(onDisk) === JSON.stringify(loc)) continue;
      await writeProjectJson(`${LOCATION_DOC_FOLDER}/${loc.id}.json`, loc);
      upsertLocationDoc(loc);
    }
    await writeProjectJson(`${CUTSCENE_DOC_FOLDER}/${doc.id}.json`, doc);
    upsertCutsceneDoc(doc);
    if (renamedFrom) {
      await deleteProjectFile(`${CUTSCENE_DOC_FOLDER}/${renamedFrom}.json`);
      removeCutsceneDoc(renamedFrom);
    }

    const oldId = renamedFrom ?? doc.id;
    const oldLink = findStoryCutsceneLink(oldId);
    const newLink = data.link;
    const touched = new Map<string, CompactChapterJson>();
    const editable = (chapterId: string) => {
      let next = touched.get(chapterId);
      if (!next) {
        const raw = getRawChapterJson(chapterId);
        if (!raw) return null;
        next = clone(raw);
        touched.set(chapterId, next);
      }
      return next;
    };
    if (oldLink) {
      const ch = editable(oldLink.chapterId);
      if (ch) {
        if (oldLink.when === 'before') {
          if (ch.preStoryCutsceneIds) {
            ch.preStoryCutsceneIds = ch.preStoryCutsceneIds.filter((id) => id !== oldId);
            if (ch.preStoryCutsceneIds.length === 0) delete ch.preStoryCutsceneIds;
          }
          if (ch.preStoryCutsceneId === oldId) delete ch.preStoryCutsceneId;
        } else {
          if (ch.postStoryCutsceneIds) {
            ch.postStoryCutsceneIds = ch.postStoryCutsceneIds.filter((id) => id !== oldId);
            if (ch.postStoryCutsceneIds.length === 0) delete ch.postStoryCutsceneIds;
          }
          if (ch.postStoryCutsceneId === oldId) delete ch.postStoryCutsceneId;
        }
      }
    }
    if (newLink) {
      const ch = editable(newLink.chapterId);
      if (ch) {
        if (newLink.when === 'before' && ch.preStoryCutsceneIds) {
          if (!ch.preStoryCutsceneIds.includes(doc.id)) ch.preStoryCutsceneIds.push(doc.id);
        } else if (newLink.when === 'after' && ch.postStoryCutsceneIds) {
          if (!ch.postStoryCutsceneIds.includes(doc.id)) ch.postStoryCutsceneIds.push(doc.id);
        } else {
          touched.set(newLink.chapterId, setChapterLink(ch, newLink.when === 'before' ? 'preStoryCutsceneId' : 'postStoryCutsceneId', doc.id));
        }
      }
    }
    for (const [chapterId, next] of touched) {
      if (JSON.stringify(next) !== JSON.stringify(getRawChapterJson(chapterId))) await this.writeChapterJson(next);
    }
    this.originalId = doc.id;
  }

  private async saveDialogue(data: Extract<SessionData, { kind: 'dialogue' }>): Promise<void> {
    const doc = data.doc;
    if (doc.role !== 'event' && doc.id !== doc.role) {
      const existing = getDialogueDoc(doc.chapter, doc.role);
      if (existing && this.originalId !== doc.role) throw new Error(`${doc.chapter} already has an ${doc.role}. Edit that one instead.`);
      this.mutate((d) => { d.doc.id = (d.doc as DialogueDoc).role; });
    }
    const folder = chapterDialogueFolder(doc.chapter);
    const current = this.session.data.doc as DialogueDoc;
    await writeProjectJson(`${folder}/${current.id}.json`, current);
    upsertDialogueDoc(current);
    const renamedFrom = this.originalId && this.originalId !== current.id ? this.originalId : null;
    if (renamedFrom) {
      await deleteProjectFile(`${folder}/${renamedFrom}.json`);
      removeDialogueDoc(doc.chapter, renamedFrom);
    }

    const raw = getRawChapterJson(doc.chapter);
    if (raw) {
      const next = clone(raw);
      const plays = (e: DungeonEventDefinition, id: string) => e.actions.some((a) => a.type === 'play_dialogue' && a.scriptId === id);
      const existingIdx = (next.events ?? []).findIndex((e) => plays(e, renamedFrom ?? current.id) || plays(e, current.id));
      const event = current.role === 'event' ? (this.session.data as typeof data).event : null;
      const events = [...(next.events ?? [])];
      if (event) {
        const fixed = clone(event);
        fixed.actions = fixed.actions.map((a) => (a.type === 'play_dialogue' ? { ...a, scriptId: current.id } : a));
        if (!fixed.actions.some((a) => a.type === 'play_dialogue')) fixed.actions.unshift({ type: 'play_dialogue', scriptId: current.id });
        if (existingIdx >= 0) events[existingIdx] = fixed;
        else events.push(fixed);
      } else if (existingIdx >= 0) {
        events.splice(existingIdx, 1);
      }
      if (events.length) next.events = events;
      else delete next.events;
      if (JSON.stringify(next) !== JSON.stringify(raw)) await this.writeChapterJson(next);
    }
    this.originalId = current.id;
  }

  private async deleteCurrent(): Promise<void> {
    const data = this.session.data;
    const label = data.kind === 'story' ? `cutscene “${data.doc.title}”` : `dialogue “${data.doc.title ?? data.doc.id}”`;
    if (!window.confirm(`Delete the ${label}? This removes its file from the project${data.kind === 'story' ? ' and unlinks it from its chapter' : ' and its trigger'}.`)) return;
    if (this.session.isNew || !this.originalId) {
      this.session.markSaved();
      await this.exit();
      return;
    }
    try {
      if (data.kind === 'story') {
        const link = findStoryCutsceneLink(this.originalId);
        if (link) {
          const raw = getRawChapterJson(link.chapterId);
          if (raw) {
            const next = clone(raw);
            if (link.when === 'before') {
              if (next.preStoryCutsceneIds) {
                next.preStoryCutsceneIds = next.preStoryCutsceneIds.filter((id) => id !== this.originalId);
                if (next.preStoryCutsceneIds.length === 0) delete next.preStoryCutsceneIds;
              }
              if (next.preStoryCutsceneId === this.originalId) delete next.preStoryCutsceneId;
            } else {
              if (next.postStoryCutsceneIds) {
                next.postStoryCutsceneIds = next.postStoryCutsceneIds.filter((id) => id !== this.originalId);
                if (next.postStoryCutsceneIds.length === 0) delete next.postStoryCutsceneIds;
              }
              if (next.postStoryCutsceneId === this.originalId) delete next.postStoryCutsceneId;
            }
            await this.writeChapterJson(next);
          }
        }
        await deleteProjectFile(`${CUTSCENE_DOC_FOLDER}/${this.originalId}.json`);
        removeCutsceneDoc(this.originalId);
      } else {
        const raw = getRawChapterJson(data.doc.chapter);
        if (raw?.events?.some((e) => e.actions.some((a) => a.type === 'play_dialogue' && a.scriptId === this.originalId))) {
          const next = clone(raw);
          next.events = (next.events ?? []).filter((e) => !e.actions.some((a) => a.type === 'play_dialogue' && a.scriptId === this.originalId));
          if (!next.events.length) delete next.events;
          await this.writeChapterJson(next);
        }
        await deleteProjectFile(`${chapterDialogueFolder(data.doc.chapter)}/${this.originalId}.json`);
        removeDialogueDoc(data.doc.chapter, this.originalId);
      }
      this.session.markSaved();
      this.toast('Deleted.');
      await this.exit();
    } catch (err) {
      this.toast(err instanceof Error ? `Delete failed: ${err.message}` : 'Delete failed');
    }
  }
}

export async function openCutsceneEditor(host: CutsceneEditorHost, target: CutsceneEditorTarget): Promise<CutsceneEditorApp | null> {
  const app = new CutsceneEditorApp(host);
  const ok = await app.open(target);
  return ok ? app : null;
}

export { listCutsceneDocs, listDialogueDocs };
