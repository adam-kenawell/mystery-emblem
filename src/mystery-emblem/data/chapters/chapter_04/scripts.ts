import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { DEINO_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

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
        emotion: 'Determined',
        text: '{lord}! Commander Deino’s vanguard—and his lieutenants Linoone and Morgrem—have fortified Berry Orchards ahead!',
      },
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Another lost Dragon playing hero? Soft ideals let the Abyss fester—only Ironscale steel can subjugate a broken world!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Crying',
        text: 'Uhh, {lord}?! Unlike Aron, Commander Deino’s legs definitely work—he’s going to charge the second anyone steps into his range! I’ll be behind THREE bushes!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Ruling through fear isn’t order, Deino! Stand together, everyone—defeat Commander Deino and free Berry Orchards!',
      },
    ],
  };
}

export function buildChapter04OutroScript(): DialogueScript {
  return {
    id: 'demo_d5_outro',
    title: 'Victory!',
    bgm: 'victory_fanfare',
    lines: [
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Pain',
        text: 'Tch... Fall back, Linoone, Morgrem! Remember this, {lord}—Emperor Kingambit’s legions and the Abyss beyond will test that soft heart of yours.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Yeah, keep running, Deino! Berry Orchards belongs to the Verdant Commonwealth!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Happy',
        text: 'Everyone made it through safe—and look ahead, Chancellor Serperior and High Seeress Milotic are lighting the orchard lanterns!',
      },
    ],
  };
}
