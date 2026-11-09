/**
 * Mystery Emblem — Overworld Scene Options, Snapshot & Tutorial Trigger Helpers (`overworldSnapshot.ts`)
 */

import type { PmdDirection } from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import { getItemById } from '../../data/index';
import type { OverworldGraphDefinition, OverworldPoint } from '../../data/overworldMapData';
import { ensureOverworldGraphState } from '../../engine/overworldEngine';
import { getEligibleEvolutionBranches } from '../../engine/progressionEngine';
import type { SaveStateManager } from '../../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  KecleonShopType,
  ManualEnemyBattleSpawn,
  OwnedPokemonInstance,
  SaveData,
} from '../../types/schemas';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import type { OverworldCameraAndPointersController } from './OverworldCameraAndPointers';
import type { OverworldTravelAndSpritesController } from './OverworldTravelAndSprites';
import type { OverworldMenuTab } from './overworldDomTemplates';

export interface OverworldSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  tutorialOverlay?: TutorialOverlay;
  graph?: OverworldGraphDefinition;
  onExit: () => void;
  onRequestNewGame?: () => void;
  onLayerStateChanged: () => void;
  onRequestRenameUnit?: (instanceId: string) => Promise<void> | void;
  onLaunchChapterBattle?: (payload: { nodeId: string; levelId: string }) => void;
  onReplayCutscene?: (cutsceneId: string) => void;
  onReplayCredits?: () => void;
  onLaunchSkirmishBattle?: (payload: {
    nodeId: string;
    customMap: DungeonMapDefinition;
    enemyOverrides: ManualEnemyBattleSpawn[];
    goldBounty: number;
  }) => void;
}

export interface OverworldSceneSnapshot {
  isOpen: boolean;
  currentNodeId: string;
  isTraveling: boolean;
  travelTargetNodeId: string | null;
  lastRouteNodePath: string[];
  lastRoutePoints: OverworldPoint[];
  lastTravelDirections: PmdDirection[];
  lordWorldPos: { x: number; y: number };
  lordDirection: PmdDirection;
  lordSpeciesId: string;
  lordNickname: string;
  displayScale: number;
  camera: {
    x: number; y: number; minX: number; minY: number; maxX: number; maxY: number;
    viewWidthPx: number; viewHeightPx: number;
  };
  unlockedNodeIds: string[];
  clearedNodeIds: string[];
  activeShopNodes: Array<{ nodeId: string; shopType: KecleonShopType; stockCount: number }>;
  activeSkirmishNodes: Array<{ nodeId: string; recommendedLevel: number; scoutSpeciesId: string }>;
  kecleonShopOpen: boolean;
  systemMenuOpen: boolean;
  activeMenuTab: OverworldMenuTab;
  fastMode: boolean;
}

export function getActiveLordUnit(save: SaveData | null): OwnedPokemonInstance | undefined {
  if (!save || save.roster.length === 0) return undefined;
  return (
    save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
    save.roster.find((u) => u.isLord) ??
    save.roster[0]
  );
}

export function getOverworldArrivalTutorialTopicIds(save: SaveData): string[] {
  const topics = ['overworld_and_skirmishes'];
  if (save.campaign.kecleonShopsUnlocked) topics.push('kecleon_shops_and_tms');
  if (save.convoy.some((c) => c.quantity > 0 && getItemById(c.itemId)?.category === 'vitamin')) {
    topics.push('ch4_vitamins');
  }
  const hasStone = save.convoy.some((c) => c.itemId === 'evolution_stone' && c.quantity > 0);
  const hasGem = save.convoy.some((c) => c.itemId === 'evolution_gem' && c.quantity > 0);
  const anyCanPromote = save.roster.some((u) => {
    const s = getEligibleEvolutionBranches(u.speciesId, u.level, 'evolution_stone');
    const g = getEligibleEvolutionBranches(u.speciesId, u.level, 'evolution_gem');
    return (
      s.some((b) => u.consumableItemId === b.requiredItemId || hasStone) ||
      g.some((b) => u.consumableItemId === b.requiredItemId || hasGem)
    );
  });
  if (anyCanPromote) topics.push('levelup_and_evolution');
  return topics;
}

export function buildOverworldSceneSnapshot(params: {
  isOpen: boolean;
  fastMode: boolean;
  save: SaveData | null;
  graph: OverworldGraphDefinition;
  cam: OverworldCameraAndPointersController;
  travelCtrl: OverworldTravelAndSpritesController;
  kecleonShopOpen: boolean;
  systemMenuOpen: boolean;
  activeMenuTab: OverworldMenuTab;
}): OverworldSceneSnapshot {
  const { isOpen, fastMode, save, graph, cam, travelCtrl } = params;
  const rec = save ? ensureOverworldGraphState(save, graph) : { currentNodeId: graph.startNodeId, nodes: {}, mutated: false };
  const lord = getActiveLordUnit(save);
  const b = cam.getMaxCameraBounds();
  const unlockedNodeIds: string[] = [];
  const clearedNodeIds: string[] = [];
  const activeShopNodes: OverworldSceneSnapshot['activeShopNodes'] = [];
  const activeSkirmishNodes: OverworldSceneSnapshot['activeSkirmishNodes'] = [];

  for (const def of graph.nodes) {
    const st = rec.nodes[def.id];
    if (st?.unlocked) unlockedNodeIds.push(def.id);
    if (st?.cleared) clearedNodeIds.push(def.id);
    if (st?.activeKecleonShop) {
      activeShopNodes.push({ nodeId: def.id, shopType: st.activeKecleonShop.shopType, stockCount: st.activeKecleonShop.inventoryItemIds.length });
    }
    if (st?.activeSkirmish) {
      activeSkirmishNodes.push({ nodeId: def.id, recommendedLevel: st.activeSkirmish.recommendedLevel, scoutSpeciesId: def.skirmishScoutSpeciesId });
    }
  }

  return {
    isOpen,
    currentNodeId: rec.currentNodeId,
    isTraveling: Boolean(travelCtrl.activeTravel),
    travelTargetNodeId: travelCtrl.activeTravel?.targetNodeId ?? null,
    lastRouteNodePath: [...travelCtrl.lastRouteNodePath],
    lastRoutePoints: travelCtrl.lastRoutePoints.map((p) => ({ x: p.x, y: p.y })),
    lastTravelDirections: [...travelCtrl.lastTravelDirections],
    lordWorldPos: { x: Math.round(travelCtrl.lordWorldX * 100) / 100, y: Math.round(travelCtrl.lordWorldY * 100) / 100 },
    lordDirection: travelCtrl.lordDirection,
    lordSpeciesId: lord?.speciesId ?? 'dratini',
    lordNickname: lord?.nickname ?? 'Dratini',
    displayScale: cam.displayScale,
    camera: {
      x: Math.round(cam.cameraX * 100) / 100, y: Math.round(cam.cameraY * 100) / 100,
      minX: Math.round(b.minX * 100) / 100, minY: Math.round(b.minY * 100) / 100,
      maxX: Math.round(b.maxX * 100) / 100, maxY: Math.round(b.maxY * 100) / 100,
      viewWidthPx: cam.viewWidthPx, viewHeightPx: cam.viewHeightPx,
    },
    unlockedNodeIds, clearedNodeIds, activeShopNodes, activeSkirmishNodes,
    kecleonShopOpen: params.kecleonShopOpen, systemMenuOpen: params.systemMenuOpen,
    activeMenuTab: params.activeMenuTab, fastMode,
  };
}
