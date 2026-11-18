/**
 * Campaign Save State, Roster & Overworld Progress Schemas (`saveSchemas.ts`)
 *
 * Strictly adheres to Rule 7 (`localStorage` + Cloud Firestore hybrid sync).
 */

import type { CustomMapOverrideEntry } from './battleSchemas';
import type { KecleonShopType, StatBlockSeven } from './registrySchemas';

export const FLABEBE_FLOWER_COLORS = ['red', 'orange', 'yellow', 'blue', 'white'] as const;
export type FlabebeFlowerColor = (typeof FLABEBE_FLOWER_COLORS)[number];

export const ORICORIO_STYLES = ['baile', 'pom_pom', 'pau', 'sensu'] as const;
export type OricorioStyle = (typeof ORICORIO_STYLES)[number];

export type UnitCosmeticForm = FlabebeFlowerColor | OricorioStyle;

export interface OwnedPokemonInstance {
  instanceId: string;
  speciesId: string;
  /** Optional purely cosmetic sprite/portrait form (Flabébé flower color or Oricorio dance style) */
  cosmeticForm?: UnitCosmeticForm;
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
   * [E] Equipped moves for Enemy Phase counters: one Physical (Range 1) and one Special (Range 2).
   * Each must be in activeMoveIds with the matching category, or null (unequipped).
   */
  equippedPhysicalMoveId: string | null;
  equippedSpecialMoveId: string | null;
  /**
   * Single item slot per unit (Held Gear / Berry, Active Healing/Status Consumable, Promotion Stone/Gem, or X-Item).
   * At most ONE of `heldItemId` or `consumableItemId` may be non-null at any time.
   */
  heldItemId: string | null;
  consumableItemId: string | null;
}

export interface ConvoyEntry {
  itemId: string;
  quantity: number;
}

export const SUPPORT_RANKS = ['C', 'B', 'A', 'S'] as const;
export type SupportRank = (typeof SUPPORT_RANKS)[number];
export type UnlockedSupportRank = SupportRank | null;

export interface SupportPairProgress {
  points: number;
  unlockedRank: UnlockedSupportRank;
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

export type CampaignMode = 'demo' | 'main';

export interface CampaignState {
  currentChapterId: string;
  lordInstanceId: string | null;
  partnerInstanceId: string | null;
  healerInstanceId?: string | null;
  kecleonShopsUnlocked: boolean;
  completedChapterIds: string[];
  campaignMode?: CampaignMode;
  /** Unlocked in Act 2 after the audience with King Serperior; gates wild Rift-tremor encounters. */
  skirmishesUnlocked?: boolean;
  tutorialsEnabled?: boolean;
  seenTutorialIds?: string[];
  unlockedTutorialIds?: string[];
  recruitedChapterIds?: string[];
  seenIntroChapterIds?: string[];
  seenOutroChapterIds?: string[];
  seenStoryCutsceneIds?: string[];
  creditsSeen?: boolean;
  demoCompleted?: boolean;
}

export const CURRENT_SAVE_SCHEMA_VERSION = 2 as const;

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
  /** Keyed by canonical sorted actor pair `${minActorId}::${maxActorId}` (`'lord'` or `lineId`) */
  supports: Record<string, SupportPairProgress>;
  overworld: {
    currentNodeId: string;
    nodes: Record<string, OverworldNodeState>;
  };
  /** Optional Dev Tools custom chapter/level map overrides synced with Cloud Firestore */
  customMaps?: Record<string, CustomMapOverrideEntry>;
  /** Mid-battle suspend snapshot, stored as a JSON string so Firestore never sees nested arrays */
  battleSuspendJson?: string;
}
