/**
 * Default Chapter Catalog & Hydrated Map Lookup (`defaultCatalog.ts`)
 */

import prologueRaw from './prologue/chapter.json';
import chapter01Raw from './chapter_01/chapter.json';
import chapter02Raw from './chapter_02/chapter.json';
import chapter03Raw from './chapter_03/chapter.json';
import paralogue01Raw from './paralogue_01/chapter.json';
import chapter04Raw from './chapter_04/chapter.json';
import type { DungeonMapDefinition } from '../../types/schemas';
import { cloneDungeonMap, hydrateChapterDefaultMap } from './chapterCodec';
import { validateDungeonMapDefinition as validateMapWithDefaults } from './mapValidator';
import type { ChapterLevelCatalogEntry, CompactChapterJson } from './chapterTypes';

export const RAW_CHAPTER_JSON_LIST: ReadonlyArray<CompactChapterJson> = [
  prologueRaw as unknown as CompactChapterJson,
  chapter01Raw as unknown as CompactChapterJson,
  chapter02Raw as unknown as CompactChapterJson,
  chapter03Raw as unknown as CompactChapterJson,
  paralogue01Raw as unknown as CompactChapterJson,
  chapter04Raw as unknown as CompactChapterJson,
];

export const CHAPTER_LEVEL_CATALOG: ReadonlyArray<ChapterLevelCatalogEntry> =
  RAW_CHAPTER_JSON_LIST.map((ch) => ({
    id: ch.id,
    shortCode: ch.shortCode,
    label: ch.label,
    biomeName: ch.title,
    primaryTilesetId: ch.defaultTilesetId,
    bgmCue: ch.bgmCue,
    defaultDeploymentCap: ch.deploymentCap,
  }));

const catalogById = new Map<string, ChapterLevelCatalogEntry>(
  CHAPTER_LEVEL_CATALOG.map((entry) => [entry.id, entry])
);

const defaultMapById = new Map<string, DungeonMapDefinition>(
  RAW_CHAPTER_JSON_LIST.map((ch) => [ch.id, hydrateChapterDefaultMap(ch)])
);

export function getChapterCatalogEntry(levelId: string): ChapterLevelCatalogEntry | undefined {
  return catalogById.get(levelId);
}

export function getDefaultChapterMap(levelId: string): DungeonMapDefinition {
  const base = defaultMapById.get(levelId) ?? defaultMapById.get('prologue')!;
  return cloneDungeonMap(base);
}

/** Rebuilds the cached default map after a chapter's JSON was edited in Dev Tools. */
export function refreshDefaultChapterMap(raw: CompactChapterJson): void {
  defaultMapById.set(raw.id, hydrateChapterDefaultMap(raw));
}

export function validateDungeonMapDefinition(
  candidate: unknown,
  expectedLevelId?: string
): { valid: boolean; errors: string[]; map?: DungeonMapDefinition } {
  const resolvedId =
    expectedLevelId ??
    (candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as { id?: unknown }).id === 'string'
      ? (candidate as { id: string }).id.trim()
      : undefined);
  const meta = resolvedId ? getChapterCatalogEntry(resolvedId) : undefined;
  return validateMapWithDefaults(candidate, expectedLevelId, meta);
}
