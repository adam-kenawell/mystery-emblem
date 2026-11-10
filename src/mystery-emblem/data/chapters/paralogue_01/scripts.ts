import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { findRecruitSpeaker } from '../scriptHelpers';

export function buildParalogue01IntroScript(save: SaveData | null): DialogueScript {
  return {
    id: 'para_01_intro',
    title: 'Lush Prairie',
    bgm: 'fun_exploration',
    lines: [
      {
        speaker: findRecruitSpeaker(save, 'slakoth'),
        side: 'right',
        emotion: 'Normal',
        text: 'Zzz... five more minutes... zzz...',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Stunned',
        text: 'ARE YOU KIDDING?! Feral poachers are charging and that Slakoth is NAPPING on a Wonder Tile?!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Shield Slakoth before the Ferals reach him, and wake him up with Talk!',
      },
    ],
  };
}

export function buildParalogue01TalkSlakothScript(save: SaveData | null): DialogueScript {
  return {
    id: 'p1_talk_slakoth_dialogue',
    title: 'Lush Prairie',
    bgm: 'spinda_cafe',
    lines: [
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'Hey—wake up! Ferals are right across the grass!',
      },
      {
        speaker: findRecruitSpeaker(save, 'slakoth'),
        side: 'right',
        emotion: 'Happy',
        text: '*Yaaawn*... Oh, hey. You smell like Oran Berries. Mind if I tag along?',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Inspired',
        text: 'My notes say Level 1 recruits with Hidden Potential get +20% growths! Feed him easy KOs!',
      },
    ],
  };
}

export function buildParalogue01OutroScript(save: SaveData | null): DialogueScript {
  return {
    id: 'para_01_outro',
    title: 'Lush Prairie',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: findRecruitSpeaker(save, 'slakoth'),
        side: 'right',
        emotion: 'Happy',
        text: 'Whew, a whole week of cardio... Wake me for the next battle, {lord}.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Happy',
        text: 'Haha, welcome aboard! Stick with us and you’ll be unstoppable!',
      },
    ],
  };
}
