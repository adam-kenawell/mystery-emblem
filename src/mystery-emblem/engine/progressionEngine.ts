/**
 * Mystery Emblem — Tactical EXP, Level-Up Growth Roll & Promotion Engine (`progressionEngine.ts`)
 *
 * Strictly obeys Rule 1 (100% Data-Driven Manual Balance — Zero PokéAPI Formulas)
 * and GDD Section 2.1 & Step 9:
 * - Continuous Level 1–40 curve (`MAX_UNIT_LEVEL = 40`), 100 EXP per level.
 * - Damage EXP: `clamp(15 + (Enemy_Lv - Unit_Lv) * 3, 1, 30)`
 * - Defeat Bonus EXP (added on KO): `clamp(35 + (Enemy_Lv - Unit_Lv) * 6, 5, 70)`
 *   (50 total EXP for an equal-level KO!)
 * - Support / Heal Move EXP: `clamp(20 - max(0, Unit_Lv - Chapter_Lv) * 3, 5, 20)`
 * - Level-Up Stat Growth Rolls: rolls `1..100` against each of the 6 manual `growthRates`
 *   in `pokemon_species.json` (`+20%` to all 6 stats when `personalSkillId === 'hidden_potential'`).
 * - Bespoke Learnset Unlocking: unlocks any move in `species.learnset` matching the new level.
 * - Manual Join-Level Stat Scaling: scales manual `baseStats` using manual `growthRates`
 *   for higher-level campaign/demo joins (`Lv. 9` Demo start & recruits, higher-level enemy spawns)
 *   while keeping `mov` strictly fixed to `species.baseStats.mov`.
 */

import { getMoveById, getSpeciesById } from '../data/index';
import type {
  EvolutionBranch,
  PokemonSpeciesDefinition,
  StatBlockSeven,
  StatBlockSix,
  StatKeySix,
} from '../types/schemas';
import { isOffensiveMove, type BattleMoveSlot, type BattleUnitState } from './combatEngine';

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
 * `mov` never increases from level scaling (GDD 2.2).
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
  /** True if the player unit landed at least one hit (dealing >= 0 damage) */
  landedHit: boolean;
  /** True if the player unit dealt > 0 damage */
  dealtDamage: boolean;
  /** True if the enemy was reduced to 0 HP during this combat exchange */
  defeatedEnemy: boolean;
}

/**
 * Computes exact combat EXP awarded to a surviving player unit after an exchange (GDD 2.1):
 * - Damage EXP: `clamp(15 + (Enemy_Lv - Unit_Lv) * 3, 1, 30)`
 * - Defeat Bonus EXP: `clamp(35 + (Enemy_Lv - Unit_Lv) * 6, 5, 70)`
 * - If all strikes missed / dealt 0 damage without KO: awards `1` EXP chip (0 at Lv. 40).
 */
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

/**
 * Computes exact Support / Heal EXP awarded when using a healing move (GDD 2.1):
 * `clamp(20 - max(0, Unit_Lv - Chapter_Lv) * 3, 5, 20)`
 */
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

/**
 * Rolls one level-up (`currentLevel -> currentLevel + 1`) against the unit's manual
 * `growthRates` using `rng` (`[0, 1)` -> roll `1..100` succeeds when `roll <= growthRate`).
 */
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

  return {
    newLevel,
    statGains,
    statsAfter,
    newlyLearnedMoveIds,
  };
}

function buildMoveSlotForLearnedMove(moveId: string): BattleMoveSlot | null {
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

/**
 * Awards `expGain` to a live `BattleUnitState`, mutating `unit.exp`, `unit.level`,
 * `unit.stats`, `unit.maxHp`, `unit.currentHp`, `unit.unlockedMoveIds`, and `unit.activeMoves`
 * (auto-equipping newly learned moves if fewer than 4 active moves are equipped),
 * returning any triggered `LevelUpResult` entries in sequence.
 */
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

/**
 * Returns eligible `EvolutionBranch[]` for a `BattleUnitState` given `itemId`
 * (`'evolution_stone'` or `'evolution_gem'`).
 */
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
 * Promotes a live `BattleUnitState` mid-battle using its equipped `evolution_stone` or `evolution_gem`:
 * - Applies manual `promotionBonuses` (`hp`, `atk`, `def`, `spa`, `spd`, `spe`)
 * - Updates `mov` to `targetSpecies.baseStats.mov`
 * - Updates `speciesId`, `speciesName`, `types`, `traversalClass`, `personalSkillId`
 * - Preserves continuous `level`, `exp`, and custom `nickname`
 * - Unlocks any new stage learnset moves at `<= unit.level`
 * - Consumes `unit.consumableItemId`
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

  // Preserve custom nickname; if unit was still named after its previous species, update to new species name
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
            if (!unit.equippedMoveId && isOffensiveMove(slot.move)) {
              unit.equippedMoveId = slot.id;
            }
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
