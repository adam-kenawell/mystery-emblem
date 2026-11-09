/**
 * Post-Chapter 2 Story Cutscene: `cs_04_watchtower_bells` (`chapter_02/cutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_04_WATCHTOWER_PARAPET } from '../cutsceneStages';

export const CS_04_WATCHTOWER_BELLS: StoryCutsceneDefinition = {
  id: 'cs_04_watchtower_bells',
  chapterOrder: 4,
  title: 'Echoes of the Watchtower',
  locationLabel: 'Dragon Watchtower · Cleft Mountain',
  lightingMood: 'mountain_mist',
  width: 16,
  height: 11,
  tiles: STAGE_04_WATCHTOWER_PARAPET,
  props: [
    { id: 'watchtower_rune', kind: 'ancient_rune', x: 7, y: 3 },
    { id: 'watchtower_lantern_l', kind: 'lantern', x: 4, y: 4 },
    { id: 'watchtower_lantern_r', kind: 'lantern', x: 11, y: 4 },
  ],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 5, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 6, direction: 'UpLeft' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 6, direction: 'UpRight' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 8, y: 7, direction: 'Up' },
    { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 4, y: 6, direction: 'Right' },
    { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 11, y: 6, direction: 'Left' },
    { actorId: 'recruit_2', role: { kind: 'cameo_recruit', slotIndex: 2 }, x: 5, y: 4, direction: 'DownRight' },
  ],
  openingDurationMs: 700,
  openingActions: [
    { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 4 }], speedTilesPerSec: 2.6, endDirection: 'Up' },
    { type: 'auraPulse', actorId: 'lord', durationMs: 1150, delayMs: 350 },
  ],
  lineCues: {
    0: [{ type: 'walk', actorId: 'healer', path: [{ x: 6, y: 5 }], speedTilesPerSec: 2.8, endDirection: 'UpRight' }],
    1: [
      { type: 'face', actorId: 'lord', direction: 'DownRight' },
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1100 },
    ],
    2: [
      { type: 'emote', actorId: 'advisor', emote: 'joy', durationMs: 1050 },
      { type: 'hop', actorId: 'advisor', count: 1 },
    ],
    3: [
      { type: 'screenShake', durationMs: 360, intensityPx: 2 },
      { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 1000 },
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 1000 },
      { type: 'emote', actorId: 'healer', emote: 'exclamation', durationMs: 1000 },
      { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1000 },
      { type: 'walk', actorId: 'partner', path: [{ x: 8, y: 9 }], speedTilesPerSec: 4.8, endDirection: 'Down' },
      { type: 'camera', x: 7.5, y: 6.5, durationMs: 450 },
    ],
    4: [
      { type: 'shake', actorId: 'advisor', durationMs: 520 },
      { type: 'walk', actorId: 'advisor', path: [{ x: 7, y: 9 }], speedTilesPerSec: 5.2, endDirection: 'Down' },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
    ],
    5: [
      { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 8 }], speedTilesPerSec: 3.8, endDirection: 'Down' },
      { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 8 }], speedTilesPerSec: 3.8, endDirection: 'Down' },
    ],
  },
  buildScript: () => ({
    id: 'cs_04_watchtower_bells',
    title: 'Dragon Watchtower',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Worried',
        text: 'The stone crest is glowing softly in answer to you, {lord}... How are you holding up, seeing an actual watchtower of the old Dragon Kingdom?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'It feels warm—like half-remembering a lullaby. Then I turn around and see {partner} trying to balance a mountain pebble on his beak, and I feel completely grounded again.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Happy',
        text: 'Plus, zero monsters popped out of the last stairwell AND nobody tripped down a cliff! I am officially rating this mission a ten out of—',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Whoa—hear those bronze bells echoing up from the valley?! {lord}, look down at River Shrine! Ironscale troops have Master Merchant Kecleon’s wagons pinned between the rapids!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'NOT KECLEON!! Do you realize what happens to your HP bars without his Potions, Oran Berries, and Evolution Stones?! MOVE YOUR LEGS, PEOPLE, THIS IS CODE RED!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'First time in history {advisor} is leading the charge down a mountain. Stay right with him, {partner}, {healer}—let’s free River Shrine!',
      },
    ],
  }),
};
