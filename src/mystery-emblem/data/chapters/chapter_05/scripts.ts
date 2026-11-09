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
        text: 'Begone from these spirit lanterns, shadow-thieves! I have floated over these chasms all night searing Ferals with Will-O-Wisp, and you shan’t defile a single grave!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Lower your lantern, caretaker—we serve King Serperior, and we honor the travelers resting along this pass.',
      },
      {
        speaker: findRecruitSpeaker(save, 'duskull'),
        side: 'right',
        emotion: 'Surprised',
        text: 'Sir Empoleon’s crest—and an heir of the old Dragon Kingdom! Royal Tactician Gengar’s shadow scouts are ransacking this shrine, and word from the north says the Goldensand Diarchy has plunged into chaos!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Inspired',
        text: 'WHOA—Duskull has Levitate, meaning he floats straight over Void chasms! AND his Will-O-Wisp inflicts Burn (BRN), halving Physical attackers’ Atk! Step on the Wonder Tile or use Full Heal if they hex us back!',
      },
      {
        speaker: SPIRITOMB_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Kukuku... Lord Gengar claims every ancient ward along this ridge! Sink into the chasm, little sparks!',
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
        text: 'The roadside spirit lanterns burn clear once more... Thank you, {lord}. Follow my lantern north—Border Fortress sits right on the Goldensand frontier.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'If Gengar’s scouts are already moving along the pass, Border Fortress is in danger. Lead the way, Duskull!',
      },
    ],
  };
}
