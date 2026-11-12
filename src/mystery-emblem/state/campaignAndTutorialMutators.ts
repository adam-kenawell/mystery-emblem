/**
 * Mystery Emblem - Campaign Cutscene, Recruitment & Quaquaval Field Notes Flag Mutators
 */

import type {
  SaveData,
  SeriesFamiliarityLevel,
  TutorialDetailLevel,
  TutorialFamiliarityPreferences,
} from '../types/schemas';

export const DEFAULT_TUTORIAL_PREFERENCES: Readonly<TutorialFamiliarityPreferences> = {
  pokemonFamiliarity: 'somewhat_familiar',
  fireEmblemFamiliarity: 'somewhat_familiar',
  pokemonTutorialDetail: 'brief',
  fireEmblemTutorialDetail: 'brief',
};

export function pushUniqueIdToFlagList(
  list: string[] | undefined,
  rawId: string
): { nextList: string[]; mutated: boolean } {
  const trimmed = rawId.trim();
  const base = Array.isArray(list) ? list : [];
  if (!trimmed || base.includes(trimmed)) {
    return { nextList: base, mutated: false };
  }
  base.push(trimmed);
  return { nextList: base, mutated: true };
}

export function readAreTutorialsEnabled(save: SaveData | null): boolean {
  if (!save) return false;
  if (typeof save.campaign.tutorialsEnabled === 'boolean') {
    return save.campaign.tutorialsEnabled;
  }
  const tp = save.campaign.tutorialPreferences;
  if (tp) {
    return !(tp.pokemonTutorialDetail === 'none' && tp.fireEmblemTutorialDetail === 'none');
  }
  return false;
}

export function readTutorialPreferences(save: SaveData | null): TutorialFamiliarityPreferences {
  const tp = save?.campaign.tutorialPreferences;
  return tp ? { ...tp } : { ...DEFAULT_TUTORIAL_PREFERENCES };
}

export function mutateTutorialDetailLevel(
  save: SaveData,
  subject: 'pokemon' | 'fire_emblem',
  detail: TutorialDetailLevel
): void {
  const familiarityByDetail: Record<TutorialDetailLevel, SeriesFamiliarityLevel> = {
    none: 'very_familiar',
    brief: 'somewhat_familiar',
    detailed: 'beginner',
  };
  const current = readTutorialPreferences(save);
  if (subject === 'pokemon') {
    current.pokemonTutorialDetail = detail;
    current.pokemonFamiliarity = familiarityByDetail[detail];
  } else {
    current.fireEmblemTutorialDetail = detail;
    current.fireEmblemFamiliarity = familiarityByDetail[detail];
  }
  save.campaign.tutorialPreferences = current;
}

export function readUnlockedTutorialIds(save: SaveData | null): string[] {
  if (!save) return [];
  const combined = new Set<string>([
    ...(save.campaign.unlockedTutorialIds ?? []),
    ...(save.campaign.seenTutorialIds ?? []),
  ]);
  return [...combined];
}

export function mutateMarkTutorialSeen(save: SaveData, topicId: string): boolean {
  const trimmed = topicId.trim();
  if (!trimmed) return false;
  if (!Array.isArray(save.campaign.unlockedTutorialIds)) {
    save.campaign.unlockedTutorialIds = [];
  }
  if (!Array.isArray(save.campaign.seenTutorialIds)) {
    save.campaign.seenTutorialIds = [];
  }
  let mutated = false;
  if (!save.campaign.unlockedTutorialIds.includes(trimmed)) {
    save.campaign.unlockedTutorialIds.push(trimmed);
    mutated = true;
  }
  if (!save.campaign.seenTutorialIds.includes(trimmed)) {
    save.campaign.seenTutorialIds.push(trimmed);
    mutated = true;
  }
  return mutated;
}
