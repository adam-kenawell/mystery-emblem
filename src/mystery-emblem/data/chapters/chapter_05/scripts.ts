import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { SIR_EMPOLEON_SPEAKER, SPIRITOMB_SPEAKER, findRecruitSpeaker } from '../scriptHelpers';

export function buildChapter05IntroScript(save: SaveData | null): DialogueScript {
  return {
    id: 'ch_05_intro',
    title: 'Northern Mountain Pass',
    bgm: 'foggy_forest',
    lines: [
      {
        speaker: findRecruitSpeaker(save, 'duskull'),
        side: 'right',
        emotion: 'Angry',
        text: 'Begone, shadow-thieves! You shan’t defile these graves while my Will-O-Wisp burns!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Lower your lantern, caretaker. We serve King Serperior and honor those who rest here.',
      },
      {
        speaker: findRecruitSpeaker(save, 'duskull'),
        side: 'right',
        emotion: 'Surprised',
        text: 'Sir Empoleon’s crest—and a Dragon Kingdom heir! Gengar’s scouts are raiding this shrine, and Goldensand has fallen into chaos!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Inspired',
        text: 'Duskull has Levitate—he floats over Void chasms! His Will-O-Wisp Burns (BRN), halving Physical Atk. Cure it with the Wonder Tile or Full Heal!',
      },
      {
        speaker: SPIRITOMB_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Kukuku... Lord Gengar claims every ward on this ridge! Sink into the chasm, little sparks!',
      },
    ],
  };
}

export function buildChapter05OutroScript(save: SaveData | null): DialogueScript {
  return {
    id: 'ch_05_outro',
    title: 'Northern Mountain Pass',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: findRecruitSpeaker(save, 'duskull'),
        side: 'right',
        emotion: 'Normal',
        text: 'The lanterns burn clear again. Thank you, {lord}. Follow me north to Border Fortress.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'If Gengar’s scouts are on the move, the fortress is in danger. Lead the way, Duskull!',
      },
    ],
  };
}
