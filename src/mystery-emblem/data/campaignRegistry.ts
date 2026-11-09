/**
 * Mystery Emblem — 5-Dungeon Lore Demo Campaign Registry (`campaignRegistry.ts`)
 *
 * Data-driven Act 1 Verdant Commonwealth Demo configuration aligned with the Lore Bible:
 * - `prologue`   (`D1`): Western Beach (Cap 3, `rout`; starting trio `Lord + Piplup + Flabébé`)
 * - `chapter_01` (`D2`): Verdant Bluff (Cap 5, `defeat_boss` vs stationary `Captain Aron`; joins `slot1Flying` + `Sewaddle`)
 * - `chapter_02` (`D3`): Cleft Mountain (Cap 6, `rout` w/ Dungeon Stairs waves; joins `slot2Psychic`)
 * - `chapter_03` (`D4`): River Shrine (Cap 6, `rout`; rescues `Kecleon` & unlocks World Map Kecleon Shops)
 * - `chapter_04` (`D5`): Berry Orchards (Cap 6, `defeat_boss` vs `Commander Deino` w/ `Captain Linoone` & `Captain Morgrem`; joins `slot3Electric`)
 */

import type { DialogueLine, DialogueScript, DialogueSpeakerRef } from '../ui/DialogueOverlay';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonMapDefinition,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  QuizRecruitSeeds,
  SaveData,
} from '../types/schemas';
import {
  cloneDungeonMap,
  getEffectiveChapterMap,
  hasChapterMapOverride,
} from './chapterMapRegistry';
import { getSpeciesById } from './index';
import { KECLEON_PMD_ASSET_ID } from './overworldMapData';

/** Chancellor Serperior PMDCollab / SpriteCollab National Dex asset ID */
export const CHANCELLOR_SERPERIOR_PMD_ASSET_ID = '0497';
/** High Seeress Milotic PMDCollab / SpriteCollab National Dex asset ID */
export const HIGH_SEERESS_MILOTIC_PMD_ASSET_ID = '0350';
/** Ironscale Commander Deino PMDCollab / SpriteCollab National Dex asset ID */
export const COMMANDER_DEINO_PMD_ASSET_ID = '0633';

export const DEMO_STARTING_LEVEL = 9;

export const DEMO_INITIAL_CONVOY: ReadonlyArray<ConvoyEntry> = [
  { itemId: 'evolution_stone', quantity: 1 },
  { itemId: 'potion', quantity: 3 },
  { itemId: 'super_potion', quantity: 1 },
  { itemId: 'full_heal', quantity: 1 },
  { itemId: 'oran_berry', quantity: 1 },
  { itemId: 'x_attack', quantity: 1 },
];

export interface ReinforcementWaveDefinition {
  id: string;
  turnNumber: number;
  stairsX: number;
  stairsY: number;
  enemy: ManualEnemyBattleSpawn;
}

export interface ChapterRecruitmentSpec {
  seedKey?: keyof QuizRecruitSeeds;
  fixedSpeciesIds?: ReadonlyArray<string>;
  joinLevel: number;
  scaleStatsToLevel: boolean;
  fallbackSpeciesIds: ReadonlyArray<string>;
}

export function resolveChapterRecruitmentSpeciesIds(
  spec: ChapterRecruitmentSpec,
  save: SaveData | null
): string[] {
  const result: string[] = [];
  if (spec.seedKey) {
    const rawSeed = save?.campaign.quizSeeds?.[spec.seedKey];
    const seeded =
      Array.isArray(rawSeed) && rawSeed.length > 0 ? rawSeed : spec.fallbackSpeciesIds;
    for (const id of seeded) {
      if (getSpeciesById(id) && !result.includes(id)) {
        result.push(id);
      }
    }
  } else {
    for (const id of spec.fallbackSpeciesIds) {
      if (getSpeciesById(id) && !result.includes(id)) {
        result.push(id);
      }
    }
  }
  if (spec.fixedSpeciesIds) {
    for (const id of spec.fixedSpeciesIds) {
      if (getSpeciesById(id) && !result.includes(id)) {
        result.push(id);
      }
    }
  }
  return result;
}

export interface CampaignChapterConfig {
  nodeId: string;
  levelId: string;
  dungeonNumber: number;
  title: string;
  subtitle: string;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  recommendedLevel: number;
  deploymentCap: number;
  skipPrepPhase?: boolean;
  buildMap: () => DungeonMapDefinition;
  enemySpawns: ReadonlyArray<ManualEnemyBattleSpawn>;
  reinforcements: ReadonlyArray<ReinforcementWaveDefinition>;
  recruitment?: ChapterRecruitmentSpec;
  clearRewardItems?: ReadonlyArray<ConvoyEntry>;
  guaranteesKecleonShopOnClear?: {
    nodeId: string;
    shopType?: KecleonShopType;
  };
  isDemoFinale?: boolean;
  buildIntroScript: (save: SaveData | null) => DialogueScript;
  buildOutroScript: (save: SaveData | null) => DialogueScript;
}

const KECLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KECLEON_PMD_ASSET_ID,
  speciesName: 'Kecleon',
  nickname: 'Kecleon',
};

const ARON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0304',
  speciesName: 'Aron',
  nickname: 'Captain Aron',
};

const DEINO_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: COMMANDER_DEINO_PMD_ASSET_ID,
  speciesName: 'Deino',
  nickname: 'Commander Deino',
};

function findRecruitSpeaker(
  save: SaveData | null,
  fallbackSpeciesId: string
): DialogueSpeakerRef {
  if (save) {
    const fallbackSp = getSpeciesById(fallbackSpeciesId);
    const matched = save.roster.find((u) => {
      if (u.speciesId === fallbackSpeciesId) return true;
      const sp = getSpeciesById(u.speciesId);
      return Boolean(fallbackSp && sp && sp.lineId === fallbackSp.lineId);
    });
    if (matched) {
      return {
        kind: 'unit',
        instanceId: matched.instanceId,
        fallbackSpeciesId,
      };
    }
  }
  return {
    kind: 'species',
    speciesId: fallbackSpeciesId,
  };
}

function attachMapMetadata(
  baseMap: DungeonMapDefinition,
  opts: {
    name: string;
    deploymentCap: number;
    skipPrepPhase?: boolean;
    objectiveType: BattleObjectiveType;
    enemies: ReadonlyArray<ManualEnemyBattleSpawn>;
    preserveCustomEnemies?: boolean;
  }
): DungeonMapDefinition {
  const cloned = cloneDungeonMap(baseMap);
  cloned.name = opts.name;
  cloned.deploymentCap = opts.deploymentCap;
  cloned.objectiveType = opts.objectiveType;
  if (!opts.preserveCustomEnemies) {
    cloned.enemySpawns = opts.enemies.map((e) => ({
      x: e.x,
      y: e.y,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      heldItemId: e.heldItemId ?? null,
      isBoss: e.isBoss,
      stationary: e.stationary,
      droppableItemId: e.droppableItemId ?? null,
      aiMode: e.aiMode,
    }));
  }
  return cloned;
}

const DUNGEON_1_ENEMIES: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'd1_enemy_0',
    x: 12,
    y: 5,
    speciesId: 'zigzagoon_galar',
    nickname: 'Feral Outrider',
    level: 9,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd1_enemy_1',
    x: 12,
    y: 3,
    speciesId: 'impidimp',
    nickname: 'Shadow Raider',
    level: 10,
    heldItemId: null,
    droppableItemId: 'evolution_stone',
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd1_enemy_2',
    x: 13,
    y: 7,
    speciesId: 'pawniard',
    nickname: 'Ironscale Scout',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
];

const DUNGEON_2_ENEMIES: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'd2_enemy_0',
    x: 12,
    y: 4,
    speciesId: 'zigzagoon_galar',
    nickname: 'Bluff Outrider',
    level: 9,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd2_enemy_1',
    x: 11,
    y: 7,
    speciesId: 'impidimp',
    nickname: 'Cliff Hexer',
    level: 9,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd2_enemy_2',
    x: 13,
    y: 3,
    speciesId: 'rookidee',
    nickname: 'Bluff Harrier',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd2_boss_aron',
    x: 15,
    y: 5,
    speciesId: 'aron',
    nickname: 'Captain Aron',
    level: 11,
    heldItemId: null,
    isBoss: true,
    stationary: true,
    droppableItemId: 'oran_berry',
    aiMode: 'stationary',
  },
];

const DUNGEON_3_ENEMIES: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'd3_enemy_0',
    x: 12,
    y: 4,
    speciesId: 'rolycoly',
    nickname: 'Crag Sapper',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd3_enemy_1',
    x: 13,
    y: 7,
    speciesId: 'zubat',
    nickname: 'Peak Flier',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd3_enemy_2',
    x: 16,
    y: 5,
    speciesId: 'gothita',
    nickname: 'Hexer Gothita',
    level: 11,
    heldItemId: null,
    droppableItemId: 'super_potion',
    aiMode: 'wait_until_in_range',
  },
];

const DUNGEON_3_REINFORCEMENTS: ReadonlyArray<ReinforcementWaveDefinition> = [
  {
    id: 'd3_reinforce_t2_north_stairs',
    turnNumber: 2,
    stairsX: 7,
    stairsY: 2,
    enemy: {
      id: 'd3_reinf_rookidee',
      x: 7,
      y: 2,
      speciesId: 'rookidee',
      nickname: 'Stairs Outrider',
      level: 10,
      heldItemId: null,
      aiMode: 'wait_until_in_range',
    },
  },
  {
    id: 'd3_reinforce_t2_lower_stairs',
    turnNumber: 2,
    stairsX: 18,
    stairsY: 8,
    enemy: {
      id: 'd3_reinf_pawniard',
      x: 18,
      y: 8,
      speciesId: 'pawniard',
      nickname: 'Stairs Raider',
      level: 10,
      heldItemId: null,
      aiMode: 'wait_until_in_range',
    },
  },
  {
    id: 'd3_reinforce_t3_upper_stairs',
    turnNumber: 3,
    stairsX: 18,
    stairsY: 2,
    enemy: {
      id: 'd3_reinf_impidimp',
      x: 18,
      y: 2,
      speciesId: 'impidimp',
      nickname: 'Stairs Warlock',
      level: 10,
      heldItemId: null,
      aiMode: 'wait_until_in_range',
    },
  },
];

const DUNGEON_4_ENEMIES: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'd4_enemy_0',
    x: 10,
    y: 5,
    speciesId: 'spheal',
    nickname: 'Shrine Guard',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd4_enemy_1',
    x: 12,
    y: 3,
    speciesId: 'tynamo',
    nickname: 'Current Spark',
    level: 10,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd4_enemy_2',
    x: 13,
    y: 7,
    speciesId: 'croagunk',
    nickname: 'Shrine Striker',
    level: 11,
    heldItemId: null,
    droppableItemId: 'protein',
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd4_enemy_3',
    x: 15,
    y: 5,
    speciesId: 'lairon',
    nickname: 'Ironclad Lairon',
    level: 11,
    heldItemId: null,
    droppableItemId: 'evolution_stone',
    aiMode: 'wait_until_in_range',
  },
];

const DUNGEON_4_REINFORCEMENTS: ReadonlyArray<ReinforcementWaveDefinition> = [
  {
    id: 'd4_reinforce_t2_falls',
    turnNumber: 2,
    stairsX: 15,
    stairsY: 3,
    enemy: {
      id: 'd4_reinf_zubat',
      x: 15,
      y: 3,
      speciesId: 'zubat',
      nickname: 'Shrine Diver',
      level: 10,
      heldItemId: null,
      aiMode: 'wait_until_in_range',
    },
  },
];

const DUNGEON_5_ENEMIES: ReadonlyArray<ManualEnemyBattleSpawn> = [
  {
    id: 'd5_enemy_0',
    x: 12,
    y: 3,
    speciesId: 'linoone_galar',
    nickname: 'Captain Linoone',
    level: 11,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_enemy_1',
    x: 13,
    y: 8,
    speciesId: 'venipede',
    nickname: 'Thicket Lancer',
    level: 11,
    heldItemId: null,
    droppableItemId: 'sitrus_berry',
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_enemy_2',
    x: 15,
    y: 4,
    speciesId: 'corvisquire',
    nickname: 'Canopy Harrier',
    level: 11,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_enemy_3',
    x: 15,
    y: 7,
    speciesId: 'morgrem',
    nickname: 'Captain Morgrem',
    level: 11,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_boss_deino',
    x: 17,
    y: 5,
    speciesId: 'deino',
    nickname: 'Commander Deino',
    level: 12,
    stats: { hp: 31, atk: 12, def: 10, spa: 12, spd: 10, spe: 11, mov: 5 },
    heldItemId: 'oran_berry',
    isBoss: true,
    stationary: false,
    droppableItemId: 'carbos',
    aiMode: 'wait_until_in_range',
  },
];

const DUNGEON_5_REINFORCEMENTS: ReadonlyArray<ReinforcementWaveDefinition> = [
  {
    id: 'd5_reinforce_t2_woods',
    turnNumber: 2,
    stairsX: 18,
    stairsY: 8,
    enemy: {
      id: 'd5_reinf_pawniard',
      x: 18,
      y: 8,
      speciesId: 'pawniard',
      nickname: 'Imperial Pursuer',
      level: 11,
      heldItemId: null,
      aiMode: 'wait_until_in_range',
    },
  },
];

export const DEMO_CAMPAIGN_CHAPTERS: ReadonlyArray<CampaignChapterConfig> = [
  {
    nodeId: 'prologue',
    levelId: 'prologue',
    dungeonNumber: 1,
    skipPrepPhase: true,
    title: 'Western Beach',
    subtitle: 'Chapter 1',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 9,
    deploymentCap: 3,
    enemySpawns: DUNGEON_1_ENEMIES,
    reinforcements: [],
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('prologue'), {
        name: 'Western Beach',
        deploymentCap: 3,
        objectiveType: 'rout',
        enemies: DUNGEON_1_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('prologue'),
      }),
    buildIntroScript: () => ({
      id: 'demo_d1_intro',
      title: 'Western Beach',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Angry',
          text: 'Hey! Drop our tribe’s Evolution Stone right now! Nobody raids Western Beach and walks away!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Worried',
          text: 'Careful, {partner}! Those Feral outriders are maddened by purple miasma—and an armored Ironscale scout is directing them from the rear!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Teary-Eyed',
          text: 'EEP! Claws! Sharp Metal-type claws! Look, I am a strictly non-combatant bug—I’ll coach you from behind this big safe rock where nobody can poke me!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Three hostiles across the sand—and something warm is pulsing inside my chest... Stay close, {partner}, {healer}; let’s rout them and reclaim our Stone!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d1_outro',
      title: 'Western Beach',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'WHOA! {lord}, did you just see yourself?! Right when that last raider went down, golden light flared right off your scales!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Surprised',
          text: 'We recovered our tribe’s Evolution Stone too—and look how warm {lord}’s light feels! Chancellor Serperior and High Seeress Milotic must know what this is!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Surprised',
          text: 'All these years growing up together on this coast, I’ve never felt power like that... Come on, everyone—let’s report to the Emerald Sanctuary!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_01',
    levelId: 'chapter_01',
    dungeonNumber: 2,
    title: 'Verdant Bluff',
    subtitle: 'Chapter 2',
    objectiveType: 'defeat_boss',
    objectiveLabel: 'Defeat Boss: Captain Aron',
    recommendedLevel: 9,
    deploymentCap: 5,
    enemySpawns: DUNGEON_2_ENEMIES,
    reinforcements: [],
    recruitment: {
      seedKey: 'slot1Flying',
      fixedSpeciesIds: ['sewaddle'],
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['pidgey'],
    },
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_01'), {
        name: 'Verdant Bluff',
        deploymentCap: 5,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_2_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_01'),
      }),
    buildIntroScript: (save) => {
      const flyId =
        save?.campaign.quizSeeds.slot1Flying?.[0] ??
        save?.campaign.quizSeeds.q2BugFlying?.find(
          (id) => id !== 'caterpie' && id !== 'sewaddle' && id !== 'grubbin'
        ) ??
        'pidgey';
      const lines: DialogueLine[] = [
        {
          speaker: findRecruitSpeaker(save, flyId),
          side: 'right',
          emotion: 'Determined',
          text: '{lord}! From above the cliffs I spotted Captain Aron—he’s anchored in heavy Ironscale plate and won’t budge an inch.',
        },
        {
          speaker: findRecruitSpeaker(save, 'sewaddle'),
          side: 'right',
          emotion: 'Determined',
          text: 'Our forest scouts are with you too! Topple Captain Aron on his post and his whole garrison will scatter!',
        },
        {
          speaker: ARON_SPEAKER,
          side: 'right',
          emotion: 'Angry',
          text: 'By Imperial decree, this coast stands under Ironscale martial law! None pass Verdant Bluff!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Happy',
          text: 'Wait—he won’t budge an inch?! Zero movement! That means if we stay outside his reach until we’re ready, he literally cannot chase us! Best boss ever!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'The Commonwealth isn’t yours to cage. Watch their attack ranges and bring Captain Aron down!',
        },
      ];
      return {
        id: 'demo_d2_intro',
        title: 'Verdant Bluff',
        bgm: 'drenched_bluff',
        lines,
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d2_outro',
      title: 'Verdant Bluff',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'Captain Aron’s blockade broke! Anyone who reaches Level 10 can promote with an Evolution Stone too!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Normal',
          text: 'Dusk is settling fast over the bluff, {lord}—let’s pitch camp on the overlook before climbing Cleft Mountain!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_02',
    levelId: 'chapter_02',
    dungeonNumber: 3,
    title: 'Cleft Mountain',
    subtitle: 'Chapter 3',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 10,
    deploymentCap: 6,
    enemySpawns: DUNGEON_3_ENEMIES,
    reinforcements: DUNGEON_3_REINFORCEMENTS,
    recruitment: {
      seedKey: 'slot2Psychic',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['ralts'],
    },
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_02'), {
        name: 'Cleft Mountain',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_3_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_02'),
      }),
    buildIntroScript: (save) => {
      const psyId =
        save?.campaign.quizSeeds.slot2Psychic?.[0] ??
        save?.campaign.quizSeeds.q3GhostPsychic?.find((id) => id !== 'duskull') ??
        'ralts';
      return {
        id: 'demo_d3_intro',
        title: 'Cleft Mountain',
        bgm: 'mt_bristle',
        lines: [
          {
            speaker: findRecruitSpeaker(save, psyId),
            side: 'right',
            emotion: 'Worried',
            text: 'Careful, {lord}! Your Dragon Aura woke the runes of this ancient watchtower—and Ironscale reserves are climbing the Dungeon Stairs!',
          },
          {
            speaker: findRecruitSpeaker(save, psyId),
            side: 'right',
            emotion: 'Determined',
            text: 'Stand directly on a Stairs tile to seal enemy reinforcements below! Let me lend my mystic sight to your squad.',
          },
          {
            speaker: { kind: 'advisor' },
            side: 'left',
            emotion: 'Shouting',
            text: 'PLUG THE STAIRS! Put somebody big and sturdy right on top of them—and NO, before anyone looks at me, my shell does NOT count as a cork!',
          },
          {
            speaker: { kind: 'lord' },
            side: 'left',
            emotion: 'Determined',
            text: 'A watchtower of the old Dragon Kingdom... Secure those Stairs and clear Cleft Mountain!',
          },
        ],
      };
    },
    buildOutroScript: (save) => {
      const psyId =
        save?.campaign.quizSeeds.slot2Psychic?.[0] ??
        save?.campaign.quizSeeds.q3GhostPsychic?.find((id) => id !== 'duskull') ??
        'ralts';
      return {
        id: 'demo_d3_outro',
        title: 'Cleft Mountain',
        bgm: 'calm_cutscene',
        lines: [
          {
            speaker: findRecruitSpeaker(save, psyId),
            side: 'right',
            emotion: 'Surprised',
            text: 'The miasma over the stairwell is lifting! Look just ahead, {lord}—the ancient Dragon watchtower parapet is shining through the mist!',
          },
          {
            speaker: { kind: 'lord' },
            side: 'left',
            emotion: 'Normal',
            text: 'Let’s head out onto the parapet and see what the old watchtower guards.',
          },
        ],
      };
    },
  },
  {
    nodeId: 'chapter_03',
    levelId: 'chapter_03',
    dungeonNumber: 4,
    title: 'River Shrine',
    subtitle: 'Chapter 4',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 11,
    deploymentCap: 6,
    enemySpawns: DUNGEON_4_ENEMIES,
    reinforcements: DUNGEON_4_REINFORCEMENTS,
    guaranteesKecleonShopOnClear: {
      nodeId: 'chapter_03',
      shopType: 'healing_shop',
    },
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_03'), {
        name: 'River Shrine',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_4_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_03'),
      }),
    buildIntroScript: () => ({
      id: 'demo_d4_intro',
      title: 'River Shrine',
      bgm: 'waterfall_cave',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Worried',
          text: 'Help! An Ironclad Lairon seized River Shrine to confiscate our Potions and Evolution Stones for Commander Deino’s war chest!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Hold fast, Kecleon! Fliers and Water-types can cross the shrine’s river channels—rout them and free the caravan!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d4_outro',
      title: 'River Shrine',
      bgm: 'kecleon_shop',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'Saved! Step right into the shrine courtyard, everyone—Chancellor Serperior and High Seeress Milotic have just arrived across the north bridge!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Happy',
          text: 'Potions! Oran Berries! Life-saving emergency snacks! Thank goodness—watching you guys take hits takes years off my tiny bug lifespan!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_04',
    levelId: 'chapter_04',
    dungeonNumber: 5,
    title: 'Berry Orchards',
    subtitle: 'Chapter 5 · Finale',
    objectiveType: 'defeat_boss',
    objectiveLabel: 'Defeat Boss: Commander Deino',
    recommendedLevel: 12,
    deploymentCap: 6,
    enemySpawns: DUNGEON_5_ENEMIES,
    reinforcements: DUNGEON_5_REINFORCEMENTS,
    recruitment: {
      seedKey: 'slot3Electric',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['elekid'],
    },
    clearRewardItems: [{ itemId: 'evolution_stone', quantity: 1 }],
    isDemoFinale: true,
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_04'), {
        name: 'Berry Orchards',
        deploymentCap: 6,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_5_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_04'),
      }),
    buildIntroScript: (save) => {
      const elecId =
        save?.campaign.quizSeeds.slot3Electric?.[0] ??
        save?.campaign.quizSeeds.q4Electric?.[0] ??
        'elekid';
      return {
        id: 'demo_d5_intro',
        title: 'Berry Orchards',
        bgm: 'apple_woods',
        lines: [
          {
            speaker: findRecruitSpeaker(save, elecId),
            side: 'right',
            emotion: 'Determined',
            text: '{lord}! Commander Deino’s vanguard—and his lieutenants Linoone and Morgrem—have fortified Berry Orchards ahead!',
          },
          {
            speaker: DEINO_SPEAKER,
            side: 'right',
            emotion: 'Angry',
            text: 'Another lost Dragon playing hero? Soft ideals let the Abyss fester—only Ironscale steel can subjugate a broken world!',
          },
          {
            speaker: { kind: 'advisor' },
            side: 'left',
            emotion: 'Crying',
            text: 'Uhh, {lord}?! Unlike Aron, Commander Deino’s legs definitely work—he’s going to charge the second anyone steps into his range! I’ll be behind THREE bushes!',
          },
          {
            speaker: { kind: 'lord' },
            side: 'left',
            emotion: 'Determined',
            text: 'Ruling through fear isn’t order, Deino! Stand together, everyone—defeat Commander Deino and free Berry Orchards!',
          },
        ],
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d5_outro',
      title: 'Victory!',
      bgm: 'victory_fanfare',
      lines: [
        {
          speaker: DEINO_SPEAKER,
          side: 'right',
          emotion: 'Pain',
          text: 'Tch... Fall back, Linoone, Morgrem! Remember this, {lord}—Emperor Kingambit’s legions and the Abyss beyond will test that soft heart of yours.',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Joyous',
          text: 'Yeah, keep running, Deino! Berry Orchards belongs to the Verdant Commonwealth!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'Everyone made it through safe—and look ahead, Chancellor Serperior and High Seeress Milotic are lighting the orchard lanterns!',
        },
      ],
    }),
  },
];

export const DEMO_CHAPTER_BY_NODE_ID: Readonly<Record<string, CampaignChapterConfig>> =
  Object.fromEntries(DEMO_CAMPAIGN_CHAPTERS.map((ch) => [ch.nodeId, ch]));

export function getDemoChapterByNodeId(nodeId: string): CampaignChapterConfig | undefined {
  return DEMO_CHAPTER_BY_NODE_ID[nodeId];
}
