/**
 * Post-Chapter 1 Story Cutscene: `cs_03_bluff_campfire` (`chapter_01/cutscene.ts`)
 */

import type { StoryCutsceneDefinition } from '../../../scenes/CutsceneScene';
import { STAGE_03_BLUFF_CAMP } from '../cutsceneStages';

export const CS_03_BLUFF_CAMPFIRE: StoryCutsceneDefinition = {
  id: 'cs_03_bluff_campfire',
  chapterOrder: 3,
  title: 'Sparks Over the Bluff',
  locationLabel: 'Bluff Overlook Camp · Evening',
  lightingMood: 'campfire_dusk',
  width: 16,
  height: 11,
  tiles: STAGE_03_BLUFF_CAMP,
  props: [
    { id: 'bluff_fire', kind: 'campfire', x: 7, y: 5 },
    { id: 'camp_berries_1', kind: 'berry_basket', x: 6, y: 4 },
    { id: 'camp_berries_2', kind: 'berry_basket', x: 10, y: 6 },
  ],
  initialCamera: { x: 7.5, y: 5.5 },
  actors: [
    { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 5, direction: 'Left' },
    { actorId: 'partner', role: { kind: 'partner' }, x: 7, y: 6, direction: 'Up' },
    { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 5, direction: 'Right' },
    { actorId: 'advisor', role: { kind: 'advisor' }, x: 7, y: 4, direction: 'Down' },
    { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 10, y: 4, direction: 'DownLeft' },
    { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 11, y: 5, direction: 'Left' },
  ],
  openingDurationMs: 650,
  openingActions: [
    { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1000 },
    { type: 'emote', actorId: 'recruit_0', emote: 'joy', durationMs: 1000, delayMs: 250 },
  ],
  lineCues: {
    0: [
      { type: 'walk', actorId: 'partner', path: [{ x: 8, y: 6 }], speedTilesPerSec: 3.8, endDirection: 'UpLeft' },
      { type: 'hop', actorId: 'partner', count: 2, delayMs: 260 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
    ],
    1: [
      { type: 'hop', actorId: 'advisor', count: 1 },
      { type: 'emote', actorId: 'advisor', emote: 'music', durationMs: 1150 },
    ],
    2: [
      {
        type: 'walk',
        actorId: 'healer',
        path: [{ x: 6, y: 6 }, { x: 7, y: 6 }],
        speedTilesPerSec: 2.8,
        endDirection: 'Right',
      },
      { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
    ],
    3: [
      { type: 'emote', actorId: 'partner', emote: 'sweat', durationMs: 1050 },
      { type: 'hop', actorId: 'recruit_1', count: 1, delayMs: 220 },
    ],
    4: [
      { type: 'walk', actorId: 'lord', path: [{ x: 12, y: 5 }], speedTilesPerSec: 3.0, endDirection: 'Right' },
      { type: 'camera', x: 9.2, y: 5.5, durationMs: 560 },
      { type: 'face', actorId: 'partner', direction: 'Right' },
      { type: 'face', actorId: 'healer', direction: 'Right' },
    ],
    5: [
      {
        type: 'walk',
        actorId: 'advisor',
        path: [{ x: 9, y: 4 }, { x: 10, y: 5 }],
        speedTilesPerSec: 4.0,
        endDirection: 'Right',
      },
      { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1050 },
    ],
    6: [
      { type: 'face', actorId: 'lord', direction: 'Left' },
      { type: 'walk', actorId: 'partner', path: [{ x: 10, y: 6 }], speedTilesPerSec: 3.6, endDirection: 'UpRight' },
      { type: 'hop', actorId: 'partner', count: 1, delayMs: 360 },
    ],
  },
  buildScript: () => ({
    id: 'cs_03_bluff_campfire',
    title: 'Campfire on Verdant Bluff',
    bgm: 'at_the_end_of_the_day',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: '"NONE PASS VERDANT BLUFF!"—haha! Did you see Captain Aron’s face when he realized standing glued to one post meant we could line up around him for free?!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Inspired',
        text: 'Honestly? Zero movement on fortified terrain is my dream lifestyle! If Captain Aron wasn’t working for an invading Empire, he and I could start a Stationary Appreciation Club!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Hold still a second, {partner}—you scuffed your flipper showing off again. Here, warm Oran cider for everyone, and extra shares for our newest teammates by the baskets!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Happy',
        text: 'Hey, battle scuffs look heroic! Though... okay, yeah, that cider smells amazing. Thanks, {healer}. What are you scouting over by the ridge, {lord}?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Worried',
        text: 'Cleft Mountain to the east. See that faint violet haze curling around the old Dragon watchtower? That peak is riddled with subterranean shafts and old stairwells.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'AHA! {lord} spotted it! Subterranean shafts mean Dungeon Stairs—enemy reserves can climb straight up behind us unless a sturdy unit stands right on the Stairs tile to cork it!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'And no, {advisor}, nobody is using your shell as a stair-plug. Get some sleep around the fire, everyone—at dawn we climb Cleft Mountain.',
      },
    ],
  }),
};
