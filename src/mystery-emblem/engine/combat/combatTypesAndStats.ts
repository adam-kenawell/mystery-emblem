/**
 * Core Battle Unit State Types, Move Classification & Effective Combat Stat Calculator
 */

import type { PmdDirection, PmdSpriteAction } from '../../assets/pmdAssetLoader';
import { getItemById, getMoveById, getSpeciesById } from '../../data/index';
import {
  getEquippedMoveIds,
  isMoveEquipped,
  type EquippedMoveSlots,
} from '../../data/equippedMoves';
import type {
  DungeonMapDefinition,
  MoveDefinition,
  PokemonType,
  StatBlockSeven,
  StatusCondition,
  TerrainBonuses,
  TerrainType,
  TraversalClass,
  UnitCosmeticForm,
} from '../../types/schemas';
import {
  getMapTerrainAt,
  getTerrainBonuses,
  type ActiveMoveRangeEntry,
  type PathfindingUnitContext,
} from '../terrainAndPathfinding';
import type { TypeEffectivenessLabel, TypeEffectivenessMultiplier } from './typeEffectiveness';

export interface BattleMoveSlot extends ActiveMoveRangeEntry {
  maxPp: number;
  move: MoveDefinition;
}

export interface TempBattleBoosts {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  crit: number;
}

export interface BattleUnitState extends PathfindingUnitContext, EquippedMoveSlots {
  slotIndex: number;
  rosterInstanceId?: string;
  isLord: boolean;
  isBoss?: boolean;
  sparring?: boolean;
  /** Linked enemy squad tag (see `BattleRuntimeState.activatedSquadIds`) */
  squadId?: string;
  mustSurvive?: boolean;
  recruitedMidBattle?: boolean;
  droppableItemId?: string | null;
  speciesId: string;
  speciesName: string;
  nickname: string;
  cosmeticForm?: UnitCosmeticForm;
  level: number;
  exp?: number;
  unlockedMoveIds?: string[];
  maxHp: number;
  currentHp: number;
  stats: StatBlockSeven;
  traversalClass: TraversalClass;
  types: ReadonlyArray<PokemonType>;
  personalSkillId: string;
  heldItemId: string | null;
  consumableItemId: string | null;
  status: StatusCondition | null;
  statusTurns?: number;
  tempBattleBoosts?: TempBattleBoosts;
  activeMoves: BattleMoveSlot[];
  waited: boolean;
  defeated: boolean;
  direction: PmdDirection;
  action: PmdSpriteAction;
  frameIndex: number;
  nextFrameAt: number;
  renderWorldX: number;
  renderWorldY: number;
  hitFlashUntilMs: number;
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

export function isOffensiveMove(
  move: MoveDefinition | undefined | null
): move is MoveDefinition & { category: 'Physical' | 'Special' } {
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
  unit: Pick<BattleUnitState, 'activeMoves' | keyof EquippedMoveSlots>,
  distance: number
): BattleMoveSlot[] {
  const matching = unit.activeMoves.filter(
    (slot) =>
      slot.ppRemaining > 0 &&
      isOffensiveMove(slot.move) &&
      distance >= slot.range[0] &&
      distance <= slot.range[1]
  );
  matching.sort((a, b) => (isMoveEquipped(unit, a.id) ? 0 : 1) - (isMoveEquipped(unit, b.id) ? 0 : 1));
  return matching;
}

export function getEnemyTargetingMovesAtDistance(
  unit: Pick<BattleUnitState, 'activeMoves' | keyof EquippedMoveSlots> & { heldItemId?: string | null },
  distance: number
): BattleMoveSlot[] {
  const assaultVestBlocksSupport = Boolean(
    unit.heldItemId && getItemById(unit.heldItemId)?.effect.assaultVestSpdBoost
  );
  const matching = unit.activeMoves.filter((slot) => {
    if (slot.ppRemaining <= 0 || distance < slot.range[0] || distance > slot.range[1]) {
      return false;
    }
    if (isOffensiveMove(slot.move)) return true;
    return (
      !assaultVestBlocksSupport &&
      slot.move.category === 'Support/Heal' &&
      slot.move.supportSubkind === 'status' &&
      slot.move.targetType === 'enemy' &&
      Boolean(slot.move.supportPayload?.inflictStatus)
    );
  });

  matching.sort((a, b) => {
    const aRank = isMoveEquipped(unit, a.id) ? 0 : isOffensiveMove(a.move) ? 1 : 2;
    const bRank = isMoveEquipped(unit, b.id) ? 0 : isOffensiveMove(b.move) ? 1 : 2;
    return aRank - bRank;
  });
  return matching;
}

export function getUnitEffectiveCombatStats(
  unit: Pick<BattleUnitState, 'speciesId' | 'stats' | 'heldItemId' | 'tempBattleBoosts'> & {
    status?: StatusCondition | null;
    personalSkillId?: string;
  }
): {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  hitBonus: number;
  critBonus: number;
} {
  const boosts = unit.tempBattleBoosts;
  let atk = unit.stats.atk + (boosts?.atk ?? 0);
  let def = unit.stats.def + (boosts?.def ?? 0);
  let spa = unit.stats.spa + (boosts?.spa ?? 0);
  let spd = unit.stats.spd + (boosts?.spd ?? 0);
  let spe = unit.stats.spe + (boosts?.spe ?? 0);
  let hitBonus = 0;
  let critBonus = boosts?.crit ?? 0;

  if (unit.heldItemId) {
    const item = getItemById(unit.heldItemId);
    if (item) {
      const eff = item.effect;
      if (eff.choiceStatBoost) {
        atk += eff.choiceStatBoost.atk ?? 0;
        def += eff.choiceStatBoost.def ?? 0;
        spa += eff.choiceStatBoost.spa ?? 0;
        spd += eff.choiceStatBoost.spd ?? 0;
        spe += eff.choiceStatBoost.spe ?? 0;
      }
      if (eff.assaultVestSpdBoost) spd += eff.assaultVestSpdBoost;
      if (eff.evioliteDefSpdBoost) {
        const sp = getSpeciesById(unit.speciesId);
        if (sp && !sp.isFinalStage) {
          def += eff.evioliteDefSpdBoost;
          spd += eff.evioliteDefSpdBoost;
        }
      }
      if (eff.hitBonus) hitBonus += eff.hitBonus;
      if (eff.critBonus) critBonus += eff.critBonus;
    }
  }

  if (unit.status && unit.personalSkillId === 'guts') atk += 3;
  if (unit.status === 'PAR') spe = Math.max(1, Math.floor(spe * 0.75));

  return { atk, def, spa, spd, spe, hitBonus, critBonus };
}

export interface UnitPopupCombatSummary {
  /** Might of the equipped Physical (Range 1) move, or null if none is equipped. */
  physicalMight: number | null;
  /** Might of the equipped Special (Range 2) move, or null if none is equipped. */
  specialMight: number | null;
  effectiveDef: number;
  effectiveSpd: number;
  /** Effective Speed (base + boosts + held item; PAR penalty). Terrain grants no Speed bonus. */
  effectiveSpe: number;
  terrainDefBonus: number;
  terrainSpdBonus: number;
  terrainAvoidBonus: number;
}

export function computeUnitPopupStats(
  map: DungeonMapDefinition,
  unit: BattleUnitState
): UnitPopupCombatSummary {
  const eff = getUnitEffectiveCombatStats(unit);
  const terrain = getMapTerrainAt(map, unit.x, unit.y) ?? 'floor';
  const terrainBonuses = getTerrainBonuses(terrain, unit);

  const effectiveDef = eff.def + terrainBonuses.defBonus;
  const effectiveSpd = eff.spd + terrainBonuses.spdBonus;

  let physicalMight: number | null = null;
  let specialMight: number | null = null;

  for (const moveId of getEquippedMoveIds(unit)) {
    const slot = unit.activeMoves.find((s) => s.id === moveId);
    const move = slot?.move ?? getMoveById(moveId);
    if (move && isOffensiveMove(move)) {
      const isPhysical = move.category === 'Physical';

      let effectiveOffensiveStat = isPhysical ? eff.atk : eff.spa;
      if (isPhysical && unit.status === 'BRN' && unit.personalSkillId !== 'guts') {
        effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
      } else if (!isPhysical && unit.status === 'FRZ') {
        effectiveOffensiveStat = Math.floor(effectiveOffensiveStat * 0.5);
      }

      let itemFlatDamageBonus = 0;
      if (unit.heldItemId) {
        const held = getItemById(unit.heldItemId);
        if (held) {
          const itemEff = held.effect;
          if (isPhysical && itemEff.physicalDamageBonus) itemFlatDamageBonus += itemEff.physicalDamageBonus;
          if (!isPhysical && itemEff.specialDamageBonus) itemFlatDamageBonus += itemEff.specialDamageBonus;
          if (itemEff.flatDamageBonus && (!itemEff.boostedType || itemEff.boostedType === move.type)) {
            itemFlatDamageBonus += itemEff.flatDamageBonus;
          }
        }
      }

      const might = effectiveOffensiveStat + move.mt + itemFlatDamageBonus;
      if (isPhysical) physicalMight = might;
      else specialMight = might;
    }
  }

  return {
    physicalMight,
    specialMight,
    effectiveDef,
    effectiveSpd,
    effectiveSpe: eff.spe,
    terrainDefBonus: terrainBonuses.defBonus,
    terrainSpdBonus: terrainBonuses.spdBonus,
    terrainAvoidBonus: terrainBonuses.avoidBonus,
  };
}
