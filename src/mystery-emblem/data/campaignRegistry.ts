/**
 * Mystery Emblem — 5-Dungeon Demo Campaign Registry
 *
 * Data-driven configuration for the 5-Dungeon Demo:
 * - Per-chapter Battle Objectives (`'rout'` vs `'defeat_boss'`)
 * - Manual enemy & Boss spawns (`isBoss`, `stationary`, `droppableItemId`, `aiMode`)
 * - Scheduled Dungeon Stairs reinforcement waves (blocked when a unit stands on the Stairs tile)
 * - Quiz-seeded pre-battle unit recruitments
 * - Concise PMD portrait Intro & Outro dialogue cutscenes
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
  seedKey: keyof QuizRecruitSeeds;
  joinLevel: number;
  scaleStatsToLevel: boolean;
  fallbackSpeciesIds: ReadonlyArray<string>;
  introBanner: string;
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

const SERPERIOR_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  speciesName: 'Serperior',
  nickname: 'Chancellor Serperior',
};

const KECLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KECLEON_PMD_ASSET_ID,
  speciesName: 'Kecleon',
  nickname: 'Kecleon',
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
    nickname: 'Coastal Scout',
    level: 9,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd1_enemy_1',
    x: 12,
    y: 3,
    speciesId: 'impidimp',
    nickname: 'Treasure Raider',
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
    nickname: 'Ironscale Vanguard',
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
    speciesId: 'seedot',
    nickname: 'Cliff Guerilla',
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
    nickname: 'Falls Guard',
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
    nickname: 'Cavern Striker',
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
    nickname: 'Ironclad Warden',
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
    stairsY: 2,
    enemy: {
      id: 'd4_reinf_zubat',
      x: 15,
      y: 2,
      speciesId: 'zubat',
      nickname: 'Cavern Diver',
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
    speciesId: 'seedot',
    nickname: 'Orchard Ranger',
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
    nickname: 'Canopy Captain',
    level: 11,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_enemy_3',
    x: 15,
    y: 7,
    speciesId: 'morgrem',
    nickname: 'Shadow Envoy',
    level: 11,
    heldItemId: null,
    aiMode: 'wait_until_in_range',
  },
  {
    id: 'd5_boss_nuzleaf',
    x: 17,
    y: 5,
    speciesId: 'nuzleaf',
    nickname: 'Commander Nuzleaf',
    level: 12,
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
    title: 'Beach Cave',
    subtitle: 'Dungeon 1',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 9,
    deploymentCap: 3,
    enemySpawns: DUNGEON_1_ENEMIES,
    reinforcements: [],
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('prologue'), {
        name: 'Beach Cave',
        deploymentCap: 3,
        objectiveType: 'rout',
        enemies: DUNGEON_1_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('prologue'),
      }),
    buildIntroScript: () => ({
      id: 'demo_d1_intro',
      title: 'Beach Cave',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Worried',
          text: 'Wake up, {lord}! The tide carried you into Beach Cave—{healer} and I just found you.',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Determined',
          text: 'Ironscale scouts ahead! One raider stole an Evolution Stone from the shrine!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Stay near my Dragon Aura, {partner} and {healer}. Rout the scouts and reclaim that Stone!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d1_outro',
      title: 'Beach Cave',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'We drove them off! Anyone at Level 10 can promote with an Evolution Stone!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Determined',
          text: 'Well fought, {lord}. I am Chancellor Serperior—march north to Drenched Bluff and break Captain Aron’s blockade!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_01',
    levelId: 'chapter_01',
    dungeonNumber: 2,
    title: 'Drenched Bluff',
    subtitle: 'Dungeon 2',
    objectiveType: 'defeat_boss',
    objectiveLabel: 'Defeat Boss: Captain Aron',
    recommendedLevel: 9,
    deploymentCap: 5,
    enemySpawns: DUNGEON_2_ENEMIES,
    reinforcements: [],
    recruitment: {
      seedKey: 'q2BugFlying',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['caterpie', 'pidgey'],
      introBanner: 'New allies joined your squad!',
    },
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_01'), {
        name: 'Drenched Bluff',
        deploymentCap: 5,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_2_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_01'),
      }),
    buildIntroScript: (save) => {
      const bugId = save?.campaign.quizSeeds.q2BugFlying[0] ?? 'caterpie';
      const flyId = save?.campaign.quizSeeds.q2BugFlying[1] ?? 'pidgey';
      const lines: DialogueLine[] = [
        {
          speaker: findRecruitSpeaker(save, flyId),
          side: 'right',
          emotion: 'Determined',
          text: '{lord}! Captain Aron has anchored himself atop the eastern bluff and won’t budge.',
        },
        {
          speaker: findRecruitSpeaker(save, bugId),
          side: 'right',
          emotion: 'Normal',
          text: 'Topple Aron and his entire garrison scatters!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Check their attack ranges and strike Captain Aron down!',
        },
      ];
      return {
        id: 'demo_d2_intro',
        title: 'Drenched Bluff',
        bgm: 'drenched_bluff',
        lines,
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d2_outro',
      title: 'Drenched Bluff',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'Aron’s line collapsed! Smoke signals on Mt. Bristle—let’s move out!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_02',
    levelId: 'chapter_02',
    dungeonNumber: 3,
    title: 'Mt. Bristle',
    subtitle: 'Dungeon 3',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 10,
    deploymentCap: 6,
    enemySpawns: DUNGEON_3_ENEMIES,
    reinforcements: DUNGEON_3_REINFORCEMENTS,
    recruitment: {
      seedKey: 'q3GhostPsychic',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['duskull', 'abra'],
      introBanner: 'New allies joined your squad!',
    },
    buildMap: () => {
      const base = getEffectiveChapterMap('chapter_02');
      const map = attachMapMetadata(base, {
        name: 'Mt. Bristle',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_3_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_02'),
      });
      if (!hasChapterMapOverride('chapter_02') && map.tiles[2]?.[7]) {
        map.tiles[2][7] = {
          terrainType: 'stairs',
          tilesetId: '110',
          chunkIndex: 59,
        };
      }
      return map;
    },
    buildIntroScript: (save) => {
      const ghostId = save?.campaign.quizSeeds.q3GhostPsychic[0] ?? 'duskull';
      const psyId = save?.campaign.quizSeeds.q3GhostPsychic[1] ?? 'abra';
      return {
        id: 'demo_d3_intro',
        title: 'Mt. Bristle',
        bgm: 'mt_bristle',
        lines: [
          {
            speaker: findRecruitSpeaker(save, ghostId),
            side: 'right',
            emotion: 'Worried',
            text: 'Careful, {lord}—Ironscale reserves are climbing the Dungeon Stairs!',
          },
          {
            speaker: findRecruitSpeaker(save, psyId),
            side: 'right',
            emotion: 'Determined',
            text: 'Stand directly on a Stairs tile to block reinforcements from emerging!',
          },
        ],
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d3_outro',
      title: 'Mt. Bristle',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'Mt. Bristle is clear! Wait—Kecleon’s caravan is trapped in Waterfall Cave!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_03',
    levelId: 'chapter_03',
    dungeonNumber: 4,
    title: 'Waterfall Cave',
    subtitle: 'Dungeon 4',
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
        name: 'Waterfall Cave',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_4_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_03'),
      }),
    buildIntroScript: () => ({
      id: 'demo_d4_intro',
      title: 'Waterfall Cave',
      bgm: 'waterfall_cave',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Worried',
          text: 'Help! An armored Lairon has our wagons pinned behind the falls!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Hold fast, Kecleon! Fliers and Water-types can cross the river—rout them!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d4_outro',
      title: 'Waterfall Cave',
      bgm: 'kecleon_shop',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'Saved! My shop is open on the World Map—stock up before Apple Woods!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Determined',
          text: 'Commander Nuzleaf holds Apple Woods ahead. One last victory frees the Commonwealth!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_04',
    levelId: 'chapter_04',
    dungeonNumber: 5,
    title: 'Apple Woods',
    subtitle: 'Dungeon 5 · Finale',
    objectiveType: 'defeat_boss',
    objectiveLabel: 'Defeat Boss: Commander Nuzleaf',
    recommendedLevel: 12,
    deploymentCap: 7,
    enemySpawns: DUNGEON_5_ENEMIES,
    reinforcements: DUNGEON_5_REINFORCEMENTS,
    recruitment: {
      seedKey: 'q4Electric',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['shinx'],
      introBanner: 'A new ally joined your squad!',
    },
    clearRewardItems: [{ itemId: 'evolution_stone', quantity: 1 }],
    isDemoFinale: true,
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_04'), {
        name: 'Apple Woods',
        deploymentCap: 7,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_5_ENEMIES,
        preserveCustomEnemies: hasChapterMapOverride('chapter_04'),
      }),
    buildIntroScript: (save) => {
      const elecId = save?.campaign.quizSeeds.q4Electric[0] ?? 'shinx';
      return {
        id: 'demo_d5_intro',
        title: 'Apple Woods',
        bgm: 'apple_woods',
        lines: [
          {
            speaker: findRecruitSpeaker(save, elecId),
            side: 'right',
            emotion: 'Determined',
            text: '{lord}! Commander Nuzleaf’s captains hold the orchard ahead.',
          },
          {
            speaker: { kind: 'partner' },
            side: 'right',
            emotion: 'Determined',
            text: 'Use the glowing Wonder Tiles to heal each turn—let’s defeat Nuzleaf!',
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
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'Magnificent, {lord}! Nuzleaf is retreating—the Verdant Commonwealth is safe!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'Thanks for playing the Mystery Emblem Demo! New Game+ Custom Roster is now unlocked!',
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
