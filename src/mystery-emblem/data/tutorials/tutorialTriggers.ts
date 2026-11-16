/**
 * Mystery Emblem - Declarative Tutorial Trigger Rules & Terrain Detector (`tutorialTriggers.ts`)
 *
 * Maps Quaquaval's Field Notes coaching hooks across Act 1 (`prologue`..`chapter_04` + `paralogue_01`).
 */

import type { DungeonMapDefinition, SaveData } from '../../types/schemas';
import type { TutorialTriggerContext, TutorialTriggerRule } from './tutorialTypes';

export const TUTORIAL_TRIGGER_RULES: ReadonlyArray<TutorialTriggerRule> = [
  {
    id: 'rule_prep_units_and_moves',
    hook: 'battle_prep',
    topicId: 'prep_units_and_moves',
    excludeLevelIds: ['prologue', 'chapter_01'],
  },
  {
    id: 'rule_prep_deployment_cap',
    hook: 'battle_prep',
    topicId: 'ch5_deployment_cap_and_mobile_boss',
    excludeLevelIds: ['prologue', 'chapter_01'],
    when: (ctx) =>
      Boolean(
        (ctx.save &&
          ctx.deploymentCap !== undefined &&
          ctx.save.roster.length > ctx.deploymentCap) ||
          ctx.levelId === 'chapter_04'
      ),
  },
  {
    id: 'rule_turn1_prologue_basics',
    hook: 'battle_turn1',
    topicId: 'ch1_turn1_controls_phases',
    levelIds: ['prologue'],
  },
  {
    id: 'rule_turn1_ch2_convoy',
    hook: 'battle_turn1',
    topicId: 'prep_items_and_convoy',
    levelIds: ['chapter_02'],
  },
  {
    id: 'rule_turn1_ch3_caves_and_stairs',
    hook: 'battle_turn1',
    topicId: 'ch3_stairs_reinforcements',
    levelIds: ['chapter_03'],
  },
  {
    id: 'rule_turn1_par1_vitamins',
    hook: 'battle_turn1',
    topicId: 'ch4_vitamins',
    levelIds: ['paralogue_01'],
  },
  {
    id: 'rule_turn1_ch4_rift_boss',
    hook: 'battle_turn1',
    topicId: 'ch5_deployment_cap_and_mobile_boss',
    levelIds: ['chapter_04'],
  },
];

/** Levels where Quaquaval is away from the party, so his Field Notes coaching stays silent. */
export const QUAQUAVAL_ABSENT_LEVEL_IDS: ReadonlySet<string> = new Set(['chapter_01']);

export function isQuaquavalAbsentFromLevel(levelId: string): boolean {
  return QUAQUAVAL_ABSENT_LEVEL_IDS.has(levelId);
}

function evaluateHookRules(ctx: TutorialTriggerContext): string[] {
  const matched: string[] = [];
  if (isQuaquavalAbsentFromLevel(ctx.levelId)) return matched;
  for (const rule of TUTORIAL_TRIGGER_RULES) {
    if (rule.hook !== ctx.hook) continue;
    if (rule.levelIds && !rule.levelIds.includes(ctx.levelId)) continue;
    if (rule.excludeLevelIds && rule.excludeLevelIds.includes(ctx.levelId)) continue;
    if (rule.when && !rule.when(ctx)) continue;
    if (!matched.includes(rule.topicId)) {
      matched.push(rule.topicId);
    }
  }
  return matched;
}

/**
 * Dynamically detects special dungeon terrain tutorials that apply to `map` so custom maps and
 * chapters introduce Trees/Mountains, Wonder Tiles, and Lava/Void/Barriers when first encountered.
 */
export function detectDynamicMapTerrainTutorialIds(map: DungeonMapDefinition): string[] {
  let hasCover = false;
  let hasWonder = false;
  let hasLavaOrVoid = false;

  for (const row of map.tiles) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const rawCell = cell as { terrain?: string; terrainType?: string } | undefined;
      const t = rawCell?.terrain ?? rawCell?.terrainType;
      if (t === 'trees' || t === 'mountain') {
        hasCover = true;
      } else if (t === 'wonder_tile') {
        hasWonder = true;
      } else if (t === 'lava' || t === 'void' || t === 'barrier') {
        hasLavaOrVoid = true;
      }
    }
  }

  const topics: string[] = [];
  if (hasCover) topics.push('terrain_cover_woods_crags');
  if (hasWonder) topics.push('terrain_wonder_tiles');
  if (hasLavaOrVoid) topics.push('terrain_hazards_lava_void');
  return topics;
}

function classifyTerrainTutorialTopic(terrain: string | undefined): string | null {
  if (terrain === 'trees' || terrain === 'mountain') return 'terrain_cover_woods_crags';
  if (terrain === 'wonder_tile') return 'terrain_wonder_tiles';
  if (terrain === 'lava' || terrain === 'void' || terrain === 'barrier') {
    return 'terrain_hazards_lava_void';
  }
  return null;
}

/**
 * Inspects `(x, y)` and its 4 orthogonal neighbors to detect the first special terrain
 * tutorial relevant to a unit's newly reached position.
 */
export function detectNearbyTerrainTutorialId(
  map: DungeonMapDefinition,
  x: number,
  y: number
): string | null {
  const coords: ReadonlyArray<readonly [number, number]> = [
    [x, y],
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  let foundCover = false;
  let foundWonder = false;
  let foundHazard = false;

  for (let i = 0; i < coords.length; i++) {
    const [cx, cy] = coords[i]!;
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
    const rawCell = map.tiles[cy]?.[cx] as { terrain?: string; terrainType?: string } | undefined;
    const terrain = rawCell?.terrain ?? rawCell?.terrainType;
    const directTopic = classifyTerrainTutorialTopic(terrain);
    if (i === 0 && directTopic) {
      return directTopic;
    }
    if (directTopic === 'terrain_cover_woods_crags') foundCover = true;
    else if (directTopic === 'terrain_wonder_tiles') foundWonder = true;
    else if (directTopic === 'terrain_hazards_lava_void') foundHazard = true;
  }

  if (foundCover) return 'terrain_cover_woods_crags';
  if (foundWonder) return 'terrain_wonder_tiles';
  if (foundHazard) return 'terrain_hazards_lava_void';
  return null;
}

export function evaluatePrepTutorialTopics(opts: {
  levelId: string;
  map: DungeonMapDefinition;
  save: SaveData;
  deploymentCap: number;
  anyUnitCanPromoteNow: boolean;
}): string[] {
  return evaluateHookRules({
    hook: 'battle_prep',
    levelId: opts.levelId,
    map: opts.map,
    save: opts.save,
    deploymentCap: opts.deploymentCap,
    anyUnitCanPromoteNow: opts.anyUnitCanPromoteNow,
  });
}

export function evaluateTurn1TutorialTopics(opts: {
  levelId: string;
  map: DungeonMapDefinition;
  save: SaveData | null;
}): string[] {
  return evaluateHookRules({
    hook: 'battle_turn1',
    levelId: opts.levelId,
    map: opts.map,
    save: opts.save,
  });
}
