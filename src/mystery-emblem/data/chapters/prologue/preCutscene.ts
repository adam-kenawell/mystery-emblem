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
        text: 'Dad!! You’re back from the Royal Court early! Hey {lord}, {healer}, {advisor}—tell my dad our village sparring drills were practically Royal Guard material while he was away!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Welcome home, Sir Empoleon! If by "Royal Guard material" {partner} means scraping his flippers twice so I had to patch him up at the flower sanctuary, then yes!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Phew, Sir Empoleon is back—safety levels restored to 100%! Wait... why is he still wearing his full Royal Guard battle armor?!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Gather close, all four of you. I have just ridden from King Serperior and Royal Advisor Lady Milotic’s court with grim tidings.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'The southeastern Abyss is splitting wider—driving wild Pokémon Feral across our borders—and Emperor Kingambit’s Ironscale Empire has begun mobilizing its legions.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'Ironscale is mobilizing...? Father, if the peace is breaking, our quiet coastal village sits right along the western sea approach!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Sharp as ever, {lord}. Wooden play-sparring ends today. {lord}, {partner}, {healer}—march with me to Western Beach right now. I am teaching you three how to fight for real!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Teary-Eyed',
        text: 'R-REAL COMBAT?! Sir Empoleon, I only memorized all your tactical drills from the bushes so I’d never get hit! Please tell me there’s a sturdy boulder on the sidelines with my name on it!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Call out those drills from behind your boulder, {advisor}! Come on, {partner}, {healer}—let’s show Sir Empoleon we’re ready to protect our home!',
      },
    ],
  }),
};
