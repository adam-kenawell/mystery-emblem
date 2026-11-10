import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { GOTHITA_SPEAKER, SIR_EMPOLEON_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter02IntroScript(save: SaveData | null): DialogueScript {
  const psyId = save?.campaign.quizSeeds.slot2Psychic?.[0] ?? 'ralts';
  return {
    id: 'demo_d3_intro',
    title: 'Cleft Mountain',
    bgm: 'mt_bristle',
    lines: [
      {
        speaker: GOTHITA_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Turn back, intruders. And that stray psychic is ours.',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Worried',
        text: 'S-stay back! The tremors scrambled every aura up here. Come closer and I’ll attack!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Wait, don’t hurt that one. They’re just scared. Maybe {lord} could talk to them?',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Go gently, {lord}. And watch those stairs. More of Gothita’s scouts may come up.',
      },
    ],
  };
}

export function buildChapter02TalkPsychicScript(save: SaveData | null): DialogueScript {
  const psyId = save?.campaign.quizSeeds.slot2Psychic?.[0] ?? 'ralts';
  return {
    id: 'ch2_talk_psychic_dialogue',
    title: 'Cleft Mountain',
    bgm: 'heartwarming',
    lines: [
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Normal',
        text: 'Easy. We’re not raiders. King Serperior sent us to find out what’s causing the tremors.',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'That warmth... it feels like the old Dragon Kingdom’s ward. I’m sorry, {lord}.',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Determined',
        text: 'Gothita’s scouts are tampering with the watchtower. Let me help you stop them.',
      },
    ],
  };
}

export function buildChapter02OutroScript(_save: SaveData | null): DialogueScript {
  return {
    id: 'demo_d3_outro',
    title: 'Cleft Mountain',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'These tremors aren’t natural, {lord}. Something is stirring under this mountain.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Then let’s look around while we’re up here. That old tower first.',
      },
    ],
  };
}
