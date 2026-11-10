/**
 * Mystery Emblem — Tutorial Registry Barrel (`tutorialRegistry.ts`)
 *
 * Re-exports sharded tutorial topics, types, and declarative trigger rules.
 */

import { EARLY_CHAPTER_TUTORIAL_TOPICS } from './tutorials/earlyChapterTopics';
import { MECHANICS_AND_TERRAIN_TOPICS } from './tutorials/mechanicsAndTerrainTopics';
import { PROLOGUE_DRILL_TUTORIAL_TOPICS } from './tutorials/prologueDrillTopics';
import type { TutorialTopicDefinition } from './tutorials/tutorialTypes';

export * from './tutorials/tutorialTypes';
export * from './tutorials/tutorialTriggers';
export * from './tutorials/prologueDrillTopics';

export const TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  ...EARLY_CHAPTER_TUTORIAL_TOPICS,
  ...PROLOGUE_DRILL_TUTORIAL_TOPICS,
  ...MECHANICS_AND_TERRAIN_TOPICS,
];

export const TUTORIAL_TOPIC_MAP: ReadonlyMap<string, TutorialTopicDefinition> = new Map(
  TUTORIAL_TOPICS.map((topic) => [topic.id, topic])
);

export function getTutorialTopicById(topicId: string): TutorialTopicDefinition | undefined {
  return TUTORIAL_TOPIC_MAP.get(topicId);
}
