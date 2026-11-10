/**
 * Mystery Emblem — Data-Driven Credits Metadata & Cast Resolvers (`creditsData.ts`)
 *
 * Separates static credits copy, role labels, and Wimpod -> Golisopod deduplication
 * from `CreditsScene.ts` DOM/canvas scrolling logic.
 */

import { WIMPOD_PMD_ASSET_ID } from '../assets/pmdAssetLoader';
import {
  KING_SERPERIOR_PMD_ASSET_ID,
  LADY_MILOTIC_PMD_ASSET_ID,
} from './campaignRegistry';
import { getSpeciesById } from './index';
import { KECLEON_PMD_ASSET_ID } from './overworldMapData';
import { isAdvisorInPlayableRoster } from '../engine/speakerResolver';
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
}

export const CREDITS_HERO_META = {
  eyebrow: 'POKÉMON MYSTERY DUNGEON × FIRE EMBLEM',
  mainTitle: 'MYSTERY EMBLEM',
  actSubtitleDemo: 'The Verdant Heartland',
  actSubtitleFull: 'Chronicles of the Five Kingdoms',
  castSectionHeading: 'HEROES OF THE VERDANT HEARTLAND',
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
  piplup_line: 'Headstrong Vanguard & Foster Brother',
  flabebe_line: 'Sanctuary Healer & Childhood Friend',
  sir_empoleon_line: 'Veteran Royal Guard & Foster Mentor',
  sewaddle_line: 'Capital Road Brush Scout',
  duskull_line: 'Lantern Keeper of Northern Pass',
  slakoth_line: 'Sleepy Lush Prairie Powerhouse',
  wimpod_line: 'Armored Tactician & Reformed Hazard Scholar',
  oricorio_line: 'Inspiring Dancer of the Five Kingdoms',
};

export function resolveUnitCreditsRoleLabel(unit: OwnedPokemonInstance, index: number): string {
  if (index === 0 || unit.isLord) {
    return 'Dragon Kingdom Scion & Foster Strategist';
  }
  const sp = getSpeciesById(unit.speciesId);
  if (sp?.lineId && LINE_ROLE_LABELS[sp.lineId]) {
    return LINE_ROLE_LABELS[sp.lineId]!;
  }
  return 'Ally of the Verdant Commonwealth';
}

export function getCreditsNpcShowcaseList(save: SaveData | null): CreditsNpcCastSpec[] {
  const npcs: CreditsNpcCastSpec[] = [];
  if (!isAdvisorInPlayableRoster(save)) {
    npcs.push({
      id: 'wimpod',
      assetId: WIMPOD_PMD_ASSET_ID,
      name: 'Wimpod',
      subtitle: 'Tactical Coward & Hazard Scholar',
    });
  }
  npcs.push(
    {
      id: 'serperior',
      assetId: KING_SERPERIOR_PMD_ASSET_ID,
      name: 'King Serperior',
      subtitle: 'Sovereign of the Verdant Commonwealth',
    },
    {
      id: 'milotic',
      assetId: LADY_MILOTIC_PMD_ASSET_ID,
      name: 'Lady Milotic',
      subtitle: 'Royal Advisor of the Verdant Commonwealth',
    },
    {
      id: 'kecleon',
      assetId: KECLEON_PMD_ASSET_ID,
      name: 'Kecleon',
      subtitle: 'Master Traveling Merchant',
    }
  );
  return npcs;
}

export function resolveCreditsEndCardCopy(save: SaveData | null): CreditsEndCardCopy {
  const rosterLen = save?.roster.length ?? 0;
  const clearedCount = save?.campaign.completedChapterIds.length ?? 7;
  const isFullCampaign = save?.campaign.campaignMode === 'main';
  const totalChapterTarget = isFullCampaign ? Math.max(26, clearedCount) : 9;

  return {
    eyebrow: isFullCampaign ? 'CAMPAIGN COMPLETE' : 'DEMO COMPLETE',
    thankTitle: isFullCampaign
      ? 'Thank You for Playing Mystery Emblem!'
      : 'Thank You for Playing the Mystery Emblem Demo!',
    teaserLine: isFullCampaign
      ? 'Peace returns across the Five Kingdoms — New Game Plus awaits!'
      : 'Into the Goldensand Diarchy · Coming Soon!',
    statsLine: `Chapters Cleared: ${clearedCount} / ${totalChapterTarget}  ·  Allies Recruited: ${Math.max(4, rosterLen)}`,
    finishButtonLabel: 'Return to World Map ▶',
  };
}
