/**
 * Mystery Emblem — Tactical Combat Math, Forecast & Exchange Engine
 *
 * Strictly implements GDD Section 2.3 & Rules 1 and 4:
 * - 18-Type Pokémon effectiveness chart mapped to Mystery Emblem tactical multipliers:
 *   `0x` (Immune), `0.5x` (Mostly Ineffective), `0.75x` (Not Very Effective),
 *   `1.0x` (Neutral), `1.25x` (Super Effective), `1.5x` (Extremely Effective).
 * - STAB (`1.25x`), Critical Hits (`2.0x`), Terrain Defense & Avoid bonuses.
 * - Physical moves (`Range 1`, `Atk` vs `Def`) & Special moves (`Range 2`, `SpA` vs `SpD`).
 * - Single-Equipped `[E]` Counter-Attack Rule: Defender only counter-attacks when its single
 *   equipped offensive move has `PP > 0` and matches the attacker's combat distance (`1` or `2`).
 * - Follow-up Doubling (`x2`) when `(Unit Speed - Target Speed) >= 5`.
 */

import type { PmdDirection, PmdSpriteAction } from '../assets/pmdAssetLoader';
import { getMoveById } from '../data/index';
import type {
  DungeonMapDefinition,
  MoveDefinition,
  PokemonType,
  StatBlockSeven,
  StatusCondition,
  TerrainBonuses,
  TerrainType,
  TraversalClass,
} from '../types/schemas';
import {
  coordKey,
  findShortestPathAStar,
  getMapTerrainAt,
  getTerrainBonuses,
  type AStarPathStep,
  type ActiveMoveRangeEntry,
  type PathfindingUnitContext,
  type ReachableTileInfo,
} from './terrainAndPathfinding';

export type TypeEffectivenessMultiplier = 0 | 0.5 | 0.75 | 1 | 1.25 | 1.5;

export type TypeEffectivenessLabel =
  | 'Immune'
  | 'Mostly Ineffective'
  | 'Not Very Effective'
  | 'Neutral'
  | 'Super Effective'
  | 'Extremely Effective';

interface TypeMatchupEntry {
  strongAgainst: ReadonlyArray<PokemonType>;
  resistedBy: ReadonlyArray<PokemonType>;
  immuneBy: ReadonlyArray<PokemonType>;
}

const TYPE_CHART: Readonly<Record<PokemonType, TypeMatchupEntry>> = {
  Normal: {
    strongAgainst: [],
    resistedBy: ['Rock', 'Steel'],
    immuneBy: ['Ghost'],
  },
  Fire: {
    strongAgainst: ['Grass', 'Ice', 'Bug', 'Steel'],
    resistedBy: ['Fire', 'Water', 'Rock', 'Dragon'],
    immuneBy: [],
  },
  Water: {
    strongAgainst: ['Fire', 'Ground', 'Rock'],
    resistedBy: ['Water', 'Grass', 'Dragon'],
    immuneBy: [],
  },
  Grass: {
    strongAgainst: ['Water', 'Ground', 'Rock'],
    resistedBy: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'],
    immuneBy: [],
  },
  Electric: {
    strongAgainst: ['Water', 'Flying'],
    resistedBy: ['Electric', 'Grass', 'Dragon'],
    immuneBy: ['Ground'],
  },
  Ice: {
    strongAgainst: ['Grass', 'Ground', 'Flying', 'Dragon'],
    resistedBy: ['Fire', 'Water', 'Ice', 'Steel'],
    immuneBy: [],
  },
  Fighting: {
    strongAgainst: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],
    resistedBy: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'],
    immuneBy: ['Ghost'],
  },
  Poison: {
    strongAgainst: ['Grass', 'Fairy'],
    resistedBy: ['Poison', 'Ground', 'Rock', 'Ghost'],
    immuneBy: ['Steel'],
  },
  Ground: {
    strongAgainst: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'],
    resistedBy: ['Grass', 'Bug'],
    immuneBy: ['Flying'],
  },
  Flying: {
    strongAgainst: ['Grass', 'Fighting', 'Bug'],
    resistedBy: ['Electric', 'Rock', 'Steel'],
    immuneBy: [],
  },
  Psychic: {
    strongAgainst: ['Fighting', 'Poison'],
    resistedBy: ['Psychic', 'Steel'],
    immuneBy: ['Dark'],
  },
  Bug: {
    strongAgainst: ['Grass', 'Psychic', 'Dark'],
    resistedBy: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'],
    immuneBy: [],
  },
  Rock: {
    strongAgainst: ['Fire', 'Ice', 'Flying', 'Bug'],
    resistedBy: ['Fighting', 'Ground', 'Steel'],
    immuneBy: [],
  },
  Ghost: {
    strongAgainst: ['Psychic', 'Ghost'],
    resistedBy: ['Dark'],
    immuneBy: ['Normal'],
  },
  Dragon: {
    strongAgainst: ['Dragon'],
    resistedBy: ['Steel'],
    immuneBy: ['Fairy'],
  },
  Dark: {
    strongAgainst: ['Psychic', 'Ghost'],
    resistedBy: ['Fighting', 'Dark', 'Fairy'],
    immuneBy: [],
  },
  Steel: {
    strongAgainst: ['Ice', 'Rock', 'Fairy'],
    resistedBy: ['Fire', 'Water', 'Electric', 'Steel'],
    immuneBy: [],
  },
  Fairy: {
    strongAgainst: ['Fighting', 'Dragon', 'Dark'],
    resistedBy: ['Fire', 'Poison', 'Steel'],
    immuneBy: [],
  },
};

export function getTypeEffectiveness(
  attackType: PokemonType,
  defenderTypes: ReadonlyArray<PokemonType>
): {
  multiplier: TypeEffectivenessMultiplier;
  label: TypeEffectivenessLabel;
} {
  const row = TYPE_CHART[attackType];
  let stepScore = 0;

  for (const defType of defenderTypes) {
    if (row.immuneBy.includes(defType)) {
      return { multiplier: 0, label: 'Immune' };
    }
    if (row.strongAgainst.includes(defType)) {
      stepScore += 1;
    } else if (row.resistedBy.includes(defType)) {
      stepScore -= 1;
    }
  }

  if (stepScore >= 2) {
    return { multiplier: 1.5, label: 'Extremely Effective' };
  }
  if (stepScore === 1) {
    return { multiplier: 1.25, label: 'Super Effective' };
  }
  if (stepScore === -1) {
    return { multiplier: 0.75, label: 'Not Very Effective' };
  }
  if (stepScore <= -2) {
    return { multiplier: 0.5, label: 'Mostly Ineffective' };
  }
  return { multiplier: 1, label: 'Neutral' };
}

export interface BattleMoveSlot extends ActiveMoveRangeEntry {
  maxPp: number;
  move: MoveDefinition;
}

export interface BattleUnitState extends PathfindingUnitContext {
  slotIndex: number;
  isLord: boolean;
  speciesId: string;
  speciesName: string;
  nickname: string;
  level: number;
  maxHp: number;
  currentHp: number;
  stats: StatBlockSeven;
  traversalClass: TraversalClass;
  types: ReadonlyArray<PokemonType>;
  personalSkillId: string;
  heldItemId: string | null;
  consumableItemId: string | null;
  status: StatusCondition | null;
  activeMoves: BattleMoveSlot[];
  equippedMoveId: string | null;
  waited: boolean;
  defeated: boolean;
  direction: PmdDirection;
  action: PmdSpriteAction;
  frameIndex: number;
  nextFrameAt: number;
  /** World-space pixel coordinates in native 1x PMD pixels (`x * 24`, `y * 24`) */
  renderWorldX: number;
  renderWorldY: number;
  /** Timestamp (`performance.now()`) until which a hurt white/red flash renders */
  hitFlashUntilMs: number;
  /** `0` when alive/normal, `0..1` while dissolving out on KO */
  koDissolveProgress: number;
}

export interface CombatSideForecast {
  unitId: string;
  move: MoveDefinition;
  ppBefore: number;
  damage: number;
  critDamage: number;
  hitRate: number;
  critRate: number;
  strikes: 1 | 2;
  hasStab: boolean;
  stabMultiplier: 1 | 1.25;
  typeMultiplier: TypeEffectivenessMultiplier;
  effectivenessLabel: TypeEffectivenessLabel;
}

export interface CombatForecast {
  distance: number;
  attackerPos: { x: number; y: number };
  defenderPos: { x: number; y: number };
  attackerTerrain: TerrainType;
  defenderTerrain: TerrainType;
  attackerTerrainBonuses: TerrainBonuses;
  defenderTerrainBonuses: TerrainBonuses;
  attackerSide: CombatSideForecast;
  defenderCanCounter: boolean;
  defenderCounterReason: string | null;
  defenderSide: CombatSideForecast | null;
  projectedAttackerHp: number;
  projectedDefenderHp: number;
}

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function isOffensiveMove(move: MoveDefinition | undefined | null): move is MoveDefinition {
  return Boolean(move && (move.category === 'Physical' || move.category === 'Special'));
}

export function isHealingMove(move: MoveDefinition | undefined | null): move is MoveDefinition {
  return Boolean(
    move &&
      move.category === 'Support/Heal' &&
      (move.supportSubkind === 'heal' || move.supportSubkind === 'self_heal')
  );
}

export function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function getOffensiveMovesAtDistance(
  unit: Pick<BattleUnitState, 'activeMoves' | 'equippedMoveId'>,
  distance: number
): BattleMoveSlot[] {
  const matching = unit.activeMoves.filter(
    (slot) =>
      slot.ppRemaining > 0 &&
      isOffensiveMove(slot.move) &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
  );

  // Sort so the currently `[E]` Equipped move comes first when valid at this range
  matching.sort((a, b) => {
    const aEq = a.id === unit.equippedMoveId ? 0 : 1;
    const bEq = b.id === unit.equippedMoveId ? 0 : 1;
    return aEq - bEq;
  });

  return matching;
}

function buildSideForecast(
  actor: BattleUnitState,
  target: BattleUnitState,
  moveSlot: BattleMoveSlot,
  targetTerrainBonuses: TerrainBonuses
): CombatSideForecast {
  const move = moveSlot.move;
  const isPhysical = move.category === 'Physical';

  let effectiveOffensiveStat = isPhysical ? actor.stats.atk : actor.stats.spa;
  if (isPhysical && actor.status === 'BRN') {
    effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
  } else if (!isPhysical && actor.status === 'FRZ') {
    effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
  }

  const defensiveStat = isPhysical ? target.stats.def : target.stats.spd;
  const terrainMitigation = isPhysical
    ? targetTerrainBonuses.defBonus
    : targetTerrainBonuses.spdBonus;

  const rawBaseDamage = Math.max(
    1,
    effectiveOffensiveStat + move.mt - (defensiveStat + terrainMitigation)
  );

  const hasStab = actor.types.includes(move.type);
  const stabMultiplier: 1 | 1.25 = hasStab ? 1.25 : 1;
  const { multiplier: typeMultiplier, label: effectivenessLabel } = getTypeEffectiveness(
    move.type,
    target.types
  );

  let damage = 0;
  let critDamage = 0;
  if (typeMultiplier > 0) {
    damage = Math.max(1, Math.floor(rawBaseDamage * stabMultiplier * typeMultiplier));
    critDamage = Math.max(1, Math.floor(rawBaseDamage * stabMultiplier * typeMultiplier * 2.0));
  }

  const rawHit =
    move.hit + (actor.stats.spe - target.stats.spe) * 2 - targetTerrainBonuses.avoidBonus;
  const hitRate = clampInt(rawHit, 15, 100);

  const rawCrit = move.crit + Math.floor(actor.stats.spe / 2);
  const critRate = typeMultiplier === 0 ? 0 : clampInt(rawCrit, 0, 100);

  const canDouble = actor.stats.spe - target.stats.spe >= 5 && moveSlot.ppRemaining >= 2;
  const strikes: 1 | 2 = canDouble ? 2 : 1;

  return {
    unitId: actor.id,
    move,
    ppBefore: moveSlot.ppRemaining,
    damage,
    critDamage,
    hitRate,
    critRate,
    strikes,
    hasStab,
    stabMultiplier,
    typeMultiplier,
    effectivenessLabel,
  };
}

/**
 * Computes the complete Fire Emblem Combat Forecast for `attacker` initiating on `defender`
 * with `attackerMoveId` from `(attackerPos ?? attacker)`.
 */
export function computeCombatForecast(
  map: DungeonMapDefinition,
  attacker: BattleUnitState,
  defender: BattleUnitState,
  attackerMoveId: string,
  attackerPosOverride?: { x: number; y: number }
): CombatForecast | null {
  const ax = attackerPosOverride?.x ?? attacker.x;
  const ay = attackerPosOverride?.y ?? attacker.y;
  const distance = manhattanDistance(ax, ay, defender.x, defender.y);

  const attackerSlot =
    attacker.activeMoves.find((s) => s.id === attackerMoveId && s.ppRemaining > 0) ??
    getOffensiveMovesAtDistance(attacker, distance)[0];
  if (!attackerSlot || !isOffensiveMove(attackerSlot.move)) {
    return null;
  }
  if (distance < attackerSlot.range[0] || distance > attackerSlot.range[1]) {
    return null;
  }

  const attackerTerrain = getMapTerrainAt(map, ax, ay) ?? 'floor';
  const defenderTerrain = getMapTerrainAt(map, defender.x, defender.y) ?? 'floor';
  const attackerTerrainBonuses = getTerrainBonuses(attackerTerrain, attacker);
  const defenderTerrainBonuses = getTerrainBonuses(defenderTerrain, defender);

  const attackerSide = buildSideForecast(
    attacker,
    defender,
    attackerSlot,
    defenderTerrainBonuses
  );

  // Rule 4: Single-Equipped `[E]` Counter-Attack Evaluation
  let defenderCanCounter = false;
  let defenderCounterReason: string | null = null;
  let defenderSide: CombatSideForecast | null = null;

  if (defender.status === 'SLP') {
    defenderCounterReason = 'Asleep';
  } else if (!defender.equippedMoveId) {
    defenderCounterReason = 'No [E] Move';
  } else {
    const defSlot = defender.activeMoves.find((s) => s.id === defender.equippedMoveId);
    const eqMove = defSlot?.move ?? getMoveById(defender.equippedMoveId);
    if (!defSlot || !isOffensiveMove(eqMove)) {
      defenderCounterReason = 'No Offensive [E]';
    } else if (defSlot.ppRemaining <= 0) {
      defenderCounterReason = '0 PP';
    } else if (distance < defSlot.range[0] || distance > defSlot.range[1]) {
      defenderCounterReason = `Out of Range ([E] R${defSlot.range[0]})`;
    } else {
      defenderCanCounter = true;
      defenderSide = buildSideForecast(
        defender,
        attacker,
        defSlot,
        attackerTerrainBonuses
      );
    }
  }

  // Simulate expected non-crit HP outcome assuming hits connect in Fire Emblem exchange order
  let projAttackerHp = attacker.currentHp;
  let projDefenderHp = defender.currentHp;

  // 1. Attacker Strike 1
  projDefenderHp = Math.max(0, projDefenderHp - attackerSide.damage);

  // 2. Defender Counter 1
  if (projDefenderHp > 0 && defenderCanCounter && defenderSide) {
    projAttackerHp = Math.max(0, projAttackerHp - defenderSide.damage);
  }

  // 3. Attacker Follow-Up Strike 2
  if (projAttackerHp > 0 && projDefenderHp > 0 && attackerSide.strikes === 2) {
    projDefenderHp = Math.max(0, projDefenderHp - attackerSide.damage);
  }

  // 4. Defender Follow-Up Counter 2
  if (
    projAttackerHp > 0 &&
    projDefenderHp > 0 &&
    defenderCanCounter &&
    defenderSide &&
    defenderSide.strikes === 2
  ) {
    projAttackerHp = Math.max(0, projAttackerHp - defenderSide.damage);
  }

  return {
    distance,
    attackerPos: { x: ax, y: ay },
    defenderPos: { x: defender.x, y: defender.y },
    attackerTerrain,
    defenderTerrain,
    attackerTerrainBonuses,
    defenderTerrainBonuses,
    attackerSide,
    defenderCanCounter,
    defenderCounterReason,
    defenderSide,
    projectedAttackerHp: projAttackerHp,
    projectedDefenderHp: projDefenderHp,
  };
}

export interface CombatStrikeOutcome {
  strikeIndex: number;
  actorId: string;
  targetId: string;
  isCounter: boolean;
  isFollowUp: boolean;
  move: MoveDefinition;
  actorPpAfter: number;
  paralyzedSkip: boolean;
  didHit: boolean;
  isCrit: boolean;
  damageDealt: number;
  typeMultiplier: TypeEffectivenessMultiplier;
  targetHpBefore: number;
  targetHpAfter: number;
  targetDefeated: boolean;
}

export interface CombatExchangeOutcome {
  forecast: CombatForecast;
  strikes: CombatStrikeOutcome[];
  finalAttackerHp: number;
  finalDefenderHp: number;
  finalAttackerPp: number;
  finalDefenderPp: number | null;
  attackerDefeated: boolean;
  defenderDefeated: boolean;
}

/**
 * Resolves a complete 1-to-4 strike Fire Emblem combat exchange without mutating unit objects yet,
 * so the scene animation controller can apply each strike's HP/PP delta on its exact impact frame.
 */
export function resolveCombatExchange(
  forecast: CombatForecast,
  attacker: BattleUnitState,
  defender: BattleUnitState,
  rng: () => number = Math.random
): CombatExchangeOutcome {
  let attackerHp = attacker.currentHp;
  let defenderHp = defender.currentHp;
  let attackerPp = forecast.attackerSide.ppBefore;
  let defenderPp = forecast.defenderSide ? forecast.defenderSide.ppBefore : null;

  const strikes: CombatStrikeOutcome[] = [];

  const rollPercent100 = (): number => {
    const r = rng();
    const clamped = Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5));
    return Math.floor(clamped * 100) + 1; // 1..100 inclusive
  };

  const runSingleStrike = (
    actor: BattleUnitState,
    target: BattleUnitState,
    side: CombatSideForecast,
    isCounter: boolean,
    isFollowUp: boolean
  ) => {
    if (isCounter) {
      if (defenderPp === null || defenderPp <= 0) return;
    } else if (attackerPp <= 0) {
      return;
    }

    // Paralysis check (`1/3` chance to lose the attack per GDD Section 2.3)
    if (actor.status === 'PAR') {
      const paraRoll = rng();
      if (paraRoll < 1 / 3) {
        const curTargetHp = isCounter ? attackerHp : defenderHp;
        const curActorPp = isCounter ? (defenderPp ?? 0) : attackerPp;
        strikes.push({
          strikeIndex: strikes.length,
          actorId: actor.id,
          targetId: target.id,
          isCounter,
          isFollowUp,
          move: side.move,
          actorPpAfter: curActorPp,
          paralyzedSkip: true,
          didHit: false,
          isCrit: false,
          damageDealt: 0,
          typeMultiplier: side.typeMultiplier,
          targetHpBefore: curTargetHp,
          targetHpAfter: curTargetHp,
          targetDefeated: false,
        });
        return;
      }
    }

    if (isCounter) {
      defenderPp = Math.max(0, (defenderPp ?? 1) - 1);
    } else {
      attackerPp = Math.max(0, attackerPp - 1);
    }
    const actorPpAfter = isCounter ? (defenderPp ?? 0) : attackerPp;

    const hitRoll = rollPercent100();
    const didHit = hitRoll <= side.hitRate;
    let isCrit = false;
    let damageDealt = 0;

    if (didHit) {
      if (side.typeMultiplier > 0 && side.critRate > 0) {
        const critRoll = rollPercent100();
        isCrit = critRoll <= side.critRate;
      }
      damageDealt = isCrit ? side.critDamage : side.damage;
    }

    const hpBefore = isCounter ? attackerHp : defenderHp;
    const hpAfter = Math.max(0, hpBefore - damageDealt);
    if (isCounter) {
      attackerHp = hpAfter;
    } else {
      defenderHp = hpAfter;
    }

    strikes.push({
      strikeIndex: strikes.length,
      actorId: actor.id,
      targetId: target.id,
      isCounter,
      isFollowUp,
      move: side.move,
      actorPpAfter,
      paralyzedSkip: false,
      didHit,
      isCrit,
      damageDealt,
      typeMultiplier: side.typeMultiplier,
      targetHpBefore: hpBefore,
      targetHpAfter: hpAfter,
      targetDefeated: hpAfter <= 0,
    });
  };

  // 1. Attacker Initial Strike
  if (attacker.status !== 'SLP' && attackerHp > 0 && defenderHp > 0) {
    runSingleStrike(attacker, defender, forecast.attackerSide, false, false);
  }

  // 2. Defender Counter-Attack (only if surviving & `[E]` move matches range)
  if (
    attackerHp > 0 &&
    defenderHp > 0 &&
    forecast.defenderCanCounter &&
    forecast.defenderSide
  ) {
    runSingleStrike(defender, attacker, forecast.defenderSide, true, false);
  }

  // 3. Attacker Follow-Up (`x2`)
  if (
    attacker.status !== 'SLP' &&
    attackerHp > 0 &&
    defenderHp > 0 &&
    forecast.attackerSide.strikes === 2 &&
    attackerPp > 0
  ) {
    runSingleStrike(attacker, defender, forecast.attackerSide, false, true);
  }

  // 4. Defender Follow-Up (`x2`)
  if (
    attackerHp > 0 &&
    defenderHp > 0 &&
    forecast.defenderCanCounter &&
    forecast.defenderSide &&
    forecast.defenderSide.strikes === 2 &&
    (defenderPp ?? 0) > 0
  ) {
    runSingleStrike(defender, attacker, forecast.defenderSide, true, true);
  }

  return {
    forecast,
    strikes,
    finalAttackerHp: attackerHp,
    finalDefenderHp: defenderHp,
    finalAttackerPp: attackerPp,
    finalDefenderPp: defenderPp,
    attackerDefeated: attackerHp <= 0,
    defenderDefeated: defenderHp <= 0,
  };
}

export interface DirectAttackPlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  defaultMoveId: string;
  availableMoves: BattleMoveSlot[];
}

/**
 * When a player selects `attacker` and directly taps/clicks `targetEnemy`, finds the optimal
 * reachable Blue stopping tile and default offensive move to open the Combat Forecast:
 * 1. Stays on `(attacker.x, attacker.y)` (`0` movement) if already at valid attack range!
 * 2. Otherwise prefers tiles matching `attacker.equippedMoveId`, lowest A* path cost, and highest terrain bonus.
 */
export function findBestAttackPlanForTarget(
  map: DungeonMapDefinition,
  attacker: BattleUnitState,
  targetEnemy: BattleUnitState,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectAttackPlan | null {
  interface Candidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    usesEquippedMove: boolean;
    terrainScore: number;
    availableMoves: BattleMoveSlot[];
  }

  const candidates: Candidate[] = [];

  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
    const availableMoves = getOffensiveMovesAtDistance(attacker, dist);
    if (availableMoves.length === 0) continue;

    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, attacker);
    const terrainScore = bonuses.defBonus * 10 + bonuses.avoidBonus;
    const staysOnOrigin = stop.x === attacker.x && stop.y === attacker.y;
    const usesEquippedMove = availableMoves.some((m) => m.id === attacker.equippedMoveId);

    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin,
      usesEquippedMove,
      terrainScore,
      availableMoves,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.usesEquippedMove !== b.usesEquippedMove) return a.usesEquippedMove ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(map, attacker, cand.stopX, cand.stopY, allLivingUnits);
    if (path) {
      return {
        stopX: cand.stopX,
        stopY: cand.stopY,
        path,
        defaultMoveId: cand.availableMoves[0]!.id,
        availableMoves: cand.availableMoves,
      };
    }
  }

  return null;
}

/**
 * Returns all offensive move slots (`ppRemaining > 0`) on `attacker` that can strike `targetEnemy`
 * from at least one legal stopping tile in `reachableTiles` (e.g. both Range-1 `Wrap` and Range-2
 * `Dragon Breath` when Dratini can reach tiles at distance 1 and distance 2).
 */
export function getOffensiveMovesReachableForTarget(
  attacker: Pick<BattleUnitState, 'activeMoves' | 'equippedMoveId'>,
  targetEnemy: Pick<BattleUnitState, 'x' | 'y'>,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>
): BattleMoveSlot[] {
  const available: BattleMoveSlot[] = [];
  for (const slot of attacker.activeMoves) {
    if (slot.ppRemaining <= 0 || !isOffensiveMove(slot.move)) continue;
    let canUse = false;
    for (const stop of reachableTiles.values()) {
      const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
      if (dist >= slot.range[0] && dist <= slot.range[1]) {
        canUse = true;
        break;
      }
    }
    if (canUse) {
      available.push(slot);
    }
  }
  available.sort((a, b) => {
    const aEq = a.id === attacker.equippedMoveId ? 0 : 1;
    const bEq = b.id === attacker.equippedMoveId ? 0 : 1;
    return aEq - bEq;
  });
  return available;
}

/**
 * Finds the best legal stopping tile in `reachableTiles` from which `attacker` can execute `moveSlot`
 * against `targetEnemy`, preferring `preferredOrigin` (no movement) or lowest A* cost + best terrain.
 */
export function findBestStopTileForOffensiveMove(
  map: DungeonMapDefinition,
  attackerFromOrigin: PathfindingUnitContext,
  targetEnemy: Pick<BattleUnitState, 'x' | 'y'>,
  moveSlot: BattleMoveSlot,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): { stopX: number; stopY: number; path: AStarPathStep[] } | null {
  interface StopCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
  }
  const candidates: StopCandidate[] = [];

  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetEnemy.x, targetEnemy.y);
    if (dist < moveSlot.range[0] || dist > moveSlot.range[1]) continue;
    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, attackerFromOrigin);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === attackerFromOrigin.x && stop.y === attackerFromOrigin.y,
      terrainScore: bonuses.defBonus * 10 + bonuses.avoidBonus,
    });
  }

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(
      map,
      attackerFromOrigin,
      cand.stopX,
      cand.stopY,
      allLivingUnits
    );
    if (path) {
      return { stopX: cand.stopX, stopY: cand.stopY, path };
    }
  }
  return null;
}

// ============================================================================
// Support / Heal Moves (`Soft-Boiled`, `Heal Pulse`, `Wish`, etc.)
// ============================================================================

export function doesUnitNeedHealing(
  target: Pick<BattleUnitState, 'currentHp' | 'maxHp' | 'status'>,
  move: MoveDefinition
): boolean {
  if (target.currentHp < target.maxHp) return true;
  if (move.supportPayload?.cureStatus && target.status !== null) return true;
  return false;
}

export function getHealingMovesForTargetAtDistance(
  healer: Pick<BattleUnitState, 'id' | 'activeMoves'>,
  target: Pick<BattleUnitState, 'id' | 'currentHp' | 'maxHp' | 'status'>,
  distance: number
): BattleMoveSlot[] {
  const isSelf = healer.id === target.id;
  return healer.activeMoves.filter((slot) => {
    if (slot.ppRemaining <= 0 || !isHealingMove(slot.move)) return false;
    if (!doesUnitNeedHealing(target, slot.move)) return false;
    if (isSelf) {
      return (
        distance === 0 &&
        (slot.targetType === 'self' || slot.targetType === 'self_or_ally')
      );
    }
    return (
      (slot.targetType === 'ally' || slot.targetType === 'self_or_ally') &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
    );
  });
}

export interface HealForecast {
  distance: number;
  healerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  healerTerrain: TerrainType;
  targetTerrain: TerrainType;
  move: MoveDefinition;
  ppBefore: number;
  ppAfter: number;
  healPower: number;
  actualHeal: number;
  projectedTargetHp: number;
  curesStatus: boolean;
}

export function computeHealForecast(
  map: DungeonMapDefinition,
  healer: BattleUnitState,
  target: BattleUnitState,
  moveId: string,
  healerPosOverride?: { x: number; y: number }
): HealForecast | null {
  const hx = healerPosOverride?.x ?? healer.x;
  const hy = healerPosOverride?.y ?? healer.y;
  const distance = healer.id === target.id ? 0 : manhattanDistance(hx, hy, target.x, target.y);

  const validSlots = getHealingMovesForTargetAtDistance(healer, target, distance);
  const slot = validSlots.find((s) => s.id === moveId) ?? validSlots[0];
  if (!slot) return null;

  const payload = slot.move.supportPayload;
  let healPower = 10;
  if (payload?.healPercentMaxHp) {
    healPower = Math.max(1, Math.round((target.maxHp * payload.healPercentMaxHp) / 100));
  } else if (payload?.healAmount) {
    healPower = Math.max(1, payload.healAmount + Math.floor(healer.stats.spa / 2));
  }

  const actualHeal = Math.max(0, Math.min(target.maxHp - target.currentHp, healPower));
  const projectedTargetHp = Math.min(target.maxHp, target.currentHp + actualHeal);
  const healerTerrain = getMapTerrainAt(map, hx, hy) ?? 'floor';
  const targetTerrain = getMapTerrainAt(map, target.x, target.y) ?? 'floor';

  return {
    distance,
    healerPos: { x: hx, y: hy },
    targetPos: { x: target.x, y: target.y },
    healerTerrain,
    targetTerrain,
    move: slot.move,
    ppBefore: slot.ppRemaining,
    ppAfter: Math.max(0, slot.ppRemaining - 1),
    healPower,
    actualHeal,
    projectedTargetHp,
    curesStatus: Boolean(payload?.cureStatus && target.status !== null),
  };
}

export interface DirectHealPlan {
  stopX: number;
  stopY: number;
  path: AStarPathStep[];
  defaultMoveId: string;
  availableMoves: BattleMoveSlot[];
}

export function findBestHealPlanForAlly(
  map: DungeonMapDefinition,
  healer: BattleUnitState,
  targetAlly: BattleUnitState,
  reachableTiles: ReadonlyMap<string, ReachableTileInfo>,
  allLivingUnits: ReadonlyArray<BattleUnitState>
): DirectHealPlan | null {
  if (healer.id === targetAlly.id) return null;

  interface HealCandidate {
    stopX: number;
    stopY: number;
    cost: number;
    staysOnOrigin: boolean;
    terrainScore: number;
    availableMoves: BattleMoveSlot[];
  }

  const candidates: HealCandidate[] = [];
  for (const stop of reachableTiles.values()) {
    const dist = manhattanDistance(stop.x, stop.y, targetAlly.x, targetAlly.y);
    const availableMoves = getHealingMovesForTargetAtDistance(healer, targetAlly, dist);
    if (availableMoves.length === 0) continue;

    const terrain = getMapTerrainAt(map, stop.x, stop.y) ?? 'floor';
    const bonuses = getTerrainBonuses(terrain, healer);
    candidates.push({
      stopX: stop.x,
      stopY: stop.y,
      cost: stop.cost,
      staysOnOrigin: stop.x === healer.x && stop.y === healer.y,
      terrainScore: bonuses.defBonus * 10 + bonuses.avoidBonus,
      availableMoves,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.staysOnOrigin !== b.staysOnOrigin) return a.staysOnOrigin ? -1 : 1;
    if (a.cost !== b.cost) return a.cost - b.cost;
    if (a.terrainScore !== b.terrainScore) return b.terrainScore - a.terrainScore;
    return coordKey(a.stopX, a.stopY).localeCompare(coordKey(b.stopX, b.stopY));
  });

  for (const cand of candidates) {
    const path = findShortestPathAStar(map, healer, cand.stopX, cand.stopY, allLivingUnits);
    if (path) {
      return {
        stopX: cand.stopX,
        stopY: cand.stopY,
        path,
        defaultMoveId: cand.availableMoves[0]!.id,
        availableMoves: cand.availableMoves,
      };
    }
  }

  return null;
}
