/**
 * Mystery Emblem — Out-of-Dungeon Choreographed PMD Sprite Cutscene Engine (`CutsceneScene.ts`)
 *
 * Bridges Pokémon Mystery Dungeon: Explorers of Sky and Fire Emblem between-battle storytelling:
 * - Bespoke non-combat `24x24` PMD tile set-pieces rendered onto a `1x` native pixel buffer + integer CSS scale
 *   (`imageSmoothingEnabled = false`, zero fractional tile seams, zero grid lines)
 * - Scenic pixel-art stage props (animated campfire & warm hearth light, Sanctuary crystal pool, ancient runes,
 *   orchard lanterns, berry baskets) and atmospheric lighting/particle moods
 * - Choreographed 8-directional walking, turning, hopping, shivering, combat/aura poses, golden Dragon Aura
 *   ripples, and classic PMD overhead pixel emote bubbles (`!`, `?`, sweat drop, joy sparkles, music note, anger)
 * - Live resolution of `{lord}`, `Piplup`, flower-matched `Flabébé`, `Wimpod` (`0767`), `Serperior` (`0497`),
 *   `Milotic` (`0350`), `Kecleon` (`0352`), and recruited teammate cameos
 * - 100% Unified Pointer Event driven (`pointerdown` / `pointerup` ONLY; ZERO keyboard listeners)
 */

import {
  WIMPOD_PMD_ASSET_ID,
  computePmdTileSpritePlacement,
  directionFromDelta,
  loadSpeciesSpriteBundle,
  normalizePmdDirection,
  resolveUnitVisualAssetId,
  type LoadedSpriteBundle,
  type PmdDirection,
  type PmdDirectionInput,
  type PmdSpriteAction,
} from '../assets/pmdAssetLoader';
import {
  PMD_TILE_NATIVE_PX,
  drawSpecialTerrainOverlay,
  drawTilesetChunk,
  loadTilesetSheet,
  normalizeTilesetId,
  type LoadedTilesetSheet,
} from '../assets/tilesetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { getSpeciesById } from '../data/index';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { DungeonMapTileCell, OwnedPokemonInstance, SaveData } from '../types/schemas';
import type { DialogueFinishReason, DialogueLine, DialogueOverlay, DialogueScript } from '../ui/DialogueOverlay';
import { createPmdButton } from '../ui/PmdWindow';

export type CutsceneLightingMood =
  | 'morning_coast'
  | 'sanctuary_glow'
  | 'campfire_dusk'
  | 'mountain_mist'
  | 'shrine_courtyard'
  | 'twilight_festival';

export type CutscenePropKind =
  | 'campfire'
  | 'sanctuary_crystal'
  | 'lantern'
  | 'ancient_rune'
  | 'berry_basket';

export type CutsceneEmoteKind =
  | 'exclamation'
  | 'question'
  | 'sweat'
  | 'joy'
  | 'music'
  | 'angry'
  | 'heart';

export interface CutscenePropDef {
  id: string;
  kind: CutscenePropKind;
  x: number;
  y: number;
}

export type CutsceneActorRole =
  | { kind: 'lord' }
  | { kind: 'partner' }
  | { kind: 'healer' }
  | { kind: 'advisor' }
  | { kind: 'npc'; pmdAssetId: string; name: string }
  | { kind: 'cameo_recruit'; slotIndex: number };

export interface CutsceneActorSpawnDef {
  actorId: string;
  role: CutsceneActorRole;
  x: number;
  y: number;
  direction: PmdDirectionInput;
  visible?: boolean;
}

export type CutsceneCueAction =
  | {
      type: 'walk';
      actorId: string;
      path: ReadonlyArray<{ x: number; y: number }>;
      speedTilesPerSec?: number;
      endDirection?: PmdDirectionInput;
      delayMs?: number;
    }
  | {
      type: 'face';
      actorId: string;
      direction?: PmdDirectionInput;
      targetActorId?: string;
      delayMs?: number;
    }
  | {
      type: 'hop';
      actorId: string;
      count?: 1 | 2;
      heightPx?: number;
      delayMs?: number;
    }
  | {
      type: 'shake';
      actorId: string;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'pose';
      actorId: string;
      action: PmdSpriteAction;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'emote';
      actorId: string;
      emote: CutsceneEmoteKind;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'visibility';
      actorId: string;
      visible: boolean;
      delayMs?: number;
    }
  | {
      type: 'auraPulse';
      actorId: string;
      color?: string;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'camera';
      x: number;
      y: number;
      durationMs?: number;
      delayMs?: number;
    }
  | {
      type: 'screenShake';
      durationMs?: number;
      intensityPx?: number;
      delayMs?: number;
    };

export interface StoryCutsceneDefinition {
  id: string;
  chapterOrder: number;
  title: string;
  locationLabel: string;
  lightingMood: CutsceneLightingMood;
  width: number;
  height: number;
  tiles: ReadonlyArray<ReadonlyArray<DungeonMapTileCell>>;
  props?: ReadonlyArray<CutscenePropDef>;
  initialCamera: { x: number; y: number };
  actors: ReadonlyArray<CutsceneActorSpawnDef>;
  /** Optional pre-dialogue stage choreography before line 0 opens */
  openingActions?: ReadonlyArray<CutsceneCueAction>;
  openingDurationMs?: number;
  /** Choreographed stage actions keyed by 0-based `DialogueScript.lines` index */
  lineCues?: Readonly<Record<number, ReadonlyArray<CutsceneCueAction>>>;
  buildScript: (save: SaveData | null) => DialogueScript;
}

interface ActiveWalkSegment {
  waypoints: Array<{ x: number; y: number }>;
  segmentIndex: number;
  speedTilesPerSec: number;
  endDirection?: PmdDirection;
}

interface ActiveHopState {
  elapsedMs: number;
  totalDurationMs: number;
  count: 1 | 2;
  heightPx: number;
}

interface ActiveEmoteState {
  kind: CutsceneEmoteKind;
  remainingMs: number;
  totalMs: number;
}

interface ActiveAuraPulse {
  actorId: string;
  color: string;
  elapsedMs: number;
  durationMs: number;
}

interface RuntimeCutsceneActor {
  actorId: string;
  roleKind: CutsceneActorRole['kind'];
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  available: boolean;
  visible: boolean;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  animElapsedMs: number;
  walk: ActiveWalkSegment | null;
  hop: ActiveHopState | null;
  shakeRemainingMs: number;
  poseRemainingMs: number;
  emote: ActiveEmoteState | null;
}

export interface CutsceneActorSnapshot {
  actorId: string;
  roleKind: CutsceneActorRole['kind'];
  nickname: string;
  speciesId?: string;
  pmdAssetId: string;
  visualAssetKey: string;
  visible: boolean;
  x: number;
  y: number;
  direction: PmdDirection;
  action: PmdSpriteAction;
  activeEmote: CutsceneEmoteKind | null;
}

export interface CutsceneSceneSnapshot {
  isOpen: boolean;
  cutsceneId: string | null;
  title: string | null;
  locationLabel: string | null;
  lightingMood: CutsceneLightingMood | null;
  currentLineIndex: number;
  cameraTile: { x: number; y: number };
  displayScale: number;
  actors: CutsceneActorSnapshot[];
  propCount: number;
}

export interface CutsceneSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  dialogueOverlay: DialogueOverlay;
  audioManager?: AudioManager;
  onStateChange?: () => void;
}

interface AmbientMote {
  seedX: number;
  seedY: number;
  speedX: number;
  speedY: number;
  phase: number;
  size: 1 | 2;
}

export class CutsceneScene {
  public readonly rootEl: HTMLElement;
  private readonly stageWrapEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly locationBannerEl: HTMLElement;
  private readonly introSkipBtn: HTMLButtonElement;

  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly dialogueOverlay: DialogueOverlay;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;

  private readonly tilesetSheets = new Map<string, LoadedTilesetSheet>();
  private readonly spriteBundles = new Map<string, LoadedSpriteBundle>();
  private readonly ambientMotes: AmbientMote[] = [];

  private openState = false;
  private fastMode = false;
  private activeDef: StoryCutsceneDefinition | null = null;
  private actors: RuntimeCutsceneActor[] = [];
  private auraPulses: ActiveAuraPulse[] = [];
  private pendingTimers = new Set<number>();

  private cameraTileX = 8;
  private cameraTileY = 5.5;
  private cameraPan: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsedMs: number;
    durationMs: number;
  } | null = null;
  private screenShakeRemainingMs = 0;
  private screenShakeIntensityPx = 2;

  private viewWidthCss = 960;
  private viewHeightCss = 540;
  private displayScale = 2;
  private animClockMs = 0;
  private lastRafMs = 0;
  private rafId: number | null = null;
  private currentLineIndex = -1;
  private skippedEarly = false;
  private introResolve: (() => void) | null = null;
  private runToken = 0;

  private resizeObserver: ResizeObserver | null = null;
  private readonly abortController = new AbortController();

  constructor(options: CutsceneSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.dialogueOverlay = options.dialogueOverlay;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onStateChange = options.onStateChange;

    for (let i = 0; i < 22; i++) {
      this.ambientMotes.push({
        seedX: ((i * 73 + 19) % 100) / 100,
        seedY: ((i * 41 + 11) % 100) / 100,
        speedX: ((i % 5) - 2) * 0.008,
        speedY: -0.012 - (i % 4) * 0.006,
        phase: i * 0.85,
        size: i % 3 === 0 ? 2 : 1,
      });
    }

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-cutscene-scene';
    this.rootEl.className = 'pmd-cutscene-scene';
    this.rootEl.dataset.testid = 'cutscene-scene';
    this.rootEl.dataset.noLongpress = 'true';
    this.rootEl.hidden = true;

    this.stageWrapEl = document.createElement('div');
    this.stageWrapEl.className = 'pmd-cutscene-canvas-wrap';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pmd-cutscene-canvas pmd-pixelated';
    this.canvas.dataset.testid = 'cutscene-canvas';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for CutsceneScene.');
    }
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.stageWrapEl.appendChild(this.canvas);

    this.locationBannerEl = document.createElement('div');
    this.locationBannerEl.className =
      'pmd-window pmd-window--compact pmd-window--translucent pmd-cutscene-location-pill';
    this.locationBannerEl.dataset.testid = 'cutscene-location-banner';

    this.introSkipBtn = createPmdButton({
      label: 'Skip',
      className: 'pmd-cutscene-intro-skip-btn',
      testId: 'cutscene-intro-skip-btn',
      ariaLabel: 'Skip cutscene',
      onTap: () => {
        this.audioManager.playSfx('cancel');
        this.skipActiveCutscene();
      },
      tapOptions: { signal: this.abortController.signal, stopPropagation: true },
    });
    this.introSkipBtn.hidden = true;

    this.rootEl.append(this.stageWrapEl, this.locationBannerEl, this.introSkipBtn);
    this.viewportEl.appendChild(this.rootEl);

    // Tapping stage during opening walk hastens into line 0 immediately (Rule 2: Unified Pointer Events ONLY)
    this.stageWrapEl.addEventListener(
      'pointerup',
      (ev: PointerEvent) => {
        if (!this.openState) return;
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        if (this.introResolve) {
          this.snapAllInFlightChoreography();
          const done = this.introResolve;
          this.introResolve = null;
          done();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public skipActiveCutscene(): void {
    if (!this.openState) return;
    this.skippedEarly = true;
    this.clearPendingTimers();
    this.snapAllInFlightChoreography();
    if (this.introResolve) {
      const done = this.introResolve;
      this.introResolve = null;
      done();
    }
    if (this.dialogueOverlay.isOpen()) {
      this.dialogueOverlay.close('skipped');
    }
  }

  public handleBack(): void {
    this.skipActiveCutscene();
  }

  public async play(def: StoryCutsceneDefinition): Promise<DialogueFinishReason> {
    const token = ++this.runToken;
    this.clearPendingTimers();
    if (this.dialogueOverlay.isOpen()) {
      this.dialogueOverlay.close('cancelled');
    }

    this.activeDef = def;
    this.openState = true;
    this.skippedEarly = false;
    this.currentLineIndex = -1;
    this.animClockMs = 0;
    this.auraPulses = [];
    this.cameraPan = null;
    this.screenShakeRemainingMs = 0;
    this.cameraTileX = def.initialCamera.x;
    this.cameraTileY = def.initialCamera.y;

    const save = this.saveManager.getSave();
    this.actors = def.actors.map((spawn) => this.instantiateActor(spawn, save));

    this.locationBannerEl.textContent = def.locationLabel;
    this.rootEl.dataset.cutsceneId = def.id;
    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');
    this.onStateChange?.();

    await Promise.all([this.preloadStageTilesets(def), this.preloadActorSprites()]);
    if (!this.openState || token !== this.runToken) {
      return 'cancelled';
    }

    this.syncViewportSize();
    this.startLoop();
    this.renderFrame();

    const script = def.buildScript(this.saveManager.getSave());
    if (script.bgm) {
      this.audioManager.playBgm(script.bgm, { fadeMs: 320 });
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Optional opening walk/camera choreography before DialogueOverlay opens
    if (def.openingActions && def.openingActions.length > 0 && !this.skippedEarly) {
      this.applyCueActions(def.openingActions);
      const waitMs =
        this.fastMode || prefersReducedMotion
          ? 0
          : Math.max(0, def.openingDurationMs ?? 650);
      if (waitMs > 0) {
        this.introSkipBtn.hidden = false;
        await new Promise<void>((resolve) => {
          this.introResolve = resolve;
          const timer = window.setTimeout(() => {
            this.pendingTimers.delete(timer);
            if (this.introResolve === resolve) {
              this.introResolve = null;
              resolve();
            }
          }, waitMs);
          this.pendingTimers.add(timer);
        });
        this.introSkipBtn.hidden = true;
      } else {
        this.snapAllInFlightChoreography();
      }
    }

    if (!this.openState || token !== this.runToken) {
      return 'cancelled';
    }
    if (this.skippedEarly) {
      this.closeInternal();
      return 'skipped';
    }

    const scriptWithRestoredFlag: DialogueScript = {
      ...script,
      restorePreviousBgmOnClose: false,
    };

    const reason = await this.dialogueOverlay.playScript(scriptWithRestoredFlag, {
      inCutsceneStage: true,
      typewriterMsPerChar: this.fastMode || prefersReducedMotion ? 0 : 10,
      onLineStart: (lineIdx) => {
        if (!this.openState || token !== this.runToken) return;
        this.currentLineIndex = lineIdx;
        const cues = def.lineCues?.[lineIdx];
        if (cues && cues.length > 0) {
          this.applyCueActions(cues);
          if (this.fastMode) {
            this.snapAllInFlightChoreography();
          }
        }
        this.renderFrame();
      },
      onAdvanceInterrupt: () => {
        if (!this.openState || token !== this.runToken) return;
        this.snapAllInFlightChoreography();
        this.renderFrame();
      },
    });

    if (token === this.runToken) {
      this.closeInternal();
    }
    return this.skippedEarly ? 'skipped' : reason;
  }

  public close(): void {
    this.runToken++;
    if (this.dialogueOverlay.isOpen()) {
      this.dialogueOverlay.close('cancelled');
    }
    this.closeInternal();
  }

  private closeInternal(): void {
    if (!this.openState) return;
    this.openState = false;
    this.introSkipBtn.hidden = true;
    this.introResolve = null;
    this.clearPendingTimers();
    this.stopLoop();
    this.rootEl.hidden = true;
    delete this.rootEl.dataset.cutsceneId;
    this.viewportEl.classList.remove('is-battle-active');
    this.onStateChange?.();
  }

  public destroy(): void {
    this.close();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController.abort();
    this.rootEl.remove();
  }

  public advanceClockForTest(ms: number): void {
    const step = 16;
    let rem = Math.max(0, ms);
    while (rem > 0) {
      const dt = Math.min(step, rem);
      this.stepSimulation(dt);
      rem -= dt;
    }
    this.renderFrame();
  }

  public getSnapshot(): CutsceneSceneSnapshot {
    return {
      isOpen: this.openState,
      cutsceneId: this.activeDef?.id ?? null,
      title: this.activeDef?.title ?? null,
      locationLabel: this.activeDef?.locationLabel ?? null,
      lightingMood: this.activeDef?.lightingMood ?? null,
      currentLineIndex: this.currentLineIndex,
      cameraTile: {
        x: Math.round(this.cameraTileX * 100) / 100,
        y: Math.round(this.cameraTileY * 100) / 100,
      },
      displayScale: this.displayScale,
      actors: this.actors
        .filter((a) => a.available)
        .map((a) => ({
          actorId: a.actorId,
          roleKind: a.roleKind,
          nickname: a.nickname,
          speciesId: a.speciesId,
          pmdAssetId: a.pmdAssetId,
          visualAssetKey: a.visualAssetKey,
          visible: a.visible,
          x: Math.round(a.x * 100) / 100,
          y: Math.round(a.y * 100) / 100,
          direction: a.direction,
          action: a.action,
          activeEmote: a.emote?.kind ?? null,
        })),
      propCount: this.activeDef?.props?.length ?? 0,
    };
  }

  // ==========================================================================
  // Actor & Asset Resolution
  // ==========================================================================

  private resolveRecruitCameoUnits(save: SaveData | null): OwnedPokemonInstance[] {
    if (!save) return [];
    const coreIds = new Set<string>();
    const lord =
      save.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
      save.roster.find((u) => u.isLord) ??
      save.roster[0];
    const partner =
      save.roster.find((u) => u.instanceId === save.campaign.partnerInstanceId) ??
      save.roster[1];
    const healer = save.roster[2];
    if (lord) coreIds.add(lord.instanceId);
    if (partner) coreIds.add(partner.instanceId);
    if (healer) coreIds.add(healer.instanceId);
    return save.roster.filter((u) => !coreIds.has(u.instanceId));
  }

  private instantiateActor(
    spawn: CutsceneActorSpawnDef,
    save: SaveData | null
  ): RuntimeCutsceneActor {
    const makeFromUnit = (
      unit: OwnedPokemonInstance | undefined,
      fallbackSpeciesId: string
    ): {
      nickname: string;
      speciesId: string;
      pmdAssetId: string;
      visualAssetKey: string;
      available: boolean;
    } => {
      if (unit) {
        const sp = getSpeciesById(unit.speciesId);
        const visKey = resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);
        return {
          nickname: unit.nickname,
          speciesId: unit.speciesId,
          pmdAssetId: sp?.pmdAssetId ?? visKey,
          visualAssetKey: visKey,
          available: true,
        };
      }
      const fallbackSp = getSpeciesById(fallbackSpeciesId);
      return {
        nickname: fallbackSp?.name ?? fallbackSpeciesId,
        speciesId: fallbackSpeciesId,
        pmdAssetId: fallbackSp?.pmdAssetId ?? '0610',
        visualAssetKey: fallbackSpeciesId,
        available: true,
      };
    };

    let resolved: {
      nickname: string;
      speciesId?: string;
      pmdAssetId: string;
      visualAssetKey: string;
      available: boolean;
    };

    switch (spawn.role.kind) {
      case 'lord': {
        const u =
          save?.roster.find((r) => r.instanceId === save.campaign.lordInstanceId) ??
          save?.roster.find((r) => r.isLord) ??
          save?.roster[0];
        resolved = makeFromUnit(u, 'axew');
        break;
      }
      case 'partner': {
        const u =
          save?.roster.find((r) => r.instanceId === save.campaign.partnerInstanceId) ??
          save?.roster[1];
        resolved = makeFromUnit(u, 'piplup');
        break;
      }
      case 'healer': {
        const u = save?.roster[2];
        resolved = makeFromUnit(u, 'flabebe');
        break;
      }
      case 'advisor': {
        resolved = {
          nickname: 'Wimpod',
          pmdAssetId: WIMPOD_PMD_ASSET_ID,
          visualAssetKey: WIMPOD_PMD_ASSET_ID,
          available: true,
        };
        break;
      }
      case 'npc': {
        resolved = {
          nickname: spawn.role.name,
          pmdAssetId: spawn.role.pmdAssetId,
          visualAssetKey: spawn.role.pmdAssetId,
          available: true,
        };
        break;
      }
      case 'cameo_recruit': {
        const cameos = this.resolveRecruitCameoUnits(save);
        const picked = cameos[spawn.role.slotIndex];
        if (!picked) {
          resolved = {
            nickname: 'Ally',
            pmdAssetId: '0016',
            visualAssetKey: 'pidgey',
            available: false,
          };
        } else {
          resolved = makeFromUnit(picked, picked.speciesId);
        }
        break;
      }
    }

    return {
      actorId: spawn.actorId,
      roleKind: spawn.role.kind,
      nickname: resolved.nickname,
      speciesId: resolved.speciesId,
      pmdAssetId: resolved.pmdAssetId,
      visualAssetKey: resolved.visualAssetKey,
      available: resolved.available,
      visible: resolved.available && spawn.visible !== false,
      x: spawn.x,
      y: spawn.y,
      direction: normalizePmdDirection(spawn.direction, 0),
      action: 'Idle',
      animElapsedMs: (spawn.actorId.length * 97) % 400,
      walk: null,
      hop: null,
      shakeRemainingMs: 0,
      poseRemainingMs: 0,
      emote: null,
    };
  }

  private async preloadStageTilesets(def: StoryCutsceneDefinition): Promise<void> {
    const ids = new Set<string>();
    for (const row of def.tiles) {
      for (const cell of row) {
        ids.add(normalizeTilesetId(cell.tilesetId));
      }
    }
    await Promise.all(
      [...ids].map(async (id) => {
        if (!this.tilesetSheets.has(id)) {
          const sheet = await loadTilesetSheet(id);
          this.tilesetSheets.set(id, sheet);
        }
      })
    );
  }

  private async preloadActorSprites(): Promise<void> {
    const keys = new Set<string>(
      this.actors.filter((a) => a.available).map((a) => a.visualAssetKey)
    );
    await Promise.all(
      [...keys].map(async (visKey) => {
        if (!this.spriteBundles.has(visKey)) {
          const bundle = await loadSpeciesSpriteBundle(visKey);
          this.spriteBundles.set(visKey, bundle);
        }
      })
    );
  }

  // ==========================================================================
  // Choreography Execution & Simulation
  // ==========================================================================

  private clearPendingTimers(): void {
    for (const id of this.pendingTimers) {
      window.clearTimeout(id);
    }
    this.pendingTimers.clear();
  }

  private applyCueActions(actions: ReadonlyArray<CutsceneCueAction>): void {
    for (const cue of actions) {
      const delay = this.fastMode ? 0 : Math.max(0, cue.delayMs ?? 0);
      if (delay > 0) {
        const timer = window.setTimeout(() => {
          this.pendingTimers.delete(timer);
          if (!this.openState) return;
          this.executeImmediateCue(cue);
        }, delay);
        this.pendingTimers.add(timer);
      } else {
        this.executeImmediateCue(cue);
      }
    }
  }

  private executeImmediateCue(cue: CutsceneCueAction): void {
    if (cue.type === 'camera') {
      const dur = this.fastMode ? 0 : Math.max(0, cue.durationMs ?? 520);
      if (dur <= 0) {
        this.cameraPan = null;
        this.cameraTileX = cue.x;
        this.cameraTileY = cue.y;
      } else {
        this.cameraPan = {
          startX: this.cameraTileX,
          startY: this.cameraTileY,
          targetX: cue.x,
          targetY: cue.y,
          elapsedMs: 0,
          durationMs: dur,
        };
      }
      return;
    }

    if (cue.type === 'screenShake') {
      this.screenShakeRemainingMs = this.fastMode ? 0 : Math.max(80, cue.durationMs ?? 380);
      this.screenShakeIntensityPx = cue.intensityPx ?? 2;
      return;
    }

    const actor = this.actors.find((a) => a.actorId === cue.actorId && a.available);
    if (!actor) return;

    switch (cue.type) {
      case 'visibility': {
        actor.visible = cue.visible;
        break;
      }
      case 'walk': {
        if (cue.path.length === 0) break;
        actor.visible = true;
        if (this.fastMode) {
          const last = cue.path[cue.path.length - 1]!;
          const prev = cue.path.length >= 2 ? cue.path[cue.path.length - 2]! : { x: actor.x, y: actor.y };
          actor.direction =
            cue.endDirection !== undefined
              ? normalizePmdDirection(cue.endDirection, actor.direction)
              : directionFromDelta(last.x - prev.x, last.y - prev.y);
          actor.x = last.x;
          actor.y = last.y;
          actor.walk = null;
          actor.action = 'Idle';
        } else {
          actor.walk = {
            waypoints: cue.path.map((p) => ({ x: p.x, y: p.y })),
            segmentIndex: 0,
            speedTilesPerSec: Math.max(0.8, cue.speedTilesPerSec ?? 3.4),
            endDirection:
              cue.endDirection !== undefined
                ? normalizePmdDirection(cue.endDirection, actor.direction)
                : undefined,
          };
          actor.action = 'Walk';
        }
        break;
      }
      case 'face': {
        if (cue.targetActorId) {
          const target = this.actors.find((a) => a.actorId === cue.targetActorId && a.available);
          if (target) {
            actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
          }
        } else if (cue.direction !== undefined) {
          actor.direction = normalizePmdDirection(cue.direction, actor.direction);
        }
        break;
      }
      case 'hop': {
        const count = cue.count ?? 1;
        actor.hop = {
          elapsedMs: 0,
          totalDurationMs: count === 2 ? 380 : 210,
          count,
          heightPx: cue.heightPx ?? 6,
        };
        break;
      }
      case 'shake': {
        actor.shakeRemainingMs = Math.max(120, cue.durationMs ?? 420);
        break;
      }
      case 'pose': {
        actor.action = cue.action;
        actor.animElapsedMs = 0;
        actor.poseRemainingMs = Math.max(200, cue.durationMs ?? 520);
        break;
      }
      case 'emote': {
        const totalMs = Math.max(400, cue.durationMs ?? 1350);
        actor.emote = {
          kind: cue.emote,
          remainingMs: totalMs,
          totalMs,
        };
        break;
      }
      case 'auraPulse': {
        this.auraPulses.push({
          actorId: actor.actorId,
          color: cue.color ?? '#ffe066',
          elapsedMs: 0,
          durationMs: Math.max(300, cue.durationMs ?? 950),
        });
        break;
      }
    }
  }

  private snapAllInFlightChoreography(): void {
    this.clearPendingTimers();
    if (this.cameraPan) {
      this.cameraTileX = this.cameraPan.targetX;
      this.cameraTileY = this.cameraPan.targetY;
      this.cameraPan = null;
    }
    this.screenShakeRemainingMs = 0;
    for (const actor of this.actors) {
      if (actor.walk && actor.walk.waypoints.length > 0) {
        const last = actor.walk.waypoints[actor.walk.waypoints.length - 1]!;
        const prev =
          actor.walk.waypoints.length >= 2
            ? actor.walk.waypoints[actor.walk.waypoints.length - 2]!
            : { x: actor.x, y: actor.y };
        actor.direction =
          actor.walk.endDirection !== undefined
            ? normalizePmdDirection(actor.walk.endDirection, actor.direction)
            : directionFromDelta(last.x - prev.x, last.y - prev.y);
        actor.x = last.x;
        actor.y = last.y;
        actor.walk = null;
      }
      actor.hop = null;
      actor.shakeRemainingMs = 0;
      actor.poseRemainingMs = 0;
      if (actor.action !== 'Idle') {
        actor.action = 'Idle';
      }
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastRafMs = performance.now();
    const tick = (now: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(64, Math.max(0, now - this.lastRafMs));
      this.lastRafMs = now;
      this.stepSimulation(dt);
      this.renderFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private stepSimulation(dtMs: number): void {
    this.animClockMs += dtMs;

    if (this.cameraPan) {
      this.cameraPan.elapsedMs += dtMs;
      const t = Math.min(1, this.cameraPan.elapsedMs / Math.max(1, this.cameraPan.durationMs));
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.cameraTileX =
        this.cameraPan.startX + (this.cameraPan.targetX - this.cameraPan.startX) * eased;
      this.cameraTileY =
        this.cameraPan.startY + (this.cameraPan.targetY - this.cameraPan.startY) * eased;
      if (t >= 1) {
        this.cameraPan = null;
      }
    }

    if (this.screenShakeRemainingMs > 0) {
      this.screenShakeRemainingMs = Math.max(0, this.screenShakeRemainingMs - dtMs);
    }

    for (let i = this.auraPulses.length - 1; i >= 0; i--) {
      const p = this.auraPulses[i]!;
      p.elapsedMs += dtMs;
      if (p.elapsedMs >= p.durationMs) {
        this.auraPulses.splice(i, 1);
      }
    }

    for (const actor of this.actors) {
      if (!actor.available || !actor.visible) continue;
      actor.animElapsedMs += dtMs;

      if (actor.walk) {
        let remDist = (actor.walk.speedTilesPerSec * dtMs) / 1000;
        while (remDist > 0 && actor.walk) {
          const target = actor.walk.waypoints[actor.walk.segmentIndex];
          if (!target) {
            actor.walk = null;
            actor.action = 'Idle';
            break;
          }
          const dx = target.x - actor.x;
          const dy = target.y - actor.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.001) {
            actor.direction = directionFromDelta(dx, dy);
          }
          if (dist <= remDist) {
            actor.x = target.x;
            actor.y = target.y;
            remDist -= dist;
            actor.walk.segmentIndex += 1;
            if (actor.walk.segmentIndex >= actor.walk.waypoints.length) {
              if (actor.walk.endDirection !== undefined) {
                actor.direction = normalizePmdDirection(actor.walk.endDirection, actor.direction);
              }
              actor.walk = null;
              actor.action = 'Idle';
              break;
            }
          } else {
            actor.x += (dx / dist) * remDist;
            actor.y += (dy / dist) * remDist;
            remDist = 0;
          }
        }
      } else if (actor.poseRemainingMs > 0) {
        actor.poseRemainingMs = Math.max(0, actor.poseRemainingMs - dtMs);
        if (actor.poseRemainingMs === 0) {
          actor.action = 'Idle';
        }
      }

      if (actor.hop) {
        actor.hop.elapsedMs += dtMs;
        if (actor.hop.elapsedMs >= actor.hop.totalDurationMs) {
          actor.hop = null;
        }
      }

      if (actor.shakeRemainingMs > 0) {
        actor.shakeRemainingMs = Math.max(0, actor.shakeRemainingMs - dtMs);
      }

      if (actor.emote) {
        actor.emote.remainingMs = Math.max(0, actor.emote.remainingMs - dtMs);
        if (actor.emote.remainingMs === 0) {
          actor.emote = null;
        }
      }
    }
  }

  // ==========================================================================
  // Crisp 1x Native Pixel Buffer + Integer Scale Canvas Renderer
  // ==========================================================================

  private syncViewportSize(): void {
    const rect = this.stageWrapEl.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth || 960));
    const h = Math.max(240, Math.round(rect.height || window.innerHeight || 540));
    this.viewWidthCss = w;
    this.viewHeightCss = h;

    // Integer pixel scale (`3x` on large desktop viewports, `2x` on compact/mobile viewports)
    this.displayScale = w >= 1280 && h >= 720 ? 3 : 2;

    const nativeW = Math.max(160, Math.ceil(w / this.displayScale));
    const nativeH = Math.max(120, Math.ceil(h / this.displayScale));
    if (this.canvas.width !== nativeW || this.canvas.height !== nativeH) {
      this.canvas.width = nativeW;
      this.canvas.height = nativeH;
    }
    this.canvas.style.width = `${nativeW * this.displayScale}px`;
    this.canvas.style.height = `${nativeH * this.displayScale}px`;
    this.ctx.imageSmoothingEnabled = false;

    if (!this.resizeObserver && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.openState) return;
        this.syncViewportSize();
        this.renderFrame();
      });
      this.resizeObserver.observe(this.stageWrapEl);
    }
  }

  private renderFrame(): void {
    if (!this.openState || !this.activeDef) return;
    const def = this.activeDef;
    const ctx = this.ctx;
    const nativeW = this.canvas.width;
    const nativeH = this.canvas.height;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#080e1c';
    ctx.fillRect(0, 0, nativeW, nativeH);

    const mapPixelW = def.width * PMD_TILE_NATIVE_PX;
    const mapPixelH = def.height * PMD_TILE_NATIVE_PX;

    // Bias vertical focal point slightly upward (`0.38` instead of `0.50`) so actors stand cleanly
    // in the open stage above the bottom `DialogueOverlay` box on both desktop & mobile landscape!
    const focalScreenX = Math.round(nativeW * 0.5);
    const focalScreenY = Math.round(nativeH * (this.viewHeightCss <= 460 ? 0.34 : 0.4));

    const targetWorldX = (this.cameraTileX + 0.5) * PMD_TILE_NATIVE_PX;
    const targetWorldY = (this.cameraTileY + 0.5) * PMD_TILE_NATIVE_PX;

    let camX = Math.round(targetWorldX - focalScreenX);
    let camY = Math.round(targetWorldY - focalScreenY);

    if (mapPixelW <= nativeW) {
      camX = Math.round((mapPixelW - nativeW) / 2);
    } else {
      camX = Math.max(0, Math.min(mapPixelW - nativeW, camX));
    }
    if (mapPixelH <= nativeH) {
      camY = Math.round((mapPixelH - nativeH) / 2);
    } else {
      const maxCamY = Math.max(0, mapPixelH - Math.round(nativeH * 0.68));
      camY = Math.max(0, Math.min(maxCamY, camY));
    }

    if (this.screenShakeRemainingMs > 0) {
      const phase = Math.floor(this.animClockMs / 40);
      camX += (phase % 2 === 0 ? 1 : -1) * this.screenShakeIntensityPx;
      camY += ((phase + 1) % 3 === 0 ? 1 : -1) * Math.max(1, this.screenShakeIntensityPx - 1);
    }

    // 1. Tile Grid Layer (`1x` native 24x24 PMD chunks)
    for (let ty = 0; ty < def.height; ty++) {
      const row = def.tiles[ty];
      if (!row) continue;
      const drawY = ty * PMD_TILE_NATIVE_PX - camY;
      if (drawY + PMD_TILE_NATIVE_PX < 0 || drawY > nativeH) continue;

      for (let tx = 0; tx < def.width; tx++) {
        const cell = row[tx];
        if (!cell) continue;
        const drawX = tx * PMD_TILE_NATIVE_PX - camX;
        if (drawX + PMD_TILE_NATIVE_PX < 0 || drawX > nativeW) continue;

        const sheet = this.tilesetSheets.get(normalizeTilesetId(cell.tilesetId));
        if (sheet) {
          drawTilesetChunk(ctx, sheet, cell.chunkIndex, drawX, drawY, PMD_TILE_NATIVE_PX);
        }
        drawSpecialTerrainOverlay(
          ctx,
          cell.terrainType,
          cell.tilesetId,
          drawX,
          drawY,
          PMD_TILE_NATIVE_PX
        );
      }
    }

    // 2. Ground-Level Scenic Props & Aura Pulses
    if (def.props) {
      for (const prop of def.props) {
        this.drawStageProp(ctx, prop, camX, camY);
      }
    }
    for (const pulse of this.auraPulses) {
      const actor = this.actors.find((a) => a.actorId === pulse.actorId && a.visible);
      if (!actor) continue;
      const t = pulse.elapsedMs / pulse.durationMs;
      const cx = Math.round((actor.x + 0.5) * PMD_TILE_NATIVE_PX - camX);
      const cy = Math.round((actor.y + 0.72) * PMD_TILE_NATIVE_PX - camY);
      const radius = 6 + t * 22;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - t) * 0.85);
      ctx.strokeStyle = pulse.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Y-Sorted Animated 8-Directional PMD Sprites + Overhead Emotes
    const visibleActors = this.actors
      .filter((a) => a.available && a.visible)
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x);

    for (const actor of visibleActors) {
      this.drawCutsceneActor(ctx, actor, camX, camY);
    }

    // 4. Atmospheric Lighting Tint & Drifting Pixel Motes
    this.drawAtmosphericMood(ctx, def, camX, camY, nativeW, nativeH);
  }

  private drawStageProp(
    ctx: CanvasRenderingContext2D,
    prop: CutscenePropDef,
    camX: number,
    camY: number
  ): void {
    const px = Math.round(prop.x * PMD_TILE_NATIVE_PX - camX);
    const py = Math.round(prop.y * PMD_TILE_NATIVE_PX - camY);
    const frame = Math.floor(this.animClockMs / 150) % 3;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    switch (prop.kind) {
      case 'campfire': {
        // Warm flickering hearth glow on ground
        const glowRadius = 26 + (frame === 1 ? 3 : frame === 2 ? -1 : 1);
        const grad = ctx.createRadialGradient(px + 12, py + 14, 3, px + 12, py + 14, glowRadius);
        grad.addColorStop(0, 'rgba(255, 200, 88, 0.42)');
        grad.addColorStop(0.55, 'rgba(255, 128, 40, 0.18)');
        grad.addColorStop(1, 'rgba(255, 96, 24, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 12 - glowRadius, py + 14 - glowRadius, glowRadius * 2, glowRadius * 2);

        // Stone ring & crossed pixel logs
        ctx.fillStyle = '#3b2416';
        ctx.fillRect(px + 6, py + 15, 12, 3);
        ctx.fillRect(px + 8, py + 13, 8, 5);
        ctx.fillStyle = '#684228';
        ctx.fillRect(px + 7, py + 15, 10, 2);
        ctx.fillStyle = '#5a6678';
        ctx.fillRect(px + 5, py + 16, 2, 2);
        ctx.fillRect(px + 17, py + 16, 2, 2);
        ctx.fillRect(px + 10, py + 18, 4, 2);

        // Animated 3-frame pixel flame
        ctx.fillStyle = '#ff5828';
        ctx.fillRect(px + 8, py + 9 + (frame === 2 ? 1 : 0), 8, 7);
        ctx.fillRect(px + 10, py + 6 + (frame === 0 ? 1 : 0), 4, 4);
        ctx.fillStyle = '#ffb838';
        ctx.fillRect(px + 9, py + 10, 6, 5);
        ctx.fillRect(px + 10 + (frame === 1 ? 1 : 0), py + 8, 3, 3);
        ctx.fillStyle = '#fff8a8';
        ctx.fillRect(px + 10, py + 12, 4, 3);
        // Rising pixel spark
        const sparkOffset = Math.floor(this.animClockMs / 90) % 7;
        ctx.fillStyle = '#ffe078';
        ctx.fillRect(px + 11 + (sparkOffset % 2), py + 6 - sparkOffset, 1, 1);
        break;
      }
      case 'sanctuary_crystal': {
        const pulse = 0.5 + 0.5 * Math.sin(this.animClockMs / 360);
        const grad = ctx.createRadialGradient(px + 12, py + 12, 2, px + 12, py + 12, 24);
        grad.addColorStop(0, `rgba(120, 248, 255, ${(0.32 + pulse * 0.16).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(64, 184, 248, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - 12, py - 12, 48, 48);

        // Pedestal & floating Dragon Sanctuary prism
        ctx.fillStyle = '#324a68';
        ctx.fillRect(px + 7, py + 16, 10, 4);
        ctx.fillStyle = '#88b8d8';
        ctx.fillRect(px + 8, py + 15, 8, 2);
        const bob = frame === 1 ? -1 : 0;
        ctx.fillStyle = '#28a8e8';
        ctx.fillRect(px + 9, py + 6 + bob, 6, 8);
        ctx.fillStyle = '#98f8ff';
        ctx.fillRect(px + 10, py + 5 + bob, 4, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + 11, py + 7 + bob, 2, 4);
        break;
      }
      case 'lantern': {
        const grad = ctx.createRadialGradient(px + 12, py + 8, 2, px + 12, py + 8, 18);
        grad.addColorStop(0, 'rgba(255, 216, 112, 0.34)');
        grad.addColorStop(1, 'rgba(255, 160, 48, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - 6, py - 10, 36, 36);

        ctx.fillStyle = '#4a3020';
        ctx.fillRect(px + 11, py + 10, 2, 10);
        ctx.fillRect(px + 9, py + 19, 6, 2);
        ctx.fillStyle = '#d84838';
        ctx.fillRect(px + 8, py + 4, 8, 7);
        ctx.fillStyle = '#ffe888';
        ctx.fillRect(px + 9, py + 5, 6, 5);
        break;
      }
      case 'ancient_rune': {
        const alpha = 0.35 + 0.25 * Math.sin(this.animClockMs / 320);
        ctx.strokeStyle = `rgba(184, 144, 255, ${alpha.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 4.5, py + 4.5, 15, 15);
        ctx.fillStyle = `rgba(224, 192, 255, ${alpha.toFixed(2)})`;
        ctx.fillRect(px + 10, py + 10, 4, 4);
        break;
      }
      case 'berry_basket': {
        ctx.fillStyle = '#784c28';
        ctx.fillRect(px + 6, py + 12, 12, 7);
        ctx.fillStyle = '#a8703c';
        ctx.fillRect(px + 7, py + 13, 10, 5);
        // Oran & Sitrus berries peeking out
        ctx.fillStyle = '#3898ff';
        ctx.fillRect(px + 8, py + 10, 3, 3);
        ctx.fillRect(px + 13, py + 11, 3, 3);
        ctx.fillStyle = '#f8d038';
        ctx.fillRect(px + 10, py + 9, 4, 3);
        break;
      }
    }

    ctx.restore();
  }

  private drawCutsceneActor(
    ctx: CanvasRenderingContext2D,
    actor: RuntimeCutsceneActor,
    camX: number,
    camY: number
  ): void {
    const bundle = this.spriteBundles.get(actor.visualAssetKey);
    const anim = bundle ? (bundle.actions[actor.action] ?? bundle.actions.Idle) : undefined;

    let hopOffsetY = 0;
    if (actor.hop) {
      const progress = Math.min(1, actor.hop.elapsedMs / actor.hop.totalDurationMs);
      const wave = Math.abs(Math.sin(progress * Math.PI * actor.hop.count));
      hopOffsetY = -Math.round(wave * actor.hop.heightPx);
    }

    let shakeOffsetX = 0;
    if (actor.shakeRemainingMs > 0) {
      shakeOffsetX = Math.floor(this.animClockMs / 38) % 2 === 0 ? -1 : 1;
    }

    const tileScreenX = Math.round(actor.x * PMD_TILE_NATIVE_PX - camX) + shakeOffsetX;
    const tileScreenY = Math.round(actor.y * PMD_TILE_NATIVE_PX - camY);

    const placement = computePmdTileSpritePlacement(
      tileScreenX,
      tileScreenY,
      anim?.frameWidth ?? PMD_TILE_NATIVE_PX,
      anim?.frameHeight ?? PMD_TILE_NATIVE_PX,
      PMD_TILE_NATIVE_PX
    );

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Ground shadow
    ctx.fillStyle = 'rgba(6, 10, 22, 0.48)';
    ctx.beginPath();
    ctx.ellipse(
      placement.shadowCenterX,
      placement.shadowCenterY,
      actor.pmdAssetId === '0497' || actor.pmdAssetId === '0350' ? 9 : 6,
      3,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (anim) {
      const safeFrameCount = Math.max(1, anim.frameCount);
      let totalMs = 0;
      for (let i = 0; i < safeFrameCount; i++) {
        totalMs += Math.max(16, anim.durationsMs[i] ?? 120);
      }
      totalMs = Math.max(80, totalMs);
      let rem = actor.animElapsedMs % totalMs;
      let frameIdx = 0;
      for (let i = 0; i < safeFrameCount; i++) {
        const dur = Math.max(16, anim.durationsMs[i] ?? 120);
        if (rem < dur) {
          frameIdx = i;
          break;
        }
        rem -= dur;
      }
      const safeDir = normalizePmdDirection(actor.direction, 0);
      const rowIdx = anim.rowCount > 1 ? safeDir % anim.rowCount : 0;
      const sx = frameIdx * anim.frameWidth;
      const sy = rowIdx * anim.frameHeight;

      ctx.drawImage(
        anim.source,
        sx,
        sy,
        anim.frameWidth,
        anim.frameHeight,
        placement.drawX,
        placement.drawY + hopOffsetY,
        anim.frameWidth,
        anim.frameHeight
      );
    } else {
      ctx.fillStyle = '#58c8f8';
      ctx.fillRect(tileScreenX + 6, tileScreenY + 6 + hopOffsetY, 12, 12);
    }

    // Classic PMD Overhead Pixel Emote Bubble
    if (actor.emote) {
      const headY = placement.drawY + hopOffsetY - 11;
      const headX = placement.shadowCenterX;
      this.drawPixelEmoteBubble(ctx, actor.emote.kind, headX, headY);
    }

    ctx.restore();
  }

  private drawPixelEmoteBubble(
    ctx: CanvasRenderingContext2D,
    kind: CutsceneEmoteKind,
    cx: number,
    cy: number
  ): void {
    const bob = Math.floor(this.animClockMs / 160) % 2 === 0 ? 0 : -1;
    const x = Math.round(cx - 6);
    const y = Math.round(cy - 6 + bob);

    // Speech-pill backing with crisp 1px dark pixel contour
    ctx.fillStyle = '#081020';
    ctx.fillRect(x - 1, y - 1, 13, 13);
    ctx.fillStyle = '#f8fcff';
    ctx.fillRect(x, y, 11, 11);
    ctx.fillRect(cx - 1, y + 11, 2, 2);

    switch (kind) {
      case 'exclamation': {
        ctx.fillStyle = '#e83038';
        ctx.fillRect(x + 4, y + 2, 3, 5);
        ctx.fillRect(x + 4, y + 8, 3, 2);
        break;
      }
      case 'question': {
        ctx.fillStyle = '#2878d8';
        ctx.fillRect(x + 3, y + 2, 5, 2);
        ctx.fillRect(x + 6, y + 4, 2, 2);
        ctx.fillRect(x + 4, y + 5, 3, 2);
        ctx.fillRect(x + 4, y + 8, 2, 2);
        break;
      }
      case 'sweat': {
        ctx.fillStyle = '#38a8ff';
        ctx.fillRect(x + 5, y + 2, 2, 2);
        ctx.fillRect(x + 4, y + 4, 4, 3);
        ctx.fillRect(x + 3, y + 6, 5, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, y + 6, 1, 2);
        break;
      }
      case 'joy': {
        ctx.fillStyle = '#f8a828';
        ctx.fillRect(x + 2, y + 3, 2, 2);
        ctx.fillRect(x + 7, y + 3, 2, 2);
        ctx.fillRect(x + 3, y + 7, 5, 2);
        break;
      }
      case 'music': {
        ctx.fillStyle = '#30b858';
        ctx.fillRect(x + 4, y + 2, 5, 2);
        ctx.fillRect(x + 4, y + 4, 2, 5);
        ctx.fillRect(x + 8, y + 4, 2, 4);
        ctx.fillRect(x + 2, y + 7, 3, 2);
        ctx.fillRect(x + 6, y + 6, 3, 2);
        break;
      }
      case 'angry': {
        ctx.fillStyle = '#d82838';
        ctx.fillRect(x + 2, y + 3, 3, 2);
        ctx.fillRect(x + 6, y + 3, 3, 2);
        ctx.fillRect(x + 3, y + 6, 5, 3);
        break;
      }
      case 'heart': {
        ctx.fillStyle = '#f04888';
        ctx.fillRect(x + 2, y + 3, 3, 3);
        ctx.fillRect(x + 6, y + 3, 3, 3);
        ctx.fillRect(x + 3, y + 5, 5, 3);
        ctx.fillRect(x + 4, y + 8, 3, 2);
        break;
      }
    }
  }

  private drawAtmosphericMood(
    ctx: CanvasRenderingContext2D,
    def: StoryCutsceneDefinition,
    camX: number,
    camY: number,
    nativeW: number,
    nativeH: number
  ): void {
    ctx.save();

    switch (def.lightingMood) {
      case 'morning_coast': {
        const grad = ctx.createLinearGradient(0, 0, nativeW * 0.7, nativeH);
        grad.addColorStop(0, 'rgba(255, 232, 164, 0.16)');
        grad.addColorStop(0.55, 'rgba(255, 210, 128, 0.04)');
        grad.addColorStop(1, 'rgba(24, 64, 112, 0.12)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
        break;
      }
      case 'sanctuary_glow': {
        const grad = ctx.createRadialGradient(
          nativeW * 0.5,
          nativeH * 0.25,
          12,
          nativeW * 0.5,
          nativeH * 0.45,
          nativeW * 0.7
        );
        grad.addColorStop(0, 'rgba(168, 255, 224, 0.16)');
        grad.addColorStop(0.6, 'rgba(56, 168, 144, 0.05)');
        grad.addColorStop(1, 'rgba(8, 24, 36, 0.22)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
        break;
      }
      case 'campfire_dusk': {
        // Evening indigo dusk tint punctured by the warm campfire center
        ctx.fillStyle = 'rgba(14, 20, 48, 0.34)';
        ctx.fillRect(0, 0, nativeW, nativeH);
        const fireProp = def.props?.find((p) => p.kind === 'campfire');
        if (fireProp) {
          const fx = (fireProp.x + 0.5) * PMD_TILE_NATIVE_PX - camX;
          const fy = (fireProp.y + 0.5) * PMD_TILE_NATIVE_PX - camY;
          const grad = ctx.createRadialGradient(fx, fy, 8, fx, fy, 92);
          grad.addColorStop(0, 'rgba(255, 196, 96, 0.24)');
          grad.addColorStop(0.55, 'rgba(255, 128, 48, 0.08)');
          grad.addColorStop(1, 'rgba(10, 14, 34, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, nativeW, nativeH);
        }
        break;
      }
      case 'mountain_mist': {
        const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
        grad.addColorStop(0, 'rgba(188, 208, 255, 0.16)');
        grad.addColorStop(0.6, 'rgba(96, 72, 152, 0.08)');
        grad.addColorStop(1, 'rgba(12, 16, 34, 0.24)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
        break;
      }
      case 'shrine_courtyard': {
        const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
        grad.addColorStop(0, 'rgba(144, 228, 255, 0.12)');
        grad.addColorStop(1, 'rgba(12, 32, 56, 0.16)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
        break;
      }
      case 'twilight_festival': {
        const grad = ctx.createLinearGradient(0, 0, 0, nativeH);
        grad.addColorStop(0, 'rgba(88, 64, 148, 0.22)');
        grad.addColorStop(0.5, 'rgba(224, 132, 76, 0.10)');
        grad.addColorStop(1, 'rgba(14, 22, 44, 0.24)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, nativeW, nativeH);
        break;
      }
    }

    // Subtle floating PMD pollen / firefly motes
    const moteColor =
      def.lightingMood === 'campfire_dusk' || def.lightingMood === 'twilight_festival'
        ? 'rgba(255, 224, 120, 0.65)'
        : def.lightingMood === 'mountain_mist'
          ? 'rgba(208, 192, 255, 0.50)'
          : 'rgba(232, 255, 224, 0.52)';
    ctx.fillStyle = moteColor;
    const sec = this.animClockMs / 1000;
    for (const m of this.ambientMotes) {
      const mx = Math.floor((((m.seedX + sec * m.speedX) % 1) + 1) % 1 * nativeW);
      const my = Math.floor((((m.seedY + sec * m.speedY) % 1) + 1) % 1 * nativeH);
      const twinkle = Math.sin(sec * 2.4 + m.phase);
      if (twinkle > -0.2) {
        ctx.fillRect(mx, my, m.size, m.size);
      }
    }

    ctx.restore();
  }
}
