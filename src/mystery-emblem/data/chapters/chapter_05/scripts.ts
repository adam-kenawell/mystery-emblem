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
        text: 'Begone, shadow thieves! You’ll not touch these graves while my flame still burns!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Normal',
        text: 'Lower your lantern, caretaker. We serve King Serperior, and we honor those who rest here.',
      },
      {
        speaker: findRecruitSpeaker(save, 'duskull'),
        side: 'right',
        emotion: 'Surprised',
        text: 'Sir Empoleon’s crest... and a Dragon heir! Forgive me. Gengar’s scouts are raiding this shrine.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'So the creepy ghost is on our side. Great. Then who’s laughing down in the chasm?',
      },
      {
        speaker: SPIRITOMB_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Kukuku... Lord Gengar claims every ward on this ridge. Sink into the dark, little sparks.',
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
        text: 'The lanterns burn clean again. Thank you, {lord}. The spirits can rest.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Joyous',
        text: 'Not bad for a bunch of first-time ghost hunters!',
      },
    ],
  };
}
