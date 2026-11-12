/**
 * Mystery Emblem - Story Cutscene Lookup & Chapter Links (`storyCutscenes.ts`)
 *
 * Cutscene documents live in `data/cutscenes/*.json`; which chapter each one plays before or
 * after is stored in that chapter's `chapter.json` (`preStoryCutsceneId(s)` / `postStoryCutsceneId(s)`).
 */

import type { CompactChapterJson } from './chapters/chapterTypes';
import { RAW_CHAPTER_JSON_LIST } from './chapters/defaultCatalog';
import type { CutsceneDoc } from './cutscenes/cutsceneDocTypes';
import { getCutsceneDoc, listCutsceneDocs } from './cutscenes/cutsceneRegistry';

export function getStoryCutsceneById(id: string): CutsceneDoc | undefined {
  return getCutsceneDoc(id);
}

function collectChapterCutsceneSlotIds(
  ch: CompactChapterJson | undefined,
  when: 'before' | 'after'
): string[] {
  if (!ch) return [];
  const list = when === 'before' ? ch.preStoryCutsceneIds : ch.postStoryCutsceneIds;
  const single = when === 'before' ? ch.preStoryCutsceneId : ch.postStoryCutsceneId;
  const out: string[] = [];
  for (const id of list ?? []) {
    if (id && !out.includes(id)) out.push(id);
  }
  if (single && !out.includes(single)) {
    out.push(single);
  }
  return out;
}

export function getPreChapterCutsceneIds(nodeId: string): string[] {
  return collectChapterCutsceneSlotIds(
    RAW_CHAPTER_JSON_LIST.find((c) => c.nodeId === nodeId),
    'before'
  );
}

export function getPostChapterCutsceneIds(nodeId: string): string[] {
  return collectChapterCutsceneSlotIds(
    RAW_CHAPTER_JSON_LIST.find((c) => c.nodeId === nodeId),
    'after'
  );
}

export function getPreChapterCutsceneId(nodeId: string): string | undefined {
  return getPreChapterCutsceneIds(nodeId)[0];
}

export function getPostChapterCutsceneId(nodeId: string): string | undefined {
  return getPostChapterCutsceneIds(nodeId)[0];
}

export interface StoryCutsceneLink {
  chapterId: string;
  when: 'before' | 'after';
}

export function findStoryCutsceneLink(cutsceneId: string): StoryCutsceneLink | null {
  for (const ch of RAW_CHAPTER_JSON_LIST) {
    if (collectChapterCutsceneSlotIds(ch, 'before').includes(cutsceneId)) {
      return { chapterId: ch.id, when: 'before' };
    }
    if (collectChapterCutsceneSlotIds(ch, 'after').includes(cutsceneId)) {
      return { chapterId: ch.id, when: 'after' };
    }
  }
  return null;
}

/** Linked cutscenes in story order (by chapter, "before" first), then unlinked ones by title. */
export function listStoryCutscenesInPlayOrder(): CutsceneDoc[] {
  const ordered: CutsceneDoc[] = [];
  const seen = new Set<string>();
  const chapters = RAW_CHAPTER_JSON_LIST;
  for (const ch of chapters) {
    const slotIds = [
      ...collectChapterCutsceneSlotIds(ch, 'before'),
      ...collectChapterCutsceneSlotIds(ch, 'after'),
    ];
    for (const id of slotIds) {
      const doc = getCutsceneDoc(id);
      if (doc && !seen.has(doc.id)) {
        ordered.push(doc);
        seen.add(doc.id);
      }
    }
  }
  const unlinked = listCutsceneDocs()
    .filter((d) => !seen.has(d.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...ordered, ...unlinked];
}

/** Linked cutscenes only (what players can ever see). */
export function listLinkedStoryCutscenes(): CutsceneDoc[] {
  return listStoryCutscenesInPlayOrder().filter((d) => findStoryCutsceneLink(d.id));
}

export const DEMO_STORY_CUTSCENES: ReadonlyArray<CutsceneDoc> = listStoryCutscenesInPlayOrder();
