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
        text: 'Help, travelers! Imperial enforcers flipped my wagon to steal my Potions, TMs, and Evolution Stone!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Hold your ground, Master Kecleon! Surround him, {lord}—Kecleon must not fall!',
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
        text: 'Saved! Take this Evolution Stone, {lord}, and look for my shops on cleared roads!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Joyous',
        text: 'KECLEON SHOPS UNLOCKED! Healing, Held Items, Vitamins, AND TMs—plus a second Stone!',
      },
    ],
  };
}
