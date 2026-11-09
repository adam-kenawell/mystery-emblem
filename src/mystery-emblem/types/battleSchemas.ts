/**
 * PMD Dungeon Terrain, Tactical Grid & Map Override Schemas (`battleSchemas.ts`)
 */

import type {
  DungeonEventDefinition,
  ReinforcementWaveDefinition,
} from './eventSchemas';
import type { StatBlockSeven } from './registrySchemas';
import type { QuizSeedSlotKey } from './saveSchemas';

export const TERRAIN_TYPES = [
  'floor',
  'trees',
  'stairs',
  'water',
  'lava',
  'mountain',
  'void',
  'wonder_tile',
  'wall',
  'barrier',
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export interface TerrainBonuses {
  defBonus: number;
  spdBonus: number;
  avoidBonus: number;
  healPercentPerTurn: number;
  clearsDebuffs: boolean;
  spawnsReinforcements: boolean;
}

export interface DungeonMapTileCell {
  terrainType: TerrainType;
  /** 3-digit PMD EoS tileset identifier (`"000"`..`"143"`) */
  tilesetId: string;
  /** 24x24 chunk index (`1..399`) inside the 16x25 `384x600` sheet */
  chunkIndex: number;
}

export type EnemyAiMode = 'wait_until_in_range' | 'stationary' | 'aggressive';

export const BATTLE_OBJECTIVE_TYPES = [
  'rout',
  'defeat_boss',
  'survive_turns',
  'protect_npc',
] as const;

export type BattleObjectiveType = (typeof BATTLE_OBJECTIVE_TYPES)[number];

export interface DungeonUnitSpawn {
  id?: string;
  x: number;
  y: number;
  speciesId: string;
  /** Optional Quiz recruitment slot key overriding `speciesId` from `save.campaign.quizSeeds` */
  seedKey?: QuizSeedSlotKey;
  level: number;
  nickname?: string;
  stats?: StatBlockSeven;
  moveIds?: string[];
  equippedMoveId?: string;
  heldItemId?: string | null;
  /** Marks Enemy Leader / Boss for `defeat_boss` objective and Boss UI badge */
  isBoss?: boolean;
  /** If true, this unit will never move from its tile (`mov = 0` in Danger Area & AI) */
  stationary?: boolean;
  /** If true on a Green `'npc'` unit, battle ends in Defeat if this unit faints */
  mustSurvive?: boolean;
  /** Item ID awarded to the player's Convoy upon defeating this enemy */
  droppableItemId?: string | null;
  /** AI movement behavior (defaults to `'wait_until_in_range'`) */
  aiMode?: EnemyAiMode;
}

export interface DungeonMapDefinition {
  id: string;
  name: string;
  bgmCue?: string;
  /** Victory objective for this dungeon (defaults to `'rout'`) */
  objectiveType?: BattleObjectiveType;
  /** Custom human-readable objective label (optional) */
  objectiveLabel?: string;
  /** Target number of full turns to survive when `objectiveType === 'survive_turns'` */
  surviveTurns?: number;
  /** Unit IDs whose defeat immediately triggers Defeat (e.g. protected Green NPCs) */
  defeatIfUnitIdsFall?: string[];
  /** Maximum number of player units allowed to enter the dungeon (defaults to `playerSpawns.length`) */
  deploymentCap?: number;
  width: number;
  height: number;
  /** Row-major `[y][x]` grid of dimensions `height` x `width` */
  tiles: DungeonMapTileCell[][];
  playerSpawns: DungeonUnitSpawn[];
  enemySpawns: DungeonUnitSpawn[];
  /** Green allied NPC spawns (`faction: 'npc'`, e.g. Kecleon rescue, Nidoran twins) */
  npcSpawns?: DungeonUnitSpawn[];
  /** Data-driven Dungeon Stairs reinforcement waves */
  reinforcements?: ReinforcementWaveDefinition[];
  /** Declarative mid-battle & post-battle scripted events (`Talk`, arrivals, multi-phase bosses) */
  events?: DungeonEventDefinition[];
}

export interface CustomMapOverrideEntry {
  map: DungeonMapDefinition;
  updatedAt: number;
}

export interface ManualEnemyBattleSpawn {
  id: string;
  x: number;
  y: number;
  speciesId: string;
  /** Optional Quiz recruitment slot key overriding `speciesId` from `save.campaign.quizSeeds` */
  seedKey?: QuizSeedSlotKey;
  nickname: string;
  level: number;
  /** Manually tuned stat block (if omitted, scaled cleanly from manual registry `baseStats` + `growthRates`) */
  stats?: StatBlockSeven;
  moveIds?: string[];
  equippedMoveId?: string;
  heldItemId?: string | null;
  isBoss?: boolean;
  stationary?: boolean;
  mustSurvive?: boolean;
  droppableItemId?: string | null;
  aiMode?: EnemyAiMode;
}

export interface PrepDeploymentSlot {
  slotIndex: number;
  x: number;
  y: number;
  unitInstanceId: string | null;
}
