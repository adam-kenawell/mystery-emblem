import type { DialogueScript } from '../../../ui/DialogueOverlay';

export function buildPrologueIntroScript(): DialogueScript {
  return {
    id: 'demo_d1_intro',
    title: 'Western Beach',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Angry',
        text: 'Hey! Drop our tribe’s Evolution Stone right now! Nobody raids Western Beach and walks away!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Worried',
        text: 'Careful, {partner}! Those Feral outriders are maddened by purple miasma—and an armored Ironscale scout is directing them from the rear!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'right',
        emotion: 'Teary-Eyed',
        text: 'EEP! Claws! Sharp Metal-type claws! Look, I am a strictly non-combatant bug—I’ll coach you from behind this big safe rock where nobody can poke me!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Three hostiles across the sand—and something warm is pulsing inside my chest... Stay close, {partner}, {healer}; let’s rout them and reclaim our Stone!',
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
        text: 'WHOA! {lord}, did you just see yourself?! Right when that last raider went down, golden light flared right off your scales!',
      },
      {
        speaker: { kind: 'healer' },
        side: 'right',
        emotion: 'Surprised',
        text: 'We recovered our tribe’s Evolution Stone too—and look how warm {lord}’s light feels! Chancellor Serperior and High Seeress Milotic must know what this is!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'All these years growing up together on this coast, I’ve never felt power like that... Come on, everyone—let’s report to the Emerald Sanctuary!',
      },
    ],
  };
}
