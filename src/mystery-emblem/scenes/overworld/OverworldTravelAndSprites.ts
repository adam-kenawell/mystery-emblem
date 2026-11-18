/**
 * Mystery Emblem - Overworld Sprite Preloading, 8-Dir Travel & Node Action Helpers (`OverworldTravelAndSprites.ts`)
 */

import {
  loadSpeciesSpriteBundle,
  resolveAnimFrameIndex,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdSpriteAction,
} from '../../assets/pmdAssetLoader';
import type { AudioManager } from '../../audio/AudioManager';
import {
  KECLEON_PMD_ASSET_ID,
  buildSkirmishBattlePayload,
  getOverworldNodeById,
  type OverworldGraphDefinition,
  type OverworldNodeDefinition,
} from '../../data/overworldMapData';
import { areSupportsUnlockedInCampaign } from '../../data/supports/supportMatrix';
import {
  findOverworldRoute,
  samplePolylineAtDistance,
  type OverworldRouteResult,
} from '../../engine/overworldEngine';
import { formatCampaignChapterLabel, type SaveStateManager } from '../../state/SaveStateManager';
import type {
  DungeonMapDefinition,
  ManualEnemyBattleSpawn,
  OwnedPokemonInstance,
  OverworldNodeState,
  SaveData,
} from '../../types/schemas';
import type { DialogueOverlay } from '../../ui/DialogueOverlay';
import type { TutorialOverlay } from '../../ui/TutorialOverlay';
import type { OverworldCameraAndPointersController } from './OverworldCameraAndPointers';

const LORD_WALK_SPEED_PX_PER_SEC = 105;

export interface OverworldSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  tutorialOverlay?: TutorialOverlay;
  dialogueOverlay?: DialogueOverlay;
  graph?: OverworldGraphDefinition;
  onLayerStateChanged: () => void;
  onLaunchChapterBattle?: (req: { nodeId: string; levelId: string }) => void;
  onLaunchSkirmishBattle?: (req: {
    nodeId: string;
    customMap: DungeonMapDefinition;
    enemyOverrides: ManualEnemyBattleSpawn[];
    goldBounty: number;
  }) => void;
  onExit: () => void;
  onRequestNewGame?: () => void;
  onReplayCutscene?: (cutsceneId: string) => void;
  onReplayCredits?: () => void;
  onStateChange?: () => void;
}

export function getActiveLordUnit(save: SaveData | null): OwnedPokemonInstance | null {
  if (!save || save.roster.length === 0) return null;
  return (
    save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
    save.roster.find((u) => u.isLord) ??
    save.roster[0] ??
    null
  );
}

export function getOverworldArrivalTutorialTopicIds(save: SaveData): string[] {
  const out = ['overworld_expedition_menu'];
  if (
    save.campaign.skirmishesUnlocked ||
    Object.values(save.overworld?.nodes ?? {}).some((n) => Boolean(n.activeSkirmish))
  ) {
    out.push('overworld_and_skirmishes');
  }
  if (areSupportsUnlockedInCampaign(save)) {
    out.push('overworld_supports_unlocked');
  }
  return out;
}

export function formatOverworldChapterAnnouncement(
  save: SaveData,
  graph: OverworldGraphDefinition,
  reconciled: { currentNodeId: string }
): string {
  const chLabel = formatCampaignChapterLabel(save.campaign.currentChapterId);
  const curNode =
    graph.nodes.find((n) => n.levelId === save.campaign.currentChapterId) ??
    getOverworldNodeById(reconciled.currentNodeId, graph);
  if (save.campaign.demoCompleted) return `${chLabel} - All Chapters Complete`;
  return curNode ? `${chLabel} - ${curNode.name}` : chLabel;
}

export interface OverworldClearSequence {
  clearedNodeId: string;
  newlyUnlockedNodeIds: string[];
  newlyUnlockedEdgeIds: string[];
  phase: 'red_to_green' | 'draw_edges' | 'pop_nodes';
  progress: number;
  edgeProgress: number;
  popScale: number;
}

export class OverworldTravelAndSpritesController {
  public readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  public lordWorldX = 208;
  public lordWorldY = 194;
  public lordDirection: PmdDirection = 0;
  public lordAction: PmdSpriteAction = 'Idle';
  public animClockMs = 0;
  public activeTravel: {
    targetNodeId: string;
    route: OverworldRouteResult;
    walkedDistancePx: number;
    resolveArrival: () => void;
  } | null = null;
  public activeClearSequence: OverworldClearSequence | null = null;
  private cancelCelebration: (() => void) | null = null;

  private readonly loadingSpriteIds = new Set<string>();
  private lastRafTickMs = 0;
  private rafId: number | null = null;
  private lastRenderKey = '';

  constructor(
    private readonly deps: {
      saveManager: SaveStateManager;
      audioManager: AudioManager;
      cam: OverworldCameraAndPointersController;
      getGraph: () => OverworldGraphDefinition;
      getReconciledState: (save: SaveData | null) => {
        currentNodeId: string;
        nodes: Record<string, OverworldNodeState>;
      };
      getMapSourceLoaded: () => boolean;
      isOpen: () => boolean;
      onRenderFrame: () => void;
      onSyncHudAndDock: () => void;
      onShowToast: (text: string) => void;
      onOpenKecleonShop: () => void;
      onLaunchChapterBattle?: OverworldSceneOptions['onLaunchChapterBattle'];
      onLaunchSkirmishBattle?: OverworldSceneOptions['onLaunchSkirmishBattle'];
    }
  ) {}

  public invalidateRenderCache(): void {
    this.lastRenderKey = '';
  }

  public requestSpriteBundle(id: string): void {
    if (this.spriteBundles.has(id) || this.loadingSpriteIds.has(id)) return;
    this.loadingSpriteIds.add(id);
    void loadSpeciesSpriteBundle(id)
      .then((bundle) => {
        this.spriteBundles.set(id, bundle);
        this.loadingSpriteIds.delete(id);
        this.invalidateRenderCache();
        if (this.deps.isOpen()) this.deps.onRenderFrame();
      })
      .catch(() => this.loadingSpriteIds.delete(id));
  }

  public preloadActiveSprites(): void {
    const save = this.deps.saveManager.getReadOnlySave();
    const graph = this.deps.getGraph();
    const lord = getActiveLordUnit(save);
    if (lord) this.requestSpriteBundle(lord.speciesId);
    this.requestSpriteBundle(KECLEON_PMD_ASSET_ID);
    if (save) {
      const rec = this.deps.getReconciledState(save);
      for (const def of graph.nodes) {
        if (rec.nodes[def.id]?.activeSkirmish) this.requestSpriteBundle(def.skirmishScoutSpeciesId);
      }
    }
  }

  public async ensureLordAndKecleonPreloaded(): Promise<void> {
    const lord = getActiveLordUnit(this.deps.saveManager.getReadOnlySave());
    for (const id of [KECLEON_PMD_ASSET_ID, lord?.speciesId ?? 'dratini']) {
      if (!this.spriteBundles.has(id)) {
        this.spriteBundles.set(id, await loadSpeciesSpriteBundle(id));
      }
    }
    this.invalidateRenderCache();
  }

  public snapLordToCurrentNode(): void {
    const save = this.deps.saveManager.getReadOnlySave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = this.deps.getReconciledState(save);
    const def = getOverworldNodeById(rec.currentNodeId, graph) ?? getOverworldNodeById(graph.startNodeId, graph);
    if (def) {
      this.lordWorldX = def.x;
      this.lordWorldY = def.y;
      this.lordAction = 'Idle';
      this.lordDirection = 0;
    }
    this.invalidateRenderCache();
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastRafTickMs = performance.now();
    const tick = (nowMs: number) => {
      if (!this.deps.isOpen()) {
        this.rafId = null;
        return;
      }
      const dtMs = Math.min(80, Math.max(0, nowMs - this.lastRafTickMs));
      this.lastRafTickMs = nowMs;
      this.animClockMs += dtMs;
      this.stepTravel(dtMs);

      const frameKey = this.computeRenderKey();
      if (frameKey !== this.lastRenderKey) {
        this.lastRenderKey = frameKey;
        this.deps.onRenderFrame();
      }
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private computeRenderKey(): string {
    const { cam } = this.deps;
    const save = this.deps.saveManager.getReadOnlySave();
    const lord = getActiveLordUnit(save);
    const lordBundle = lord ? this.spriteBundles.get(lord.speciesId) : undefined;
    const lordAnim = lordBundle ? (lordBundle.actions[this.lordAction] ?? lordBundle.actions.Idle) : undefined;
    const lordFrame = lordAnim ? resolveAnimFrameIndex(lordAnim, this.animClockMs) : 0;
    const kecAnim = this.spriteBundles.get(KECLEON_PMD_ASSET_ID)?.actions.Idle;
    const kecFrame = kecAnim ? resolveAnimFrameIndex(kecAnim, this.animClockMs) : 0;
    const pulseBucket = Math.floor(this.animClockMs / 180);
    return [
      this.deps.getMapSourceLoaded() ? 1 : 0,
      cam.cameraX,
      cam.cameraY,
      cam.displayScale,
      cam.viewWidthPx,
      cam.viewHeightPx,
      cam.hoveredNodeId ?? '',
      cam.hoverRoutePreview?.nodePath.join(',') ?? '',
      this.activeTravel ? `${Math.round(this.lordWorldX * 4)},${Math.round(this.lordWorldY * 4)},${this.lordDirection}` : 'idle',
      this.lordAction,
      this.activeClearSequence ? `${this.activeClearSequence.phase}:${this.activeClearSequence.progress.toFixed(2)}` : '',
      this.spriteBundles.size,
      save?.lastUpdated ?? 0,
      lordFrame,
      kecFrame,
      pulseBucket,
    ].join('|');
  }

  public stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public launchCurrentChapterBattle(): void {
    const save = this.deps.saveManager.getReadOnlySave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = this.deps.getReconciledState(save);
    const def = getOverworldNodeById(rec.currentNodeId, graph);
    if (!def || rec.nodes[def.id]?.cleared) return;
    this.deps.audioManager.playSfx('select');
    this.deps.onLaunchChapterBattle?.({ nodeId: def.id, levelId: def.levelId });
  }

  public launchCurrentSkirmishBattle(): void {
    const save = this.deps.saveManager.getReadOnlySave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = this.deps.getReconciledState(save);
    const def = getOverworldNodeById(rec.currentNodeId, graph);
    const skirmish = rec.nodes[rec.currentNodeId]?.activeSkirmish;
    if (!def || !skirmish) return;
    this.deps.audioManager.playSfx('select');
    const payload = buildSkirmishBattlePayload(def, skirmish);
    this.deps.onLaunchSkirmishBattle?.({
      nodeId: def.id,
      customMap: payload.customMap,
      enemyOverrides: payload.enemyOverrides,
      goldBounty: payload.goldBounty,
    });
  }

  public clearCelebrationSequence(): void {
    if (this.cancelCelebration) {
      this.cancelCelebration();
      this.cancelCelebration = null;
    }
    this.activeClearSequence = null;
    this.invalidateRenderCache();
  }

  public async playChapterClearCelebration(params: {
    clearedNodeId: string;
    newlyUnlockedNodeIds: string[];
    newlyUnlockedEdgeIds: string[];
  }): Promise<void> {
    const { clearedNodeId, newlyUnlockedNodeIds, newlyUnlockedEdgeIds } = params;
    this.clearCelebrationSequence();

    let aborted = false;
    this.cancelCelebration = () => {
      aborted = true;
    };

    const animateDuration = async (
      durationMs: number,
      onFrame: (t: number) => void
    ): Promise<void> => {
      const startMs = performance.now();
      while (!aborted && this.deps.isOpen()) {
        const now = performance.now();
        const elapsed = now - startMs;
        const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
        onFrame(t);
        this.deps.onRenderFrame();
        if (t >= 1) break;
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
    };

    try {
      this.activeClearSequence = {
        clearedNodeId,
        newlyUnlockedNodeIds,
        newlyUnlockedEdgeIds,
        phase: 'red_to_green',
        progress: 0,
        edgeProgress: 0,
        popScale: 0,
      };
      this.deps.audioManager.playSfx('heal');

      await animateDuration(450, (t) => {
        if (this.activeClearSequence) {
          this.activeClearSequence.progress = t;
        }
      });
      if (aborted || !this.deps.isOpen()) return;

      if (newlyUnlockedEdgeIds.length > 0) {
        this.activeClearSequence.phase = 'draw_edges';
        this.activeClearSequence.progress = 0;
        this.activeClearSequence.edgeProgress = 0;

        await animateDuration(420, (t) => {
          if (this.activeClearSequence) {
            this.activeClearSequence.progress = t;
            this.activeClearSequence.edgeProgress = t;
          }
        });
        if (aborted || !this.deps.isOpen()) return;
      }

      if (newlyUnlockedNodeIds.length > 0) {
        this.activeClearSequence.phase = 'pop_nodes';
        this.activeClearSequence.progress = 0;
        this.activeClearSequence.edgeProgress = 1;
        this.activeClearSequence.popScale = 0;
        this.deps.audioManager.playSfx('select');

        await animateDuration(280, (t) => {
          if (this.activeClearSequence) {
            this.activeClearSequence.progress = t;
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const s = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            this.activeClearSequence.popScale = Math.max(0, s);
          }
        });
        if (aborted || !this.deps.isOpen()) return;
      }
    } finally {
      this.activeClearSequence = null;
      this.cancelCelebration = null;
      this.invalidateRenderCache();
      this.deps.onRenderFrame();
    }
  }

  public async handleNodeTapped(node: OverworldNodeDefinition): Promise<void> {
    if (this.activeTravel || this.activeClearSequence) return;
    const save = this.deps.saveManager.getReadOnlySave();
    if (!save) return;
    const rec = this.deps.getReconciledState(save);
    const st = rec.nodes[node.id];
    if (!st?.unlocked) {
      this.deps.audioManager.playSfx('cancel');
      this.deps.onShowToast(`${node.name} is locked`);
      return;
    }
    if (node.id === rec.currentNodeId) {
      if (st.activeKecleonShop && st.cleared && !st.activeSkirmish) this.deps.onOpenKecleonShop();
      else if (!st.cleared) this.launchCurrentChapterBattle();
      else if (st.activeSkirmish) this.launchCurrentSkirmishBattle();
      else {
        this.deps.audioManager.playSfx('select');
        this.deps.cam.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
        this.invalidateRenderCache();
        this.deps.onRenderFrame();
      }
      return;
    }
    this.deps.cam.hoverRoutePreview = null;
    await this.travelToNode(node.id);
  }

  public async travelToNode(nodeId: string): Promise<boolean> {
    if (!this.deps.isOpen() || this.activeTravel || this.activeClearSequence) return false;
    const save = this.deps.saveManager.getReadOnlySave();
    const graph = this.deps.getGraph();
    if (!save) return false;
    const rec = this.deps.getReconciledState(save);
    if (nodeId === rec.currentNodeId) {
      this.deps.audioManager.playSfx('select');
      this.deps.cam.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
      this.invalidateRenderCache();
      this.deps.onRenderFrame();
      return true;
    }
    const route = findOverworldRoute(graph, rec.nodes, rec.currentNodeId, nodeId);
    if (!route.reachable || route.points.length < 2) {
      this.deps.audioManager.playSfx('cancel');
      this.deps.onShowToast('Locked');
      return false;
    }

    this.deps.audioManager.playSfx('select');

    return new Promise<boolean>((resolve) => {
      const first = samplePolylineAtDistance(route.points, 0, this.lordDirection);
      this.lordWorldX = first.x;
      this.lordWorldY = first.y;
      this.lordDirection = first.direction;
      this.lordAction = 'Walk';
      this.activeTravel = { targetNodeId: nodeId, route, walkedDistancePx: 0, resolveArrival: () => resolve(true) };
      this.invalidateRenderCache();
      this.deps.onRenderFrame();
    });
  }

  private stepTravel(dtMs: number): void {
    if (!this.activeTravel) return;
    this.activeTravel.walkedDistancePx += (LORD_WALK_SPEED_PX_PER_SEC * dtMs) / 1000;
    const sample = samplePolylineAtDistance(this.activeTravel.route.points, this.activeTravel.walkedDistancePx, this.lordDirection);
    this.lordWorldX = sample.x;
    this.lordWorldY = sample.y;
    this.lordDirection = sample.direction;
    this.lordAction = 'Walk';
    this.deps.cam.ensurePointComfortableInCamera(this.lordWorldX, this.lordWorldY);

    if (sample.completed) {
      const graph = this.deps.getGraph();
      const arrivedId = this.activeTravel.targetNodeId;
      const done = this.activeTravel.resolveArrival;
      this.activeTravel = null;
      this.lordAction = 'Idle';
      this.lordDirection = 0;
      const arrivedDef = getOverworldNodeById(arrivedId, graph);
      if (arrivedDef) {
        this.lordWorldX = arrivedDef.x;
        this.lordWorldY = arrivedDef.y;
      }
      this.deps.saveManager.setOverworldCurrentNode(arrivedId, graph);
      this.deps.audioManager.playSfx('dialogue_advance');
      this.invalidateRenderCache();
      this.deps.onSyncHudAndDock();
      done();
    }
  }
}
