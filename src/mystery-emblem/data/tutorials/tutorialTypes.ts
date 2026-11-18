/**
 * Mystery Emblem - Quaquaval's Field Notes Tutorial & Trigger Schema Types (`tutorialTypes.ts`)
 */

import type { PmdPortraitEmotion } from '../../assets/pmdAssetLoader';
import type { DungeonMapDefinition, PokemonType, SaveData } from '../../types/schemas';

export type TutorialCompendiumCategory =
  | 'controls_fusion'
  | 'combat_tactics'
  | 'prep_pokemon'
  | 'world_progression';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCompendiumCategory, string>> = {
  controls_fusion: 'Footwork & Turn Basics',
  combat_tactics: 'Combat, Ranges & Terrain',
  prep_pokemon: 'Battle Prep, Moves & Items',
  world_progression: 'World Map, Evolutions & Shops',
};

export const TUTORIAL_CATEGORY_ORDER: ReadonlyArray<TutorialCompendiumCategory> = [
  'controls_fusion',
  'combat_tactics',
  'prep_pokemon',
  'world_progression',
];

export interface TutorialVisualChip {
  kind: 'badge' | 'type' | 'item' | 'species';
  label?: string;
  pokemonType?: PokemonType;
  itemId?: string;
  speciesId?: string;
  tone?: 'gold' | 'green' | 'cyan' | 'danger';
}

export interface AdvisorTutorialBeat {
  id: string;
  emotion: PmdPortraitEmotion;
  /** Supports `{lord}`, `{partner}`, `{healer}`, `{mentor}`, `{advisor}` custom nickname interpolation */
  dialogue: string;
}

/** Who voices the coach card: Quaquaval advisor (default) or live sparring mentor. */
export type TutorialPresenter = 'advisor' | 'mentor';

export interface TutorialTopicDefinition {
  id: string;
  title: string;
  category: TutorialCompendiumCategory;
  summary: string;
  chips?: ReadonlyArray<TutorialVisualChip>;
  bullets?: ReadonlyArray<string>;
  beats: ReadonlyArray<AdvisorTutorialBeat>;
}

export type TutorialTriggerHook = 'battle_prep' | 'battle_turn1';

export interface TutorialTriggerContext {
  hook: TutorialTriggerHook;
  levelId: string;
  map: DungeonMapDefinition;
  save: SaveData | null;
  deploymentCap?: number;
}

export interface TutorialTriggerRule {
  id: string;
  hook: TutorialTriggerHook;
  topicId: string;
  levelIds?: ReadonlyArray<string>;
  excludeLevelIds?: ReadonlyArray<string>;
  when?: (ctx: TutorialTriggerContext) => boolean;
}
