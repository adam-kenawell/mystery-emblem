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
        text: 'Lower your banners! Goldensand has fallen, and this fortress belongs to Ironscale now.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'Lairon, with Morgrem and Linoone at his side. If this keep falls, the Heartland falls with it.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'The Royal Guard is on its way. We just have to hold until they get here. Or... beat Lairon first?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Everyone from the beach on is counting on us. We hold this fortress.',
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
        text: 'Impossible... Empoleon’s brats broke our siege? Fall back across the dunes!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'We held it! Look, {lord}. The King’s banners!',
      },
    ],
  };
}
