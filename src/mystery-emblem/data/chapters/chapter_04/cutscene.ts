/**
 * Post-Chapter 4 Story Cutscene: `cs_06_orchard_celebration` (`chapter_04/cutscene.ts`)
 *
 * Reunited with childhood village friend `Elekid`/`Pawmi` beneath the Berry Orchards lanterns,
 * the crew hears word of Kecleon's ambushed wagon in Oran Forest (Paralogue 2) and Gengar's
 * shadow scouts ascending Northern Mountain Pass (Chapter 5).
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_06_ORCHARD_TWILIGHT } from '../cutsceneStages';
import { SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export const CS_06_ORCHARD_CELEBRATION: StoryCutsceneDefinition = {
  id: 'cs_06_orchard_celebration',
  chapterOrder: 6,
  title: 'Lanterns in the Orchard',
  locationLabel: 'Berry Orchards Hearth · Twilight',
  lightingMood: 'twilight_festival',
  width: 18,
  height: 12,
  tiles: STAGE_06_ORCHARD_TWILIGHT,
  initialCamera: { x: 8.5, y: 6.0 },
  actors: [
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 8, y: 4, direction: 'Down' },
    { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 6, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 6, direction: 'UpLeft' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 7, y: 6, direction: 'UpRight' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 10, y: 6, direction: 'Left' },
    { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 5, y: 5, direction: 'DownRight' },
    { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 6, y: 8, direction: 'UpRight' },
    { actorId: 'recruit_2', role: { kind: 'cameo_recruit', slotIndex: 2 }, x: 11, y: 8, direction: 'UpLeft' },
    { actorId: 'recruit_3', role: { kind: 'cameo_recruit', slotIndex: 3 }, x: 13, y: 5, direction: 'DownLeft' },
  ],
  openingDurationMs: 750,
  openingActions: [
    { type: 'hop', actorId: 'partner', count: 2 },
    { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
    { type: 'hop', actorId: 'recruit_3', count: 1, delayMs: 280 },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1100 },
    ],
    1: [{ type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1150 }],
    2: [
      { type: 'hop', actorId: 'advisor', count: 1 },
      { type: 'emote', actorId: 'advisor', emote: 'joy', durationMs: 1100 },
    ],
    3: [
      { type: 'walk', actorId: 'mentor', path: [{ x: 8, y: 5 }], speedTilesPerSec: 2.5, endDirection: 'Down' },
      { type: 'emote', actorId: 'mentor', emote: 'exclamation', durationMs: 950 },
    ],
    4: [
      { type: 'shake', actorId: 'advisor', durationMs: 540 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
    ],
    5: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1150 },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 260 },
    ],
  },
  buildScript: () => ({
    id: 'cs_06_orchard_celebration',
    title: 'Berry Orchards Hearth',
    bgm: 'at_the_end_of_the_day',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Harvest saved, and another friend from home joined up! Our crew’s getting big, {lord}.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'It’s nice, seeing a familiar face out here. Eat up while the berries are warm.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Inspired',
        text: 'And Morgrem dropped a Full Heal! If anyone gets zapped again, I’ve got you covered.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Worried',
        text: 'Two reports, I’m afraid. First, Master Kecleon’s wagon was attacked in Oran Forest.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Shouting',
        text: 'Not Master Kecleon! Where else are we supposed to buy anything?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'And Gengar’s scouts are climbing the Northern Mountain Pass. Kecleon first, then the pass.',
      },
    ],
  }),
};
