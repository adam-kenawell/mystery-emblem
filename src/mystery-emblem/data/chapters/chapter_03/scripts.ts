import type { DialogueScript } from '../../../ui/DialogueOverlay';
import { KECLEON_SPEAKER } from '../scriptHelpers';

export function buildChapter03IntroScript(): DialogueScript {
  return {
    id: 'demo_d4_intro',
    title: 'River Shrine',
    bgm: 'waterfall_cave',
    lines: [
      {
        speaker: KECLEON_SPEAKER,
        side: 'right',
        emotion: 'Worried',
        text: 'Help! An Ironclad Lairon seized River Shrine to confiscate our Potions and Evolution Stones for Commander Deino’s war chest!',
      },
      {
        speaker: { kind: 'lord' },
        side: 'left',
        emotion: 'Determined',
        text: 'Hold fast, Kecleon! Fliers and Water-types can cross the shrine’s river channels—rout them and free the caravan!',
      },
    ],
  };
}

export function buildChapter03OutroScript(): DialogueScript {
  return {
    id: 'demo_d4_outro',
    title: 'River Shrine',
    bgm: 'kecleon_shop',
    lines: [
      {
        speaker: KECLEON_SPEAKER,
        side: 'right',
        emotion: 'Happy',
        text: 'Saved! Step right into the shrine courtyard, everyone—Chancellor Serperior and High Seeress Milotic have just arrived across the north bridge!',
      },
      {
        speaker: { kind: 'advisor' },
        side: 'left',
        emotion: 'Happy',
        text: 'Potions! Oran Berries! Life-saving emergency snacks! Thank goodness—watching you guys take hits takes years off my tiny bug lifespan!',
      },
    ],
  };
}
