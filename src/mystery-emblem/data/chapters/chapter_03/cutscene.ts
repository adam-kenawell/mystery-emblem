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
  props: [
    { id: 'shrine_lantern_l', kind: 'lantern', x: 6, y: 3 },
    { id: 'shrine_lantern_r', kind: 'lantern', x: 9, y: 3 },
    { id: 'shrine_wares_l', kind: 'berry_basket', x: 6, y: 8 },
    { id: 'shrine_wares_r', kind: 'berry_basket', x: 9, y: 8 },
  ],
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
        text: 'King Serperior, Lady Milotic... Commander Deino wasn’t fighting out of cruelty. He truly believed Emperor Kingambit’s iron rule is the only way to seal the Abyss.',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Sad',
        text: 'Deino is another orphaned child of the Dragon Kingdom’s fall, {lord}. Where the sea carried you to Sir Empoleon’s hearth, Deino grew up inside Ironscale’s barracks knowing only fear of the rift.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'And until we prove free kingdoms can stand together against the miasma, Deino will keep crossing blades with us. Look sharp—runners just arrived from the heartland.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Determined',
        text: 'Whatever’s coming, Dad and {lord} have us ready! Plus Deino dropped a real Evolution Stone when he retreated!',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Guard that Stone well for when one of you reaches your tenth milestone. Feral packs stirred by Deino’s march are raiding Berry Orchards—our people’s harvest is in danger!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Wait—scouts also marked a quiet side trail down into Lush Prairie on the World Map! Optional side paths mean extra allies if we detour!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Whether we scout Lush Prairie first or march straight into Berry Orchards, nobody starves our homeland on our watch!',
      },
    ],
  }),
};
