/**
 * Mystery Emblem - Tutorial DOM Spotlight & Non-Overlapping Coach Dock (`TutorialSpotlightController.ts`)
 */

import type { AdvisorTutorialBeat } from '../../data/tutorialRegistry';

export class TutorialSpotlightController {
  public readonly domSpotlightEl: HTMLElement;
  private readonly backdropEl: HTMLElement;
  private readonly cardWindowEl: HTMLElement;
  private spotlightRafId: number | null = null;

  constructor(opts: { backdropEl: HTMLElement; cardWindowEl: HTMLElement }) {
    this.backdropEl = opts.backdropEl;
    this.cardWindowEl = opts.cardWindowEl;

    this.domSpotlightEl = document.createElement('div');
    this.domSpotlightEl.className = 'pmd-tutorial-dom-spotlight';
    this.domSpotlightEl.dataset.testid = 'tutorial-dom-spotlight';
    this.domSpotlightEl.hidden = true;
  }

  public startLoop(
    getState: () => {
      isCardOpen: boolean;
      beat: AdvisorTutorialBeat | null;
      isInteractive: boolean;
    }
  ): void {
    this.stopLoop();
    const tick = () => {
      const state = getState();
      if (!state.isCardOpen) {
        this.domSpotlightEl.hidden = true;
        this.spotlightRafId = null;
        return;
      }
      this.sync(state.beat, state.isInteractive);
      this.spotlightRafId = window.requestAnimationFrame(tick);
    };
    const initial = getState();
    this.sync(initial.beat, initial.isInteractive);
    this.spotlightRafId = window.requestAnimationFrame(tick);
  }

  public stopLoop(): void {
    if (this.spotlightRafId !== null) {
      window.cancelAnimationFrame(this.spotlightRafId);
      this.spotlightRafId = null;
    }
  }

  public hide(): void {
    this.stopLoop();
    this.domSpotlightEl.hidden = true;
  }

  private findSpotlightDomElement(beat: AdvisorTutorialBeat): HTMLElement | null {
    const spot = beat.spotlight;
    if (!spot || spot.kind === 'none') return null;

    const selector = spot.kind === 'dom' ? spot.selector : spot.fallbackDomSelector ?? null;
    if (!selector) return null;

    const el = document.querySelector<HTMLElement>(selector);
    if (!el || el.hidden) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    return el;
  }

  public sync(beat: AdvisorTutorialBeat | null, isInteractive: boolean): void {
    if (!beat) {
      this.domSpotlightEl.hidden = true;
      return;
    }

    this.backdropEl.classList.toggle('is-interactive-passthrough', isInteractive);
    this.backdropEl.classList.remove('is-compendium-mode');

    const targetEl = isInteractive ? this.findSpotlightDomElement(beat) : null;
    const vpW = window.innerWidth || 1024;
    const vpH = window.innerHeight || 768;

    let preferredDock: 'top' | 'bottom' =
      isInteractive && beat.spotlight?.kind === 'dom' && beat.spotlight.preferredDock === 'top'
        ? 'top'
        : 'bottom';

    if (targetEl) {
      const r = targetEl.getBoundingClientRect();
      const pad = 4;
      const left = Math.max(2, Math.round(r.left - pad));
      const top = Math.max(2, Math.round(r.top - pad));
      const width = Math.min(vpW - left - 2, Math.round(r.width + pad * 2));
      const height = Math.min(vpH - top - 2, Math.round(r.height + pad * 2));

      this.domSpotlightEl.style.left = `${left}px`;
      this.domSpotlightEl.style.top = `${top}px`;
      this.domSpotlightEl.style.width = `${width}px`;
      this.domSpotlightEl.style.height = `${height}px`;
      this.domSpotlightEl.hidden = false;

      if (r.bottom > vpH * 0.66) preferredDock = 'top';
    } else {
      this.domSpotlightEl.hidden = true;
    }

    const overworldEl = document.querySelector<HTMLElement>('#pmd-overworld-scene:not([hidden])');
    this.backdropEl.dataset.overworldOpen = overworldEl ? 'true' : 'false';
    this.backdropEl.dataset.coachDock = preferredDock;
    this.cardWindowEl.dataset.coachDock = preferredDock;
  }
}
