/**
 * PMD Cosmetic Subform & Species/Item Asset Target Resolvers (`subformResolver.ts`)
 */

import { ITEM_MAP, SPECIES_MAP } from '../data/index';
import type {
  FlabebeFlowerColor,
  ItemDefinition,
  OricorioStyle,
  PokemonSpeciesDefinition,
  UnitCosmeticForm,
} from '../types/schemas';
import { normalizeAssetPath } from '../../utils/sprite-utils';

export const FLABEBE_SUBFORM_BY_COLOR: Readonly<Record<FlabebeFlowerColor, string>> = {
  red: '',
  yellow: '0001',
  orange: '0002',
  blue: '0003',
  white: '0004',
};

export const ORICORIO_SUBFORM_BY_STYLE: Readonly<Record<OricorioStyle, string>> = {
  baile: '',
  pom_pom: '0001',
  pau: '0002',
  sensu: '0003',
};

/**
 * Maps each of the 5 playable Dragon Lords in the Lore Bible to Flabébé's canonical flower color:
 * - Axew    -> Red (`0669`)
 * - Bagon   -> Orange (`0669/0002`)
 * - Gible   -> Yellow (`0669/0001`)
 * - Dratini -> Blue (`0669/0003`)
 * - Goomy   -> White (`0669/0004`)
 */
export function getFlabebeFlowerColorForLord(
  lordSpeciesIdOrLineId: string | null | undefined
): FlabebeFlowerColor {
  const raw = (lordSpeciesIdOrLineId ?? '').trim().toLowerCase();
  const sp = SPECIES_MAP.get(raw);
  const lineKey = sp ? sp.lineId : raw;
  if (lineKey.startsWith('axew')) return 'red';
  if (lineKey.startsWith('bagon')) return 'orange';
  if (lineKey.startsWith('gible')) return 'yellow';
  if (lineKey.startsWith('dratini')) return 'blue';
  if (lineKey.startsWith('goomy')) return 'white';
  return 'blue';
}

/**
 * Resolves the PMD visual asset identifier for a unit (`speciesId` or `XXXX/YYYY` subform path),
 * preserving Flabébé -> Floette -> Florges flower color and Oricorio dance style.
 */
export function resolveUnitVisualAssetId(
  speciesId: string,
  cosmeticForm?: UnitCosmeticForm | null
): string {
  const sp = SPECIES_MAP.get(speciesId.trim());
  if (!sp) return speciesId;
  if (sp.lineId === 'flabebe_line' && cosmeticForm && cosmeticForm in FLABEBE_SUBFORM_BY_COLOR) {
    const subform = FLABEBE_SUBFORM_BY_COLOR[cosmeticForm as FlabebeFlowerColor];
    if (subform) return `${sp.pmdAssetId}/${subform}`;
  }
  if (sp.lineId === 'oricorio_line' && cosmeticForm && cosmeticForm in ORICORIO_SUBFORM_BY_STYLE) {
    const subform = ORICORIO_SUBFORM_BY_STYLE[cosmeticForm as OricorioStyle];
    if (subform) return `${sp.pmdAssetId}/${subform}`;
  }
  return sp.id;
}

export function resolveSpeciesAssetTarget(speciesIdOrAssetId: string): {
  pmdAssetId: string;
  species?: PokemonSpeciesDefinition;
} {
  const trimmed = speciesIdOrAssetId.trim();
  const species = SPECIES_MAP.get(trimmed);
  if (species) {
    return { pmdAssetId: species.pmdAssetId, species };
  }
  return { pmdAssetId: normalizeAssetPath(trimmed) };
}

export function resolveItemIconTarget(itemIdOrSlug: string): {
  iconSlug: string;
  item?: ItemDefinition;
} {
  const trimmed = itemIdOrSlug.trim();
  const item = ITEM_MAP.get(trimmed);
  if (item) {
    return { iconSlug: item.iconSlug, item };
  }
  return { iconSlug: trimmed.replace(/_/g, '-') };
}
