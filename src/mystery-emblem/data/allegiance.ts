/**
 * Unit Allegiance Labels (`allegiance.ts`)
 *
 * Shown on the dungeon unit info card across the 5 Kingdoms and Space-Time Rift.
 */

import type { UnitBattleFaction } from '../types/schemas';
import { getSpeciesById } from './index';

export type UnitAllegiance =
  | 'Verdant Kingdom'
  | 'Forest Tribe'
  | 'Sand Kingdom'
  | 'Fire Kingdom'
  | 'Ice Kingdom'
  | 'Steel Kingdom'
  | 'Space-Time Rift'
  | 'Outlaws'
  | 'Wild';

const LINE_ALLEGIANCE: Readonly<Record<string, UnitAllegiance>> = {
  // Verdant Kingdom
  mentor_quaquaval_line: 'Verdant Kingdom',
  quaxly_line: 'Verdant Kingdom',
  flabebe_line: 'Verdant Kingdom',
  smoliv_line: 'Verdant Kingdom',
  machop_line: 'Verdant Kingdom',
  starly_line: 'Verdant Kingdom',
  caterpie_line: 'Verdant Kingdom',
  pawmi_line: 'Verdant Kingdom',
  slakoth_line: 'Verdant Kingdom',
  ralts_line: 'Verdant Kingdom',
  abra_line: 'Verdant Kingdom',
  solosis_line: 'Verdant Kingdom',
  // Forest Tribe
  seedot_line: 'Forest Tribe',
  dreepy_line: 'Forest Tribe',
  sewaddle_line: 'Forest Tribe',
  // Sand Kingdom
  sandile_line: 'Sand Kingdom',
  tinkatink_line: 'Sand Kingdom',
  kecleon_line: 'Sand Kingdom',
  // Fire Kingdom
  torchic_line: 'Fire Kingdom',
  chimchar_line: 'Fire Kingdom',
  // Ice Kingdom
  swinub_line: 'Ice Kingdom',
  vanillite_line: 'Ice Kingdom',
  // Steel Kingdom
  honedge_line: 'Steel Kingdom',
  pawniard_line: 'Steel Kingdom',
  aron_line: 'Steel Kingdom',
  rookidee_line: 'Steel Kingdom',
  rolycoly_line: 'Steel Kingdom',
  deino_line: 'Steel Kingdom',
  gothita_line: 'Steel Kingdom',
  skarmory_line: 'Steel Kingdom',
  spheal_line: 'Steel Kingdom',
  gastly_line: 'Steel Kingdom',
  // Outlaws
  zigzagoon_galar_line: 'Outlaws',
  impidimp_line: 'Outlaws',
  croagunk_line: 'Outlaws',
  timburr_line: 'Outlaws',
  // Wild
  zubat_line: 'Wild',
  venipede_line: 'Wild',
  stufful_line: 'Wild',
  tynamo_line: 'Wild',
  spiritomb_line: 'Wild',
  // Space-Time Rift (Paradoxes & Hoopa)
  great_tusk_line: 'Space-Time Rift',
  scream_tail_line: 'Space-Time Rift',
  brute_bonnet_line: 'Space-Time Rift',
  flutter_mane_line: 'Space-Time Rift',
  slither_wing_line: 'Space-Time Rift',
  sandy_shocks_line: 'Space-Time Rift',
  roaring_moon_line: 'Space-Time Rift',
  iron_treads_line: 'Space-Time Rift',
  iron_bundle_line: 'Space-Time Rift',
  iron_hands_line: 'Space-Time Rift',
  iron_jugulis_line: 'Space-Time Rift',
  iron_moth_line: 'Space-Time Rift',
  iron_thorns_line: 'Space-Time Rift',
  iron_valiant_line: 'Space-Time Rift',
  hoopa_line: 'Space-Time Rift',
};

export function resolveUnitAllegiance(unit: {
  faction: UnitBattleFaction;
  speciesId: string;
  nickname?: string;
}): UnitAllegiance {
  const lineId = getSpeciesById(unit.speciesId)?.lineId;
  if (unit.faction === 'player') {
    if (lineId === 'honedge_line') return 'Steel Kingdom';
    if (lineId === 'sandile_line') return 'Sand Kingdom';
    if (lineId === 'dreepy_line') return 'Forest Tribe';
    return 'Verdant Kingdom';
  }
  const mapped = lineId ? LINE_ALLEGIANCE[lineId] : undefined;
  if (mapped) return mapped;
  return unit.faction === 'enemy' ? 'Wild' : 'Verdant Kingdom';
}
