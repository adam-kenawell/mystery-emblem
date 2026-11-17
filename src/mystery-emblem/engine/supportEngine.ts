/**
 * Pure Unit Supports Engine (`supportEngine.ts`)
 *
 * Resolves canonical actor keys (`'lord'` or `species.lineId`), checks unread C/B/A/S
 * conversation readiness, enforces Awakening-style threshold caps, and sums adjacent
 * unlocked stat bonuses during battle calculations.
 */

import { getSpeciesById } from '../data/index';
import { buildBeatDialogueLine, resolveBeatSides } from '../data/cutscenes/dialogueCompiler';
import {
  SUPPORT_RANK_THRESHOLDS,
  areSupportsUnlockedInCampaign,
  clampSupportPointsForUnlockedRank,
  getLineSupportStatBonus,
  getNextSupportRank,
  getSupportPairDefinition,
  getSupportPartnersForActor,
} from '../data/supports/supportMatrix';
import type {
  ActiveSupportPartnerEntry,
  AdjacentSupportSummary,
  ResolvedSupportStatBonus,
  SupportActorId,
  SupportConversationDoc,
  SupportMaxRank,
} from '../data/supports/supportTypes';
import type {
  OwnedPokemonInstance,
  SaveData,
  SupportPairProgress,
  SupportRank,
} from '../types/schemas';
import type { DialogueLine, DialogueScript } from '../ui/DialogueOverlay';

export interface SupportBattleUnitLike {
  id: string;
  x: number;
  y: number;
  faction: string;
  isLord: boolean;
  speciesId: string;
  nickname: string;
  defeated: boolean;
  currentHp: number;
}

export function resolveSupportActorIdForRosterUnit(
  unit: Pick<OwnedPokemonInstance, 'instanceId' | 'isLord' | 'speciesId'>,
  save?: Pick<SaveData, 'campaign'> | null
): SupportActorId | null {
  if (unit.isLord || (save?.campaign.lordInstanceId && unit.instanceId === save.campaign.lordInstanceId)) {
    return 'lord';
  }
  return getSpeciesById(unit.speciesId)?.lineId ?? null;
}

export function resolveSupportActorIdForBattleUnit(
  unit: Pick<SupportBattleUnitLike, 'faction' | 'isLord' | 'speciesId'>
): SupportActorId | null {
  if (unit.faction !== 'player') return null;
  if (unit.isLord) return 'lord';
  return getSpeciesById(unit.speciesId)?.lineId ?? null;
}

export function getReadySupportRank(
  progress: SupportPairProgress | undefined,
  maxRank: SupportMaxRank
): SupportRank | null {
  const nextRank = getNextSupportRank(progress?.unlockedRank ?? null, maxRank);
  if (!nextRank) return null;
  const pts = progress?.points ?? 0;
  return pts >= SUPPORT_RANK_THRESHOLDS[nextRank] ? nextRank : null;
}

export function getSupportPairProgress(
  supportsMap: Readonly<Record<string, SupportPairProgress>> | undefined,
  actorIdA: string,
  actorIdB: string
): SupportPairProgress {
  const pairDef = getSupportPairDefinition(actorIdA, actorIdB);
  if (!pairDef || !supportsMap) {
    return { points: 0, unlockedRank: null };
  }
  const entry = supportsMap[pairDef.pairKey];
  if (!entry) return { points: 0, unlockedRank: null };
  return {
    points: clampSupportPointsForUnlockedRank(entry.points, entry.unlockedRank, pairDef.maxRank),
    unlockedRank: entry.unlockedRank,
  };
}

export function buildRosterActorLookup(
  save: Pick<SaveData, 'roster' | 'campaign'> | null | undefined
): Map<SupportActorId, OwnedPokemonInstance> {
  const map = new Map<SupportActorId, OwnedPokemonInstance>();
  if (!save) return map;
  for (const unit of save.roster) {
    const actorId = resolveSupportActorIdForRosterUnit(unit, save);
    if (actorId && !map.has(actorId)) {
      map.set(actorId, unit);
    }
  }
  return map;
}

export function unitHasAvailableSupportConversation(
  unit: Pick<OwnedPokemonInstance, 'instanceId' | 'isLord' | 'speciesId'>,
  save: SaveData,
  rosterActors?: ReadonlyMap<SupportActorId, OwnedPokemonInstance>
): boolean {
  const actorId = resolveSupportActorIdForRosterUnit(unit, save);
  if (!actorId) return false;
  const lookup = rosterActors ?? buildRosterActorLookup(save);
  for (const { partnerActorId, pair } of getSupportPartnersForActor(actorId)) {
    if (!lookup.has(partnerActorId)) continue;
    const prog = save.supports[pair.pairKey];
    if (getReadySupportRank(prog, pair.maxRank) !== null) return true;
  }
  return false;
}

export function hasAnyAvailableSupportConversation(save: SaveData | null | undefined): boolean {
  if (!save || !areSupportsUnlockedInCampaign(save)) return false;
  const rosterActors = buildRosterActorLookup(save);
  for (const u of save.roster) {
    if (unitHasAvailableSupportConversation(u, save, rosterActors)) {
      return true;
    }
  }
  return false;
}

export function recordBattleSupportInteraction(
  supportsMap: Record<string, SupportPairProgress>,
  unitA: Pick<SupportBattleUnitLike, 'faction' | 'isLord' | 'speciesId'>,
  unitB: Pick<SupportBattleUnitLike, 'faction' | 'isLord' | 'speciesId'>,
  delta = 1
): { gained: boolean; pairKey: string | null; nextPoints: number } {
  const actorA = resolveSupportActorIdForBattleUnit(unitA);
  const actorB = resolveSupportActorIdForBattleUnit(unitB);
  if (!actorA || !actorB || actorA === actorB || delta <= 0) {
    return { gained: false, pairKey: null, nextPoints: 0 };
  }
  const pairDef = getSupportPairDefinition(actorA, actorB);
  if (!pairDef) {
    return { gained: false, pairKey: null, nextPoints: 0 };
  }
  const prev = supportsMap[pairDef.pairKey] ?? { points: 0, unlockedRank: null };
  const clampedPrev = clampSupportPointsForUnlockedRank(
    prev.points,
    prev.unlockedRank,
    pairDef.maxRank
  );
  const nextPoints = clampSupportPointsForUnlockedRank(
    clampedPrev + delta,
    prev.unlockedRank,
    pairDef.maxRank
  );
  const gained = nextPoints > clampedPrev;
  supportsMap[pairDef.pairKey] = {
    points: nextPoints,
    unlockedRank: prev.unlockedRank,
  };
  return { gained, pairKey: pairDef.pairKey, nextPoints };
}

export function createZeroSupportBonus(): ResolvedSupportStatBonus {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function computeAdjacentSupportSummary(
  unit: Pick<SupportBattleUnitLike, 'id' | 'x' | 'y' | 'faction' | 'isLord' | 'speciesId'>,
  allUnits: ReadonlyArray<SupportBattleUnitLike>,
  supportsMap: Readonly<Record<string, SupportPairProgress>> | undefined,
  posOverride?: { x: number; y: number }
): AdjacentSupportSummary {
  const totalBonus = createZeroSupportBonus();
  const activePartners: ActiveSupportPartnerEntry[] = [];
  const unitActorId = resolveSupportActorIdForBattleUnit(unit);
  if (!unitActorId || !supportsMap) {
    return { totalBonus, activePartners };
  }

  const ux = posOverride?.x ?? unit.x;
  const uy = posOverride?.y ?? unit.y;

  for (const ally of allUnits) {
    if (ally.id === unit.id || ally.defeated || ally.currentHp <= 0) continue;
    if (Math.abs(ux - ally.x) + Math.abs(uy - ally.y) !== 1) continue;
    const allyActorId = resolveSupportActorIdForBattleUnit(ally);
    if (!allyActorId || allyActorId === unitActorId) continue;

    const pairDef = getSupportPairDefinition(unitActorId, allyActorId);
    if (!pairDef) continue;

    const progress = supportsMap[pairDef.pairKey];
    const unlockedRank = progress?.unlockedRank ?? null;
    if (!unlockedRank) continue;

    const allyLineId = getSpeciesById(ally.speciesId)?.lineId;
    const bonus = getLineSupportStatBonus(allyLineId, unlockedRank);
    totalBonus.atk += bonus.atk;
    totalBonus.def += bonus.def;
    totalBonus.spa += bonus.spa;
    totalBonus.spd += bonus.spd;
    totalBonus.spe += bonus.spe;
    activePartners.push({
      unitId: ally.id,
      nickname: ally.nickname,
      speciesId: ally.speciesId,
      rank: unlockedRank,
      bonus,
    });
  }

  return { totalBonus, activePartners };
}

export function compileSupportConversationScript(
  doc: SupportConversationDoc,
  save: SaveData | null
): DialogueScript {
  const sides = resolveBeatSides(doc.beats);
  const lines: DialogueLine[] = [];
  for (const beat of doc.beats) {
    const line = buildBeatDialogueLine({
      beat,
      side: sides.get(beat.id) ?? 'left',
      cast: doc.cast,
      save,
      mainSong: doc.music ?? 'heartwarming',
    });
    if (line) lines.push(line);
  }
  return {
    id: `support_${doc.pairKey}_${doc.rank}`,
    ...(doc.title ? { title: doc.title } : {}),
    bgm: doc.music ?? 'heartwarming',
    restorePreviousBgmOnClose: true,
    lines,
  };
}
