/**
 * Cutscene Stage Choreography & Simulation Controller (`cutsceneChoreographer.ts`)
 */

import {
  directionFromDelta,
  normalizePmdDirection,
} from '../../assets/pmdAssetLoader';
import type {
  ActiveAuraPulse,
  CutsceneCueAction,
  RuntimeCutsceneActor,
} from './cutsceneTypes';

export class CutsceneChoreographer {
  public cameraTileX = 8;
  public cameraTileY = 5.5;
  public screenShakeRemainingMs = 0;
  public screenShakeIntensityPx = 2;
  public animClockMs = 0;
  public auraPulses: ActiveAuraPulse[] = [];

  private cameraPan: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsedMs: number;
    durationMs: number;
  } | null = null;
  private readonly pendingTimers = new Set<number>();

  public reset(initialCamera: { x: number; y: number }): void {
    this.clearPendingTimers();
    this.animClockMs = 0;
    this.auraPulses = [];
    this.cameraPan = null;
    this.screenShakeRemainingMs = 0;
    this.cameraTileX = initialCamera.x;
    this.cameraTileY = initialCamera.y;
  }

  public clearPendingTimers(): void {
    for (const id of this.pendingTimers) {
      window.clearTimeout(id);
    }
    this.pendingTimers.clear();
  }

  public scheduleTimeout(fn: () => void, waitMs: number): void {
    const timer = window.setTimeout(() => {
      this.pendingTimers.delete(timer);
      fn();
    }, waitMs);
    this.pendingTimers.add(timer);
  }

  public applyCueActions(
    actions: ReadonlyArray<CutsceneCueAction>,
    actors: RuntimeCutsceneActor[],
    fastMode: boolean,
    isOpen: () => boolean
  ): void {
    for (const cue of actions) {
      const delay = fastMode ? 0 : Math.max(0, cue.delayMs ?? 0);
      if (delay > 0) {
        this.scheduleTimeout(() => {
          if (!isOpen()) return;
          this.executeImmediateCue(cue, actors, fastMode);
        }, delay);
      } else {
        this.executeImmediateCue(cue, actors, fastMode);
      }
    }
  }

  private executeImmediateCue(
    cue: CutsceneCueAction,
    actors: RuntimeCutsceneActor[],
    fastMode: boolean
  ): void {
    if (cue.type === 'camera') {
      const dur = fastMode ? 0 : Math.max(0, cue.durationMs ?? 520);
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
      this.screenShakeRemainingMs = fastMode ? 0 : Math.max(80, cue.durationMs ?? 380);
      this.screenShakeIntensityPx = cue.intensityPx ?? 2;
      return;
    }

    const actor = actors.find((a) => a.actorId === cue.actorId && a.available);
    if (!actor) return;

    switch (cue.type) {
      case 'visibility':
        actor.visible = cue.visible;
        break;
      case 'walk': {
        if (cue.path.length === 0) break;
        actor.visible = true;
        if (fastMode) {
          const last = cue.path[cue.path.length - 1]!;
          const prev =
            cue.path.length >= 2
              ? cue.path[cue.path.length - 2]!
              : { x: actor.x, y: actor.y };
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
          const target = actors.find((a) => a.actorId === cue.targetActorId && a.available);
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
      case 'shake':
        actor.shakeRemainingMs = Math.max(120, cue.durationMs ?? 420);
        break;
      case 'pose':
        actor.action = cue.action;
        actor.animElapsedMs = 0;
        actor.poseRemainingMs = Math.max(200, cue.durationMs ?? 520);
        break;
      case 'emote': {
        const totalMs = Math.max(400, cue.durationMs ?? 1350);
        actor.emote = { kind: cue.emote, remainingMs: totalMs, totalMs };
        break;
      }
      case 'auraPulse':
        this.auraPulses.push({
          actorId: actor.actorId,
          color: cue.color ?? '#ffe066',
          elapsedMs: 0,
          durationMs: Math.max(300, cue.durationMs ?? 950),
        });
        break;
    }
  }

  public snapAllInFlight(actors: RuntimeCutsceneActor[]): void {
    this.clearPendingTimers();
    if (this.cameraPan) {
      this.cameraTileX = this.cameraPan.targetX;
      this.cameraTileY = this.cameraPan.targetY;
      this.cameraPan = null;
    }
    this.screenShakeRemainingMs = 0;
    for (const actor of actors) {
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

  public stepSimulation(dtMs: number, actors: RuntimeCutsceneActor[]): void {
    this.animClockMs += dtMs;

    if (this.cameraPan) {
      this.cameraPan.elapsedMs += dtMs;
      const t = Math.min(1, this.cameraPan.elapsedMs / Math.max(1, this.cameraPan.durationMs));
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.cameraTileX =
        this.cameraPan.startX + (this.cameraPan.targetX - this.cameraPan.startX) * eased;
      this.cameraTileY =
        this.cameraPan.startY + (this.cameraPan.targetY - this.cameraPan.startY) * eased;
      if (t >= 1) this.cameraPan = null;
    }

    if (this.screenShakeRemainingMs > 0) {
      this.screenShakeRemainingMs = Math.max(0, this.screenShakeRemainingMs - dtMs);
    }

    for (let i = this.auraPulses.length - 1; i >= 0; i--) {
      const p = this.auraPulses[i]!;
      p.elapsedMs += dtMs;
      if (p.elapsedMs >= p.durationMs) this.auraPulses.splice(i, 1);
    }

    for (const actor of actors) {
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
          if (dist > 0.001) actor.direction = directionFromDelta(dx, dy);
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
        if (actor.poseRemainingMs === 0) actor.action = 'Idle';
      }

      if (actor.hop) {
        actor.hop.elapsedMs += dtMs;
        if (actor.hop.elapsedMs >= actor.hop.totalDurationMs) actor.hop = null;
      }
      if (actor.shakeRemainingMs > 0) {
        actor.shakeRemainingMs = Math.max(0, actor.shakeRemainingMs - dtMs);
      }
      if (actor.emote) {
        actor.emote.remainingMs = Math.max(0, actor.emote.remainingMs - dtMs);
        if (actor.emote.remainingMs === 0) actor.emote = null;
      }
    }
  }
}
