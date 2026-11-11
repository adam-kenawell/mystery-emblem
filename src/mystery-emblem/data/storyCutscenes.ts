/**
 * Mystery Emblem — Story Cutscene Lookup & Chapter Links (`storyCutscenes.ts`)
 *
 * Cutscene documents live in `data/cutscenes/*.json`; which chapter each one plays before or
 * after is stored in that chapter's `chapter.json` (`preStoryCutsceneId` / `postStoryCutsceneId`).
 */

import { RAW_CHAPTER_JSON_LIST } from './chapters/defaultCatalog';
import type { CutsceneDoc } from './cutscenes/cutsceneDocTypes';
import { getCutsceneDoc, listCutsceneDocs } from './cutscenes/cutsceneRegistry';

export function getStoryCutsceneById(id: string): CutsceneDoc | undefined {
  return getCutsceneDoc(id);
}

export function getPreChapterCutsceneId(nodeId: string): string | undefined {
  return RAW_CHAPTER_JSON_LIST.find((c) => c.nodeId === nodeId)?.preStoryCutsceneId;
}

export function getPostChapterCutsceneId(nodeId: string): string | undefined {
  return RAW_CHAPTER_JSON_LIST.find((c) => c.nodeId === nodeId)?.postStoryCutsceneId;
}

export interface StoryCutsceneLink {
  chapterId: string;
  when: 'before' | 'after';
}

export function findStoryCutsceneLink(cutsceneId: string): StoryCutsceneLink | null {
  for (const ch of RAW_CHAPTER_JSON_LIST) {
    if (ch.preStoryCutsceneId === cutsceneId) return { chapterId: ch.id, when: 'before' };
    if (ch.postStoryCutsceneId === cutsceneId) return { chapterId: ch.id, when: 'after' };
  }
  return null;
}

/** Linked cutscenes in story order (by chapter, "before" first), then unlinked ones by title. */
export function listStoryCutscenesInPlayOrder(): CutsceneDoc[] {
  const ordered: CutsceneDoc[] = [];
  const seen = new Set<string>();
  const chapters = RAW_CHAPTER_JSON_LIST;
  for (const ch of chapters) {
    for (const id of [ch.preStoryCutsceneId, ch.postStoryCutsceneId]) {
      const doc = id ? getCutsceneDoc(id) : undefined;
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
