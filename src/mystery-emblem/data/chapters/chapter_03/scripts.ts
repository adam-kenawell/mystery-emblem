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
        text: 'Secure the Relic! Wait... that crest—another Dragon Kingdom survivor, under Serperior’s banner?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'You have Dragon Aura too?! Why fight for Ironscale?!',
      },
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Emperor Kingambit pulled me from the ashes! Soft mercy won’t seal the Abyss—only Ironscale discipline can!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Careful, {lord}! Step into Deino’s range and he’ll charge. Use the Wonder Tile and river wisely!',
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
        text: 'Tch... Your fangs are sharp, {lord}. Fall back! When the Abyss widens, you’ll understand Kingambit.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'He dropped an Evolution Stone! At Level 10+, it evolves a Stage-1 ally to Stage 2!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Worried',
        text: 'Another Dragon orphan raised by Ironscale... Come on, {lord}—the King just reached the north bridge!',
      },
    ],
  };
}
