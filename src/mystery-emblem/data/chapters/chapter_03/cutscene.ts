/**
 * Post-Chapter 3 Story Cutscene: `cs_05_sanctuary_war_room` (`chapter_03/cutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
  KECLEON_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_05_SHRINE_COURTYARD } from '../cutsceneStages';
import {
  KECLEON_SPEAKER,
  MILOTIC_SPEAKER,
  SERPERIOR_SPEAKER,
} from '../scriptHelpers';

export const CS_05_SANCTUARY_WAR_ROOM: StoryCutsceneDefinition = {
  id: 'cs_05_sanctuary_war_room',
  chapterOrder: 5,
  title: 'Council at River Shrine',
  locationLabel: 'River Shrine Courtyard · Verdant Commonwealth',
  lightingMood: 'shrine_courtyard',
  width: 16,
  height: 12,
  tiles: STAGE_05_SHRINE_COURTYARD,
  props: [
    { id: 'shrine_wares_l', kind: 'berry_basket', x: 6, y: 6 },
    { id: 'shrine_wares_r', kind: 'berry_basket', x: 9, y: 6 },
    { id: 'shrine_lantern_l', kind: 'lantern', x: 6, y: 3 },
    { id: 'shrine_lantern_r', kind: 'lantern', x: 9, y: 3 },
  ],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    {
      actorId: 'kecleon',
      role: { kind: 'npc', pmdAssetId: KECLEON_PMD_ASSET_ID, name: 'Kecleon' },
      x: 7,
      y: 5,
      direction: 'Down',
    },
    {
      actorId: 'serperior',
      role: {
        kind: 'npc',
        pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
        name: 'Chancellor Serperior',
      },
      x: 7,
      y: 1,
      direction: 'Down',
    },
    {
      actorId: 'milotic',
      role: {
        kind: 'npc',
        pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
        name: 'High Seeress Milotic',
      },
      x: 8,
      y: 1,
      direction: 'Down',
    },
    { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 7, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 7, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 7, direction: 'UpRight' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 7, direction: 'UpLeft' },
  ],
  openingDurationMs: 650,
  openingActions: [
    { type: 'hop', actorId: 'kecleon', count: 2 },
    { type: 'emote', actorId: 'kecleon', emote: 'joy', durationMs: 1100 },
  ],
  lineCues: {
    0: [
      { type: 'walk', actorId: 'kecleon', path: [{ x: 8, y: 6 }], speedTilesPerSec: 3.4, endDirection: 'DownRight' },
      { type: 'hop', actorId: 'kecleon', count: 1, delayMs: 280 },
    ],
    1: [
      { type: 'walk', actorId: 'advisor', path: [{ x: 9, y: 6 }], speedTilesPerSec: 3.6, endDirection: 'Left' },
      { type: 'emote', actorId: 'advisor', emote: 'heart', durationMs: 1200 },
    ],
    2: [
      { type: 'walk', actorId: 'kecleon', path: [{ x: 5, y: 5 }], speedTilesPerSec: 3.2, endDirection: 'Right' },
      { type: 'walk', actorId: 'serperior', path: [{ x: 7, y: 4 }], speedTilesPerSec: 2.6, endDirection: 'Down' },
      { type: 'walk', actorId: 'milotic', path: [{ x: 8, y: 4 }], speedTilesPerSec: 2.6, endDirection: 'Down' },
      { type: 'face', actorId: 'advisor', direction: 'UpLeft' },
    ],
    3: [
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950 },
      { type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 520 },
    ],
    4: [{ type: 'walk', actorId: 'lord', path: [{ x: 7, y: 6 }], speedTilesPerSec: 2.8, endDirection: 'Up' }],
    5: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 6 }], speedTilesPerSec: 3.0, endDirection: 'Up' },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1000 },
    ],
    6: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1150 },
      { type: 'hop', actorId: 'kecleon', count: 1, delayMs: 250 },
    ],
  },
  buildScript: () => ({
    id: 'cs_05_sanctuary_war_room',
    title: 'Council at River Shrine',
    bgm: 'one_for_all',
    lines: [
      {
        speaker: KECLEON_SPEAKER,
        side: 'right',
        emotion: 'Joyous',
        text: 'Splendidly rescued, my friends! My Kecleon Shops are officially open across cleared World Map roads—and here, Master {advisor}, a complimentary Oran Berry for your nerves!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Inspired',
        text: 'Sniff... finally, a merchant who understands preventative cowardice! I will treasure this emergency berry with my life!',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'Well fought at the river, {lord}, {partner}, {healer}. Forgive our haste—scouts just brought grave word from the heart of the Commonwealth.',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Sensing your awakened Dragon Aura, Commander Deino himself has marched his Ironscale vanguard—alongside Captains Linoone and Morgrem—directly into Berry Orchards!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Berry Orchards feeds every tribe in the Commonwealth. Unlike Aron, Commander Deino won’t sit anchored to a post—we’ll need to check our loadouts, draw out his captains, and strike as one.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Determined',
        text: 'Let Deino bring his whole vanguard! Nobody starves our home while the four of us—and our whole squad—are standing!',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Normal',
        text: 'Stock up at Kecleon’s stalls when you are ready, {lord}. May the bond of your tribe light the road to Berry Orchards!',
      },
    ],
  }),
};
