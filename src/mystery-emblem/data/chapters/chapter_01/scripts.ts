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
        text: 'Halt! By Ironscale scouting order, this stretch of the Capital Road is sealed! None reach King Serperior’s court today!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Notice Captain Aron’s heavy stance, {lord}—he has anchored himself to guard the roadblock and won’t move from his post.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Happy',
        text: 'Also—check out the new Chapter Prep menu! You can deploy or bench units, trade items, and inspect the map before yelling Fight! Best invention ever!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Clear the scouts carefully, watch their ranges, and break Captain Aron’s blockade so we can reach King Serperior!',
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
        text: 'GYAAAH! Stop pecking my leaf hood! I’m bitter, chewy, and ninety percent fiber—DON’T EAT ME!',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'Hold still, breakfast—WHOA! Uh, why did we just tumble out of the bushes into the middle of an Imperial skirmish?!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'Did a predator-and-prey chase seriously just crash straight into our formation?! Relatable panic, little leaf-bug, VERY relatable!',
      },
      {
        speaker: findRecruitSpeaker(save, flyId),
        side: 'right',
        emotion: 'Worried',
        text: 'Those Ferals and Ironscale scouts are glaring at BOTH of us! Temporary truce, Sewaddle—nobody eats anybody if we stick with Sir Empoleon’s squad!',
      },
      {
        speaker: findRecruitSpeaker(save, 'sewaddle'),
        side: 'right',
        emotion: 'Determined',
        text: 'Deal! Keep your beak pointed at the Empire and I’ll watch your flank—lead the way, {lord}!',
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
        text: 'Captain Aron’s roadblock crumbled—and our two accidental bush-tumblers actually fight great together!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Look just ahead through the canopy, everyone—the emerald spires of King Serperior’s Royal Court await us.',
      },
    ],
  };
}
