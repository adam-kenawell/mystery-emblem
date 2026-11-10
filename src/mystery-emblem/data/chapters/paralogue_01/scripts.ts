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
        text: 'Ferals are charging, and that Slakoth is... napping? Right there?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Keep them away from Slakoth. I’ll go wake him up.',
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
        text: 'Hey, wake up! There are Ferals right across the grass!',
      },
      {
        speaker: findRecruitSpeaker(save, 'slakoth'),
        side: 'right',
        emotion: 'Happy',
        text: '*Yawn*... Oh, hey. You smell like Oran Berries. Mind if I tag along?',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Happy',
        text: 'He slept through a raid. Honestly? I respect that.',
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
        text: 'Whew. That’s a whole week of exercise. Wake me for the next one, {lord}.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Happy',
        text: 'Ha! Welcome aboard. Stick with us and you’ll toughen up in no time.',
      },
    ],
  };
}
