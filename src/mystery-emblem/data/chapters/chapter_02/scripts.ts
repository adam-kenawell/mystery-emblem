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
        text: 'Tremble, intruders! Not even that stray mystic will escape our snare!',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Worried',
        text: 'S-stay back! The tremors scrambled every aura up here—come close and I’ll blast you!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'DON’T HIT THAT ONE! See the speech bubble? Move {lord} beside them and Talk! And block those Stairs!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Talk to them, {lord}. Park sturdy allies on the Stairs to stop reinforcements.',
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
        text: 'Easy—we’re not raiders! King Serperior sent us to investigate the tremors.',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'That sunlit resonance... the old Dragon Kingdom’s ward! Forgive me, {lord}!',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Determined',
        text: 'Gothita’s scouts are tampering with the watchtower. Let me blast them from Range 2!',
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
        text: 'These tremors aren’t natural, {lord}. Look toward Sparkling River Shrine below.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Smoke on the shrine bridges... Let’s see who’s marching on the river!',
      },
    ],
  };
}
