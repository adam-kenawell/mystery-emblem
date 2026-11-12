/**
 * Mystery Emblem: Data-Driven Credits Metadata & Cast Resolvers (`creditsData.ts`)
 *
 * Separates static credits copy and cast role labels from `CreditsScene.ts` DOM/canvas scrolling logic.
 */

import {
  FLORGES_PARENT_BASE_PMD_ASSET_ID,
  KECLEON_PMD_ASSET_ID,
  KING_SERPERIOR_PMD_ASSET_ID,
  PIDGEOTTO_MESSENGER_PMD_ASSET_ID,
} from './campaignRegistry';
import { getSpeciesById } from './index';
import type { OwnedPokemonInstance, SaveData } from '../types/schemas';

export interface CreditsEntryItem {
  primary: string;
  secondary?: string;
  testId?: string;
}

export interface CreditsSectionBlock {
  heading: string;
  entries: ReadonlyArray<CreditsEntryItem>;
}

export interface CreditsNpcCastSpec {
  id: string;
  assetId: string;
  name: string;
  subtitle: string;
}

export interface CreditsEndCardCopy {
  eyebrow: string;
  thankTitle: string;
  teaserLine: string;
  statsLine: string;
  finishButtonLabel: string;
  feedbackFormUrl?: string;
}

export const DEMO_FEEDBACK_FORM_URL = 'https://forms.gle/PYsmgZfim4Lkob1g8';

export const CREDITS_HERO_META = {
  eyebrow: 'POKÉMON MYSTERY DUNGEON × FIRE EMBLEM',
  mainTitle: 'MYSTERY EMBLEM',
  actSubtitleDemo: 'Act 1: Expedition to King Serperior',
  actSubtitleFull: 'Chronicles of the Space-Time Rift',
  castSectionHeading: 'HEROES OF THE VERDANT EXPEDITION',
} as const;

export const CREDITS_STATIC_SECTIONS: ReadonlyArray<CreditsSectionBlock> = [
  {
    heading: 'CREATED, DESIGNED & DIRECTED BY',
    entries: [
      {
        primary: 'Adam Kenawell',
        secondary: 'Creator · Game Design, Balance & Engineering',
        testId: 'credits-creator-name',
      },
    ],
  },
  {
    heading: 'SPRITE & PORTRAIT ARTISTRY',
    entries: [
      {
        primary: 'PMDCollab & SpriteCollab Community Artists',
        secondary: '8-Directional Pokémon Sprites & Multi-Emotion Portraits',
      },
    ],
  },
  {
    heading: 'ORIGINAL SOUNDTRACK & VISUAL INSPIRATION',
    entries: [
      {
        primary: 'Pokémon Mystery Dungeon: Explorers of Sky',
        secondary: 'Chunsoft · The Pokémon Company (Music by Arata Iiyoshi, Hideki Sakamoto & Team)',
      },
      {
        primary: 'Fire Emblem Awakening',
        secondary: 'Intelligent Systems · Nintendo',
      },
    ],
  },
];

export const CREDITS_LEGAL_DISCLAIMER =
  'Mystery Emblem is a free, non-commercial fan project. Pokémon and Fire Emblem are trademarks of Nintendo, Creatures Inc., GAME FREAK inc., Spike Chunsoft, and Intelligent Systems.';

const LINE_ROLE_LABELS: Readonly<Record<string, string>> = {
  quaxly_line: 'Steadfast Vanguard & Foster Brother',
  flabebe_line: 'Village Healer & Childhood Friend',
  mentor_quaquaval_line: 'Retired Royal Guard & Foster Father',
  smoliv_line: 'Rescued Foothill Trail Companion',
  machop_line: 'Mountain Cave Pathfinder',
  slakoth_line: 'Sleepy Lush Prairie Powerhouse',
  starly_line: 'Hometown Sky Scout',
  caterpie_line: 'Hometown Trailblazer',
  pawmi_line: 'Hometown Spark Brawler',
  honedge_line: 'Valiant Steel Kingdom Envoy',
  sandile_line: 'Sharp-Eyed Sand Kingdom Envoy',
  dreepy_line: 'Sealed Scion of the Ancient Dragons',
  deino_line: 'Redeemed Scion of the Ancient Dragons',
};

export function resolveUnitCreditsRoleLabel(unit: OwnedPokemonInstance, index: number): string {
  if (index === 0 || unit.isLord) {
    return 'Sealed Scion of the Ancient Dragon Kingdom';
  }
  const sp = getSpeciesById(unit.speciesId);
  if (sp?.lineId && LINE_ROLE_LABELS[sp.lineId]) {
    return LINE_ROLE_LABELS[sp.lineId]!;
  }
  return 'Ally of the Verdant Expedition';
}

export function getCreditsNpcShowcaseList(_save: SaveData | null): CreditsNpcCastSpec[] {
  return [
    {
      id: 'serperior',
      assetId: KING_SERPERIOR_PMD_ASSET_ID,
      name: 'King Serperior',
      subtitle: 'Sovereign of the Verdant Kingdom',
    },
    {
      id: 'florges',
      assetId: FLORGES_PARENT_BASE_PMD_ASSET_ID,
      name: 'Florges',
      subtitle: 'Village Matriarch & Sanctuary Keeper',
    },
    {
      id: 'pidgeotto',
      assetId: PIDGEOTTO_MESSENGER_PMD_ASSET_ID,
      name: 'Pidgeotto',
      subtitle: 'Royal Courier of the Capital',
    },
    {
      id: 'kecleon',
      assetId: KECLEON_PMD_ASSET_ID,
      name: 'Kecleon',
      subtitle: 'Master Traveling Merchant',
    },
  ];
}

export function resolveCreditsEndCardCopy(save: SaveData | null): CreditsEndCardCopy {
  const rosterLen = save?.roster.length ?? 0;
  const clearedCount = save?.campaign.completedChapterIds.length ?? 5;
  const isFullCampaign = save?.campaign.campaignMode === 'main';
  const totalChapterTarget = isFullCampaign ? Math.max(25, clearedCount) : 6;

  return {
    eyebrow: isFullCampaign ? 'CAMPAIGN COMPLETE' : 'ACT 1 COMPLETE',
    thankTitle: isFullCampaign
      ? 'Thank You for Playing Mystery Emblem!'
      : 'Thank You for Playing Mystery Emblem: Act 1!',
    teaserLine: isFullCampaign
      ? 'The Space-Time Rift is sealed at last. New Game Plus awaits!'
      : 'Act 2: Uncovering the Truth in the Ice Kingdom · Coming Soon!',
    statsLine: `Chapters Cleared: ${clearedCount} / ${totalChapterTarget}  ·  Allies Recruited: ${Math.max(3, rosterLen)}`,
    finishButtonLabel: isFullCampaign ? 'Return to World Map ▶' : 'Share Feedback & Shape Act 2',
    feedbackFormUrl: isFullCampaign ? undefined : DEMO_FEEDBACK_FORM_URL,
  };
}
