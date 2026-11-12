/**
 * Mystery Emblem - Public Site Metadata (`siteMeta.ts`)
 *
 * Shared by the SEO head, the info-page nav, and `sitemap.xml`.
 */

export const SITE_URL = 'https://mysteryemblem.com';
export const SITE_NAME = 'Mystery Emblem';
export const AUTHOR_NAME = 'Adam Kenawell';
export const AUTHOR_BLOG_URL = 'https://adam.kenawell.family/blog/';
export const OG_IMAGE_PATH = '/og-image.jpg';

export interface InfoPageLink {
  path: string;
  label: string;
}

/** Crawlable info pages (order = nav order). The game itself lives at `/`. */
export const INFO_PAGES: ReadonlyArray<InfoPageLink> = [
  { path: '/about/', label: 'About' },
  { path: '/how-to-play/', label: 'How to Play' },
  { path: '/characters/', label: 'Characters' },
  { path: '/faq/', label: 'FAQ' },
];

export const VIDEO_GAME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: SITE_NAME,
  alternateName: 'Mystery Emblem: Echoes of the Dragon Lineage',
  url: `${SITE_URL}/`,
  image: `${SITE_URL}${OG_IMAGE_PATH}`,
  description:
    'A free Pokémon x Fire Emblem fan game: a turn-based tactics RPG with Pokémon Mystery Dungeon pixel art, playable in your browser on phone or PC.',
  genre: ['Tactical RPG', 'Strategy', 'Fan game'],
  gamePlatform: ['Web browser', 'PC', 'Mobile'],
  applicationCategory: 'Game',
  operatingSystem: 'Any (web browser)',
  playMode: 'SinglePlayer',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_BLOG_URL },
} as const;
