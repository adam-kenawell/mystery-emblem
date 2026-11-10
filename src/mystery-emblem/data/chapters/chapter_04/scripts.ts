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
        text: '{lord}! {partner}! {healer}! I ran all the way from the village—don’t leave me out!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'The village crew is back together! Just in time—Raider Morgrem’s gang is stripping the orchards bare!',
      },
      {
        speaker: MORGREM_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Heh! These berries belong to Ironscale now—and one Thunder Wave will leave you twitching in the grass!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Beware Morgrem’s Paralysis. Pack a Full Heal, and let our new Electric ally zap those Harriers!',
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
        text: 'Take a hike, Morgrem! The harvest is safe!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Uh, guys? Master Kecleon’s caravan was ambushed in Oran Forest—AND ghost-lights are flickering on Northern Mountain Pass!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'We rest tonight. Then we rescue Kecleon and climb the pass to Border Fortress!',
      },
    ],
  };
}
