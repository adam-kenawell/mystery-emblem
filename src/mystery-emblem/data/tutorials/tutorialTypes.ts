/**
 * Mystery Emblem — Wimpod Advisor Tutorial & Trigger Schema Types (`tutorialTypes.ts`)
 */

import type { PmdPortraitEmotion } from '../../assets/pmdAssetLoader';
import type { DungeonMapDefinition, PokemonType, SaveData } from '../../types/schemas';

export type TutorialCompendiumCategory =
  | 'controls_fusion'
  | 'combat_tactics'
  | 'prep_pokemon'
  | 'world_progression';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCompendiumCategory, string>> = {
  controls_fusion: 'Survival Basics & Controls',
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

export type TutorialActionTriggerId =
  | 'battle_open_field_menu'
  | 'battle_toggle_danger_area'
  | 'battle_select_lord'
  | 'battle_move_to_blue_tile'
  | 'battle_confirm_wait'
  | 'battle_open_attack_forecast'
  | 'battle_confirm_attack'
  | 'battle_inspect_heal_or_item'
  | 'battle_select_healer'
  | 'battle_open_heal_forecast'
  | 'battle_confirm_heal'
  | 'overworld_open_menu'
  | 'prep_open_manage_units'
  | 'prep_close_manage_units'
  | 'prep_open_view_map'
  | 'prep_swap_or_finish_view_map';

export type TutorialBattleTileFilter =
  | 'empty_floor'
  | 'lord_unit'
  | 'healer_unit'
  | 'reachable_move'
  | 'attackable_enemy'
  | 'wounded_or_healer'
  | 'prep_swap_slots';

export type TutorialSpotlightTarget =
  | { kind: 'none' }
  | {
      kind: 'dom';
      selector: string;
      preferredDock?: 'top' | 'bottom';
    }
  | {
      kind: 'battle_tiles';
      tileFilter: TutorialBattleTileFilter;
      fallbackDomSelector?: string;
    };

export interface TutorialVisualChip {
  kind: 'badge' | 'type' | 'item' | 'species';
  label?: string;
  pokemonType?: PokemonType;
  itemId?: string;
  speciesId?: string;
  tone?: 'gold' | 'green' | 'cyan' | 'danger';
}

export interface WimpodTutorialBeat {
  id: string;
  emotion: PmdPortraitEmotion;
  /** Supports `{lord}`, `{partner}`, `{healer}`, `{advisor}` custom nickname interpolation */
  dialogue: string;
  /** Concise prompt displayed in Wimpod's action pill during hands-on steps */
  actionHint?: string;
  /** When set during live play, Wimpod's coach bar stays non-blocking and awaits this action */
  awaitAction?: TutorialActionTriggerId;
  spotlight?: TutorialSpotlightTarget;
  chips?: ReadonlyArray<TutorialVisualChip>;
  /** Alternate line when Sir Empoleon presents this beat (Prologue fight); falls back to `dialogue` */
  mentorDialogue?: string;
  /** Alternate portrait emotion when Sir Empoleon presents this beat; falls back to `emotion` */
  mentorEmotion?: PmdPortraitEmotion;
}

/** Who voices the coach card: Wimpod/Golisopod advisor (default) or Sir Empoleon (Prologue fight). */
export type TutorialPresenter = 'advisor' | 'mentor';

export interface TutorialTopicDefinition {
  id: string;
  title: string;
  category: TutorialCompendiumCategory;
  summary: string;
  beats: ReadonlyArray<WimpodTutorialBeat>;
}

export type TutorialTriggerHook = 'battle_prep' | 'battle_turn1';

export interface TutorialTriggerContext {
  hook: TutorialTriggerHook;
  levelId: string;
  map: DungeonMapDefinition;
  save: SaveData | null;
  deploymentCap?: number;
  anyUnitCanPromoteNow?: boolean;
}

export interface TutorialTriggerRule {
  id: string;
  hook: TutorialTriggerHook;
  topicId: string;
  levelIds?: ReadonlyArray<string>;
  excludeLevelIds?: ReadonlyArray<string>;
  when?: (ctx: TutorialTriggerContext) => boolean;
}
