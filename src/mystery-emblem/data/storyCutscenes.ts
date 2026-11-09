/**
 * Mystery Emblem — Sharded Out-of-Dungeon Story Cutscene Registry (`storyCutscenes.ts`)
 *
 * Aggregates per-chapter choreographed PMD sprite-stage cutscenes from `data/chapters/*`
 * and derives node -> pre/post cutscene lookup maps directly from self-contained chapter JSONs.
 */

import type { StoryCutsceneDefinition } from '../scenes/cutscene/cutsceneTypes';
import { CS_03_BLUFF_CAMPFIRE } from './chapters/chapter_01/cutscene';
import { CS_04_WATCHTOWER_BELLS } from './chapters/chapter_02/cutscene';
import { CS_05_SANCTUARY_WAR_ROOM } from './chapters/chapter_03/cutscene';
import { CS_06_ORCHARD_CELEBRATION } from './chapters/chapter_04/cutscene';
import { RAW_CHAPTER_JSON_LIST } from './chapters/defaultCatalog';
import { CS_02_SANCTUARY_REVEAL } from './chapters/prologue/postCutscene';
import { CS_01_COASTAL_FRIENDS } from './chapters/prologue/preCutscene';

export const STORY_CUTSCENES: ReadonlyArray<StoryCutsceneDefinition> = [
  CS_01_COASTAL_FRIENDS,
  CS_02_SANCTUARY_REVEAL,
  CS_03_BLUFF_CAMPFIRE,
  CS_04_WATCHTOWER_BELLS,
  CS_05_SANCTUARY_WAR_ROOM,
  CS_06_ORCHARD_CELEBRATION,
];

/** Backward-compatible alias */
export const DEMO_STORY_CUTSCENES = STORY_CUTSCENES;

export const STORY_CUTSCENE_BY_ID: Readonly<Record<string, StoryCutsceneDefinition>> =
  Object.fromEntries(STORY_CUTSCENES.map((c) => [c.id, c]));

export const PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID: Readonly<Record<string, string>> =
  Object.fromEntries(
    RAW_CHAPTER_JSON_LIST.filter((ch) => Boolean(ch.preStoryCutsceneId)).map((ch) => [
      ch.nodeId,
      ch.preStoryCutsceneId!,
    ])
  );

export const POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID: Readonly<Record<string, string>> =
  Object.fromEntries(
    RAW_CHAPTER_JSON_LIST.filter((ch) => Boolean(ch.postStoryCutsceneId)).map((ch) => [
      ch.nodeId,
      ch.postStoryCutsceneId!,
    ])
  );

export function getStoryCutsceneById(id: string): StoryCutsceneDefinition | undefined {
  return STORY_CUTSCENE_BY_ID[id];
}
