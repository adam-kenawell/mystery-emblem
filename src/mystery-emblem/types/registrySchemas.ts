/**
 * Core Registry Schemas for Mystery Emblem (`personal_skills`, `moves`, `items`, `species`)
 *
 * Strictly adheres to:
 * - Rule 1: 100% Data-Driven Manual Balance (Zero Automated Stat Formulas)
 * - Rule 4: Single-Equipped Enemy Phase & Zero Pure Stat-Changing Moves
 * - Rule 5: Strict Faction Separation (`playable` | `enemy` | `convertible` | `ally_npc`)
 */

export const POKEMON_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export const TRAVERSAL_CLASSES = ['Grounded', 'Flying', 'Levitate'] as const;
export type TraversalClass = (typeof TRAVERSAL_CLASSES)[number];

export const STATUS_CONDITIONS = ['PAR', 'PSN', 'BRN', 'FRZ', 'SLP'] as const;
export type StatusCondition = (typeof STATUS_CONDITIONS)[number];

export type StatKeySix = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatKeySeven = StatKeySix | 'mov';

export interface StatBlockSix {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface StatBlockSeven extends StatBlockSix {
  mov: number;
}

export type TempStatModifiers = Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;

export type PersonalSkillTrigger =
  | 'passive_growth'
  | 'passive_traversal'
  | 'aura_2_tiles'
  | 'low_hp_type_boost'
  | 'phase_start_debuff'
  | 'status_atk_boost'
  | 'survive_lethal_full_hp'
  | 'stance_change'
  | 'fallen_ally_scaling'
  | 'combat_stat_mod'
  | 'phase_start_heal'
  | 'secondary_chance_double'
  | 'status_cure_phase_end'
  | 'terrain_bonus'
  | 'on_ko_boost'
  | 'resist_types'
  | 'type_immunity_absorb'
  | 'not_very_effective_boost';

export interface PersonalSkillDefinition {
  id: string;
  name: string;
  description: string;
  trigger: PersonalSkillTrigger;
  params?: Record<string, string | number | boolean | string[]>;
}

export const MOVE_CATEGORIES = ['Physical', 'Special', 'Support/Heal'] as const;
export type MoveCategory = (typeof MOVE_CATEGORIES)[number];

export const SUPPORT_SUBKINDS = ['heal', 'status', 'shield', 'self_heal', 'dance'] as const;
export type SupportMoveSubkind = (typeof SUPPORT_SUBKINDS)[number];
export type MoveTargetType = 'enemy' | 'ally' | 'self' | 'self_or_ally';

export interface MoveSecondaryEffect {
  chance: number;
  status?: StatusCondition;
  statTarget?: 'self' | 'defender';
  statChanges?: TempStatModifiers;
  durationTurns?: number;
}

export interface MoveDefinition {
  id: string;
  name: string;
  type: PokemonType;
  category: MoveCategory;
  range: [number, number];
  targetType: MoveTargetType;
  mt: number;
  hit: number;
  crit: number;
  pp: number;
  description: string;
  supportSubkind?: SupportMoveSubkind;
  supportPayload?: {
    healAmount?: number;
    healPercentMaxHp?: number;
    cureStatus?: boolean;
    /** Heal lands at the start of the target's next phase instead of immediately (Wish). */
    delayedHeal?: boolean;
    inflictStatus?: StatusCondition;
    shieldDamageReduction?: number;
    /** Shield only reduces damage of this category; absent = all damage. */
    shieldCategory?: 'Physical' | 'Special';
    durationTurns?: number;
    refreshAllyTurn?: boolean;
  };
  secondaryEffect?: MoveSecondaryEffect;
  /** Defender counter with priority strikes before a non-priority attacker. */
  priority?: boolean;
}

export const ITEM_CATEGORIES = [
  'held_gear',
  'held_berry',
  'consumable',
  'promotion',
  'x_item',
  'vitamin',
  'tm',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export type ItemEquipSlot = 'held' | 'consumable' | 'convoy_only';
export type KecleonShopType = 'tm_shop' | 'held_shop' | 'healing_shop' | 'x_item_shop';

export interface ItemEffectPayload {
  phaseStartHealPercent?: number;
  minHealAmount?: number;
  lifestealPercent?: number;
  berryHpThresholdPercent?: number;
  berryHealFlat?: number;
  berryHealPercent?: number;
  berryCureAllStatus?: boolean;
  boostedType?: PokemonType;
  flatDamageBonus?: number;
  physicalDamageBonus?: number;
  specialDamageBonus?: number;
  superEffectiveDamageBonus?: number;
  lifeOrbRecoilPercent?: number;
  choiceStatBoost?: Partial<StatBlockSeven>;
  choiceLocksMove?: boolean;
  assaultVestSpdBoost?: number;
  evioliteDefSpdBoost?: number;
  rockyHelmetRecoilPercent?: number;
  focusSashSurvive?: boolean;
  ignoreTerrainMovePenalties?: boolean;
  critBonus?: number;
  hitBonus?: number;
  vantageChancePercent?: number;
  healFlat?: number;
  healFull?: boolean;
  cureStatus?: boolean;
  cureSpecificStatus?: StatusCondition;
  revivePercentHp?: number;
  promotionMinLevel?: number;
  promotionFromStage?: 1 | 2;
  allowsEeveeBranching?: boolean;
  battleStatBoost?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  battleCritBoost?: number;
  permanentStatBoost?: Partial<StatBlockSix>;
  permanentPpBoost?: number;
  teachesMoveId?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  iconSlug: string;
  category: ItemCategory;
  equipSlot: ItemEquipSlot;
  consumable: boolean;
  buyPrice: number | null;
  shopType: KecleonShopType | null;
  description: string;
  effect: ItemEffectPayload;
}

export const SPECIES_FACTIONS = ['playable', 'enemy', 'convertible', 'ally_npc'] as const;
export type SpeciesFaction = (typeof SPECIES_FACTIONS)[number];

export const RECRUIT_CATEGORIES = [
  'dragon_lord',
  'story_core',
  'story_chapter',
  'paralogue',
  'convertible_enemy',
  'ally_npc',
  'enemy_only',
] as const;

export type RecruitCategory = (typeof RECRUIT_CATEGORIES)[number];

export interface LearnsetEntry {
  level: number;
  moveId: string;
}

export interface EvolutionBranch {
  targetSpeciesId: string;
  minLevel: number;
  requiredItemId: 'evolution_stone' | 'evolution_gem';
  promotionBonuses: StatBlockSix;
}

export interface PokemonSpeciesDefinition {
  id: string;
  name: string;
  dexNumber: number;
  pmdAssetId: string;
  lineId: string;
  faction: SpeciesFaction;
  recruitCategory: RecruitCategory;
  stage: 1 | 2 | 3;
  isFinalStage: boolean;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: StatBlockSeven;
  defaultJoinLevel: number;
  growthRates: StatBlockSix;
  traversalClass: TraversalClass;
  personalSkillId: string;
  learnset: LearnsetEntry[];
  compatibleTmIds: string[];
  evolutions: EvolutionBranch[];
}
