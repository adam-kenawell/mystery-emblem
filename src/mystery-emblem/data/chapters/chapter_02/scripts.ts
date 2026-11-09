import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter02IntroScript(save: SaveData | null): DialogueScript {
  const psyId = save?.campaign.quizSeeds.slot2Psychic?.[0] ?? 'ralts';
  return {
    id: 'demo_d3_intro',
    title: 'Cleft Mountain',
    bgm: 'mt_bristle',
    lines: [
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Worried',
        text: 'Careful, {lord}! Your Dragon Aura woke the runes of this ancient watchtower—and Ironscale reserves are climbing the Dungeon Stairs!',
      },
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Determined',
        text: 'Stand directly on a Stairs tile to seal enemy reinforcements below! Let me lend my mystic sight to your squad.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'PLUG THE STAIRS! Put somebody big and sturdy right on top of them—and NO, before anyone looks at me, my shell does NOT count as a cork!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'A watchtower of the old Dragon Kingdom... Secure those Stairs and clear Cleft Mountain!',
      },
    ],
  };
}

export function buildChapter02OutroScript(save: SaveData | null): DialogueScript {
  const psyId = save?.campaign.quizSeeds.slot2Psychic?.[0] ?? 'ralts';
  return {
    id: 'demo_d3_outro',
    title: 'Cleft Mountain',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: findRecruitSpeaker(save, psyId),
        side: 'right',
        emotion: 'Surprised',
        text: 'The miasma over the stairwell is lifting! Look just ahead, {lord}—the ancient Dragon watchtower parapet is shining through the mist!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Normal',
        text: 'Let’s head out onto the parapet and see what the old watchtower guards.',
      },
    ],
  };
}
