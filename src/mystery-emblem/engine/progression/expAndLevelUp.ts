/**
 * Tactical EXP Formula, Manual Growth Stat Roll & Level-Up Engine
 */

import { getMoveById, getSpeciesById } from '../../data/index';
import type {
  PokemonSpeciesDefinition,
  StatBlockSeven,
  StatBlockSix,
  StatKeySix,
} from '../../types/schemas';
import { isOffensiveMove, type BattleMoveSlot, type BattleUnitState } from '../combatEngine';

export const MAX_UNIT_LEVEL = 40;
export const EXP_PER_LEVEL = 100;

export const STAT_KEYS_SIX: ReadonlyArray<StatKeySix> = [
  'hp',
  'atk',
  'def',
  'spa',
  'spd',
  'spe',
];

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function getEffectiveGrowthRates(species: PokemonSpeciesDefinition): StatBlockSix {
  const hiddenBonus = species.personalSkillId === 'hidden_potential' ? 20 : 0;
  return {
    hp: Math.min(100, species.growthRates.hp + hiddenBonus),
    atk: Math.min(100, species.growthRates.atk + hiddenBonus),
    def: Math.min(100, species.growthRates.def + hiddenBonus),
    spa: Math.min(100, species.growthRates.spa + hiddenBonus),
    spd: Math.min(100, species.growthRates.spd + hiddenBonus),
    spe: Math.min(100, species.growthRates.spe + hiddenBonus),
  };
}

/**
 * Scales a species' manually authored `baseStats` (defined at `species.defaultJoinLevel`)
 * up to `targetLevel` using ONLY the developer's manual `growthRates` in `pokemon_species.json`.
 */
export function computeManualScaledStatsForJoinLevel(
  species: PokemonSpeciesDefinition,
  targetLevel: number
): StatBlockSeven {
  const clampedLevel = clampInt(targetLevel, 1, MAX_UNIT_LEVEL);
  const deltaLevels = Math.max(0, clampedLevel - species.defaultJoinLevel);
  if (deltaLevels === 0) {
    return { ...species.baseStats };
  }
  const rates = getEffectiveGrowthRates(species);
  return {
    hp: species.baseStats.hp + Math.round((deltaLevels * rates.hp) / 100),
    atk: species.baseStats.atk + Math.round((deltaLevels * rates.atk) / 100),
    def: species.baseStats.def + Math.round((deltaLevels * rates.def) / 100),
    spa: species.baseStats.spa + Math.round((deltaLevels * rates.spa) / 100),
    spd: species.baseStats.spd + Math.round((deltaLevels * rates.spd) / 100),
    spe: species.baseStats.spe + Math.round((deltaLevels * rates.spe) / 100),
    mov: species.baseStats.mov,
  };
}

export interface CombatExpContext {
  playerLevel: number;
  enemyLevel: number;
  landedHit: boolean;
  dealtDamage: boolean;
  defeatedEnemy: boolean;
}

export function computeCombatExpGain(ctx: CombatExpContext): number {
  if (ctx.playerLevel >= MAX_UNIT_LEVEL) {
    return 0;
  }
  if (!ctx.dealtDamage && !ctx.defeatedEnemy) {
    return ctx.landedHit ? 2 : 1;
  }
  const diff = ctx.enemyLevel - ctx.playerLevel;
  const damageExp = clampInt(15 + diff * 3, 1, 30);
  const koBonusExp = ctx.defeatedEnemy ? clampInt(35 + diff * 6, 5, 70) : 0;
  return damageExp + koBonusExp;
}

export function computeSupportHealExpGain(healerLevel: number, chapterLevel: number): number {
  if (healerLevel >= MAX_UNIT_LEVEL) {
    return 0;
  }
  const overLevel = Math.max(0, healerLevel - Math.max(1, chapterLevel));
  return clampInt(20 - overLevel * 3, 5, 20);
}

export interface LevelUpResult {
  unitId: string;
  nickname: string;
  speciesId: string;
  speciesName: string;
  previousLevel: number;
  newLevel: number;
  statGains: StatBlockSix;
  statsBefore: StatBlockSeven;
  statsAfter: StatBlockSeven;
  newlyLearnedMoveIds: string[];
  canPromoteWithStoneNow: boolean;
}

export function rollSingleLevelUp(
  species: PokemonSpeciesDefinition,
  currentLevel: number,
  currentStats: StatBlockSeven,
  unlockedMoveIds: ReadonlyArray<string>,
  rng: () => number = Math.random
): {
  newLevel: number;
  statGains: StatBlockSix;
  statsAfter: StatBlockSeven;
  newlyLearnedMoveIds: string[];
} {
  const newLevel = Math.min(MAX_UNIT_LEVEL, currentLevel + 1);
  const rates = getEffectiveGrowthRates(species);
  const statGains: StatBlockSix = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  };

  for (const key of STAT_KEYS_SIX) {
    const roll100 = Math.floor(rng() * 100) + 1;
    if (roll100 <= rates[key]) {
      statGains[key] = 1;
    }
  }

  const statsAfter: StatBlockSeven = {
    hp: currentStats.hp + statGains.hp,
    atk: currentStats.atk + statGains.atk,
    def: currentStats.def + statGains.def,
    spa: currentStats.spa + statGains.spa,
    spd: currentStats.spd + statGains.spd,
    spe: currentStats.spe + statGains.spe,
    mov: currentStats.mov,
  };

  const newlyLearnedMoveIds: string[] = [];
  for (const entry of species.learnset) {
    if (entry.level === newLevel && !unlockedMoveIds.includes(entry.moveId)) {
      if (getMoveById(entry.moveId)) {
        newlyLearnedMoveIds.push(entry.moveId);
      }
    }
  }

  return { newLevel, statGains, statsAfter, newlyLearnedMoveIds };
}

export function buildMoveSlotForLearnedMove(moveId: string): BattleMoveSlot | null {
  const mv = getMoveById(moveId);
  if (!mv) return null;
  return {
    id: mv.id,
    range: mv.range,
    targetType: mv.targetType,
    ppRemaining: mv.pp,
    maxPp: mv.pp,
    move: mv,
  };
}

export function awardBattleUnitExp(
  unit: BattleUnitState,
  expGain: number,
  rng: () => number = Math.random
): { expAdded: number; levelUps: LevelUpResult[] } {
  if (unit.faction !== 'player' || unit.defeated || expGain <= 0 || unit.level >= MAX_UNIT_LEVEL) {
    if (unit.level >= MAX_UNIT_LEVEL) {
      unit.exp = 0;
    }
    return { expAdded: 0, levelUps: [] };
  }

  const species = getSpeciesById(unit.speciesId);
  if (!species) {
    return { expAdded: 0, levelUps: [] };
  }

  const unlockedSet = new Set<string>(
    unit.unlockedMoveIds ?? unit.activeMoves.map((m) => m.id)
  );
  let totalExp = (unit.exp ?? 0) + Math.round(expGain);
  const levelUps: LevelUpResult[] = [];

  while (totalExp >= EXP_PER_LEVEL && unit.level < MAX_UNIT_LEVEL) {
    totalExp -= EXP_PER_LEVEL;
    const prevLevel = unit.level;
    const statsBefore: StatBlockSeven = { ...unit.stats };
    const rolled = rollSingleLevelUp(
      species,
      prevLevel,
      statsBefore,
      [...unlockedSet],
      rng
    );

    unit.level = rolled.newLevel;
    unit.stats = { ...rolled.statsAfter };
    unit.maxHp = rolled.statsAfter.hp;
    unit.currentHp = Math.min(unit.maxHp, unit.currentHp + rolled.statGains.hp);

    for (const moveId of rolled.newlyLearnedMoveIds) {
      unlockedSet.add(moveId);
      if (unit.activeMoves.length < 4 && !unit.activeMoves.some((m) => m.id === moveId)) {
        const slot = buildMoveSlotForLearnedMove(moveId);
        if (slot) {
          unit.activeMoves.push(slot);
          if (!unit.equippedMoveId && isOffensiveMove(slot.move)) {
            unit.equippedMoveId = slot.id;
          }
        }
      }
    }

    const canPromoteWithStoneNow = species.evolutions.some(
      (b) => b.requiredItemId === 'evolution_stone' && unit.level >= b.minLevel
    );

    levelUps.push({
      unitId: unit.id,
      nickname: unit.nickname,
      speciesId: species.id,
      speciesName: species.name,
      previousLevel: prevLevel,
      newLevel: rolled.newLevel,
      statGains: rolled.statGains,
      statsBefore,
      statsAfter: { ...rolled.statsAfter },
      newlyLearnedMoveIds: rolled.newlyLearnedMoveIds,
      canPromoteWithStoneNow,
    });

    if (unit.level >= MAX_UNIT_LEVEL) {
      totalExp = 0;
      break;
    }
  }

  unit.exp = totalExp;
  unit.unlockedMoveIds = [...unlockedSet];

  return {
    expAdded: Math.round(expGain),
    levelUps,
  };
}
