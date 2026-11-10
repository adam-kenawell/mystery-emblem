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
        text: 'Lower the Commonwealth banners! Goldensand has fractured—and Ironscale claims this fortress!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'Commander Lairon, with Deino’s captains Linoone and Morgrem! If this keep falls, the Heartland lies open!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'HOLD 8 TURNS until the Royal Guard arrives—OR defeat Commander Lairon early! Your call, tactician!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Everyone from Western Beach on is counting on us! Guard the Wonder Tile and hold the fortress!',
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
        text: 'Impossible... Empoleon’s brats broke our siege?! Fall back across the dunes!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'WE HELD THE FORTRESS! Look, {lord}—the King and Lady Milotic’s banners!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'The Heartland is safe. Now let’s hear what happened in Goldensand!',
      },
    ],
  };
}
