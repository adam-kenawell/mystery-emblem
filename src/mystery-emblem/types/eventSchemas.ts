/**
 * Declarative Dungeon Event, Reinforcement Wave & Faction Schemas (`eventSchemas.ts`)
 *
 * Powers 100% data-driven campaign mechanics across all 25 Chapters + 7 Paralogues:
 * - Stairs Reinforcement Waves & Unit Blocking
 * - Green Allied NPCs (`'npc'`) & Protection / Survival Objectives
 * - Mid-Battle `Talk` Recruitments & Branching Twin Choices (`BattleTalkChoiceModal`)
 * - Boss-to-Recruit Post-Battle Joins (`'convertible'` lines)
 * - Scripted Mid-Battle Allied Arrivals, Barrier Tile Mutations & Multi-Phase Bosses
 */

import type { PmdPortraitEmotion } from '../assets/pmdAssetLoader';
import type { PmdUiSfxId } from '../audio/AudioManager';
import type { DialogueSpeakerRef } from '../engine/speakerResolver';
import type {
  BattleObjectiveType,
  DungeonUnitSpawn,
  ManualEnemyBattleSpawn,
  TerrainType,
} from './battleSchemas';
import type { KecleonShopType } from './registrySchemas';
import type { ConvoyEntry } from './saveSchemas';

export type UnitBattleFaction = 'player' | 'enemy' | 'npc';

export interface ReinforcementWaveDefinition {
  id: string;
  turnNumber: number;
  stairsX: number;
  stairsY: number;
  enemy: ManualEnemyBattleSpawn;
}

export type DungeonEventTrigger =
  | {
      type: 'turn_start';
      turnNumber: number;
      phase?: 'player_phase' | 'enemy_phase';
    }
  | {
      type: 'talk';
      targetUnitId: string;
      /** Defaults to `'any_player'` when omitted */
      initiator?: 'lord' | 'any_player';
      allowedInitiatorSpeciesIds?: string[];
      allowedInitiatorUnitIds?: string[];
    }
  | {
      type: 'unit_defeated';
      targetUnitId: string;
    }
  | {
      type: 'tile_reached';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      by?: 'lord' | 'any_player';
    }
  | {
      type: 'battle_victory';
      requireSurvivedUnitIds?: string[];
    };

export type DungeonEventCondition =
  | { kind: 'unit_alive'; unitId: string }
  | { kind: 'unit_defeated'; unitId: string }
  | { kind: 'event_triggered'; eventId: string; negated?: boolean };

export interface DungeonEventDialogueLine {
  speaker: DialogueSpeakerRef;
  side: 'left' | 'right';
  emotion: PmdPortraitEmotion;
  text: string;
  clearOppositePortrait?: boolean;
  bgm?: string | null;
  sfx?: PmdUiSfxId;
}

export interface DungeonTalkChoiceOption {
  id: string;
  label: string;
  description?: string;
  portraitSpeciesId?: string;
  actions: DungeonEventAction[];
}

export type DungeonEventAction =
  | {
      type: 'show_banner';
      text: string;
    }
  | {
      type: 'play_dialogue';
      scriptId?: string;
      title?: string;
      bgm?: string | null;
      restorePreviousBgmOnClose?: boolean;
      lines?: DungeonEventDialogueLine[];
    }
  | {
      type: 'spawn_units';
      faction: UnitBattleFaction;
      units: DungeonUnitSpawn[];
      checkStairsBlocking?: boolean;
      calloutText?: string;
      bannerText?: string;
      addToPermanentRoster?: boolean;
    }
  | {
      type: 'convert_unit';
      targetUnitId: string;
      toFaction: UnitBattleFaction;
      healToFull?: boolean;
      readyToAct?: boolean;
      calloutText?: string;
      addToPermanentRoster?: boolean;
    }
  | {
      type: 'despawn_units';
      unitIds: string[];
      calloutText?: string;
    }
  | {
      type: 'recruit_choice';
      promptTitle: string;
      promptSubtitle?: string;
      options: DungeonTalkChoiceOption[];
    }
  | {
      type: 'set_tiles';
      tiles: Array<{
        x: number;
        y: number;
        terrainType: TerrainType;
        tilesetId?: string;
        chunkIndex?: number;
      }>;
    }
  | {
      type: 'set_objective';
      objectiveType: BattleObjectiveType;
      objectiveLabel: string;
      surviveTurns?: number;
      defeatIfUnitIdsFall?: string[];
    }
  | {
      type: 'grant_items';
      items?: ConvoyEntry[];
      gold?: number;
      bannerText?: string;
    }
  | {
      type: 'unlock_kecleon_shop';
      nodeId: string;
      shopType?: KecleonShopType;
    }
  | {
      type: 'recruit_post_battle';
      speciesId: string;
      level: number;
      nickname?: string;
      scaleStatsToLevel?: boolean;
      bannerText?: string;
    };

export interface DungeonEventDefinition {
  id: string;
  /** Defaults to `true` (fires at most once per battle) unless explicitly set to `false` */
  once?: boolean;
  trigger: DungeonEventTrigger;
  conditions?: DungeonEventCondition[];
  actions: DungeonEventAction[];
}
