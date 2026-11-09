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
        text: 'Eyes sharp, {lord}, {partner}, {healer}. Before we march for King Serperior’s court, show me your combat footwork right here on the sand.',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Normal',
        text: 'I am holding my stance with Range-1 Peck equipped. Strike me up close with {lord}, snipe uncountered from 2 tiles away with {partner}, and patch any scrapes with {healer}’s Heal Pulse!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Shouting',
        text: 'I memorized every single word of Sir Empoleon’s drills from the bushes! I’ll call out the rules from safely behind this giant rock where zero beaks can poke me!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'left',
        emotion: 'Determined',
        text: 'Don’t hold back just ‘cause you’re my dad, Sir Empoleon! Ready when you are, {lord}!',
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
        text: 'EEP!! TIME OUT! Purple-miasma Ferals and an armored Ironscale Pawniard just splashed ashore on the eastern surf—WITH REAL BLADES!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Angry',
        text: 'Imperial scouts already probing our village coast... Drill’s over, kids—fall into live formation! My steel wing is yours to command, {lord}!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Right behind you, Sir Empoleon! Let’s use the brush for cover, let Sir Empoleon soften them up if we need to, and drive them off our beach!',
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
        text: 'Whoa—{lord}, right when that last scout went down, warm golden Dragon light flared straight off your scales!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'right',
        emotion: 'Inspired',
        text: 'So the Ancient Dragon crest you washed ashore with truly is awakening... King Serperior and Lady Milotic were right—Royal Tactician Gengar’s shadows are stirring again.',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Determined',
        text: 'If Ironscale scouts have reached our village, the Capital Road won’t be safe either. Pack your satchels, everyone—we march with Sir Empoleon!',
      },
    ],
  };
}
