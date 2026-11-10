/**
 * Post-Prologue Story Cutscene: `cs_02_sanctuary_reveal` (`prologue/postCutscene.ts`)
 *
 * Dusk camp above Western Beach: Sir Empoleon speaks openly about finding `{lord}` washed ashore
 * as an infant after Royal Tactician Gengar's betrayal of the Ancient Dragon Kingdom, and leads
 * `{lord}`, `Piplup`, `Flabébé`, and `Wimpod` toward King Serperior's court via the Capital Road.
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_03_BLUFF_CAMP } from '../cutsceneStages';
import { SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export const CS_02_SANCTUARY_REVEAL: StoryCutsceneDefinition = {
  id: 'cs_02_sanctuary_reveal',
  chapterOrder: 2,
  title: 'Child of the Western Tide',
  locationLabel: 'Coastal Overlook · Evening Camp',
  lightingMood: 'campfire_dusk',
  width: 16,
  height: 11,
  tiles: STAGE_03_BLUFF_CAMP,
  props: [
    { id: 'coast_campfire', kind: 'campfire', x: 7, y: 5 },
    { id: 'coast_lantern', kind: 'lantern', x: 5, y: 4 },
    { id: 'coast_basket', kind: 'berry_basket', x: 9, y: 6 },
  ],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 6, y: 4, direction: 'DownRight' },
    { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 5, direction: 'Left' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 7, y: 6, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 5, direction: 'Right' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 8, y: 4, direction: 'DownLeft' },
  ],
  openingDurationMs: 750,
  openingActions: [
    { type: 'auraPulse', actorId: 'lord', durationMs: 1100 },
    { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950, delayMs: 250 },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1100 },
    ],
    1: [
      { type: 'shake', actorId: 'advisor', durationMs: 500 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1150 },
    ],
    2: [
      { type: 'walk', actorId: 'mentor', path: [{ x: 7, y: 4 }], speedTilesPerSec: 2.4, endDirection: 'Down' },
    ],
    3: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1100 },
      { type: 'emote', actorId: 'lord', emote: 'question', durationMs: 1050 },
    ],
    4: [
      { type: 'face', actorId: 'partner', targetActorId: 'lord' },
      { type: 'face', actorId: 'healer', targetActorId: 'lord' },
    ],
    5: [
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1200 },
      { type: 'hop', actorId: 'partner', count: 2, delayMs: 240 },
    ],
    6: [
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
    ],
    7: [
      { type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 500 },
      { type: 'walk', actorId: 'lord', path: [{ x: 9, y: 5 }], speedTilesPerSec: 2.8, endDirection: 'Right' },
      { type: 'face', actorId: 'partner', direction: 'Right' },
    ],
  },
  buildScript: () => ({
    id: 'cs_02_sanctuary_reveal',
    title: 'Coastal Overlook',
    bgm: 'thoughts_for_friends',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Dad, did you see that?! When that Aron lunged, golden light blazed off {lord}’s scales!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Stunned',
        text: '“Foster sibling glows like an ancient legend” was NOT in any of Sir Empoleon’s scrolls!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Sad',
        text: 'Time you heard the truth. When Royal Tactician Gengar betrayed the Dragon Kingdom and tore open the Abyss, an infant washed ashore on this beach.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'With the King and Lady Milotic’s blessing, I raised you beside {partner}, {lord}—as family.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'right',
        emotion: 'Surprised',
        text: 'You knew all along, and still raised me... {partner}, {healer}, {advisor}—does this change things?',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Not one bit! You’re still *our* {lord}—the one who carried {advisor} across the crab pools!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Heck yeah! You’re my brother, {lord}! Anyone who wants you has to get through me AND Dad!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Rest well. At first light we take the Capital Road to warn the King.',
      },
    ],
  }),
};
