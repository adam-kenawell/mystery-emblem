import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { DEINO_SPEAKER, SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export function buildChapter03IntroScript(): DialogueScript {
  return {
    id: 'demo_d4_intro',
    title: 'Sparkling River Shrine',
    bgm: 'waterfall_cave',
    lines: [
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Secure the relic! ...Wait. That crest. Another Dragon survivor, fighting for Serperior?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'You’re a Dragon too. Why are you fighting for Ironscale?',
      },
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Emperor Kingambit pulled me from the ashes. Kindness won’t seal the Abyss. Only order will.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Careful, {lord}. Get too close and he’ll charge. Let the river work for us.',
      },
    ],
  };
}

export function buildChapter03OutroScript(): DialogueScript {
  return {
    id: 'demo_d4_outro',
    title: 'Sparkling River Shrine',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Pain',
        text: 'Tch... Your fangs are sharp, {lord}. Fall back! When the Abyss spreads, you’ll understand.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Worried',
        text: 'He’s gone. Come on, {lord}. The King just reached the north bridge.',
      },
    ],
  };
}
