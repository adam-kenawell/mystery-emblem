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
        text: 'Tremble before the Deep Crag’s tremors! Even that stray mountain mystic ahead won’t escape our watchtower snare!',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Worried',
        text: 'S-stay back! The Abyssal tremors scrambled every aura on this peak—anyone who steps too close gets blasted!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'WAIT—DON’T WHACK THAT ONE! See the speech bubble icon?! Move {lord} right next to them and tap Talk to recruit them—and plug those Dungeon Stairs before reserves climb up!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Steady your Dragon Aura and speak to them yourself, {lord}. Meanwhile, place sturdy allies atop the Stairs tiles to seal enemy reinforcements.',
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
        text: 'Easy—we’re not with those raiders! King Serperior and Lady Milotic sent us to investigate the Abyssal tremors.',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'Wait... that clear, sunlit resonance around you—it’s the old Dragon Kingdom’s ward! Forgive me for panicking in the miasma, {lord}!',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Determined',
        text: 'Hexer Gothita’s scouts are tampering with the watchtower stones ahead. Let me join your squad and blast them from Range 2!',
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
        text: 'These tremors aren’t natural rockslides, {lord}—look out from the watchtower parapet toward Sparkling River Shrine below.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Smoke on the shrine bridges... Let’s look from the parapet and see who is marching on the river!',
      },
    ],
  };
}
