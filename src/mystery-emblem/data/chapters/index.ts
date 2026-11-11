/**
 * Self-Contained Campaign Chapter Manifest (`chapters/index.ts`)
 *
 * Unifies map hydration, custom Map Editor overrides, recruitment resolvers,
 * declarative map events, and per-chapter Intro/Outro/Event scripts without monolithic files.
 */

import type { DialogueScript } from '../../ui/DialogueOverlay';
import type { DungeonMapDefinition, SaveData } from '../../types/schemas';
import { getSpeciesById } from '../index';
import { getDialogueDoc, listDialogueDocs } from '../cutscenes/cutsceneRegistry';
import { compileDialogueDoc } from '../cutscenes/dialogueCompiler';
import { getEffectiveChapterMap, hasChapterMapOverride } from '../mapOverrideStore';
import { cloneDungeonMap } from './chapterCodec';
import {
  CHAPTER_LEVEL_CATALOG,
  getChapterCatalogEntry,
  getDefaultChapterMap,
  RAW_CHAPTER_JSON_LIST,
  refreshDefaultChapterMap,
  validateDungeonMapDefinition,
} from './defaultCatalog';
import type {
  CampaignChapterConfig,
  ChapterRecruitmentSpec,
  CompactChapterJson,
} from './chapterTypes';

export * from './chapterTypes';
export {
  CHAPTER_LEVEL_CATALOG,
  getChapterCatalogEntry,
  getDefaultChapterMap,
  validateDungeonMapDefinition,
};

function buildChapterDialogue(
  chapterId: string,
  dialogueId: string,
  save: SaveData | null
): DialogueScript {
  const doc = getDialogueDoc(chapterId, dialogueId);
  return doc ? compileDialogueDoc(doc, save) : { id: `${chapterId}_${dialogueId}`, lines: [] };
}

/** Event dialogue lookup built fresh each time so editor-created dialogues work immediately. */
function buildChapterEventScripts(
  chapterId: string
): Record<string, (save: SaveData | null) => DialogueScript> {
  const out: Record<string, (save: SaveData | null) => DialogueScript> = {};
  for (const doc of listDialogueDocs(chapterId)) {
    if (doc.role !== 'event') continue;
    out[doc.id] = (save) => buildChapterDialogue(chapterId, doc.id, save);
  }
  return out;
}

export function resolveChapterRecruitmentSpeciesIds(
  spec: ChapterRecruitmentSpec,
  save: SaveData | null
): string[] {
  const result: string[] = [];
  const seeded = spec.seedKey ? save?.campaign.quizSeeds?.[spec.seedKey] : undefined;
  const baseList =
    Array.isArray(seeded) && seeded.length > 0 ? seeded : spec.fallbackSpeciesIds;

  for (const id of baseList) {
    if (getSpeciesById(id) && !result.includes(id)) result.push(id);
  }
  if (spec.fixedSpeciesIds) {
    for (const id of spec.fixedSpeciesIds) {
      if (getSpeciesById(id) && !result.includes(id)) result.push(id);
    }
  }
  return result;
}

function buildEffectiveMapForChapter(raw: CompactChapterJson): DungeonMapDefinition {
  const base = cloneDungeonMap(getEffectiveChapterMap(raw.id));
  if (!hasChapterMapOverride(raw.id)) {
    base.name = raw.title;
    base.deploymentCap = raw.deploymentCap;
    base.objectiveType = raw.objectiveType;
    base.objectiveLabel = raw.objectiveLabel;
  }
  return base;
}

function hydrateChapterConfig(raw: CompactChapterJson): CampaignChapterConfig {
  const chapterId = raw.id;
  const config: CampaignChapterConfig = {
    nodeId: raw.nodeId,
    levelId: raw.id,
    dungeonNumber: raw.dungeonNumber,
    title: raw.title,
    subtitle: raw.subtitle,
    objectiveType: raw.objectiveType,
    objectiveLabel: raw.objectiveLabel,
    ...(raw.surviveTurns !== undefined ? { surviveTurns: raw.surviveTurns } : {}),
    ...(raw.defeatIfUnitIdsFall ? { defeatIfUnitIdsFall: raw.defeatIfUnitIdsFall } : {}),
    recommendedLevel: raw.recommendedLevel,
    deploymentCap: raw.deploymentCap,
    ...(raw.skipPrepPhase ? { skipPrepPhase: true } : {}),
    ...(raw.isDemoFinale ? { isDemoFinale: true } : {}),
    ...(raw.preStoryCutsceneId ? { preStoryCutsceneId: raw.preStoryCutsceneId } : {}),
    ...(raw.postStoryCutsceneId ? { postStoryCutsceneId: raw.postStoryCutsceneId } : {}),
    enemySpawns: raw.enemySpawns,
    ...(raw.npcSpawns?.length ? { npcSpawns: raw.npcSpawns } : {}),
    reinforcements: raw.reinforcements,
    ...(raw.events?.length ? { events: raw.events } : {}),
    ...(raw.recruitment ? { recruitment: raw.recruitment } : {}),
    ...(raw.clearRewardItems ? { clearRewardItems: raw.clearRewardItems } : {}),
    ...(raw.guaranteesKecleonShopOnClear
      ? { guaranteesKecleonShopOnClear: raw.guaranteesKecleonShopOnClear }
      : {}),
    buildMap: () => buildEffectiveMapForChapter(raw),
    buildIntroScript: (save) => buildChapterDialogue(chapterId, 'intro', save),
    buildOutroScript: (save) => buildChapterDialogue(chapterId, 'outro', save),
  };
  Object.defineProperty(config, 'eventScripts', {
    enumerable: true,
    get: () => buildChapterEventScripts(chapterId),
  });
  return config;
}

export const CAMPAIGN_CHAPTERS: ReadonlyArray<CampaignChapterConfig> =
  RAW_CHAPTER_JSON_LIST.map(hydrateChapterConfig);

/**
 * Applies an edited `chapter.json` (written by a Dev Tools editor) to the running game:
 * refreshes the raw manifest, the default map cache, and the hydrated chapter config.
 */
export function applyEditedChapterJson(next: CompactChapterJson): void {
  const raw = RAW_CHAPTER_JSON_LIST.find((c) => c.id === next.id) as
    | (CompactChapterJson & Record<string, unknown>)
    | undefined;
  if (!raw) return;
  for (const key of Object.keys(raw)) delete raw[key];
  Object.assign(raw, JSON.parse(JSON.stringify(next)));
  refreshDefaultChapterMap(raw);
  const idx = CAMPAIGN_CHAPTERS.findIndex((c) => c.levelId === next.id);
  const existing = CAMPAIGN_CHAPTERS[idx];
  if (!existing) return;
  const fresh = hydrateChapterConfig(raw);
  const target = existing as unknown as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    if (key !== 'eventScripts') delete target[key];
  }
  for (const [key, value] of Object.entries(Object.getOwnPropertyDescriptors(fresh))) {
    if (key === 'eventScripts') continue;
    Object.defineProperty(target, key, value);
  }
}

export function getRawChapterJson(chapterId: string): CompactChapterJson | undefined {
  return RAW_CHAPTER_JSON_LIST.find((c) => c.id === chapterId);
}

/** Backward-compatible alias */
export const DEMO_CAMPAIGN_CHAPTERS = CAMPAIGN_CHAPTERS;

export const CHAPTER_BY_NODE_ID: Readonly<Record<string, CampaignChapterConfig>> =
  Object.fromEntries(CAMPAIGN_CHAPTERS.map((ch) => [ch.nodeId, ch]));

export const DEMO_CHAPTER_BY_NODE_ID = CHAPTER_BY_NODE_ID;

export function getChapterByNodeId(nodeId: string): CampaignChapterConfig | undefined {
  return CHAPTER_BY_NODE_ID[nodeId];
}

export const getDemoChapterByNodeId = getChapterByNodeId;
