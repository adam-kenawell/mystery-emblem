/**
 * Mystery Emblem — Save Constants, Legacy Migration Sanitizer & Pokemon Instance Factory
 */

import {
  createDefaultQuizSeeds,
  MAX_UNIT_LEVEL,
  MIN_UNIT_LEVEL,
} from '../data/campaignConfig';
import { buildEquippedSlotsFromSeed } from '../data/equippedMoves';
import { ITEM_MAP, SPECIES_MAP } from '../data/index';
import { computeManualScaledStatsForJoinLevel } from '../engine/progressionEngine';
import {
  QUIZ_SEED_SLOT_KEYS,
  type OwnedPokemonInstance,
  type SaveData,
  type StatBlockSeven,
  type SupportLevel,
  type UnitCosmeticForm,
} from '../types/schemas';
import type { CloudUser } from './firebaseSync';

export const SAVE_STORAGE_KEY = 'mystery_emblem_save_v2';
export const LEGACY_SAVE_STORAGE_KEY = 'mystery_emblem_save_v1';
export const META_STORAGE_KEY = 'mystery_emblem_meta_v1';
export const ACTIVE_SLOT_STORAGE_KEY = 'mystery_emblem_active_slot_v1';
export const SAVE_SLOT_COUNT = 3;
export const SAVE_SLOT_INDICES: readonly number[] = [1, 2, 3];

/** Slot 1 keeps the pre-slot key so existing single-file saves become Slot 1 with no migration. */
export function getSaveSlotStorageKey(slot: number): string {
  return slot === 1 ? SAVE_STORAGE_KEY : `${SAVE_STORAGE_KEY}_slot${slot}`;
}

export function normalizeSaveSlot(slot: unknown): number {
  const n = Math.floor(Number(slot));
  return n >= 1 && n <= SAVE_SLOT_COUNT ? n : 1;
}

export const SUPPORT_LEVEL_THRESHOLDS: readonly [number, number, number, number, number] = [
  5, 12, 22, 35, 50,
];

export type CloudSyncResolution =
  | 'unauthenticated'
  | 'empty'
  | 'already_in_sync'
  | 'pulled_newer_cloud'
  | 'pushed_newer_local'
  | 'cloud_error';

export interface SyncStatusSnapshot {
  isFirebaseConfigured: boolean;
  user: CloudUser | null;
  lastResolution: CloudSyncResolution | null;
  lastSyncedAt: number | null;
  errorMessage: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getDefaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

export function generateSaveId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeSupportPairKey(instanceIdA: string, instanceIdB: string): string {
  if (instanceIdA === instanceIdB) {
    throw new Error('Cannot compute Support pair key between a unit and itself.');
  }
  return instanceIdA < instanceIdB
    ? `${instanceIdA}::${instanceIdB}`
    : `${instanceIdB}::${instanceIdA}`;
}

export function computeSupportLevel(points: number): SupportLevel {
  if (points >= SUPPORT_LEVEL_THRESHOLDS[4]) return 5;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[3]) return 4;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[2]) return 3;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[1]) return 2;
  if (points >= SUPPORT_LEVEL_THRESHOLDS[0]) return 1;
  return 0;
}

export function sanitizeNickname(rawNickname: string | undefined, fallbackSpeciesName: string): string {
  const trimmed = (rawNickname ?? '').trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : fallbackSpeciesName;
}

export function getUnitEquippedItemId(
  unit: Pick<OwnedPokemonInstance, 'heldItemId' | 'consumableItemId'>
): string | null {
  return unit.heldItemId ?? unit.consumableItemId ?? null;
}

export function returnItemToConvoyList(
  convoy: Array<{ itemId: string; quantity: number }>,
  itemId: string
): void {
  if (!ITEM_MAP.has(itemId)) return;
  const existing = convoy.find((c) => c.itemId === itemId);
  if (existing) existing.quantity += 1;
  else convoy.push({ itemId, quantity: 1 });
}

export function normalizeLegacySingleItemSlots(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const obj = candidate as Partial<SaveData> & {
    campaign?: Partial<SaveData['campaign']> & { quizSeeds?: Record<string, unknown> };
  };
  if (!Array.isArray(obj.roster) || !Array.isArray(obj.convoy)) return candidate;

  const rawSeeds = obj.campaign?.quizSeeds;
  const needsSeedHydration =
    Boolean(rawSeeds && typeof rawSeeds === 'object') &&
    QUIZ_SEED_SLOT_KEYS.some((k) => !Array.isArray(rawSeeds?.[k]));
  const needsItemNormalize = obj.roster.some(
    (unit) => Boolean(unit && unit.heldItemId !== null && unit.consumableItemId !== null)
  );
  const needsDualEquipMigration = obj.roster.some(
    (unit) => Boolean(unit && unit.equippedPhysicalMoveId === undefined)
  );
  if (!needsItemNormalize && !needsSeedHydration && !needsDualEquipMigration) return candidate;

  const cloned = JSON.parse(JSON.stringify(obj)) as SaveData;
  if (needsDualEquipMigration) {
    // Pre-dual-[E] saves stored one `equippedMoveId`; slot it by category and auto-fill the other.
    for (const unit of cloned.roster) {
      if (!unit || unit.equippedPhysicalMoveId !== undefined) continue;
      const legacy = unit as typeof unit & { equippedMoveId?: string | null };
      const migrated = buildEquippedSlotsFromSeed(
        Array.isArray(unit.activeMoveIds) ? unit.activeMoveIds : [],
        legacy.equippedMoveId
      );
      delete legacy.equippedMoveId;
      unit.equippedPhysicalMoveId = migrated.equippedPhysicalMoveId;
      unit.equippedSpecialMoveId = migrated.equippedSpecialMoveId;
    }
  }
  if (needsItemNormalize) {
    for (const unit of cloned.roster) {
      if (unit.heldItemId !== null && unit.consumableItemId !== null) {
        returnItemToConvoyList(cloned.convoy, unit.consumableItemId);
        unit.consumableItemId = null;
      }
    }
  }
  if (needsSeedHydration && cloned.campaign) {
    const legacy = (rawSeeds ?? {}) as Record<string, string[] | undefined>;
    cloned.campaign.quizSeeds = createDefaultQuizSeeds({
      slot1Flying: Array.isArray(legacy.slot1Flying)
        ? legacy.slot1Flying
        : legacy.q2BugFlying?.filter((id) => SPECIES_MAP.has(id) && id !== 'sewaddle'),
      slot2Psychic: Array.isArray(legacy.slot2Psychic)
        ? legacy.slot2Psychic
        : legacy.q3GhostPsychic?.filter((id) => SPECIES_MAP.has(id) && id !== 'duskull'),
      slot3Electric: Array.isArray(legacy.slot3Electric)
        ? legacy.slot3Electric
        : legacy.q4Electric?.filter((id) => SPECIES_MAP.has(id)),
      slot4Rock: Array.isArray(legacy.slot4Rock) ? legacy.slot4Rock : undefined,
      slot5Fire: Array.isArray(legacy.slot5Fire) ? legacy.slot5Fire : undefined,
      slot6Grass: Array.isArray(legacy.slot6Grass) ? legacy.slot6Grass : undefined,
      slot7Fairy: Array.isArray(legacy.slot7Fairy) ? legacy.slot7Fairy : undefined,
      slot8Ice: Array.isArray(legacy.slot8Ice)
        ? legacy.slot8Ice
        : legacy.q9IceArmored?.filter((id) => SPECIES_MAP.has(id)),
    });
  }
  return cloned;
}

export interface CreatePokemonOptions {
  speciesId: string;
  nickname?: string;
  cosmeticForm?: UnitCosmeticForm;
  level?: number;
  scaleStatsToLevel?: boolean;
  isLord?: boolean;
  heldItemId?: string | null;
  consumableItemId?: string | null;
}

export function createPokemonInstance(opts: CreatePokemonOptions): OwnedPokemonInstance {
  const sp = SPECIES_MAP.get(opts.speciesId);
  if (!sp) throw new Error(`Unknown Pokémon speciesId "${opts.speciesId}".`);
  if (sp.faction === 'enemy' || sp.faction === 'ally_npc') {
    throw new Error(
      `Rule 5 violation: Non-recruitable Pokémon "${sp.name}" (${sp.faction}) cannot be instantiated for the player roster.`
    );
  }

  const level = Math.max(
    MIN_UNIT_LEVEL,
    Math.min(MAX_UNIT_LEVEL, Math.floor(opts.level ?? sp.defaultJoinLevel))
  );
  const unlockedMoveIds: string[] = [];
  for (const entry of sp.learnset) {
    if (entry.level <= level && !unlockedMoveIds.includes(entry.moveId)) {
      unlockedMoveIds.push(entry.moveId);
    }
  }
  if (unlockedMoveIds.length === 0 && sp.learnset[0]) {
    unlockedMoveIds.push(sp.learnset[0].moveId);
  }

  const activeMoveIds = unlockedMoveIds.slice(-4);
  const equippedSlots = buildEquippedSlotsFromSeed(activeMoveIds, undefined);

  if (opts.heldItemId && opts.consumableItemId) {
    throw new Error(
      `Unit "${sp.name}" cannot start with both heldItemId ("${opts.heldItemId}") and consumableItemId ("${opts.consumableItemId}") — each unit has 1 item slot.`
    );
  }

  const initialStats: StatBlockSeven = opts.scaleStatsToLevel
    ? computeManualScaledStatsForJoinLevel(sp, level)
    : { ...sp.baseStats };

  return {
    instanceId: generateSaveId('unit'),
    speciesId: sp.id,
    nickname: sanitizeNickname(opts.nickname, sp.name),
    ...(opts.cosmeticForm ? { cosmeticForm: opts.cosmeticForm } : {}),
    isLord: Boolean(opts.isLord),
    level,
    exp: 0,
    currentStats: initialStats,
    bonusPpByMoveId: {},
    unlockedMoveIds,
    activeMoveIds,
    ...equippedSlots,
    heldItemId: opts.heldItemId ?? null,
    consumableItemId: opts.consumableItemId ?? null,
  };
}
