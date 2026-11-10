/**
 * Post-Chapter 3 Story Cutscene: `cs_05_sanctuary_war_room` (`chapter_03/cutscene.ts`)
 *
 * After driving Commander Deino back from Sparkling River Shrine, King Serperior, Lady Milotic,
 * and Sir Empoleon reflect on Deino's upbringing inside Ironscale and dispatch the squad to
 * stop Feral raids at Berry Orchards (while opening the side path to Lush Prairie).
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  KING_SERPERIOR_PMD_ASSET_ID,
  LADY_MILOTIC_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_05_SHRINE_COURTYARD } from '../cutsceneStages';
import {
  MILOTIC_SPEAKER,
  SERPERIOR_SPEAKER,
  SIR_EMPOLEON_SPEAKER,
} from '../scriptHelpers';

export const CS_05_SANCTUARY_WAR_ROOM: StoryCutsceneDefinition = {
  id: 'cs_05_sanctuary_war_room',
  chapterOrder: 5,
  title: 'Two Children of the Fall',
  locationLabel: 'Sparkling River Shrine · Courtyard',
  lightingMood: 'shrine_courtyard',
  width: 16,
  height: 12,
  tiles: STAGE_05_SHRINE_COURTYARD,
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    {
      actorId: 'serperior',
      role: { kind: 'npc', pmdAssetId: KING_SERPERIOR_PMD_ASSET_ID, name: 'King Serperior' },
      x: 7,
      y: 3,
      direction: 'Down',
    },
    {
      actorId: 'milotic',
      role: { kind: 'npc', pmdAssetId: LADY_MILOTIC_PMD_ASSET_ID, name: 'Lady Milotic' },
      x: 8,
      y: 3,
      direction: 'Down',
    },
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 6, y: 5, direction: 'UpRight' },
    { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 6, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 6, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 7, direction: 'UpRight' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 7, direction: 'UpLeft' },
  ],
  openingDurationMs: 700,
  openingActions: [
    { type: 'walk', actorId: 'serperior', path: [{ x: 7, y: 4 }], speedTilesPerSec: 2.3, endDirection: 'Down' },
    { type: 'walk', actorId: 'milotic', path: [{ x: 8, y: 4 }], speedTilesPerSec: 2.3, endDirection: 'Down' },
  ],
  lineCues: {
    0: [{ type: 'walk', actorId: 'lord', path: [{ x: 7, y: 5 }], speedTilesPerSec: 2.6, endDirection: 'Up' }],
    1: [{ type: 'emote', actorId: 'milotic', emote: 'sweat', durationMs: 1050 }],
    2: [{ type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 480 }],
    3: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
    ],
    4: [{ type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 520 }],
    5: [
      { type: 'shake', actorId: 'advisor', durationMs: 500 },
      { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1000 },
    ],
    6: [{ type: 'auraPulse', actorId: 'lord', durationMs: 1200 }],
  },
  buildScript: () => ({
    id: 'cs_05_sanctuary_war_room',
    title: 'Sparkling River Shrine',
    bgm: 'thoughts_for_friends',
    lines: [
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Worried',
        text: 'Deino isn’t cruel. He really believes Kingambit’s way is the only way to stop the Abyss.',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Sad',
        text: 'He lost his home the same night you did, {lord}. The sea brought you to Sir Empoleon. Ironscale found him.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Until the free kingdoms stand together, he’ll keep coming. Look sharp. A runner’s here.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Determined',
        text: 'Whatever it is, we’re ready. And look what Deino dropped. This stone is warm!',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'An Evolution Stone. Keep it safe. And this runner brings word: Ferals are raiding the Berry Orchards.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Our scouts also found a trail into Lush Prairie. Maybe someone out there needs help?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Prairie or orchards, we’ll get to both. Nobody goes hungry on our watch.',
      },
    ],
  }),
};
