/**
 * Campaign Save State Validator (`saveValidator.ts`)
 *
 * Enforces Rule 4 (one Physical + one Special `[E]` slot, 4-move loadout),
 * Rule 5 (no enemy/ally_npc species in player roster, Lv. 1..40),
 * and Rule 7 (`schemaVersion` & `lastUpdated` UTC timestamp).
 */

import { MAX_UNIT_LEVEL, MIN_UNIT_LEVEL } from '../../data/campaignConfig';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  FLABEBE_FLOWER_COLORS,
  ORICORIO_STYLES,
  QUIZ_SEED_SLOT_KEYS,
  type ItemDefinition,
  type MoveDefinition,
  type PokemonSpeciesDefinition,
  type SaveData,
} from '../schemas';

const VALID_COSMETIC_SET = new Set<string>([
  ...FLABEBE_FLOWER_COLORS,
  ...ORICORIO_STYLES,
]);

export function validateSaveData(
  candidate: unknown,
  speciesById: ReadonlyMap<string, PokemonSpeciesDefinition>,
  movesById: ReadonlyMap<string, MoveDefinition>,
  itemsById: ReadonlyMap<string, ItemDefinition>
): { valid: boolean; errors: string[]; save?: SaveData } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['SaveData must be a non-null object.'] };
  }

  const save = candidate as SaveData;
  if (save.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    errors.push(`Unsupported save schemaVersion "${String(save.schemaVersion)}".`);
  }
  if (typeof save.lastUpdated !== 'number' || !Number.isFinite(save.lastUpdated) || save.lastUpdated <= 0) {
    errors.push('SaveData.lastUpdated must be a positive UTC epoch timestamp (ms).');
  }
  if (typeof save.gold !== 'number' || save.gold < 0) {
    errors.push('SaveData.gold must be >= 0.');
  }
  if (!Array.isArray(save.roster) || save.roster.length === 0) {
    errors.push('SaveData.roster must be a non-empty array.');
  } else {
    const seenIds = new Set<string>();
    for (const unit of save.roster) {
      if (!unit.instanceId || seenIds.has(unit.instanceId)) {
        errors.push(`Duplicate or missing unit instanceId "${String(unit.instanceId)}".`);
      }
      seenIds.add(unit.instanceId);

      const sp = speciesById.get(unit.speciesId);
      if (!sp) {
        errors.push(`Roster unit "${unit.instanceId}" has unknown speciesId "${unit.speciesId}".`);
      } else if (sp.faction === 'enemy' || sp.faction === 'ally_npc') {
        errors.push(
          `Rule 5 violation: Roster unit "${unit.instanceId}" has non-recruitable faction "${sp.faction}" ("${unit.speciesId}").`
        );
      }

      if (!unit.nickname || unit.nickname.trim().length === 0) {
        errors.push(`Roster unit "${unit.instanceId}" must have a non-empty nickname.`);
      }
      if (unit.cosmeticForm !== undefined && !VALID_COSMETIC_SET.has(unit.cosmeticForm)) {
        errors.push(
          `Roster unit "${unit.instanceId}" has invalid cosmeticForm "${String(unit.cosmeticForm)}".`
        );
      }
      if (
        !Number.isInteger(unit.level) ||
        unit.level < MIN_UNIT_LEVEL ||
        unit.level > MAX_UNIT_LEVEL
      ) {
        errors.push(`Roster unit "${unit.instanceId}" level ${unit.level} must be 1..40.`);
      }
      if (!Array.isArray(unit.activeMoveIds) || unit.activeMoveIds.length === 0 || unit.activeMoveIds.length > 4) {
        errors.push(`Roster unit "${unit.instanceId}" must have 1..4 activeMoveIds.`);
      } else {
        for (const mId of unit.activeMoveIds) {
          if (!movesById.has(mId)) {
            errors.push(`Roster unit "${unit.instanceId}" activeMove "${mId}" does not exist.`);
          }
          if (!unit.unlockedMoveIds?.includes(mId)) {
            errors.push(`Roster unit "${unit.instanceId}" activeMove "${mId}" is not in unlockedMoveIds.`);
          }
        }
      }

      const equipChecks: Array<[string | null | undefined, 'Physical' | 'Special']> = [
        [unit.equippedPhysicalMoveId, 'Physical'],
        [unit.equippedSpecialMoveId, 'Special'],
      ];
      for (const [eqId, category] of equipChecks) {
        if (eqId === null) continue;
        if (eqId === undefined) {
          errors.push(`Rule 4 violation: unit "${unit.instanceId}" is missing its ${category} [E] slot.`);
        } else if (!unit.activeMoveIds?.includes(eqId)) {
          errors.push(
            `Rule 4 violation: unit "${unit.instanceId}" ${category} [E] move "${eqId}" is not in activeMoveIds.`
          );
        } else if (movesById.get(eqId)?.category !== category) {
          errors.push(
            `Rule 4 violation: unit "${unit.instanceId}" ${category} [E] slot holds non-${category} move "${eqId}".`
          );
        }
      }

      if (unit.heldItemId !== null && unit.consumableItemId !== null) {
        errors.push(
          `Single-item-slot violation: unit "${unit.instanceId}" cannot equip both heldItemId and consumableItemId.`
        );
      }
      if (unit.heldItemId !== null) {
        const hi = itemsById.get(unit.heldItemId);
        if (!hi || hi.equipSlot !== 'held') {
          errors.push(`Unit "${unit.instanceId}" has invalid heldItemId "${unit.heldItemId}".`);
        }
      }
      if (unit.consumableItemId !== null) {
        const ci = itemsById.get(unit.consumableItemId);
        if (!ci || ci.equipSlot !== 'consumable') {
          errors.push(
            `Unit "${unit.instanceId}" has invalid consumableItemId "${unit.consumableItemId}".`
          );
        }
      }
    }
  }

  if (save.campaign?.quizSeeds !== undefined) {
    if (!save.campaign.quizSeeds || typeof save.campaign.quizSeeds !== 'object') {
      errors.push('SaveData.campaign.quizSeeds must be an object when present.');
    } else {
      for (const slotKey of QUIZ_SEED_SLOT_KEYS) {
        if (!Array.isArray(save.campaign.quizSeeds[slotKey])) {
          errors.push(`SaveData.campaign.quizSeeds.${slotKey} must be an array.`);
        }
      }
    }
  }

  if (Array.isArray(save.convoy)) {
    for (const entry of save.convoy) {
      if (!itemsById.has(entry.itemId) || !Number.isInteger(entry.quantity) || entry.quantity < 1) {
        errors.push(`Invalid convoy entry "${entry.itemId}" (qty ${String(entry.quantity)}).`);
      }
    }
  } else {
    errors.push('SaveData.convoy must be an array.');
  }

  return {
    valid: errors.length === 0,
    errors,
    ...(errors.length === 0 ? { save } : {}),
  };
}
