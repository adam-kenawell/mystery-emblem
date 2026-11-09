import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { DEINO_SPEAKER, SIR_EMPOLEON_SPEAKER } from '../scriptHelpers';

export function buildChapter03IntroScript(): DialogueScript {
  return {
    id: 'demo_d4_intro',
    title: 'Sparkling River Shrine',
    bgm: 'waterfall_cave',
    lines: [
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Determined',
        text: 'Secure the shrine’s Dragon Relic! Wait... that crest—another survivor of the fallen Dragon Kingdom, sheltered under Serperior’s soft banner?',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Surprised',
        text: 'You carry Dragon Aura too?! Why are you leading Ironscale soldiers against the Verdant Commonwealth?!',
      },
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Angry',
        text: 'Because Emperor Kingambit took me from the ashes when the old kingdom fell! Soft mercy won’t seal the southeastern Abyss—only Ironscale discipline can hold this world together!',
      },
      {
        speaker: SIR_EMPOLEON_SPEAKER,
        side: 'left',
        emotion: 'Determined',
        text: 'Careful, {lord}! Commander Deino won’t sit idle—the moment anyone steps inside his threat range, he will charge! Use the Wonder Tile and river channels wisely!',
      },
    ],
  };
}

export function buildChapter03OutroScript(): DialogueScript {
  return {
    id: 'demo_d4_outro',
    title: 'Sparkling River Shrine',
    bgm: 'calm_cutscene',
    lines: [
      {
        speaker: DEINO_SPEAKER,
        side: 'right',
        emotion: 'Pain',
        text: 'Tch... Your fangs aren’t dull, {lord}. Pull back, vanguard! Keep that Evolution Stone—when the Abyss splits wider, you’ll see why Kingambit’s order is necessary!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Surprised',
        text: 'WHOA—he dropped a real Evolution Stone! Once any Stage-1 ally hits Level 10, that Stone promotes them straight to Stage 2!',
      },
      {
        speaker: { kind: 'partner' },
        side: 'right',
        emotion: 'Worried',
        text: 'Another Dragon orphan raised inside Ironscale... Come on, {lord}—King Serperior and Lady Milotic just arrived on the north shrine bridge!',
      },
    ],
  };
}
