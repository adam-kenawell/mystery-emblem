/**
 * Mystery Emblem - Central Campaign Progression, Roster & Label Configuration (`campaignConfig.ts`)
 *
 * Single source of truth for the continuous Lv. 1-40 5-Act Hoopa & Space-Time Rift campaign
 * aligned with `Mystery Emblem - Lore, Kingdoms & Character Bible.md`.
 */

import type { ConvoyEntry, QuizRecruitSeeds } from '../types/schemas';

export const MIN_UNIT_LEVEL = 1;
export const MAX_UNIT_LEVEL = 40;
export const STARTING_CAMPAIGN_LEVEL = 1;
export const STARTING_CAMPAIGN_GOLD = 1500;

/** Promotion thresholds (Rule 5 & Lore Bible) */
export const STONE_PROMOTION_MIN_LEVEL = 10;
export const BRANCHED_PROMOTION_MIN_LEVEL = 15;
export const GEM_PROMOTION_MIN_LEVEL = 20;

/** Canonical starting cast & mentor species identifiers */
export const DRAGON_LORD_SPECIES_IDS = ['axew', 'bagon', 'gible', 'dratini', 'goomy'] as const;
export type DragonLordSpeciesId = (typeof DRAGON_LORD_SPECIES_IDS)[number];

export const FIXED_PARTNER_SPECIES_ID = 'quaxly' as const;
export const FIXED_HEALER_SPECIES_ID = 'flabebe' as const;
export const MENTOR_JAGEN_SPECIES_ID = 'mentor_quaquaval' as const;

/** NPC / Boss PMDCollab National Dex asset IDs */
export const KING_SERPERIOR_PMD_ASSET_ID = '0497';
export const CHANCELLOR_SERPERIOR_PMD_ASSET_ID = KING_SERPERIOR_PMD_ASSET_ID;
export const MENTOR_QUAQUAVAL_PMD_ASSET_ID = '0914';
export const FLORGES_PARENT_BASE_PMD_ASSET_ID = '0671';
export const PIDGEOTTO_MESSENGER_PMD_ASSET_ID = '0017';
export const BAXCALIBUR_ELDER_PMD_ASSET_ID = '0998';
export const HAXORUS_ANCIENT_PMD_ASSET_ID = '0612';
export const DRAGONITE_ANCIENT_PMD_ASSET_ID = '0149';
export const GOODRA_ANCIENT_PMD_ASSET_ID = '0706';
export const HOOPA_CONFINED_PMD_ASSET_ID = '0720';
export const HOOPA_UNBOUND_PMD_ASSET_ID = '0720/0001';
export const KECLEON_PMD_ASSET_ID = '0352';
export const COMMANDER_DEINO_PMD_ASSET_ID = '0633';
export const DRAKLOAK_ALLY_PMD_ASSET_ID = '0886';

/** Lore-Bible lines that begin hostile and defect/convert to the player army */
export const CONVERTIBLE_FACTION_LINE_IDS = [
  'deino_line',
  'gastly_line',
  'seedot_line',
] as const;

export const ALLY_NPC_LINE_IDS = ['kecleon_line'] as const;

/** Milestone nodes for Act 1 Credits & Full Campaign NG+ unlock */
export const START_CAMPAIGN_NODE_ID = 'prologue';
export const ACT1_CREDITS_NODE_ID = 'chapter_04';
export const FINAL_CAMPAIGN_NODE_ID = 'chapter_25';

export const INITIAL_CAMPAIGN_CONVOY: ReadonlyArray<ConvoyEntry> = [
  { itemId: 'potion', quantity: 4 },
  { itemId: 'paralyze_heal', quantity: 2 },
  { itemId: 'full_heal', quantity: 2 },
  { itemId: 'oran_berry', quantity: 2 },
  { itemId: 'muscle_band', quantity: 1 },
  { itemId: 'x_attack', quantity: 1 },
];

export const DEMO_STARTING_LEVEL = STARTING_CAMPAIGN_LEVEL;
export const DEMO_INITIAL_CONVOY = INITIAL_CAMPAIGN_CONVOY;

export const DEFAULT_QUIZ_SEEDS: QuizRecruitSeeds = {
  slot1Flying: ['starly'],
  slot2Psychic: ['ralts'],
  slot3Electric: ['pawmi'],
  slot4Rock: ['geodude'],
  slot5Fire: ['combusken'],
  slot6Grass: ['bellsprout'],
  slot7Fairy: ['clefairy'],
  slot8Ice: ['vanillish'],
};

export function createDefaultQuizSeeds(overrides?: Partial<QuizRecruitSeeds>): QuizRecruitSeeds {
  return {
    slot1Flying: [...(overrides?.slot1Flying ?? DEFAULT_QUIZ_SEEDS.slot1Flying)],
    slot2Psychic: [...(overrides?.slot2Psychic ?? DEFAULT_QUIZ_SEEDS.slot2Psychic)],
    slot3Electric: [...(overrides?.slot3Electric ?? DEFAULT_QUIZ_SEEDS.slot3Electric)],
    slot4Rock: [...(overrides?.slot4Rock ?? DEFAULT_QUIZ_SEEDS.slot4Rock)],
    slot5Fire: [...(overrides?.slot5Fire ?? DEFAULT_QUIZ_SEEDS.slot5Fire)],
    slot6Grass: [...(overrides?.slot6Grass ?? DEFAULT_QUIZ_SEEDS.slot6Grass)],
    slot7Fairy: [...(overrides?.slot7Fairy ?? DEFAULT_QUIZ_SEEDS.slot7Fairy)],
    slot8Ice: [...(overrides?.slot8Ice ?? DEFAULT_QUIZ_SEEDS.slot8Ice)],
  };
}

/**
 * Formats any campaign node/chapter ID into its canonical player-facing label:
 * - `'prologue'` -> `'Prologue'`
 * - `'chapter_01'` / `'ch_1'` / `'1'` -> `'Chapter 1'`
 * - `'paralogue_01'` -> `'Paralogue 1'`
 */
export function formatCampaignChapterLabel(chapterId: string | null | undefined): string {
  const raw = (chapterId ?? '').trim();
  if (!raw) return 'Prologue';
  const lower = raw.toLowerCase();
  if (lower === 'prologue') return 'Prologue';
  if (lower === 'epilogue') return 'Epilogue';
  if (lower === 'endgame') return 'Endgame';

  const chMatch = /^(?:chapter|ch)[_\-\s]*(\d+)$/i.exec(raw);
  if (chMatch) {
    return `Chapter ${Number(chMatch[1])}`;
  }
  if (/^\d+$/.test(raw)) {
    return `Chapter ${Number(raw)}`;
  }
  const paraMatch = /^(?:paralogue|para|par)[_\-\s]*(\d+)$/i.exec(raw);
  if (paraMatch) {
    return `Paralogue ${Number(paraMatch[1])}`;
  }

  return raw
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Compact Overworld pill / catalog code (`'Prologue'`, `'Ch. 1'`, `'Par. 1'`).
 */
export function formatCampaignShortCode(chapterId: string | null | undefined): string {
  const raw = (chapterId ?? '').trim();
  if (!raw || raw.toLowerCase() === 'prologue') return 'Prologue';
  const chMatch = /^(?:chapter|ch)[_\-\s]*(\d+)$/i.exec(raw);
  if (chMatch) return `Ch. ${Number(chMatch[1])}`;
  const paraMatch = /^(?:paralogue|para|par)[_\-\s]*(\d+)$/i.exec(raw);
  if (paraMatch) return `Par. ${Number(paraMatch[1])}`;
  return formatCampaignChapterLabel(raw);
}
