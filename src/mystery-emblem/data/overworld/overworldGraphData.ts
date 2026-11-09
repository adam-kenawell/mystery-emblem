/**
 * Mystery Emblem — Overworld Continent Graph Nodes, Edges & Assets (`Part 1A: The Verdant Heartland`)
 */

import wonderMapAssetUrl from '../../../../assets/overworld/wonder_map.jpg?url';

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

const KINGDOM = 'Verdant Commonwealth';

export const DEMO_OVERWORLD_NODES: ReadonlyArray<OverworldNodeDefinition> = [
  {
    id: 'prologue',
    code: 'Prologue',
    name: 'Western Beach',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 208,
    y: 194,
    levelId: 'prologue',
    tilesetId: '002',
    recommendedLevel: 1,
    skirmishScoutSpeciesId: 'zigzagoon_galar',
    clearGoldReward: 650,
    unlocksNodeIdsOnClear: ['chapter_01'],
    initiallyUnlocked: true,
  },
  {
    id: 'chapter_01',
    code: 'Ch. 1',
    name: 'Capital Road',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 202,
    y: 156,
    levelId: 'chapter_01',
    tilesetId: '003',
    recommendedLevel: 2,
    skirmishScoutSpeciesId: 'pawniard',
    clearGoldReward: 750,
    unlocksNodeIdsOnClear: ['chapter_02'],
  },
  {
    id: 'chapter_02',
    code: 'Ch. 2',
    name: 'Cleft Mountain',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 308,
    y: 122,
    levelId: 'chapter_02',
    tilesetId: '014',
    recommendedLevel: 3,
    skirmishScoutSpeciesId: 'gothita',
    clearGoldReward: 850,
    unlocksNodeIdsOnClear: ['chapter_03'],
  },
  {
    id: 'chapter_03',
    code: 'Ch. 3',
    name: 'River Shrine',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 246,
    y: 148,
    levelId: 'chapter_03',
    tilesetId: '016',
    recommendedLevel: 4,
    skirmishScoutSpeciesId: 'zubat',
    clearGoldReward: 950,
    unlocksNodeIdsOnClear: ['chapter_04', 'paralogue_01'],
  },
  {
    id: 'paralogue_01',
    code: 'Par. 1',
    name: 'Lush Prairie',
    kingdom: KINGDOM,
    kind: 'paralogue',
    act: 1,
    x: 174,
    y: 134,
    levelId: 'paralogue_01',
    tilesetId: '142',
    recommendedLevel: 4,
    skirmishScoutSpeciesId: 'venipede',
    clearGoldReward: 700,
    unlocksNodeIdsOnClear: [],
  },
  {
    id: 'chapter_04',
    code: 'Ch. 4',
    name: 'Berry Orchards',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 298,
    y: 154,
    levelId: 'chapter_04',
    tilesetId: '042',
    recommendedLevel: 5,
    skirmishScoutSpeciesId: 'morgrem',
    clearGoldReward: 1050,
    unlocksNodeIdsOnClear: ['chapter_05', 'paralogue_02'],
  },
  {
    id: 'paralogue_02',
    code: 'Par. 2',
    name: 'Oran Forest',
    kingdom: KINGDOM,
    kind: 'paralogue',
    act: 1,
    x: 334,
    y: 166,
    levelId: 'paralogue_02',
    tilesetId: '042',
    recommendedLevel: 5,
    skirmishScoutSpeciesId: 'croagunk',
    clearGoldReward: 850,
    unlocksNodeIdsOnClear: [],
    unlocksKecleonShopsOnClear: true,
  },
  {
    id: 'chapter_05',
    code: 'Ch. 5',
    name: 'Northern Pass',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 264,
    y: 102,
    levelId: 'chapter_05',
    tilesetId: '014',
    recommendedLevel: 6,
    skirmishScoutSpeciesId: 'spiritomb',
    clearGoldReward: 1150,
    unlocksNodeIdsOnClear: ['chapter_06'],
  },
  {
    id: 'chapter_06',
    code: 'Ch. 6',
    name: 'Border Fortress',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 212,
    y: 88,
    levelId: 'chapter_06',
    tilesetId: '016',
    recommendedLevel: 7,
    skirmishScoutSpeciesId: 'lairon',
    clearGoldReward: 1400,
    unlocksNodeIdsOnClear: [],
  },
];

export const DEMO_OVERWORLD_EDGES: ReadonlyArray<OverworldEdgeDefinition> = [
  { id: 'edge_prologue_ch1', fromNodeId: 'prologue', toNodeId: 'chapter_01', waypoints: [{ x: 204, y: 175 }] },
  { id: 'edge_ch1_ch2', fromNodeId: 'chapter_01', toNodeId: 'chapter_02', waypoints: [{ x: 248, y: 138 }, { x: 282, y: 128 }] },
  { id: 'edge_ch2_ch3', fromNodeId: 'chapter_02', toNodeId: 'chapter_03', waypoints: [{ x: 286, y: 140 }, { x: 266, y: 148 }] },
  { id: 'edge_ch1_ch3', fromNodeId: 'chapter_01', toNodeId: 'chapter_03', waypoints: [{ x: 224, y: 152 }] },
  { id: 'edge_ch3_par1', fromNodeId: 'chapter_03', toNodeId: 'paralogue_01', waypoints: [{ x: 214, y: 140 }, { x: 192, y: 136 }] },
  { id: 'edge_ch1_par1', fromNodeId: 'chapter_01', toNodeId: 'paralogue_01', waypoints: [{ x: 188, y: 145 }] },
  { id: 'edge_ch3_ch4', fromNodeId: 'chapter_03', toNodeId: 'chapter_04', waypoints: [{ x: 272, y: 152 }] },
  { id: 'edge_ch2_ch4', fromNodeId: 'chapter_02', toNodeId: 'chapter_04', waypoints: [{ x: 304, y: 138 }] },
  { id: 'edge_ch4_par2', fromNodeId: 'chapter_04', toNodeId: 'paralogue_02', waypoints: [{ x: 316, y: 160 }] },
  { id: 'edge_ch4_ch5', fromNodeId: 'chapter_04', toNodeId: 'chapter_05', waypoints: [{ x: 286, y: 128 }, { x: 274, y: 114 }] },
  { id: 'edge_ch2_ch5', fromNodeId: 'chapter_02', toNodeId: 'chapter_05', waypoints: [{ x: 286, y: 110 }] },
  { id: 'edge_ch5_ch6', fromNodeId: 'chapter_05', toNodeId: 'chapter_06', waypoints: [{ x: 238, y: 94 }] },
];

export const DEMO_OVERWORLD_GRAPH: OverworldGraphDefinition = {
  id: 'part_1a_verdant_heartland_map',
  name: KINGDOM,
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
