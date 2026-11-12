/**
 * Cutscene, Location & Battle Dialogue Document Types (`cutsceneDocTypes.ts`)
 *
 * Plain-JSON shapes authored by the Dev Tools Cutscene Editor:
 * - Story cutscenes: `data/cutscenes/<id>.json`
 * - Shared locations (background layer stacks): `data/cutscenes/locations/<id>.json`
 * - Battle dialogue: `data/chapters/<chapterId>/dialogue/<id>.json`
 *
 * Times are in seconds, positions in 24px tiles (fractions allowed).
 */

import type { PmdNamedDirection, PmdPortraitEmotion } from '../../assets/pmdAssetTypes';
import type { QuizSeedSlotKey } from '../../types/schemas';

export type Facing = PmdNamedDirection;

export const FACINGS: ReadonlyArray<Facing> = [
  'Down',
  'DownRight',
  'Right',
  'UpRight',
  'Up',
  'UpLeft',
  'Left',
  'DownLeft',
];

export const LIGHTING_MOODS = [
  'clear',
  'morning_coast',
  'sanctuary_glow',
  'campfire_dusk',
  'mountain_mist',
  'shrine_courtyard',
  'twilight_festival',
  'sunset',
  'night',
  'flashback',
  'underwater',
] as const;
export type LightingMood = (typeof LIGHTING_MOODS)[number];

export const EMOTE_KINDS = [
  'exclamation',
  'question',
  'sweat',
  'joy',
  'music',
  'angry',
  'heart',
  'ellipsis',
  'shock',
  'sleep',
  'idea',
  'anger_vein',
  'swirl',
  'sparkle',
] as const;
export type EmoteKind = (typeof EMOTE_KINDS)[number];

export const WEATHER_KINDS = ['none', 'rain', 'snow', 'fog', 'leaves', 'embers'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];

/** Who a cast member is. Resolved against the player's save at play time. */
export type CastIdentity =
  | { kind: 'lord' }
  | { kind: 'partner' }
  | { kind: 'healer' }
  | { kind: 'healer_parent' }
  | { kind: 'mentor' }
  | { kind: 'advisor' }
  /** A quiz-chosen recruit */
  | { kind: 'quiz_slot'; slot: QuizSeedSlotKey; index?: number; fallbackSpeciesId?: string }
  /** A fixed story recruit (Smoliv, Machop, Slakoth...): their roster unit once recruited, else the species */
  | { kind: 'recruit'; speciesId: string }
  /** The Nth extra party member beyond the core four; hidden when the party is smaller */
  | { kind: 'party_extra'; slotIndex: number }
  /** Any Pokemon with a fixed display name. `pokemon` is a SpriteCollab id like `0497` */
  | { kind: 'npc'; pokemon: string; name: string; speciesName?: string };

export interface CastMember {
  id: string;
  who: CastIdentity;
  /** A voice with no sprite on the stage */
  offStage?: boolean;
}

export interface CastPlacement {
  id: string;
  x: number;
  y: number;
  facing: Facing;
  hidden?: boolean;
}

export type PropLayer = 'auto' | 'behind' | 'front';

export interface PropPlacement {
  id: string;
  kind: 'campfire' | 'image';
  /** File name inside `assets/cutscene-props/` (image props) */
  image?: string;
  x: number;
  y: number;
  hidden?: boolean;
  layer?: PropLayer;
}

export type ShowIfCondition =
  | { kind: 'in_party'; cast: string; negate?: boolean }
  | { kind: 'hero_is'; species: string[]; negate?: boolean }
  | { kind: 'chapter_cleared'; chapter: string; negate?: boolean };

export type MusicChange =
  | { kind: 'song'; song: string }
  | { kind: 'silence' }
  | { kind: 'main' };

/** `speaker` is a cast id, or `narrator` for a box with no portrait or name. */
export interface BeatLine {
  speaker: string;
  emotion: PmdPortraitEmotion;
  side: 'auto' | 'left' | 'right';
  text: string;
  hideOtherPortrait?: boolean;
}

export const NARRATOR_SPEAKER_ID = 'narrator';

export type WalkSpeed = 'slow' | 'walk' | 'run' | number;

export const WALK_SPEED_TILES_PER_SEC: Readonly<Record<'slow' | 'walk' | 'run', number>> = {
  slow: 1.8,
  walk: 2.8,
  run: 4.5,
};

interface ActionTiming {
  /** `with` (default) starts when the beat starts; `after` waits for the previous action */
  start?: 'with' | 'after';
  delay?: number;
}

export type StageAction = ActionTiming &
  (
    | { type: 'walk'; who: string; path: Array<[number, number]>; speed?: WalkSpeed; facing?: Facing }
    | { type: 'face'; who: string; facing?: Facing; toward?: string }
    | { type: 'hop'; who: string; count?: 1 | 2 }
    | { type: 'shake'; who: string; duration?: number }
    | { type: 'pose'; who: string; anim: string; hold?: boolean; duration?: number }
    | { type: 'emote'; who: string; emote: EmoteKind; duration?: number }
    | { type: 'aura'; who: string; color?: string; duration?: number }
    | { type: 'show'; who: string; visible: boolean; fade?: boolean }
    | { type: 'place'; who: string; x: number; y: number; facing?: Facing }
    | { type: 'camera'; x: number; y: number; duration?: number }
    | { type: 'follow'; who: string | null }
    | { type: 'screenShake'; duration?: number; intensity?: number }
    | { type: 'fade'; to: 'black' | 'white' | 'clear'; duration?: number }
    | { type: 'flash'; color?: 'white' | 'black'; duration?: number }
    | { type: 'weather'; weather: WeatherKind }
    | { type: 'lighting'; mood: LightingMood; duration?: number }
    | { type: 'sound'; sound: string }
    | {
        type: 'location';
        location: string;
        transition: 'black' | 'white' | 'cut';
        banner?: string;
        camera?: { x: number; y: number };
        placements: CastPlacement[];
        props?: PropPlacement[];
      }
    | { type: 'prop'; prop: string; path?: Array<[number, number]>; speed?: WalkSpeed; visible?: boolean }
  );

export type StageActionType = StageAction['type'];

export type BeatAdvance = { kind: 'actions' } | { kind: 'seconds'; seconds: number };

export interface Beat {
  id: string;
  /** Absent = a silent beat (dialogue box hidden) */
  say?: BeatLine;
  actions?: StageAction[];
  /** Every condition must pass, otherwise the whole beat (line + actions) is skipped */
  showIf?: ShowIfCondition[];
  /** Hide the dialogue box until this beat's actions finish */
  waitForActions?: boolean;
  /** When a silent beat moves on. Defaults to when its actions finish. */
  advance?: BeatAdvance;
  music?: MusicChange;
  /** File name inside `assets/sfx/`, played as the beat starts */
  sound?: string;
}

export interface CutsceneDoc {
  id: string;
  title: string;
  /** Main song (track id or alias); `null` = silence */
  music: string | null;
  location: string;
  /** Location pill text shown at the top of the stage */
  banner: string;
  lighting: LightingMood;
  weather?: WeatherKind;
  camera: { x: number; y: number };
  cast: CastMember[];
  placements: CastPlacement[];
  props?: PropPlacement[];
  beats: Beat[];
}

export type LocationLayer = {
  id: string;
  /** Drawn in front of the characters */
  front?: boolean;
  opacity?: number;
} & (
  | { kind: 'tiles'; tileset: string; rows: string[] }
  | { kind: 'picture'; image: string; x?: number; y?: number }
  | {
      kind: 'texture';
      image: string;
      frames?: number;
      fps?: number;
      driftX?: number;
      driftY?: number;
    }
  | {
      kind: 'parallax';
      image: string;
      /** 0 = fixed to the screen, 1 = moves with the stage */
      scroll: number;
      y?: number;
      repeatX?: boolean;
      driftX?: number;
    }
);

export type LocationLayerKind = LocationLayer['kind'];

export interface LocationDoc {
  id: string;
  name: string;
  /** Size in 24px tiles: placement grid and camera bounds */
  width: number;
  height: number;
  layers: LocationLayer[];
}

export type DialogueDocRole = 'intro' | 'outro' | 'event';

export interface DialogueDoc {
  id: string;
  chapter: string;
  role: DialogueDocRole;
  title?: string;
  /** Song when the dialogue opens; omit to keep the battle music */
  music?: string | null;
  cast: CastMember[];
  beats: Beat[];
}
