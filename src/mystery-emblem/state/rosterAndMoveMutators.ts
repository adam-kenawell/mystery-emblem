/**
 * Mystery Emblem — Roster, Nickname, Loadout, Evolution & Advisor Mutators
 */

import { getFlabebeFlowerColorForLord } from '../assets/pmdAssetLoader';
import {
  ADVISOR_EVOLVED_SPECIES_ID,
  BRANCHED_PROMOTION_MIN_LEVEL,
  MAX_UNIT_LEVEL,
  MIN_UNIT_LEVEL,
} from '../data/campaignConfig';
import {
  autoEquipNewMoveIfSlotEmpty,
  reconcileEquippedMoves,
  setEquippedMoveIdForCategory,
  type EquipCategory,
} from '../data/equippedMoves';
import { MOVE_MAP, SPECIES_MAP } from '../data/index';
import { computeManualScaledStatsForJoinLevel } from '../engine/progressionEngine';
import type {
  EvolutionBranch,
  OwnedPokemonInstance,
  PokemonSpeciesDefinition,
  SaveData,
} from '../types/schemas';
import {
  createPokemonInstance,
  sanitizeNickname,
  type CreatePokemonOptions,
} from './saveHelpersAndFactory';

export function findForwardEvolutionPath(
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

export function mutateRenamePokemon(
  save: SaveData,
  instanceId: string,
  newNickname: string
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const sp = SPECIES_MAP.get(unit.speciesId);
  unit.nickname = sanitizeNickname(newNickname, sp?.name ?? unit.speciesId);
  return unit;
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
    unit.currentStats.mov = targetSp.baseStats.mov;
  } else {
    unit.currentStats = computeManualScaledStatsForJoinLevel(targetSp, unit.level);
  }

  if (unit.nickname === currentSp.name) {
    unit.nickname = targetSp.name;
  }
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
  if (sp?.lineId === 'wimpod_line' && !save.campaign.advisorInstanceId) {
    save.campaign.advisorInstanceId = created.instanceId;
  }
  return created;
}

export function mutatePromoteAdvisorToPlayableRoster(
  save: SaveData,
  opts?: {
    speciesId?: 'wimpod' | 'golisopod';
    level?: number;
    nickname?: string;
    scaleStatsToLevel?: boolean;
  }
): OwnedPokemonInstance {
  const targetSpeciesId = opts?.speciesId ?? ADVISOR_EVOLVED_SPECIES_ID;
  const existing = save.roster.find(
    (u) =>
      u.instanceId === save.campaign.advisorInstanceId ||
      SPECIES_MAP.get(u.speciesId)?.lineId === 'wimpod_line'
  );
  if (existing) {
    save.campaign.advisorInstanceId = existing.instanceId;
    if (opts?.nickname) {
      const sp = SPECIES_MAP.get(existing.speciesId);
      existing.nickname = sanitizeNickname(opts.nickname, sp?.name ?? existing.speciesId);
    }
    if (existing.speciesId !== targetSpeciesId) {
      return mutateEvolveUnitToSpecies(save, existing.instanceId, targetSpeciesId).unit;
    }
    return existing;
  }

  return mutateRecruitPokemon(save, {
    speciesId: targetSpeciesId,
    level: opts?.level ?? BRANCHED_PROMOTION_MIN_LEVEL,
    nickname: opts?.nickname,
    scaleStatsToLevel: opts?.scaleStatsToLevel ?? true,
  });
}

export function mutateUnlockUnitMove(
  save: SaveData,
  instanceId: string,
  moveId: string,
  autoEquipIfRoom = false
): OwnedPokemonInstance {
  const unit = save.roster.find((u) => u.instanceId === instanceId);
  if (!unit) throw new Error(`Pokémon instance "${instanceId}" not found in roster.`);
  const mv = MOVE_MAP.get(moveId);
  if (!mv) throw new Error(`Unknown moveId "${moveId}".`);
  if (!unit.unlockedMoveIds.includes(moveId)) {
    unit.unlockedMoveIds.push(moveId);
  }
  if (autoEquipIfRoom && unit.activeMoveIds.length < 4 && !unit.activeMoveIds.includes(moveId)) {
    unit.activeMoveIds.push(moveId);
    autoEquipNewMoveIfSlotEmpty(unit, moveId);
  }
  return unit;
}

export function mutateSetUnitLevelForTest(
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
