/**
 * Mystery Emblem - Kecleon Shop Types & Curated Inventory Builder
 */

import type { ItemDefinition, KecleonShopType } from '../../types/schemas';
import { ITEMS_LIST, getItemById } from '../index';

export const ALL_KECLEON_SHOP_TYPES: ReadonlyArray<KecleonShopType> = [
  'tm_shop',
  'held_shop',
  'healing_shop',
  'x_item_shop',
];

export interface KecleonShopTypeMetadata {
  shopType: KecleonShopType;
  title: string;
  shortBadge: string;
  greeting: string;
  accentColor: string;
  stockCount: number;
}

export interface KecleonShopBuildOptions {
  completedChapterIds?: ReadonlyArray<string>;
}

export const KECLEON_SHOP_METADATA: Readonly<Record<KecleonShopType, KecleonShopTypeMetadata>> = {
  tm_shop: {
    shopType: 'tm_shop',
    title: 'Kecleon TM Stall',
    shortBadge: 'TM SHOP',
    greeting: 'Looking to learn something new? Every move on the shelf, guaranteed!',
    accentColor: '#90d8f8',
    stockCount: 6,
  },
  held_shop: {
    shopType: 'held_shop',
    title: 'Kecleon Gear & Berries',
    shortBadge: 'HELD SHOP',
    greeting: 'Gear and berries, fresh today! Something for everyone!',
    accentColor: '#68d888',
    stockCount: 6,
  },
  healing_shop: {
    shopType: 'healing_shop',
    title: 'Kecleon Apothecary',
    shortBadge: 'HEAL SHOP',
    greeting: 'Hurt? Tired? Potions and remedies, right here, friend!',
    accentColor: '#f8d048',
    stockCount: 6,
  },
  x_item_shop: {
    shopType: 'x_item_shop',
    title: 'Kecleon X-Items',
    shortBadge: 'X-SHOP',
    greeting: 'Facing someone tough? A little boost never hurt anybody!',
    accentColor: '#ff9868',
    stockCount: 6,
  },
};

export function getCatalogItemsForShopType(shopType: KecleonShopType): ItemDefinition[] {
  return ITEMS_LIST.filter((item) => item.shopType === shopType && item.buyPrice !== null);
}

export function buildKecleonShopInventory(
  shopType: KecleonShopType,
  rng: () => number = Math.random,
  options?: KecleonShopBuildOptions
): string[] {
  const completed = new Set(options?.completedChapterIds ?? []);
  const pool = getCatalogItemsForShopType(shopType)
    .filter((item) => {
      if (item.id === 'evolution_stone' && !completed.has('chapter_10')) return false;
      if (item.id === 'evolution_gem' && !completed.has('chapter_16')) return false;
      return true;
    })
    .map((item) => item.id);

  const meta = KECLEON_SHOP_METADATA[shopType];
  if (pool.length <= meta.stockCount) {
    return [...pool].sort((a, b) => (getItemById(a)?.buyPrice ?? 0) - (getItemById(b)?.buyPrice ?? 0));
  }

  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  const picked = copy.slice(0, meta.stockCount);
  picked.sort((a, b) => (getItemById(a)?.buyPrice ?? 0) - (getItemById(b)?.buyPrice ?? 0));
  return picked;
}
