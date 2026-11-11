/**
 * Cutscene, Location & Battle Dialogue Registry (`cutsceneRegistry.ts`)
 *
 * Auto-discovers every editor-authored JSON document (no code changes needed for new files)
 * and keeps a mutable in-memory copy so the Dev Tools editor can update the running game
 * right after saving, without a page reload.
 */

import type { CutsceneDoc, DialogueDoc, LocationDoc } from './cutsceneDocTypes';

const storyModules = import.meta.glob<CutsceneDoc>('./*.json', { eager: true, import: 'default' });
const locationModules = import.meta.glob<LocationDoc>('./locations/*.json', {
  eager: true,
  import: 'default',
});
const dialogueModules = import.meta.glob<DialogueDoc>('../chapters/*/dialogue/*.json', {
  eager: true,
  import: 'default',
});

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const cutscenes = new Map<string, CutsceneDoc>();
const locations = new Map<string, LocationDoc>();
const dialogues = new Map<string, DialogueDoc>();

for (const doc of Object.values(storyModules)) cutscenes.set(doc.id, clone(doc));
for (const doc of Object.values(locationModules)) locations.set(doc.id, clone(doc));
for (const doc of Object.values(dialogueModules)) dialogues.set(dialogueKey(doc.chapter, doc.id), clone(doc));

type RegistryListener = () => void;
const listeners = new Set<RegistryListener>();
const emit = () => {
  for (const fn of listeners) fn();
};

export function dialogueKey(chapterId: string, dialogueId: string): string {
  return `${chapterId}/${dialogueId}`;
}

export function subscribeCutsceneRegistry(fn: RegistryListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCutsceneDoc(id: string): CutsceneDoc | undefined {
  return cutscenes.get(id);
}
export function listCutsceneDocs(): CutsceneDoc[] {
  return [...cutscenes.values()];
}
export function upsertCutsceneDoc(doc: CutsceneDoc): void {
  cutscenes.set(doc.id, clone(doc));
  emit();
}
export function removeCutsceneDoc(id: string): void {
  if (cutscenes.delete(id)) emit();
}

export function getLocationDoc(id: string): LocationDoc | undefined {
  return locations.get(id);
}
export function listLocationDocs(): LocationDoc[] {
  return [...locations.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function upsertLocationDoc(doc: LocationDoc): void {
  locations.set(doc.id, clone(doc));
  emit();
}
export function removeLocationDoc(id: string): void {
  if (locations.delete(id)) emit();
}

export function getDialogueDoc(chapterId: string, dialogueId: string): DialogueDoc | undefined {
  return dialogues.get(dialogueKey(chapterId, dialogueId));
}
export function listDialogueDocs(chapterId?: string): DialogueDoc[] {
  const all = [...dialogues.values()];
  return chapterId ? all.filter((d) => d.chapter === chapterId) : all;
}
export function upsertDialogueDoc(doc: DialogueDoc): void {
  dialogues.set(dialogueKey(doc.chapter, doc.id), clone(doc));
  emit();
}
export function removeDialogueDoc(chapterId: string, dialogueId: string): void {
  if (dialogues.delete(dialogueKey(chapterId, dialogueId))) emit();
}

/** Every location id referenced by a cutscene (start + mid-scene location changes). */
export function collectCutsceneLocationIds(doc: CutsceneDoc): string[] {
  const ids = new Set<string>([doc.location]);
  for (const beat of doc.beats) {
    for (const a of beat.actions ?? []) if (a.type === 'location') ids.add(a.location);
  }
  return [...ids];
}

export function listCutscenesUsingLocation(locationId: string): CutsceneDoc[] {
  return listCutsceneDocs().filter((d) => collectCutsceneLocationIds(d).includes(locationId));
}

export const CUTSCENE_DOC_FOLDER = 'src/mystery-emblem/data/cutscenes';
export const LOCATION_DOC_FOLDER = 'src/mystery-emblem/data/cutscenes/locations';
export const chapterDialogueFolder = (chapterId: string): string =>
  `src/mystery-emblem/data/chapters/${chapterId}/dialogue`;
