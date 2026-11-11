/**
 * Cutscene Editor Session Model: Document State, Undo/Redo & Browser Drafts (`editorSession.ts`)
 */

import type {
  CutsceneDoc,
  DialogueDoc,
  LocationDoc,
} from '../data/cutscenes/cutsceneDocTypes';
import type { DungeonEventDefinition } from '../types/schemas';

export interface StoryLink {
  chapterId: string;
  when: 'before' | 'after';
}

export interface StorySessionData {
  kind: 'story';
  doc: CutsceneDoc;
  /** Working copies of every location this cutscene uses (shared files) */
  locations: Record<string, LocationDoc>;
  link: StoryLink | null;
}

export interface DialogueSessionData {
  kind: 'dialogue';
  doc: DialogueDoc;
  /** The chapter event that plays this dialogue (event role only) */
  event: DungeonEventDefinition | null;
}

export type SessionData = StorySessionData | DialogueSessionData;

const MAX_UNDO = 80;
const DRAFT_PREFIX = 'me_cutscene_editor_draft_v1:';
export const RESUME_KEY = 'me_cutscene_editor_resume_v1';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function sessionKey(data: SessionData): string {
  return data.kind === 'story' ? `story:${data.doc.id}` : `dialogue:${data.doc.chapter}/${data.doc.id}`;
}

export class EditorSession {
  public data: SessionData;
  /** Snapshot of what's on disk (for dirty tracking) */
  private savedJson: string;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<() => void>();
  private draftTimer: number | null = null;
  public isNew: boolean;

  constructor(data: SessionData, opts: { isNew?: boolean } = {}) {
    this.data = clone(data);
    this.savedJson = opts.isNew ? '' : JSON.stringify(this.data);
    this.isNew = Boolean(opts.isNew);
  }

  public get story(): StorySessionData | null {
    return this.data.kind === 'story' ? this.data : null;
  }

  public get dialogue(): DialogueSessionData | null {
    return this.data.kind === 'dialogue' ? this.data : null;
  }

  public isDirty(): boolean {
    return JSON.stringify(this.data) !== this.savedJson;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Applies a change as one undo step. Return `false` from the mutator to cancel. */
  public mutate(mutator: (data: SessionData) => void | boolean, opts: { coalesceKey?: string } = {}): void {
    const before = JSON.stringify(this.data);
    const result = mutator(this.data);
    if (result === false) {
      this.data = JSON.parse(before) as SessionData;
      return;
    }
    const after = JSON.stringify(this.data);
    if (after === before) return;
    const coalesce = opts.coalesceKey && opts.coalesceKey === this.lastCoalesceKey && Date.now() - this.lastCoalesceAt < 1200;
    if (!coalesce) {
      this.undoStack.push(before);
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    }
    this.lastCoalesceKey = opts.coalesceKey ?? null;
    this.lastCoalesceAt = Date.now();
    this.redoStack = [];
    this.scheduleDraft();
    this.emit();
  }

  private lastCoalesceKey: string | null = null;
  private lastCoalesceAt = 0;

  public undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(prev) as SessionData;
    this.lastCoalesceKey = null;
    this.scheduleDraft();
    this.emit();
    return true;
  }

  public redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(JSON.stringify(this.data));
    this.data = JSON.parse(next) as SessionData;
    this.lastCoalesceKey = null;
    this.scheduleDraft();
    this.emit();
    return true;
  }

  public markSaved(): void {
    this.savedJson = JSON.stringify(this.data);
    this.isNew = false;
    clearDraft(sessionKey(this.data));
    this.emit();
  }

  /** Re-key after an id change (new cutscenes) */
  public replaceData(data: SessionData): void {
    this.data = clone(data);
    this.emit();
  }

  private scheduleDraft(): void {
    if (this.draftTimer !== null) window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => {
      this.draftTimer = null;
      if (this.isDirty()) writeDraft(this.data);
      else clearDraft(sessionKey(this.data));
    }, 600);
  }

  public dispose(): void {
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
      if (this.isDirty()) writeDraft(this.data);
    }
    this.listeners.clear();
  }
}

interface StoredDraft {
  savedAt: number;
  data: SessionData;
}

export function writeDraft(data: SessionData): void {
  try {
    const payload: StoredDraft = { savedAt: Date.now(), data };
    window.localStorage.setItem(DRAFT_PREFIX + sessionKey(data), JSON.stringify(payload));
  } catch {
    // Storage full: drafts are best-effort
  }
}

export function readDraft(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // ignore
  }
}

export function listDraftKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k.slice(DRAFT_PREFIX.length));
    }
  } catch {
    // ignore
  }
  return keys;
}

export function slugifyId(text: string, fallback = 'scene'): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

export function uniqueId(base: string, taken: (id: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; i < 999; i++) {
    const candidate = `${base}_${i}`;
    if (!taken(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}
