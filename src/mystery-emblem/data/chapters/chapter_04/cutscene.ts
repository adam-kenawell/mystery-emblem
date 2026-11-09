/**
 * Post-Chapter 4 (Act I Finale) Story Cutscene: `cs_06_orchard_celebration` (`chapter_04/cutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
  KECLEON_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_06_ORCHARD_TWILIGHT } from '../cutsceneStages';
import { MILOTIC_SPEAKER, SERPERIOR_SPEAKER } from '../scriptHelpers';

export const CS_06_ORCHARD_CELEBRATION: StoryCutsceneDefinition = {
  id: 'cs_06_orchard_celebration',
  chapterOrder: 6,
  title: 'Beneath the Orchard Stars',
  locationLabel: 'Berry Orchards Overlook · Twilight',
  lightingMood: 'twilight_festival',
  width: 18,
  height: 12,
  tiles: STAGE_06_ORCHARD_TWILIGHT,
  props: [
    { id: 'fest_lantern_1', kind: 'lantern', x: 6, y: 4 },
    { id: 'fest_lantern_2', kind: 'lantern', x: 11, y: 4 },
    { id: 'fest_lantern_3', kind: 'lantern', x: 5, y: 7 },
    { id: 'fest_lantern_4', kind: 'lantern', x: 12, y: 7 },
    { id: 'fest_berries_l', kind: 'berry_basket', x: 4, y: 6 },
    { id: 'fest_berries_r', kind: 'berry_basket', x: 13, y: 6 },
  ],
  initialCamera: { x: 8.5, y: 6.0 },
  actors: [
    {
      actorId: 'serperior',
      role: {
        kind: 'npc',
        pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
        name: 'Chancellor Serperior',
      },
      x: 7,
      y: 4,
      direction: 'DownRight',
    },
    {
      actorId: 'milotic',
      role: {
        kind: 'npc',
        pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
        name: 'High Seeress Milotic',
      },
      x: 10,
      y: 4,
      direction: 'DownLeft',
    },
    {
      actorId: 'kecleon',
      role: { kind: 'npc', pmdAssetId: KECLEON_PMD_ASSET_ID, name: 'Kecleon' },
      x: 13,
      y: 5,
      direction: 'DownLeft',
    },
    { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 6, direction: 'Down' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 6, direction: 'DownLeft' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 7, y: 6, direction: 'Right' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 10, y: 6, direction: 'Left' },
    { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 4, y: 5, direction: 'DownRight' },
    { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 5, y: 8, direction: 'UpRight' },
    { actorId: 'recruit_2', role: { kind: 'cameo_recruit', slotIndex: 2 }, x: 12, y: 8, direction: 'UpLeft' },
    { actorId: 'recruit_3', role: { kind: 'cameo_recruit', slotIndex: 3 }, x: 14, y: 7, direction: 'Left' },
  ],
  openingDurationMs: 850,
  openingActions: [
    { type: 'hop', actorId: 'partner', count: 2 },
    { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
    { type: 'emote', actorId: 'kecleon', emote: 'music', durationMs: 1200, delayMs: 200 },
    { type: 'hop', actorId: 'recruit_0', count: 1, delayMs: 300 },
    { type: 'hop', actorId: 'recruit_2', count: 1, delayMs: 420 },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
    ],
    1: [
      { type: 'hop', actorId: 'advisor', count: 2 },
      { type: 'emote', actorId: 'advisor', emote: 'music', durationMs: 1200 },
    ],
    2: [
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1200 },
      { type: 'face', actorId: 'lord', targetActorId: 'healer' },
    ],
    3: [
      { type: 'walk', actorId: 'serperior', path: [{ x: 8, y: 4 }], speedTilesPerSec: 2.4, endDirection: 'Down' },
      { type: 'face', actorId: 'lord', direction: 'Up' },
      { type: 'face', actorId: 'partner', direction: 'Up' },
      { type: 'face', actorId: 'healer', direction: 'Up' },
      { type: 'face', actorId: 'advisor', direction: 'Up' },
    ],
    4: [{ type: 'walk', actorId: 'milotic', path: [{ x: 9, y: 4 }], speedTilesPerSec: 2.4, endDirection: 'Down' }],
    5: [
      { type: 'walk', actorId: 'serperior', path: [{ x: 6, y: 4 }], speedTilesPerSec: 2.5, endDirection: 'DownRight' },
      { type: 'walk', actorId: 'milotic', path: [{ x: 11, y: 4 }], speedTilesPerSec: 2.5, endDirection: 'DownLeft' },
      { type: 'walk', actorId: 'lord', path: [{ x: 8, y: 3 }], speedTilesPerSec: 2.8, endDirection: 'Up' },
      { type: 'walk', actorId: 'partner', path: [{ x: 9, y: 3 }], speedTilesPerSec: 3.0, endDirection: 'Up' },
      { type: 'walk', actorId: 'healer', path: [{ x: 7, y: 3 }], speedTilesPerSec: 2.8, endDirection: 'Up' },
      { type: 'walk', actorId: 'advisor', path: [{ x: 10, y: 3 }], speedTilesPerSec: 3.0, endDirection: 'Up' },
      { type: 'camera', x: 8.5, y: 4.2, durationMs: 750 },
    ],
    6: [
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1100 },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 260 },
    ],
    7: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1400 },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1300, delayMs: 200 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1300, delayMs: 320 },
    ],
  },
  buildScript: () => ({
    id: 'cs_06_orchard_celebration',
    title: 'Beneath the Orchard Stars',
    bgm: 'a_wish_for_peace',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Commander Deino and his whole vanguard—sent packing! Not bad for four friends who started the week arguing over Krabby shells on morning patrol, huh?!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Inspired',
        text: 'AND for the record, I only hid behind TWO berry bushes during the finale instead of three! That is measurable bravery growth AND my survival notes worked!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Best of all, every single one of us made it back to see the orchard lanterns together. Look how many new friends are sharing our table tonight, {lord}!',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Happy',
        text: 'Tonight, the Verdant Commonwealth breathes free because of your courage. Yet Deino’s parting words ring true—Emperor Kingambit’s legions and Gengar’s Abyss reach far beyond our woods.',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Happy',
        text: 'When the roads to the distant kingdoms open, {lord}, you will not walk them as a lone echo of the vanished Dragon Court—you walk them with the family who raised your heart.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Happy',
        text: 'Hear that, guys? Five whole kingdoms out past that horizon! Bet you ten Oran Berries I reach the border pass first!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Worried',
        text: 'Five kingdoms’ worth of boss attack ranges?! Ugh... Kecleon, I’m going to need a way bigger waterproof notebook!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'Pack two notebooks, {advisor}—and save some berries for the road, {partner}, {healer}. Whatever waits beyond our coast... we face it together.',
      },
    ],
  }),
};
