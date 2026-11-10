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
        text: 'Halt! By Ironscale order, the Capital Road is sealed!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'See Captain Aron’s stance, {lord}? He won’t leave that roadblock.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Happy',
        text: 'Also—Chapter Prep! Deploy, trade items, and scout the map before Fight! Best invention ever!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Watch their ranges, clear the scouts, and break the blockade!',
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
        text: 'GYAAAH! Stop pecking my hood! I’m ninety percent fiber—DON’T EAT ME!',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'Hold still, breakfast—WHOA! Why are we in the middle of a battle?!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'A predator-prey chase just crashed into our formation?! Relatable panic, leaf-bug!',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Worried',
        text: 'Those Ferals are glaring at BOTH of us! Truce, Sewaddle—let’s stick with this squad!',
      },
      {
        speaker: findRecruitSpeaker(save, 'sewaddle'),
        side: 'right',
        emotion: 'Determined',
        text: 'Deal! Keep your beak on the Empire. Lead the way, {lord}!',
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
        text: 'The roadblock crumbled—and our two bush-tumblers fight great together!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Look ahead, everyone—the spires of King Serperior’s Royal Court.',
      },
    ],
  };
}
