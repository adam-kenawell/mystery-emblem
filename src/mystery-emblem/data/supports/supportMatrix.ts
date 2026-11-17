/**
 * Act 1 Demo Support Pairing Matrix, Thresholds & Per-Line Adjacent Stat Bonuses (`supportMatrix.ts`)
 */

import { SUPPORT_RANKS, type SaveData, type SupportRank, type UnlockedSupportRank } from '../../types/saveSchemas';
import type {
  ResolvedSupportStatBonus,
  SupportActorId,
  SupportLineBonusProfile,
  SupportMaxRank,
  SupportPairDefinition,
  SupportStatBonus,
} from './supportTypes';

export const SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID = 'chapter_02';

/** Cumulative support points required to unlock each rank conversation. */
export const SUPPORT_RANK_THRESHOLDS: Readonly<Record<SupportRank, number>> = {
  C: 3,
  B: 7,
  A: 12,
  S: 18,
};

export function makeCanonicalSupportPairKey(actorIdA: string, actorIdB: string): string {
  const a = actorIdA.trim();
  const b = actorIdB.trim();
  if (!a || !b) {
    throw new Error('Support actor IDs must be non-empty.');
  }
  if (a === b) {
    throw new Error('Cannot compute Support pair key between a unit and itself.');
  }
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function getSupportRankIndex(rank: UnlockedSupportRank): number {
  if (!rank) return -1;
  return SUPPORT_RANKS.indexOf(rank);
}

export function getMaxSupportRank(a: UnlockedSupportRank, b: UnlockedSupportRank): UnlockedSupportRank {
  return getSupportRankIndex(a) >= getSupportRankIndex(b) ? a : b;
}

export function getSupportRanksUpTo(maxRank: SupportMaxRank): readonly SupportRank[] {
  const idx = SUPPORT_RANKS.indexOf(maxRank);
  return SUPPORT_RANKS.slice(0, idx + 1);
}

export function getNextSupportRank(
  unlockedRank: UnlockedSupportRank,
  maxRank: SupportMaxRank
): SupportRank | null {
  const curIdx = getSupportRankIndex(unlockedRank);
  const maxIdx = SUPPORT_RANKS.indexOf(maxRank);
  if (curIdx >= maxIdx) return null;
  return SUPPORT_RANKS[curIdx + 1] ?? null;
}

export function clampSupportPointsForUnlockedRank(
  points: number,
  unlockedRank: UnlockedSupportRank,
  maxRank: SupportMaxRank
): number {
  const safePts = Math.max(0, Math.floor(Number.isFinite(points) ? points : 0));
  const nextRank = getNextSupportRank(unlockedRank, maxRank);
  const cap = nextRank ? SUPPORT_RANK_THRESHOLDS[nextRank] : SUPPORT_RANK_THRESHOLDS[maxRank];
  return Math.min(safePts, cap);
}

export function areSupportsUnlockedInCampaign(
  save: Pick<SaveData, 'campaign'> | null | undefined
): boolean {
  return Boolean(save?.campaign?.completedChapterIds?.includes(SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID));
}

export function areSupportsEnabledForBattlePrep(
  save: Pick<SaveData, 'campaign'> | null | undefined,
  levelId: string
): boolean {
  if (!areSupportsUnlockedInCampaign(save)) return false;
  return levelId !== 'prologue' && levelId !== 'chapter_01' && levelId !== 'chapter_02';
}

const DEFAULT_FALLBACK_PROFILE: SupportLineBonusProfile = {
  C: { atk: 1 },
  B: { atk: 1, def: 1 },
  A: { atk: 2, def: 1 },
  S: { atk: 2, def: 2 },
};

export const SUPPORT_LINE_STAT_PROFILES: Readonly<Record<string, SupportLineBonusProfile>> = {
  axew_line: {
    C: { atk: 1 },
    B: { atk: 1, spe: 1 },
    A: { atk: 2, spe: 1 },
    S: { atk: 3, spe: 2 },
  },
  bagon_line: {
    C: { atk: 1 },
    B: { atk: 1, def: 1 },
    A: { atk: 2, def: 1 },
    S: { atk: 3, def: 2 },
  },
  gible_line: {
    C: { spe: 1 },
    B: { spe: 1, atk: 1 },
    A: { spe: 2, atk: 1 },
    S: { spe: 3, atk: 2 },
  },
  dratini_line: {
    C: { spa: 1 },
    B: { spa: 1, atk: 1 },
    A: { spa: 2, atk: 1 },
    S: { spa: 3, atk: 2 },
  },
  goomy_line: {
    C: { spd: 1 },
    B: { spd: 1, spa: 1 },
    A: { spd: 2, spa: 1 },
    S: { spd: 3, spa: 2 },
  },
  quaxly_line: {
    C: { atk: 1 },
    B: { atk: 1, spe: 1 },
    A: { atk: 2, spe: 1 },
    S: { atk: 3, spe: 2 },
  },
  flabebe_line: {
    C: { spd: 1 },
    B: { spd: 1, spa: 1 },
    A: { spd: 2, spa: 1 },
    S: { spd: 3, spa: 2 },
  },
  combee_line: {
    C: { spe: 1 },
    B: { def: 1, spd: 1 },
    A: { def: 1, spd: 1, spe: 1 },
    S: { def: 2, spd: 2, spe: 1 },
  },
  mentor_quaquaval_line: {
    C: { def: 1 },
    B: { atk: 1, def: 1 },
    A: { atk: 2, def: 1 },
    S: { atk: 3, def: 2 },
  },
  chespin_line: {
    C: { def: 1 },
    B: { def: 2 },
    A: { def: 2, spd: 1 },
    S: { def: 3, spd: 2 },
  },
  machop_line: {
    C: { atk: 1 },
    B: { atk: 2 },
    A: { atk: 2, def: 1 },
    S: { atk: 3, def: 2 },
  },
  slakoth_line: {
    C: { def: 1 },
    B: { atk: 1, def: 1 },
    A: { atk: 2, def: 1 },
    S: { atk: 3, def: 1, spd: 1 },
  },
  starly_line: {
    C: { spe: 1 },
    B: { spe: 2 },
    A: { spe: 2, atk: 1 },
    S: { spe: 3, atk: 2 },
  },
  caterpie_line: {
    C: { spa: 1 },
    B: { spa: 2 },
    A: { spa: 2, spd: 1 },
    S: { spa: 3, spd: 2 },
  },
  pawmi_line: {
    C: { spe: 1 },
    B: { atk: 1, spe: 1 },
    A: { spe: 2, atk: 1 },
    S: { atk: 2, spe: 3 },
  },
  honedge_line: {
    C: { def: 1 },
    B: { atk: 1, def: 1 },
    A: { def: 2, atk: 1 },
    S: { def: 3, atk: 2 },
  },
  sandile_line: {
    C: { atk: 1 },
    B: { atk: 1, spe: 1 },
    A: { atk: 2, spe: 1 },
    S: { atk: 3, spe: 2 },
  },
};

export function resolveSupportStatBonus(bonus: SupportStatBonus): ResolvedSupportStatBonus {
  return {
    atk: bonus.atk ?? 0,
    def: bonus.def ?? 0,
    spa: bonus.spa ?? 0,
    spd: bonus.spd ?? 0,
    spe: bonus.spe ?? 0,
  };
}

export function getLineSupportStatBonus(
  lineId: string | undefined,
  rank: SupportRank
): ResolvedSupportStatBonus {
  const profile = (lineId && SUPPORT_LINE_STAT_PROFILES[lineId]) || DEFAULT_FALLBACK_PROFILE;
  return resolveSupportStatBonus(profile[rank]);
}

const STAT_LABEL_ORDER: ReadonlyArray<readonly [keyof ResolvedSupportStatBonus, string]> = [
  ['atk', 'Atk'],
  ['def', 'Def'],
  ['spa', 'SpA'],
  ['spd', 'SpD'],
  ['spe', 'Spe'],
];

export function formatSupportStatBonusShort(bonus: SupportStatBonus): string {
  const parts: string[] = [];
  for (const [key, label] of STAT_LABEL_ORDER) {
    const val = bonus[key] ?? 0;
    if (val > 0) parts.push(`+${val} ${label}`);
  }
  return parts.join(', ');
}

export function formatLineSupportGiftTag(lineId: string | undefined): string {
  const profile = (lineId && SUPPORT_LINE_STAT_PROFILES[lineId]) || DEFAULT_FALLBACK_PROFILE;
  const maxEntry = profile.S;
  const labels: string[] = [];
  for (const [key, label] of STAT_LABEL_ORDER) {
    if ((maxEntry[key] ?? 0) > 0) labels.push(`+${label}`);
  }
  return labels.slice(0, 3).join(' / ');
}

function pair(actorA: SupportActorId, actorB: SupportActorId, maxRank: SupportMaxRank): SupportPairDefinition {
  const pairKey = makeCanonicalSupportPairKey(actorA, actorB);
  const [sortedA, sortedB] = pairKey.split('::') as [SupportActorId, SupportActorId];
  return { pairKey, actorA: sortedA, actorB: sortedB, maxRank };
}

/**
 * 27 active Act 1 Demo pairs (10 Hero + 17 non-Hero; 28 non-Hero pairs have no support).
 */
export const SUPPORT_PAIR_DEFINITIONS: ReadonlyArray<SupportPairDefinition> = [
  // Hero (Lord) supports all 10 Demo companions
  pair('lord', 'quaxly_line', 'S'),
  pair('lord', 'flabebe_line', 'S'),
  pair('lord', 'chespin_line', 'S'),
  pair('lord', 'starly_line', 'S'),
  pair('lord', 'pawmi_line', 'S'),
  pair('lord', 'mentor_quaquaval_line', 'A'),
  pair('lord', 'combee_line', 'A'),
  pair('lord', 'machop_line', 'A'),
  pair('lord', 'caterpie_line', 'B'),
  pair('lord', 'slakoth_line', 'B'),

  // Non-Hero S-Ranks (5)
  pair('quaxly_line', 'flabebe_line', 'S'),
  pair('combee_line', 'flabebe_line', 'S'),
  pair('chespin_line', 'machop_line', 'S'),
  pair('starly_line', 'caterpie_line', 'S'),
  pair('caterpie_line', 'pawmi_line', 'S'),

  // Non-Hero A-Ranks (7)
  pair('quaxly_line', 'mentor_quaquaval_line', 'A'),
  pair('quaxly_line', 'pawmi_line', 'A'),
  pair('flabebe_line', 'caterpie_line', 'A'),
  pair('mentor_quaquaval_line', 'chespin_line', 'A'),
  pair('combee_line', 'starly_line', 'A'),
  pair('machop_line', 'slakoth_line', 'A'),
  pair('starly_line', 'pawmi_line', 'A'),

  // Non-Hero B-Ranks (5)
  pair('flabebe_line', 'mentor_quaquaval_line', 'B'),
  pair('quaxly_line', 'chespin_line', 'B'),
  pair('flabebe_line', 'chespin_line', 'B'),
  pair('combee_line', 'slakoth_line', 'B'),
  pair('machop_line', 'pawmi_line', 'B'),
];

const PAIR_BY_KEY = new Map<string, SupportPairDefinition>(
  SUPPORT_PAIR_DEFINITIONS.map((def) => [def.pairKey, def])
);

export function getSupportPairDefinition(
  actorIdA: string | null | undefined,
  actorIdB: string | null | undefined
): SupportPairDefinition | undefined {
  if (!actorIdA || !actorIdB || actorIdA === actorIdB) return undefined;
  return PAIR_BY_KEY.get(makeCanonicalSupportPairKey(actorIdA, actorIdB));
}

export function getSupportPartnersForActor(
  actorId: SupportActorId
): Array<{ partnerActorId: SupportActorId; pair: SupportPairDefinition }> {
  const out: Array<{ partnerActorId: SupportActorId; pair: SupportPairDefinition }> = [];
  for (const def of SUPPORT_PAIR_DEFINITIONS) {
    if (def.actorA === actorId) {
      out.push({ partnerActorId: def.actorB, pair: def });
    } else if (def.actorB === actorId) {
      out.push({ partnerActorId: def.actorA, pair: def });
    }
  }
  return out;
}
