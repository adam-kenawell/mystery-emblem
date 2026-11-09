/**
 * Mystery Emblem — Awakening-Style Feral Skirmish & Kecleon Shop Spawners
 */

import {
  ALL_KECLEON_SHOP_TYPES,
  DEMO_OVERWORLD_GRAPH,
  buildKecleonShopInventory,
  type OverworldGraphDefinition,
  type OverworldNodeDefinition,
} from '../../data/overworldMapData';
import type {
  KecleonShopSpawnState,
  KecleonShopType,
  OverworldNodeState,
  SkirmishSpawnState,
} from '../../types/schemas';

export function buildKecleonShopState(
  shopType?: KecleonShopType,
  rng: () => number = Math.random
): KecleonShopSpawnState {
  const validType =
    shopType && ALL_KECLEON_SHOP_TYPES.includes(shopType) ? shopType : undefined;
  const resolvedType =
    validType ??
    ALL_KECLEON_SHOP_TYPES[
      Math.floor(rng() * ALL_KECLEON_SHOP_TYPES.length) % ALL_KECLEON_SHOP_TYPES.length
    ]!;
  return {
    shopType: resolvedType,
    inventoryItemIds: buildKecleonShopInventory(resolvedType, rng),
  };
}

export function buildSkirmishSpawnState(
  node: OverworldNodeDefinition,
  overrides?: {
    recommendedLevel?: number;
    tilesetId?: string;
    spawnedAtTimestamp?: number;
  }
): SkirmishSpawnState {
  return {
    spawnedAtTimestamp: overrides?.spawnedAtTimestamp ?? Date.now(),
    recommendedLevel: Math.max(
      1,
      Math.min(40, Math.floor(overrides?.recommendedLevel ?? node.recommendedLevel))
    ),
    tilesetId: overrides?.tilesetId ?? node.tilesetId,
  };
}

export interface PostBattleSpawnOptions {
  justClearedNodeId?: string;
  kecleonShopsUnlocked: boolean;
  skirmishChance?: number;
  maxActiveSkirmishes?: number;
  shopChance?: number;
  maxActiveShops?: number;
  rng?: () => number;
  nowTimestamp?: number;
}

export interface PostBattleSpawnResult {
  spawnedSkirmishNodeId: string | null;
  spawnedShopNodeId: string | null;
  spawnedShopType: KecleonShopType | null;
}

export function rollPostBattleOverworldSpawns(
  nodes: Record<string, OverworldNodeState>,
  graph: OverworldGraphDefinition = DEMO_OVERWORLD_GRAPH,
  options: PostBattleSpawnOptions
): PostBattleSpawnResult {
  const rng = options.rng ?? Math.random;
  const nowTimestamp = options.nowTimestamp ?? Date.now();
  const skirmishChance = options.skirmishChance ?? 0.35;
  const maxActiveSkirmishes = options.maxActiveSkirmishes ?? 2;
  const shopChance = options.shopChance ?? 0.55;
  const maxActiveShops = options.maxActiveShops ?? 2;

  let spawnedSkirmishNodeId: string | null = null;
  let spawnedShopNodeId: string | null = null;
  let spawnedShopType: KecleonShopType | null = null;

  const clearedDefs = graph.nodes.filter((def) => nodes[def.id]?.unlocked && nodes[def.id]?.cleared);

  const activeSkirmishCount = clearedDefs.filter((def) => Boolean(nodes[def.id]?.activeSkirmish)).length;
  if (activeSkirmishCount < maxActiveSkirmishes && clearedDefs.length > 0 && rng() < skirmishChance) {
    const preferred = clearedDefs.filter(
      (def) => !nodes[def.id]?.activeSkirmish && def.id !== options.justClearedNodeId
    );
    const pool =
      preferred.length > 0
        ? preferred
        : clearedDefs.filter((def) => !nodes[def.id]?.activeSkirmish);

    if (pool.length > 0) {
      const picked = pool[Math.floor(rng() * pool.length) % pool.length]!;
      nodes[picked.id]!.activeSkirmish = buildSkirmishSpawnState(picked, {
        spawnedAtTimestamp: nowTimestamp,
      });
      spawnedSkirmishNodeId = picked.id;
    }
  }

  if (options.kecleonShopsUnlocked && clearedDefs.length > 0) {
    const activeShopCount = clearedDefs.filter((def) => Boolean(nodes[def.id]?.activeKecleonShop)).length;
    if (activeShopCount < maxActiveShops && rng() < shopChance) {
      const candidates = clearedDefs.filter((def) => !nodes[def.id]?.activeKecleonShop);
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(rng() * candidates.length) % candidates.length]!;
        const shopState = buildKecleonShopState(undefined, rng);
        nodes[picked.id]!.activeKecleonShop = shopState;
        spawnedShopNodeId = picked.id;
        spawnedShopType = shopState.shopType;
      }
    }
  }

  return {
    spawnedSkirmishNodeId,
    spawnedShopNodeId,
    spawnedShopType,
  };
}
