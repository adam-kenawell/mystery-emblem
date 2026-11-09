/**
 * Mystery Emblem — New Campaign Save Factory (`campaignSaveFactory.ts`)
 */

import { getFlabebeFlowerColorForLord } from '../assets/pmdAssetLoader';
import {
  createDefaultQuizSeeds,
  FIXED_HEALER_SPECIES_ID,
  FIXED_PARTNER_SPECIES_ID,
  INITIAL_CAMPAIGN_CONVOY,
  MAX_UNIT_LEVEL,
  MIN_UNIT_LEVEL,
  STARTING_CAMPAIGN_GOLD,
  STARTING_CAMPAIGN_LEVEL,
} from '../data/campaignConfig';
import { SPECIES_MAP } from '../data/index';
import type { OverworldGraphDefinition } from '../data/overworldMapData';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type CampaignMode,
  type ConvoyEntry,
  type QuizRecruitSeeds,
  type SaveData,
  type TutorialFamiliarityPreferences,
} from '../types/schemas';
import { createPokemonInstance, generateSaveId } from './saveHelpersAndFactory';

export interface NewCampaignConfig {
  lordSpeciesId: string;
  lordNickname?: string;
  partnerSpeciesId?: string;
  partnerNickname?: string;
  healerSpeciesId?: string;
  healerNickname?: string;
  quizSeeds?: QuizRecruitSeeds;
  tutorialsEnabled?: boolean;
  tutorialPreferences?: TutorialFamiliarityPreferences;
  newGamePlusUnlocked?: boolean;
  startingLevel?: number;
  scaleStatsToLevel?: boolean;
  campaignMode?: CampaignMode;
  initialConvoy?: ReadonlyArray<ConvoyEntry>;
  startingGold?: number;
  currentChapterId?: string;
  overworldGraph?: OverworldGraphDefinition;
}

export function buildNewCampaignSaveData(
  cfg: NewCampaignConfig,
  inheritedNgPlusUnlocked: boolean
): SaveData {
  const startLv = Math.max(
    MIN_UNIT_LEVEL,
    Math.min(MAX_UNIT_LEVEL, Math.floor(cfg.startingLevel ?? STARTING_CAMPAIGN_LEVEL))
  );
  const scaleStats = Boolean(cfg.scaleStatsToLevel ?? startLv > 1);
  const partnerSpeciesId = cfg.partnerSpeciesId ?? FIXED_PARTNER_SPECIES_ID;
  const healerSpeciesId = cfg.healerSpeciesId ?? FIXED_HEALER_SPECIES_ID;
  const flabebeFlower = getFlabebeFlowerColorForLord(cfg.lordSpeciesId);

  const lord = createPokemonInstance({
    speciesId: cfg.lordSpeciesId,
    nickname: cfg.lordNickname,
    level: startLv,
    scaleStatsToLevel: scaleStats,
    isLord: true,
    consumableItemId: 'potion',
  });
  const partner = createPokemonInstance({
    speciesId: partnerSpeciesId,
    nickname: cfg.partnerNickname,
    cosmeticForm:
      SPECIES_MAP.get(partnerSpeciesId)?.lineId === 'flabebe_line' ? flabebeFlower : undefined,
    level: startLv,
    scaleStatsToLevel: scaleStats,
    heldItemId: 'oran_berry',
  });
  const healer = createPokemonInstance({
    speciesId: healerSpeciesId,
    nickname: cfg.healerNickname,
    cosmeticForm:
      SPECIES_MAP.get(healerSpeciesId)?.lineId === 'flabebe_line' ? flabebeFlower : undefined,
    level: startLv,
    scaleStatsToLevel: scaleStats,
  });

  const seeds: QuizRecruitSeeds = cfg.quizSeeds
    ? createDefaultQuizSeeds(cfg.quizSeeds)
    : createDefaultQuizSeeds();
  const initialChapterId = cfg.currentChapterId?.trim() || 'prologue';
  const defaultConvoy: ConvoyEntry[] = INITIAL_CAMPAIGN_CONVOY.map((c) => ({ ...c }));

  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    saveId: generateSaveId('campaign'),
    lastUpdated: Date.now(),
    newGamePlusUnlocked: Boolean(cfg.newGamePlusUnlocked || inheritedNgPlusUnlocked),
    gold: cfg.startingGold ?? STARTING_CAMPAIGN_GOLD,
    campaign: {
      currentChapterId: initialChapterId,
      lordInstanceId: lord.instanceId,
      partnerInstanceId: partner.instanceId,
      healerInstanceId: healer.instanceId,
      quizSeeds: seeds,
      kecleonShopsUnlocked: false,
      completedChapterIds: [],
      ...(cfg.campaignMode ? { campaignMode: cfg.campaignMode } : {}),
      ...(cfg.tutorialsEnabled !== undefined
        ? { tutorialsEnabled: Boolean(cfg.tutorialsEnabled) }
        : {}),
      ...(cfg.tutorialPreferences ? { tutorialPreferences: { ...cfg.tutorialPreferences } } : {}),
      seenTutorialIds: [],
      unlockedTutorialIds: [],
      recruitedChapterIds: [],
      seenIntroChapterIds: [],
      seenOutroChapterIds: [],
    },
    roster: [lord, partner, healer],
    convoy: cfg.initialConvoy
      ? cfg.initialConvoy.map((c) => ({ itemId: c.itemId, quantity: c.quantity }))
      : defaultConvoy,
    supports: {},
    overworld: {
      currentNodeId: initialChapterId,
      nodes: {
        [initialChapterId]: {
          nodeId: initialChapterId,
          unlocked: true,
          cleared: false,
          activeSkirmish: null,
          activeKecleonShop: null,
        },
      },
    },
  };
}
