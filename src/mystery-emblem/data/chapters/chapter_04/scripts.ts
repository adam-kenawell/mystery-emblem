import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { MORGREM_SPEAKER, SIR_EMPOLEON_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter04IntroScript(save: SaveData | null): DialogueScript {
  const elecId = save?.campaign.quizSeeds.slot3Electric?.[0] ?? 'elekid';
  return {
    id: 'demo_d5_intro',
    title: 'Berry Orchards',
    bgm: 'apple_woods',
    lines: [
      {
        speaker: findRecruitSpeaker(save, elecId),
        side: 'right',
        emotion: 'Joyous',
        text: '{lord}! {partner}! {healer}! I ran all the way from the village. Don’t leave me out!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'The whole village crew, back together! Just in time, too. Morgrem’s gang is stripping the orchards.',
      },
      {
        speaker: MORGREM_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Heh. These berries belong to Ironscale now. One Thunder Wave and you’ll be twitching in the grass.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Mind Morgrem’s lightning, everyone. And welcome back. Your sparks are just what we need.',
      },
    ],
  };
}

export function buildChapter04OutroScript(): DialogueScript {
  return {
    id: 'demo_d5_outro',
    title: 'Berry Orchards',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Take a hike, Morgrem! The harvest is safe.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'And the farmers can finally pick their own berries again.',
      },
    ],
  };
}
