/**
 * Cutscene Editor Labels, Summaries & Action Factories (`editorLabels.ts`)
 */

import type {
  Beat,
  CastIdentity,
  EmoteKind,
  ShowIfCondition,
  StageAction,
  StageActionType,
} from '../data/cutscenes/cutsceneDocTypes';
import { NARRATOR_SPEAKER_ID } from '../data/cutscenes/cutsceneDocTypes';
import { getSpeciesById } from '../data/index';
import { LIGHTING_MOOD_LABELS, WEATHER_LABELS } from '../scenes/cutscene/cutsceneAtmosphere';
import { stripRichDialogueTags } from '../ui/typewriterController';
import { nameForSpriteCollabId } from './pokemonNames';

export const QUIZ_SLOT_LABELS: Readonly<Record<string, string>> = {
  slot1Flying: 'Quiz bird (Ch. 1)',
  slot2Psychic: 'Quiz psychic (Ch. 2)',
  slot3Electric: 'Quiz electric (Ch. 4)',
  slot4Rock: 'Quiz rock slot',
  slot5Fire: 'Quiz fire slot',
  slot6Grass: 'Quiz grass slot',
  slot7Fairy: 'Quiz fairy slot',
  slot8Ice: 'Quiz ice slot',
};

export function describeIdentity(who: CastIdentity): string {
  switch (who.kind) {
    case 'lord':
      return 'Hero (your Dragon)';
    case 'partner':
      return 'Partner (Quaxly)';
    case 'healer':
      return 'Healer (Flabebe)';
    case 'healer_parent':
      return 'Florges (Healer Parent)';
    case 'mentor':
      return 'Quaquaval (Mentor)';
    case 'advisor':
      return 'Quaquaval (Field Notes)';
    case 'quiz_slot':
      return QUIZ_SLOT_LABELS[who.slot] ?? `Quiz recruit (${who.slot})`;
    case 'recruit':
      return `${getSpeciesById(who.speciesId)?.name ?? who.speciesId} (story recruit)`;
    case 'party_extra':
      return `Extra party member #${who.slotIndex + 1}`;
    case 'npc':
      return `${who.name} (${who.speciesName ?? nameForSpriteCollabId(who.pokemon) ?? who.pokemon})`;
  }
}

export const EMOTE_LABELS: Readonly<Record<EmoteKind, string>> = {
  exclamation: '! Surprise',
  question: '? Confused',
  sweat: 'Sweat drop',
  joy: 'Joy',
  music: '♪ Music',
  angry: 'Angry',
  heart: '♥ Heart',
  ellipsis: '… Silence',
  shock: '!? Shock',
  sleep: 'Zzz Sleep',
  idea: 'Idea (light bulb)',
  anger_vein: 'Anger vein',
  swirl: 'Swirl (dizzy)',
  sparkle: 'Sparkle',
};

export interface ActionTypeInfo {
  type: StageActionType;
  label: string;
  icon: string;
  group: 'Characters' | 'Camera' | 'Screen' | 'Atmosphere' | 'Sound' | 'Location & props';
  needsActor: boolean;
}

export const ACTION_TYPES: ReadonlyArray<ActionTypeInfo> = [
  { type: 'walk', label: 'Walk', icon: '🚶', group: 'Characters', needsActor: true },
  { type: 'face', label: 'Face direction', icon: '↻', group: 'Characters', needsActor: true },
  { type: 'emote', label: 'Emote bubble', icon: '💬', group: 'Characters', needsActor: true },
  { type: 'pose', label: 'Pose / animation', icon: '🎭', group: 'Characters', needsActor: true },
  { type: 'hop', label: 'Hop', icon: '⤴', group: 'Characters', needsActor: true },
  { type: 'shake', label: 'Shake (nervous)', icon: '〰', group: 'Characters', needsActor: true },
  { type: 'aura', label: 'Aura pulse', icon: '◎', group: 'Characters', needsActor: true },
  { type: 'show', label: 'Show / hide', icon: '👁', group: 'Characters', needsActor: true },
  { type: 'place', label: 'Teleport (place)', icon: '⌖', group: 'Characters', needsActor: true },
  { type: 'camera', label: 'Camera pan', icon: '🎥', group: 'Camera', needsActor: false },
  { type: 'follow', label: 'Camera follow', icon: '🎯', group: 'Camera', needsActor: false },
  { type: 'fade', label: 'Fade screen', icon: '◐', group: 'Screen', needsActor: false },
  { type: 'flash', label: 'Flash', icon: '⚡', group: 'Screen', needsActor: false },
  { type: 'screenShake', label: 'Screen shake', icon: '≋', group: 'Screen', needsActor: false },
  { type: 'weather', label: 'Weather', icon: '☂', group: 'Atmosphere', needsActor: false },
  { type: 'lighting', label: 'Lighting', icon: '☀', group: 'Atmosphere', needsActor: false },
  { type: 'sound', label: 'Sound effect', icon: '🔊', group: 'Sound', needsActor: false },
  { type: 'location', label: 'Change location', icon: '🗺', group: 'Location & props', needsActor: false },
  { type: 'prop', label: 'Move / show / hide prop', icon: '📦', group: 'Location & props', needsActor: false },
];

export function actionInfo(type: StageActionType): ActionTypeInfo {
  return ACTION_TYPES.find((a) => a.type === type)!;
}

export function createDefaultAction(
  type: StageActionType,
  ctx: { firstCast?: string; firstProp?: string; locationId: string; camera: { x: number; y: number }; firstSound?: string }
): StageAction {
  const who = ctx.firstCast ?? 'lord';
  switch (type) {
    case 'walk':
      return { type: 'walk', who, path: [], speed: 'walk' };
    case 'face':
      return { type: 'face', who, facing: 'Down' };
    case 'emote':
      return { type: 'emote', who, emote: 'exclamation' };
    case 'pose':
      return { type: 'pose', who, anim: 'Attack' };
    case 'hop':
      return { type: 'hop', who, count: 1 };
    case 'shake':
      return { type: 'shake', who };
    case 'aura':
      return { type: 'aura', who };
    case 'show':
      return { type: 'show', who, visible: true, fade: true };
    case 'place':
      return { type: 'place', who, x: 0, y: 0 };
    case 'camera':
      return { type: 'camera', x: ctx.camera.x, y: ctx.camera.y, duration: 0.8 };
    case 'follow':
      return { type: 'follow', who };
    case 'fade':
      return { type: 'fade', to: 'black', duration: 0.6 };
    case 'flash':
      return { type: 'flash', color: 'white', duration: 0.3 };
    case 'screenShake':
      return { type: 'screenShake', duration: 0.4, intensity: 2 };
    case 'weather':
      return { type: 'weather', weather: 'rain' };
    case 'lighting':
      return { type: 'lighting', mood: 'sunset', duration: 1.5 };
    case 'sound':
      return { type: 'sound', sound: ctx.firstSound ?? '' };
    case 'location':
      return { type: 'location', location: ctx.locationId, transition: 'black', placements: [] };
    case 'prop':
      return { type: 'prop', prop: ctx.firstProp ?? '', visible: true };
  }
}

const fmtSec = (s: number | undefined) => (s === undefined ? '' : `${Math.round(s * 100) / 100}s`);

export function summarizeAction(a: StageAction, nameOf: (castId: string) => string): string {
  const timing = `${a.start === 'after' ? 'then ' : ''}${a.delay ? `+${fmtSec(a.delay)} ` : ''}`;
  const who = 'who' in a && typeof a.who === 'string' ? nameOf(a.who) : '';
  let body: string;
  switch (a.type) {
    case 'walk':
      body = `${who} walks ${a.path.length ? `to (${a.path[a.path.length - 1]!.join(', ')})` : '(no path yet)'}${typeof a.speed === 'string' && a.speed !== 'walk' ? `, ${a.speed}` : ''}`;
      break;
    case 'face':
      body = `${who} faces ${a.toward ? nameOf(a.toward) : (a.facing ?? '…')}`;
      break;
    case 'emote':
      body = `${who}: ${EMOTE_LABELS[a.emote]}`;
      break;
    case 'pose':
      body = `${who} poses: ${a.anim}${a.hold ? ' (hold)' : ''}`;
      break;
    case 'hop':
      body = `${who} hops${a.count === 2 ? ' twice' : ''}`;
      break;
    case 'shake':
      body = `${who} shakes`;
      break;
    case 'aura':
      body = `Aura around ${who}`;
      break;
    case 'show':
      body = `${a.visible ? 'Show' : 'Hide'} ${who}${a.fade ? ' (fade)' : ''}`;
      break;
    case 'place':
      body = `${who} appears at (${a.x}, ${a.y})`;
      break;
    case 'camera':
      body = `Camera to (${a.x}, ${a.y})`;
      break;
    case 'follow':
      body = a.who ? `Camera follows ${nameOf(a.who)}` : 'Camera stops following';
      break;
    case 'fade':
      body = a.to === 'clear' ? 'Fade back in' : `Fade to ${a.to}`;
      break;
    case 'flash':
      body = `${a.color === 'black' ? 'Black' : 'White'} flash`;
      break;
    case 'screenShake':
      body = 'Screen shake';
      break;
    case 'weather':
      body = `Weather: ${WEATHER_LABELS[a.weather]}`;
      break;
    case 'lighting':
      body = `Lighting: ${LIGHTING_MOOD_LABELS[a.mood]}`;
      break;
    case 'sound':
      body = `Sound: ${a.sound || '(none picked)'}`;
      break;
    case 'location':
      body = `Change location → ${a.location} (${a.transition === 'cut' ? 'cut' : `fade ${a.transition}`})`;
      break;
    case 'prop':
      body = `Prop ${a.prop || '?'}${a.path?.length ? ' moves' : ''}${a.visible === false ? ' hides' : a.visible ? ' shows' : ''}`;
      break;
  }
  return `${timing}${body}`;
}

export function summarizeCondition(c: ShowIfCondition, nameOf: (castId: string) => string): string {
  const not = c.negate ? 'NOT ' : '';
  switch (c.kind) {
    case 'in_party':
      return `${not}${nameOf(c.cast)} is in the party`;
    case 'hero_is':
      return `${not}hero is ${c.species.map((s) => getSpeciesById(s)?.name ?? s).join(' / ')}`;
    case 'chapter_cleared':
      return `${not}${c.chapter} cleared`;
  }
}

export function beatHeadline(beat: Beat, nameOf: (castId: string) => string, fillNames?: (text: string) => string): { who: string; text: string } {
  if (!beat.say) {
    const n = beat.actions?.length ?? 0;
    return { who: 'Silent beat', text: n ? `${n} action${n === 1 ? '' : 's'}` : 'No actions yet' };
  }
  const who = beat.say.speaker === NARRATOR_SPEAKER_ID ? 'Narrator' : nameOf(beat.say.speaker);
  const text = stripRichDialogueTags(beat.say.text);
  return { who, text: (fillNames ? fillNames(text) : text) || '(empty line)' };
}
