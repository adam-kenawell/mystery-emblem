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
        text: 'Zzz... mmmh... five more minutes, clover patch... zzz...',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Stunned',
        text: 'ARE YOU KIDDING ME?! Feral poachers are charging across Lush Prairie and that Slakoth is SNOOZING on a Wonder Tile?!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'If those Ferals reach him first, he won’t know what hit him! Rush into the meadow, shield Slakoth, and wake him up with Talk!',
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
        text: 'Hey—wake up! Feral raiders are right across the grass!',
      },
      {
        speaker: findRecruitSpeaker(save, 'slakoth'),
        side: 'right',
        emotion: 'Happy',
        text: '*Yaaawn*... Oh, hey. You guys look super strong—and your camp smells like warm Oran Berries. Mind if I stretch my claws with your crew?',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Inspired',
        text: 'WAIT A SECOND! My tactical notes say Level 1 trainees with Hidden Potential gain +20% bonus stat growths on every level-up! Feed him safe finishing blows and he’ll become a juggernaut!',
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
        text: 'Whew, that was a whole week’s worth of cardio... Wake me up whenever the next battle starts, {lord}.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Happy',
        text: 'Haha, welcome aboard! Stick close to us and you’ll be unstoppable before long!',
      },
    ],
  };
}
