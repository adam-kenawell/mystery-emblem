/**
 * Mystery Emblem — Support Matrix & Atomic Post-Battle Save Commit Mutators (`battleCommitMutators.ts`)
 */

import { MAX_UNIT_LEVEL, MIN_UNIT_LEVEL } from '../data/campaignConfig';
import { reconcileEquippedMoves, type EquippedMoveSlots } from '../data/equippedMoves';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import type {
  ConvoyEntry,
  SaveData,
  StatBlockSeven,
  SupportPairProgress,
  UnitCosmeticForm,
} from '../types/schemas';
import {
  computeSupportLevel,
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
}

export function mutateAddSupportPoints(
  save: SaveData,
  instanceIdA: string,
  instanceIdB: string,
  delta = 1
): SupportPairProgress {
  const pairKey = makeSupportPairKey(instanceIdA, instanceIdB);
  const prev = save.supports[pairKey]?.points ?? 0;
  const points = Math.max(0, prev + delta);
  const progress: SupportPairProgress = { points, level: computeSupportLevel(points) };
  save.supports[pairKey] = progress;
  return { ...progress };
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
}
