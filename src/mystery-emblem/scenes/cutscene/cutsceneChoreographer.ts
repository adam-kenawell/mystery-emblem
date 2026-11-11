/**
 * Cutscene Stage Runtime: Action Scheduling, Simulation & State (`cutsceneChoreographer.ts`)
 *
 * Shared by the in-game `CutsceneScene` and the Dev Tools Cutscene Editor preview. Actions are
 * scheduled on the stage clock (not `setTimeout`), so `flush()` can fast-forward any pending
 * action deterministically.
 */

import {
  directionFromDelta,
  getAnimationTotalMs,
  normalizePmdDirection,
  type PmdDirection,
} from '../../assets/pmdAssetLoader';
import {
  WALK_SPEED_TILES_PER_SEC,
  type Beat,
  type CastPlacement,
  type CutsceneDoc,
  type LightingMood,
  type PropPlacement,
  type StageAction,
  type WalkSpeed,
  type WeatherKind,
} from '../../data/cutscenes/cutsceneDocTypes';
import { showIfPasses } from '../../data/cutscenes/dialogueCompiler';
import { resolveMediaUrl } from '../../data/cutscenes/mediaLibrary';
import type { SaveData } from '../../types/schemas';
import {
  instantiateCutsceneActor,
  instantiateCutsceneProp,
  isCanonicalPoseName,
  namedAnimKey,
  type CutsceneAssetCaches,
} from './cutsceneActorResolver';
import type {
  ActiveAuraPulse,
  ActiveWalkSegment,
  LightingState,
  ResolvedLocation,
  RuntimeCutsceneActor,
  RuntimeCutsceneProp,
  ScreenFadeState,
  ScreenFlashState,
} from './cutsceneTypes';

const DEFAULT_WALK_SPEED = 3.4;
const LOCATION_FADE_HALF_MS = 400;
const SHOW_FADE_MS = 300;

interface PendingTask {
  atMs: number;
  order: number;
  run: (fast: boolean) => void;
}

interface Mover {
  x: number;
  y: number;
  walk: ActiveWalkSegment | null;
}

export function walkSpeedTilesPerSec(speed: WalkSpeed | undefined): number {
  if (typeof speed === 'number') return Math.max(0.8, speed);
  if (speed) return WALK_SPEED_TILES_PER_SEC[speed];
  return DEFAULT_WALK_SPEED;
}

function pathLength(from: { x: number; y: number }, path: ReadonlyArray<[number, number]>): number {
  let total = 0;
  let px = from.x;
  let py = from.y;
  for (const [x, y] of path) {
    total += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return total;
}

export class CutsceneStageRuntime {
  public doc: CutsceneDoc;
  public save: SaveData | null;
  public readonly caches: CutsceneAssetCaches;
  public location!: ResolvedLocation;
  public banner = '';
  public actors: RuntimeCutsceneActor[] = [];
  public props: RuntimeCutsceneProp[] = [];

  public cameraTileX = 8;
  public cameraTileY = 5.5;
  public followActorId: string | null = null;
  public screenShakeRemainingMs = 0;
  public screenShakeIntensityPx = 2;
  public animClockMs = 0;
  public auraPulses: ActiveAuraPulse[] = [];
  public lighting: LightingState = { mood: 'clear', previous: null, elapsedMs: 0, durationMs: 0 };
  public weather: WeatherKind = 'none';
  public fade: ScreenFadeState | null = null;
  public flash: ScreenFlashState | null = null;
  /** Plays story sound effects (URL); skipped while fast-forwarding */
  public onSound: ((url: string) => void) | null = null;
  public onBannerChange: ((text: string) => void) | null = null;

  private cameraPan: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsedMs: number;
    durationMs: number;
  } | null = null;
  private pending: PendingTask[] = [];
  private taskOrder = 0;

  constructor(doc: CutsceneDoc, save: SaveData | null, caches: CutsceneAssetCaches) {
    this.doc = doc;
    this.save = save;
    this.caches = caches;
    this.actors = doc.cast.map((m) =>
      instantiateCutsceneActor(m, doc.placements.find((p) => p.id === m.id), save)
    );
  }

  /** Resets every actor, prop and effect to the cutscene's opening state. */
  public resetToStart(): void {
    const { doc } = this;
    this.pending = [];
    this.cameraPan = null;
    this.followActorId = null;
    this.animClockMs = 0;
    this.auraPulses = [];
    this.screenShakeRemainingMs = 0;
    this.fade = null;
    this.flash = null;
    this.weather = doc.weather ?? 'none';
    this.lighting = { mood: doc.lighting, previous: null, elapsedMs: 0, durationMs: 0 };
    this.actors = doc.cast.map((m) =>
      instantiateCutsceneActor(m, doc.placements.find((p) => p.id === m.id), this.save)
    );
    this.setLocation(doc.location, doc.banner);
    this.props = (doc.props ?? []).map((p) => instantiateCutsceneProp(p, this.caches));
    this.cameraTileX = doc.camera.x;
    this.cameraTileY = doc.camera.y;
  }

  private setLocation(locationId: string, banner: string | undefined): void {
    const loc = this.caches.locations.get(locationId);
    this.location = loc ?? {
      doc: { id: locationId, name: locationId, width: 16, height: 11, layers: [] },
      width: 16,
      height: 11,
      layers: [],
      fillsScreen: false,
    };
    this.banner = banner ?? this.location.doc.name;
    this.onBannerChange?.(this.banner);
  }

  public getActor(id: string): RuntimeCutsceneActor | undefined {
    return this.actors.find((a) => a.actorId === id && a.available);
  }

  public hasPendingWork(): boolean {
    return (
      this.pending.length > 0 ||
      this.cameraPan !== null ||
      this.actors.some((a) => a.walk || a.alphaFade) ||
      this.props.some((p) => p.walk) ||
      Boolean(this.fade && this.fade.elapsedMs < this.fade.durationMs)
    );
  }

  /**
   * Schedules a beat's actions on the stage clock and returns how long they take (ms).
   * In fast mode everything is applied instantly.
   */
  public runBeatActions(beat: Beat, fast: boolean): number {
    if (!showIfPasses(beat.showIf, this.doc.cast, this.save)) return 0;
    const actions = beat.actions ?? [];
    const projected = new Map<string, { x: number; y: number }>();
    for (const a of this.actors) projected.set(a.actorId, { x: a.x, y: a.y });
    for (const p of this.props) projected.set(`prop:${p.id}`, { x: p.x, y: p.y });

    let prevEnd = 0;
    let maxEnd = 0;
    for (const action of actions) {
      const base = action.start === 'after' ? prevEnd : 0;
      const startMs = fast ? 0 : base + Math.max(0, (action.delay ?? 0) * 1000);
      const durationMs = this.estimateDurationMs(action, projected);
      this.projectAction(action, projected);
      prevEnd = startMs + durationMs;
      maxEnd = Math.max(maxEnd, prevEnd);
      if (fast || startMs <= 0) this.executeAction(action, fast);
      else this.schedule(startMs, (f) => this.executeAction(action, f));
    }
    if (fast) this.flush();
    return fast ? 0 : maxEnd;
  }

  private schedule(delayMs: number, run: (fast: boolean) => void): void {
    this.pending.push({ atMs: this.animClockMs + delayMs, order: this.taskOrder++, run });
  }

  /** Runs every scheduled action immediately and snaps all motion to its end state. */
  public flush(): void {
    let guard = 0;
    while (this.pending.length > 0 && guard++ < 500) {
      this.pending.sort((a, b) => a.atMs - b.atMs || a.order - b.order);
      const task = this.pending.shift()!;
      task.run(true);
    }
    this.pending = [];
    this.snapAllInFlight();
  }

  public snapAllInFlight(): void {
    if (this.cameraPan) {
      this.cameraTileX = this.cameraPan.targetX;
      this.cameraTileY = this.cameraPan.targetY;
      this.cameraPan = null;
    }
    this.screenShakeRemainingMs = 0;
    for (const actor of this.actors) {
      if (actor.walk) this.snapMoverToWalkEnd(actor, true);
      actor.hop = null;
      actor.shakeRemainingMs = 0;
      if (actor.poseRemainingMs !== Infinity) {
        actor.poseRemainingMs = 0;
        actor.poseName = null;
        actor.poseAnim = null;
        if (actor.action !== 'Idle') actor.action = 'Idle';
      }
      if (actor.alphaFade) this.finishAlphaFade(actor);
    }
    for (const prop of this.props) if (prop.walk) this.snapMoverToWalkEnd(prop, false);
    if (this.fade) {
      this.fade.alpha = this.fade.to;
      this.fade.elapsedMs = this.fade.durationMs;
    }
    this.flash = null;
    if (this.lighting.previous) {
      this.lighting.elapsedMs = this.lighting.durationMs;
      this.lighting.previous = null;
    }
    this.followCamera();
  }

  private snapMoverToWalkEnd(mover: Mover & { direction?: PmdDirection }, isActor: boolean): void {
    const walk = mover.walk!;
    const last = walk.waypoints[walk.waypoints.length - 1]!;
    const prev = walk.waypoints.length >= 2 ? walk.waypoints[walk.waypoints.length - 2]! : { x: mover.x, y: mover.y };
    if (isActor) {
      const actor = mover as RuntimeCutsceneActor;
      actor.direction =
        walk.endDirection !== undefined
          ? normalizePmdDirection(walk.endDirection, actor.direction)
          : directionFromDelta(last.x - prev.x, last.y - prev.y);
    }
    mover.x = last.x;
    mover.y = last.y;
    mover.walk = null;
  }

  private finishAlphaFade(actor: RuntimeCutsceneActor): void {
    const f = actor.alphaFade!;
    actor.alpha = f.to;
    if (f.hideWhenDone) {
      actor.visible = false;
      actor.alpha = 1;
    }
    actor.alphaFade = null;
  }

  private estimateDurationMs(
    action: StageAction,
    projected: ReadonlyMap<string, { x: number; y: number }>
  ): number {
    switch (action.type) {
      case 'walk': {
        const from = projected.get(action.who) ?? { x: 0, y: 0 };
        return (pathLength(from, action.path) / walkSpeedTilesPerSec(action.speed)) * 1000;
      }
      case 'prop': {
        if (!action.path?.length) return 0;
        const from = projected.get(`prop:${action.prop}`) ?? { x: 0, y: 0 };
        return (pathLength(from, action.path) / walkSpeedTilesPerSec(action.speed)) * 1000;
      }
      case 'hop':
        return (action.count ?? 1) === 2 ? 380 : 210;
      case 'shake':
        return Math.max(120, (action.duration ?? 0.42) * 1000);
      case 'pose': {
        if (action.hold) return 0;
        if (action.duration !== undefined) return Math.max(200, action.duration * 1000);
        if (isCanonicalPoseName(action.anim)) return 520;
        const actor = this.getActor(action.who);
        const anim = actor ? this.caches.namedAnims.get(namedAnimKey(actor.visualAssetKey, action.anim)) : null;
        return anim ? getAnimationTotalMs(anim) : 520;
      }
      case 'emote':
        return Math.max(400, (action.duration ?? 1.35) * 1000);
      case 'aura':
        return Math.max(300, (action.duration ?? 0.95) * 1000);
      case 'show':
        return action.fade ? SHOW_FADE_MS : 0;
      case 'camera':
        return Math.max(0, (action.duration ?? 0.52) * 1000);
      case 'screenShake':
        return Math.max(80, (action.duration ?? 0.38) * 1000);
      case 'fade':
        return Math.max(0, (action.duration ?? 0.5) * 1000);
      case 'flash':
        return Math.max(60, (action.duration ?? 0.3) * 1000);
      case 'lighting':
        return Math.max(0, (action.duration ?? 1) * 1000);
      case 'location':
        return action.transition === 'cut' ? 0 : LOCATION_FADE_HALF_MS * 2;
      default:
        return 0;
    }
  }

  private projectAction(action: StageAction, projected: Map<string, { x: number; y: number }>): void {
    if (action.type === 'walk' && action.path.length) {
      const [x, y] = action.path[action.path.length - 1]!;
      projected.set(action.who, { x, y });
    } else if (action.type === 'place') {
      projected.set(action.who, { x: action.x, y: action.y });
    } else if (action.type === 'prop' && action.path?.length) {
      const [x, y] = action.path[action.path.length - 1]!;
      projected.set(`prop:${action.prop}`, { x, y });
    } else if (action.type === 'location') {
      for (const pl of action.placements) projected.set(pl.id, { x: pl.x, y: pl.y });
    }
  }

  private startWalk(mover: Mover, path: ReadonlyArray<[number, number]>, speed: WalkSpeed | undefined, endDirection?: PmdDirection): void {
    mover.walk = {
      waypoints: path.map(([x, y]) => ({ x, y })),
      segmentIndex: 0,
      speedTilesPerSec: walkSpeedTilesPerSec(speed),
      ...(endDirection !== undefined ? { endDirection } : {}),
    };
  }

  /** Applies one action now. `fast` snaps motion straight to its end state. */
  public executeAction(action: StageAction, fast: boolean): void {
    switch (action.type) {
      case 'camera': {
        const dur = fast ? 0 : Math.max(0, (action.duration ?? 0.52) * 1000);
        this.followActorId = null;
        if (dur <= 0) {
          this.cameraPan = null;
          this.cameraTileX = action.x;
          this.cameraTileY = action.y;
        } else {
          this.cameraPan = { startX: this.cameraTileX, startY: this.cameraTileY, targetX: action.x, targetY: action.y, elapsedMs: 0, durationMs: dur };
        }
        return;
      }
      case 'follow':
        this.followActorId = action.who;
        this.cameraPan = null;
        this.followCamera();
        return;
      case 'screenShake':
        this.screenShakeRemainingMs = fast ? 0 : Math.max(80, (action.duration ?? 0.38) * 1000);
        this.screenShakeIntensityPx = action.intensity ?? 2;
        return;
      case 'fade': {
        const targetAlpha = action.to === 'clear' ? 0 : 1;
        const color = action.to === 'clear' ? (this.fade?.color ?? 'black') : action.to;
        const from = this.fade && this.fade.color === color ? this.fade.alpha : action.to === 'clear' ? (this.fade?.alpha ?? 0) : 0;
        const durationMs = fast ? 0 : Math.max(0, (action.duration ?? 0.5) * 1000);
        this.fade = { color, from, to: targetAlpha, alpha: durationMs === 0 ? targetAlpha : from, elapsedMs: 0, durationMs };
        return;
      }
      case 'flash':
        this.flash = fast ? null : { color: action.color ?? 'white', elapsedMs: 0, durationMs: Math.max(60, (action.duration ?? 0.3) * 1000) };
        return;
      case 'weather':
        this.weather = action.weather;
        return;
      case 'lighting': {
        const durationMs = fast ? 0 : Math.max(0, (action.duration ?? 1) * 1000);
        this.lighting = { mood: action.mood as LightingMood, previous: durationMs > 0 ? this.lighting.mood : null, elapsedMs: 0, durationMs };
        return;
      }
      case 'sound': {
        const url = resolveMediaUrl('sfx', action.sound);
        if (url && !fast) this.onSound?.(url);
        return;
      }
      case 'location':
        this.executeLocationChange(action, fast);
        return;
      case 'prop':
        this.executePropAction(action, fast);
        return;
      default:
        this.executeActorAction(action, fast);
    }
  }

  private executeLocationChange(action: Extract<StageAction, { type: 'location' }>, fast: boolean): void {
    const swap = () => {
      this.setLocation(action.location, action.banner);
      const placed = new Map<string, CastPlacement>(action.placements.map((p) => [p.id, p]));
      for (const actor of this.actors) {
        const pl = placed.get(actor.actorId);
        actor.walk = null;
        actor.hop = null;
        actor.emote = null;
        actor.alphaFade = null;
        actor.alpha = 1;
        if (pl) {
          actor.x = pl.x;
          actor.y = pl.y;
          actor.direction = normalizePmdDirection(pl.facing, actor.direction);
          actor.visible = actor.available && !actor.offStage && !pl.hidden;
        } else {
          actor.visible = false;
        }
      }
      this.props = (action.props ?? []).map((p: PropPlacement) => instantiateCutsceneProp(p, this.caches));
      this.auraPulses = [];
      this.followActorId = null;
      this.cameraPan = null;
      this.cameraTileX = action.camera?.x ?? (this.location.width - 1) / 2;
      this.cameraTileY = action.camera?.y ?? (this.location.height - 1) / 2;
    };
    if (fast || action.transition === 'cut') {
      swap();
      if (fast && action.transition !== 'cut') this.fade = null;
      return;
    }
    const color = action.transition;
    this.fade = { color, from: this.fade?.alpha ?? 0, to: 1, alpha: this.fade?.alpha ?? 0, elapsedMs: 0, durationMs: LOCATION_FADE_HALF_MS };
    this.schedule(LOCATION_FADE_HALF_MS, (f) => {
      swap();
      this.fade = f ? null : { color, from: 1, to: 0, alpha: 1, elapsedMs: 0, durationMs: LOCATION_FADE_HALF_MS };
    });
  }

  private executePropAction(action: Extract<StageAction, { type: 'prop' }>, fast: boolean): void {
    const prop = this.props.find((p) => p.id === action.prop);
    if (!prop) return;
    if (action.visible !== undefined) prop.visible = action.visible;
    if (action.path?.length) {
      this.startWalk(prop, action.path, action.speed);
      if (fast) this.snapMoverToWalkEnd(prop, false);
    }
  }

  private executeActorAction(action: StageAction, fast: boolean): void {
    if (!('who' in action) || typeof action.who !== 'string') return;
    const actor = this.getActor(action.who);
    if (!actor) return;
    switch (action.type) {
      case 'show':
        actor.alphaFade = null;
        if (action.visible) {
          actor.visible = !actor.offStage;
          actor.alpha = 1;
          if (action.fade && !fast) actor.alphaFade = { from: 0, to: 1, elapsedMs: 0, durationMs: SHOW_FADE_MS, hideWhenDone: false };
          if (actor.alphaFade) actor.alpha = 0;
        } else if (action.fade && !fast && actor.visible) {
          actor.alphaFade = { from: actor.alpha, to: 0, elapsedMs: 0, durationMs: SHOW_FADE_MS, hideWhenDone: true };
        } else {
          actor.visible = false;
        }
        break;
      case 'place':
        actor.walk = null;
        actor.x = action.x;
        actor.y = action.y;
        if (action.facing) actor.direction = normalizePmdDirection(action.facing, actor.direction);
        break;
      case 'walk': {
        if (action.path.length === 0) break;
        if (!actor.offStage) actor.visible = true;
        actor.poseName = null;
        actor.poseAnim = null;
        actor.poseRemainingMs = 0;
        const endDir = action.facing !== undefined ? normalizePmdDirection(action.facing, actor.direction) : undefined;
        this.startWalk(actor, action.path, action.speed, endDir);
        if (fast) {
          this.snapMoverToWalkEnd(actor, true);
          actor.action = 'Idle';
        } else {
          actor.action = 'Walk';
        }
        break;
      }
      case 'face': {
        const target = action.toward ? this.getActor(action.toward) : undefined;
        if (target) actor.direction = directionFromDelta(target.x - actor.x, target.y - actor.y);
        else if (action.facing !== undefined) actor.direction = normalizePmdDirection(action.facing, actor.direction);
        break;
      }
      case 'hop': {
        const count = action.count ?? 1;
        actor.hop = { elapsedMs: 0, totalDurationMs: count === 2 ? 380 : 210, count, heightPx: 6 };
        break;
      }
      case 'shake':
        actor.shakeRemainingMs = Math.max(120, (action.duration ?? 0.42) * 1000);
        break;
      case 'pose': {
        actor.animElapsedMs = 0;
        if (isCanonicalPoseName(action.anim)) {
          actor.poseName = null;
          actor.poseAnim = null;
          actor.action = action.anim as RuntimeCutsceneActor['action'];
          actor.poseRemainingMs =
            action.anim === 'Idle' ? 0 : action.hold ? Infinity : Math.max(200, (action.duration ?? 0.52) * 1000);
        } else {
          const anim = this.caches.namedAnims.get(namedAnimKey(actor.visualAssetKey, action.anim)) ?? null;
          actor.action = 'Idle';
          actor.poseName = action.anim;
          actor.poseAnim = anim;
          actor.poseRemainingMs = action.hold
            ? Infinity
            : action.duration !== undefined
              ? Math.max(200, action.duration * 1000)
              : anim
                ? getAnimationTotalMs(anim)
                : 520;
        }
        break;
      }
      case 'emote': {
        const totalMs = Math.max(400, (action.duration ?? 1.35) * 1000);
        actor.emote = { kind: action.emote, remainingMs: totalMs, totalMs };
        break;
      }
      case 'aura':
        this.auraPulses.push({ actorId: actor.actorId, color: action.color ?? '#ffe066', elapsedMs: 0, durationMs: Math.max(300, (action.duration ?? 0.95) * 1000) });
        break;
      default:
        break;
    }
  }

  private followCamera(): void {
    if (!this.followActorId || this.cameraPan) return;
    const actor = this.getActor(this.followActorId);
    if (!actor) return;
    this.cameraTileX = actor.x;
    this.cameraTileY = actor.y;
  }

  private stepWalk(mover: Mover & { direction?: PmdDirection; action?: string }, dtMs: number, isActor: boolean): void {
    let remDist = (mover.walk!.speedTilesPerSec * dtMs) / 1000;
    while (remDist > 0 && mover.walk) {
      const target = mover.walk.waypoints[mover.walk.segmentIndex];
      if (!target) {
        mover.walk = null;
        break;
      }
      const dx = target.x - mover.x;
      const dy = target.y - mover.y;
      const dist = Math.hypot(dx, dy);
      if (isActor && dist > 0.001) (mover as RuntimeCutsceneActor).direction = directionFromDelta(dx, dy);
      if (dist <= remDist) {
        mover.x = target.x;
        mover.y = target.y;
        remDist -= dist;
        mover.walk.segmentIndex += 1;
        if (mover.walk.segmentIndex >= mover.walk.waypoints.length) {
          if (isActor && mover.walk.endDirection !== undefined) {
            const actor = mover as RuntimeCutsceneActor;
            actor.direction = normalizePmdDirection(mover.walk.endDirection, actor.direction);
          }
          mover.walk = null;
          break;
        }
      } else {
        mover.x += (dx / dist) * remDist;
        mover.y += (dy / dist) * remDist;
        remDist = 0;
      }
    }
    if (isActor && !mover.walk) (mover as RuntimeCutsceneActor).action = 'Idle';
  }

  public step(dtMs: number): void {
    this.animClockMs += dtMs;

    if (this.pending.length > 0) {
      this.pending.sort((a, b) => a.atMs - b.atMs || a.order - b.order);
      while (this.pending.length > 0 && this.pending[0]!.atMs <= this.animClockMs) {
        this.pending.shift()!.run(false);
      }
    }

    if (this.cameraPan) {
      this.cameraPan.elapsedMs += dtMs;
      const t = Math.min(1, this.cameraPan.elapsedMs / Math.max(1, this.cameraPan.durationMs));
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.cameraTileX = this.cameraPan.startX + (this.cameraPan.targetX - this.cameraPan.startX) * eased;
      this.cameraTileY = this.cameraPan.startY + (this.cameraPan.targetY - this.cameraPan.startY) * eased;
      if (t >= 1) this.cameraPan = null;
    }
    if (this.screenShakeRemainingMs > 0) this.screenShakeRemainingMs = Math.max(0, this.screenShakeRemainingMs - dtMs);

    for (let i = this.auraPulses.length - 1; i >= 0; i--) {
      const p = this.auraPulses[i]!;
      p.elapsedMs += dtMs;
      if (p.elapsedMs >= p.durationMs) this.auraPulses.splice(i, 1);
    }

    if (this.fade && this.fade.elapsedMs < this.fade.durationMs) {
      this.fade.elapsedMs = Math.min(this.fade.durationMs, this.fade.elapsedMs + dtMs);
      const t = this.fade.elapsedMs / Math.max(1, this.fade.durationMs);
      this.fade.alpha = this.fade.from + (this.fade.to - this.fade.from) * t;
    }
    if (this.flash) {
      this.flash.elapsedMs += dtMs;
      if (this.flash.elapsedMs >= this.flash.durationMs) this.flash = null;
    }
    if (this.lighting.previous) {
      this.lighting.elapsedMs += dtMs;
      if (this.lighting.elapsedMs >= this.lighting.durationMs) this.lighting.previous = null;
    }

    for (const prop of this.props) if (prop.walk) this.stepWalk(prop, dtMs, false);

    for (const actor of this.actors) {
      if (!actor.available || !actor.visible) continue;
      actor.animElapsedMs += dtMs;
      if (actor.alphaFade) {
        const f = actor.alphaFade;
        f.elapsedMs += dtMs;
        const t = Math.min(1, f.elapsedMs / Math.max(1, f.durationMs));
        actor.alpha = f.from + (f.to - f.from) * t;
        if (t >= 1) this.finishAlphaFade(actor);
      }
      if (actor.walk) {
        this.stepWalk(actor, dtMs, true);
      } else if (actor.poseRemainingMs > 0 && actor.poseRemainingMs !== Infinity) {
        actor.poseRemainingMs = Math.max(0, actor.poseRemainingMs - dtMs);
        if (actor.poseRemainingMs === 0) {
          actor.action = 'Idle';
          actor.poseName = null;
          actor.poseAnim = null;
        }
      }
      if (actor.hop) {
        actor.hop.elapsedMs += dtMs;
        if (actor.hop.elapsedMs >= actor.hop.totalDurationMs) actor.hop = null;
      }
      if (actor.shakeRemainingMs > 0) actor.shakeRemainingMs = Math.max(0, actor.shakeRemainingMs - dtMs);
      if (actor.emote) {
        actor.emote.remainingMs = Math.max(0, actor.emote.remainingMs - dtMs);
        if (actor.emote.remainingMs === 0) actor.emote = null;
      }
    }
    this.followCamera();
  }

  /** Applies beats `[0, beatIndex)` instantly (editor scrubbing / "play from here"). */
  public fastForwardTo(beatIndex: number): void {
    this.resetToStart();
    for (let i = 0; i < beatIndex && i < this.doc.beats.length; i++) {
      this.runBeatActions(this.doc.beats[i]!, true);
    }
    this.emotesOff();
  }

  private emotesOff(): void {
    for (const actor of this.actors) actor.emote = null;
    this.auraPulses = [];
  }
}
