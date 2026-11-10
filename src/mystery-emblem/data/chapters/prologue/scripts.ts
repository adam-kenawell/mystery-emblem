import type { SaveData } from '../../../types/schemas';
import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export function buildPrologueIntroScript(): DialogueScript {
  return {
    id: 'demo_d1_intro',
    title: 'Western Beach',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Today you face me, {lord}. Hold nothing back.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Normal',
        text: '{partner}, {healer}, watch closely for now. You’ll get your chance.',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Worried',
        text: 'I’ll be behind this rock. Taking very careful notes.',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Determined',
        text: 'And don’t go easy on us just ’cause you’re my dad!',
      },
    ],
  };
}

export function buildPrologueAmbushScript(_save: SaveData | null): DialogueScript {
  return {
    id: 'prologue_ambush_dialogue',
    title: 'Western Beach',
    bgm: 'outlaw',
    lines: [
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Teary-Eyed',
        text: 'Um, everyone? There are Ferals on the beach. And an Ironscale soldier. With real blades.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'The lesson is over. I fight beside you now, {lord}.',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Stay together, everyone. Nobody touches our home.',
      },
    ],
  };
}

export function buildPrologueOutroScript(): DialogueScript {
  return {
    id: 'demo_d1_outro',
    title: 'Western Beach',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Joyous',
        text: 'Ha! And stay off our beach!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Worried',
        text: 'Ironscale soldiers, this close to the village... Sir Empoleon, what’s going on?',
      },
    ],
  };
}
