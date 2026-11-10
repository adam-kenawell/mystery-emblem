import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { ARON_SPEAKER, SIR_EMPOLEON_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter01IntroScript(_save: SaveData | null): DialogueScript {
  return {
    id: 'demo_d2_intro',
    title: 'Capital Road',
    bgm: 'drenched_bluff',
    lines: [
      {
        speaker: ARON_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Halt! By order of the Ironscale Empire, this road is closed.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'This is Commonwealth land, Captain. Stand aside.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'An Ironscale captain, on our road? Can we just... take a different road?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'This is the only road to the King. We’re going through.',
      },
    ],
  };
}

export function buildChapter01BirdBugTruceScript(save: SaveData | null): DialogueScript {
  const flyId = save?.campaign.quizSeeds.slot1Flying?.[0] ?? 'pidgey';
  return {
    id: 'ch1_bird_bug_truce_dialogue',
    title: 'Capital Road',
    bgm: 'team_skull',
    lines: [
      {
        speaker: findRecruitSpeaker(save, 'sewaddle'),
        side: 'right',
        emotion: 'Crying',
        text: 'Stop pecking my hood! I’m mostly leaves, I swear. Don’t eat me!',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'Hold still, breakfa— wait. Why is there a battle here?',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'Oh good, more panicking. I know exactly how you feel.',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Worried',
        text: 'Those Ferals are glaring at both of us now. Truce, Sewaddle?',
      },
      {
        speaker: findRecruitSpeaker(save, 'sewaddle'),
        side: 'right',
        emotion: 'Determined',
        text: 'Truce. Keep your beak to yourself. Lead the way, {lord}!',
      },
    ],
  };
}

export function buildChapter01OutroScript(): DialogueScript {
  return {
    id: 'demo_d2_outro',
    title: 'Capital Road',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'The road’s open! And our two new friends weren’t half bad.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Look ahead, everyone. The spires of King Serperior’s court.',
      },
    ],
  };
}
