/**
 * Contextual PMD Tutorial Card Overlay & Progressive Guide Compendium (`TutorialOverlay.ts`)
 *
 * Strictly enforces:
 * - Rule 2: 100% Unified Pointer Events (`bindPointerTap` + `bindBackGestureSurface`), ZERO keyboard
 *   listeners, `>= 44x44px` interactive targets, and zero-clipping layouts across `1920x1080`,
 *   `390x844`, and `844x390`.
 * - Rule 3: Authentic PMD: Explorers of Sky solid `#204868` stepped 9-slice frames, `#F8F800`
 *   yellow headers, `#58F858` callouts, colored elemental types, mini item icons, and mini portraits.
 * - Rule 7: Persists `seenTutorialIds`, `unlockedTutorialIds`, and mid-run preference edits via
 *   `SaveStateManager` (`localStorage` + Cloud Firestore).
 */

import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { getSpeciesById } from '../data/index';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_CATEGORY_ORDER,
  TUTORIAL_TOPICS,
  getTutorialTopicById,
  resolveSlidesForTutorialTopic,
  type ResolvedTutorialSlide,
  type TutorialTopicDefinition,
  type TutorialVisualChip,
} from '../data/tutorialRegistry';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { TutorialDetailLevel } from '../types/schemas';
import { createMiniItemIcon } from './PmdItemIconGrid';
import { createMiniSpeciesPortrait } from './PmdUnitPortraitGrid';
import { createPmdButton, createPmdWindow } from './PmdWindow';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';
import { createColoredTypeSpan } from './typeColors';

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

export class TutorialOverlay {
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onLayerStateChanged?: () => void;
  private readonly abortController = new AbortController();

  private readonly backdropEl: HTMLElement;
  private readonly cardWindowEl: HTMLElement;
  private readonly compendiumWindowEl: HTMLElement;

  private mode: ActiveModalMode = 'closed';
  private activeTopic: TutorialTopicDefinition | null = null;
  private activeSlides: ResolvedTutorialSlide[] = [];
  private activeSlideIndex = 0;
  private returnToCompendiumOnClose = false;
  private activeCardResolver: ((shown: boolean) => void) | null = null;

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

    this.cardWindowEl = createPmdWindow({
      className: 'pmd-tutorial-card',
      testId: 'tutorial-card-modal',
      role: 'dialog',
      ariaLabel: 'Gameplay Tutorial',
    });
    this.cardWindowEl.hidden = true;

    this.compendiumWindowEl = createPmdWindow({
      className: 'pmd-tutorial-compendium',
      testId: 'tutorial-compendium-modal',
      role: 'dialog',
      ariaLabel: 'Tutorials and Gameplay Guide',
    });
    this.compendiumWindowEl.hidden = true;

    this.backdropEl.append(this.cardWindowEl, this.compendiumWindowEl);
    options.parent.appendChild(this.backdropEl);

    const signal = this.abortController.signal;

    // Tapping outside the window advances/closes cleanly
    bindPointerTap(
      this.backdropEl,
      (ev: PointerEvent) => {
        if (ev.target !== this.backdropEl) return;
        this.handleBack();
      },
      { signal }
    );

    // PC Right-Click (`contextmenu`) & Mobile Touch Long-Press (`520ms`) parity
    bindBackGestureSurface(
      this.backdropEl,
      () => {
        this.handleBack();
      },
      { signal }
    );

    // Prevent gestures handled by the tutorial overlay from bubbling to `viewportEl`'s global back surface
    this.backdropEl.addEventListener(
      'contextmenu',
      (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      },
      { signal }
    );
    this.backdropEl.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        ev.stopPropagation();
      },
      { signal }
    );
  }

  public isOpen(): boolean {
    return this.mode !== 'closed' && !this.backdropEl.hidden;
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

  /**
   * Unlocks `topicId` in the progressive Guide and, if not yet seen by the player, resolves slides
   * tailored to `save.campaign.tutorialPreferences` and displays the contextual Tutorial Card.
   *
   * Returns `true` if an interactive modal card was displayed, or `false` if skipped/already seen.
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
    if (!topic) {
      return false;
    }

    // Always unlock reached topics so players can browse them in the progressive Guide
    this.saveManager.unlockTutorial(topic.id);

    // Raw DevTools-seeded saves that bypassed `QuizScene` have no `tutorialPreferences` until set
    if (!save.campaign.tutorialPreferences) {
      return false;
    }

    if (this.saveManager.hasSeenTutorial(topic.id)) {
      return false;
    }

    const prefs = this.saveManager.getTutorialPreferences();
    const slides = resolveSlidesForTutorialTopic(topic.id, prefs, {
      compendiumFullView: false,
    });

    if (slides.length === 0) {
      this.saveManager.markTutorialSeen(topic.id);
      return false;
    }

    if ((this.fastMode || sceneFastMode) && !this.pauseInFastMode) {
      this.saveManager.markTutorialSeen(topic.id);
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.activeTopic = topic;
      this.activeSlides = slides;
      this.activeSlideIndex = 0;
      this.returnToCompendiumOnClose = false;
      this.activeCardResolver = resolve;
      this.mode = 'card';

      this.compendiumWindowEl.hidden = true;
      this.cardWindowEl.hidden = false;
      this.backdropEl.hidden = false;
      this.renderActiveCardDom();
      this.audioManager.playSfx('menu_open');
      this.onLayerStateChanged?.();
    });
  }

  /**
   * Opens the progressive, spoiler-free **Tutorials / Guide** compendium listing all topics
   * reached so far in the current campaign save.
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

    this.activeTopic = null;
    this.activeSlides = [];
    this.activeSlideIndex = 0;
    this.returnToCompendiumOnClose = false;
    this.mode = 'compendium';

    this.cardWindowEl.hidden = true;
    this.compendiumWindowEl.hidden = false;
    this.backdropEl.hidden = false;
    this.renderCompendiumDom();
    this.audioManager.playSfx('menu_open');
    this.onLayerStateChanged?.();
  }

  /**
   * Opens a specific unlocked topic from the Guide Compendium (using `compendiumFullView: true`
   * so even `'none'` series preferences show concise explanations when manually requested).
   */
  public openTopicFromCompendium(topicId: string): void {
    const topic = getTutorialTopicById(topicId);
    if (!topic) return;

    const prefs = this.saveManager.getTutorialPreferences();
    const slides = resolveSlidesForTutorialTopic(topic.id, prefs, {
      compendiumFullView: true,
    });
    if (slides.length === 0) return;

    if (this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(topic.id);
    }

    this.activeTopic = topic;
    this.activeSlides = slides;
    this.activeSlideIndex = 0;
    this.returnToCompendiumOnClose = true;
    this.mode = 'card';

    this.compendiumWindowEl.hidden = true;
    this.cardWindowEl.hidden = false;
    this.backdropEl.hidden = false;
    this.renderActiveCardDom();
    this.audioManager.playSfx('select');
    this.onLayerStateChanged?.();
  }

  public handleBack(): boolean {
    if (!this.isOpen()) return false;

    if (this.mode === 'card') {
      if (this.activeSlideIndex > 0) {
        this.activeSlideIndex -= 1;
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
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;
    this.activeTopic = null;
    this.activeSlides = [];
    this.activeSlideIndex = 0;
    this.returnToCompendiumOnClose = false;
    this.mode = 'closed';

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

  private dismissActiveCard(sfx: 'cancel' | 'confirm'): void {
    if (this.activeTopic && this.saveManager.getSave()) {
      this.saveManager.markTutorialSeen(this.activeTopic.id);
    }
    const resolver = this.activeCardResolver;
    this.activeCardResolver = null;

    if (this.returnToCompendiumOnClose) {
      this.activeTopic = null;
      this.activeSlides = [];
      this.activeSlideIndex = 0;
      this.returnToCompendiumOnClose = false;
      this.mode = 'compendium';
      this.cardWindowEl.hidden = true;
      this.compendiumWindowEl.hidden = false;
      this.renderCompendiumDom();
      this.audioManager.playSfx(sfx);
      this.onLayerStateChanged?.();
      if (resolver) resolver(true);
      return;
    }

    this.activeTopic = null;
    this.activeSlides = [];
    this.activeSlideIndex = 0;
    this.mode = 'closed';
    this.cardWindowEl.hidden = true;
    this.compendiumWindowEl.hidden = true;
    this.backdropEl.hidden = true;
    this.audioManager.playSfx(sfx);
    this.onLayerStateChanged?.();
    if (resolver) {
      resolver(true);
    }
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
          sizePx: 20,
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
          sizePx: 22,
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
    const slide = this.activeSlides[this.activeSlideIndex];
    if (!topic || !slide) return;

    this.cardWindowEl.dataset.topicId = topic.id;
    this.cardWindowEl.dataset.slideDomain = slide.domain;

    const totalSlides = this.activeSlides.length;
    const isLastSlide = this.activeSlideIndex >= totalSlides - 1;
    const signal = this.abortController.signal;

    // Header bar
    const headerEl = document.createElement('div');
    headerEl.className = 'pmd-tutorial-header';

    const titleCol = document.createElement('div');
    titleCol.className = 'pmd-tutorial-title-col';

    const metaRow = document.createElement('div');
    metaRow.className = 'pmd-tutorial-meta-row';

    const domainPill = document.createElement('span');
    domainPill.className = `pmd-tutorial-domain-pill is-${slide.domain}`;
    domainPill.dataset.testid = 'tutorial-domain-badge';
    domainPill.textContent = slide.domainLabel;
    metaRow.appendChild(domainPill);

    if (totalSlides > 1) {
      const stepBadge = document.createElement('span');
      stepBadge.className = 'pmd-tutorial-step-badge';
      stepBadge.dataset.testid = 'tutorial-step-indicator';
      stepBadge.textContent = `${this.activeSlideIndex + 1} / ${totalSlides}`;
      metaRow.appendChild(stepBadge);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'pmd-tutorial-title';
    titleEl.dataset.testid = 'tutorial-card-title';
    titleEl.textContent = topic.title;

    titleCol.append(metaRow, titleEl);
    headerEl.appendChild(titleCol);

    const skipBtn = createPmdButton({
      label: this.returnToCompendiumOnClose ? 'Back' : totalSlides > 1 ? 'Skip' : 'Close',
      className: 'pmd-tutorial-skip-btn',
      testId: 'tutorial-skip-btn',
      ariaLabel: this.returnToCompendiumOnClose ? 'Back to Guide' : 'Skip Tutorial',
      onTap: () => {
        this.dismissActiveCard('cancel');
      },
      tapOptions: { signal },
    });
    headerEl.appendChild(skipBtn);
    this.cardWindowEl.appendChild(headerEl);

    // Scroll-safe body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'pmd-tutorial-body';

    const subheadingEl = document.createElement('div');
    subheadingEl.className = 'pmd-tutorial-subheading';
    subheadingEl.dataset.testid = 'tutorial-slide-heading';
    subheadingEl.textContent = slide.heading;
    bodyEl.appendChild(subheadingEl);

    if (slide.chips && slide.chips.length > 0) {
      const chipsRow = document.createElement('div');
      chipsRow.className = 'pmd-tutorial-chips';
      chipsRow.dataset.testid = 'tutorial-chips-row';
      for (const chip of slide.chips) {
        chipsRow.appendChild(this.renderVisualChip(chip));
      }
      bodyEl.appendChild(chipsRow);
    }

    const listEl = document.createElement('ul');
    listEl.className = 'pmd-tutorial-bullets';
    listEl.dataset.testid = 'tutorial-bullets-list';
    for (const bullet of slide.bullets) {
      const li = document.createElement('li');
      li.textContent = bullet;
      listEl.appendChild(li);
    }
    bodyEl.appendChild(listEl);

    if (slide.callout) {
      const calloutEl = document.createElement('div');
      calloutEl.className = 'pmd-tutorial-callout';
      calloutEl.dataset.testid = 'tutorial-slide-callout';
      calloutEl.textContent = slide.callout;
      bodyEl.appendChild(calloutEl);
    }

    this.cardWindowEl.appendChild(bodyEl);

    // Footer navigation
    const footerEl = document.createElement('div');
    footerEl.className = 'pmd-tutorial-footer';

    if (totalSlides > 1) {
      const prevBtn = createPmdButton({
        label: '◀ Prev',
        className: 'pmd-tutorial-nav-btn',
        testId: 'tutorial-prev-btn',
        onTap: () => {
          if (this.activeSlideIndex <= 0) return;
          this.activeSlideIndex -= 1;
          this.audioManager.playSfx('cursor');
          this.renderActiveCardDom();
        },
        tapOptions: { signal },
      });
      prevBtn.disabled = this.activeSlideIndex === 0;
      footerEl.appendChild(prevBtn);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'pmd-tutorial-footer-hint';
      spacer.textContent = 'Guide available in System / Settings';
      footerEl.appendChild(spacer);
    }

    const primaryLabel = isLastSlide
      ? this.returnToCompendiumOnClose
        ? 'Done'
        : 'Got It!'
      : 'Next ▶';

    const nextBtn = createPmdButton({
      label: primaryLabel,
      variant: 'primary',
      className: 'pmd-tutorial-nav-btn is-primary',
      testId: 'tutorial-next-btn',
      onTap: () => {
        if (!isLastSlide) {
          this.activeSlideIndex += 1;
          this.audioManager.playSfx('select');
          this.renderActiveCardDom();
          return;
        }
        this.dismissActiveCard('confirm');
      },
      tapOptions: { signal },
    });
    footerEl.appendChild(nextBtn);

    this.cardWindowEl.appendChild(footerEl);
  }

  private renderCompendiumDom(): void {
    this.compendiumWindowEl.innerHTML = '';
    const signal = this.abortController.signal;
    const unlockedSet = new Set(this.saveManager.getUnlockedTutorialIds());
    const unlockedTopics = TUTORIAL_TOPICS.filter((t) => unlockedSet.has(t.id));

    const headerEl = document.createElement('div');
    headerEl.className = 'pmd-tutorial-header';

    const titleCol = document.createElement('div');
    titleCol.className = 'pmd-tutorial-title-col';

    const metaRow = document.createElement('div');
    metaRow.className = 'pmd-tutorial-meta-row';

    const countBadge = document.createElement('span');
    countBadge.className = 'pmd-tutorial-step-badge';
    countBadge.dataset.testid = 'tutorial-compendium-count';
    countBadge.textContent = `${unlockedTopics.length} Unlocked`;
    metaRow.appendChild(countBadge);

    const titleEl = document.createElement('h3');
    titleEl.className = 'pmd-tutorial-title';
    titleEl.textContent = 'Tutorials & Tactical Guide';

    titleCol.append(metaRow, titleEl);
    headerEl.appendChild(titleCol);

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
        'No guide entries unlocked yet—new entries appear automatically as you encounter each mechanic!';
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
            ariaLabel: `Read tutorial: ${topic.title}`,
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
   * Builds a compact, pointer-only Tutorial Preferences + Guide CTA block for mounting inside
   * both Overworld `Menu -> System` and Dungeon `Field Menu -> Settings`.
   */
  public renderTutorialSettingsControl(
    options?: RenderTutorialSettingsControlOptions
  ): HTMLElement {
    const signal = options?.signal ?? this.abortController.signal;
    const hasSave = Boolean(this.saveManager.getSave());
    const prefs = this.saveManager.getTutorialPreferences();
    const unlockedCount = this.saveManager.getUnlockedTutorialIds().length;

    const wrap = document.createElement('div');
    wrap.className = 'pmd-tutorial-settings-block';
    wrap.dataset.testid = 'tutorial-settings-panel';

    const levels: ReadonlyArray<{ id: TutorialDetailLevel; label: string }> = [
      { id: 'none', label: 'None' },
      { id: 'brief', label: 'Brief' },
      { id: 'detailed', label: 'Detailed' },
    ];

    const buildSubjectRow = (
      subject: 'pokemon' | 'fire_emblem',
      labelText: string,
      testPrefix: 'pokemon' | 'fe',
      activeDetail: TutorialDetailLevel
    ): HTMLElement => {
      const row = document.createElement('div');
      row.className = 'pmd-tutorial-pref-row';

      const lbl = document.createElement('span');
      lbl.className = 'pmd-tutorial-pref-label';
      lbl.textContent = labelText;

      const chipGroup = document.createElement('div');
      chipGroup.className = 'pmd-tutorial-pref-chips';

      const buttons: HTMLButtonElement[] = [];

      for (const lv of levels) {
        const btn = createPmdButton({
          label: lv.label,
          variant: activeDetail === lv.id ? 'primary' : 'default',
          className: `pmd-tutorial-pref-chip${activeDetail === lv.id ? ' is-active' : ''}`,
          testId: `tutorial-pref-${testPrefix}-${lv.id}`,
          ariaLabel: `${labelText}: ${lv.label}`,
          onTap: () => {
            if (!this.saveManager.getSave()) return;
            this.audioManager.playSfx('select');
            this.saveManager.setTutorialDetailLevel(subject, lv.id);
            for (const b of buttons) {
              const match = b.dataset.detailLevel === lv.id;
              b.classList.toggle('is-active', match);
              b.classList.toggle('pmd-btn-primary', match);
              b.setAttribute('aria-pressed', match ? 'true' : 'false');
            }
            options?.onAfterChange?.();
          },
          tapOptions: { signal },
        });
        btn.dataset.detailLevel = lv.id;
        btn.disabled = !hasSave;
        btn.setAttribute('aria-pressed', activeDetail === lv.id ? 'true' : 'false');
        buttons.push(btn);
        chipGroup.appendChild(btn);
      }

      row.append(lbl, chipGroup);
      return row;
    };

    wrap.appendChild(
      buildSubjectRow('pokemon', 'Pokémon Tips', 'pokemon', prefs.pokemonTutorialDetail)
    );
    wrap.appendChild(
      buildSubjectRow('fire_emblem', 'Fire Emblem Tips', 'fe', prefs.fireEmblemTutorialDetail)
    );

    const footerRow = document.createElement('div');
    footerRow.className = 'pmd-tutorial-settings-actions';

    const noteEl = document.createElement('span');
    noteEl.className = 'pmd-tutorial-settings-note';
    noteEl.textContent = hasSave
      ? 'Core Mystery Emblem twists always show briefly.'
      : 'Start a campaign save to customize tutorials.';

    const guideBtn = createPmdButton({
      label: `Tutorials / Guide (${unlockedCount})`,
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
    this.abortController.abort();
    this.backdropEl.remove();
  }
}
