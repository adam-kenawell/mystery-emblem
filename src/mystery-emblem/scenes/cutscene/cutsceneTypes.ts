/**
 * Out-of-Dungeon Choreographed PMD Sprite Cutscene Runtime Types (`cutsceneTypes.ts`)
 */

import type {
  LoadedActionAnimation,
  PmdDirection,
  PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import type {
  EmoteKind,
  LightingMood,
  LocationDoc,
  LocationLayer,
  PropLayer,
  WeatherKind,
} from '../../data/cutscenes/cutsceneDocTypes';
import type { LocationTileGrid } from '../../data/cutscenes/locationCodec';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type { DialogueOverlay } from '../../ui/DialogueOverlay';

export type {
  CutsceneDoc,
  EmoteKind as CutsceneEmoteKind,
  LightingMood as CutsceneLightingMood,
} from '../../data/cutscenes/cutsceneDocTypes';

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
  kind: EmoteKind;
  remainingMs: number;
  totalMs: number;
}

export interface ActiveAuraPulse {
  actorId: string;
  color: string;
  elapsedMs: number;
  durationMs: number;
}

export interface ActiveAlphaFade {
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
  hideWhenDone: boolean;
}

export interface RuntimeCutsceneActor {
  actorId: string;
  roleKind: string;
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  /** False when this party member doesn't exist in the save (e.g. an empty extra slot) */
  available: boolean;
  offStage: boolean;
  visible: boolean;
  alpha: number;
  alphaFade: ActiveAlphaFade | null;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  /** A named SpriteCollab animation (Sleep, Nod…) overriding `action` while set */
  poseName: string | null;
  poseAnim: LoadedActionAnimation | null;
  animElapsedMs: number;
  walk: ActiveWalkSegment | null;
  hop: ActiveHopState | null;
  shakeRemainingMs: number;
  poseRemainingMs: number;
  emote: ActiveEmoteState | null;
}

export interface RuntimeCutsceneProp {
  id: string;
  kind: 'campfire' | 'image';
  imageName?: string;
  image: HTMLImageElement | null;
  x: number;
  y: number;
  visible: boolean;
  layer: PropLayer;
  walk: ActiveWalkSegment | null;
}

export type ResolvedLocationLayer = LocationLayer & {
  grid?: LocationTileGrid;
  img?: HTMLImageElement | null;
};

export interface ResolvedLocation {
  doc: LocationDoc;
  width: number;
  height: number;
  layers: ResolvedLocationLayer[];
  fillsScreen: boolean;
}

export interface ScreenFadeState {
  color: 'black' | 'white';
  alpha: number;
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
}

export interface ScreenFlashState {
  color: 'white' | 'black';
  elapsedMs: number;
  durationMs: number;
}

export interface LightingState {
  mood: LightingMood;
  previous: LightingMood | null;
  elapsedMs: number;
  durationMs: number;
}

export interface CutsceneActorSnapshot {
  actorId: string;
  roleKind: string;
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  visible: boolean;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  pose: string | null;
  activeEmote: EmoteKind | null;
}

export interface CutsceneSceneSnapshot {
  isOpen: boolean;
  cutsceneId: string | null;
  locationId: string | null;
  stageWidth: number;
  stageHeight: number;
  title: string | null;
  locationLabel: string | null;
  lightingMood: LightingMood | null;
  weather: WeatherKind;
  currentBeatIndex: number;
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
