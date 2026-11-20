/**
 * Lore-Bible Registry & Faction Separation Validators (`registryValidators.ts`)
 *
 * Enforces Rule 1 (manual stats/growths), Rule 4 (R1 Physical / R2 Special / R1..2 Support,
 * zero pure stat-change moves), and Rule 5 (strict faction separation & promotion rules).
 */

import { PMD_EXTENDED_PORTRAIT_EMOTIONS } from '../../assets/pmdAssetTypes';
import {
  BRANCHED_PROMOTION_MIN_LEVEL,
  CONVERTIBLE_FACTION_LINE_IDS,
  DRAGON_LORD_SPECIES_IDS,
  GEM_PROMOTION_MIN_LEVEL,
  MAX_UNIT_LEVEL,
  MIN_UNIT_LEVEL,
  STONE_PROMOTION_MIN_LEVEL,
} from '../../data/campaignConfig';
import {
  getSupportRanksUpTo,
  makeCanonicalSupportPairKey,
  type SupportConversationDoc,
  type SupportPairDefinition,
} from '../../data/supports/supportMatrix';
import {
  ITEM_CATEGORIES,
  MOVE_CATEGORIES,
  POKEMON_TYPES,
  STATUS_CONDITIONS,
  SUPPORT_SUBKINDS,
  TRAVERSAL_CLASSES,
  type ItemDefinition,
  type MoveDefinition,
  type PersonalSkillDefinition,
  type PokemonSpeciesDefinition,
  type StatBlockSix,
} from '../schemas';

export interface RegistryValidationSummary {
  valid: boolean;
  errors: string[];
  counts: {
    totalSpecies: number;
    dragonLordLines: number;
    storyCoreLines: number;
    quizRecruitLines: number;
    storyRecruitLines: number;
    paralogueRecruitLines: number;
    allyNpcLines: number;
    enemyLines: number;
    convertibleLines: string[];
    sharedLines: string[];
    totalMoves: number;
    pureStatChangeMoves: number;
    totalItems: number;
    totalTms: number;
    totalPersonalSkills: number;
  };
}

const VALID_TYPE_SET = new Set<string>(POKEMON_TYPES);
const VALID_TRAVERSAL_SET = new Set<string>(TRAVERSAL_CLASSES);
const VALID_STATUS_SET = new Set<string>(STATUS_CONDITIONS);
const VALID_MOVE_CATEGORY_SET = new Set<string>(MOVE_CATEGORIES);
const VALID_SUPPORT_SUBKIND_SET = new Set<string>(SUPPORT_SUBKINDS);
const VALID_ITEM_CATEGORY_SET = new Set<string>(ITEM_CATEGORIES);
const ASSET_ID_REGEX = /^\d{4}(?:\/\d{4})?$/;
const VALID_EXTENDED_EMOTION_SET = new Set<string>(PMD_EXTENDED_PORTRAIT_EMOTIONS);
const STAT_SIX_KEYS: readonly (keyof StatBlockSix)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export function validateSupportRegistries(
  pairs: readonly SupportPairDefinition[],
  conversations: readonly SupportConversationDoc[]
): string[] {
  const errors: string[] = [];
  const docMap = new Map<string, SupportConversationDoc>();

  for (const doc of conversations) {
    const expectedKey = makeCanonicalSupportPairKey(doc.actorA, doc.actorB);
    if (doc.pairKey !== expectedKey) {
      errors.push(`Support doc "${doc.pairKey}" (${doc.rank}) has non-canonical pairKey (expected "${expectedKey}").`);
    }
    const mapKey = `${expectedKey}::${doc.rank}`;
    if (docMap.has(mapKey)) {
      errors.push(`Duplicate support conversation "${mapKey}".`);
    }
    docMap.set(mapKey, doc);

    if (doc.title && (doc.title.includes('\u2014') || doc.title.includes('--'))) {
      errors.push(`Support doc "${mapKey}" title contains forbidden em-dash punctuation.`);
    }
    const castIds = new Set(doc.cast.map((c) => c.id));
    if (!Array.isArray(doc.beats) || doc.beats.length === 0) {
      errors.push(`Support doc "${mapKey}" has no beats.`);
      continue;
    }
    for (const beat of doc.beats) {
      const say = beat.say;
      if (!say) continue;
      if (say.speaker !== 'narrator' && !castIds.has(say.speaker)) {
        errors.push(`Support doc "${mapKey}" beat "${beat.id}" references unknown cast speaker "${say.speaker}".`);
      }
      if (!VALID_EXTENDED_EMOTION_SET.has(say.emotion)) {
        errors.push(`Support doc "${mapKey}" beat "${beat.id}" has invalid emotion "${say.emotion}".`);
      }
      if (say.text.includes('\u2014') || say.text.includes('--')) {
        errors.push(`Support doc "${mapKey}" beat "${beat.id}" contains forbidden em-dash punctuation.`);
      }
      const tokens = say.text.match(/\{[^}]+\}/g);
      if (tokens) {
        for (const tok of tokens) {
          const castMatch = /^\{name:([a-z0-9_]+)\}$/i.exec(tok);
          if (!castMatch || !castIds.has(castMatch[1]!)) {
            errors.push(`Support doc "${mapKey}" beat "${beat.id}" has unresolved token "${tok}".`);
          }
        }
      }
    }
  }

  for (const pair of pairs) {
    for (const rank of getSupportRanksUpTo(pair.maxRank)) {
      if (!docMap.has(`${pair.pairKey}::${rank}`)) {
        errors.push(`Missing support conversation "${pair.pairKey}::${rank}".`);
      }
    }
  }

  return errors;
}

function validateGrowthBlock(block: StatBlockSix, label: string, errors: string[]): void {
  for (const k of STAT_SIX_KEYS) {
    const v = block[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) {
      errors.push(`${label}: growthRates.${k} must be an integer 0..100 (got ${String(v)}).`);
    }
  }
}

export function validatePersonalSkills(
  skills: readonly PersonalSkillDefinition[]
): { errors: string[]; byId: Map<string, PersonalSkillDefinition> } {
  const errors: string[] = [];
  const byId = new Map<string, PersonalSkillDefinition>();
  for (const sk of skills) {
    if (!sk.id || byId.has(sk.id)) errors.push(`Duplicate/empty PersonalSkill id "${sk.id}".`);
    byId.set(sk.id, sk);
    if (!sk.name?.trim() || !sk.description?.trim()) errors.push(`PersonalSkill "${sk.id}" missing name/description.`);
  }
  return { errors, byId };
}

export function validateMoves(moves: readonly MoveDefinition[]): {
  errors: string[];
  byId: Map<string, MoveDefinition>;
  pureStatChangeMoves: number;
} {
  const errors: string[] = [];
  const byId = new Map<string, MoveDefinition>();
  let pureStatChangeMoves = 0;

  for (const mv of moves) {
    if (!mv.id || byId.has(mv.id)) errors.push(`Duplicate/empty Move id "${mv.id}".`);
    byId.set(mv.id, mv);
    if (!VALID_TYPE_SET.has(mv.type)) errors.push(`Move "${mv.id}" invalid type "${mv.type}".`);
    if (!VALID_MOVE_CATEGORY_SET.has(mv.category)) errors.push(`Move "${mv.id}" invalid category "${mv.category}".`);
    if (!Number.isInteger(mv.pp) || mv.pp < 5 || mv.pp % 5 !== 0) {
      errors.push(`Move "${mv.id}" PP must be a positive multiple of 5 (got ${mv.pp}).`);
    }

    const [minR, maxR] = mv.range;
    if (mv.category === 'Physical') {
      if (minR !== 1 || maxR !== 1 || mv.mt < 1 || mv.targetType !== 'enemy') {
        errors.push(`Physical move "${mv.id}" must be Range [1,1], Mt>=1, targetType='enemy'.`);
      }
    } else if (mv.category === 'Special') {
      if (minR !== 2 || maxR !== 2 || mv.mt < 1 || mv.targetType !== 'enemy') {
        errors.push(`Special move "${mv.id}" must be Range [2,2], Mt>=1, targetType='enemy'.`);
      }
    } else if (mv.category === 'Support/Heal') {
      if (mv.mt !== 0 || minR !== maxR || (minR !== 1 && minR !== 2)) {
        errors.push(`Support/Heal move "${mv.id}" must have Mt=0 and Range [1,1] or [2,2].`);
      }
      if (!mv.supportSubkind || !VALID_SUPPORT_SUBKIND_SET.has(mv.supportSubkind)) {
        errors.push(`Support/Heal move "${mv.id}" has invalid supportSubkind.`);
      }
      if (mv.secondaryEffect?.statChanges) {
        pureStatChangeMoves += 1;
        errors.push(`Rule 4 violation: "${mv.id}" is a pure stat-changing move.`);
      }
    }

    if (mv.secondaryEffect) {
      const se = mv.secondaryEffect;
      if (mv.mt <= 0) {
        pureStatChangeMoves += 1;
        errors.push(`Rule 4 violation: Non-damaging move "${mv.id}" cannot carry secondaryEffect.`);
      }
      if (se.chance < 1 || se.chance > 100) errors.push(`Move "${mv.id}" invalid chance.`);
      if (se.status && !VALID_STATUS_SET.has(se.status)) errors.push(`Move "${mv.id}" invalid status "${se.status}".`);
    }
  }
  return { errors, byId, pureStatChangeMoves };
}

export function validateItems(
  items: readonly ItemDefinition[],
  movesById: ReadonlyMap<string, MoveDefinition>
): { errors: string[]; byId: Map<string, ItemDefinition>; tmCount: number } {
  const errors: string[] = [];
  const byId = new Map<string, ItemDefinition>();
  let tmCount = 0;

  for (const it of items) {
    if (!it.id || byId.has(it.id)) errors.push(`Duplicate/empty Item id "${it.id}".`);
    byId.set(it.id, it);
    if (!VALID_ITEM_CATEGORY_SET.has(it.category)) errors.push(`Item "${it.id}" invalid category "${it.category}".`);
    if (!it.iconSlug?.trim()) errors.push(`Item "${it.id}" missing iconSlug.`);
    if (it.effect.cureSpecificStatus && !VALID_STATUS_SET.has(it.effect.cureSpecificStatus)) {
      errors.push(`Item "${it.id}" invalid cureSpecificStatus "${it.effect.cureSpecificStatus}".`);
    }
    if (it.category === 'tm') {
      tmCount += 1;
      const moveId = it.effect.teachesMoveId;
      if (!moveId || !movesById.has(moveId)) errors.push(`TM "${it.id}" references unknown move "${String(moveId)}".`);
    }
  }
  if (!byId.has('evolution_stone') || !byId.has('evolution_gem')) {
    errors.push('Missing required promotion item evolution_stone or evolution_gem.');
  }
  return { errors, byId, tmCount };
}

export function validateAllRegistries(
  speciesList: readonly PokemonSpeciesDefinition[],
  moves: readonly MoveDefinition[],
  items: readonly ItemDefinition[],
  skills: readonly PersonalSkillDefinition[],
  supportConfig?: {
    pairs: readonly SupportPairDefinition[];
    conversations: readonly SupportConversationDoc[];
  }
): RegistryValidationSummary {
  const skRes = validatePersonalSkills(skills);
  const mvRes = validateMoves(moves);
  const itRes = validateItems(items, mvRes.byId);
  const errors = [...skRes.errors, ...mvRes.errors, ...itRes.errors];

  const byId = new Map<string, PokemonSpeciesDefinition>();
  const lines = new Map<string, PokemonSpeciesDefinition[]>();

  for (const sp of speciesList) {
    if (!sp.id || byId.has(sp.id)) errors.push(`Duplicate/empty Species id "${sp.id}".`);
    byId.set(sp.id, sp);
    if (!ASSET_ID_REGEX.test(sp.pmdAssetId)) errors.push(`Species "${sp.id}" invalid pmdAssetId "${sp.pmdAssetId}".`);
    for (const t of sp.types) if (!VALID_TYPE_SET.has(t)) errors.push(`Species "${sp.id}" invalid type "${t}".`);
    if (!VALID_TRAVERSAL_SET.has(sp.traversalClass)) errors.push(`Species "${sp.id}" invalid traversalClass.`);
    if (!skRes.byId.has(sp.personalSkillId)) errors.push(`Species "${sp.id}" unknown skill "${sp.personalSkillId}".`);
    if (sp.defaultJoinLevel < MIN_UNIT_LEVEL || sp.defaultJoinLevel > MAX_UNIT_LEVEL) {
      errors.push(`Species "${sp.id}" defaultJoinLevel ${sp.defaultJoinLevel} outside 1..40.`);
    }
    validateGrowthBlock(sp.growthRates, `Species:${sp.id}`, errors);
    if (sp.learnset.length === 0) errors.push(`Species "${sp.id}" has empty learnset.`);
    for (const ls of sp.learnset) {
      if (!mvRes.byId.has(ls.moveId)) errors.push(`Species "${sp.id}" unknown move "${ls.moveId}".`);
    }
    for (const tmId of sp.compatibleTmIds) {
      const tm = itRes.byId.get(tmId);
      if (!tm || tm.category !== 'tm') errors.push(`Species "${sp.id}" invalid TM "${tmId}".`);
    }
    const list = lines.get(sp.lineId) ?? [];
    list.push(sp);
    lines.set(sp.lineId, list);
  }

  for (const sp of speciesList) {
    for (const evo of sp.evolutions) {
      const target = byId.get(evo.targetSpeciesId);
      if (!target || target.lineId !== sp.lineId) {
        errors.push(`Species "${sp.id}" invalid evolution target "${evo.targetSpeciesId}".`);
        continue;
      }
      if (sp.stage === 1) {
        if (evo.requiredItemId !== 'evolution_stone') errors.push(`Stage-1 "${sp.id}" must require evolution_stone.`);
        const expectedLv = sp.id === 'eevee' ? BRANCHED_PROMOTION_MIN_LEVEL : STONE_PROMOTION_MIN_LEVEL;
        if (sp.faction !== 'enemy' && evo.minLevel !== expectedLv) {
          errors.push(`Stage-1 "${sp.id}" expected minLevel ${expectedLv} (got ${evo.minLevel}).`);
        }
      } else if (sp.stage === 2) {
        if (evo.requiredItemId !== 'evolution_gem') errors.push(`Stage-2 "${sp.id}" must require evolution_gem.`);
        if (sp.faction !== 'enemy' && evo.minLevel !== GEM_PROMOTION_MIN_LEVEL) {
          errors.push(`Stage-2 "${sp.id}" expected minLevel 20 (got ${evo.minLevel}).`);
        }
      }
    }
  }

  const dragonLines = new Set<string>();
  const coreLines = new Set<string>();
  const quizLines = new Set<string>();
  const storyLines = new Set<string>();
  const paralogueLines = new Set<string>();
  const allyNpcLines = new Set<string>();
  const enemyLines = new Set<string>();
  const convertibleLines = new Set<string>();

  for (const [lineId, members] of lines.entries()) {
    const factions = new Set(members.map((m) => m.faction));
    if (factions.size > 1) errors.push(`Rule 5 violation: Line "${lineId}" mixes factions.`);
    const f = members[0]!.faction;
    const cat = members[0]!.recruitCategory;
    if (f === 'convertible') convertibleLines.add(lineId);
    if (f === 'enemy') enemyLines.add(lineId);
    if (f === 'ally_npc') allyNpcLines.add(lineId);
    if (cat === 'dragon_lord') dragonLines.add(lineId);
    else if (cat === 'story_core') coreLines.add(lineId);
    else if (cat === 'story_chapter') storyLines.add(lineId);
    else if (cat === 'paralogue') paralogueLines.add(lineId);
  }

  const sortedConvertible = [...convertibleLines].sort();
  const expectedConvertible = [...CONVERTIBLE_FACTION_LINE_IDS].sort();
  if (sortedConvertible.join(',') !== expectedConvertible.join(',')) {
    errors.push(`Rule 5: convertible lines [${sortedConvertible.join(', ')}] !== expected.`);
  }
  if (dragonLines.size !== DRAGON_LORD_SPECIES_IDS.length) {
    errors.push(`Expected ${DRAGON_LORD_SPECIES_IDS.length} Dragon Lord lines, got ${dragonLines.size}.`);
  }
  if (byId.get('slakoth')?.personalSkillId !== 'hidden_potential') {
    errors.push('Slakoth must carry personalSkillId "hidden_potential".');
  }
  if (supportConfig) {
    errors.push(...validateSupportRegistries(supportConfig.pairs, supportConfig.conversations));
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      totalSpecies: speciesList.length,
      dragonLordLines: dragonLines.size,
      storyCoreLines: coreLines.size,
      quizRecruitLines: quizLines.size,
      storyRecruitLines: storyLines.size,
      paralogueRecruitLines: paralogueLines.size,
      allyNpcLines: allyNpcLines.size,
      enemyLines: enemyLines.size,
      convertibleLines: sortedConvertible,
      sharedLines: sortedConvertible,
      totalMoves: moves.length,
      pureStatChangeMoves: mvRes.pureStatChangeMoves,
      totalItems: items.length,
      totalTms: itRes.tmCount,
      totalPersonalSkills: skills.length,
    },
  };
}
