/**
 * Out-of-Dungeon Choreographed PMD Sprite Cutscene Types (`cutsceneTypes.ts`)
 */

import type {
  PmdDirection,
  PmdDirectionInput,
  PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DungeonMapTileCell, SaveData } from '../../types/schemas';
import type { DialogueOverlay, DialogueScript } from '../../ui/DialogueOverlay';

export type CutsceneLightingMood =
  | 'morning_coast'
  | 'sanctuary_glow'
  | 'campfire_dusk'
  | 'mountain_mist'
  | 'shrine_courtyard'
  | 'twilight_festival';

export type CutscenePropKind =
  | 'campfire'
  | 'sanctuary_crystal'
  | 'lantern'
  | 'ancient_rune'
  | 'berry_basket';

export type CutsceneEmoteKind =
  | 'exclamation'
  | 'question'
  | 'sweat'
  | 'joy'
  | 'music'
  | 'angry'
  | 'heart';

export interface CutscenePropDef {
  id: string;
  kind: CutscenePropKind;
  x: number;
  y: number;
}

export type CutsceneActorRole =
  | { kind: 'lord' }
  | { kind: 'partner' }
  | { kind: 'healer' }
  | { kind: 'advisor' }
  | { kind: 'npc'; pmdAssetId: string; name: string }
  | { kind: 'cameo_recruit'; slotIndex: number };

export interface CutsceneActorSpawnDef {
  actorId: string;
  role: CutsceneActorRole;
  x: number;
  y: number;
  direction: PmdDirectionInput;
  visible?: boolean;
}

export type CutsceneCueAction =
  | {
      type: 'walk';
      actorId: string;
      path: ReadonlyArray<{ x: number; y: number }>;
      speedTilesPerSec?: number;
      endDirection?: PmdDirectionInput;
      delayMs?: number;
    }
  | {
      type: 'face';
      actorId: string;
      direction?: PmdDirectionInput;
      targetActorId?: string;
      delayMs?: number;
    }
  | {
      type: 'hop';
      actorId: string;
      count?: 1 | 2;
      heightPx?: number;
      delayMs?: number;
    }
  | {
      type: 'shake';
      actorId: string;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'pose';
      actorId: string;
      action: PmdSpriteAction;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'emote';
      actorId: string;
      emote: CutsceneEmoteKind;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'visibility';
      actorId: string;
      visible: boolean;
      delayMs?: number;
    }
  | {
      type: 'auraPulse';
      actorId: string;
      color?: string;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'camera';
      x: number;
      y: number;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'screenShake';
      durationMs?: number;
      intensityPx?: number;
      delayMs?: number;
    };

export interface StoryCutsceneDefinition {
  id: string;
  chapterOrder: number;
  title: string;
  locationLabel: string;
  lightingMood: CutsceneLightingMood;
  width: number;
  height: number;
  tiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>;
  props?: ReadonlyArray<CutscenePropDef>;
  initialCamera: { x: number; y: number };
  actors: ReadonlyArray<CutsceneActorSpawnDef>;
  openingActions?: ReadonlyArray<CutsceneCueAction>;
  openingDurationMs?: number;
  /** Choreographed stage actions keyed by 0-based `DialogueScript.lines` index */
  lineCues?: Readonly<Record<number, ReadonlyArray<CutsceneCueAction>>>;
  /** Named stage actions triggered via `DialogueLine.stageCueId` */
  stageCues?: Readonly<Record<string, ReadonlyArray<CutsceneCueAction>>>;
  buildScript: (save: SaveData | null) => DialogueScript;
}

export interface ActiveWalkSegment {
  waypoints: Array<{ x: number; y: number }>;
  segmentIndex: number;
  speedTilesPerSec: number;
  endDirection?: PmdDirection;
}

export interface ActiveHopState {
  elapsedMs: number;
  totalDurationMs: number;
  count: 1 | 2;
  heightPx: number;
}

export interface ActiveEmoteState {
  kind: CutsceneEmoteKind;
  remainingMs: number;
  totalMs: number;
}

export interface ActiveAuraPulse {
  actorId: string;
  color: string;
  elapsedMs: number;
  durationMs: number;
}

export interface RuntimeCutsceneActor {
  actorId: string;
  roleKind: CutsceneActorRole['kind'];
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  available: boolean;
  visible: boolean;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  animElapsedMs: number;
  walk: ActiveWalkSegment | null;
  hop: ActiveHopState | null;
  shakeRemainingMs: number;
  poseRemainingMs: number;
  emote: ActiveEmoteState | null;
}

export interface CutsceneActorSnapshot {
  actorId: string;
  roleKind: CutsceneActorRole['kind'];
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  visible: boolean;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  activeEmote: CutsceneEmoteKind | null;
}

export interface CutsceneSceneSnapshot {
  isOpen: boolean;
  cutsceneId: string | null;
  title: string | null;
  locationLabel: string | null;
  lightingMood: CutsceneLightingMood | null;
  currentLineIndex: number;
  cameraTile: { x: number; y: number };
  displayScale: number;
  actors: CutsceneActorSnapshot[];
  propCount: number;
}

export interface CutsceneSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  dialogueOverlay: DialogueOverlay;
  audioManager?: AudioManager;
  onStateChange?: () => void;
}

export interface AmbientMote {
  seedX: number;
  seedY: number;
  speedX: number;
  speedY: number;
  phase: number;
  size: 1 | 2;
}
