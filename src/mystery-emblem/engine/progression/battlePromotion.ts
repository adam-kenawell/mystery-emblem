/**
 * Mid-Battle Evolution Stone & Evolution Gem Promotion Resolver
 */

import { autoEquipNewMoveIfSlotEmpty } from '../../data/equippedMoves';
import { getMoveById, getSpeciesById } from '../../data/index';
import type { EvolutionBranch, StatBlockSeven } from '../../types/schemas';
import { type BattleUnitState } from '../combatEngine';
import { buildMoveSlotForLearnedMove } from './expAndLevelUp';

export interface BattlePromotionOutcome {
  previousSpeciesId: string;
  previousSpeciesName: string;
  newSpeciesId: string;
  newSpeciesName: string;
  branch: EvolutionBranch;
  statsBefore: StatBlockSeven;
  statsAfter: StatBlockSeven;
  newlyLearnedMoveIds: string[];
}

export function getEligibleEvolutionBranches(
  speciesId: string,
  level: number,
  itemId: string
): EvolutionBranch[] {
  if (itemId !== 'evolution_stone' && itemId !== 'evolution_gem') {
    return [];
  }
  const sp = getSpeciesById(speciesId);
  if (!sp) return [];
  return sp.evolutions.filter(
    (b) => b.requiredItemId === itemId && level >= b.minLevel
  );
}

/**
 * Promotes a live `BattleUnitState` mid-battle using its equipped `evolution_stone` or `evolution_gem`.
 */
export function promoteBattleUnitMidBattle(
  unit: BattleUnitState,
  itemId: 'evolution_stone' | 'evolution_gem',
  targetSpeciesId?: string
): BattlePromotionOutcome {
  const fromSp = getSpeciesById(unit.speciesId);
  if (!fromSp) {
    throw new Error(`Unknown species "${unit.speciesId}".`);
  }
  const branches = getEligibleEvolutionBranches(unit.speciesId, unit.level, itemId);
  if (branches.length === 0) {
    throw new Error(`${unit.nickname} does not meet evolution requirements yet.`);
  }
  const branch = targetSpeciesId
    ? branches.find((b) => b.targetSpeciesId === targetSpeciesId)
    : branches[0];
  if (!branch) {
    throw new Error(`Invalid evolution target "${String(targetSpeciesId)}".`);
  }
  const targetSp = getSpeciesById(branch.targetSpeciesId);
  if (!targetSp) {
    throw new Error(`Unknown evolution target species "${branch.targetSpeciesId}".`);
  }

  const statsBefore: StatBlockSeven = { ...unit.stats };
  const bonuses = branch.promotionBonuses;
  const statsAfter: StatBlockSeven = {
    hp: statsBefore.hp + bonuses.hp,
    atk: statsBefore.atk + bonuses.atk,
    def: statsBefore.def + bonuses.def,
    spa: statsBefore.spa + bonuses.spa,
    spd: statsBefore.spd + bonuses.spd,
    spe: statsBefore.spe + bonuses.spe,
    mov: targetSp.baseStats.mov,
  };

  if (unit.nickname === fromSp.name) {
    unit.nickname = targetSp.name;
  }

  unit.speciesId = targetSp.id;
  unit.speciesName = targetSp.name;
  unit.types = targetSp.types;
  unit.traversalClass = targetSp.traversalClass;
  unit.personalSkillId = targetSp.personalSkillId;
  unit.mov = statsAfter.mov;
  unit.stats = { ...statsAfter };
  unit.maxHp = statsAfter.hp;
  unit.currentHp = Math.min(statsAfter.hp, unit.currentHp + bonuses.hp);

  const unlockedSet = new Set<string>(
    unit.unlockedMoveIds ?? unit.activeMoves.map((m) => m.id)
  );
  const newlyLearnedMoveIds: string[] = [];
  for (const entry of targetSp.learnset) {
    if (entry.level <= unit.level && !unlockedSet.has(entry.moveId)) {
      if (getMoveById(entry.moveId)) {
        unlockedSet.add(entry.moveId);
        newlyLearnedMoveIds.push(entry.moveId);
        if (unit.activeMoves.length < 4 && !unit.activeMoves.some((m) => m.id === entry.moveId)) {
          const slot = buildMoveSlotForLearnedMove(entry.moveId);
          if (slot) {
            unit.activeMoves.push(slot);
            autoEquipNewMoveIfSlotEmpty(unit, slot.id);
          }
        }
      }
    }
  }
  unit.unlockedMoveIds = [...unlockedSet];

  if (unit.consumableItemId === itemId) {
    unit.consumableItemId = null;
  }

  return {
    previousSpeciesId: fromSp.id,
    previousSpeciesName: fromSp.name,
    newSpeciesId: targetSp.id,
    newSpeciesName: targetSp.name,
    branch,
    statsBefore,
    statsAfter,
    newlyLearnedMoveIds,
  };
}
