/**
 * Shared RAF & Responsive Scale Scheduler for `PmdSpriteActor` (`pmdSpriteScheduler.ts`)
 */

export const DESKTOP_SPRITE_SCALE = 1.5;
export const MOBILE_SPRITE_SCALE = 2;
const DESKTOP_VIEWPORT_QUERY = '(min-width: 641px) and (min-height: 501px)';

export interface ScheduledSpriteActor {
  tick(now: number): void;
  applyResponsiveScale(nextScale: number): void;
  destroy(): void;
}

export function getDefaultPmdSpriteScale(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_SPRITE_SCALE;
  }
  return window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches
    ? DESKTOP_SPRITE_SCALE
    : MOBILE_SPRITE_SCALE;
}

const activeActors = new Set<ScheduledSpriteActor>();
let actorRafRunning = false;
let mediaListenerBound = false;

function ensureResponsiveScaleListener(): void {
  if (
    mediaListenerBound ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }
  mediaListenerBound = true;
  const mql = window.matchMedia(DESKTOP_VIEWPORT_QUERY);
  const onViewportChange = () => {
    const nextScale = mql.matches ? DESKTOP_SPRITE_SCALE : MOBILE_SPRITE_SCALE;
    for (const actor of activeActors) {
      actor.applyResponsiveScale(nextScale);
    }
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onViewportChange);
  }
}

function ensureActorLoop(): void {
  if (actorRafRunning) return;
  actorRafRunning = true;
  const step = (now: number) => {
    if (activeActors.size === 0) {
      actorRafRunning = false;
      return;
    }
    for (const actor of activeActors) {
      actor.tick(now);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function registerScheduledSpriteActor(actor: ScheduledSpriteActor): void {
  activeActors.add(actor);
  ensureResponsiveScaleListener();
  ensureActorLoop();
}

export function unregisterScheduledSpriteActor(actor: ScheduledSpriteActor): void {
  activeActors.delete(actor);
}

export function destroyAllPmdSpriteActors(): void {
  for (const actor of [...activeActors]) {
    actor.destroy();
  }
  activeActors.clear();
  actorRafRunning = false;
}
