/**
 * Mystery Emblem - Convoy, Single-Item Equip, Vitamin, TM & Stone/Gem Mutators (`convoyAndItemMutators.ts`)
 */

import { autoEquipNewMoveIfSlotEmpty } from '../data/equippedMoves';
import { ITEM_MAP, SPECIES_MAP } from '../data/index';
import type { OwnedPokemonInstance, SaveData } from '../types/schemas';
import { getUnitEquippedItemId, returnItemToConvoyList } from './saveHelpersAndFactory';

export function mutateAddConvoyItem(save: SaveData, itemId: string, quantity = 1): void {
  if (!ITEM_MAP.has(itemId) || quantity < 1) {
    throw new Error(`Invalid item "${itemId}" or quantity ${quantity}.`);
  }
  const existing = save.convoy.find((c) => c.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else save.convoy.push({ itemId, quantity });
}

export function mutateEquipItemToUnit(
  save: SaveData,
  instanceId: string,
  itemId: string | null,
  sourceUnitInstanceId?: string
): { unit: OwnedPokemonInstance; mutated: boolean } {
  const targetUnit = save.roster.find((u) => u.instanceId === instanceId);
  if (!targetUnit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);

  const prevItemId = getUnitEquippedItemId(targetUnit);

  if (itemId === null) {
    if (prevItemId !== null) {
      returnItemToConvoyList(save.convoy, prevItemId);
      targetUnit.heldItemId = null;
      targetUnit.consumableItemId = null;
      return { unit: targetUnit, mutated: true };
    }
    return { unit: targetUnit, mutated: false };
  }

  const item = ITEM_MAP.get(itemId);
  if (!item) throw new Error(`Unknown item "${itemId}".`);
  if (item.equipSlot !== 'held' && item.equipSlot !== 'consumable') {
    throw new Error(`${item.name} cannot be equipped into a unit's battle item slot.`);
  }

  if (prevItemId === itemId && (!sourceUnitInstanceId || sourceUnitInstanceId === instanceId)) {
    return { unit: targetUnit, mutated: false };
  }

  if (sourceUnitInstanceId && sourceUnitInstanceId !== instanceId) {
    const sourceUnit = save.roster.find((u) => u.instanceId === sourceUnitInstanceId);
    if (!sourceUnit || getUnitEquippedItemId(sourceUnit) !== itemId) {
      throw new Error(`Source unit does not currently hold ${item.name}.`);
    }
    sourceUnit.heldItemId = null;
    sourceUnit.consumableItemId = null;
    if (prevItemId !== null) returnItemToConvoyList(save.convoy, prevItemId);
  } else {
    const convoySlot = save.convoy.find((c) => c.itemId === itemId);
    if (!convoySlot || convoySlot.quantity < 1) {
      throw new Error(`${item.name} is not available in the Bag.`);
    }
    convoySlot.quantity -= 1;
    if (convoySlot.quantity <= 0) {
      save.convoy = save.convoy.filter((c) => c.itemId !== itemId);
    }
    if (prevItemId !== null) returnItemToConvoyList(save.convoy, prevItemId);
  }

  if (item.equipSlot === 'held') {
    targetUnit.heldItemId = item.id;
    targetUnit.consumableItemId = null;
  } else {
    targetUnit.consumableItemId = item.id;
    targetUnit.heldItemId = null;
  }

  return { unit: targetUnit, mutated: true };
}

export function mutateUseVitaminOnUnit(
  save: SaveData,
  instanceId: string,
  vitaminItemId: string,
  targetMoveId?: string
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const item = ITEM_MAP.get(vitaminItemId);
  if (!item || item.category !== 'vitamin') {
    throw new Error(`"${vitaminItemId}" is not a valid Vitamin.`);
  }
  const convoySlot = save.convoy.find((c) => c.itemId === vitaminItemId);
  if (!convoySlot || convoySlot.quantity < 1) {
    throw new Error(`${item.name} is not in the Bag.`);
  }

  if (item.effect.permanentPpBoost) {
    const moveId = targetMoveId ?? unit.activeMoveIds[0];
    if (!moveId || !unit.unlockedMoveIds.includes(moveId)) {
      throw new Error(`Select a known move to apply ${item.name}.`);
    }
    unit.bonusPpByMoveId[moveId] =
      (unit.bonusPpByMoveId[moveId] ?? 0) + item.effect.permanentPpBoost;
  } else if (item.effect.permanentStatBoost) {
    const b = item.effect.permanentStatBoost;
    if (b.hp) unit.currentStats.hp += b.hp;
    if (b.atk) unit.currentStats.atk += b.atk;
    if (b.def) unit.currentStats.def += b.def;
    if (b.spa) unit.currentStats.spa += b.spa;
    if (b.spd) unit.currentStats.spd += b.spd;
    if (b.spe) unit.currentStats.spe += b.spe;
  }

  convoySlot.quantity -= 1;
  if (convoySlot.quantity <= 0) {
    save.convoy = save.convoy.filter((c) => c.itemId !== vitaminItemId);
  }
  return unit;
}

export function mutateTeachTmMove(
  save: SaveData,
  instanceId: string,
  tmItemId: string
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found.`);

  const tmItem = ITEM_MAP.get(tmItemId);
  if (!tmItem || tmItem.category !== 'tm' || !tmItem.effect.teachesMoveId) {
    throw new Error(`"${tmItemId}" is not a valid Technical Machine.`);
  }

  const sp = SPECIES_MAP.get(unit.speciesId);
  if (!sp || !sp.compatibleTmIds.includes(tmItemId)) {
    throw new Error(`${unit.nickname} (${sp?.name ?? unit.speciesId}) is not compatible with ${tmItem.name}.`);
  }

  const moveId = tmItem.effect.teachesMoveId;
  if (unit.unlockedMoveIds.includes(moveId)) {
    throw new Error(`${unit.nickname} already knows that move.`);
  }

  const convoySlot = save.convoy.find((c) => c.itemId === tmItemId);
  if (!convoySlot || convoySlot.quantity < 1) {
    throw new Error(`${tmItem.name} is not in the Convoy.`);
  }

  convoySlot.quantity -= 1;
  if (convoySlot.quantity <= 0) {
    save.convoy = save.convoy.filter((c) => c.itemId !== tmItemId);
  }

  unit.unlockedMoveIds.push(moveId);
  if (unit.activeMoveIds.length < 4) {
    unit.activeMoveIds.push(moveId);
    autoEquipNewMoveIfSlotEmpty(unit, moveId);
  }

  return unit;
}

export function mutateUseEvolutionItemOnUnit(
  save: SaveData,
  instanceId: string,
  itemId: 'evolution_stone' | 'evolution_gem',
  targetSpeciesId?: string
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const currentSp = SPECIES_MAP.get(unit.speciesId);
  if (!currentSp) throw new Error(`Unknown species "${unit.speciesId}".`);

  const matchingBranches = currentSp.evolutions.filter((b) => b.requiredItemId === itemId);
  if (matchingBranches.length === 0) {
    throw new Error(`${unit.nickname} (${currentSp.name}) cannot promote with ${ITEM_MAP.get(itemId)?.name ?? itemId}.`);
  }

  const chosenBranch = targetSpeciesId
    ? matchingBranches.find((b) => b.targetSpeciesId === targetSpeciesId)
    : matchingBranches[0];
  if (!chosenBranch) {
    throw new Error(`Invalid promotion target "${targetSpeciesId ?? ''}" for ${currentSp.name}.`);
  }

  if (unit.level < chosenBranch.minLevel) {
    throw new Error(
      `${unit.nickname} must reach Lv. ${chosenBranch.minLevel} to use ${ITEM_MAP.get(itemId)?.name ?? itemId} (currently Lv. ${unit.level}).`
    );
  }

  if (unit.consumableItemId === itemId) {
    unit.consumableItemId = null;
  } else {
    const convoySlot = save.convoy.find((c) => c.itemId === itemId);
    if (!convoySlot || convoySlot.quantity < 1) {
      throw new Error(`${ITEM_MAP.get(itemId)?.name ?? itemId} is not in the Bag.`);
    }
    convoySlot.quantity -= 1;
    if (convoySlot.quantity <= 0) {
      save.convoy = save.convoy.filter((c) => c.itemId !== itemId);
    }
  }

  const targetSp = SPECIES_MAP.get(chosenBranch.targetSpeciesId)!;
  unit.currentStats.hp += chosenBranch.promotionBonuses.hp;
  unit.currentStats.atk += chosenBranch.promotionBonuses.atk;
  unit.currentStats.def += chosenBranch.promotionBonuses.def;
  unit.currentStats.spa += chosenBranch.promotionBonuses.spa;
  unit.currentStats.spd += chosenBranch.promotionBonuses.spd;
  unit.currentStats.spe += chosenBranch.promotionBonuses.spe;
  unit.currentStats.mov = targetSp.baseStats.mov;

  if (unit.nickname === currentSp.name) unit.nickname = targetSp.name;
  unit.speciesId = targetSp.id;

  for (const entry of targetSp.learnset) {
    if (entry.level <= unit.level && !unit.unlockedMoveIds.includes(entry.moveId)) {
      unit.unlockedMoveIds.push(entry.moveId);
      if (unit.activeMoveIds.length < 4) {
        unit.activeMoveIds.push(entry.moveId);
        autoEquipNewMoveIfSlotEmpty(unit, entry.moveId);
      }
    }
  }

  return unit;
}
