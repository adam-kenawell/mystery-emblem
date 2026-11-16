/**
 * Mystery Emblem - Overworld Sprite Preloading, 8-Dir Travel & Node Action Helpers (`OverworldTravelAndSprites.ts`)
 */

import {
  loadSpeciesSpriteBundle,
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
  type OverworldPoint,
} from '../../data/overworldMapData';
import {
  ensureOverworldGraphState,
  findOverworldRoute,
  samplePolylineAtDistance,
  type OverworldRouteResult,
} from '../../engine/overworldEngine';
import { formatCampaignChapterLabel, type SaveStateManager } from '../../state/SaveStateManager';
import type { SaveData } from '../../types/schemas';
import type { OverworldCameraAndPointersController } from './OverworldCameraAndPointers';
import { getActiveLordUnit, type OverworldSceneOptions } from './overworldSnapshot';

const LORD_WALK_SPEED_NORMAL_PX_PER_SEC = 105;
const LORD_WALK_SPEED_FAST_PX_PER_SEC = 560;

export function formatOverworldChapterAnnouncement(
  save: SaveData,
  graph: OverworldGraphDefinition
): string {
  const chLabel = formatCampaignChapterLabel(save.campaign.currentChapterId);
  const rec = ensureOverworldGraphState(save, graph);
  const curNode =
    graph.nodes.find((n) => n.levelId === save.campaign.currentChapterId) ??
    getOverworldNodeById(rec.currentNodeId, graph);
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
  public lastRouteNodePath: string[] = [];
  public lastRoutePoints: OverworldPoint[] = [];
  public lastTravelDirections: PmdDirection[] = [];

  private readonly loadingSpriteIds = new Set<string>();
  private lastRafTickMs = 0;
  private rafId: number | null = null;

  constructor(
    private readonly deps: {
      saveManager: SaveStateManager;
      audioManager: AudioManager;
      cam: OverworldCameraAndPointersController;
      getGraph: () => OverworldGraphDefinition;
      isOpen: () => boolean;
      isFastMode: () => boolean;
      onRenderFrame: () => void;
      onSyncHudAndDock: () => void;
      onShowToast: (text: string) => void;
      onOpenKecleonShop: () => void;
      onLaunchChapterBattle?: OverworldSceneOptions['onLaunchChapterBattle'];
      onLaunchSkirmishBattle?: OverworldSceneOptions['onLaunchSkirmishBattle'];
    }
  ) {}

  public requestSpriteBundle(id: string): void {
    if (this.spriteBundles.has(id) || this.loadingSpriteIds.has(id)) return;
    this.loadingSpriteIds.add(id);
    void loadSpeciesSpriteBundle(id)
      .then((bundle) => {
        this.spriteBundles.set(id, bundle);
        this.loadingSpriteIds.delete(id);
        if (this.deps.isOpen()) this.deps.onRenderFrame();
      })
      .catch(() => this.loadingSpriteIds.delete(id));
  }

  public preloadActiveSprites(): void {
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    const lord = getActiveLordUnit(save);
    if (lord) this.requestSpriteBundle(lord.speciesId);
    this.requestSpriteBundle(KECLEON_PMD_ASSET_ID);
    if (save) {
      const rec = ensureOverworldGraphState(save, graph);
      for (const def of graph.nodes) {
        if (rec.nodes[def.id]?.activeSkirmish) this.requestSpriteBundle(def.skirmishScoutSpeciesId);
      }
    }
  }

  public async ensureLordAndKecleonPreloaded(): Promise<void> {
    const lord = getActiveLordUnit(this.deps.saveManager.getSave());
    for (const id of [KECLEON_PMD_ASSET_ID, lord?.speciesId ?? 'dratini']) {
      if (!this.spriteBundles.has(id)) {
        this.spriteBundles.set(id, await loadSpeciesSpriteBundle(id));
      }
    }
  }

  public snapLordToCurrentNode(): void {
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = ensureOverworldGraphState(save, graph);
    const def = getOverworldNodeById(rec.currentNodeId, graph) ?? getOverworldNodeById(graph.startNodeId, graph);
    if (def) {
      this.lordWorldX = def.x;
      this.lordWorldY = def.y;
      this.lordAction = 'Idle';
      this.lordDirection = 0;
    }
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
      this.deps.onRenderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  public stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public launchCurrentChapterBattle(): void {
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = ensureOverworldGraphState(save, graph);
    const def = getOverworldNodeById(rec.currentNodeId, graph);
    if (!def || rec.nodes[def.id]?.cleared) return;
    this.deps.audioManager.playSfx('select');
    this.deps.onLaunchChapterBattle?.({ nodeId: def.id, levelId: def.levelId });
  }

  public launchCurrentSkirmishBattle(): void {
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = ensureOverworldGraphState(save, graph);
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

      const p1Duration = this.deps.isFastMode() ? 40 : 450;
      await animateDuration(p1Duration, (t) => {
        if (this.activeClearSequence) {
          this.activeClearSequence.progress = t;
        }
      });
      if (aborted || !this.deps.isOpen()) return;

      if (newlyUnlockedEdgeIds.length > 0) {
        this.activeClearSequence.phase = 'draw_edges';
        this.activeClearSequence.progress = 0;
        this.activeClearSequence.edgeProgress = 0;

        const p2Duration = this.deps.isFastMode() ? 40 : 420;
        await animateDuration(p2Duration, (t) => {
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

        const p3Duration = this.deps.isFastMode() ? 30 : 280;
        await animateDuration(p3Duration, (t) => {
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
      this.deps.onRenderFrame();
    }
  }

  public async handleNodeTapped(node: OverworldNodeDefinition): Promise<void> {
    if (this.activeTravel || this.activeClearSequence) return;
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    if (!save) return;
    const rec = ensureOverworldGraphState(save, graph);
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
        this.deps.onRenderFrame();
      }
      return;
    }
    this.deps.cam.hoverRoutePreview = null;
    await this.travelToNode(node.id);
  }

  public async travelToNode(nodeId: string): Promise<boolean> {
    if (!this.deps.isOpen() || this.activeTravel || this.activeClearSequence) return false;
    const save = this.deps.saveManager.getSave();
    const graph = this.deps.getGraph();
    if (!save) return false;
    const rec = ensureOverworldGraphState(save, graph);
    if (nodeId === rec.currentNodeId) {
      this.deps.audioManager.playSfx('select');
      this.deps.cam.centerCameraOnMapPoint(this.lordWorldX, this.lordWorldY);
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
    this.lastRouteNodePath = [...route.nodePath];
    this.lastRoutePoints = route.points.map((p) => ({ x: p.x, y: p.y }));
    this.lastTravelDirections = [];

    return new Promise<boolean>((resolve) => {
      const first = samplePolylineAtDistance(route.points, 0, this.lordDirection);
      this.lordWorldX = first.x;
      this.lordWorldY = first.y;
      this.lordDirection = first.direction;
      this.lordAction = 'Walk';
      this.recordDirection(first.direction);
      this.activeTravel = { targetNodeId: nodeId, route, walkedDistancePx: 0, resolveArrival: () => resolve(true) };
      this.deps.onRenderFrame();
    });
  }

  private recordDirection(dir: PmdDirection): void {
    if (this.lastTravelDirections[this.lastTravelDirections.length - 1] !== dir) {
      this.lastTravelDirections.push(dir);
    }
  }

  private stepTravel(dtMs: number): void {
    if (!this.activeTravel) return;
    const speed = this.deps.isFastMode() ? LORD_WALK_SPEED_FAST_PX_PER_SEC : LORD_WALK_SPEED_NORMAL_PX_PER_SEC;
    this.activeTravel.walkedDistancePx += (speed * dtMs) / 1000;
    const sample = samplePolylineAtDistance(this.activeTravel.route.points, this.activeTravel.walkedDistancePx, this.lordDirection);
    this.lordWorldX = sample.x;
    this.lordWorldY = sample.y;
    this.lordDirection = sample.direction;
    this.lordAction = 'Walk';
    this.recordDirection(sample.direction);
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
      this.deps.onSyncHudAndDock();
      done();
    }
  }
}
