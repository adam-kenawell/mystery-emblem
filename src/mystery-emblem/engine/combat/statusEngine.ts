/**
 * Step 7 Tactical Status Conditions Engine (`BRN`, `PSN`, `PAR`, `SLP`, `FRZ`)
 *
 * Pure rules for type/skill immunities, non-damaging status hex forecasts (`Will-O-Wisp`,
 * `Thunder Wave`, `Toxic`, `Hypnosis`), secondary status rolls on damaging moves, Held Lum Berry
 * auto-cures, and start-of-phase chip / recovery ticks.
 */

import { getItemById } from '../../data/index';
import type {
  DungeonMapDefinition,
  MoveDefinition,
  StatusCondition,
  TerrainType,
} from '../../types/schemas';
import { getMapTerrainAt, getTerrainBonuses } from '../terrainAndPathfinding';
import {
  getUnitEffectiveCombatStats,
  manhattanDistance,
  type BattleMoveSlot,
  type BattleUnitState,
} from './combatTypesAndStats';

export const STATUS_BADGE_COLORS: Readonly<Record<StatusCondition, string>> = {
  BRN: '#ff7848',
  PSN: '#c868f8',
  PAR: '#f8d848',
  SLP: '#98c8ff',
  FRZ: '#68e8ff',
};

export const STATUS_ACTION_CALLOUTS: Readonly<Record<StatusCondition, string>> = {
  BRN: 'BURNED!',
  PSN: 'POISONED!',
  PAR: 'PARALYZED!',
  SLP: 'ASLEEP!',
  FRZ: 'FROZEN!',
};

export const STATUS_SHORT_EFFECT_TEXT: Readonly<Record<StatusCondition, string>> = {
  BRN: 'BRN (-50% Phys Atk, 10% chip)',
  PSN: 'PSN (10% HP chip/turn)',
  PAR: 'PAR (-25% Spe, 33% skip)',
  SLP: 'SLP (2T immobile, no counter)',
  FRZ: 'FRZ (2T -50% SpA)',
};

export function isEnemyStatusMove(
  move: MoveDefinition | undefined | null
): move is MoveDefinition {
  return Boolean(
    move &&
      move.category === 'Support/Heal' &&
      move.supportSubkind === 'status' &&
      move.targetType === 'enemy' &&
      move.supportPayload?.inflictStatus
  );
}

export function getDefaultStatusDuration(status: StatusCondition): number | undefined {
  if (status === 'SLP' || status === 'FRZ') return 2;
  return undefined;
}

export function isUnitImmuneToStatus(
  target: Pick<BattleUnitState, 'types' | 'personalSkillId'>,
  status: StatusCondition,
  fromNonDamagingMove = false
): { immune: boolean; reason: string | null } {
  if (target.personalSkillId === 'purifying_salt') {
    return { immune: true, reason: 'Purifying Salt' };
  }
  if (fromNonDamagingMove && target.personalSkillId === 'magic_bounce') {
    return { immune: true, reason: 'Magic Bounce' };
  }
  if (status === 'BRN' && target.types.includes('Fire')) {
    return { immune: true, reason: 'Fire Immune' };
  }
  if (status === 'PSN' && (target.types.includes('Poison') || target.types.includes('Steel'))) {
    return { immune: true, reason: 'Type Immune' };
  }
  if (status === 'PAR' && target.types.includes('Electric')) {
    return { immune: true, reason: 'Electric Immune' };
  }
  if (status === 'FRZ' && target.types.includes('Ice')) {
    return { immune: true, reason: 'Ice Immune' };
  }
  return { immune: false, reason: null };
}

export function getEnemyStatusMovesAtDistance(
  caster: Pick<BattleUnitState, 'activeMoves' | 'heldItemId'>,
  distance: number
): BattleMoveSlot[] {
  if (caster.heldItemId && getItemById(caster.heldItemId)?.effect.assaultVestSpdBoost) {
    return [];
  }
  return caster.activeMoves.filter(
    (slot) =>
      slot.ppRemaining > 0 &&
      isEnemyStatusMove(slot.move) &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
  );
}

export interface StatusMoveForecast {
  distance: number;
  casterPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  casterTerrain: TerrainType;
  targetTerrain: TerrainType;
  move: MoveDefinition;
  inflictStatus: StatusCondition;
  ppBefore: number;
  ppAfter: number;
  hitRate: number;
  alreadyAfflicted: boolean;
  targetImmune: boolean;
  blockedReason: string | null;
}

export function computeStatusMoveForecast(
  map: DungeonMapDefinition,
  caster: BattleUnitState,
  target: BattleUnitState,
  moveId: string,
  casterPosOverride?: { x: number; y: number }
): StatusMoveForecast | null {
  const cx = casterPosOverride?.x ?? caster.x;
  const cy = casterPosOverride?.y ?? caster.y;
  const distance = manhattanDistance(cx, cy, target.x, target.y);

  const validSlots = getEnemyStatusMovesAtDistance(caster, distance);
  const slot = validSlots.find((s) => s.id === moveId) ?? validSlots[0];
  const inflictStatus = slot?.move.supportPayload?.inflictStatus;
  if (!slot || !inflictStatus) return null;

  const casterEff = getUnitEffectiveCombatStats(caster);
  const targetEff = getUnitEffectiveCombatStats(target);
  const casterTerrain = getMapTerrainAt(map, cx, cy) ?? 'floor';
  const targetTerrain = getMapTerrainAt(map, target.x, target.y) ?? 'floor';
  const targetBonuses = getTerrainBonuses(targetTerrain, target);

  const immunity = isUnitImmuneToStatus(target, inflictStatus, true);
  const alreadyAfflicted = target.status !== null;
  let blockedReason: string | null = null;
  if (immunity.immune) {
    blockedReason = immunity.reason ?? 'Immune';
  } else if (alreadyAfflicted) {
    blockedReason = `Already ${target.status}`;
  }

  let skillHitBonus = 0;
  if (caster.personalSkillId === 'prankster' || caster.personalSkillId === 'keen_eye') {
    skillHitBonus += 15;
  }

  let hitRate = 0;
  if (!blockedReason) {
    if (caster.personalSkillId === 'no_guard') {
      hitRate = 100;
    } else {
      const rawHit =
        slot.move.hit +
        casterEff.hitBonus +
        skillHitBonus +
        (casterEff.spe - targetEff.spe) * 2 -
        targetBonuses.avoidBonus;
      hitRate = Math.max(15, Math.min(100, Math.round(rawHit)));
    }
  }

  return {
    distance,
    casterPos: { x: cx, y: cy },
    targetPos: { x: target.x, y: target.y },
    casterTerrain,
    targetTerrain,
    move: slot.move,
    inflictStatus,
    ppBefore: slot.ppRemaining,
    ppAfter: Math.max(0, slot.ppRemaining - 1),
    hitRate,
    alreadyAfflicted,
    targetImmune: immunity.immune,
    blockedReason,
  };
}

export function rollSecondaryStatusOnHit(
  move: MoveDefinition,
  actor: Pick<BattleUnitState, 'personalSkillId'>,
  target: Pick<BattleUnitState, 'types' | 'personalSkillId'>,
  currentTargetStatus: StatusCondition | null,
  rng: () => number
): StatusCondition | null {
  const sec = move.secondaryEffect;
  if (!sec?.status || currentTargetStatus !== null) return null;
  if (isUnitImmuneToStatus(target, sec.status, false).immune) return null;

  const chance = Math.min(
    100,
    sec.chance * (actor.personalSkillId === 'serene_grace' ? 2 : 1)
  );
  const r = rng();
  const roll = Math.floor(Math.max(0, Math.min(0.999999, Number.isFinite(r) ? r : 0.5)) * 100) + 1;
  return roll <= chance ? sec.status : null;
}

export function applyInflictedStatusToUnit(
  unit: BattleUnitState,
  status: StatusCondition
): { applied: boolean; lumBerryConsumed: boolean } {
  if (unit.heldItemId && getItemById(unit.heldItemId)?.effect.berryCureAllStatus) {
    unit.heldItemId = null;
    unit.status = null;
    unit.statusTurns = 0;
    return { applied: false, lumBerryConsumed: true };
  }
  unit.status = status;
  unit.statusTurns = getDefaultStatusDuration(status);
  return { applied: true, lumBerryConsumed: false };
}

export interface PhaseStatusTickOutcome {
  chipDamage: number;
  clearedStatus: StatusCondition | null;
  calloutText: string | null;
  calloutColor: string;
}

export function applyPhaseStartStatusTick(unit: BattleUnitState): PhaseStatusTickOutcome {
  if (!unit.status || unit.defeated || unit.currentHp <= 0) {
    return { chipDamage: 0, clearedStatus: null, calloutText: null, calloutColor: '#ffffff' };
  }

  if (unit.status === 'SLP' || unit.status === 'FRZ') {
    const prev = unit.status;
    const rem = (unit.statusTurns ?? 2) - 1;
    if (rem <= 0) {
      unit.status = null;
      unit.statusTurns = 0;
      return {
        chipDamage: 0,
        clearedStatus: prev,
        calloutText: prev === 'SLP' ? 'WOKE UP!' : 'THAWED!',
        calloutColor: '#98f8b8',
      };
    }
    unit.statusTurns = rem;
    return { chipDamage: 0, clearedStatus: null, calloutText: null, calloutColor: '#ffffff' };
  }

  if (unit.status === 'BRN' || unit.status === 'PSN') {
    if (unit.personalSkillId === 'magic_guard' || unit.currentHp <= 1) {
      return { chipDamage: 0, clearedStatus: null, calloutText: null, calloutColor: '#ffffff' };
    }
    const rawChip = Math.max(1, Math.floor(unit.maxHp * 0.1));
    const chip = Math.min(unit.currentHp - 1, rawChip);
    if (chip <= 0) {
      return { chipDamage: 0, clearedStatus: null, calloutText: null, calloutColor: '#ffffff' };
    }
    unit.currentHp -= chip;
    const isBurn = unit.status === 'BRN';
    return {
      chipDamage: chip,
      clearedStatus: null,
      calloutText: `${isBurn ? 'BURN' : 'POISON'} -${chip}`,
      calloutColor: isBurn ? STATUS_BADGE_COLORS.BRN : STATUS_BADGE_COLORS.PSN,
    };
  }

  return { chipDamage: 0, clearedStatus: null, calloutText: null, calloutColor: '#ffffff' };
}
