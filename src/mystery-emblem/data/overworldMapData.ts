/**
 * Mystery Emblem — Overworld Continent Graph, Kecleon Shop Catalogs & Manual Skirmish Encounters
 *
 * Canonical 5-Dungeon Demo Overworld Graph (`DEMO_OVERWORLD_GRAPH`), Kecleon Shop catalogs,
 * and manually balanced Feral Skirmish encounter tiers (Rule 1 & Rule 5 compliant).
 */

import wonderMapAssetUrl from '../../../assets/overworld/wonder_map.jpg?url';
import type {
  DungeonMapDefinition,
  ItemDefinition,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  SkirmishSpawnState,
  StatBlockSeven,
} from '../types/schemas';
import { cloneDungeonMap, getEffectiveChapterMap } from './chapterMapRegistry';
import { ITEMS_LIST, getItemById } from './index';

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
  /** Unlocks random Kecleon Shops across cleared nodes */
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

export const DEMO_OVERWORLD_NODES: ReadonlyArray<OverworldNodeDefinition> = [
  {
    id: 'prologue',
    code: 'D1',
    name: 'Beach Cave',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 208,
    y: 194,
    levelId: 'prologue',
    tilesetId: '001',
    recommendedLevel: 9,
    skirmishScoutSpeciesId: 'zigzagoon_galar',
    clearGoldReward: 650,
    unlocksNodeIdsOnClear: ['chapter_01'],
    initiallyUnlocked: true,
  },
  {
    id: 'chapter_01',
    code: 'D2',
    name: 'Drenched Bluff',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 188,
    y: 138,
    levelId: 'chapter_01',
    tilesetId: '003',
    recommendedLevel: 9,
    skirmishScoutSpeciesId: 'pawniard',
    clearGoldReward: 750,
    unlocksNodeIdsOnClear: ['chapter_02'],
  },
  {
    id: 'chapter_02',
    code: 'D3',
    name: 'Mt. Bristle',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 308,
    y: 122,
    levelId: 'chapter_02',
    tilesetId: '014',
    recommendedLevel: 10,
    skirmishScoutSpeciesId: 'gothita',
    clearGoldReward: 850,
    unlocksNodeIdsOnClear: ['chapter_03'],
  },
  {
    id: 'chapter_03',
    code: 'D4',
    name: 'Waterfall Cave',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 244,
    y: 152,
    levelId: 'chapter_03',
    tilesetId: '016',
    recommendedLevel: 11,
    skirmishScoutSpeciesId: 'zubat',
    clearGoldReward: 950,
    unlocksNodeIdsOnClear: ['chapter_04'],
    unlocksKecleonShopsOnClear: true,
  },
  {
    id: 'chapter_04',
    code: 'D5',
    name: 'Apple Woods',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 298,
    y: 150,
    levelId: 'chapter_04',
    tilesetId: '042',
    recommendedLevel: 12,
    skirmishScoutSpeciesId: 'seedot',
    clearGoldReward: 1200,
    unlocksNodeIdsOnClear: [],
  },
];

export const DEMO_OVERWORLD_EDGES: ReadonlyArray<OverworldEdgeDefinition> = [
  {
    id: 'demo_edge_d1_d2',
    fromNodeId: 'prologue',
    toNodeId: 'chapter_01',
    waypoints: [
      { x: 198, y: 178 },
      { x: 190, y: 158 },
    ],
  },
  {
    id: 'demo_edge_d2_d3',
    fromNodeId: 'chapter_01',
    toNodeId: 'chapter_02',
    waypoints: [
      { x: 216, y: 126 },
      { x: 256, y: 114 },
      { x: 286, y: 118 },
    ],
  },
  {
    id: 'demo_edge_d3_d4',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_03',
    waypoints: [
      { x: 288, y: 132 },
      { x: 266, y: 142 },
    ],
  },
  {
    id: 'demo_edge_d2_d4',
    fromNodeId: 'chapter_01',
    toNodeId: 'chapter_03',
    waypoints: [
      { x: 206, y: 146 },
      { x: 224, y: 154 },
    ],
  },
  {
    id: 'demo_edge_d4_d5',
    fromNodeId: 'chapter_03',
    toNodeId: 'chapter_04',
    waypoints: [
      { x: 264, y: 154 },
      { x: 282, y: 152 },
    ],
  },
  {
    id: 'demo_edge_d3_d5',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_04',
    waypoints: [{ x: 304, y: 136 }],
  },
];

export const DEMO_OVERWORLD_GRAPH: OverworldGraphDefinition = {
  id: 'demo_5_dungeon_wonder_map',
  name: 'Verdant Commonwealth',
  imageUrl: OVERWORLD_MAP_IMAGE_URL,
  imageWidth: OVERWORLD_MAP_NATIVE_WIDTH,
  imageHeight: OVERWORLD_MAP_NATIVE_HEIGHT,
  startNodeId: 'prologue',
  nodes: DEMO_OVERWORLD_NODES,
  edges: DEMO_OVERWORLD_EDGES,
};

export function getOverworldNodeById(
  nodeId: string,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH
): OverworldNodeDefinition | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

// ============================================================================
// Kecleon Shop Types & Curated Inventory Builder
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
    title: 'Kecleon TM Stall',
    shortBadge: 'TM SHOP',
    greeting: 'Single-use Technical Machines—teach your squad new moves!',
    accentColor: '#90d8f8',
    stockCount: 6,
  },
  held_shop: {
    shopType: 'held_shop',
    title: 'Kecleon Gear & Berries',
    shortBadge: 'HELD SHOP',
    greeting: 'Combat gear, type charms, and fresh berries!',
    accentColor: '#68d888',
    stockCount: 6,
  },
  healing_shop: {
    shopType: 'healing_shop',
    title: 'Kecleon Apothecary',
    shortBadge: 'HEAL SHOP',
    greeting: 'Potions, Full Heals, and rare Evolution Stones!',
    accentColor: '#f8d048',
    stockCount: 6,
  },
  x_item_shop: {
    shopType: 'x_item_shop',
    title: 'Kecleon X-Items',
    shortBadge: 'X-SHOP',
    greeting: 'Single-battle stat & crit boosters for tough bosses!',
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

  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  const picked = copy.slice(0, meta.stockCount);
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

export const FERAL_SKIRMISH_SQUADS_BY_TIER: ReadonlyArray<{
  maxRecommendedLevel: number;
  goldBounty: number;
  members: ReadonlyArray<ManualSkirmishMemberTemplate>;
}> = [
  {
    maxRecommendedLevel: 9,
    goldBounty: 450,
    members: [
      {
        speciesId: 'zigzagoon_galar',
        nickname: 'Feral Outrider',
        level: 9,
        stats: { hp: 20, atk: 8, def: 6, spa: 4, spd: 6, spe: 9, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'seedot',
        nickname: 'Feral Forager',
        level: 9,
        stats: { hp: 20, atk: 8, def: 7, spa: 6, spd: 7, spe: 6, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'impidimp',
        nickname: 'Feral Hexer',
        level: 9,
        stats: { hp: 19, atk: 7, def: 5, spa: 8, spd: 6, spe: 8, mov: 5 },
        moveIds: ['assurance', 'snarl'],
        equippedMoveId: 'snarl',
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
        level: 10,
        stats: { hp: 23, atk: 10, def: 9, spa: 5, spd: 6, spe: 8, mov: 5 },
        moveIds: ['metal_claw', 'assurance'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'rookidee',
        nickname: 'Feral Harrier',
        level: 10,
        stats: { hp: 21, atk: 8, def: 6, spa: 5, spd: 6, spe: 10, mov: 6 },
        moveIds: ['peck'],
        equippedMoveId: 'peck',
      },
      {
        speciesId: 'aron',
        nickname: 'Feral Cragbreaker',
        level: 10,
        stats: { hp: 25, atk: 9, def: 11, spa: 5, spd: 6, spe: 5, mov: 4 },
        moveIds: ['metal_claw', 'rock_tomb'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'gothita',
        nickname: 'Feral Channeler',
        level: 10,
        stats: { hp: 20, atk: 5, def: 7, spa: 10, spd: 9, spe: 7, mov: 5 },
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
      stats: skirmish.recommendedLevel > tpl.level ? undefined : { ...tpl.stats },
      moveIds: [...tpl.moveIds],
      equippedMoveId: tpl.equippedMoveId,
      heldItemId: null,
    };
  });

  const customMap: DungeonMapDefinition = {
    ...baseMap,
    id: `skirmish_${node.id}`,
    name: `${node.name} — Skirmish`,
    objectiveType: 'rout',
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
