/**
 * Dragon Lord Aura Palettes, Flower Color Resonance & Personality Profiles (`quizLordProfiles.ts`)
 */

import type { DragonLordSpeciesId } from './campaignConfig';
import type { FlabebeFlowerColor } from '../types/schemas';

export type { DragonLordSpeciesId };

export interface AuraWavePalette {
  outerRgb: readonly [number, number, number];
  midRgb: readonly [number, number, number];
  coreRgb: readonly [number, number, number];
}

export const MYSTICAL_QUIZ_WAVE_PALETTE: AuraWavePalette = {
  outerRgb: [86, 26, 172],
  midRgb: [168, 102, 240],
  coreRgb: [248, 242, 255],
};

export interface DragonLordTraitInfo {
  speciesId: DragonLordSpeciesId;
  name: string;
  indefiniteArticle: 'a' | 'an';
  personalityTitle: string;
  traitLabel: string;
  personalityDescription: string;
  auraSummary: string;
  flabebeFlowerColor: FlabebeFlowerColor;
  flabebeFlowerLabel: string;
  revealBackdropCss: string;
  auraWavePalette: AuraWavePalette;
  accentBorderColor: string;
}

export const DEFAULT_QUIZ_BACKDROP_CSS =
  'radial-gradient(circle at 50% 50%, rgba(168, 102, 240, 0.95), rgba(86, 26, 172, 0.99))';

export const DRAGON_LORD_OPTIONS: ReadonlyArray<DragonLordTraitInfo> = [
  {
    speciesId: 'axew',
    name: 'Axew',
    indefiniteArticle: 'an',
    personalityTitle: 'Brave',
    traitLabel: 'Brave & Steadfast',
    personalityDescription:
      "You always step forward first when someone's in trouble. Your courage lights a fire in everyone beside you!",
    auraSummary: 'Steadfast vanguard whose crimson aura resonates with Red-Flower Flabébé.',
    flabebeFlowerColor: 'red',
    flabebeFlowerLabel: 'Red Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(196, 38, 52, 0.94), rgba(44, 8, 16, 0.98))',
    auraWavePalette: {
      outerRgb: [236, 4, 16],
      midRgb: [248, 112, 124],
      coreRgb: [255, 244, 246],
    },
    accentBorderColor: '#ff6878',
  },
  {
    speciesId: 'bagon',
    name: 'Bagon',
    indefiniteArticle: 'a',
    personalityTitle: 'Hardy',
    traitLabel: 'Hardy & Determined',
    personalityDescription:
      'Once your mind is made up, nothing can stop you. Every setback only makes your resolve burn brighter!',
    auraSummary: 'Relentless trailblazer whose amber aura resonates with Orange-Flower Flabébé.',
    flabebeFlowerColor: 'orange',
    flabebeFlowerLabel: 'Orange Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(216, 102, 24, 0.94), rgba(48, 18, 6, 0.98))',
    auraWavePalette: {
      outerRgb: [234, 90, 8],
      midRgb: [252, 168, 84],
      coreRgb: [255, 248, 238],
    },
    accentBorderColor: '#ffa048',
  },
  {
    speciesId: 'gible',
    name: 'Gible',
    indefiniteArticle: 'a',
    personalityTitle: 'Bold',
    traitLabel: 'Bold & Spirited',
    personalityDescription:
      'You flash a fearless grin right when things look toughest. Your bold spirit shatters doubt in an instant!',
    auraSummary: 'Hard-hitting frontliner whose golden aura resonates with Yellow-Flower Flabébé.',
    flabebeFlowerColor: 'yellow',
    flabebeFlowerLabel: 'Yellow Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(198, 164, 24, 0.94), rgba(46, 34, 6, 0.98))',
    auraWavePalette: {
      outerRgb: [218, 164, 6],
      midRgb: [250, 218, 86],
      coreRgb: [255, 253, 236],
    },
    accentBorderColor: '#f8dc48',
  },
  {
    speciesId: 'dratini',
    name: 'Dratini',
    indefiniteArticle: 'a',
    personalityTitle: 'Calm',
    traitLabel: 'Calm & Perceptive',
    personalityDescription:
      'Has anyone ever told you how relaxed you look in the face of fear? You notice what others miss and quietly steady every ally at your side!',
    auraSummary: 'Serene tactician whose azure aura resonates with Blue-Flower Flabébé.',
    flabebeFlowerColor: 'blue',
    flabebeFlowerLabel: 'Blue Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(36, 112, 214, 0.94), rgba(8, 20, 52, 0.98))',
    auraWavePalette: {
      outerRgb: [12, 102, 228],
      midRgb: [98, 180, 252],
      coreRgb: [242, 250, 255],
    },
    accentBorderColor: '#58c8ff',
  },
  {
    speciesId: 'goomy',
    name: 'Goomy',
    indefiniteArticle: 'a',
    personalityTitle: 'Gentle',
    traitLabel: 'Gentle & Resilient',
    personalityDescription:
      'Just having you nearby comforts your friends. Beneath that gentle kindness lies a resilience nothing can break!',
    auraSummary: 'Warm-hearted guardian whose luminous aura resonates with White-Flower Flabébé.',
    flabebeFlowerColor: 'white',
    flabebeFlowerLabel: 'White Aura',
    revealBackdropCss:
      'radial-gradient(circle at 50% 26%, rgba(182, 196, 220, 0.92), rgba(28, 36, 54, 0.98))',
    auraWavePalette: {
      outerRgb: [142, 160, 194],
      midRgb: [208, 220, 240],
      coreRgb: [255, 255, 255],
    },
    accentBorderColor: '#f0f4ff',
  },
];

export function getDragonLordTraitInfo(speciesId: string): DragonLordTraitInfo {
  return DRAGON_LORD_OPTIONS.find((d) => d.speciesId === speciesId) ?? DRAGON_LORD_OPTIONS[0]!;
}
