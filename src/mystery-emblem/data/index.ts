import consumablesAndVitaminsRaw from './items/consumables_and_vitamins.json';
import heldItemsRaw from './items/held_items.json';
import tmsRaw from './items/tms.json';
import physicalMovesRaw from './moves/physical.json';
import specialMovesRaw from './moves/special.json';
import supportMovesRaw from './moves/support.json';
import skillsRaw from './personal_skills.json';
import enemiesCommonwealthSandRaw from './species/enemies_commonwealth_sand.json';
import enemiesEmpireAbyssRaw from './species/enemies_empire_abyss.json';
import lineLearnsetsRaw from './species/line_learnsets.json';
import playableCoreRaw from './species/playable_core.json';
import playableParaloguesRaw from './species/playable_paralogues.json';
import playableQuizEarlyRaw from './species/playable_quiz_early.json';
import playableQuizLateRaw from './species/playable_quiz_late.json';
import playableStoryRaw from './species/playable_story.json';
import {
  type ItemDefinition,
  type LearnsetEntry,
  type MoveDefinition,
  type PersonalSkillDefinition,
  type PokemonSpeciesDefinition,
  type RecruitCategory,
} from '../types/schemas';
import { validateAllRegistries, type RegistryValidationSummary } from '../types/validators';

type RawLearnsetTuple = readonly [number, string];

interface RawLineLearnsetBundle {
  learnset: RawLearnsetTuple[];
  compatibleTmIds: string[];
}

type RawSpeciesShardEntry = Omit<PokemonSpeciesDefinition, 'learnset' | 'compatibleTmIds'> & {
  learnset?: RawLearnsetTuple[];
  compatibleTmIds?: string[];
};

const LINE_LEARNSETS = lineLearnsetsRaw as unknown as Record<string, RawLineLearnsetBundle>;

function hydrateSpeciesEntry(raw: RawSpeciesShardEntry): PokemonSpeciesDefinition {
  const shared = LINE_LEARNSETS[raw.lineId];
  const tuples = raw.learnset ?? shared?.learnset ?? [];
  const learnset: LearnsetEntry[] = tuples.map(([level, moveId]) => ({ level, moveId }));
  const compatibleTmIds = [...(raw.compatibleTmIds ?? shared?.compatibleTmIds ?? [])];
  return {
    ...raw,
    learnset,
    compatibleTmIds,
  };
}

const RAW_SPECIES_SHARDS: readonly RawSpeciesShardEntry[] = [
  ...(playableCoreRaw as unknown as RawSpeciesShardEntry[]),
  ...(playableStoryRaw as unknown as RawSpeciesShardEntry[]),
  ...(playableQuizEarlyRaw as unknown as RawSpeciesShardEntry[]),
  ...(playableQuizLateRaw as unknown as RawSpeciesShardEntry[]),
  ...(playableParaloguesRaw as unknown as RawSpeciesShardEntry[]),
  ...(enemiesCommonwealthSandRaw as unknown as RawSpeciesShardEntry[]),
  ...(enemiesEmpireAbyssRaw as unknown as RawSpeciesShardEntry[]),
];

export const POKEMON_SPECIES_LIST: PokemonSpeciesDefinition[] =
  RAW_SPECIES_SHARDS.map(hydrateSpeciesEntry);

export const MOVES_LIST: MoveDefinition[] = [
  ...(physicalMovesRaw as unknown as MoveDefinition[]),
  ...(specialMovesRaw as unknown as MoveDefinition[]),
  ...(supportMovesRaw as unknown as MoveDefinition[]),
];

export const ITEMS_LIST: ItemDefinition[] = [
  ...(consumablesAndVitaminsRaw as unknown as ItemDefinition[]),
  ...(heldItemsRaw as unknown as ItemDefinition[]),
  ...(tmsRaw as unknown as ItemDefinition[]),
];

export const PERSONAL_SKILLS_LIST = skillsRaw as unknown as PersonalSkillDefinition[];

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
