/**
 * Pure 1-to-4 Strike Combat Exchange Resolver
 */

import type { MoveDefinition, StatusCondition } from '../../types/schemas';
import type {
  BattleUnitState,
  CombatForecast,
  CombatSideForecast,
} from './combatTypesAndStats';
import { rollSecondaryStatusOnHit } from './statusEngine';
import type { TypeEffectivenessMultiplier } from './typeEffectiveness';

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
  inflictedStatus: StatusCondition | null;
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
 * so the scene animation controller can apply each strike's HP/PP/status delta on its exact impact frame.
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
  let attackerStatus: StatusCondition | null = attacker.status;
  let defenderStatus: StatusCondition | null = defender.status;

  const strikes: CombatStrikeOutcome[] = [];

  const rollPercent100 = (): number => {
    const r = rng();
    const clamped = Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5));
    return Math.floor(clamped * 100) + 1;
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

    const curActorStatus = isCounter ? defenderStatus : attackerStatus;
    if (curActorStatus === 'SLP') return;

    if (curActorStatus === 'PAR') {
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
          inflictedStatus: null,
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
    // Sparring bouts never knock anyone out: strikes to or from a sparring unit stop at 1 HP.
    const isSparringStrike = Boolean(actor.sparring || target.sparring);
    const hpFloor = isSparringStrike ? Math.min(1, hpBefore) : 0;
    damageDealt = Math.min(damageDealt, Math.max(0, hpBefore - hpFloor));
    const hpAfter = Math.max(0, hpBefore - damageDealt);
    if (isCounter) {
      attackerHp = hpAfter;
    } else {
      defenderHp = hpAfter;
    }

    let inflictedStatus: StatusCondition | null = null;
    if (didHit && side.typeMultiplier > 0 && hpAfter > 0) {
      const curTargetStatus = isCounter ? attackerStatus : defenderStatus;
      inflictedStatus = rollSecondaryStatusOnHit(side.move, actor, target, curTargetStatus, rng);
      if (inflictedStatus) {
        if (isCounter) attackerStatus = inflictedStatus;
        else defenderStatus = inflictedStatus;
      }
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
      inflictedStatus,
      typeMultiplier: side.typeMultiplier,
      targetHpBefore: hpBefore,
      targetHpAfter: hpAfter,
      targetDefeated: hpAfter <= 0,
    });
  };

  if (attackerStatus !== 'SLP' && attackerHp > 0 && defenderHp > 0) {
    runSingleStrike(attacker, defender, forecast.attackerSide, false, false);
  }

  if (
    defenderStatus !== 'SLP' &&
    attackerHp > 0 &&
    defenderHp > 0 &&
    forecast.defenderCanCounter &&
    forecast.defenderSide
  ) {
    runSingleStrike(defender, attacker, forecast.defenderSide, true, false);
  }

  if (
    attackerStatus !== 'SLP' &&
    attackerHp > 0 &&
    defenderHp > 0 &&
    forecast.attackerSide.strikes === 2 &&
    attackerPp > 0
  ) {
    runSingleStrike(attacker, defender, forecast.attackerSide, false, true);
  }

  if (
    defenderStatus !== 'SLP' &&
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
