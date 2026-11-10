/**
 * Post-Chapter 5 Story Cutscene: `cs_07_lantern_pass` (`chapter_05/cutscene.ts`)
 *
 * With ShadowBinder Spiritomb banished from the roadside shrine, stubborn pass caretaker Duskull
 * leads Sir Empoleon and `{lord}` to the northern ridge overlooking Border Fortress, where news
 * breaks that the neighboring Goldensand Diarchy has plunged into chaos.
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_04_WATCHTOWER_PARAPET } from '../cutsceneStages';
import { SIR_EMPOLEON_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export const CS_07_LANTERN_PASS: StoryCutsceneDefinition = {
  id: 'cs_07_lantern_pass',
  chapterOrder: 7,
  title: 'Lanterns Over the Chasm',
  locationLabel: 'Northern Mountain Pass · Spirit Overlook',
  lightingMood: 'mountain_mist',
  width: 16,
  height: 11,
  tiles: STAGE_04_WATCHTOWER_PARAPET,
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    {
      actorId: 'duskull',
      role: { kind: 'npc', pmdAssetId: '0355', name: 'Duskull' },
      x: 7,
      y: 7,
      direction: 'Down',
    },
    { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 6, direction: 'Down' },
    { actorId: 'mentor', role: { kind: 'mentor' }, x: 6, y: 6, direction: 'Down' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 5, direction: 'DownLeft' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 5, y: 5, direction: 'DownRight' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 8, y: 4, direction: 'Down' },
  ],
  openingDurationMs: 700,
  openingActions: [
    { type: 'walk', actorId: 'duskull', path: [{ x: 7, y: 8 }], speedTilesPerSec: 2.5, endDirection: 'Down' },
    { type: 'walk', actorId: 'lord', path: [{ x: 8, y: 8 }], speedTilesPerSec: 2.8, endDirection: 'Down' },
    { type: 'camera', x: 7.5, y: 6.4, durationMs: 500 },
  ],
  lineCues: {
    0: [{ type: 'emote', actorId: 'duskull', emote: 'exclamation', durationMs: 1000 }],
    1: [
      { type: 'walk', actorId: 'mentor', path: [{ x: 6, y: 8 }], speedTilesPerSec: 3.0, endDirection: 'Down' },
      { type: 'emote', actorId: 'mentor', emote: 'exclamation', durationMs: 950 },
    ],
    2: [
      { type: 'walk', actorId: 'partner', path: [{ x: 9, y: 7 }], speedTilesPerSec: 3.6, endDirection: 'Down' },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 250 },
    ],
    3: [
      { type: 'shake', actorId: 'advisor', durationMs: 540 },
      { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
    ],
    4: [
      { type: 'face', actorId: 'duskull', direction: 'Right' },
      { type: 'face', actorId: 'lord', direction: 'Left' },
    ],
    5: [
      { type: 'auraPulse', actorId: 'lord', durationMs: 1200 },
      { type: 'pose', actorId: 'mentor', action: 'Attack', durationMs: 480 },
    ],
  },
  buildScript: (save) => {
    const duskullSpeaker = findRecruitSpeaker(save, 'duskull');
    return {
      id: 'cs_07_lantern_pass',
      title: 'Spirit Overlook',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: duskullSpeaker,
          side: 'left',
          emotion: 'Worried',
          text: 'Look past the mist, toward the frontier... Every beacon on Border Fortress is burning red.',
        },
        {
          speaker: SIR_EMPOLEON_SPEAKER,
          side: 'left',
          emotion: 'Surprised',
          text: 'Siege fires. And past the gate, riders fleeing Goldensand. Something terrible has happened there.',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'Goldensand in chaos, and Ironscale hitting the fortress? At the same time?',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Teary-Eyed',
          text: 'That’s Commander Lairon’s army. He’ll smash the gate before help can get there.',
        },
        {
          speaker: duskullSpeaker,
          side: 'left',
          emotion: 'Determined',
          text: 'You honored the spirits, {lord}. Follow my lantern. I’ll have you on the ramparts by dawn.',
        },
        {
          speaker: { kind: 'lord' },
          side: 'right',
          emotion: 'Determined',
          text: 'Thank you. If the fortress falls, the whole Heartland is open. We hold the gate.',
        },
      ],
    };
  },
};
