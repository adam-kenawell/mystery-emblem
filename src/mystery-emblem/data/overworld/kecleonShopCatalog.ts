/**
 * Mystery Emblem — Kecleon Shop Types & Curated Inventory Builder
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

export const KECLEON_SHOP_METADATA: Readonly<Record<KecleonShopType, KecleonShopTypeMetadata>> = {
  tm_shop: {
    shopType: 'tm_shop',
    title: 'Kecleon TM Stall',
    shortBadge: 'TM SHOP',
    greeting: 'Single-use Technical Machines—teach your squad new moves!',
    accentColor: '#90d8f8',
    stockCount: 6,
  },
  held_shop: {
    shopType: 'held_shop',
    title: 'Kecleon Gear & Berries',
    shortBadge: 'HELD SHOP',
    greeting: 'Combat gear, type charms, and fresh berries!',
    accentColor: '#68d888',
    stockCount: 6,
  },
  healing_shop: {
    shopType: 'healing_shop',
    title: 'Kecleon Apothecary',
    shortBadge: 'HEAL SHOP',
    greeting: 'Potions, Full Heals, and rare Evolution Stones!',
    accentColor: '#f8d048',
    stockCount: 6,
  },
  x_item_shop: {
    shopType: 'x_item_shop',
    title: 'Kecleon X-Items',
    shortBadge: 'X-SHOP',
    greeting: 'Single-battle stat & crit boosters for tough bosses!',
    accentColor: '#ff9868',
    stockCount: 6,
  },
};

export function getCatalogItemsForShopType(shopType: KecleonShopType): ItemDefinition[] {
  return ITEMS_LIST.filter((item) => item.shopType === shopType && item.buyPrice !== null);
}

export function buildKecleonShopInventory(
  shopType: KecleonShopType,
  rng: () => number = Math.random
): string[] {
  const pool = getCatalogItemsForShopType(shopType).map((item) => item.id);
  const meta = KECLEON_SHOP_METADATA[shopType];
  if (pool.length <= meta.stockCount) {
    return [...pool];
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
