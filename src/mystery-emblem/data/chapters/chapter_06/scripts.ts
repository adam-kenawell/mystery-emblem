import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { LAIRON_SPEAKER, SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export function buildChapter06IntroScript(): DialogueScript {
  return {
    id: 'ch_06_intro',
    title: 'Border Fortress',
    bgm: 'boss_battle',
    lines: [
      {
        speaker: LAIRON_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Lower the Commonwealth banners! The Goldensand Diarchy has already fractured—and Ironscale’s northern legions claim this Border Fortress!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'Commander Lairon—backed by Deino’s captains Linoone and Morgrem! If this keep falls, the entire Verdant Heartland lies open from the north!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'HOLD THE LINE FOR 8 TURNS until the Royal Guard relief column arrives—OR smash straight through and defeat Commander Lairon early! Your call, tactician!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Everyone we’ve met from Western Beach to Northern Pass is counting on us! Take defensive positions around the Wonder Tile and hold Border Fortress!',
      },
    ],
  };
}

export function buildChapter06OutroScript(): DialogueScript {
  return {
    id: 'ch_06_outro',
    title: 'Victory!',
    bgm: 'victory_fanfare',
    lines: [
      {
        speaker: LAIRON_SPEAKER,
        side: 'right',
        emotion: 'Pain',
        text: 'Impossible... Sir Empoleon’s brats broke our siege?! Sound the horn—fall back across the Goldensand dunes!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'WE HELD THE FORTRESS! Look, {lord}—King Serperior and Lady Milotic’s banners are cresting the courtyard!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'The Verdant Heartland is safe—now let’s hear what happened across the Goldensand border!',
      },
    ],
  };
}
