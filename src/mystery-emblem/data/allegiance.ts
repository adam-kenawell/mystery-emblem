/**
 * Unit Allegiance Labels (`allegiance.ts`)
 *
 * Shown on the dungeon unit info card. Player units always serve the Verdant Commonwealth.
 * Enemies nicknamed `Feral ...` are Abyss-corrupted wilds; everyone else resolves by species line.
 */

import type { UnitBattleFaction } from '../types/schemas';
import { getSpeciesById } from './index';

export type UnitAllegiance =
  | 'Verdant Commonwealth'
  | 'Umbral Canopy'
  | 'Goldensand Monarchy'
  | 'Cinderpeak Dominion'
  | 'Frostspire Enclave'
  | 'Ironscale Empire'
  | 'Feral';

const LINE_ALLEGIANCE: Readonly<Record<string, UnitAllegiance>> = {
  // Verdant Commonwealth
  sir_empoleon_line: 'Verdant Commonwealth',
  piplup_line: 'Verdant Commonwealth',
  flabebe_line: 'Verdant Commonwealth',
  wimpod_line: 'Verdant Commonwealth',
  ralts_line: 'Verdant Commonwealth',
  abra_line: 'Verdant Commonwealth',
  solosis_line: 'Verdant Commonwealth',
  slakoth_line: 'Verdant Commonwealth',
  // Umbral Canopy
  seedot_line: 'Umbral Canopy',
  dreepy_line: 'Umbral Canopy',
  // Goldensand Monarchy
  sandile_line: 'Goldensand Monarchy',
  tinkatink_line: 'Goldensand Monarchy',
  kecleon_line: 'Goldensand Monarchy',
  // Cinderpeak Dominion
  torchic_line: 'Cinderpeak Dominion',
  chimchar_line: 'Cinderpeak Dominion',
  // Frostspire Enclave
  frigibax_line: 'Frostspire Enclave',
  swinub_line: 'Frostspire Enclave',
  vanillite_line: 'Frostspire Enclave',
  // Ironscale Empire
  aron_line: 'Ironscale Empire',
  pawniard_line: 'Ironscale Empire',
  rookidee_line: 'Ironscale Empire',
  zigzagoon_galar_line: 'Ironscale Empire',
  impidimp_line: 'Ironscale Empire',
  rolycoly_line: 'Ironscale Empire',
  deino_line: 'Ironscale Empire',
  gothita_line: 'Ironscale Empire',
  honedge_line: 'Ironscale Empire',
  skarmory_line: 'Ironscale Empire',
  spheal_line: 'Ironscale Empire',
  gastly_line: 'Ironscale Empire',
  abyssal_tyranitar_line: 'Ironscale Empire',
  // Feral (Abyss-corrupted wilds)
  zubat_line: 'Feral',
  venipede_line: 'Feral',
  croagunk_line: 'Feral',
  stufful_line: 'Feral',
  timburr_line: 'Feral',
  tynamo_line: 'Feral',
  spiritomb_line: 'Feral',
};

export function resolveUnitAllegiance(unit: {
  faction: UnitBattleFaction;
  speciesId: string;
  nickname?: string;
}): UnitAllegiance {
  if (unit.faction === 'player') return 'Verdant Commonwealth';
  if (unit.faction === 'enemy' && /^feral\b/i.test(unit.nickname?.trim() ?? '')) return 'Feral';
  const lineId = getSpeciesById(unit.speciesId)?.lineId;
  const mapped = lineId ? LINE_ALLEGIANCE[lineId] : undefined;
  if (mapped) return mapped;
  return unit.faction === 'enemy' ? 'Feral' : 'Verdant Commonwealth';
}
