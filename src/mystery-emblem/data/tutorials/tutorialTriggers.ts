/**
 * Mystery Emblem — Declarative Tutorial Trigger Rules & Terrain Detector (`tutorialTriggers.ts`)
 *
 * Replaces hardcoded chapter-ID `if/else` chains in `BattleScene.ts` with declarative
 * `TutorialTriggerRule` hooks so tutorials span Acts 1–2 cleanly before Wimpod's Ch. 13 promotion.
 */

import type { DungeonMapDefinition, SaveData } from '../../types/schemas';
import type { TutorialTriggerContext, TutorialTriggerRule } from './tutorialTypes';

export const TUTORIAL_TRIGGER_RULES: ReadonlyArray<TutorialTriggerRule> = [
  {
    id: 'rule_prep_units_and_moves',
    hook: 'battle_prep',
    topicId: 'prep_units_and_moves',
  },
  {
    id: 'rule_prep_deployment_cap',
    hook: 'battle_prep',
    topicId: 'ch5_deployment_cap_and_mobile_boss',
    excludeLevelIds: ['prologue'],
    when: (ctx) =>
      Boolean(
        (ctx.save &&
          ctx.deploymentCap !== undefined &&
          ctx.save.roster.length > ctx.deploymentCap) ||
          ctx.levelId === 'chapter_04'
      ),
  },
  {
    id: 'rule_prep_evolution_ready',
    hook: 'battle_prep',
    topicId: 'levelup_and_evolution',
    excludeLevelIds: ['prologue'],
    when: (ctx) => Boolean(ctx.anyUnitCanPromoteNow),
  },
  {
    id: 'rule_turn1_prologue_basics',
    hook: 'battle_turn1',
    topicId: 'ch1_turn1_controls_phases',
    levelIds: ['prologue'],
  },
  {
    id: 'rule_turn1_ch1_boss_and_water',
    hook: 'battle_turn1',
    topicId: 'ch2_boss_and_traversal',
    levelIds: ['chapter_01'],
  },
  {
    id: 'rule_turn1_ch2_stairs',
    hook: 'battle_turn1',
    topicId: 'ch3_stairs_reinforcements',
    levelIds: ['chapter_02'],
  },
  {
    id: 'rule_turn1_ch3_vitamins',
    hook: 'battle_turn1',
    topicId: 'ch4_vitamins',
    levelIds: ['chapter_03'],
  },
  {
    id: 'rule_turn1_ch4_mobile_boss',
    hook: 'battle_turn1',
    topicId: 'ch5_deployment_cap_and_mobile_boss',
    levelIds: ['chapter_04'],
  },
];

function evaluateHookRules(ctx: TutorialTriggerContext): string[] {
  const matched: string[] = [];
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
  const result = evaluateHookRules({
    hook: 'battle_turn1',
    levelId: opts.levelId,
    map: opts.map,
    save: opts.save,
  });
  for (const terrainTopicId of detectDynamicMapTerrainTutorialIds(opts.map)) {
    if (!result.includes(terrainTopicId)) {
      result.push(terrainTopicId);
    }
  }
  return result;
}
