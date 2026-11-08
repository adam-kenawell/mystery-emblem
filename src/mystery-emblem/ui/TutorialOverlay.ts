/**
 * Mystery Emblem — Wimpod Interactive Advisor, Spotlight Coach & "Ask Wimpod" Guide (`TutorialOverlay.ts`)
 *
 * Strictly enforces:
 * - Rule 2: 100% Unified Pointer Events (`bindPointerTap` + `bindBackGestureSurface`), ZERO keyboard
 *   listeners, `>= 44x44px` interactive targets, and zero-clipping layouts across `1920x1080`,
 *   `390x844`, and `844x390`.
 * - Rule 3: Authentic PMD: Explorers of Sky stepped 9-slice frames, crisp nearest-neighbor Wimpod (`0767`)
 *   multi-emotion portraits, `#F8F858` yellow speaker headers, colored elemental types, and mini icons.
 * - Rule 7: Persists `tutorialsEnabled`, `seenTutorialIds`, and `unlockedTutorialIds` via
 *   `SaveStateManager` (`localStorage` + Cloud Firestore).
 */

import { WIMPOD_PMD_ASSET_ID } from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { getSpeciesById } from '../data/index';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_CATEGORY_ORDER,
  TUTORIAL_TOPICS,
  getTutorialTopicById,
  type TutorialActionTriggerId,
  type TutorialBattleTileFilter,
  type TutorialTopicDefinition,
  type TutorialVisualChip,
  type WimpodTutorialBeat,
} from '../data/tutorialRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { SaveData } from '../types/schemas';
import { createMiniItemIcon } from './PmdItemIconGrid';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { createMiniSpeciesPortrait } from './PmdUnitPortraitGrid';
import { createPmdButton, createPmdWindow } from './PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';
import { createColoredTypeSpan } from './typeColors';

export interface TutorialActionAvailabilityContext {
  isActionAlreadyDone?: (action: TutorialActionTriggerId) => boolean;
  canPerformActionNow?: (action: TutorialActionTriggerId) => boolean;
}

export interface TutorialOverlayOptions {
  parent: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onLayerStateChanged?: () => void;
}

export interface RenderTutorialSettingsControlOptions {
  signal?: AbortSignal;
  onAfterChange?: () => void;
  onOpenCompendium?: () => void;
}

type ActiveModalMode = 'closed' | 'card' | 'compendium';

function interpolateWimpodText(raw: string, save: SaveData | null): string {
  const findName = (
    pred: (idx: number) => boolean,
    fallbackSpeciesId: string
  ): string => {
    const unit = save?.roster.find((_, i) => pred(i));
    if (unit?.nickname) return unit.nickname;
    return getSpeciesById(fallbackSpeciesId)?.name ?? fallbackSpeciesId;
  };

  const lordUnit =
    save?.roster.find((u) => u.instanceId === save.campaign.lordInstanceId) ??
    save?.roster.find((u) => u.isLord) ??
    save?.roster[0];
  const partnerUnit =
    save?.roster.find((u) => u.instanceId === save.campaign.partnerInstanceId) ??
    save?.roster[1];
  const lordName = lordUnit?.nickname || getSpeciesById('axew')?.name || 'Hero';
  const partnerName = partnerUnit?.nickname || getSpeciesById('piplup')?.name || 'Piplup';
  const healerName = findName((i) => i === 2, 'flabebe');

  return raw
    .replace(/\{lord\}/g, lordName)
    .replace(/\{partner\}/g, partnerName)
    .replace(/\{healer\}/g, healerName)
    .replace(/\{advisor\}/g, 'Wimpod');
}

export class TutorialOverlay {
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onLayerStateChanged?: () => void;
  private readonly abortController = new AbortController();

  private readonly backdropEl: HTMLElement;
  private readonly domSpotlightEl: HTMLElement;
  private readonly cardWindowEl: HTMLElement;
  private readonly compendiumWindowEl: HTMLElement;
  private readonly coachPortraitView: PmdPortraitView;
  private readonly compendiumPortraitView: PmdPortraitView;

  private mode: ActiveModalMode = 'closed';
  private activeTopic: TutorialTopicDefinition | null = null;
  private activeBeats: ReadonlyArray<WimpodTutorialBeat> = [];
  private activeBeatIndex = 0;
  private activeBeatInteractive = false;
  private returnToCompendiumOnClose = false;
  private activeCardResolver: ((shown: boolean) => void) | null = null;

  private availabilityProvider: TutorialActionAvailabilityContext | null = null;

  private fullBeatText = '';
  private revealedChars = 0;
  private typewriterTimer: number | null = null;
  private activeTextEl: HTMLElement | null = null;

  private spotlightRafId: number | null = null;
  private nudgeTimer: number | null = null;

  private presentationQueue: Promise<unknown> = Promise.resolve();
  private fastMode = false;
  private pauseInFastMode = false;

  constructor(options: TutorialOverlayOptions) {
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onLayerStateChanged = options.onLayerStateChanged;

    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'pmd-tutorial-backdrop';
    this.backdropEl.dataset.testid = 'tutorial-overlay-backdrop';
    this.backdropEl.hidden = true;

    this.domSpotlightEl = document.createElement('div');
    this.domSpotlightEl.className = 'pmd-tutorial-dom-spotlight';
    this.domSpotlightEl.dataset.testid = 'tutorial-dom-spotlight';
    this.domSpotlightEl.hidden = true;

    this.cardWindowEl = createPmdWindow({
      className: 'pmd-tutorial-card pmd-wimpod-coach-bar',
      testId: 'tutorial-card-modal',
      role: 'dialog',
      ariaLabel: "Wimpod's Tactical Guidance",
    });
    this.cardWindowEl.hidden = true;

    this.compendiumWindowEl = createPmdWindow({
      className: 'pmd-tutorial-compendium',
      testId: 'tutorial-compendium-modal',
      role: 'dialog',
      ariaLabel: "Ask Wimpod — Survival Notes",
    });
    this.compendiumWindowEl.hidden = true;

    this.coachPortraitView = new PmdPortraitView({
      pixelScale: 1.5,
      testId: 'tutorial-wimpod-portrait',
    });
    this.compendiumPortraitView = new PmdPortraitView({
      pixelScale: 1,
      testId: 'tutorial-compendium-wimpod-portrait',
    });

    this.backdropEl.append(this.domSpotlightEl, this.cardWindowEl, this.compendiumWindowEl);
    options.parent.appendChild(this.backdropEl);

    const signal = this.abortController.signal;

    // Tapping the blocking backdrop finishes typewriter or advances speech beats
    bindPointerTap(
      this.backdropEl,
      (ev: PointerEvent) => {
        if (ev.target !== this.backdropEl) return;
        if (this.hasActiveInteractiveStep()) return;
        if (this.mode === 'card') {
          this.handleCoachAdvanceTap();
        } else if (this.mode === 'compendium') {
          this.handleBack();
        }
      },
      { signal }
    );

    // Tapping Wimpod's coach card body finishes typewriter (and advances on non-action speech beats)
    bindPointerTap(
      this.cardWindowEl,
      (ev: PointerEvent) => {
        const target = ev.target as HTMLElement | null;
        if (target?.closest('button')) return;
        if (this.isTyping()) {
          this.completeTypewriterImmediately();
          this.audioManager.playSfx('select');
          return;
        }
        if (!this.hasActiveInteractiveStep()) {
          this.handleCoachAdvanceTap();
        }
      },
      { signal }
    );

    // PC Right-Click (`contextmenu`) & Mobile Touch Long-Press (`520ms`) parity when blocking
    bindBackGestureSurface(
      this.backdropEl,
      () => {
        if (this.hasActiveInteractiveStep()) return;
        this.handleBack();
      },
      { signal }
    );

    this.backdropEl.addEventListener(
      'contextmenu',
      (ev: MouseEvent) => {
        if (this.hasActiveInteractiveStep()) return;
        ev.preventDefault();
        ev.stopPropagation();
      },
      { signal }
    );
    this.backdropEl.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        if (this.hasActiveInteractiveStep() && ev.target === this.backdropEl) {
          return;
        }
        ev.stopPropagation();
      },
      { signal }
    );
  }

  public setActionAvailabilityProvider(provider: TutorialActionAvailabilityContext | null): void {
    this.availabilityProvider = provider;
    if (this.isOpen() && this.mode === 'card') {
      this.syncActiveBeatInteractivity();
    }
  }

  public isOpen(): boolean {
    return this.mode !== 'closed' && !this.backdropEl.hidden;
  }

  /**
   * True when a modal/speech beat is actively blocking the underlying scene.
   * False during hands-on `awaitAction` steps so live map/UI clicks flow directly to the scene.
   */
  public isBlockingSceneInput(): boolean {
    return this.isOpen() && !this.hasActiveInteractiveStep();
  }

  public getMode(): ActiveModalMode {
    return this.mode;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = enabled;
  }

  public isFastMode(): boolean {
    return this.fastMode;
  }

  public setPauseInFastMode(enabled: boolean): void {
    this.pauseInFastMode = enabled;
  }

  public shouldPauseInFastMode(): boolean {
    return this.pauseInFastMode;
  }

  public getActiveTopicId(): string | null {
    return this.activeTopic?.id ?? null;
  }

  public getCurrentBeat(): WimpodTutorialBeat | null {
    if (this.mode !== 'card') return null;
    return this.activeBeats[this.activeBeatIndex] ?? null;
  }

  private syncActiveBeatInteractivity(): void {
    if (this.mode !== 'card' || this.returnToCompendiumOnClose) {
      this.activeBeatInteractive = false;
      return;
    }
    const beat = this.activeBeats[this.activeBeatIndex] ?? null;
    if (!beat?.awaitAction) {
      this.activeBeatInteractive = false;
      return;
    }
    this.activeBeatInteractive = this.availabilityProvider?.canPerformActionNow
      ? this.availabilityProvider.canPerformActionNow(beat.awaitAction)
      : true;
  }

  /**
   * Returns the live `TutorialActionTriggerId` Wimpod is currently waiting for the player to perform,
   * or `null` if Wimpod is closed, in the Compendium, or showing a pure speech beat.
   */
  public getExpectedAction(): TutorialActionTriggerId | null {
    if (!this.isOpen() || this.mode !== 'card' || !this.activeBeatInteractive) {
      return null;
    }
    return this.getCurrentBeat()?.awaitAction ?? null;
  }

  public hasActiveInteractiveStep(): boolean {
    return this.getExpectedAction() !== null;
  }

  /**
   * Returns the active dungeon canvas tile highlight filter if the current interactive step
   * spotlights battlefield tiles (`empty_floor`, `lord_unit`, `reachable_move`, etc.).
   */
  public getActiveTileFilter(): TutorialBattleTileFilter | null {
    if (!this.hasActiveInteractiveStep()) return null;
    const spot = this.getCurrentBeat()?.spotlight;
    return spot?.kind === 'battle_tiles' ? spot.tileFilter : null;
  }

  /**
   * Called by `BattleScene`, `DungeonPrepOverlay`, and `OverworldScene` whenever the player completes
   * a guided action. Advances Wimpod immediately to the next beat (or finishes the topic).
   */
  public notifyActionCompleted(action: TutorialActionTriggerId): boolean {
    const expected = this.getExpectedAction();
    if (!expected || expected !== action) {
      return false;
    }
    this.advanceFromCurrentBeat('confirm');
    return true;
  }

  /**
   * Gentle visual + audio nudge when the player clicks an unrelated action during a gated drill step.
   */
  public nudgeActiveStep(): void {
    if (!this.isOpen() || this.mode !== 'card') return;
    if (this.isTyping()) {
      this.completeTypewriterImmediately();
    }
    this.audioManager.playSfx('cancel');
    this.cardWindowEl.classList.remove('is-nudged');
    void this.cardWindowEl.offsetWidth;
    this.cardWindowEl.classList.add('is-nudged');
    if (this.nudgeTimer !== null) {
      window.clearTimeout(this.nudgeTimer);
    }
    this.nudgeTimer = window.setTimeout(() => {
      this.cardWindowEl.classList.remove('is-nudged');
      this.nudgeTimer = null;
    }, 420);
  }

  /**
   * Unlocks `topicId` in **Ask Wimpod** and, if tutorials are enabled and `topicId` has not yet been
   * seen, presents Wimpod's interactive walkthrough or comedic callout.
   */
  public presentTopicIfNeeded(
    topicId: string,
    opts?: { sceneFastMode?: boolean }
  ): Promise<boolean> {
    const next = this.presentationQueue.then(() =>
      this.runTopicPresentation(topicId, Boolean(opts?.sceneFastMode))
    );
    this.presentationQueue = next.catch(() => false);
    return next;
  }

  private async runTopicPresentation(
    topicId: string,
    sceneFastMode: boolean
  ): Promise<boolean> {
    const save = this.saveManager.getSave();
    if (!save) {
      return false;
    }

    const topic = getTutorialTopicById(topicId);
    if (!topic || topic.beats.length === 0) {
      return false;
    }

    // Always unlock reached topics so players can look them up anytime via Ask Wimpod
    this.saveManager.unlockTutorial(topic.id);

    if (!this.saveManager.areTutorialsEnabled()) {
      return false;
    }

    if (this.saveManager.hasSeenTutorial(topic.id)) {
      return false;
    }

    if ((this.fastMode || sceneFastMode) && !this.pauseInFastMode) {
      this.saveManager.markTutorialSeen(topic.id);
      return false;
    }

    // Skip past any leading beats whose live action was already completed (e.g. Forecast already open)
    let startIdx = 0;
    while (startIdx < topic.beats.length - 1) {
      const candidate = topic.beats[startIdx]!;
      if (
        candidate.awaitAction &&
        this.availabilityProvider?.isActionAlreadyDone?.(candidate.awaitAction)
      ) {
        startIdx += 1;
      } else {
        break;
      }
    }

    return new Promise<boolean>((resolve) => {
      this.activeTopic = topic;
      this.activeBeats = topic.beats;
      this.activeBeatIndex = startIdx;
      this.returnToCompendiumOnClose = false;
      this.activeCardResolver = resolve;
      this.mode = 'card';

      this.compendiumWindowEl.hidden = true;
      this.cardWindowEl.hidden = false;
      this.backdropEl.hidden = false;
      this.syncActiveBeatInteractivity();
      this.renderActiveCardDom();
      this.startSpotlightLoop();
      this.audioManager.playSfx('menu_open');
      this.onLayerStateChanged?.();
    });
  }

  /**
   * Opens **Ask Wimpod** (progressive, spoiler-free Survival Notes) listing all topics reached so far.
   */
  public openCompendiumModal(): void {
    if (this.activeCardResolver) {
      if (this.activeTopic && !this.returnToCompendiumOnClose) {
        this.saveManager.markTutorialSeen(this.activeTopic.id);
      }
      const prevResolve = this.activeCardResolver;
      this.activeCardResolver = null;
      prevResolve(true);
    }

    this.stopSpotlightLoop();
    this.clearTypewriter();
    this.activeTopic = null;
    this.activeBeats = [];
    this.activeBeatIndex = 0;
    this.activeBeatInteractive = false;
    this.returnToCompendiumOnClose = false;
    this.mode = 'compendium';

    this.backdropEl.classList.remove('is-interactive-passthrough');
    this.backdropEl.classList.add('is-compendium-mode');
    this.domSpotlightEl.hidden = true;
    this.cardWindowEl.hidden = true;
    this.compendiumWindowEl.hidden = false;
    this.backdropEl.hidden = false;
    this.renderCompendiumDom();
    this.audioManager.playSfx('menu_open');
    this.onLayerStateChanged?.();
  }

  /**
   * Replays any unlocked topic from **Ask Wimpod** as pure in-character speech cards.
   */
  public openTopicFromCompendium(topicId: string): void {
    const topic = getTutorialTopicById(topicId);
    if (!topic || topic.beats.length === 0) return;

    if (this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(topic.id);
    }

    this.activeTopic = topic;
    this.activeBeats = topic.beats;
    this.activeBeatIndex = 0;
    this.returnToCompendiumOnClose = true;
    this.mode = 'card';

    this.backdropEl.classList.remove('is-compendium-mode');
    this.compendiumWindowEl.hidden = true;
    this.cardWindowEl.hidden = false;
    this.backdropEl.hidden = false;
    this.syncActiveBeatInteractivity();
    this.renderActiveCardDom();
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
  }

  public handleBack(): boolean {
    if (!this.isOpen()) return false;

    if (this.mode === 'card') {
      if (this.returnToCompendiumOnClose && this.activeBeatIndex > 0) {
        this.activeBeatIndex -= 1;
        this.syncActiveBeatInteractivity();
        this.audioManager.playSfx('cursor');
        this.renderActiveCardDom();
        return true;
      }
      this.dismissActiveCard('cancel');
      return true;
    }

    if (this.mode === 'compendium') {
      this.closeAll('cancel');
      return true;
    }

    return false;
  }

  public closeAll(sfx: 'cancel' | 'confirm' | null = null): void {
    if (this.activeTopic && !this.returnToCompendiumOnClose && this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(this.activeTopic.id);
    }
    this.stopSpotlightLoop();
    this.clearTypewriter();
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;
    this.activeTopic = null;
    this.activeBeats = [];
    this.activeBeatIndex = 0;
    this.activeBeatInteractive = false;
    this.returnToCompendiumOnClose = false;
    this.mode = 'closed';

    this.backdropEl.classList.remove('is-interactive-passthrough', 'is-compendium-mode');
    this.domSpotlightEl.hidden = true;
    this.cardWindowEl.hidden = true;
    this.compendiumWindowEl.hidden = true;
    this.backdropEl.hidden = true;

    if (sfx) {
      this.audioManager.playSfx(sfx);
    }
    this.onLayerStateChanged?.();
    if (resolver) {
      resolver(true);
    }
  }

  private handleCoachAdvanceTap(): void {
    if (this.mode !== 'card') return;
    if (this.isTyping()) {
      this.completeTypewriterImmediately();
      this.audioManager.playSfx('select');
      return;
    }
    if (this.hasActiveInteractiveStep()) {
      return;
    }
    this.advanceFromCurrentBeat('confirm');
  }

  private advanceFromCurrentBeat(finishSfx: 'cancel' | 'confirm'): void {
    this.clearTypewriter();
    let nextIdx = this.activeBeatIndex + 1;

    if (!this.returnToCompendiumOnClose) {
      while (nextIdx < this.activeBeats.length) {
        const candidate = this.activeBeats[nextIdx]!;
        if (
          candidate.awaitAction &&
          this.availabilityProvider?.isActionAlreadyDone?.(candidate.awaitAction)
        ) {
          nextIdx += 1;
        } else {
          break;
        }
      }
    }

    if (nextIdx < this.activeBeats.length) {
      this.activeBeatIndex = nextIdx;
      this.syncActiveBeatInteractivity();
      this.audioManager.playSfx('select');
      this.renderActiveCardDom();
      this.syncSpotlightAndDock();
      this.onLayerStateChanged?.();
      return;
    }

    this.dismissActiveCard(finishSfx);
  }

  private dismissActiveCard(sfx: 'cancel' | 'confirm'): void {
    this.clearTypewriter();
    this.stopSpotlightLoop();
    this.domSpotlightEl.hidden = true;
    this.activeBeatInteractive = false;

    if (this.activeTopic && this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(this.activeTopic.id);
    }
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;

    if (this.returnToCompendiumOnClose) {
      this.activeTopic = null;
      this.activeBeats = [];
      this.activeBeatIndex = 0;
      this.returnToCompendiumOnClose = false;
      this.mode = 'compendium';
      this.backdropEl.classList.remove('is-interactive-passthrough');
      this.backdropEl.classList.add('is-compendium-mode');
      this.cardWindowEl.hidden = true;
      this.compendiumWindowEl.hidden = false;
      this.renderCompendiumDom();
      this.audioManager.playSfx(sfx);
      this.onLayerStateChanged?.();
      if (resolver) resolver(true);
      return;
    }

    this.activeTopic = null;
    this.activeBeats = [];
    this.activeBeatIndex = 0;
    this.mode = 'closed';
    this.backdropEl.classList.remove('is-interactive-passthrough', 'is-compendium-mode');
    this.cardWindowEl.hidden = true;
    this.compendiumWindowEl.hidden = true;
    this.backdropEl.hidden = true;
    this.audioManager.playSfx(sfx);
    this.onLayerStateChanged?.();
    if (resolver) {
      resolver(true);
    }
  }

  private isTyping(): boolean {
    return this.typewriterTimer !== null && this.revealedChars < this.fullBeatText.length;
  }

  private clearTypewriter(): void {
    if (this.typewriterTimer !== null) {
      window.clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }

  private completeTypewriterImmediately(): void {
    this.clearTypewriter();
    this.revealedChars = this.fullBeatText.length;
    if (this.activeTextEl) {
      this.activeTextEl.textContent = this.fullBeatText;
    }
  }

  private startBeatTypewriter(targetEl: HTMLElement, formattedText: string): void {
    this.clearTypewriter();
    this.activeTextEl = targetEl;
    this.fullBeatText = formattedText;

    const prefersReducedMotion =
      this.fastMode ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (prefersReducedMotion || formattedText.length === 0) {
      this.revealedChars = formattedText.length;
      targetEl.textContent = formattedText;
      return;
    }

    this.revealedChars = 0;
    targetEl.textContent = '';
    this.typewriterTimer = window.setInterval(() => {
      this.revealedChars = Math.min(this.fullBeatText.length, this.revealedChars + 2);
      targetEl.textContent = this.fullBeatText.slice(0, this.revealedChars);
      this.audioManager.playSfx('typewriter_blip');
      if (this.revealedChars >= this.fullBeatText.length) {
        this.clearTypewriter();
      }
    }, 12);
  }

  private startSpotlightLoop(): void {
    this.stopSpotlightLoop();
    const tick = () => {
      if (!this.isOpen() || this.mode !== 'card') {
        this.domSpotlightEl.hidden = true;
        this.spotlightRafId = null;
        return;
      }
      this.syncSpotlightAndDock();
      this.spotlightRafId = window.requestAnimationFrame(tick);
    };
    this.syncSpotlightAndDock();
    this.spotlightRafId = window.requestAnimationFrame(tick);
  }

  private stopSpotlightLoop(): void {
    if (this.spotlightRafId !== null) {
      window.cancelAnimationFrame(this.spotlightRafId);
      this.spotlightRafId = null;
    }
  }

  private findSpotlightDomElement(beat: WimpodTutorialBeat): HTMLElement | null {
    const spot = beat.spotlight;
    if (!spot || spot.kind === 'none') return null;

    const selector =
      spot.kind === 'dom' ? spot.selector : spot.fallbackDomSelector ?? null;
    if (!selector) return null;

    const el = document.querySelector<HTMLElement>(selector);
    if (!el || el.hidden) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    return el;
  }

  private syncSpotlightAndDock(): void {
    const beat = this.getCurrentBeat();
    if (!beat || this.mode !== 'card') {
      this.domSpotlightEl.hidden = true;
      return;
    }

    const isInteractive = this.hasActiveInteractiveStep();
    this.backdropEl.classList.toggle('is-interactive-passthrough', isInteractive);
    this.backdropEl.classList.remove('is-compendium-mode');

    const targetEl = isInteractive ? this.findSpotlightDomElement(beat) : null;
    const vpW = window.innerWidth || 1024;
    const vpH = window.innerHeight || 768;

    let preferredDock: 'top' | 'bottom' =
      beat.spotlight?.kind === 'dom' && beat.spotlight.preferredDock
        ? beat.spotlight.preferredDock
        : 'top';

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

      // Guarantee Wimpod's coach bar never overlaps the spotlighted interactive button!
      const coachH = this.cardWindowEl.offsetHeight || 116;
      const topZoneBottom = 10 + coachH;
      const bottomZoneTop = vpH - 10 - coachH;
      const overlapsTop = r.top < topZoneBottom + 6;
      const overlapsBottom = r.bottom > bottomZoneTop - 6;

      if (overlapsTop && !overlapsBottom) {
        preferredDock = 'bottom';
      } else if (overlapsBottom && !overlapsTop) {
        preferredDock = 'top';
      } else if (overlapsTop && overlapsBottom) {
        const targetCenterY = r.top + r.height / 2;
        preferredDock = targetCenterY < vpH / 2 ? 'bottom' : 'top';
      }
    } else {
      this.domSpotlightEl.hidden = true;
    }

    this.backdropEl.dataset.coachDock = preferredDock;
    this.cardWindowEl.dataset.coachDock = preferredDock;
  }

  private renderVisualChip(chip: TutorialVisualChip): HTMLElement {
    if (chip.kind === 'type' && chip.pokemonType) {
      const pill = document.createElement('span');
      pill.className = 'pmd-tutorial-chip is-type';
      pill.appendChild(createColoredTypeSpan(chip.pokemonType));
      return pill;
    }

    if (chip.kind === 'item' && chip.itemId) {
      const pill = document.createElement('span');
      pill.className = 'pmd-tutorial-chip is-item';
      pill.appendChild(
        createMiniItemIcon(chip.itemId, {
          sizePx: 18,
          cropped: true,
          decorative: true,
        })
      );
      if (chip.label) {
        const txt = document.createElement('span');
        txt.textContent = chip.label;
        pill.appendChild(txt);
      }
      return pill;
    }

    if (chip.kind === 'species' && chip.speciesId) {
      const pill = document.createElement('span');
      pill.className = 'pmd-tutorial-chip is-species';
      const sp = getSpeciesById(chip.speciesId);
      pill.appendChild(
        createMiniSpeciesPortrait(chip.speciesId, {
          sizePx: 20,
          emotion: 'Happy',
          title: chip.label ?? sp?.name ?? chip.speciesId,
        })
      );
      const txt = document.createElement('span');
      txt.textContent = chip.label ?? sp?.name ?? chip.speciesId;
      pill.appendChild(txt);
      return pill;
    }

    const badge = document.createElement('span');
    const toneClass = chip.tone ? ` is-${chip.tone}` : ' is-cyan';
    badge.className = `pmd-tutorial-chip is-badge${toneClass}`;
    badge.textContent = chip.label ?? '';
    return badge;
  }

  private renderActiveCardDom(): void {
    this.cardWindowEl.innerHTML = '';
    const topic = this.activeTopic;
    const beat = this.activeBeats[this.activeBeatIndex];
    if (!topic || !beat) return;

    const save = this.saveManager.getSave();
    const isInteractive = this.hasActiveInteractiveStep();
    const totalBeats = this.activeBeats.length;
    const isLastBeat = this.activeBeatIndex >= totalBeats - 1;
    const signal = this.abortController.signal;

    this.cardWindowEl.dataset.topicId = topic.id;
    this.cardWindowEl.dataset.beatId = beat.id;
    this.cardWindowEl.dataset.interactive = isInteractive ? 'true' : 'false';
    this.cardWindowEl.dataset.wimpodEmotion = beat.emotion;

    const layoutRow = document.createElement('div');
    layoutRow.className = 'pmd-wimpod-coach-row';

    // Left: Expressive Wimpod Portrait Slot
    const portraitSlot = document.createElement('div');
    portraitSlot.className = 'pmd-forecast-portrait-slot pmd-wimpod-portrait-slot';
    portraitSlot.dataset.testid = 'tutorial-wimpod-portrait-slot';
    portraitSlot.appendChild(this.coachPortraitView.canvas);
    void this.coachPortraitView.setPortrait({
      speciesIdOrAssetId: WIMPOD_PMD_ASSET_ID,
      emotion: beat.emotion,
    });
    layoutRow.appendChild(portraitSlot);

    // Center/Right: Speaker Header + Dialogue + Action Prompt / Navigation
    const contentCol = document.createElement('div');
    contentCol.className = 'pmd-wimpod-coach-main';

    const topBar = document.createElement('div');
    topBar.className = 'pmd-wimpod-coach-topbar';

    const speakerMeta = document.createElement('div');
    speakerMeta.className = 'pmd-wimpod-speaker-meta';

    const speakerName = document.createElement('span');
    speakerName.className = 'pmd-dialogue-nickname pmd-wimpod-speaker-name';
    speakerName.dataset.testid = 'tutorial-speaker-name';
    speakerName.textContent = 'Wimpod';
    speakerMeta.appendChild(speakerName);

    const topicPill = document.createElement('span');
    topicPill.className = 'pmd-tutorial-domain-pill is-fusion';
    topicPill.dataset.testid = 'tutorial-card-title';
    topicPill.textContent = topic.title;
    speakerMeta.appendChild(topicPill);

    if (totalBeats > 1) {
      const stepBadge = document.createElement('span');
      stepBadge.className = 'pmd-tutorial-step-badge';
      stepBadge.dataset.testid = 'tutorial-step-indicator';
      stepBadge.textContent = `${this.activeBeatIndex + 1} / ${totalBeats}`;
      speakerMeta.appendChild(stepBadge);
    }

    const skipLabel = this.returnToCompendiumOnClose ? 'Back' : 'Skip';
    const skipBtn = createPmdButton({
      label: skipLabel,
      className: 'pmd-tutorial-skip-btn',
      testId: 'tutorial-skip-btn',
      ariaLabel: this.returnToCompendiumOnClose ? 'Back to Ask Wimpod' : 'Skip Tutorial',
      onTap: () => {
        this.dismissActiveCard('cancel');
      },
      tapOptions: { signal, stopPropagation: true },
    });

    topBar.append(speakerMeta, skipBtn);
    contentCol.appendChild(topBar);

    // Spoken Wimpod Dialogue
    const formattedDialogue = interpolateWimpodText(beat.dialogue, save);
    const speechEl = document.createElement('p');
    speechEl.className = 'pmd-wimpod-speech-text';
    speechEl.dataset.testid = 'tutorial-dialogue-text';
    contentCol.appendChild(speechEl);

    // Bottom Strip: Chips + either Live Action Prompt OR Speech Advance Buttons
    const bottomStrip = document.createElement('div');
    bottomStrip.className = 'pmd-wimpod-bottom-strip';

    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'pmd-tutorial-chips';
    chipsWrap.dataset.testid = 'tutorial-chips-row';
    if (beat.chips && beat.chips.length > 0) {
      for (const chip of beat.chips) {
        chipsWrap.appendChild(this.renderVisualChip(chip));
      }
    }
    bottomStrip.appendChild(chipsWrap);

    const actionArea = document.createElement('div');
    actionArea.className = 'pmd-wimpod-actions';

    if (isInteractive) {
      const hintPill = document.createElement('div');
      hintPill.className = 'pmd-wimpod-action-prompt';
      hintPill.dataset.testid = 'tutorial-action-prompt';
      hintPill.dataset.awaitAction = beat.awaitAction ?? '';
      const rawHint = beat.actionHint ?? 'Try it now!';
      hintPill.textContent = `▶ ${interpolateWimpodText(rawHint, save)}`;
      actionArea.appendChild(hintPill);
    } else {
      if (this.returnToCompendiumOnClose && totalBeats > 1 && this.activeBeatIndex > 0) {
        const prevBtn = createPmdButton({
          label: '◀ Prev',
          className: 'pmd-tutorial-nav-btn is-compact',
          testId: 'tutorial-prev-btn',
          onTap: () => {
            if (this.activeBeatIndex <= 0) return;
            this.activeBeatIndex -= 1;
            this.syncActiveBeatInteractivity();
            this.audioManager.playSfx('cursor');
            this.renderActiveCardDom();
          },
          tapOptions: { signal, stopPropagation: true },
        });
        actionArea.appendChild(prevBtn);
      }

      const primaryLabel = isLastBeat
        ? this.returnToCompendiumOnClose
          ? 'Done'
          : 'Got It!'
        : 'Next ▼';

      const nextBtn = createPmdButton({
        label: primaryLabel,
        variant: 'primary',
        className: 'pmd-tutorial-nav-btn is-primary is-compact',
        testId: 'tutorial-next-btn',
        onTap: () => {
          this.handleCoachAdvanceTap();
        },
        tapOptions: { signal, stopPropagation: true },
      });
      actionArea.appendChild(nextBtn);
    }

    bottomStrip.appendChild(actionArea);
    contentCol.appendChild(bottomStrip);
    layoutRow.appendChild(contentCol);

    this.cardWindowEl.appendChild(layoutRow);
    this.startBeatTypewriter(speechEl, formattedDialogue);
    this.syncSpotlightAndDock();
  }

  private renderCompendiumDom(): void {
    this.compendiumWindowEl.innerHTML = '';
    const signal = this.abortController.signal;
    const unlockedSet = new Set(this.saveManager.getUnlockedTutorialIds());
    const unlockedTopics = TUTORIAL_TOPICS.filter((t) => unlockedSet.has(t.id));

    const headerEl = document.createElement('div');
    headerEl.className = 'pmd-tutorial-header pmd-wimpod-compendium-header';

    const heroLeft = document.createElement('div');
    heroLeft.className = 'pmd-wimpod-compendium-hero';

    const portraitBox = document.createElement('div');
    portraitBox.className = 'pmd-forecast-portrait-slot pmd-wimpod-compendium-portrait';
    portraitBox.appendChild(this.compendiumPortraitView.canvas);
    void this.compendiumPortraitView.setPortrait({
      speciesIdOrAssetId: WIMPOD_PMD_ASSET_ID,
      emotion: unlockedTopics.length > 0 ? 'Happy' : 'Worried',
    });

    const titleCol = document.createElement('div');
    titleCol.className = 'pmd-tutorial-title-col';

    const metaRow = document.createElement('div');
    metaRow.className = 'pmd-tutorial-meta-row';

    const countBadge = document.createElement('span');
    countBadge.className = 'pmd-tutorial-step-badge';
    countBadge.dataset.testid = 'tutorial-compendium-count';
    countBadge.textContent = `${unlockedTopics.length} Notes`;
    metaRow.appendChild(countBadge);

    const titleEl = document.createElement('h3');
    titleEl.className = 'pmd-tutorial-title';
    titleEl.textContent = "Ask Wimpod — Survival Notes";

    const subQuote = document.createElement('span');
    subQuote.className = 'pmd-wimpod-compendium-quote';
    subQuote.textContent =
      '“Psst! Forget how something works? Read my cowardly notes before an enemy spots us!”';

    titleCol.append(metaRow, titleEl, subQuote);
    heroLeft.append(portraitBox, titleCol);
    headerEl.appendChild(heroLeft);

    const closeBtn = createPmdButton({
      label: 'Close',
      className: 'pmd-tutorial-skip-btn',
      testId: 'tutorial-compendium-close-btn',
      onTap: () => {
        this.closeAll('cancel');
      },
      tapOptions: { signal },
    });
    headerEl.appendChild(closeBtn);
    this.compendiumWindowEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'pmd-tutorial-compendium-body';

    if (unlockedTopics.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'pmd-tutorial-empty-note';
      emptyEl.dataset.testid = 'tutorial-compendium-empty';
      emptyEl.textContent =
        'Wimpod hasn’t scribbled any survival notes yet—new notes unlock automatically as you encounter each mechanic!';
      bodyEl.appendChild(emptyEl);
    } else {
      for (const category of TUTORIAL_CATEGORY_ORDER) {
        const catTopics = unlockedTopics.filter((t) => t.category === category);
        if (catTopics.length === 0) continue;

        const sectionEl = document.createElement('div');
        sectionEl.className = 'pmd-tutorial-cat-section';

        const catTitle = document.createElement('div');
        catTitle.className = 'pmd-tutorial-cat-heading';
        catTitle.textContent = TUTORIAL_CATEGORY_LABELS[category];
        sectionEl.appendChild(catTitle);

        const listEl = document.createElement('div');
        listEl.className = 'pmd-menu-list pmd-tutorial-topic-list';

        for (const topic of catTopics) {
          const rowBtn = createPmdButton({
            label: '',
            menuRow: true,
            className: 'pmd-tutorial-topic-row',
            testId: `tutorial-guide-topic-${topic.id}`,
            ariaLabel: `Ask Wimpod about ${topic.title}`,
            onTap: () => {
              this.openTopicFromCompendium(topic.id);
            },
            tapOptions: { signal },
          });

          const rowName = document.createElement('span');
          rowName.className = 'pmd-tutorial-topic-row-title';
          rowName.textContent = topic.title;

          const rowSummary = document.createElement('span');
          rowSummary.className = 'pmd-tutorial-topic-row-sub';
          rowSummary.textContent = topic.summary;

          rowBtn.append(rowName, rowSummary);
          listEl.appendChild(rowBtn);
        }

        sectionEl.appendChild(listEl);
        bodyEl.appendChild(sectionEl);
      }
    }

    this.compendiumWindowEl.appendChild(bodyEl);
  }

  /**
   * Builds the streamlined, pointer-only **Wimpod Tutorials: On / Off + Ask Wimpod** control block
   * mounted inside both Overworld `Menu -> System` and Dungeon `Field Menu -> Settings`.
   */
  public renderTutorialSettingsControl(
    options?: RenderTutorialSettingsControlOptions
  ): HTMLElement {
    const signal = options?.signal ?? this.abortController.signal;
    const hasSave = Boolean(this.saveManager.getSave());
    const enabled = hasSave ? this.saveManager.areTutorialsEnabled() : true;
    const unlockedCount = this.saveManager.getUnlockedTutorialIds().length;

    const wrap = document.createElement('div');
    wrap.className = 'pmd-tutorial-settings-block';
    wrap.dataset.testid = 'tutorial-settings-panel';

    const prefRow = document.createElement('div');
    prefRow.className = 'pmd-tutorial-pref-row';

    const lbl = document.createElement('span');
    lbl.className = 'pmd-tutorial-pref-label';
    lbl.textContent = "Wimpod's Tutorials";

    const chipGroup = document.createElement('div');
    chipGroup.className = 'pmd-tutorial-pref-chips';

    const onBtn = createPmdButton({
      label: 'On',
      variant: enabled ? 'primary' : 'default',
      className: `pmd-tutorial-pref-chip${enabled ? ' is-active' : ''}`,
      testId: 'tutorial-toggle-on',
      ariaLabel: "Wimpod's Tutorials: On",
      onTap: () => {
        if (!this.saveManager.getSave()) return;
        this.audioManager.playSfx('select');
        this.saveManager.setTutorialsEnabled(true);
        syncToggleUi(true);
        options?.onAfterChange?.();
      },
      tapOptions: { signal },
    });

    const offBtn = createPmdButton({
      label: 'Off',
      variant: !enabled ? 'primary' : 'default',
      className: `pmd-tutorial-pref-chip${!enabled ? ' is-active' : ''}`,
      testId: 'tutorial-toggle-off',
      ariaLabel: "Wimpod's Tutorials: Off",
      onTap: () => {
        if (!this.saveManager.getSave()) return;
        this.audioManager.playSfx('select');
        this.saveManager.setTutorialsEnabled(false);
        syncToggleUi(false);
        options?.onAfterChange?.();
      },
      tapOptions: { signal },
    });

    const syncToggleUi = (isOn: boolean) => {
      onBtn.classList.toggle('is-active', isOn);
      onBtn.classList.toggle('pmd-btn-primary', isOn);
      onBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');

      offBtn.classList.toggle('is-active', !isOn);
      offBtn.classList.toggle('pmd-btn-primary', !isOn);
      offBtn.setAttribute('aria-pressed', !isOn ? 'true' : 'false');
    };

    onBtn.disabled = !hasSave;
    offBtn.disabled = !hasSave;
    syncToggleUi(enabled);

    chipGroup.append(onBtn, offBtn);
    prefRow.append(lbl, chipGroup);
    wrap.appendChild(prefRow);

    const footerRow = document.createElement('div');
    footerRow.className = 'pmd-tutorial-settings-actions';

    const noteEl = document.createElement('span');
    noteEl.className = 'pmd-tutorial-settings-note';
    noteEl.textContent = hasSave
      ? 'Wimpod coaches new mechanics from cover.'
      : 'Start a campaign save to customize tutorials.';

    const guideBtn = createPmdButton({
      label: `Ask Wimpod (${unlockedCount})`,
      className: 'pmd-tutorial-open-guide-btn',
      testId: 'btn-open-tutorial-guide',
      onTap: () => {
        options?.onOpenCompendium?.();
        this.openCompendiumModal();
      },
      tapOptions: { signal },
    });
    guideBtn.disabled = !hasSave;

    footerRow.append(noteEl, guideBtn);
    wrap.appendChild(footerRow);

    return wrap;
  }

  public destroy(): void {
    this.closeAll(null);
    if (this.nudgeTimer !== null) {
      window.clearTimeout(this.nudgeTimer);
      this.nudgeTimer = null;
    }
    this.abortController.abort();
    this.backdropEl.remove();
  }
}
