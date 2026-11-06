/**
 * Core Data Schemas & Save State Interfaces for Mystery Emblem (Step 1)
 *
 * Strictly adheres to:
 * - Rule 1: 100% Data-Driven Manual Balance (Zero Automated Stat Formulas)
 * - Rule 4: Single-Equipped Enemy Phase & Zero Pure Stat-Changing Moves
 * - Rule 5: Strict Faction Separation & 3-Stage Promotion Curve
 * - Rule 7: Hybrid localStorage + Firebase Cloud Firestore Save Sync
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

// ============================================================================
// 1. Personal Skills (`personal_skills.json`)
// ============================================================================

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

// ============================================================================
// 2. Moves (`moves.json`)
// ============================================================================

export const MOVE_CATEGORIES = ['Physical', 'Special', 'Support/Heal'] as const;
export type MoveCategory = (typeof MOVE_CATEGORIES)[number];

export type SupportMoveSubkind = 'heal' | 'status' | 'shield' | 'self_heal';
export type MoveTargetType = 'enemy' | 'ally' | 'self' | 'self_or_ally';

export interface MoveSecondaryEffect {
  /** Random trigger chance percentage (1..100, typically 10..30) */
  chance: number;
  /** Optional non-volatile status condition inflicted on the defender */
  status?: StatusCondition;
  /** Target of temporary stat buffs/debuffs (only permitted on damaging moves, Mt > 0) */
  statTarget?: 'self' | 'defender';
  /** Temporary combat stat modifier (e.g., { spd: -2 } or { spe: 2 }) */
  statChanges?: TempStatModifiers;
  /** Duration in turns for temporary stat changes (typically 2) */
  durationTurns?: number;
}

export interface MoveDefinition {
  id: string;
  name: string;
  type: PokemonType;
  /** Physical = Range [1,1], Special = Range [2,2], Support/Heal = Range [1,1] or [1,2] */
  category: MoveCategory;
  /** Inclusive [minRange, maxRange] in orthogonal Manhattan tiles */
  range: [number, number];
  targetType: MoveTargetType;
  /** Base Might (0 for non-damaging Support/Heal moves; >= 1 for Physical/Special) */
  mt: number;
  /** Base Hit accuracy percentage (e.g., 75..100) */
  hit: number;
  /** Critical Hit rate bonus percentage (e.g., 0..25) */
  crit: number;
  /** Per-battle PP uses (refreshed between maps) */
  pp: number;
  description: string;
  /** Required when category === 'Support/Heal' */
  supportSubkind?: SupportMoveSubkind;
  /** Flat HP or % Max HP restored for healing moves, or status inflicted for status moves */
  supportPayload?: {
    healAmount?: number;
    healPercentMaxHp?: number;
    cureStatus?: boolean;
    inflictStatus?: StatusCondition;
    shieldDamageReduction?: number;
    durationTurns?: number;
  };
  /** Optional random-chance secondary effect on damaging moves */
  secondaryEffect?: MoveSecondaryEffect;
}

// ============================================================================
// 3. Items (`items.json`)
// ============================================================================

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
  /** Held Gear / Berry effects */
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

  /** Active Consumables */
  healFlat?: number;
  healFull?: boolean;
  cureStatus?: boolean;
  revivePercentHp?: number;

  /** Promotion Items */
  promotionMinLevel?: number;
  promotionFromStage?: 1 | 2;
  allowsEeveeBranching?: boolean;

  /** X-Items (single-battle buffs) */
  battleStatBoost?: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>>;
  battleCritBoost?: number;

  /** Permanent Stat Vitamins */
  permanentStatBoost?: Partial<StatBlockSix>;
  permanentPpBoost?: number;

  /** Single-Use TMs */
  teachesMoveId?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  equipSlot: ItemEquipSlot;
  /** True if consumed upon use/trigger (Berries, Potions, Stones/Gems, X-Items, Vitamins, TMs) */
  consumable: boolean;
  /** Price in Gold at Kecleon Shops, or null if chest/boss-exclusive */
  buyPrice: number | null;
  shopType: KecleonShopType | null;
  description: string;
  effect: ItemEffectPayload;
}

// ============================================================================
// 4. Pokémon Species (`pokemon_species.json`)
// ============================================================================

export type SpeciesFaction = 'playable' | 'enemy' | 'shared_paralogue6';

export type RecruitCategory =
  | 'dragon_lord'
  | 'starter_partner'
  | 'quiz_q1'
  | 'quiz_q2'
  | 'quiz_q3'
  | 'quiz_q4'
  | 'quiz_q5'
  | 'quiz_q6'
  | 'quiz_q7'
  | 'quiz_q8'
  | 'quiz_q9'
  | 'story_chapter'
  | 'paralogue'
  | 'enemy_only';

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
  /**
   * PMDCollab / SpriteCollab path identifier:
   * e.g. "0001" for Bulbasaur, "0122/0001" for Galarian Mr. Mime, "0263/0001" for Galarian Zigzagoon.
   */
  pmdAssetId: string;
  /** Evolutionary line key used to enforce strict player/enemy faction separation */
  lineId: string;
  faction: SpeciesFaction;
  recruitCategory: RecruitCategory;
  stage: 1 | 2 | 3;
  /** True for final evolutions (including Stage-2 Eeveelutions and 1/2-stage enemy finals) */
  isFinalStage: boolean;
  types: [PokemonType] | [PokemonType, PokemonType];
  /** Manually tuned base stats at defaultJoinLevel (zero PokéAPI formulas) */
  baseStats: StatBlockSeven;
  defaultJoinLevel: number;
  /** Manually tuned percentage growth rates (0..100) */
  growthRates: StatBlockSix;
  traversalClass: TraversalClass;
  personalSkillId: string;
  learnset: LearnsetEntry[];
  compatibleTmIds: string[];
  evolutions: EvolutionBranch[];
}

// ============================================================================
// 5. Save State Schema (`SaveStateManager`)
// ============================================================================

export interface QuizRecruitSeeds {
  q1Healer: string[];
  q2BugFlying: string[];
  q3GhostPsychic: string[];
  q4Electric: string[];
  q5FrontlineTrio: string[];
  q6WaterGrass: string[];
  q7Fire: string[];
  q8SteelFairy: string[];
  q9IceArmored: string[];
}

export interface OwnedPokemonInstance {
  instanceId: string;
  speciesId: string;
  /** Persistent custom nickname (defaults to species name; editable anytime) */
  nickname: string;
  isLord: boolean;
  level: number;
  exp: number;
  currentStats: StatBlockSeven;
  /** Tracks permanent PP Up boosts applied to individual move IDs */
  bonusPpByMoveId: Record<string, number>;
  /** All moves permanently unlocked via level-up or single-use TMs */
  unlockedMoveIds: string[];
  /** Up to 4 active moves equipped for battle */
  activeMoveIds: string[];
  /**
   * Single offensive move marked [E] Equipped for Enemy Phase counter-attacks.
   * Must be one of activeMoveIds with category 'Physical' or 'Special' (or null if none).
   */
  equippedMoveId: string | null;
  heldItemId: string | null;
  consumableItemId: string | null;
}

export interface ConvoyEntry {
  itemId: string;
  quantity: number;
}

export type SupportLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface SupportPairProgress {
  points: number;
  level: SupportLevel;
}

export interface SkirmishSpawnState {
  spawnedAtTimestamp: number;
  recommendedLevel: number;
  tilesetId: string;
}

export interface KecleonShopSpawnState {
  shopType: KecleonShopType;
  inventoryItemIds: string[];
}

export interface OverworldNodeState {
  nodeId: string;
  unlocked: boolean;
  cleared: boolean;
  activeSkirmish: SkirmishSpawnState | null;
  activeKecleonShop: KecleonShopSpawnState | null;
}

export interface CampaignState {
  currentChapterId: string;
  lordInstanceId: string | null;
  partnerInstanceId: string | null;
  quizSeeds: QuizRecruitSeeds;
  kecleonShopsUnlocked: boolean;
  completedChapterIds: string[];
}

export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;

export interface SaveData {
  schemaVersion: typeof CURRENT_SAVE_SCHEMA_VERSION;
  saveId: string;
  /** UTC epoch timestamp in milliseconds (`Date.now()`) for local vs. Firestore resolution */
  lastUpdated: number;
  newGamePlusUnlocked: boolean;
  gold: number;
  campaign: CampaignState;
  roster: OwnedPokemonInstance[];
  convoy: ConvoyEntry[];
  /** Keyed by canonical sorted pair `${minInstanceId}::${maxInstanceId}` */
  supports: Record<string, SupportPairProgress>;
  overworld: {
    currentNodeId: string;
    nodes: Record<string, OverworldNodeState>;
  };
}


// ============================================================================
// 6. PMD Dungeon Terrain & Tactical Battlefield Grid Schemas (Step 5)
// ============================================================================

export const TERRAIN_TYPES = [
  'floor',
  'trees',
  'stairs',
  'water',
  'lava',
  'mountain',
  'void',
  'wonder_tile',
  'wall',
  'barrier',
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export interface TerrainBonuses {
  defBonus: number;
  spdBonus: number;
  avoidBonus: number;
  healPercentPerTurn: number;
  clearsDebuffs: boolean;
  spawnsReinforcements: boolean;
}

export interface DungeonMapTileCell {
  terrainType: TerrainType;
  /** 3-digit PMD EoS tileset identifier (`"000"`..`"143"`) */
  tilesetId: string;
  /** 24x24 chunk index (`1..399`) inside the 16x25 `384x600` sheet */
  chunkIndex: number;
}

export interface DungeonUnitSpawn {
  x: number;
  y: number;
  speciesId: string;
  level: number;
  nickname?: string;
  heldItemId?: string | null;
}

export interface DungeonMapDefinition {
  id: string;
  name: string;
  bgmCue?: string;
  width: number;
  height: number;
  /** Row-major `[y][x]` grid of dimensions `height` x `width` */
  tiles: DungeonMapTileCell[][];
  playerSpawns: DungeonUnitSpawn[];
  enemySpawns: DungeonUnitSpawn[];
}
