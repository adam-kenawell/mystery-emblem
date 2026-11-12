/**
 * Mystery Emblem - Overworld Continent Graph Nodes, Edges & Assets (`Act 1: Expedition to Meet King Serperior`)
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
  act: 1 | 2 | 3 | 4 | 5;
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

const KINGDOM = 'Verdant Kingdom';

export const DEMO_OVERWORLD_NODES: ReadonlyArray<OverworldNodeDefinition> = [
  {
    id: 'prologue',
    code: 'Prologue',
    name: 'Hometown Pitch',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 208,
    y: 194,
    levelId: 'prologue',
    tilesetId: '042',
    recommendedLevel: 1,
    skirmishScoutSpeciesId: 'zigzagoon_galar',
    clearGoldReward: 500,
    unlocksNodeIdsOnClear: ['chapter_01'],
    initiallyUnlocked: true,
  },
  {
    id: 'chapter_01',
    code: 'Ch. 1',
    name: 'Watering Hole',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 202,
    y: 156,
    levelId: 'chapter_01',
    tilesetId: '003',
    recommendedLevel: 2,
    skirmishScoutSpeciesId: 'croagunk',
    clearGoldReward: 650,
    unlocksNodeIdsOnClear: ['chapter_02'],
  },
  {
    id: 'chapter_02',
    code: 'Ch. 2',
    name: 'Foothill Trail',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 246,
    y: 148,
    levelId: 'chapter_02',
    tilesetId: '042',
    recommendedLevel: 3,
    skirmishScoutSpeciesId: 'impidimp',
    clearGoldReward: 800,
    unlocksNodeIdsOnClear: ['chapter_03'],
    unlocksKecleonShopsOnClear: true,
  },
  {
    id: 'chapter_03',
    code: 'Ch. 3',
    name: 'Mountain Caves',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 292,
    y: 122,
    levelId: 'chapter_03',
    tilesetId: '014',
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
    clearGoldReward: 750,
    unlocksNodeIdsOnClear: [],
  },
  {
    id: 'chapter_04',
    code: 'Ch. 4',
    name: 'Capital Outskirts',
    kingdom: KINGDOM,
    kind: 'story',
    act: 1,
    x: 256,
    y: 98,
    levelId: 'chapter_04',
    tilesetId: '003',
    recommendedLevel: 5,
    skirmishScoutSpeciesId: 'brute_bonnet',
    clearGoldReward: 1200,
    unlocksNodeIdsOnClear: [],
  },
];

export const DEMO_OVERWORLD_EDGES: ReadonlyArray<OverworldEdgeDefinition> = [
  {
    id: 'edge_prologue_ch1',
    fromNodeId: 'prologue',
    toNodeId: 'chapter_01',
    waypoints: [{ x: 204, y: 175 }],
  },
  {
    id: 'edge_ch1_ch2',
    fromNodeId: 'chapter_01',
    toNodeId: 'chapter_02',
    waypoints: [{ x: 224, y: 152 }],
  },
  {
    id: 'edge_ch2_ch3',
    fromNodeId: 'chapter_02',
    toNodeId: 'chapter_03',
    waypoints: [
      { x: 268, y: 138 },
      { x: 282, y: 128 },
    ],
  },
  {
    id: 'edge_ch3_par1',
    fromNodeId: 'chapter_03',
    toNodeId: 'paralogue_01',
    waypoints: [
      { x: 242, y: 134 },
      { x: 196, y: 136 },
    ],
  },
  {
    id: 'edge_ch1_par1',
    fromNodeId: 'chapter_01',
    toNodeId: 'paralogue_01',
    waypoints: [{ x: 188, y: 145 }],
  },
  {
    id: 'edge_ch3_ch4',
    fromNodeId: 'chapter_03',
    toNodeId: 'chapter_04',
    waypoints: [{ x: 274, y: 110 }],
  },
];

export const DEMO_OVERWORLD_GRAPH: OverworldGraphDefinition = {
  id: 'act_1_verdant_expedition_map',
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
