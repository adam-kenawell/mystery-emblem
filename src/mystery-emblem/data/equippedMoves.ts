/**
 * Dual [E] Equipped Move Slots (`equippedMoves.ts`)
 *
 * Each unit equips up to one Physical (Range 1) and one Special (Range 2) move for Enemy Phase
 * counters. Because the categories never share a range, the attacker's distance alone decides
 * which equipped move counters. A slot may be `null` (deliberately unequipped).
 */

import type { MoveCategory } from '../types/schemas';
import { getMoveById } from './index';

export type EquipCategory = 'Physical' | 'Special';

export const EQUIP_CATEGORIES: ReadonlyArray<EquipCategory> = ['Physical', 'Special'];

export interface EquippedMoveSlots {
  equippedPhysicalMoveId: string | null;
  equippedSpecialMoveId: string | null;
}

export function isEquipCategory(category: MoveCategory | string | undefined): category is EquipCategory {
  return category === 'Physical' || category === 'Special';
}

export function getMoveEquipCategory(moveId: string | null | undefined): EquipCategory | null {
  if (!moveId) return null;
  const category = getMoveById(moveId)?.category;
  return isEquipCategory(category) ? category : null;
}

function slotKey(category: EquipCategory): keyof EquippedMoveSlots {
  return category === 'Physical' ? 'equippedPhysicalMoveId' : 'equippedSpecialMoveId';
}

export function getEquippedMoveIdForCategory(
  unit: EquippedMoveSlots,
  category: EquipCategory
): string | null {
  return unit[slotKey(category)];
}

export function setEquippedMoveIdForCategory(
  unit: EquippedMoveSlots,
  category: EquipCategory,
  moveId: string | null
): void {
  unit[slotKey(category)] = moveId;
}

export function getEquippedMoveIds(unit: EquippedMoveSlots): string[] {
  return [unit.equippedPhysicalMoveId, unit.equippedSpecialMoveId].filter(
    (id): id is string => Boolean(id)
  );
}

export function isMoveEquipped(unit: EquippedMoveSlots, moveId: string | null | undefined): boolean {
  return Boolean(
    moveId && (unit.equippedPhysicalMoveId === moveId || unit.equippedSpecialMoveId === moveId)
  );
}

/** Equips `moveId` into the slot matching its category. No-op for Support/Heal moves. */
export function equipMoveInItsSlot(unit: EquippedMoveSlots, moveId: string): void {
  const category = getMoveEquipCategory(moveId);
  if (category) setEquippedMoveIdForCategory(unit, category, moveId);
}

/**
 * Validates both slots against `moveIds` (clearing slots whose move left the loadout or has the
 * wrong category). When `fillEmpty` is set, empty slots take the first matching move.
 */
export function reconcileEquippedMoves(
  unit: EquippedMoveSlots,
  moveIds: ReadonlyArray<string>,
  opts: { fillEmpty: boolean }
): void {
  for (const category of EQUIP_CATEGORIES) {
    const current = getEquippedMoveIdForCategory(unit, category);
    if (current && (!moveIds.includes(current) || getMoveEquipCategory(current) !== category)) {
      setEquippedMoveIdForCategory(unit, category, null);
    }
    if (opts.fillEmpty && !getEquippedMoveIdForCategory(unit, category)) {
      const first = moveIds.find((id) => getMoveEquipCategory(id) === category) ?? null;
      setEquippedMoveIdForCategory(unit, category, first);
    }
  }
}

/** Fills only the slot of a newly learned/added move if that slot is currently empty. */
export function autoEquipNewMoveIfSlotEmpty(unit: EquippedMoveSlots, moveId: string): void {
  const category = getMoveEquipCategory(moveId);
  if (category && !getEquippedMoveIdForCategory(unit, category)) {
    setEquippedMoveIdForCategory(unit, category, moveId);
  }
}

/**
 * Builds both slots from a single legacy/seed `equippedMoveId` (old saves, chapter JSON spawns,
 * skirmish templates): the seed fills its own category, the other slot auto-fills.
 */
export function buildEquippedSlotsFromSeed(
  moveIds: ReadonlyArray<string>,
  seedId: string | null | undefined
): EquippedMoveSlots {
  const slots: EquippedMoveSlots = { equippedPhysicalMoveId: null, equippedSpecialMoveId: null };
  if (seedId && moveIds.includes(seedId)) equipMoveInItsSlot(slots, seedId);
  reconcileEquippedMoves(slots, moveIds, { fillEmpty: true });
  return slots;
}
