/**
 * Cutscene Editor Validation & Dialogue Length Checks (`editorValidation.ts`)
 */

import { resolveBgmTrack } from '../audio/audioTracks';
import {
  NARRATOR_SPEAKER_ID,
  type Beat,
  type CastMember,
  type StageAction,
} from '../data/cutscenes/cutsceneDocTypes';
import { resolveMediaUrl } from '../data/cutscenes/mediaLibrary';
import { stripRichDialogueTags } from '../ui/typewriterController';
import type { SessionData } from './editorSession';

/** Same soft limit the dialogue lint used: about three lines of the box on a phone. */
export const DIALOGUE_SOFT_LIMIT = 110;
const LONGEST_NAME = 'W'.repeat(12);

export function measureDialogueLength(text: string): number {
  return stripRichDialogueTags(text)
    .replace(/\{(lord|partner|healer|mentor|advisor|speaker)\}/g, LONGEST_NAME)
    .replace(/\{name:[a-z0-9_]+\}/gi, LONGEST_NAME).length;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  beatId?: string;
}

function checkActions(
  beat: Beat,
  actions: ReadonlyArray<StageAction>,
  castIds: ReadonlySet<string>,
  propIds: ReadonlySet<string>,
  locationIds: ReadonlySet<string>,
  issues: ValidationIssue[]
): void {
  for (const a of actions) {
    const where = { beatId: beat.id };
    if ('who' in a && typeof a.who === 'string' && !castIds.has(a.who)) {
      issues.push({ level: 'error', message: `An action uses "${a.who}", who isn't in the cast.`, ...where });
    }
    if (a.type === 'walk' && a.path.length === 0) issues.push({ level: 'warning', message: 'A walk has no path yet (tap the stage to add steps).', ...where });
    if (a.type === 'face' && a.toward && !castIds.has(a.toward)) issues.push({ level: 'error', message: `"Face" points at missing cast member "${a.toward}".`, ...where });
    if (a.type === 'sound' && !resolveMediaUrl('sfx', a.sound)) issues.push({ level: 'warning', message: `Sound "${a.sound || '(none)'}" isn't in assets/sfx.`, ...where });
    if (a.type === 'location') {
      if (!locationIds.has(a.location)) issues.push({ level: 'error', message: `Location "${a.location}" doesn't exist.`, ...where });
      for (const p of a.placements) if (!castIds.has(p.id)) issues.push({ level: 'error', message: `Location change places unknown cast "${p.id}".`, ...where });
    }
    if (a.type === 'prop' && !propIds.has(a.prop)) issues.push({ level: 'error', message: `Prop "${a.prop || '(none)'}" doesn't exist.`, ...where });
  }
}

function checkLines(beats: ReadonlyArray<Beat>, cast: ReadonlyArray<CastMember>, issues: ValidationIssue[]): void {
  const castIds = new Set(cast.map((c) => c.id));
  for (const beat of beats) {
    const say = beat.say;
    if (!say) continue;
    if (say.speaker !== NARRATOR_SPEAKER_ID && !castIds.has(say.speaker)) {
      issues.push({ level: 'error', message: `Speaker "${say.speaker}" isn't in the cast.`, beatId: beat.id });
    }
    if (!say.text.trim()) issues.push({ level: 'warning', message: 'A dialogue box is empty.', beatId: beat.id });
    const len = measureDialogueLength(say.text);
    if (len > DIALOGUE_SOFT_LIMIT) {
      issues.push({ level: 'warning', message: `Line is too long for a phone (${len}/${DIALOGUE_SOFT_LIMIT}).`, beatId: beat.id });
    }
    if (beat.music?.kind === 'song' && !resolveBgmTrack(beat.music.song)) {
      issues.push({ level: 'warning', message: `Song "${beat.music.song}" wasn't found.`, beatId: beat.id });
    }
    if (beat.sound && !resolveMediaUrl('sfx', beat.sound)) issues.push({ level: 'warning', message: `Sound "${beat.sound}" isn't in assets/sfx.`, beatId: beat.id });
    for (const c of beat.showIf ?? []) {
      if (c.kind === 'in_party' && !castIds.has(c.cast)) issues.push({ level: 'error', message: `Show-if uses missing cast "${c.cast}".`, beatId: beat.id });
    }
  }
}

export function validateSession(data: SessionData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { doc } = data;
  if (!/^[a-z0-9_]+$/.test(doc.id)) issues.push({ level: 'error', message: 'The id may only use a–z, 0–9 and _.' });
  const castIds = new Set<string>();
  for (const c of doc.cast) {
    if (castIds.has(c.id)) issues.push({ level: 'error', message: `Two cast members share the id "${c.id}".` });
    castIds.add(c.id);
  }
  if (doc.beats.length === 0) issues.push({ level: 'error', message: 'Add at least one beat.' });
  checkLines(doc.beats, doc.cast, issues);

  if (data.kind === 'story') {
    const story = data.doc;
    const locationIds = new Set(Object.keys(data.locations));
    if (!locationIds.has(story.location)) issues.push({ level: 'error', message: 'Pick a starting location.' });
    if (story.music && !resolveBgmTrack(story.music)) issues.push({ level: 'warning', message: `Main song "${story.music}" wasn't found.` });
    const propIds = new Set((story.props ?? []).map((p) => p.id));
    for (const beat of story.beats) {
      for (const a of beat.actions ?? []) if (a.type === 'location') for (const p of a.props ?? []) propIds.add(p.id);
    }
    for (const beat of story.beats) checkActions(beat, beat.actions ?? [], castIds, propIds, locationIds, issues);
    for (const loc of Object.values(data.locations)) {
      for (const layer of loc.layers) {
        if (layer.kind !== 'tiles' && !resolveMediaUrl('cutscene-backgrounds', layer.image)) {
          issues.push({ level: 'warning', message: `Location "${loc.name}": image "${layer.image || '(none)'}" is missing.` });
        }
      }
    }
  } else if (data.doc.role === 'event' && !data.event) {
    issues.push({ level: 'warning', message: 'This dialogue has no trigger, so it never plays. Set one in the Trigger tab.' });
  }
  return issues;
}
