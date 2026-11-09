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
        text: 'Dad, did you see that on Western Beach?! When that Ironscale Aron lunged at us, golden light blazed straight off {lord}’s scales!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Stunned',
        text: 'I memorized every scroll in Sir Empoleon’s study and "foster sibling glowing like an ancient legend" was NOT in the basic footwork chapter!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Sad',
        text: 'It is time you all heard the full truth. Years ago, when Royal Tactician Gengar betrayed the Ancient Dragon Kingdom and tore open the Abyss, a tiny infant washed ashore on Western Beach.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'With King Serperior and Lady Milotic’s blessing, I took you into my home and raised you beside {partner}, {lord}—so you would grow up with a family, not a burden.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Royal Tactician Gengar’s betrayal... You knew what I was all along, Sir Empoleon, and still raised me as your own. {partner}, {healer}, {advisor}... does knowing my bloodline change things?',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Not even a tiny bit! Dragon Kingdom scion or not, you’re still *our* {lord}—the friend who helped me water the sanctuary flowers and carried {advisor} across crab pools!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Heck yeah! You’re my brother no matter where the tide carried you from, {lord}! Anyone from Ironscale or the Abyss who wants you has to go through me AND Dad first!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Rest well tonight, kids. At first light we march inland along the Capital Road to warn King Serperior and Lady Milotic that Ironscale scouts have landed!',
      },
    ],
  }),
};
