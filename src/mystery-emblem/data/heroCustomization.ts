/**
 * Hero Customization Constants, Asset/Flaw Stat Modifiers & Birthday Helpers (`heroCustomization.ts`)
 */

import type { StatBlockSeven, StatKeySix } from '../types/schemas';

export const HERO_NAME_MAX_LENGTH = 14;
export const HERO_BOON_GROWTH_BONUS = 15;
export const HERO_BANE_GROWTH_PENALTY = 10;
export const HERO_BIRTHDAY_GIFT_ITEM_ID = 'sitrus_berry';

export interface HeroStatOptionMeta {
  key: StatKeySix;
  shortLabel: string;
  fullLabel: string;
  boonBaseDelta: number;
  baneBaseDelta: number;
}

export const HERO_STAT_OPTIONS: ReadonlyArray<HeroStatOptionMeta> = [
  { key: 'hp', shortLabel: 'HP', fullLabel: 'HP', boonBaseDelta: 3, baneBaseDelta: -2 },
  { key: 'atk', shortLabel: 'ATK', fullLabel: 'Attack', boonBaseDelta: 2, baneBaseDelta: -1 },
  { key: 'def', shortLabel: 'DEF', fullLabel: 'Defense', boonBaseDelta: 2, baneBaseDelta: -1 },
  { key: 'spa', shortLabel: 'SPA', fullLabel: 'Sp. Atk', boonBaseDelta: 2, baneBaseDelta: -1 },
  { key: 'spd', shortLabel: 'SPD', fullLabel: 'Sp. Def', boonBaseDelta: 2, baneBaseDelta: -1 },
  { key: 'spe', shortLabel: 'SPE', fullLabel: 'Speed', boonBaseDelta: 2, baneBaseDelta: -1 },
];

export const VALID_HERO_STAT_KEYS = new Set<string>(HERO_STAT_OPTIONS.map((o) => o.key));

export interface BirthMonthMeta {
  value: number;
  name: string;
  shortName: string;
  maxDays: number;
}

export const BIRTH_MONTH_OPTIONS: ReadonlyArray<BirthMonthMeta> = [
  { value: 1, name: 'January', shortName: 'Jan', maxDays: 31 },
  { value: 2, name: 'February', shortName: 'Feb', maxDays: 29 },
  { value: 3, name: 'March', shortName: 'Mar', maxDays: 31 },
  { value: 4, name: 'April', shortName: 'Apr', maxDays: 30 },
  { value: 5, name: 'May', shortName: 'May', maxDays: 31 },
  { value: 6, name: 'June', shortName: 'Jun', maxDays: 30 },
  { value: 7, name: 'July', shortName: 'Jul', maxDays: 31 },
  { value: 8, name: 'August', shortName: 'Aug', maxDays: 31 },
  { value: 9, name: 'September', shortName: 'Sep', maxDays: 30 },
  { value: 10, name: 'October', shortName: 'Oct', maxDays: 31 },
  { value: 11, name: 'November', shortName: 'Nov', maxDays: 30 },
  { value: 12, name: 'December', shortName: 'Dec', maxDays: 31 },
];

export function isValidHeroStatKey(value: unknown): value is StatKeySix {
  return typeof value === 'string' && VALID_HERO_STAT_KEYS.has(value);
}

export function getHeroStatMeta(key: StatKeySix): HeroStatOptionMeta {
  return HERO_STAT_OPTIONS.find((o) => o.key === key) ?? HERO_STAT_OPTIONS[0]!;
}

export function getDaysInBirthMonth(month: number): number {
  const entry = BIRTH_MONTH_OPTIONS.find((m) => m.value === month);
  return entry?.maxDays ?? 31;
}

export function isValidHeroBirthday(month: unknown, day: unknown): boolean {
  if (typeof month !== 'number' || typeof day !== 'number') return false;
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= getDaysInBirthMonth(month);
}

export function formatHeroBirthday(month?: number, day?: number): string | null {
  if (!isValidHeroBirthday(month, day)) return null;
  const meta = BIRTH_MONTH_OPTIONS.find((m) => m.value === month);
  return meta ? `${meta.shortName} ${day}` : null;
}

export function isHeroBirthdayToday(
  month?: number,
  day?: number,
  now: Date = new Date()
): boolean {
  if (!isValidHeroBirthday(month, day)) return false;
  return now.getMonth() + 1 === month && now.getDate() === day;
}

export function applyBoonBaneToBaseStats(
  baseStats: StatBlockSeven,
  boonStat?: StatKeySix,
  baneStat?: StatKeySix
): StatBlockSeven {
  const out: StatBlockSeven = { ...baseStats };
  if (!boonStat || !baneStat || boonStat === baneStat) {
    return out;
  }
  const boonMeta = getHeroStatMeta(boonStat);
  const baneMeta = getHeroStatMeta(baneStat);
  out[boonStat] = Math.max(1, out[boonStat] + boonMeta.boonBaseDelta);
  out[baneStat] = Math.max(1, out[baneStat] + baneMeta.baneBaseDelta);
  return out;
}
