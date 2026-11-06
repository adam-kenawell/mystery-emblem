/**
 * Mystery Emblem — Overworld Continent Graph, Kecleon Shop Catalogs & Manual Skirmish Encounters (Step 4)
 *
 * Designed as a clean, reusable data-driven registry so both:
 * 1. The Admin Dev Tools Overworld Sandbox, and
 * 2. The upcoming playable Demo / 5-Kingdom Campaign (`OverworldScene`)
 * share 100% of their graph topology, path waypoints, Kecleon Shop tables, and Feral Skirmish spawns.
 *
 * Strictly obeys:
 * - Rule 1: 100% Data-Driven Manual Balance (Zero automated PokéAPI stat formulas)
 * - Rule 5: Strict Faction Separation (Skirmish scouts & enemies use enemy-only lines exclusively)
 */

import wonderMapAssetUrl from '../../../assets/overworld/wonder_map.jpg?url';
import type {
  DungeonMapDefinition,
  ItemDefinition,
  KecleonShopType,
  SkirmishSpawnState,
  StatBlockSeven,
} from '../types/schemas';
import { getEffectiveChapterMap } from './chapterMapRegistry';
import { ITEMS_LIST, getItemById } from './index';
import type { ManualEnemyBattleSpawn } from './playableBattleMap';
import { cloneDungeonMap } from './testDungeonMap';

export const OVERWORLD_MAP_IMAGE_URL: string = wonderMapAssetUrl;
export const OVERWORLD_MAP_NATIVE_WIDTH = 504;
export const OVERWORLD_MAP_NATIVE_HEIGHT = 336;

/** Master Merchant Kecleon PMDCollab / SpriteCollab National Dex asset ID */
export const KECLEON_PMD_ASSET_ID = '0352';

export type OverworldNodeKind = 'story' | 'paralogue';

export interface OverworldPoint {
  x: number;
  y: number;
}

export interface OverworldNodeDefinition {
  id: string;
  code: string;
  name: string;
  kingdom: string;
  description: string;
  kind: OverworldNodeKind;
  act: 1 | 2 | 3 | 4;
  /** Native pixel coordinate (`0..504`, `0..336`) on `wonder_map.jpg` */
  x: number;
  y: number;
  /** Playable `CHAPTER_LEVEL_CATALOG` battle map ID launched when entering this node */
  levelId: string;
  /** Biome tileset ID (`"001"`..`"143"`) associated with Feral Skirmishes on this node */
  tilesetId: string;
  recommendedLevel: number;
  /** Enemy-only species displayed on the Overworld map when a Feral Skirmish spawns here */
  skirmishScoutSpeciesId: string;
  /** Gold awarded upon clearing this chapter for the first time */
  clearGoldReward: number;
  /** Downstream Overworld node IDs unlocked when this node is cleared */
  unlocksNodeIdsOnClear: ReadonlyArray<string>;
  /** True on Paralogue 2 (`Oran Forest`), permanently unlocking random Kecleon Shops */
  unlocksKecleonShopsOnClear?: boolean;
  /** True for nodes available at the start of a fresh campaign (`prologue`) */
  initiallyUnlocked?: boolean;
}

export interface OverworldEdgeDefinition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** Ordered intermediate pixel waypoints from `fromNodeId` -> `toNodeId` on `wonder_map.jpg` */
  waypoints: ReadonlyArray<OverworldPoint>;
}

export interface OverworldGraphDefinition {
  id: string;
  name: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  startNodeId: string;
  nodes: ReadonlyArray<OverworldNodeDefinition>;
  edges: ReadonlyArray<OverworldEdgeDefinition>;
}

/**
 * Primary Continent Overworld Graph anchored to exact PMD Wonder Map landmarks (`504x336`).
 * Covers the complete Act 1 / Demo arc (`Prologue` + `Chapters 1–6` + `Paralogues 1–2`) plus
 * frontier Act 2 border gateways across the Mistveil Enclave and Mirage Sultanate.
 */
export const OVERWORLD_NODES: ReadonlyArray<OverworldNodeDefinition> = [
  {
    id: 'prologue',
    code: 'Prologue',
    name: 'Beach Cave',
    kingdom: 'Verdant Commonwealth',
    description:
      'Where you washed ashore beside your Partner and awakened your dormant Dragon Aura against Ironscale scouts.',
    kind: 'story',
    act: 1,
    x: 208,
    y: 194,
    levelId: 'prologue',
    tilesetId: '001',
    recommendedLevel: 1,
    skirmishScoutSpeciesId: 'zigzagoon_galar',
    clearGoldReward: 500,
    unlocksNodeIdsOnClear: ['chapter_01'],
    initiallyUnlocked: true,
  },
  {
    id: 'chapter_01',
    code: 'Ch. 1',
    name: 'Drenched Bluff',
    kingdom: 'Verdant Commonwealth',
    description:
      'Sea-sprayed coastal bluffs climbing toward Chancellor Serperior’s capital. Unlocks wider Overworld travel.',
    kind: 'story',
    act: 1,
    x: 188,
    y: 138,
    levelId: 'drenched_bluff_vanguard',
    tilesetId: '003',
    recommendedLevel: 2,
    skirmishScoutSpeciesId: 'zigzagoon_galar',
    clearGoldReward: 600,
    unlocksNodeIdsOnClear: ['chapter_02', 'chapter_03'],
  },
  {
    id: 'chapter_02',
    code: 'Ch. 2',
    name: 'Mt. Bristle',
    kingdom: 'Verdant Commonwealth',
    description:
      'Jagged highland crags overlooking the northern border fort held against Gothita’s Ironscale raiders.',
    kind: 'story',
    act: 1,
    x: 308,
    y: 122,
    levelId: 'chapter_02',
    tilesetId: '014',
    recommendedLevel: 3,
    skirmishScoutSpeciesId: 'gothita',
    clearGoldReward: 650,
    unlocksNodeIdsOnClear: ['chapter_03'],
  },
  {
    id: 'chapter_03',
    code: 'Ch. 3',
    name: 'Waterfall Cave',
    kingdom: 'Verdant Commonwealth',
    description:
      'Subterranean river caverns behind the roaring falls where Commonwealth envoys are held captive.',
    kind: 'story',
    act: 1,
    x: 244,
    y: 152,
    levelId: 'chapter_03',
    tilesetId: '016',
    recommendedLevel: 4,
    skirmishScoutSpeciesId: 'zubat',
    clearGoldReward: 700,
    unlocksNodeIdsOnClear: ['paralogue_01', 'chapter_04'],
  },
  {
    id: 'paralogue_01',
    code: 'Para. 1',
    name: 'Lush Prairie',
    kingdom: 'Verdant Commonwealth',
    description:
      'Sunlit clover meadows where a sleepy Slakoth with Hidden Potential (+20% growths) is cornered by feral bandits.',
    kind: 'paralogue',
    act: 1,
    x: 256,
    y: 106,
    levelId: 'paralogue_01',
    tilesetId: '142',
    recommendedLevel: 4,
    skirmishScoutSpeciesId: 'seedot',
    clearGoldReward: 750,
    unlocksNodeIdsOnClear: [],
  },
  {
    id: 'chapter_04',
    code: 'Ch. 4',
    name: 'Apple Woods',
    kingdom: 'Verdant Commonwealth',
    description:
      'Dense orchard canopy dotted with Wonder Tiles where Seedot guerillas and Feral shock troops ambush travelers.',
    kind: 'story',
    act: 1,
    x: 298,
    y: 150,
    levelId: 'chapter_04',
    tilesetId: '042',
    recommendedLevel: 5,
    skirmishScoutSpeciesId: 'seedot',
    clearGoldReward: 750,
    unlocksNodeIdsOnClear: ['chapter_05', 'paralogue_02'],
  },
  {
    id: 'paralogue_02',
    code: 'Para. 2',
    name: 'Oran Forest',
    kingdom: 'Verdant Commonwealth',
    description:
      'Ancient elemental berry shrine. Rescuing Master Merchant Kecleon permanently unlocks Kecleon Shops across the map!',
    kind: 'paralogue',
    act: 1,
    x: 236,
    y: 126,
    levelId: 'paralogue_02',
    tilesetId: '120',
    recommendedLevel: 6,
    skirmishScoutSpeciesId: 'venipede',
    clearGoldReward: 850,
    unlocksNodeIdsOnClear: [],
    unlocksKecleonShopsOnClear: true,
  },
  {
    id: 'chapter_05',
    code: 'Ch. 5',
    name: 'Craggy Coast',
    kingdom: 'Verdant Commonwealth',
    description:
      'Wind-lashed sea cliffs where a frontline trio helps hold the coastal highway against Sandile and Impidimp.',
    kind: 'story',
    act: 1,
    x: 284,
    y: 184,
    levelId: 'chapter_05',
    tilesetId: '108',
    recommendedLevel: 6,
    skirmishScoutSpeciesId: 'sandile',
    clearGoldReward: 800,
    unlocksNodeIdsOnClear: ['chapter_06'],
  },
  {
    id: 'chapter_06',
    code: 'Ch. 6',
    name: 'Mt. Horn',
    kingdom: 'Cragforge Clans',
    description:
      'Snow-crowned mountain switchbacks leading into Cragforge territory, blockaded by Warlord Aggron and Sky Marshal Corviknight.',
    kind: 'story',
    act: 1,
    x: 345,
    y: 174,
    levelId: 'chapter_06',
    tilesetId: '014',
    recommendedLevel: 8,
    skirmishScoutSpeciesId: 'aron',
    clearGoldReward: 950,
    unlocksNodeIdsOnClear: ['chapter_07', 'chapter_10'],
  },
  {
    id: 'chapter_07',
    code: 'Ch. 7',
    name: 'Foggy Forest',
    kingdom: 'Mistveil Enclave',
    description:
      'Misty pine wetlands of High Seeress Milotic where the first Evolution Stones appear.',
    kind: 'story',
    act: 2,
    x: 368,
    y: 102,
    levelId: 'chapter_07',
    tilesetId: '096',
    recommendedLevel: 9,
    skirmishScoutSpeciesId: 'impidimp',
    clearGoldReward: 1000,
    unlocksNodeIdsOnClear: ['chapter_09'],
  },
  {
    id: 'chapter_09',
    code: 'Ch. 9',
    name: 'Amp Plains',
    kingdom: 'Mistveil Enclave',
    description:
      'Thunder-swept eastern savannah where Gothorita’s false-flag saboteurs operate along the border.',
    kind: 'story',
    act: 2,
    x: 432,
    y: 124,
    levelId: 'chapter_09',
    tilesetId: '142',
    recommendedLevel: 11,
    skirmishScoutSpeciesId: 'elekid',
    clearGoldReward: 1100,
    unlocksNodeIdsOnClear: [],
  },
  {
    id: 'chapter_10',
    code: 'Ch. 10',
    name: 'Northern Desert',
    kingdom: 'Mirage Sultanate',
    description:
      'Golden sand dunes outside Sultan Hippowdon’s oasis besieged by Krokorok’s desert raiders.',
    kind: 'story',
    act: 2,
    x: 182,
    y: 92,
    levelId: 'chapter_10',
    tilesetId: '017',
    recommendedLevel: 12,
    skirmishScoutSpeciesId: 'sandile',
    clearGoldReward: 1150,
    unlocksNodeIdsOnClear: [],
  },
];

export const OVERWORLD_EDGES: ReadonlyArray<OverworldEdgeDefinition> = [
  {
    id: 'edge_prologue_ch1',
    fromNodeId: 'prologue',
    toNodeId: 'chapter_01',
    waypoints: [
      { x: 198, y: 178 },
      { x: 190, y: 158 },
    ],
  },
  {
    id: 'edge_ch1_para2',
    fromNodeId: 'chapter_01',
    toNodeId: 'paralogue_02',
    waypoints: [
      { x: 208, y: 130 },
      { x: 222, y: 128 },
    ],
  },
  {
    id: 'edge_ch1_ch3',
    fromNodeId: 'chapter_01',
    toNodeId: 'chapter_03',
    waypoints: [
      { x: 206, y: 146 },
      { x: 224, y: 154 },
    ],
  },
  {
    id: 'edge_para2_para1',
    fromNodeId: 'paralogue_02',
    toNodeId: 'paralogue_01',
    waypoints: [{ x: 246, y: 116 }],
  },
  {
    id: 'edge_ch3_para1',
    fromNodeId: 'chapter_03',
    toNodeId: 'paralogue_01',
    waypoints: [
      { x: 252, y: 136 },
      { x: 255, y: 120 },
    ],
  },
  {
    id: 'edge_para1_ch2',
    fromNodeId: 'paralogue_01',
    toNodeId: 'chapter_02',
    waypoints: [
      { x: 276, y: 108 },
      { x: 292, y: 114 },
    ],
  },
  {
    id: 'edge_ch1_ch2_north_trail',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_03',
    waypoints: [
      { x: 288, y: 132 },
      { x: 266, y: 142 },
    ],
  },
  {
    id: 'edge_ch3_ch4',
    fromNodeId: 'chapter_03',
    toNodeId: 'chapter_04',
    waypoints: [
      { x: 264, y: 154 },
      { x: 282, y: 152 },
    ],
  },
  {
    id: 'edge_ch2_ch4',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_04',
    waypoints: [{ x: 304, y: 136 }],
  },
  {
    id: 'edge_ch4_ch5',
    fromNodeId: 'chapter_04',
    toNodeId: 'chapter_05',
    waypoints: [{ x: 288, y: 168 }],
  },
  {
    id: 'edge_prologue_ch5',
    fromNodeId: 'prologue',
    toNodeId: 'chapter_05',
    waypoints: [
      { x: 236, y: 192 },
      { x: 262, y: 190 },
    ],
  },
  {
    id: 'edge_ch5_ch6',
    fromNodeId: 'chapter_05',
    toNodeId: 'chapter_06',
    waypoints: [
      { x: 308, y: 184 },
      { x: 326, y: 180 },
    ],
  },
  {
    id: 'edge_ch4_ch6',
    fromNodeId: 'chapter_04',
    toNodeId: 'chapter_06',
    waypoints: [
      { x: 320, y: 158 },
      { x: 332, y: 166 },
    ],
  },
  {
    id: 'edge_ch2_ch7',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_07',
    waypoints: [
      { x: 330, y: 112 },
      { x: 350, y: 106 },
    ],
  },
  {
    id: 'edge_ch6_ch7',
    fromNodeId: 'chapter_06',
    toNodeId: 'chapter_07',
    waypoints: [
      { x: 358, y: 148 },
      { x: 364, y: 124 },
    ],
  },
  {
    id: 'edge_ch7_ch9',
    fromNodeId: 'chapter_07',
    toNodeId: 'chapter_09',
    waypoints: [
      { x: 396, y: 108 },
      { x: 416, y: 116 },
    ],
  },
  {
    id: 'edge_ch1_ch10',
    fromNodeId: 'chapter_01',
    toNodeId: 'chapter_10',
    waypoints: [
      { x: 184, y: 120 },
      { x: 182, y: 106 },
    ],
  },
];

export const DEFAULT_OVERWORLD_GRAPH: OverworldGraphDefinition = {
  id: 'continent_wonder_map',
  name: 'Five Kingdoms — Wonder Map',
  imageUrl: OVERWORLD_MAP_IMAGE_URL,
  imageWidth: OVERWORLD_MAP_NATIVE_WIDTH,
  imageHeight: OVERWORLD_MAP_NATIVE_HEIGHT,
  startNodeId: 'prologue',
  nodes: OVERWORLD_NODES,
  edges: OVERWORLD_EDGES,
};

/**
 * Demo-ready subgraph helper: allows future Demo mode to filter to Act 1 nodes (`maxAct = 1`)
 * or custom chapter subsets without duplicating coordinates or path waypoints.
 */
export function getOverworldGraph(options?: { maxAct?: 1 | 2 | 3 | 4 }): OverworldGraphDefinition {
  if (!options?.maxAct) {
    return DEFAULT_OVERWORLD_GRAPH;
  }
  const nodes = OVERWORLD_NODES.filter((n) => n.act <= options.maxAct!);
  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges = OVERWORLD_EDGES.filter(
    (e) => nodeSet.has(e.fromNodeId) && nodeSet.has(e.toNodeId)
  );
  return {
    ...DEFAULT_OVERWORLD_GRAPH,
    id: `continent_act_${options.maxAct}`,
    nodes: nodes.map((n) => ({
      ...n,
      unlocksNodeIdsOnClear: n.unlocksNodeIdsOnClear.filter((id) => nodeSet.has(id)),
    })),
    edges,
  };
}

export function getOverworldNodeById(
  nodeId: string,
  graph: OverworldGraphDefinition = DEFAULT_OVERWORLD_GRAPH
): OverworldNodeDefinition | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

// ============================================================================
// Kecleon Shop Types & Curated Inventory Builder (Spec 1.2 & Step 4)
// ============================================================================

export const ALL_KECLEON_SHOP_TYPES: ReadonlyArray<KecleonShopType> = [
  'tm_shop',
  'held_shop',
  'healing_shop',
  'x_item_shop',
];

export interface KecleonShopTypeMetadata {
  shopType: KecleonShopType;
  title: string;
  shortBadge: string;
  greeting: string;
  accentColor: string;
  stockCount: number;
}

export const KECLEON_SHOP_METADATA: Readonly<Record<KecleonShopType, KecleonShopTypeMetadata>> = {
  tm_shop: {
    shopType: 'tm_shop',
    title: 'Kecleon TM Emporium',
    shortBadge: 'TM SHOP',
    greeting:
      'Welcome, friend! Rare single-use Technical Machines fresh from our caravan—teach your squad new coverage!',
    accentColor: '#90d8f8',
    stockCount: 6,
  },
  held_shop: {
    shopType: 'held_shop',
    title: 'Kecleon Gear & Berry Stall',
    shortBadge: 'HELD SHOP',
    greeting:
      'Step right up! Finest combat gear, type enhancers, and fresh Oran & Sitrus Berries in the Five Kingdoms!',
    accentColor: '#68d888',
    stockCount: 6,
  },
  healing_shop: {
    shopType: 'healing_shop',
    title: 'Kecleon Apothecary & Stones',
    shortBadge: 'HEAL SHOP',
    greeting:
      'Stock up before your next march! Potions, Full Heals, Reviver Seeds, and rare Evolution Stones!',
    accentColor: '#f8d048',
    stockCount: 6,
  },
  x_item_shop: {
    shopType: 'x_item_shop',
    title: 'Kecleon Tactical X-Items',
    shortBadge: 'X-SHOP',
    greeting:
      'Need a decisive edge against an Imperial commander? Our X-Items boost a Pokémon for an entire battle!',
    accentColor: '#ff9868',
    stockCount: 6,
  },
};

export function getCatalogItemsForShopType(shopType: KecleonShopType): ItemDefinition[] {
  return ITEMS_LIST.filter((item) => item.shopType === shopType && item.buyPrice !== null);
}

export function buildKecleonShopInventory(
  shopType: KecleonShopType,
  rng: () => number = Math.random
): string[] {
  const pool = getCatalogItemsForShopType(shopType).map((item) => item.id);
  const meta = KECLEON_SHOP_METADATA[shopType];
  if (pool.length <= meta.stockCount) {
    return [...pool];
  }

  // Deterministic Fisher-Yates sample using supplied RNG
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  const picked = copy.slice(0, meta.stockCount);

  // Sort by buyPrice ascending for clean shop shelf presentation
  picked.sort((a, b) => (getItemById(a)?.buyPrice ?? 0) - (getItemById(b)?.buyPrice ?? 0));
  return picked;
}

// ============================================================================
// Manual Feral Skirmish Encounter Tiers (Rule 1 & Rule 5 Compliant)
// ============================================================================

export interface ManualSkirmishMemberTemplate {
  speciesId: string;
  nickname: string;
  level: number;
  stats: StatBlockSeven;
  moveIds: string[];
  equippedMoveId: string;
}

/**
 * 100% manually balanced Feral Raider encounter squads (zero PokéAPI formulas; strictly enemy-only lines).
 */
export const FERAL_SKIRMISH_SQUADS_BY_TIER: ReadonlyArray<{
  maxRecommendedLevel: number;
  goldBounty: number;
  members: ReadonlyArray<ManualSkirmishMemberTemplate>;
}> = [
  {
    maxRecommendedLevel: 3,
    goldBounty: 350,
    members: [
      {
        speciesId: 'zigzagoon_galar',
        nickname: 'Feral Outrider',
        level: 2,
        stats: { hp: 15, atk: 5, def: 4, spa: 3, spd: 4, spe: 7, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'seedot',
        nickname: 'Feral Forager',
        level: 2,
        stats: { hp: 15, atk: 5, def: 5, spa: 4, spd: 5, spe: 5, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'impidimp',
        nickname: 'Feral Hexer',
        level: 2,
        stats: { hp: 14, atk: 5, def: 3, spa: 6, spd: 4, spe: 6, mov: 5 },
        moveIds: ['assurance', 'snarl'],
        equippedMoveId: 'snarl',
      },
    ],
  },
  {
    maxRecommendedLevel: 6,
    goldBounty: 450,
    members: [
      {
        speciesId: 'sandile',
        nickname: 'Feral Dune Stalker',
        level: 4,
        stats: { hp: 18, atk: 7, def: 5, spa: 4, spd: 4, spe: 6, mov: 5 },
        moveIds: ['bite'],
        equippedMoveId: 'bite',
      },
      {
        speciesId: 'venipede',
        nickname: 'Feral Bristleback',
        level: 4,
        stats: { hp: 17, atk: 6, def: 6, spa: 4, spd: 5, spe: 6, mov: 5 },
        moveIds: ['poison_sting', 'bug_bite'],
        equippedMoveId: 'bug_bite',
      },
      {
        speciesId: 'gothita',
        nickname: 'Feral Channeler',
        level: 4,
        stats: { hp: 16, atk: 4, def: 5, spa: 7, spd: 7, spe: 5, mov: 5 },
        moveIds: ['confusion'],
        equippedMoveId: 'confusion',
      },
    ],
  },
  {
    maxRecommendedLevel: 40,
    goldBounty: 600,
    members: [
      {
        speciesId: 'pawniard',
        nickname: 'Feral Vanguard',
        level: 7,
        stats: { hp: 21, atk: 8, def: 7, spa: 4, spd: 5, spe: 6, mov: 5 },
        moveIds: ['metal_claw', 'assurance'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'rookidee',
        nickname: 'Feral Sky Harrier',
        level: 7,
        stats: { hp: 19, atk: 7, def: 5, spa: 4, spd: 5, spe: 8, mov: 6 },
        moveIds: ['peck'],
        equippedMoveId: 'peck',
      },
      {
        speciesId: 'aron',
        nickname: 'Feral Cragbreaker',
        level: 7,
        stats: { hp: 23, atk: 8, def: 9, spa: 4, spd: 5, spe: 4, mov: 4 },
        moveIds: ['metal_claw', 'rock_tomb'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'gothita',
        nickname: 'Feral Mindweaver',
        level: 7,
        stats: { hp: 18, atk: 4, def: 6, spa: 9, spd: 8, spe: 6, mov: 5 },
        moveIds: ['confusion', 'psybeam'],
        equippedMoveId: 'psybeam',
      },
    ],
  },
];

export function buildSkirmishBattlePayload(
  node: OverworldNodeDefinition,
  skirmish: SkirmishSpawnState
): {
  customMap: DungeonMapDefinition;
  enemyOverrides: ManualEnemyBattleSpawn[];
  goldBounty: number;
} {
  const baseMap = cloneDungeonMap(getEffectiveChapterMap(node.levelId));
  const tier =
    FERAL_SKIRMISH_SQUADS_BY_TIER.find(
      (t) => skirmish.recommendedLevel <= t.maxRecommendedLevel
    ) ?? FERAL_SKIRMISH_SQUADS_BY_TIER[FERAL_SKIRMISH_SQUADS_BY_TIER.length - 1]!;

  const fallbackCoords: ReadonlyArray<{ x: number; y: number }> = [
    { x: Math.max(2, baseMap.width - 6), y: Math.floor(baseMap.height / 2) },
    { x: Math.max(2, baseMap.width - 5), y: Math.max(2, Math.floor(baseMap.height / 2) - 2) },
    {
      x: Math.max(2, baseMap.width - 4),
      y: Math.min(baseMap.height - 3, Math.floor(baseMap.height / 2) + 2),
    },
    { x: Math.max(2, baseMap.width - 3), y: Math.floor(baseMap.height / 2) },
  ];

  const enemyOverrides: ManualEnemyBattleSpawn[] = tier.members.map((tpl, idx) => {
    const mapSpawn = baseMap.enemySpawns[idx];
    const coord = mapSpawn
      ? { x: mapSpawn.x, y: mapSpawn.y }
      : (fallbackCoords[idx % fallbackCoords.length] ?? { x: 10, y: 5 });

    return {
      id: `skirmish_enemy_${idx}`,
      x: coord.x,
      y: coord.y,
      speciesId: tpl.speciesId,
      nickname: tpl.nickname,
      level: Math.max(tpl.level, skirmish.recommendedLevel),
      stats: { ...tpl.stats },
      moveIds: [...tpl.moveIds],
      equippedMoveId: tpl.equippedMoveId,
      heldItemId: null,
    };
  });

  const customMap: DungeonMapDefinition = {
    ...baseMap,
    id: `skirmish_${node.id}`,
    name: `${node.name} — Feral Skirmish`,
    enemySpawns: enemyOverrides.map((e) => ({
      x: e.x,
      y: e.y,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      heldItemId: null,
    })),
  };

  return {
    customMap,
    enemyOverrides,
    goldBounty: tier.goldBounty,
  };
}
