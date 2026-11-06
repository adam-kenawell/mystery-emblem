import speciesRaw from './pokemon_species.json';
import movesRaw from './moves.json';
import itemsRaw from './items.json';
import skillsRaw from './personal_skills.json';
import {
  type ItemDefinition,
  type MoveDefinition,
  type PersonalSkillDefinition,
  type PokemonSpeciesDefinition,
  type RecruitCategory,
} from '../types/schemas';
import { validateAllRegistries, type RegistryValidationSummary } from '../types/validators';

export const POKEMON_SPECIES_LIST = speciesRaw as PokemonSpeciesDefinition[];
export const MOVES_LIST = movesRaw as MoveDefinition[];
export const ITEMS_LIST = itemsRaw as ItemDefinition[];
export const PERSONAL_SKILLS_LIST = skillsRaw as PersonalSkillDefinition[];

export const SPECIES_MAP: ReadonlyMap<string, PokemonSpeciesDefinition> = new Map(
  POKEMON_SPECIES_LIST.map((sp) => [sp.id, sp])
);

export const MOVE_MAP: ReadonlyMap<string, MoveDefinition> = new Map(
  MOVES_LIST.map((mv) => [mv.id, mv])
);

export const ITEM_MAP: ReadonlyMap<string, ItemDefinition> = new Map(
  ITEMS_LIST.map((it) => [it.id, it])
);

export const PERSONAL_SKILL_MAP: ReadonlyMap<string, PersonalSkillDefinition> = new Map(
  PERSONAL_SKILLS_LIST.map((sk) => [sk.id, sk])
);

const LINE_SPECIES_MAP: ReadonlyMap<string, PokemonSpeciesDefinition[]> = (() => {
  const map = new Map<string, PokemonSpeciesDefinition[]>();
  for (const sp of POKEMON_SPECIES_LIST) {
    const list = map.get(sp.lineId) ?? [];
    list.push(sp);
    map.set(sp.lineId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.stage - b.stage || a.dexNumber - b.dexNumber || a.id.localeCompare(b.id));
  }
  return map;
})();

let cachedValidation: RegistryValidationSummary | null = null;

export function getRegistryValidationSummary(): RegistryValidationSummary {
  if (!cachedValidation) {
    cachedValidation = validateAllRegistries(
      POKEMON_SPECIES_LIST,
      MOVES_LIST,
      ITEMS_LIST,
      PERSONAL_SKILLS_LIST
    );
  }
  return cachedValidation;
}

export function getSpeciesById(id: string): PokemonSpeciesDefinition | undefined {
  return SPECIES_MAP.get(id);
}

export function getSpeciesByLineId(lineId: string): PokemonSpeciesDefinition[] {
  return [...(LINE_SPECIES_MAP.get(lineId) ?? [])];
}

export function getMoveById(id: string): MoveDefinition | undefined {
  return MOVE_MAP.get(id);
}

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEM_MAP.get(id);
}

export function getPersonalSkillById(id: string): PersonalSkillDefinition | undefined {
  return PERSONAL_SKILL_MAP.get(id);
}

export function getStage1SpeciesByCategory(category: RecruitCategory): PokemonSpeciesDefinition[] {
  return POKEMON_SPECIES_LIST.filter((sp) => sp.stage === 1 && sp.recruitCategory === category);
}
