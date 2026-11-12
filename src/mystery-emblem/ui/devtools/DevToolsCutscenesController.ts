/**
 * Mystery Emblem - Dev Tools "Cutscenes" Tab (`DevToolsCutscenesController.ts`)
 *
 * Lists every story cutscene and battle dialogue in play order, chapter by chapter, and opens
 * the (lazy-loaded) Cutscene Editor. "Play" runs a cutscene with your real save.
 */

import type { AudioManager } from '../../audio/AudioManager';
import { RAW_CHAPTER_JSON_LIST } from '../../data/chapters/defaultCatalog';
import type { CutsceneDoc, DialogueDoc } from '../../data/cutscenes/cutsceneDocTypes';
import { listDialogueDocs, subscribeCutsceneRegistry } from '../../data/cutscenes/cutsceneRegistry';
import { compileDialogueDoc } from '../../data/cutscenes/dialogueCompiler';
import {
  findStoryCutsceneLink,
  getPostChapterCutsceneIds,
  getPreChapterCutsceneIds,
  getStoryCutsceneById,
  listStoryCutscenesInPlayOrder,
} from '../../data/storyCutscenes';
import type { ChapterMapEditorScene } from '../../scenes/ChapterMapEditorScene';
import type { CutsceneScene } from '../../scenes/CutsceneScene';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DungeonEventDefinition } from '../../types/schemas';
import type { DialogueOverlay } from '../DialogueOverlay';
import { bindPointerTap } from '../pointerControls';
import { checkProjectSaveAvailable } from './projectFileClient';

export interface CutsceneEditorHostDeps {
  audioManager: AudioManager;
  cutsceneScene: CutsceneScene | null;
  dialogueOverlay: DialogueOverlay | null;
  mapEditorScene: ChapterMapEditorScene | null;
}

export interface DevToolsCutscenesDeps {
  modalEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager: AudioManager;
  getHost: () => CutsceneEditorHostDeps;
  hideDevTools: () => void;
  showDevTools: () => void;
  signal: AbortSignal;
}

const RESUME_KEY = 'me_cutscene_editor_resume_v1';
const DRAFT_PREFIX = 'me_cutscene_editor_draft_v1:';

type EditorTarget =
  | { kind: 'story'; id: string }
  | { kind: 'dialogue'; chapterId: string; id: string }
  | { kind: 'new-story' }
  | { kind: 'duplicate-story'; id: string }
  | { kind: 'new-dialogue'; chapterId: string };

function describeTrigger(chapterId: string, dialogueId: string): string {
  const raw = RAW_CHAPTER_JSON_LIST.find((c) => c.id === chapterId);
  const ev: DungeonEventDefinition | undefined = raw?.events?.find((e) =>
    e.actions.some((a) => a.type === 'play_dialogue' && a.scriptId === dialogueId)
  );
  if (!ev) return 'no trigger';
  const t = ev.trigger;
  switch (t.type) {
    case 'turn_start':
      return `turn ${t.turnNumber}${t.phase === 'enemy_phase' ? ' (enemy phase)' : ''}`;
    case 'talk':
      return `Talk with ${t.targetUnitId}`;
    case 'unit_defeated':
      return `${t.targetUnitId} defeated`;
    case 'tile_reached':
      return `area (${t.x1},${t.y1})–(${t.x2},${t.y2}) reached`;
    case 'battle_victory':
      return 'battle won';
    case 'unit_healed':
      return 'a unit is healed';
  }
}

export class DevToolsCutscenesController {
  private readonly deps: DevToolsCutscenesDeps;
  private readonly listEl: HTMLElement | null;
  private readonly statusEl: HTMLElement | null;
  private readonly chapterSelectEl: HTMLSelectElement | null;
  private renderAbort = new AbortController();
  private canSave = false;
  private editorOpen = false;

  constructor(deps: DevToolsCutscenesDeps) {
    this.deps = deps;
    this.listEl = deps.modalEl.querySelector('[data-testid="devtools-cutscene-list"]');
    this.statusEl = deps.modalEl.querySelector('[data-testid="devtools-cutscene-status"]');
    this.chapterSelectEl = deps.modalEl.querySelector('[data-testid="devtools-new-dialogue-chapter"]');
    if (this.chapterSelectEl) {
      for (const ch of RAW_CHAPTER_JSON_LIST) this.chapterSelectEl.append(new Option(ch.label, ch.id));
    }
    bindPointerTap(deps.modalEl.querySelector('[data-testid="devtools-new-cutscene"]'), () => {
      deps.audioManager.playSfx('select');
      void this.openEditor({ kind: 'new-story' });
    }, { signal: deps.signal });
    bindPointerTap(deps.modalEl.querySelector('[data-testid="devtools-new-dialogue"]'), () => {
      deps.audioManager.playSfx('select');
      void this.openEditor({ kind: 'new-dialogue', chapterId: this.chapterSelectEl?.value || 'prologue' });
    }, { signal: deps.signal });
    subscribeCutsceneRegistry(() => this.refresh());
    void checkProjectSaveAvailable().then((ok) => {
      this.canSave = ok;
      this.refresh();
    });
  }

  /** Re-opens the editor after a page reload (e.g. the dev server restarted). */
  public resumeIfNeeded(): void {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(RESUME_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    try {
      void this.openEditor(JSON.parse(raw) as EditorTarget);
    } catch {
      window.sessionStorage.removeItem(RESUME_KEY);
    }
  }

  public async openEditor(target: EditorTarget): Promise<void> {
    if (this.editorOpen) return;
    this.editorOpen = true;
    this.deps.hideDevTools();
    try {
      const { openCutsceneEditor } = await import('../../cutscene-editor/CutsceneEditorApp');
      const host = this.deps.getHost();
      const app = await openCutsceneEditor(
        {
          ...host,
          onExit: () => {
            this.editorOpen = false;
            this.deps.showDevTools();
            this.refresh();
          },
        },
        target
      );
      if (!app) {
        this.editorOpen = false;
        this.deps.showDevTools();
        try {
          window.sessionStorage.removeItem(RESUME_KEY);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      this.editorOpen = false;
      this.deps.showDevTools();
      if (this.statusEl) this.statusEl.textContent = `Couldn't open the editor: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private async playInGame(doc: CutsceneDoc): Promise<void> {
    const scene = this.deps.getHost().cutsceneScene;
    if (!scene) return;
    this.deps.hideDevTools();
    await scene.play(doc);
    this.deps.getHost().audioManager.stopBgm({ fadeMs: 200 });
    this.deps.showDevTools();
  }

  private async previewDialogue(doc: DialogueDoc): Promise<void> {
    const overlay = this.deps.getHost().dialogueOverlay;
    if (!overlay) return;
    this.deps.hideDevTools();
    await overlay.playScript(compileDialogueDoc(doc, this.deps.saveManager.getSave()));
    this.deps.showDevTools();
  }

  private hasDraft(key: string): boolean {
    try {
      return window.localStorage.getItem(DRAFT_PREFIX + key) !== null;
    } catch {
      return false;
    }
  }

  private makeRow(label: string, title: string, hint: string, onEdit: () => void, onPlay: (() => void) | null, draftKey: string, testid: string, onDuplicate?: () => void): HTMLElement {
    const signal = this.renderAbort.signal;
    const row = document.createElement('div');
    row.className = 'pmd-devtools-cutscene-row';
    row.dataset.testid = testid;
    const text = document.createElement('div');
    text.className = 'pmd-devtools-cutscene-text';
    const tag = document.createElement('span');
    tag.className = 'pmd-devtools-cutscene-tag';
    tag.textContent = label;
    const name = document.createElement('strong');
    name.textContent = title;
    const sub = document.createElement('span');
    sub.className = 'pmd-subcard-text';
    sub.textContent = `${hint}${this.hasDraft(draftKey) ? ' · ● unsaved draft' : ''}`;
    text.append(tag, name, sub);
    const btns = document.createElement('div');
    btns.className = 'pmd-inline-btns';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'pmd-btn pmd-btn-primary pmd-chip-btn';
    edit.textContent = 'Edit';
    bindPointerTap(edit, () => {
      this.deps.audioManager.playSfx('select');
      onEdit();
    }, { signal });
    btns.append(edit);
    if (onPlay) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'pmd-btn pmd-chip-btn';
      play.textContent = '▶ Play';
      bindPointerTap(play, () => {
        this.deps.audioManager.playSfx('select');
        onPlay();
      }, { signal });
      btns.append(play);
    }
    if (onDuplicate) {
      const dup = document.createElement('button');
      dup.type = 'button';
      dup.className = 'pmd-btn pmd-chip-btn';
      dup.textContent = 'Duplicate';
      bindPointerTap(dup, () => {
        this.deps.audioManager.playSfx('select');
        onDuplicate();
      }, { signal });
      btns.append(dup);
    }
    row.append(text, btns);
    return row;
  }

  public refresh(): void {
    const listEl = this.listEl;
    if (!listEl) return;
    this.renderAbort.abort();
    this.renderAbort = new AbortController();
    listEl.innerHTML = '';
    if (this.statusEl) {
      this.statusEl.textContent = this.canSave
        ? 'Saving writes straight into the project. Commit & push to make changes live.'
        : 'Read-only here: run the game locally (npm run dev) to edit and save. Editing works on a computer only.';
    }
    const storyRow = (doc: CutsceneDoc, label: string) =>
      this.makeRow(label, doc.title, `${doc.beats.length} beats · ${doc.id}`, () => void this.openEditor({ kind: 'story', id: doc.id }), () => void this.playInGame(doc), `story:${doc.id}`, `devtools-cutscene-${doc.id}`, () => void this.openEditor({ kind: 'duplicate-story', id: doc.id }));
    const dialogueRow = (doc: DialogueDoc) => {
      const label = doc.role === 'intro' ? 'Battle intro' : doc.role === 'outro' ? 'Battle outro' : 'Mid-battle';
      const hint = doc.role === 'event' ? `when: ${describeTrigger(doc.chapter, doc.id)}` : `${doc.beats.length} lines`;
      return this.makeRow(label, doc.title && doc.role === 'event' ? doc.title : `${doc.beats.length} line${doc.beats.length === 1 ? '' : 's'}`, hint, () => void this.openEditor({ kind: 'dialogue', chapterId: doc.chapter, id: doc.id }), () => void this.previewDialogue(doc), `dialogue:${doc.chapter}/${doc.id}`, `devtools-dialogue-${doc.chapter}-${doc.id}`);
    };

    for (const ch of RAW_CHAPTER_JSON_LIST) {
      const group = document.createElement('div');
      group.className = 'pmd-devtools-cutscene-group';
      const head = document.createElement('h4');
      head.className = 'pmd-subcard-title';
      head.textContent = ch.label;
      group.append(head);
      for (const csId of getPreChapterCutsceneIds(ch.nodeId)) {
        const pre = getStoryCutsceneById(csId);
        if (pre) group.append(storyRow(pre, 'Before'));
      }
      const dialogues = listDialogueDocs(ch.id);
      const order = (d: DialogueDoc) => (d.role === 'intro' ? 0 : d.role === 'event' ? 1 : 2);
      for (const d of dialogues.sort((a, b) => order(a) - order(b))) group.append(dialogueRow(d));
      for (const csId of getPostChapterCutsceneIds(ch.nodeId)) {
        const post = getStoryCutsceneById(csId);
        if (post) group.append(storyRow(post, 'After'));
      }
      listEl.append(group);
    }
    const unlinked = listStoryCutscenesInPlayOrder().filter((d) => !findStoryCutsceneLink(d.id));
    if (unlinked.length) {
      const group = document.createElement('div');
      group.className = 'pmd-devtools-cutscene-group';
      const head = document.createElement('h4');
      head.className = 'pmd-subcard-title';
      head.textContent = 'Not linked to a chapter yet';
      group.append(head);
      for (const d of unlinked) group.append(storyRow(d, 'Unlinked'));
      listEl.append(group);
    }
  }
}
