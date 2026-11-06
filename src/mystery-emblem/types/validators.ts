import {
  CURRENT_SAVE_SCHEMA_VERSION,
  ITEM_CATEGORIES,
  MOVE_CATEGORIES,
  POKEMON_TYPES,
  STATUS_CONDITIONS,
  TRAVERSAL_CLASSES,
  type ItemDefinition,
  type MoveDefinition,
  type OwnedPokemonInstance,
  type PersonalSkillDefinition,
  type PokemonSpeciesDefinition,
  type PokemonType,
  type SaveData,
} from './schemas';

export interface RegistryValidationSummary {
  valid: boolean;
  errors: string[];
  counts: {
    totalSpecies: number;
    totalLines: number;
    dragonLordLines: number;
    starterPartnerLines: number;
    quizRecruitLines: number;
    storyRecruitLines: number;
    paralogueRecruitLines: number;
    enemyLines: number;
    sharedLines: string[];
    totalMoves: number;
    physicalMoves: number;
    specialMoves: number;
    supportHealMoves: number;
    pureStatChangeMoves: number;
    totalItems: number;
    tmCount: number;
    totalPersonalSkills: number;
  };
}

const VALID_TYPE_SET = new Set<string>(POKEMON_TYPES);
const VALID_TRAVERSAL_SET = new Set<string>(TRAVERSAL_CLASSES);
const VALID_MOVE_CATEGORY_SET = new Set<string>(MOVE_CATEGORIES);
const VALID_ITEM_CATEGORY_SET = new Set<string>(ITEM_CATEGORIES);
const VALID_STATUS_SET = new Set<string>(STATUS_CONDITIONS);

const REQUIRED_DRAGON_LORDS = [
  'dratini',
  'bagon',
  'gible',
  'deino',
  'goomy',
  'jangmo_o',
  'dreepy',
  'frigibax',
] as const;

const REQUIRED_STARTERS = [
  'bulbasaur',
  'charmander',
  'squirtle',
  'chikorita',
  'cyndaquil',
  'totodile',
  'treecko',
  'torchic',
  'mudkip',
  'turtwig',
  'chimchar',
  'piplup',
  'snivy',
  'tepig',
  'oshawott',
  'chespin',
  'fennekin',
  'froakie',
  'rowlet',
  'litten',
  'popplio',
  'grookey',
  'scorbunny',
  'sobble',
  'sprigatito',
  'fuecoco',
  'quaxly',
] as const;

const REQUIRED_QUIZ_STAGE1 = [
  // Q1 Healers (6)
  'happiny',
  'flabebe',
  'bounsweet',
  'hatenna',
  'smoliv',
  'togepi',
  // Q2 Bug & Flying (6)
  'caterpie',
  'pidgey',
  'sewaddle',
  'pidove',
  'grubbin',
  'pikipek',
  // Q3 Ghost & Psychic (4)
  'duskull',
  'abra',
  'ralts',
  'solosis',
  // Q4 Electric (3)
  'pichu',
  'shinx',
  'mareep',
  // Q5 Fighting, Rock & Ground (7)
  'machop',
  'mankey',
  'geodude',
  'roggenrola',
  'nacli',
  'trapinch',
  'rhyhorn',
  // Q6 Water & Grass (6)
  'poliwag',
  'bellsprout',
  'lotad',
  'oddish',
  'tympole',
  'budew',
  // Q7 Fire (3)
  'magby',
  'fletchling',
  'litwick',
  // Q8 Steel & Fairy (6)
  'tinkatink',
  'cleffa',
  'klink',
  'azurill',
  'magnemite',
  'igglybuff',
  // Q9 Ice & Armored/Tech (6)
  'mime_jr_galar',
  'beldum',
  'vanillite',
  'porygon',
  'swinub',
  'blipbug',
] as const;

const REQUIRED_STORY_STAGE1 = ['starly', 'lillipup', 'whismur', 'pawmi', 'larvitar'] as const;

const REQUIRED_PARALOGUE_STAGE1 = [
  'slakoth',
  'eevee',
  'nidoran_m',
  'nidoran_f',
  'teddiursa',
  'hoppip',
  'gastly',
] as const;

const REQUIRED_EEVEELUTIONS = [
  'vaporeon',
  'jolteon',
  'flareon',
  'espeon',
  'umbreon',
  'leafeon',
  'glaceon',
  'sylveon',
] as const;

const REQUIRED_ENEMY_STAGE1 = [
  'pawniard',
  'aron',
  'rookidee',
  'rolycoly',
  'zigzagoon_galar',
  'impidimp',
  'sandile',
  'gothita',
  'honedge',
  'gastly',
  'elekid',
  'zubat',
  'tynamo',
  'spheal',
  'venipede',
  'timburr',
  'seedot',
  'croagunk',
  'stufful',
  'skarmory',
  'spiritomb',
] as const;

export function validateAllRegistries(
  speciesList: PokemonSpeciesDefinition[],
  movesList: MoveDefinition[],
  itemsList: ItemDefinition[],
  skillsList: PersonalSkillDefinition[]
): RegistryValidationSummary {
  const errors: string[] = [];

  // 1. Personal Skills
  const skillMap = new Map<string, PersonalSkillDefinition>();
  for (const skill of skillsList) {
    if (!skill.id || skillMap.has(skill.id)) {
      errors.push(`Duplicate or empty personalSkillId: "${skill.id}"`);
    }
    if (!skill.name || !skill.description) {
      errors.push(`PersonalSkill "${skill.id}" missing name or description.`);
    }
    skillMap.set(skill.id, skill);
  }

  // 2. Moves (Rule 4 enforcement)
  const moveMap = new Map<string, MoveDefinition>();
  let physicalMoves = 0;
  let specialMoves = 0;
  let supportHealMoves = 0;
  let pureStatChangeMoves = 0;

  for (const move of movesList) {
    if (!move.id || moveMap.has(move.id)) {
      errors.push(`Duplicate or empty moveId: "${move.id}"`);
    }
    moveMap.set(move.id, move);

    if (!VALID_TYPE_SET.has(move.type)) {
      errors.push(`Move "${move.id}" has invalid type "${move.type}".`);
    }
    if (!VALID_MOVE_CATEGORY_SET.has(move.category)) {
      errors.push(`Move "${move.id}" has invalid category "${move.category}".`);
    }
    if (move.pp < 1 || move.hit < 1 || move.hit > 100 || move.crit < 0 || move.crit > 100) {
      errors.push(`Move "${move.id}" has out-of-bounds PP/Hit/Crit values.`);
    }

    if (move.category === 'Physical') {
      physicalMoves++;
      if (move.range[0] !== 1 || move.range[1] !== 1) {
        errors.push(`Rule 4 violation: Physical move "${move.id}" must have range [1, 1].`);
      }
      if (move.mt < 1 || move.targetType !== 'enemy') {
        errors.push(`Physical move "${move.id}" must have mt >= 1 and targetType "enemy".`);
      }
    } else if (move.category === 'Special') {
      specialMoves++;
      if (move.range[0] !== 2 || move.range[1] !== 2) {
        errors.push(`Rule 4 violation: Special move "${move.id}" must have range [2, 2].`);
      }
      if (move.mt < 1 || move.targetType !== 'enemy') {
        errors.push(`Special move "${move.id}" must have mt >= 1 and targetType "enemy".`);
      }
    } else if (move.category === 'Support/Heal') {
      supportHealMoves++;
      if (move.mt !== 0) {
        errors.push(`Support/Heal move "${move.id}" must have mt === 0.`);
      }
      const validSupportRange =
        (move.range[0] === 1 && move.range[1] === 1) ||
        (move.range[0] === 1 && move.range[1] === 2);
      if (!validSupportRange) {
        errors.push(`Support/Heal move "${move.id}" must have range [1, 1] or [1, 2].`);
      }
      if (!move.supportSubkind || !move.supportPayload) {
        errors.push(`Support/Heal move "${move.id}" missing supportSubkind or supportPayload.`);
      }
      // Rule 4: Zero pure stat-changing moves!
      if (move.secondaryEffect?.statChanges) {
        pureStatChangeMoves++;
        errors.push(
          `Rule 4 violation: Non-damaging move "${move.id}" cannot apply stat boosts or drops.`
        );
      }
    }

    if (move.secondaryEffect) {
      const se = move.secondaryEffect;
      if (se.chance < 1 || se.chance > 100) {
        errors.push(`Move "${move.id}" secondaryEffect.chance (${se.chance}) out of 1..100.`);
      }
      if (se.status && !VALID_STATUS_SET.has(se.status)) {
        errors.push(`Move "${move.id}" has invalid secondary status "${se.status}".`);
      }
      if (se.statChanges && move.mt <= 0) {
        pureStatChangeMoves++;
        errors.push(`Rule 4 violation: Pure stat-changing move "${move.id}" is forbidden.`);
      }
    }
  }

  // 3. Items
  const itemMap = new Map<string, ItemDefinition>();
  let tmCount = 0;
  for (const item of itemsList) {
    if (!item.id || itemMap.has(item.id)) {
      errors.push(`Duplicate or empty itemId: "${item.id}"`);
    }
    itemMap.set(item.id, item);

    if (!VALID_ITEM_CATEGORY_SET.has(item.category)) {
      errors.push(`Item "${item.id}" has invalid category "${item.category}".`);
    }
    if (item.equipSlot !== 'held' && item.equipSlot !== 'consumable' && item.equipSlot !== 'convoy_only') {
      errors.push(`Item "${item.id}" has invalid equipSlot "${String(item.equipSlot)}".`);
    }
    if (item.category === 'tm') {
      tmCount++;
      const moveId = item.effect.teachesMoveId;
      if (!moveId || !moveMap.has(moveId)) {
        errors.push(`TM "${item.id}" references missing moveId "${moveId}".`);
      }
    }
  }

  if (!itemMap.has('evolution_stone') || !itemMap.has('evolution_gem')) {
    errors.push('Items registry must define both "evolution_stone" and "evolution_gem".');
  }

  // 4. Species & Faction Separation (Rule 1 & Rule 5)
  const speciesMap = new Map<string, PokemonSpeciesDefinition>();
  const speciesByLine = new Map<string, PokemonSpeciesDefinition[]>();

  for (const sp of speciesList) {
    if (!sp.id || speciesMap.has(sp.id)) {
      errors.push(`Duplicate or empty speciesId: "${sp.id}"`);
    }
    speciesMap.set(sp.id, sp);

    const lineBucket = speciesByLine.get(sp.lineId) ?? [];
    lineBucket.push(sp);
    speciesByLine.set(sp.lineId, lineBucket);

    if (sp.dexNumber <= 0) {
      errors.push(`Species "${sp.id}" has invalid dexNumber ${sp.dexNumber}.`);
    }
    if (!/^\d{4}(\/\d{4})?$/.test(sp.pmdAssetId)) {
      errors.push(`Species "${sp.id}" has invalid pmdAssetId "${sp.pmdAssetId}".`);
    }
    if (sp.types.length < 1 || sp.types.length > 2) {
      errors.push(`Species "${sp.id}" must have 1 or 2 elemental types.`);
    }
    for (const t of sp.types) {
      if (!VALID_TYPE_SET.has(t as PokemonType)) {
        errors.push(`Species "${sp.id}" has invalid type "${t}".`);
      }
    }

    const bs = sp.baseStats;
    if (
      bs.hp < 1 ||
      bs.atk < 1 ||
      bs.def < 1 ||
      bs.spa < 1 ||
      bs.spd < 1 ||
      bs.spe < 1 ||
      bs.mov < 4 ||
      bs.mov > 7
    ) {
      errors.push(`Species "${sp.id}" has invalid baseStats or Mov outside 4..7.`);
    }
    if (sp.defaultJoinLevel < 1 || sp.defaultJoinLevel > 40) {
      errors.push(`Species "${sp.id}" defaultJoinLevel (${sp.defaultJoinLevel}) outside 1..40.`);
    }

    const gr = sp.growthRates;
    for (const key of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const) {
      if (gr[key] < 0 || gr[key] > 100) {
        errors.push(`Species "${sp.id}" growthRates.${key} (${gr[key]}) outside 0..100.`);
      }
    }

    if (!VALID_TRAVERSAL_SET.has(sp.traversalClass)) {
      errors.push(`Species "${sp.id}" has invalid traversalClass "${sp.traversalClass}".`);
    }
    if (sp.personalSkillId === 'levitate' && sp.traversalClass !== 'Levitate') {
      errors.push(`Species "${sp.id}" has personalSkill "levitate" without Levitate traversal.`);
    }
    if (!skillMap.has(sp.personalSkillId)) {
      errors.push(`Species "${sp.id}" references unknown personalSkillId "${sp.personalSkillId}".`);
    }

    if (sp.learnset.length === 0) {
      errors.push(`Species "${sp.id}" must have at least one learnset move.`);
    }
    let hasStartingMove = false;
    for (const entry of sp.learnset) {
      if (entry.level < 1 || entry.level > 40) {
        errors.push(`Species "${sp.id}" learnset level ${entry.level} outside 1..40.`);
      }
      if (!moveMap.has(entry.moveId)) {
        errors.push(`Species "${sp.id}" learnset references unknown moveId "${entry.moveId}".`);
      }
      if (entry.level <= sp.defaultJoinLevel) {
        hasStartingMove = true;
      }
    }
    if (!hasStartingMove) {
      errors.push(
        `Species "${sp.id}" has no learnset move unlocked at or below defaultJoinLevel (${sp.defaultJoinLevel}).`
      );
    }

    for (const tmId of sp.compatibleTmIds) {
      const tmItem = itemMap.get(tmId);
      if (!tmItem || tmItem.category !== 'tm') {
        errors.push(`Species "${sp.id}" references invalid compatibleTmId "${tmId}".`);
      }
    }
  }

  // Validate evolutions & promotion rules after all species are indexed
  for (const sp of speciesList) {
    if (sp.isFinalStage && sp.evolutions.length > 0) {
      errors.push(`Final-stage species "${sp.id}" cannot define further evolutions.`);
    }
    if (!sp.isFinalStage && sp.evolutions.length === 0) {
      errors.push(`Non-final species "${sp.id}" must define at least one evolution branch.`);
    }
    for (const evo of sp.evolutions) {
      const target = speciesMap.get(evo.targetSpeciesId);
      if (!target) {
        errors.push(`Species "${sp.id}" evolves into missing target "${evo.targetSpeciesId}".`);
        continue;
      }
      if (target.lineId !== sp.lineId) {
        errors.push(
          `Species "${sp.id}" (${sp.lineId}) evolves into mismatched lineId "${target.lineId}".`
        );
      }
      if (sp.id === 'eevee') {
        if (evo.minLevel !== 15 || evo.requiredItemId !== 'evolution_stone') {
          errors.push(`Eevee branch "${evo.targetSpeciesId}" must require Lv. 15 Evolution Stone.`);
        }
      } else if (sp.faction !== 'enemy') {
        if (sp.stage === 1 && (evo.minLevel !== 10 || evo.requiredItemId !== 'evolution_stone')) {
          errors.push(`Playable Stage-1 "${sp.id}" must promote at Lv. 10 via evolution_stone.`);
        }
        if (sp.stage === 2 && (evo.minLevel !== 20 || evo.requiredItemId !== 'evolution_gem')) {
          errors.push(`Playable Stage-2 "${sp.id}" must promote at Lv. 20 via evolution_gem.`);
        }
      }
    }
  }

  // Rule 5: Line-level faction separation & 3-stage playable verification
  const playableLines = new Set<string>();
  const enemyLines = new Set<string>();
  const dragonLordLineSet = new Set<string>();
  const starterLineSet = new Set<string>();
  const quizLineSet = new Set<string>();
  const storyLineSet = new Set<string>();
  const paralogueLineSet = new Set<string>();

  for (const [lineId, members] of speciesByLine.entries()) {
    for (const m of members) {
      if (m.faction === 'playable' || m.faction === 'shared_paralogue6') {
        playableLines.add(lineId);
      }
      if (m.faction === 'enemy' || m.faction === 'shared_paralogue6') {
        enemyLines.add(lineId);
      }
      if (m.recruitCategory === 'dragon_lord') dragonLordLineSet.add(lineId);
      else if (m.recruitCategory === 'starter_partner') starterLineSet.add(lineId);
      else if (m.recruitCategory.startsWith('quiz_')) quizLineSet.add(lineId);
      else if (m.recruitCategory === 'story_chapter') storyLineSet.add(lineId);
      else if (m.recruitCategory === 'paralogue') paralogueLineSet.add(lineId);
    }

    if (playableLines.has(lineId)) {
      if (lineId === 'eevee_line') {
        if (members.length !== 9) {
          errors.push(`eevee_line must contain Eevee + 8 Eeveelutions (found ${members.length}).`);
        }
      } else {
        const stages = new Set(members.map((m) => m.stage));
        if (members.length !== 3 || !stages.has(1) || !stages.has(2) || !stages.has(3)) {
          errors.push(
            `Rule 5 violation: Playable line "${lineId}" must have exactly 3 stages (found ${members.length}).`
          );
        }
      }
    }
  }

  const sharedLines = [...playableLines].filter((l) => enemyLines.has(l));
  if (sharedLines.length !== 1 || sharedLines[0] !== 'gastly_line') {
    errors.push(
      `Rule 5 violation: Expected ONLY "gastly_line" in playable/enemy overlap, found: [${sharedLines.join(', ')}].`
    );
  }

  // Required roster presence checks
  const checkRequiredIds = (label: string, ids: readonly string[]) => {
    for (const id of ids) {
      if (!speciesMap.has(id)) {
        errors.push(`Missing required ${label} species: "${id}".`);
      }
    }
  };
  checkRequiredIds('Dragon Lord', REQUIRED_DRAGON_LORDS);
  checkRequiredIds('Starter Partner', REQUIRED_STARTERS);
  checkRequiredIds('Q1-Q9 Quiz Recruit', REQUIRED_QUIZ_STAGE1);
  checkRequiredIds('Story Chapter Recruit', REQUIRED_STORY_STAGE1);
  checkRequiredIds('Paralogue Recruit', REQUIRED_PARALOGUE_STAGE1);
  checkRequiredIds('Eeveelution', REQUIRED_EEVEELUTIONS);
  checkRequiredIds('Enemy Line', REQUIRED_ENEMY_STAGE1);

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      totalSpecies: speciesList.length,
      totalLines: speciesByLine.size,
      dragonLordLines: dragonLordLineSet.size,
      starterPartnerLines: starterLineSet.size,
      quizRecruitLines: quizLineSet.size,
      storyRecruitLines: storyLineSet.size,
      paralogueRecruitLines: paralogueLineSet.size,
      enemyLines: enemyLines.size,
      sharedLines,
      totalMoves: movesList.length,
      physicalMoves,
      specialMoves,
      supportHealMoves,
      pureStatChangeMoves,
      totalItems: itemsList.length,
      tmCount,
      totalPersonalSkills: skillsList.length,
    },
  };
}

export function validateSaveData(
  candidate: unknown,
  speciesMap: ReadonlyMap<string, PokemonSpeciesDefinition>,
  moveMap: ReadonlyMap<string, MoveDefinition>,
  itemMap: ReadonlyMap<string, ItemDefinition>
): { valid: boolean; errors: string[]; save?: SaveData } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Save payload is not an object.'] };
  }

  const data = candidate as Partial<SaveData>;
  if (data.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
    errors.push(`Unsupported save schemaVersion: ${String(data.schemaVersion)}.`);
  }
  if (!data.saveId || typeof data.saveId !== 'string') {
    errors.push('Save payload missing string saveId.');
  }
  if (typeof data.lastUpdated !== 'number' || !Number.isFinite(data.lastUpdated) || data.lastUpdated <= 0) {
    errors.push('Save payload missing valid numeric UTC lastUpdated timestamp.');
  }
  if (typeof data.newGamePlusUnlocked !== 'boolean') {
    errors.push('Save payload missing boolean newGamePlusUnlocked.');
  }
  if (typeof data.gold !== 'number' || data.gold < 0) {
    errors.push('Save payload has invalid gold amount.');
  }
  if (!Array.isArray(data.roster)) {
    errors.push('Save payload missing roster array.');
  } else {
    const seenIds = new Set<string>();
    for (const unit of data.roster as OwnedPokemonInstance[]) {
      if (!unit.instanceId || seenIds.has(unit.instanceId)) {
        errors.push(`Duplicate or missing unit instanceId: "${unit?.instanceId}".`);
      }
      seenIds.add(unit.instanceId);
      const sp = speciesMap.get(unit.speciesId);
      if (!sp) {
        errors.push(`Unit "${unit.instanceId}" references unknown speciesId "${unit.speciesId}".`);
      } else if (sp.faction === 'enemy') {
        errors.push(`Rule 5 violation in save: Enemy-only species "${unit.speciesId}" in player roster.`);
      }
      if (typeof unit.nickname !== 'string' || unit.nickname.trim().length === 0) {
        errors.push(`Unit "${unit.instanceId}" must have a non-empty nickname.`);
      }
      if (unit.level < 1 || unit.level > 40) {
        errors.push(`Unit "${unit.instanceId}" has level ${unit.level} outside 1..40.`);
      }
      if (!Array.isArray(unit.activeMoveIds) || unit.activeMoveIds.length > 4) {
        errors.push(`Unit "${unit.instanceId}" cannot have more than 4 active moves.`);
      } else {
        for (const mId of unit.activeMoveIds) {
          if (!moveMap.has(mId)) {
            errors.push(`Unit "${unit.instanceId}" activeMoveId "${mId}" does not exist.`);
          }
        }
      }
      if (unit.equippedMoveId !== null) {
        if (!unit.activeMoveIds?.includes(unit.equippedMoveId)) {
          errors.push(
            `Unit "${unit.instanceId}" equippedMoveId "${unit.equippedMoveId}" must be in activeMoveIds.`
          );
        }
        const eqMove = moveMap.get(unit.equippedMoveId);
        if (!eqMove || (eqMove.category !== 'Physical' && eqMove.category !== 'Special')) {
          errors.push(
            `Unit "${unit.instanceId}" equippedMoveId "${unit.equippedMoveId}" must be an offensive move.`
          );
        }
      }
      if (unit.heldItemId !== null) {
        const held = itemMap.get(unit.heldItemId);
        if (!held || held.equipSlot !== 'held') {
          errors.push(`Unit "${unit.instanceId}" has invalid heldItemId "${unit.heldItemId}".`);
        }
      }
      if (unit.consumableItemId !== null) {
        const cons = itemMap.get(unit.consumableItemId);
        if (!cons || cons.equipSlot !== 'consumable') {
          errors.push(
            `Unit "${unit.instanceId}" has invalid consumableItemId "${unit.consumableItemId}".`
          );
        }
      }
    }
  }

  if (!Array.isArray(data.convoy)) {
    errors.push('Save payload missing convoy array.');
  } else {
    for (const entry of data.convoy) {
      if (!itemMap.has(entry.itemId) || entry.quantity < 1) {
        errors.push(`Invalid convoy entry: "${entry?.itemId}" x${entry?.quantity}.`);
      }
    }
  }

  if (!data.supports || typeof data.supports !== 'object') {
    errors.push('Save payload missing supports map.');
  }
  if (!data.campaign || typeof data.campaign !== 'object') {
    errors.push('Save payload missing campaign state.');
  }
  if (!data.overworld || typeof data.overworld !== 'object') {
    errors.push('Save payload missing overworld state.');
  }

  return {
    valid: errors.length === 0,
    errors,
    save: errors.length === 0 ? (data as SaveData) : undefined,
  };
}
