/**
 * Fire Emblem Combat Forecast Calculator (Rule 4 Single-Equipped `[E]` Counter-Attack)
 */

import { getItemById, getMoveById } from '../../data/index';
import type { DungeonMapDefinition, TerrainBonuses } from '../../types/schemas';
import { getMapTerrainAt, getTerrainBonuses } from '../terrainAndPathfinding';
import {
  getOffensiveMovesAtDistance,
  getUnitEffectiveCombatStats,
  isOffensiveMove,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
  type CombatForecast,
  type CombatSideForecast,
} from './combatTypesAndStats';
import { getTypeEffectiveness } from './typeEffectiveness';

function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function buildSideForecast(
  actor: BattleUnitState,
  target: BattleUnitState,
  moveSlot: BattleMoveSlot,
  targetTerrainBonuses: TerrainBonuses
): CombatSideForecast {
  const move = moveSlot.move;
  const isPhysical = move.category === 'Physical';
  const actorEff = getUnitEffectiveCombatStats(actor);
  const targetEff = getUnitEffectiveCombatStats(target);

  let effectiveOffensiveStat = isPhysical ? actorEff.atk : actorEff.spa;
  if (isPhysical && actor.status === 'BRN' && actor.personalSkillId !== 'guts') {
    effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
  } else if (!isPhysical && actor.status === 'FRZ') {
    effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
  }

  const defensiveStat = isPhysical ? targetEff.def : targetEff.spd;
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

  let itemFlatDamageBonus = 0;
  if (actor.heldItemId && typeMultiplier > 0) {
    const held = getItemById(actor.heldItemId);
    if (held) {
      const eff = held.effect;
      if (isPhysical && eff.physicalDamageBonus) {
        itemFlatDamageBonus += eff.physicalDamageBonus;
      }
      if (!isPhysical && eff.specialDamageBonus) {
        itemFlatDamageBonus += eff.specialDamageBonus;
      }
      if (eff.flatDamageBonus) {
        if (!eff.boostedType || eff.boostedType === move.type) {
          itemFlatDamageBonus += eff.flatDamageBonus;
        }
      }
      if (eff.superEffectiveDamageBonus && typeMultiplier > 1) {
        itemFlatDamageBonus += eff.superEffectiveDamageBonus;
      }
    }
  }

  let damage = 0;
  let critDamage = 0;
  if (typeMultiplier > 0) {
    const scaledBase = Math.max(1, Math.floor(rawBaseDamage * stabMultiplier * typeMultiplier));
    damage = scaledBase + itemFlatDamageBonus;
    critDamage =
      Math.max(1, Math.floor(rawBaseDamage * stabMultiplier * typeMultiplier * 2.0)) +
      itemFlatDamageBonus;
  }

  const rawHit =
    move.hit +
    actorEff.hitBonus +
    (actorEff.spe - targetEff.spe) * 2 -
    targetTerrainBonuses.avoidBonus;
  const hitRate = clampInt(rawHit, 15, 100);

  const rawCrit = move.crit + Math.floor(actorEff.spe / 2) + actorEff.critBonus;
  const critRate = typeMultiplier === 0 ? 0 : clampInt(rawCrit, 0, 100);

  const canDouble = actorEff.spe - targetEff.spe >= 5 && moveSlot.ppRemaining >= 2;
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
      defenderSide = buildSideForecast(defender, attacker, defSlot, attackerTerrainBonuses);
    }
  }

  let projAttackerHp = attacker.currentHp;
  let projDefenderHp = defender.currentHp;

  projDefenderHp = Math.max(0, projDefenderHp - attackerSide.damage);

  if (projDefenderHp > 0 && defenderCanCounter && defenderSide) {
    projAttackerHp = Math.max(0, projAttackerHp - defenderSide.damage);
  }

  if (projAttackerHp > 0 && projDefenderHp > 0 && attackerSide.strikes === 2) {
    projDefenderHp = Math.max(0, projDefenderHp - attackerSide.damage);
  }

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
