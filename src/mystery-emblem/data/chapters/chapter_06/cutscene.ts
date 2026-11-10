/**
 * Post-Chapter 6 (Part 1A Demo Finale) Story Cutscene: `cs_08_fortress_resolve` (`chapter_06/cutscene.ts`)
 *
 * With Border Fortress held against Commander Lairon's siege, King Serperior, Lady Milotic, and
 * Sir Empoleon join `{lord}`, `Piplup`, `Flabébé`, `Wimpod`, and the entire Verdant Heartland
 * roster as they prepare to cross into the coup-torn Goldensand Diarchy (Act 1B) -> Credits!
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  KECLEON_PMD_ASSET_ID,
  KING_SERPERIOR_PMD_ASSET_ID,
  LADY_MILOTIC_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_06_ORCHARD_TWILIGHT } from '../cutsceneStages';
import {
  MILOTIC_SPEAKER,
  SERPERIOR_SPEAKER,
  SIR_EMPOLEON_SPEAKER,
} from '../scriptHelpers';

export const CS_08_FORTRESS_RESOLVE: StoryCutsceneDefinition = {
  id: 'cs_08_fortress_resolve',
  chapterOrder: 8,
  title: 'Beyond the Verdant Heartland',
  locationLabel: 'Border Fortress Overlook · Dawn Watch',
  lightingMood: 'twilight_festival',
  width: 18,
  height: 12,
  tiles: STAGE_06_ORCHARD_TWILIGHT,
  initialCamera: { x: 8.5, y: 6.0 },
  actors: [
    {
      actorId: 'serperior',
      role: { kind: 'npc', pmdAssetId: KING_SERPERIOR_PMD_ASSET_ID, name: 'King Serperior' },
      x: 7,
      y: 4,
      direction: 'DownRight',
    },
    {
      actorId: 'milotic',
      role: { kind: 'npc', pmdAssetId: LADY_MILOTIC_PMD_ASSET_ID, name: 'Lady Milotic' },
      x: 10,
      y: 4,
      direction: 'DownLeft',
    },
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 6, y: 5, direction: 'Right' },
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
    2: [{ type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 500 }],
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
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1200 },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 260 },
    ],
    7: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1400 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1300, delayMs: 260 },
    ],
  },
  buildScript: () => ({
    id: 'cs_08_fortress_resolve',
    title: 'Beyond the Verdant Heartland',
    bgm: 'a_wish_for_peace',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Not bad for village kids who were sparring on the beach not long ago, huh, Dad?',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Inspired',
        text: 'And I didn’t faint once the whole siege. I’d like that written down somewhere.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Happy',
        text: 'You’ve outgrown every lesson I taught you, {lord}, {partner}. The Heartland stands because of you all.',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'But Lairon spoke the truth. A coup has toppled Goldensand’s rulers, and the Abyss keeps growing.',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Happy',
        text: 'When the desert road opens, {lord}, you won’t walk it alone. You’ll walk it with your family.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'From the village to the dunes, wherever you go, {lord}, we’re going too.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Ten Oran Berries says I cross the border first. Someone pack sunscreen for {advisor}’s shell.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'Deal. Thank you, everyone. Whatever comes next, we face it together.',
      },
    ],
  }),
};
