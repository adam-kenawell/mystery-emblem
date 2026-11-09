/**
 * Pre-Prologue Story Cutscene: `cs_01_coastal_friends` (`prologue/preCutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_01_COASTAL_MEADOW } from '../cutsceneStages';

export const CS_01_COASTAL_FRIENDS: StoryCutsceneDefinition = {
  id: 'cs_01_coastal_friends',
  chapterOrder: 1,
  title: 'Morning Patrol',
  locationLabel: 'Coastal Trail · Verdant Commonwealth',
  lightingMood: 'morning_coast',
  width: 16,
  height: 11,
  tiles: STAGE_01_COASTAL_MEADOW,
  props: [{ id: 'coast_berries', kind: 'berry_basket', x: 5, y: 4 }],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    { actorId: 'lord', role: { kind: 'lord' }, x: 3, y: 5, direction: 'Right' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 4, y: 6, direction: 'Right' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 3, y: 6, direction: 'Right' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 2, y: 5, direction: 'Right' },
  ],
  openingDurationMs: 950,
  openingActions: [
    {
      type: 'walk',
      actorId: 'partner',
      path: [{ x: 7, y: 6 }, { x: 9, y: 5 }],
      speedTilesPerSec: 4.4,
      endDirection: 'Left',
    },
    { type: 'hop', actorId: 'partner', count: 2, delayMs: 650 },
    { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1100, delayMs: 650 },
    { type: 'walk', actorId: 'lord', path: [{ x: 6, y: 5 }], speedTilesPerSec: 3.2, endDirection: 'Right' },
    { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 6 }], speedTilesPerSec: 3.2, endDirection: 'Right' },
    { type: 'walk', actorId: 'advisor', path: [{ x: 5, y: 5 }], speedTilesPerSec: 3.4, endDirection: 'Right' },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
    ],
    1: [
      { type: 'walk', actorId: 'healer', path: [{ x: 7, y: 6 }], speedTilesPerSec: 3.0, endDirection: 'UpRight' },
      { type: 'emote', actorId: 'healer', emote: 'music', durationMs: 1100 },
    ],
    2: [
      { type: 'emote', actorId: 'partner', emote: 'angry', durationMs: 900 },
      { type: 'walk', actorId: 'partner', path: [{ x: 8, y: 5 }], speedTilesPerSec: 3.8, endDirection: 'DownLeft' },
    ],
    3: [
      { type: 'shake', actorId: 'advisor', durationMs: 520 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1250 },
      {
        type: 'walk',
        actorId: 'advisor',
        path: [{ x: 5, y: 6 }, { x: 5, y: 5 }],
        speedTilesPerSec: 4.0,
        endDirection: 'Right',
      },
    ],
    4: [
      { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 5 }], speedTilesPerSec: 2.8, endDirection: 'Right' },
      { type: 'face', actorId: 'partner', targetActorId: 'lord' },
      { type: 'face', actorId: 'healer', targetActorId: 'lord' },
    ],
    5: [
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
      { type: 'hop', actorId: 'advisor', count: 1 },
    ],
    6: [
      { type: 'walk', actorId: 'lord', path: [{ x: 10, y: 5 }], speedTilesPerSec: 3.4, endDirection: 'Right' },
      { type: 'camera', x: 9.0, y: 5.5, durationMs: 520 },
      { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 1200, delayMs: 320 },
    ],
    7: [
      { type: 'screenShake', durationMs: 280, intensityPx: 2 },
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950 },
      { type: 'emote', actorId: 'healer', emote: 'exclamation', durationMs: 950 },
      { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1100 },
      { type: 'walk', actorId: 'healer', path: [{ x: 9, y: 6 }], speedTilesPerSec: 3.6, endDirection: 'Right' },
    ],
    8: [
      { type: 'walk', actorId: 'partner', path: [{ x: 11, y: 4 }], speedTilesPerSec: 4.8, endDirection: 'Right' },
      { type: 'hop', actorId: 'partner', count: 2, delayMs: 360 },
    ],
    9: [
      { type: 'shake', actorId: 'advisor', durationMs: 600 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1300 },
      { type: 'walk', actorId: 'advisor', path: [{ x: 8, y: 5 }], speedTilesPerSec: 4.2, endDirection: 'Right' },
    ],
    10: [
      { type: 'pose', actorId: 'lord', action: 'Attack', durationMs: 520 },
      { type: 'face', actorId: 'partner', direction: 'Right' },
      { type: 'face', actorId: 'healer', direction: 'Right' },
    ],
  },
  buildScript: () => ({
    id: 'cs_01_coastal_friends',
    title: 'Coastal Trail',
    bgm: 'in_the_morning_sun',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Ha! Smell that sea breeze, team! Best morning patrol gig in the whole tribe—clear skies, zero chores, and yours truly leading the vanguard!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Hehe, by "leading the vanguard," do you mean tripping over two Krabby shells before we even left the village path, {partner}?',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Angry',
        text: 'T-those shells ambushed my flippers! Tell her, {lord}—we grew up running this coast together, you know I was scouting for traps!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Speaking of traps—did ANY of you read the updated Hazard & Enemy Range notes I stayed up all night writing?! One wild claw out here and I am bug soup!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'Every page, {advisor}. Between {partner} sprinting straight toward trouble and you sprinting straight away from it, our patrol pace actually averages out.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Happy',
        text: 'And I packed extra Oran Berries for all four of us—including yours, {lord}, so no quietly sneaking your share into {advisor}’s satchel today!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: '...Hold on, everyone. Quiet for a second. Look past the tide rocks toward Western Beach—why have all the Wingull gone silent?',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Worried',
        text: 'Oh no... purple miasma is curling around our tribe’s coastal shrine! And those heavy steel footprints in the wet sand—those aren’t ours!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Determined',
        text: 'Raiders?! On OUR tribe’s beach?! Not on my watch—come on, let’s go kick them right back into the surf!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Teary-Eyed',
        text: 'WAIT, {partner}, WE HAVEN’T CALCULATED THEIR ATTACK RANGES YET! Ugh, why are my best friends like this?! Save a big sturdy boulder for me to hide behind!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Don’t let {partner} charge in alone, {healer}! Keep your eyes sharp from cover, {advisor}—we protect Western Beach together!',
      },
    ],
  }),
};
