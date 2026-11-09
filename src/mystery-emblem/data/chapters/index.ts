/**
 * Self-Contained Campaign Chapter Manifest (`chapters/index.ts`)
 *
 * Unifies map hydration, custom Map Editor overrides, recruitment resolvers,
 * declarative map events, and per-chapter Intro/Outro/Event scripts without monolithic files.
 */

import type { DialogueScript } from '../../ui/DialogueOverlay';
import type { DungeonMapDefinition, SaveData } from '../../types/schemas';
import { getSpeciesById } from '../index';
import { getEffectiveChapterMap, hasChapterMapOverride } from '../mapOverrideStore';
import { cloneDungeonMap } from './chapterCodec';
import {
  buildChapter01BirdBugTruceScript,
  buildChapter01IntroScript,
  buildChapter01OutroScript,
} from './chapter_01/scripts';
import {
  buildChapter02IntroScript,
  buildChapter02OutroScript,
  buildChapter02TalkPsychicScript,
} from './chapter_02/scripts';
import {
  buildChapter03IntroScript,
  buildChapter03OutroScript,
} from './chapter_03/scripts';
import {
  buildChapter04IntroScript,
  buildChapter04OutroScript,
} from './chapter_04/scripts';
import {
  buildChapter05IntroScript,
  buildChapter05OutroScript,
} from './chapter_05/scripts';
import {
  buildChapter06IntroScript,
  buildChapter06OutroScript,
} from './chapter_06/scripts';
import {
  CHAPTER_LEVEL_CATALOG,
  getChapterCatalogEntry,
  getDefaultChapterMap,
  RAW_CHAPTER_JSON_LIST,
  validateDungeonMapDefinition,
} from './defaultCatalog';
import {
  buildParalogue01IntroScript,
  buildParalogue01OutroScript,
  buildParalogue01TalkSlakothScript,
} from './paralogue_01/scripts';
import {
  buildParalogue02IntroScript,
  buildParalogue02OutroScript,
} from './paralogue_02/scripts';
import {
  buildPrologueAmbushScript,
  buildPrologueIntroScript,
  buildPrologueOutroScript,
} from './prologue/scripts';
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

interface ChapterScriptSet {
  buildIntroScript: (save: SaveData | null) => DialogueScript;
  buildOutroScript: (save: SaveData | null) => DialogueScript;
  eventScripts?: Readonly<Record<string, (save: SaveData | null) => DialogueScript>>;
}

const SCRIPTS_BY_ID: Readonly<Record<string, ChapterScriptSet>> = {
  prologue: {
    buildIntroScript: () => buildPrologueIntroScript(),
    buildOutroScript: () => buildPrologueOutroScript(),
    eventScripts: {
      prologue_ambush_dialogue: buildPrologueAmbushScript,
    },
  },
  chapter_01: {
    buildIntroScript: buildChapter01IntroScript,
    buildOutroScript: () => buildChapter01OutroScript(),
    eventScripts: {
      ch1_bird_bug_truce_dialogue: buildChapter01BirdBugTruceScript,
    },
  },
  chapter_02: {
    buildIntroScript: buildChapter02IntroScript,
    buildOutroScript: buildChapter02OutroScript,
    eventScripts: {
      ch2_talk_psychic_dialogue: buildChapter02TalkPsychicScript,
    },
  },
  chapter_03: {
    buildIntroScript: () => buildChapter03IntroScript(),
    buildOutroScript: () => buildChapter03OutroScript(),
  },
  paralogue_01: {
    buildIntroScript: buildParalogue01IntroScript,
    buildOutroScript: buildParalogue01OutroScript,
    eventScripts: {
      p1_talk_slakoth_dialogue: buildParalogue01TalkSlakothScript,
    },
  },
  chapter_04: {
    buildIntroScript: buildChapter04IntroScript,
    buildOutroScript: () => buildChapter04OutroScript(),
  },
  paralogue_02: {
    buildIntroScript: () => buildParalogue02IntroScript(),
    buildOutroScript: () => buildParalogue02OutroScript(),
  },
  chapter_05: {
    buildIntroScript: buildChapter05IntroScript,
    buildOutroScript: buildChapter05OutroScript,
  },
  chapter_06: {
    buildIntroScript: () => buildChapter06IntroScript(),
    buildOutroScript: () => buildChapter06OutroScript(),
  },
};

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
  const scripts = SCRIPTS_BY_ID[raw.id] ?? SCRIPTS_BY_ID.prologue!;
  return {
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
    ...(scripts.eventScripts ? { eventScripts: scripts.eventScripts } : {}),
    ...(raw.recruitment ? { recruitment: raw.recruitment } : {}),
    ...(raw.clearRewardItems ? { clearRewardItems: raw.clearRewardItems } : {}),
    ...(raw.guaranteesKecleonShopOnClear
      ? { guaranteesKecleonShopOnClear: raw.guaranteesKecleonShopOnClear }
      : {}),
    buildMap: () => buildEffectiveMapForChapter(raw),
    buildIntroScript: scripts.buildIntroScript,
    buildOutroScript: scripts.buildOutroScript,
  };
}

export const CAMPAIGN_CHAPTERS: ReadonlyArray<CampaignChapterConfig> =
  RAW_CHAPTER_JSON_LIST.map(hydrateChapterConfig);

/** Backward-compatible alias */
export const DEMO_CAMPAIGN_CHAPTERS = CAMPAIGN_CHAPTERS;

export const CHAPTER_BY_NODE_ID: Readonly<Record<string, CampaignChapterConfig>> =
  Object.fromEntries(CAMPAIGN_CHAPTERS.map((ch) => [ch.nodeId, ch]));

export const DEMO_CHAPTER_BY_NODE_ID = CHAPTER_BY_NODE_ID;

export function getChapterByNodeId(nodeId: string): CampaignChapterConfig | undefined {
  return CHAPTER_BY_NODE_ID[nodeId];
}

export const getDemoChapterByNodeId = getChapterByNodeId;
