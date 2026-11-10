/**
 * Post-Chapter 2 Story Cutscene: `cs_04_watchtower_bells` (`chapter_02/cutscene.ts`)
 *
 * Atop Cleft Mountain's ancient Dragon Watchtower, `{lord}` and Sir Empoleon hear the valley
 * alarm bells as Commander Deino leads an Ironscale strike force against Sparkling River Shrine.
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_04_WATCHTOWER_PARAPET } from '../cutsceneStages';
import { SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

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
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 8, y: 5, direction: 'UpLeft' },
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
      { type: 'screenShake', durationMs: 340, intensityPx: 2 },
      { type: 'emote', actorId: 'mentor', emote: 'exclamation', durationMs: 1000 },
      { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 1000 },
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 1000 },
      { type: 'walk', actorId: 'mentor', path: [{ x: 8, y: 8 }], speedTilesPerSec: 4.0, endDirection: 'Down' },
      { type: 'camera', x: 7.5, y: 6.5, durationMs: 450 },
    ],
    3: [
      { type: 'walk', actorId: 'partner', path: [{ x: 9, y: 8 }], speedTilesPerSec: 4.5, endDirection: 'Down' },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 280 },
    ],
    4: [
      { type: 'shake', actorId: 'advisor', durationMs: 520 },
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
        text: 'The crest answers your touch, {lord}... How does a Dragon Kingdom stronghold feel?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'Warm, like an old lullaby. But seeing {partner} balance a pebble on his beak, I know where I belong.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Surprised',
        text: 'Hold—hear those bells? Look down at Sparkling River Shrine!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Angry',
        text: 'Crimson banners on the bridges! An Ironscale vanguard is marching on the shrine!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'And that’s Commander Deino leading them! An Imperial DRAGON?! My shell is NOT rated for this!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'A Dragon... fighting for Ironscale? Stay close, everyone—we defend the shrine!',
      },
    ],
  }),
};
