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
        text: 'Eyes sharp, {lord}, {partner}, {healer}. Show me your footwork here on the sand.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Normal',
        text: 'I have Range-1 Peck equipped. Hit me up close with {lord}, snipe from 2 tiles with {partner}, and heal with {healer}!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'I’ll call out the rules from behind this giant rock, where zero beaks can poke me!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Determined',
        text: 'Don’t go easy just ’cause you’re my dad! Ready when you are, {lord}!',
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
        text: 'EEP!! TIME OUT! Ferals and an Ironscale Pawniard just landed to the east—WITH REAL BLADES!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'Drill’s over—live formation! My steel wing is yours to command, {lord}!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Right behind you! Use the brush for cover and drive them off our beach!',
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
        emotion: 'Surprised',
        text: 'Whoa—{lord}, when that last scout fell, golden Dragon light flared off your scales!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Inspired',
        text: 'The Dragon crest you washed ashore with is awakening... Gengar’s shadows stir again.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Determined',
        text: 'If Ironscale reached our village, the Capital Road isn’t safe. Pack up—we march!',
      },
    ],
  };
}
