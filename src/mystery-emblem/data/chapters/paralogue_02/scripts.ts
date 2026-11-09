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
        text: 'Help, travelers! Imperial enforcers overturned my merchant wagon in Oran Forest to seize my Potions, TMs, and prize Evolution Stone!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Hold your ground by the clearing, Master Kecleon! Form a defensive perimeter around him, {lord}—we cannot let Kecleon fall!',
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
        text: 'Saved—every crate and TM intact! Please accept this rare Evolution Stone as thanks, {lord}—and watch the World Map for my Kecleon Shops on cleared roads!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Joyous',
        text: 'KECLEON SHOPS UNLOCKED! Healing stock, Held Gear, Vitamins, AND TMs—plus a second Evolution Stone! Today is officially a great day for survival!',
      },
    ],
  };
}
