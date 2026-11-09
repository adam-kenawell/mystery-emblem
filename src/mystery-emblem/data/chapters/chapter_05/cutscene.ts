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
  props: [
    { id: 'pass_lantern_c', kind: 'lantern', x: 7, y: 3 },
    { id: 'pass_lantern_l', kind: 'lantern', x: 4, y: 5 },
    { id: 'pass_lantern_r', kind: 'lantern', x: 11, y: 5 },
  ],
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
          text: 'Look past the chasm mist toward the frontier, Sir Empoleon, young {lord}... Every beacon tower along the Border Fortress is burning red.',
        },
        {
          speaker: SIR_EMPOLEON_SPEAKER,
          side: 'left',
          emotion: 'Surprised',
          text: 'Those are siege fires—and beyond the gatehouse, desert riders are fleeing out of the Goldensand Diarchy in total disarray!',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'The Goldensand Diarchy?! Wait—if our desert neighbors are in chaos AND Ironscale siege armor is hammering Border Fortress at the same time...',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Teary-Eyed',
          text: 'Commander Lairon’s heavy legion is trying to smash the frontier gate before King Serperior’s garrison can reinforce it! That fortress has TWO stairwells AND twin courtyards!',
        },
        {
          speaker: duskullSpeaker,
          side: 'left',
          emotion: 'Determined',
          text: 'You respected the mountain spirits tonight, {lord}. Follow my lantern down the shortcut ridge—I will guide your company straight to the Border Fortress ramparts before dawn.',
        },
        {
          speaker: { kind: 'lord' },
          side: 'right',
          emotion: 'Determined',
          text: 'Thank you, {speaker}. Hold fast, everyone—if Border Fortress falls, the whole Verdant Heartland lies open. We make our stand at the gate!',
        },
      ],
    };
  },
};
