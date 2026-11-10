/**
 * Pre-Prologue Story Cutscene: `cs_01_coastal_friends` (`prologue/preCutscene.ts`)
 *
 * Sir Empoleon returns from King Serperior & Lady Milotic's royal court with news of the
 * widening Abyss and Ironscale mobilization, bringing foster child `{lord}`, biological son
 * `Piplup`, sanctuary healer `Flabébé`, and bush-hiding `Wimpod` to Western Beach to train.
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_01_COASTAL_MEADOW } from '../cutsceneStages';
import { SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export const CS_01_COASTAL_FRIENDS: StoryCutsceneDefinition = {
  id: 'cs_01_coastal_friends',
  chapterOrder: 1,
  title: 'The Royal Guard’s Lesson',
  locationLabel: 'Coastal Village Trail · Verdant Commonwealth',
  lightingMood: 'morning_coast',
  width: 16,
  height: 11,
  tiles: STAGE_01_COASTAL_MEADOW,
  props: [{ id: 'coast_berries', kind: 'berry_basket', x: 5, y: 4 }],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    { actorId: 'lord', role: { kind: 'lord' }, x: 4, y: 5, direction: 'Right' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 5, y: 6, direction: 'Right' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 4, y: 6, direction: 'Right' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 3, y: 5, direction: 'Right' },
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 11, y: 5, direction: 'Left' },
  ],
  openingDurationMs: 900,
  openingActions: [
    { type: 'walk', actorId: 'mentor', path: [{ x: 9, y: 5 }], speedTilesPerSec: 3.2, endDirection: 'Left' },
    { type: 'walk', actorId: 'partner', path: [{ x: 7, y: 6 }], speedTilesPerSec: 4.2, endDirection: 'UpRight' },
    { type: 'hop', actorId: 'partner', count: 2, delayMs: 520 },
    { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1100, delayMs: 520 },
    { type: 'walk', actorId: 'lord', path: [{ x: 6, y: 5 }], speedTilesPerSec: 3.2, endDirection: 'Right' },
    { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 6 }], speedTilesPerSec: 3.1, endDirection: 'Right' },
    { type: 'walk', actorId: 'advisor', path: [{ x: 5, y: 5 }], speedTilesPerSec: 3.5, endDirection: 'Right' },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1150 },
    ],
    1: [
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
      { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 6 }], speedTilesPerSec: 2.8, endDirection: 'UpRight' },
    ],
    2: [
      { type: 'shake', actorId: 'advisor', durationMs: 520 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
    ],
    3: [
      { type: 'walk', actorId: 'mentor', path: [{ x: 8, y: 5 }], speedTilesPerSec: 2.4, endDirection: 'Left' },
      { type: 'face', actorId: 'partner', targetActorId: 'mentor' },
    ],
    4: [
      { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 950 },
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950 },
      { type: 'emote', actorId: 'healer', emote: 'exclamation', durationMs: 950 },
    ],
    5: [
      { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 5 }], speedTilesPerSec: 2.8, endDirection: 'Right' },
    ],
    6: [
      { type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 520 },
      { type: 'hop', actorId: 'partner', count: 2, delayMs: 280 },
    ],
    7: [
      { type: 'shake', actorId: 'advisor', durationMs: 580 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1250 },
    ],
    8: [
      { type: 'walk', actorId: 'mentor', path: [{ x: 10, y: 5 }], speedTilesPerSec: 3.4, endDirection: 'Right' },
      { type: 'pose', actorId: 'lord', action: 'Attack', durationMs: 480 },
      { type: 'face', actorId: 'partner', direction: 'Right' },
      { type: 'face', actorId: 'healer', direction: 'Right' },
    ],
  },
  buildScript: () => ({
    id: 'cs_01_coastal_friends',
    title: 'Coastal Village Trail',
    bgm: 'in_the_morning_sun',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Joyous',
        text: 'Dad!! You’re back! {lord}, {healer}, {advisor}—tell him our drills were Royal Guard material!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Welcome home, Sir Empoleon! Well... I did have to patch {partner}’s flippers twice.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Phew, Sir Empoleon’s back—safety restored! Wait... why is he in full battle armor?!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Gather close, all four of you. I bring grim news from King Serperior and Lady Milotic’s court.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'The Abyss is widening, turning wild Pokémon Feral—and Kingambit’s Ironscale Empire is mobilizing.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'Ironscale...? Father, our village sits right on the western sea approach!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Play-sparring ends today, {lord}. You three—to Western Beach. I’ll teach you to fight for real!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Teary-Eyed',
        text: 'R-REAL COMBAT?! I only learned your drills so I’d never get hit! Is there a boulder I can hide behind?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Call out the drills from your boulder, {advisor}! Come on, {partner}, {healer}—let’s protect our home!',
      },
    ],
  }),
};
