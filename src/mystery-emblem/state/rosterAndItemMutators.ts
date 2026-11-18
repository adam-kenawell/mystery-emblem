/**
 * Mystery Emblem - Roster, Loadout, Evolution, Convoy & Item Mutators (`rosterAndItemMutators.ts`)
 */

import { getFlabebeFlowerColorForLord } from '../assets/pmdAssetLoader';
import {
  MAX_UNIT_LEVEL,
  MIN_UNIT_LEVEL,
} from '../data/campaignConfig';
import {
  autoEquipNewMoveIfSlotEmpty,
  reconcileEquippedMoves,
  setEquippedMoveIdForCategory,
  type EquipCategory,
} from '../data/equippedMoves';
import { ITEM_MAP, MOVE_MAP, SPECIES_MAP } from '../data/index';
import { computeManualScaledStatsForJoinLevel } from '../engine/progressionEngine';
import type {
  EvolutionBranch,
  OwnedPokemonInstance,
  PokemonSpeciesDefinition,
  SaveData,
} from '../types/schemas';
import {
  createPokemonInstance,
  getUnitEquippedItemId,
  returnItemToConvoyList,
  type CreatePokemonOptions,
} from './saveHelpersAndFactory';

function findForwardEvolutionPath(
  fromSp: PokemonSpeciesDefinition,
  targetSpeciesId: string,
  visited = new Set<string>()
): EvolutionBranch[] | null {
  if (visited.has(fromSp.id)) return null;
  visited.add(fromSp.id);
  for (const branch of fromSp.evolutions) {
    if (branch.targetSpeciesId === targetSpeciesId) {
      return [branch];
    }
    const nextSp = SPECIES_MAP.get(branch.targetSpeciesId);
    if (nextSp) {
      const rest = findForwardEvolutionPath(nextSp, targetSpeciesId, new Set(visited));
      if (rest) {
        return [branch, ...rest];
      }
    }
  }
  return null;
}

function applyEvolutionLearnsetAndMoveCap(
  unit: OwnedPokemonInstance,
  targetSp: PokemonSpeciesDefinition
): void {
  unit.currentStats.mov = targetSp.baseStats.mov;
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
  reconcileEquippedMoves(unit, unit.activeMoveIds, { fillEmpty: false });
}

function consumeConvoyItem(save: SaveData, itemId: string, errorName: string): void {
  const convoySlot = save.convoy.find((c) => c.itemId === itemId);
  if (!convoySlot || convoySlot.quantity < 1) {
    throw new Error(`${errorName} is not in the Bag.`);
  }
  convoySlot.quantity -= 1;
  if (convoySlot.quantity <= 0) {
    save.convoy = save.convoy.filter((c) => c.itemId !== itemId);
  }
}

export function mutateEvolveUnitToSpecies(
  save: SaveData,
  instanceId: string,
  targetSpeciesId: string
): { unit: OwnedPokemonInstance; mutated: boolean } {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);

  const currentSp = SPECIES_MAP.get(unit.speciesId);
  const targetSp = SPECIES_MAP.get(targetSpeciesId);
  if (!currentSp || !targetSp) {
    throw new Error(`Unknown species transition "${unit.speciesId}" -> "${targetSpeciesId}".`);
  }
  if (targetSp.faction === 'enemy' || targetSp.faction === 'ally_npc') {
    throw new Error(`Rule 5 violation: Cannot evolve player unit into enemy-only species "${targetSp.name}".`);
  }
  if (currentSp.lineId !== targetSp.lineId) {
    throw new Error(
      `Invalid evolution line mismatch: "${currentSp.id}" (${currentSp.lineId}) cannot become "${targetSp.id}" (${targetSp.lineId}).`
    );
  }
  if (unit.speciesId === targetSp.id) {
    return { unit, mutated: false };
  }

  const forwardPath = findForwardEvolutionPath(currentSp, targetSp.id);
  if (forwardPath && forwardPath.length > 0) {
    for (const branch of forwardPath) {
      unit.currentStats.hp += branch.promotionBonuses.hp;
      unit.currentStats.atk += branch.promotionBonuses.atk;
      unit.currentStats.def += branch.promotionBonuses.def;
      unit.currentStats.spa += branch.promotionBonuses.spa;
      unit.currentStats.spd += branch.promotionBonuses.spd;
      unit.currentStats.spe += branch.promotionBonuses.spe;
    }
  } else {
    unit.currentStats = computeManualScaledStatsForJoinLevel(targetSp, unit.level);
  }

  unit.nickname = targetSp.name;
  applyEvolutionLearnsetAndMoveCap(unit, targetSp);

  return { unit, mutated: true };
}

/** Equips an offensive move into its matching Physical/Special [E] slot. */
export function mutateSetEquippedMove(
  save: SaveData,
  instanceId: string,
  moveId: string
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  if (!unit.activeMoveIds.includes(moveId)) {
    throw new Error(`Move "${moveId}" is not in unit's 4-move active loadout.`);
  }
  const mv = MOVE_MAP.get(moveId);
  if (!mv || (mv.category !== 'Physical' && mv.category !== 'Special')) {
    throw new Error('Only offensive (Physical or Special) moves can be marked [E] Equipped.');
  }
  setEquippedMoveIdForCategory(unit, mv.category, moveId);
  return unit;
}

/** Deliberately unequips the Physical or Special [E] slot (unit won't counter at that range). */
export function mutateClearEquippedMove(
  save: SaveData,
  instanceId: string,
  category: EquipCategory
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  setEquippedMoveIdForCategory(unit, category, null);
  return unit;
}

export function mutateSetActiveMoves(
  save: SaveData,
  instanceId: string,
  moveIds: string[]
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const uniqueMoves = [...new Set(moveIds)];
  if (uniqueMoves.length === 0 || uniqueMoves.length > 4) {
    throw new Error('Active loadout must contain between 1 and 4 moves.');
  }
  for (const mId of uniqueMoves) {
    if (!unit.unlockedMoveIds.includes(mId)) {
      throw new Error(`Move "${mId}" has not been unlocked by ${unit.nickname}.`);
    }
  }
  const previousActive = unit.activeMoveIds;
  unit.activeMoveIds = uniqueMoves;
  reconcileEquippedMoves(unit, uniqueMoves, { fillEmpty: false });
  // A newly swapped-in move fills its slot if that slot was emptied or had nothing equipped.
  for (const mId of uniqueMoves) {
    if (!previousActive.includes(mId)) autoEquipNewMoveIfSlotEmpty(unit, mId);
  }
  return unit;
}

export function mutateRecruitPokemon(
  save: SaveData,
  opts: CreatePokemonOptions
): OwnedPokemonInstance {
  const lordUnit = save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId);
  const sp = SPECIES_MAP.get(opts.speciesId);
  const resolvedCosmeticForm =
    opts.cosmeticForm ??
    (sp?.lineId === 'flabebe_line'
      ? getFlabebeFlowerColorForLord(lordUnit?.speciesId)
      : undefined);
  const created = createPokemonInstance({
    ...opts,
    cosmeticForm: resolvedCosmeticForm,
    isLord: false,
  });
  save.roster.push(created);
  return created;
}

export function mutateSetUnitLevel(
  save: SaveData,
  instanceId: string,
  level: number,
  rescaleStats = false
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const clamped = Math.max(MIN_UNIT_LEVEL, Math.min(MAX_UNIT_LEVEL, Math.floor(level)));
  unit.level = clamped;
  unit.exp = 0;
  const sp = SPECIES_MAP.get(unit.speciesId);
  if (sp) {
    if (rescaleStats) {
      unit.currentStats = computeManualScaledStatsForJoinLevel(sp, clamped);
    }
    for (const entry of sp.learnset) {
      if (entry.level <= clamped && !unit.unlockedMoveIds.includes(entry.moveId)) {
        unit.unlockedMoveIds.push(entry.moveId);
        if (unit.activeMoveIds.length < 4) {
          unit.activeMoveIds.push(entry.moveId);
        }
      }
    }
  }
  return unit;
}

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
    consumeConvoyItem(save, itemId, item.name);
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

  consumeConvoyItem(save, vitaminItemId, item.name);
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

  consumeConvoyItem(save, tmItemId, tmItem.name);

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
    consumeConvoyItem(save, itemId, ITEM_MAP.get(itemId)?.name ?? itemId);
  }

  const targetSp = SPECIES_MAP.get(chosenBranch.targetSpeciesId)!;
  unit.currentStats.hp += chosenBranch.promotionBonuses.hp;
  unit.currentStats.atk += chosenBranch.promotionBonuses.atk;
  unit.currentStats.def += chosenBranch.promotionBonuses.def;
  unit.currentStats.spa += chosenBranch.promotionBonuses.spa;
  unit.currentStats.spd += chosenBranch.promotionBonuses.spd;
  unit.currentStats.spe += chosenBranch.promotionBonuses.spe;

  if (unit.nickname === currentSp.name) unit.nickname = targetSp.name;
  applyEvolutionLearnsetAndMoveCap(unit, targetSp);

  return unit;
}
