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
        text: '{lord}! {partner}! {healer}! I sprinted all the way from our coastal village when I heard Sir Empoleon took you to the capital—don’t leave me out!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'left',
        emotion: 'Happy',
        text: 'Our whole village crew is finally back together! And right on time—Feral packs and Raider Morgrem are stripping the Berry Orchards bare!',
      },
      {
        speaker: MORGREM_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Heh! Every Oran and Sitrus crate in these groves belongs to Ironscale’s northern march—and one Thunder Wave will leave you kids twitching in the grass!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Watch for Raider Morgrem’s Paralysis hexes—pack a Full Heal or let our new Electric spark shock those Canopy Harriers out of the trees!',
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
        text: 'Take a hike, Morgrem! The Commonwealth’s winter berry harvest is safe!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'Uh, guys? A breathless messenger just pointed toward Oran Forest—Master Kecleon’s supply caravan got ambushed too, AND weird ghost-lights are flickering up on Northern Mountain Pass!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Let’s tend the orchard lanterns tonight—we can rescue Kecleon’s caravan in Oran Forest and climb Northern Mountain Pass toward the Border Fortress!',
      },
    ],
  };
}
