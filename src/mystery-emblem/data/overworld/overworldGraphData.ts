/**
 * Mystery Emblem — Overworld Continent Graph Nodes, Edges & Assets
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

export const DEMO_OVERWORLD_NODES: ReadonlyArray<OverworldNodeDefinition> = [
  {
    id: 'prologue',
    code: 'Prologue',
    name: 'Western Beach',
    kingdom: 'Verdant Commonwealth',
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
    name: 'Verdant Bluff',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 188,
    y: 138,
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
    kingdom: 'Verdant Commonwealth',
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
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 244,
    y: 152,
    levelId: 'chapter_03',
    tilesetId: '016',
    recommendedLevel: 4,
    skirmishScoutSpeciesId: 'zubat',
    clearGoldReward: 950,
    unlocksNodeIdsOnClear: ['chapter_04'],
    unlocksKecleonShopsOnClear: true,
  },
  {
    id: 'chapter_04',
    code: 'Ch. 4',
    name: 'Berry Orchards',
    kingdom: 'Verdant Commonwealth',
    kind: 'story',
    act: 1,
    x: 298,
    y: 150,
    levelId: 'chapter_04',
    tilesetId: '042',
    recommendedLevel: 5,
    skirmishScoutSpeciesId: 'morgrem',
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
