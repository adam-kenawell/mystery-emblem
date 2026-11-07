/**
 * Mystery Emblem — Modular Campaign & 5-Dungeon Demo Registry
 *
 * Central data-driven configuration for multi-chapter campaigns (starting with the 5-Dungeon Demo
 * and directly reusable across the 25 Main Chapters + 6 Paralogues):
 * - Per-chapter Battle Objectives (`'rout'` vs `'defeat_boss'`)
 * - Manual enemy & Boss spawns (`isBoss`, `stationary`, `droppableItemId`, `aiMode`)
 * - Scheduled Dungeon Stairs reinforcement waves (blocked when any unit stands on the Stairs tile)
 * - Quiz-seeded pre-battle unit recruitments (scaled to the campaign's join level)
 * - Authentic PMD portrait Intro & Outro dialogue cutscenes (with Chancellor Serperior `'0497'`,
 *   Master Merchant Kecleon `'0352'`, Lord, Partner, Healer, and chapter recruits)
 */

import type { DialogueLine, DialogueScript, DialogueSpeakerRef } from '../ui/DialogueOverlay';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonMapDefinition,
  KecleonShopType,
  QuizRecruitSeeds,
  SaveData,
} from '../types/schemas';
import { getEffectiveChapterMap, hasChapterMapOverride } from './chapterMapRegistry';
import { getSpeciesById } from './index';
import { KECLEON_PMD_ASSET_ID } from './overworldMapData';
import type { ManualEnemyBattleSpawn } from './playableBattleMap';
import { cloneDungeonMap } from './testDungeonMap';

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
  nickname: 'Master Merchant Kecleon',
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
  }
): DungeonMapDefinition {
  const cloned = cloneDungeonMap(baseMap);
  cloned.name = opts.name;
  cloned.deploymentCap = opts.deploymentCap;
  cloned.objectiveType = opts.objectiveType;
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
  return cloned;
}

// ============================================================================
// 1. DUNGEON 1 — Beach Cave (`prologue`)
//    - Objective: Rout All Enemies (`'rout'`)
//    - Item Drop: Treasure Raider Impidimp drops `evolution_stone`
//    - Level 9 start -> Level 10 level-up + Evolution Stone ready!
// ============================================================================

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

// ============================================================================
// 2. DUNGEON 2 — Drenched Bluff (`chapter_01`)
//    - Pre-battle Recruits: Q2 Bug & Flying Duo (Lv. 9)
//    - Objective: Defeat Enemy Leader (`'defeat_boss'`)
//    - Stationary Boss: Captain Aron (`isBoss: true, stationary: true`)
// ============================================================================

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

// ============================================================================
// 3. DUNGEON 3 — Mt. Bristle (`chapter_02`)
//    - Pre-battle Recruits: Q3 Ghost & Psychic Duo (Lv. 9)
//    - Objective: Rout All Enemies (`'rout'`)
//    - Dungeon Stairs Reinforcements on Turn 2 & Turn 3 (blockable by standing on Stairs!)
// ============================================================================

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

// ============================================================================
// 4. DUNGEON 4 — Waterfall Cave (`chapter_03`)
//    - Objective: Rout All Enemies (`'rout'`)
//    - Unlocks & spawns a guaranteed Kecleon Shop on clear!
// ============================================================================

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

// ============================================================================
// 5. DUNGEON 5 — Apple Woods (`chapter_04` — Demo Finale)
//    - Pre-battle Recruit: Q4 Electric Solo (Lv. 9)
//    - Objective: Defeat Boss Commander Nuzleaf (`'defeat_boss'`)
// ============================================================================

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

// ============================================================================
// Exported 5-Dungeon Demo Campaign Chapters
// ============================================================================

export const DEMO_CAMPAIGN_CHAPTERS: ReadonlyArray<CampaignChapterConfig> = [
  {
    nodeId: 'prologue',
    levelId: 'prologue',
    dungeonNumber: 1,
    title: 'Dungeon 1 — Beach Cave',
    subtitle: 'Awakening on the Commonwealth Coast',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies',
    recommendedLevel: 9,
    deploymentCap: 3,
    enemySpawns: DUNGEON_1_ENEMIES,
    reinforcements: [],
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('prologue'), {
        name: 'Dungeon 1 — Beach Cave',
        deploymentCap: 3,
        objectiveType: 'rout',
        enemies: DUNGEON_1_ENEMIES,
      }),
    buildIntroScript: () => ({
      id: 'demo_d1_intro',
      title: 'Dungeon 1 — Beach Cave',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Worried',
          text: 'Wake up, {lord}! The tide carried you right into Beach Cave—thank goodness {healer} and I found you!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Surprised',
          text: 'My head is spinning... Wait—do you hear steel boots echoing deeper inside the cavern?',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Determined',
          text: 'Ironscale Empire scouts! One of their Treasure Raiders is clutching a glowing Evolution Stone stolen from the shrine!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Stay close to my Dragon Aura, {partner} and {healer}. Let’s rout every scout here and reclaim that Evolution Stone!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d1_outro',
      title: 'Beach Cave Secured',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'We drove them back, {lord}! And anyone who reaches Level 10 can promote with an Evolution Stone right away!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Normal',
          text: 'Well fought, young Dragon Lord. I am Chancellor Serperior of the Verdant Commonwealth.',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Determined',
          text: 'Imperial Captain Aron has fortified Drenched Bluff just north of here. March across the World Map and break his blockade!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_01',
    levelId: 'chapter_01',
    dungeonNumber: 2,
    title: 'Dungeon 2 — Drenched Bluff',
    subtitle: 'Break Captain Aron’s Coastal Blockade',
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
      introBanner: 'Two Commonwealth scouts volunteer to join your march up Drenched Bluff!',
    },
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_01'), {
        name: 'Dungeon 2 — Drenched Bluff',
        deploymentCap: 5,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_2_ENEMIES,
      }),
    buildIntroScript: (save) => {
      const bugId = save?.campaign.quizSeeds.q2BugFlying[0] ?? 'caterpie';
      const flyId = save?.campaign.quizSeeds.q2BugFlying[1] ?? 'pidgey';
      const lines: DialogueLine[] = [
        {
          speaker: findRecruitSpeaker(save, flyId),
          side: 'right',
          emotion: 'Determined',
          text: 'Reporting from the ridge, {lord}! Captain Aron has anchored himself atop the eastern bluff and refuses to budge an inch!',
        },
        {
          speaker: findRecruitSpeaker(save, bugId),
          side: 'right',
          emotion: 'Normal',
          text: 'Because Aron won’t leave his post, his Danger Area only reaches right around his foothold—and toppling him scatters the whole garrison!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Understood! Watch their attack ranges—enemies will hold position until we step in range. Target Captain Aron to claim victory!',
        },
      ];
      return {
        id: 'demo_d2_intro',
        title: 'Dungeon 2 — Drenched Bluff',
        bgm: 'drenched_bluff',
        lines,
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d2_outro',
      title: 'Drenched Bluff Cleared',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'Captain Aron’s shield line collapsed the moment he fell! The road toward Mt. Bristle is open!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Normal',
          text: 'Look toward the northern peaks, {partner}—smoke signals from the Highland Watchtower. Let’s move out!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_02',
    levelId: 'chapter_02',
    dungeonNumber: 3,
    title: 'Dungeon 3 — Mt. Bristle',
    subtitle: 'Ambush from the Dungeon Stairs',
    objectiveType: 'rout',
    objectiveLabel: 'Rout All Enemies (Watch the Stairs!)',
    recommendedLevel: 10,
    deploymentCap: 6,
    enemySpawns: DUNGEON_3_ENEMIES,
    reinforcements: DUNGEON_3_REINFORCEMENTS,
    recruitment: {
      seedKey: 'q3GhostPsychic',
      joinLevel: DEMO_STARTING_LEVEL,
      scaleStatsToLevel: true,
      fallbackSpeciesIds: ['duskull', 'abra'],
      introBanner: 'Mystic sentries from Mt. Bristle pledge their aid against the Ironscale ambush!',
    },
    buildMap: () => {
      const base = getEffectiveChapterMap('chapter_02');
      const map = attachMapMetadata(base, {
        name: 'Dungeon 3 — Mt. Bristle',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_3_ENEMIES,
      });
      if (!hasChapterMapOverride('chapter_02')) {
        // Place a northern-pass Dungeon Stairs tile at (7, 2) alongside (18, 2) and (18, 8)
        if (map.tiles[2]?.[7]) {
          map.tiles[2][7] = {
            terrainType: 'stairs',
            tilesetId: '110',
            chunkIndex: 59,
          };
        }
      }
      return map;
    },
    buildIntroScript: (save) => {
      const ghostId = save?.campaign.quizSeeds.q3GhostPsychic[0] ?? 'duskull';
      const psyId = save?.campaign.quizSeeds.q3GhostPsychic[1] ?? 'abra';
      return {
        id: 'demo_d3_intro',
        title: 'Dungeon 3 — Mt. Bristle',
        bgm: 'mt_bristle',
        lines: [
          {
            speaker: findRecruitSpeaker(save, ghostId),
            side: 'right',
            emotion: 'Worried',
            text: 'Careful on the crags, {lord}... Ironscale reserves are climbing up through the Dungeon Stairs tunnels!',
          },
          {
            speaker: findRecruitSpeaker(save, psyId),
            side: 'right',
            emotion: 'Determined',
            text: 'Reinforcements emerge from the Stairs starting on Turn 2—unless one of our allies stands directly on a Stairs tile to seal it!',
          },
          {
            speaker: { kind: 'lord' },
            side: 'left',
            emotion: 'Determined',
            text: 'Great intel! Either seal the northern Stairs early or rally together to crush the reinforcements and rout the peak!',
          },
        ],
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d3_outro',
      title: 'Mt. Bristle Secured',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Happy',
          text: 'Every tunnel on Mt. Bristle is secure! Look below—the trail winds straight down to Waterfall Cave.',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'Wait—isn’t Master Merchant Kecleon’s caravan trapped behind Waterfall Cave? Let’s hurry!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_03',
    levelId: 'chapter_03',
    dungeonNumber: 4,
    title: 'Dungeon 4 — Waterfall Cave',
    subtitle: 'Rescue the Caravan Beneath the Falls',
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
        name: 'Dungeon 4 — Waterfall Cave',
        deploymentCap: 6,
        objectiveType: 'rout',
        enemies: DUNGEON_4_ENEMIES,
      }),
    buildIntroScript: () => ({
      id: 'demo_d4_intro',
      title: 'Dungeon 4 — Waterfall Cave',
      bgm: 'waterfall_cave',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Worried',
          text: 'Help! An armored Lairon warden has our merchant wagons pinned behind the subterranean falls!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Hold tight, Master Kecleon! Water-types and fliers can cross the underground river cleanly—let’s rout that garrison!',
        },
      ],
    }),
    buildOutroScript: () => ({
      id: 'demo_d4_outro',
      title: 'Kecleon Caravan Rescued!',
      bgm: 'kecleon_shop',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'Splendid! Our caravan is saved! I’ve pitched a Kecleon Shop right here on the Overworld map—stock up anytime before Apple Woods!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Determined',
          text: '{lord}, Commander Nuzleaf has gathered the last Imperial strike force inside Apple Woods. One final push will secure the Commonwealth!',
        },
      ],
    }),
  },
  {
    nodeId: 'chapter_04',
    levelId: 'chapter_04',
    dungeonNumber: 5,
    title: 'Dungeon 5 — Apple Woods',
    subtitle: 'Demo Finale — Showdown in the Canopy',
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
      introBanner: 'A lightning-quick tracker steps out of Apple Woods to join your vanguard!',
    },
    clearRewardItems: [{ itemId: 'evolution_stone', quantity: 1 }],
    isDemoFinale: true,
    buildMap: () =>
      attachMapMetadata(getEffectiveChapterMap('chapter_04'), {
        name: 'Dungeon 5 — Apple Woods (Finale)',
        deploymentCap: 7,
        objectiveType: 'defeat_boss',
        enemies: DUNGEON_5_ENEMIES,
      }),
    buildIntroScript: (save) => {
      const elecId = save?.campaign.quizSeeds.q4Electric[0] ?? 'shinx';
      return {
        id: 'demo_d5_intro',
        title: 'Dungeon 5 — Apple Woods',
        bgm: 'apple_woods',
        lines: [
          {
            speaker: findRecruitSpeaker(save, elecId),
            side: 'right',
            emotion: 'Determined',
            text: 'You must be {lord}! Commander Nuzleaf is marshaling evolved Corvisquire and Morgrem captains deep inside Apple Woods!',
          },
          {
            speaker: { kind: 'partner' },
            side: 'right',
            emotion: 'Determined',
            text: 'Look at the glowing Wonder Tiles in the clearing—standing on them restores HP at the start of our phase!',
          },
          {
            speaker: { kind: 'lord' },
            side: 'left',
            emotion: 'Determined',
            text: 'Everyone, give it everything we’ve learned! Defeat Commander Nuzleaf and free the Verdant Commonwealth!',
          },
        ],
      };
    },
    buildOutroScript: () => ({
      id: 'demo_d5_outro',
      title: 'Verdant Commonwealth Liberated!',
      bgm: 'victory_fanfare',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'We did it, {lord}! Commander Nuzleaf is retreating across the border—Apple Woods and the Commonwealth are safe!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'Magnificent, {lord}! Your squad’s bond has proven that Emperor Kingambit’s legions are not invincible.',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'Thank you for playing the Mystery Emblem 5-Dungeon Demo! New Game+ Custom Roster Selection is now unlocked, and your save remains active on the World Map!',
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
