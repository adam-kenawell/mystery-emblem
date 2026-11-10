import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { KECLEON_SPEAKER, SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export function buildParalogue02IntroScript(): DialogueScript {
  return {
    id: 'para_02_intro',
    title: 'Oran Forest',
    bgm: 'outlaw',
    lines: [
      {
        speaker: KECLEON_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'Help, travelers! Imperial thugs flipped my wagon, and they’re stealing all my stock!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Hold on, Master Kecleon! {lord}, stay close to him. Don’t let them reach him.',
      },
    ],
  };
}

export function buildParalogue02OutroScript(): DialogueScript {
  return {
    id: 'para_02_outro',
    title: 'Oran Forest',
    bgm: 'kecleon_shop',
    lines: [
      {
        speaker: KECLEON_SPEAKER,
        side: 'right',
        emotion: 'Joyous',
        text: 'You saved my shop! Take this stone as thanks, and look for my stalls along the roads.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Joyous',
        text: 'Kecleon’s back in business! Potions, gear, all of it. Best rescue ever.',
      },
    ],
  };
}
