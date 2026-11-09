/**
 * Post-Chapter 1 Story Cutscene: `cs_03_bluff_campfire` (`chapter_01/cutscene.ts`)
 *
 * Welcomed into the Verdant Royal Court after clearing the Capital Road, King Serperior and
 * Royal Advisor Lady Milotic commission `{lord}`'s crew—accompanied by mentor Sir Empoleon—to
 * investigate Abyssal tremors at Cleft Mountain.
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  KING_SERPERIOR_PMD_ASSET_ID,
  LADY_MILOTIC_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_02_SANCTUARY_GLADE } from '../cutsceneStages';
import {
  MILOTIC_SPEAKER,
  SERPERIOR_SPEAKER,
  SIR_EMPOLEON_SPEAKER,
} from '../scriptHelpers';

export const CS_03_BLUFF_CAMPFIRE: StoryCutsceneDefinition = {
  id: 'cs_03_bluff_campfire',
  chapterOrder: 3,
  title: 'King Serperior’s Commission',
  locationLabel: 'Royal Sanctuary Court · Verdant Capital',
  lightingMood: 'sanctuary_glow',
  width: 16,
  height: 12,
  tiles: STAGE_02_SANCTUARY_GLADE,
  props: [
    { id: 'court_gem_top', kind: 'sanctuary_crystal', x: 7, y: 2 },
    { id: 'court_lantern_l', kind: 'lantern', x: 5, y: 5 },
    { id: 'court_lantern_r', kind: 'lantern', x: 10, y: 5 },
  ],
  initialCamera: { x: 7.5, y: 6.0 },
  actors: [
    {
      actorId: 'serperior',
      role: { kind: 'npc', pmdAssetId: KING_SERPERIOR_PMD_ASSET_ID, name: 'King Serperior' },
      x: 7,
      y: 4,
      direction: 'Down',
    },
    {
      actorId: 'milotic',
      role: { kind: 'npc', pmdAssetId: LADY_MILOTIC_PMD_ASSET_ID, name: 'Lady Milotic' },
      x: 8,
      y: 4,
      direction: 'Down',
    },
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 6, y: 6, direction: 'UpRight' },
    { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 7, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 7, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 8, direction: 'Up' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 8, direction: 'Up' },
    { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 6, y: 9, direction: 'UpRight' },
    { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 9, y: 9, direction: 'UpLeft' },
  ],
  openingDurationMs: 800,
  openingActions: [
    { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 6 }], speedTilesPerSec: 2.8, endDirection: 'Up' },
    { type: 'walk', actorId: 'partner', path: [{ x: 8, y: 6 }], speedTilesPerSec: 3.0, endDirection: 'Up' },
  ],
  lineCues: {
    0: [{ type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 520 }],
    1: [
      { type: 'walk', actorId: 'milotic', path: [{ x: 8, y: 5 }], speedTilesPerSec: 2.2, endDirection: 'DownLeft' },
      { type: 'auraPulse', actorId: 'lord', durationMs: 1100, delayMs: 250 },
    ],
    2: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'hop', actorId: 'recruit_0', count: 1, delayMs: 220 },
    ],
    3: [
      { type: 'shake', actorId: 'advisor', durationMs: 520 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1150 },
    ],
    4: [{ type: 'walk', actorId: 'serperior', path: [{ x: 7, y: 5 }], speedTilesPerSec: 2.3, endDirection: 'Down' }],
    5: [{ type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 480 }],
    6: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1200 },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100, delayMs: 220 },
    ],
  },
  buildScript: () => ({
    id: 'cs_03_bluff_campfire',
    title: 'Royal Sanctuary Court',
    bgm: 'one_for_all',
    lines: [
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Welcome to the Royal Court, Sir Empoleon—and stand tall, young ones. Word of how you broke Captain Aron’s blockade on the Capital Road raced ahead of you.',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Happy',
        text: 'Look how warmly your Dragon Aura shines now, {lord}. Sir Empoleon raised a true protector beside young {partner} and gentle {healer}.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Plus two new pals tumbled straight out of the roadside brush into our squad! Point us at the next trouble spot, King Serperior!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Teary-Eyed',
        text: 'O-or a very safe royal library! Libraries have zero ambushes, Your Majesty—I volunteer to guard the bookshelves!',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Would that we had the luxury, little scholar. Violent Abyssal tremors are shaking Cleft Mountain to the east, and Gengar’s shadow scouts have been sighted among its crags.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'With your leave, King Serperior, I will accompany {lord}’s company personally as their vanguard mentor while they investigate Cleft Mountain.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'We accept your commission, King Serperior, Lady Milotic. Together with Sir Empoleon, we’ll uncover what’s shaking Cleft Mountain!',
      },
    ],
  }),
};
