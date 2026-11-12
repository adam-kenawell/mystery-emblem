/**
 * Self-Contained Chapter Manifest & Map Catalog Types (`chapterTypes.ts`)
 */

import type { DialogueScript } from '../../ui/DialogueOverlay';
import type {
  BattleObjectiveType,
  ConvoyEntry,
  DungeonEventDefinition,
  DungeonMapDefinition,
  DungeonUnitSpawn,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  QuizSeedSlotKey,
  ReinforcementWaveDefinition,
  SaveData,
} from '../../types/schemas';

export type { ReinforcementWaveDefinition };

export interface ChapterRecruitmentSpec {
  seedKey?: QuizSeedSlotKey;
  fixedSpeciesIds?: ReadonlyArray<string>;
  joinLevel: number;
  scaleStatsToLevel: boolean;
  fallbackSpeciesIds: ReadonlyArray<string>;
}

export interface CompactPlayerSlot {
  x: number;
  y: number;
  speciesId?: string;
}

export interface CompactChapterJson {
  id: string;
  nodeId: string;
  order: number;
  dungeonNumber: number;
  shortCode: string;
  label: string;
  title: string;
  subtitle: string;
  defaultTilesetId: string;
  bgmCue: string;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  surviveTurns?: number;
  defeatIfUnitIdsFall?: string[];
  recommendedLevel: number;
  deploymentCap: number;
  skipPrepPhase?: boolean;
  isDemoFinale?: boolean;
  preStoryCutsceneId?: string;
  preStoryCutsceneIds?: string[];
  postStoryCutsceneId?: string;
  postStoryCutsceneIds?: string[];
  chainsDirectlyIntoNodeId?: string;
  postCutsceneRecruits?: Array<{
    speciesId: string;
    level: number;
    scaleStatsToLevel: boolean;
  }>;
  width: number;
  height: number;
  rows: string[];
  playerSlots: CompactPlayerSlot[];
  recruitment?: ChapterRecruitmentSpec;
  clearRewardItems?: ConvoyEntry[];
  guaranteesKecleonShopOnClear?: {
    nodeId: string;
    shopType?: KecleonShopType;
  };
  enemySpawns: ManualEnemyBattleSpawn[];
  npcSpawns?: DungeonUnitSpawn[];
  reinforcements: ReinforcementWaveDefinition[];
  events?: DungeonEventDefinition[];
}

export interface ChapterLevelCatalogEntry {
  id: string;
  shortCode: string;
  label: string;
  biomeName: string;
  primaryTilesetId: string;
  bgmCue: string;
  defaultDeploymentCap: number;
}

export interface CampaignChapterConfig {
  nodeId: string;
  levelId: string;
  dungeonNumber: number;
  title: string;
  subtitle: string;
  objectiveType: BattleObjectiveType;
  objectiveLabel: string;
  surviveTurns?: number;
  defeatIfUnitIdsFall?: ReadonlyArray<string>;
  recommendedLevel: number;
  deploymentCap: number;
  skipPrepPhase?: boolean;
  preStoryCutsceneId?: string;
  preStoryCutsceneIds?: ReadonlyArray<string>;
  postStoryCutsceneId?: string;
  postStoryCutsceneIds?: ReadonlyArray<string>;
  chainsDirectlyIntoNodeId?: string;
  postCutsceneRecruits?: ReadonlyArray<{
    speciesId: string;
    level: number;
    scaleStatsToLevel: boolean;
  }>;
  buildMap: () => DungeonMapDefinition;
  enemySpawns: ReadonlyArray<ManualEnemyBattleSpawn>;
  npcSpawns?: ReadonlyArray<DungeonUnitSpawn>;
  reinforcements: ReadonlyArray<ReinforcementWaveDefinition>;
  events?: ReadonlyArray<DungeonEventDefinition>;
  eventScripts?: Readonly<Record<string, (save: SaveData | null) => DialogueScript>>;
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
