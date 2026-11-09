/**
 * Mystery Emblem — Manual Feral Skirmish Encounter Tiers (Rule 1 & Rule 5 Compliant)
 */

import type {
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  SkirmishSpawnState,
  StatBlockSeven,
} from '../../types/schemas';
import { cloneDungeonMap, getEffectiveChapterMap } from '../chapterMapRegistry';
import type { OverworldNodeDefinition } from './overworldGraphData';

export interface ManualSkirmishMemberTemplate {
  speciesId: string;
  nickname: string;
  level: number;
  stats: StatBlockSeven;
  moveIds: string[];
  equippedMoveId: string;
}

export const FERAL_SKIRMISH_SQUADS_BY_TIER: ReadonlyArray<{
  maxRecommendedLevel: number;
  goldBounty: number;
  members: ReadonlyArray<ManualSkirmishMemberTemplate>;
}> = [
  {
    maxRecommendedLevel: 4,
    goldBounty: 400,
    members: [
      {
        speciesId: 'zigzagoon_galar',
        nickname: 'Feral Outrider',
        level: 2,
        stats: { hp: 16, atk: 5, def: 4, spa: 3, spd: 4, spe: 6, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'venipede',
        nickname: 'Feral Stalker',
        level: 2,
        stats: { hp: 16, atk: 5, def: 5, spa: 3, spd: 4, spe: 5, mov: 5 },
        moveIds: ['poison_sting', 'bug_bite'],
        equippedMoveId: 'bug_bite',
      },
      {
        speciesId: 'impidimp',
        nickname: 'Feral Hexer',
        level: 2,
        stats: { hp: 15, atk: 5, def: 4, spa: 5, spd: 4, spe: 5, mov: 5 },
        moveIds: ['bite', 'fairy_wind'],
        equippedMoveId: 'fairy_wind',
      },
    ],
  },
  {
    maxRecommendedLevel: 9,
    goldBounty: 450,
    members: [
      {
        speciesId: 'zigzagoon_galar',
        nickname: 'Feral Outrider',
        level: 9,
        stats: { hp: 20, atk: 8, def: 6, spa: 4, spd: 6, spe: 9, mov: 5 },
        moveIds: ['tackle'],
        equippedMoveId: 'tackle',
      },
      {
        speciesId: 'venipede',
        nickname: 'Feral Stalker',
        level: 9,
        stats: { hp: 20, atk: 8, def: 7, spa: 5, spd: 6, spe: 7, mov: 5 },
        moveIds: ['poison_sting', 'bug_bite'],
        equippedMoveId: 'bug_bite',
      },
      {
        speciesId: 'impidimp',
        nickname: 'Feral Hexer',
        level: 9,
        stats: { hp: 19, atk: 7, def: 5, spa: 8, spd: 6, spe: 8, mov: 5 },
        moveIds: ['assurance', 'snarl'],
        equippedMoveId: 'snarl',
      },
    ],
  },
  {
    maxRecommendedLevel: 40,
    goldBounty: 600,
    members: [
      {
        speciesId: 'pawniard',
        nickname: 'Feral Vanguard',
        level: 10,
        stats: { hp: 23, atk: 10, def: 9, spa: 5, spd: 6, spe: 8, mov: 5 },
        moveIds: ['metal_claw', 'assurance'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'rookidee',
        nickname: 'Feral Harrier',
        level: 10,
        stats: { hp: 21, atk: 8, def: 6, spa: 5, spd: 6, spe: 10, mov: 6 },
        moveIds: ['peck'],
        equippedMoveId: 'peck',
      },
      {
        speciesId: 'aron',
        nickname: 'Feral Cragbreaker',
        level: 10,
        stats: { hp: 25, atk: 9, def: 11, spa: 5, spd: 6, spe: 5, mov: 4 },
        moveIds: ['metal_claw', 'rock_tomb'],
        equippedMoveId: 'metal_claw',
      },
      {
        speciesId: 'gothita',
        nickname: 'Feral Channeler',
        level: 10,
        stats: { hp: 20, atk: 5, def: 7, spa: 10, spd: 9, spe: 7, mov: 5 },
        moveIds: ['confusion', 'psybeam'],
        equippedMoveId: 'psybeam',
      },
    ],
  },
];

export function buildSkirmishBattlePayload(
  node: OverworldNodeDefinition,
  skirmish: SkirmishSpawnState
): {
  customMap: DungeonMapDefinition;
  enemyOverrides: ManualEnemyBattleSpawn[];
  goldBounty: number;
} {
  const baseMap = cloneDungeonMap(getEffectiveChapterMap(node.levelId));
  const tier =
    FERAL_SKIRMISH_SQUADS_BY_TIER.find(
      (t) => skirmish.recommendedLevel <= t.maxRecommendedLevel
    ) ?? FERAL_SKIRMISH_SQUADS_BY_TIER[FERAL_SKIRMISH_SQUADS_BY_TIER.length - 1]!;

  const fallbackCoords: ReadonlyArray<{ x: number; y: number }> = [
    { x: Math.max(2, baseMap.width - 6), y: Math.floor(baseMap.height / 2) },
    { x: Math.max(2, baseMap.width - 5), y: Math.max(2, Math.floor(baseMap.height / 2) - 2) },
    {
      x: Math.max(2, baseMap.width - 4),
      y: Math.min(baseMap.height - 3, Math.floor(baseMap.height / 2) + 2),
    },
    { x: Math.max(2, baseMap.width - 3), y: Math.floor(baseMap.height / 2) },
  ];

  const enemyOverrides: ManualEnemyBattleSpawn[] = tier.members.map((tpl, idx) => {
    const mapSpawn = baseMap.enemySpawns[idx];
    const coord = mapSpawn
      ? { x: mapSpawn.x, y: mapSpawn.y }
      : (fallbackCoords[idx % fallbackCoords.length] ?? { x: 10, y: 5 });

    return {
      id: `skirmish_enemy_${idx}`,
      x: coord.x,
      y: coord.y,
      speciesId: tpl.speciesId,
      nickname: tpl.nickname,
      level: Math.max(tpl.level, skirmish.recommendedLevel),
      stats: skirmish.recommendedLevel > tpl.level ? undefined : { ...tpl.stats },
      moveIds: [...tpl.moveIds],
      equippedMoveId: tpl.equippedMoveId,
      heldItemId: null,
    };
  });

  const customMap: DungeonMapDefinition = {
    ...baseMap,
    id: `skirmish_${node.id}`,
    name: `${node.name} — Skirmish`,
    objectiveType: 'rout',
    objectiveLabel: 'Rout Feral Raiders',
    npcSpawns: undefined,
    reinforcements: undefined,
    events: undefined,
    defeatIfUnitIdsFall: undefined,
    enemySpawns: enemyOverrides.map((e) => ({
      x: e.x,
      y: e.y,
      speciesId: e.speciesId,
      level: e.level,
      nickname: e.nickname,
      heldItemId: null,
    })),
  };

  return {
    customMap,
    enemyOverrides,
    goldBounty: tier.goldBounty,
  };
}
