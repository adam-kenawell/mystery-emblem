import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { ARON_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter01IntroScript(save: SaveData | null): DialogueScript {
  const flyId = save?.campaign.quizSeeds.slot1Flying?.[0] ?? 'pidgey';
  return {
    id: 'demo_d2_intro',
    title: 'Verdant Bluff',
    bgm: 'drenched_bluff',
    lines: [
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Determined',
        text: '{lord}! From above the cliffs I spotted Captain Aron—he’s anchored in heavy Ironscale plate and won’t budge an inch.',
      },
      {
        speaker: findRecruitSpeaker(save, 'sewaddle'),
        side: 'right',
        emotion: 'Determined',
        text: 'Our forest scouts are with you too! Topple Captain Aron on his post and his whole garrison will scatter!',
      },
      {
        speaker: ARON_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'By Imperial decree, this coast stands under Ironscale martial law! None pass Verdant Bluff!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Happy',
        text: 'Wait—he won’t budge an inch?! Zero movement! That means if we stay outside his reach until we’re ready, he literally cannot chase us! Best boss ever!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'The Commonwealth isn’t yours to cage. Watch their attack ranges and bring Captain Aron down!',
      },
    ],
  };
}

export function buildChapter01OutroScript(): DialogueScript {
  return {
    id: 'demo_d2_outro',
    title: 'Verdant Bluff',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Happy',
        text: 'Captain Aron’s blockade broke! Anyone who reaches Level 10 can promote with an Evolution Stone too!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Normal',
        text: 'Dusk is settling fast over the bluff, {lord}—let’s pitch camp on the overlook before climbing Cleft Mountain!',
      },
    ],
  };
}
