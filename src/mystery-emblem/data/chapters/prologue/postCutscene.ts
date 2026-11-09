/**
 * Post-Prologue Story Cutscene: `cs_02_sanctuary_reveal` (`prologue/postCutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
} from '../../campaignConfig';
import { STAGE_02_SANCTUARY_GLADE } from '../cutsceneStages';
import { MILOTIC_SPEAKER, SERPERIOR_SPEAKER } from '../scriptHelpers';

export const CS_02_SANCTUARY_REVEAL: StoryCutsceneDefinition = {
  id: 'cs_02_sanctuary_reveal',
  chapterOrder: 2,
  title: 'The Sheltered Scion',
  locationLabel: 'Emerald Sanctuary · Verdant Commonwealth',
  lightingMood: 'sanctuary_glow',
  width: 16,
  height: 12,
  tiles: STAGE_02_SANCTUARY_GLADE,
  props: [
    { id: 'sanctuary_gem_top', kind: 'sanctuary_crystal', x: 7, y: 2 },
    { id: 'sanctuary_lantern_l', kind: 'lantern', x: 5, y: 5 },
    { id: 'sanctuary_lantern_r', kind: 'lantern', x: 10, y: 5 },
  ],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    {
      actorId: 'serperior',
      role: {
        kind: 'npc',
        pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
        name: 'Chancellor Serperior',
      },
      x: 6,
      y: 4,
      direction: 'Down',
    },
    {
      actorId: 'milotic',
      role: {
        kind: 'npc',
        pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
        name: 'High Seeress Milotic',
      },
      x: 9,
      y: 4,
      direction: 'Down',
    },
    { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 10, direction: 'Up' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 10, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 10, direction: 'Up' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 10, direction: 'Up' },
  ],
  openingDurationMs: 950,
  openingActions: [
    { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 7 }], speedTilesPerSec: 3.2, endDirection: 'Up' },
    { type: 'walk', actorId: 'partner', path: [{ x: 8, y: 7 }], speedTilesPerSec: 3.5, endDirection: 'Up' },
    { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 8 }], speedTilesPerSec: 3.1, endDirection: 'Up' },
    { type: 'walk', actorId: 'advisor', path: [{ x: 9, y: 8 }], speedTilesPerSec: 3.4, endDirection: 'Up' },
  ],
  lineCues: {
    0: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 1100 },
    ],
    1: [
      { type: 'shake', actorId: 'advisor', durationMs: 500 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
    ],
    2: [
      { type: 'walk', actorId: 'milotic', path: [{ x: 8, y: 5 }], speedTilesPerSec: 2.2, endDirection: 'DownLeft' },
      { type: 'auraPulse', actorId: 'lord', durationMs: 1100, delayMs: 250 },
    ],
    3: [
      { type: 'walk', actorId: 'serperior', path: [{ x: 7, y: 5 }], speedTilesPerSec: 2.4, endDirection: 'Down' },
    ],
    4: [
      { type: 'emote', actorId: 'lord', emote: 'question', durationMs: 1150 },
      { type: 'face', actorId: 'lord', direction: 'DownRight' },
      { type: 'face', actorId: 'partner', targetActorId: 'lord' },
      { type: 'face', actorId: 'healer', targetActorId: 'lord' },
    ],
    5: [
      { type: 'walk', actorId: 'healer', path: [{ x: 6, y: 7 }], speedTilesPerSec: 3.0, endDirection: 'Right' },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1250 },
    ],
    6: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
      { type: 'face', actorId: 'lord', direction: 'Up' },
    ],
    7: [
      { type: 'walk', actorId: 'milotic', path: [{ x: 9, y: 5 }], speedTilesPerSec: 2.2, endDirection: 'DownLeft' },
      { type: 'face', actorId: 'partner', direction: 'Up' },
      { type: 'face', actorId: 'healer', direction: 'Up' },
    ],
    8: [
      { type: 'walk', actorId: 'serperior', path: [{ x: 7, y: 4 }], speedTilesPerSec: 2.4, endDirection: 'Down' },
      { type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 560 },
    ],
    9: [
      { type: 'shake', actorId: 'advisor', durationMs: 580 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1300 },
    ],
    10: [
      { type: 'walk', actorId: 'lord', path: [{ x: 7, y: 6 }], speedTilesPerSec: 2.8, endDirection: 'Up' },
      { type: 'auraPulse', actorId: 'lord', durationMs: 1250 },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 350 },
    ],
  },
  buildScript: () => ({
    id: 'cs_02_sanctuary_reveal',
    title: 'Emerald Sanctuary',
    bgm: 'thoughts_for_friends',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Surprised',
        text: 'Chancellor Serperior! High Seeress Milotic! You HAVE to tell us what just happened on Western Beach—golden light flared right off {lord}’s scales!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Stunned',
        text: 'I checked every page of our coastal tribe handbook and "bursting into ancient golden radiance" is definitely not listed under normal growing pains!',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Sad',
        text: 'Step closer, little ones. That warm golden light is Dragon Aura... a truth Chancellor Serperior and I quietly guarded so {lord} could grow up safe and free.',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Years ago, when the ancient Dragon Kingdom fell, we sheltered {lord} as a tiny hatchling within your coastal tribe—with no royal title, so {lord} would know ordinary joy and true friendship first.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'A survivor of the Dragon Kingdom...? All my life I thought I was just another kid from the coast. {partner}, {healer}, {advisor}... does this change who I am to you?',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Happy',
        text: 'Not for a single heartbeat! Secret Dragon heritage or not, you’re still *our* {lord}—the friend who shared berry rations in rainstorms and untangled seaweed from {advisor}’s antennae!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Yeah! Same tribe, same squad—forever! Honestly, finding out my best friend is secretly a legendary Dragon just makes our team ten times cooler!',
      },
      {
        speaker: MILOTIC_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'Hold tight to that bond. Generations ago, Royal Tactician Gengar betrayed the Dragon Court and tore open the southeastern Abyss, whose miasma drives wild Pokémon Feral.',
      },
      {
        speaker: SERPERIOR_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Now Emperor Kingambit’s Ironscale Empire marches into our Verdant Commonwealth claiming "martial law" is the only cure. Captain Aron has already blockaded the northern road at Verdant Bluff!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Crying',
        text: 'A cursed Abyss AND an invading Steel-type Empire?! My antennae want to retire—except if I don’t come along, {partner} will forget enemy attack ranges exist in three minutes flat!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'The Dragon Kingdom may be my past, Chancellor—but this tribe and these friends are my home. Point us north to Verdant Bluff; we’ll break Captain Aron’s blockade together!',
      },
    ],
  }),
};
