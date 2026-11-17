/**
 * Mystery Emblem - Support Matrix & Atomic Post-Battle Save Commit Mutators (`battleCommitMutators.ts`)
 */

import { MAX_UNIT_LEVEL, MIN_UNIT_LEVEL } from '../data/campaignConfig';
import { reconcileEquippedMoves, type EquippedMoveSlots } from '../data/equippedMoves';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import {
  SUPPORT_PAIR_DEFINITIONS,
  SUPPORT_RANK_THRESHOLDS,
  SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID,
  clampSupportPointsForUnlockedRank,
  getMaxSupportRank,
  getNextSupportRank,
  getSupportPairDefinition,
  getSupportRankIndex,
} from '../data/supports/supportMatrix';
import { buildRosterActorLookup, resolveSupportActorIdForRosterUnit } from '../engine/supportEngine';
import type {
  ConvoyEntry,
  SaveData,
  StatBlockSeven,
  SupportPairProgress,
  SupportRank,
  UnitCosmeticForm,
} from '../types/schemas';
import {
  makeSupportPairKey,
  returnItemToConvoyList,
  sanitizeNickname,
} from './saveHelpersAndFactory';

export interface BattleUnitSaveSyncEntry extends EquippedMoveSlots {
  instanceId: string;
  speciesId: string;
  nickname: string;
  cosmeticForm?: UnitCosmeticForm;
  level: number;
  exp: number;
  currentStats: StatBlockSeven;
  unlockedMoveIds: string[];
  activeMoveIds: string[];
  heldItemId: string | null;
  consumableItemId: string | null;
}

export interface CommitBattleResultsPayload {
  deployedUnits: ReadonlyArray<BattleUnitSaveSyncEntry>;
  droppedItemIds?: ReadonlyArray<string>;
  clearRewardItems?: ReadonlyArray<ConvoyEntry>;
  bonusGold?: number;
  battleSupports?: Readonly<Record<string, SupportPairProgress>>;
}

function resolveActorIdInput(save: SaveData, idOrActor: string): string {
  const unit = save.roster.find((u) => u.instanceId === idOrActor);
  if (!unit) return idOrActor;
  return resolveSupportActorIdForRosterUnit(unit, save) ?? idOrActor;
}

export function mutateAddSupportPoints(
  save: SaveData,
  instanceIdOrActorA: string,
  instanceIdOrActorB: string,
  delta = 1
): SupportPairProgress {
  const actorA = resolveActorIdInput(save, instanceIdOrActorA);
  const actorB = resolveActorIdInput(save, instanceIdOrActorB);
  const pairDef = getSupportPairDefinition(actorA, actorB);
  const pairKey = pairDef?.pairKey ?? makeSupportPairKey(actorA, actorB);
  const prev = save.supports[pairKey] ?? { points: 0, unlockedRank: null };
  const rawPoints = Math.max(0, prev.points + delta);
  const points = pairDef
    ? clampSupportPointsForUnlockedRank(rawPoints, prev.unlockedRank, pairDef.maxRank)
    : rawPoints;
  const progress: SupportPairProgress = { points, unlockedRank: prev.unlockedRank ?? null };
  save.supports[pairKey] = progress;
  return { ...progress };
}

export function mutateUnlockSupportRank(
  save: SaveData,
  actorIdA: string,
  actorIdB: string,
  rank: SupportRank
): SupportPairProgress {
  const actorA = resolveActorIdInput(save, actorIdA);
  const actorB = resolveActorIdInput(save, actorIdB);
  const pairDef = getSupportPairDefinition(actorA, actorB);
  if (!pairDef) {
    throw new Error(`No Support pairing defined between "${actorA}" and "${actorB}".`);
  }
  if (getSupportRankIndex(rank) > getSupportRankIndex(pairDef.maxRank)) {
    throw new Error(`Support rank "${rank}" exceeds max rank "${pairDef.maxRank}" for "${pairDef.pairKey}".`);
  }
  const prev = save.supports[pairDef.pairKey] ?? { points: 0, unlockedRank: null };
  const unlockedRank = getMaxSupportRank(prev.unlockedRank ?? null, rank) ?? rank;
  const points = clampSupportPointsForUnlockedRank(
    Math.max(prev.points, SUPPORT_RANK_THRESHOLDS[rank]),
    unlockedRank,
    pairDef.maxRank
  );
  const progress: SupportPairProgress = { points, unlockedRank };
  save.supports[pairDef.pairKey] = progress;
  return { ...progress };
}

export function mutateReadyNextSupportRanksForCheat(
  save: SaveData,
  filterActorId?: string
): number {
  if (!save.campaign.completedChapterIds.includes(SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID)) {
    save.campaign.completedChapterIds.push(SUPPORT_UNLOCK_REQUIRED_CHAPTER_ID);
  }
  const rosterActors = buildRosterActorLookup(save);
  let readied = 0;
  for (const def of SUPPORT_PAIR_DEFINITIONS) {
    if (!rosterActors.has(def.actorA) || !rosterActors.has(def.actorB)) continue;
    if (filterActorId && def.actorA !== filterActorId && def.actorB !== filterActorId) continue;
    const prev = save.supports[def.pairKey] ?? { points: 0, unlockedRank: null };
    const nextRank = getNextSupportRank(prev.unlockedRank ?? null, def.maxRank);
    if (!nextRank) continue;
    const targetPts = SUPPORT_RANK_THRESHOLDS[nextRank];
    const nextPts = clampSupportPointsForUnlockedRank(
      Math.max(prev.points, targetPts),
      prev.unlockedRank ?? null,
      def.maxRank
    );
    save.supports[def.pairKey] = {
      points: nextPts,
      unlockedRank: prev.unlockedRank ?? null,
    };
    readied += 1;
  }
  return readied;
}

export function mutateCommitBattleResults(
  save: SaveData,
  payload: CommitBattleResultsPayload
): void {
  const byId = new Map(save.roster.map((u) => [u.instanceId, u]));

  for (const syncUnit of payload.deployedUnits) {
    const owned = byId.get(syncUnit.instanceId);
    if (!owned) continue;
    const sp = SPECIES_MAP.get(syncUnit.speciesId);
    if (!sp || sp.faction === 'enemy' || sp.faction === 'ally_npc') continue;

    owned.speciesId = sp.id;
    owned.nickname = sanitizeNickname(syncUnit.nickname, sp.name);
    if (syncUnit.cosmeticForm !== undefined) {
      owned.cosmeticForm = syncUnit.cosmeticForm;
    }
    owned.level = Math.max(MIN_UNIT_LEVEL, Math.min(MAX_UNIT_LEVEL, Math.floor(syncUnit.level)));
    owned.exp = owned.level >= MAX_UNIT_LEVEL ? 0 : Math.max(0, Math.min(99, Math.floor(syncUnit.exp)));
    owned.currentStats = { ...syncUnit.currentStats };

    for (const mId of syncUnit.unlockedMoveIds) {
      if (MOVE_MAP.has(mId) && !owned.unlockedMoveIds.includes(mId)) {
        owned.unlockedMoveIds.push(mId);
      }
    }

    const validActive = syncUnit.activeMoveIds
      .filter((mId) => MOVE_MAP.has(mId) && owned.unlockedMoveIds.includes(mId))
      .slice(0, 4);
    if (validActive.length > 0) owned.activeMoveIds = validActive;

    owned.equippedPhysicalMoveId = syncUnit.equippedPhysicalMoveId;
    owned.equippedSpecialMoveId = syncUnit.equippedSpecialMoveId;
    reconcileEquippedMoves(owned, owned.activeMoveIds, { fillEmpty: false });

    if (syncUnit.heldItemId && ITEM_MAP.get(syncUnit.heldItemId)?.equipSlot === 'held') {
      owned.heldItemId = syncUnit.heldItemId;
      owned.consumableItemId = null;
    } else if (
      syncUnit.consumableItemId &&
      ITEM_MAP.get(syncUnit.consumableItemId)?.equipSlot === 'consumable'
    ) {
      owned.consumableItemId = syncUnit.consumableItemId;
      owned.heldItemId = null;
    } else {
      owned.heldItemId = null;
      owned.consumableItemId = null;
    }
  }

  if (payload.droppedItemIds) {
    for (const itemId of payload.droppedItemIds) {
      if (ITEM_MAP.has(itemId)) returnItemToConvoyList(save.convoy, itemId);
    }
  }

  if (payload.clearRewardItems) {
    for (const reward of payload.clearRewardItems) {
      if (ITEM_MAP.has(reward.itemId) && reward.quantity > 0) {
        for (let i = 0; i < reward.quantity; i++) {
          returnItemToConvoyList(save.convoy, reward.itemId);
        }
      }
    }
  }

  if (payload.bonusGold && payload.bonusGold > 0) {
    save.gold = Math.max(0, Math.floor(save.gold + payload.bonusGold));
  }

  if (payload.battleSupports) {
    for (const [pairKey, battleEntry] of Object.entries(payload.battleSupports)) {
      if (!battleEntry) continue;
      const parts = pairKey.split('::');
      if (parts.length !== 2) continue;
      const pairDef = getSupportPairDefinition(parts[0], parts[1]);
      if (!pairDef) continue;
      const existing = save.supports[pairDef.pairKey] ?? { points: 0, unlockedRank: null };
      const unlockedRank = getMaxSupportRank(
        existing.unlockedRank ?? null,
        battleEntry.unlockedRank ?? null
      );
      const points = clampSupportPointsForUnlockedRank(
        Math.max(existing.points, battleEntry.points ?? 0),
        unlockedRank,
        pairDef.maxRank
      );
      save.supports[pairDef.pairKey] = { points, unlockedRank };
    }
  }
}
