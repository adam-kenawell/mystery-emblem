/**
 * Mystery Emblem — Act 1 Demo Ending Credits Scroll (`CreditsScene.ts`)
 *
 * Authentic PMD: Explorers of Sky + Fire Emblem Ending Credits sequence:
 * - Plays `#075 Ending Theme Intro` (`ending_theme_intro`) and seamlessly chains into looping
 *   `#076 Ending Theme` (`ending_theme`)
 * - Crisp `1x` native pixel-art starry twilight & rising golden Dragon Aura ember canvas
 *   (`imageSmoothingEnabled = false` + `image-rendering: pixelated`)
 * - Live walking `PmdSpriteActor` cast showcase honoring the player's actual nicknamed/evolved
 *   roster (preserving Flabébé/Floette/Florges flower colors), plus Wimpod (`0767`),
 *   Chancellor Serperior (`0497`), High Seeress Milotic (`0350`), and Kecleon (`0352`)
 * - Credits Creator Adam Kenawell, PMDCollab/SpriteCollab artists, and PMD EoS / Fire Emblem inspirations
 * - 100% Unified Pointer Event driven (`pointerdown` / `pointerup` / `pointercancel` ONLY; ZERO keyboard listeners)
 */

import {
  WIMPOD_PMD_ASSET_ID,
  resolveUnitVisualAssetId,
} from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
} from '../data/campaignRegistry';
import { getSpeciesById } from '../data/index';
import { KECLEON_PMD_ASSET_ID } from '../data/overworldMapData';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { OwnedPokemonInstance, SaveData } from '../types/schemas';
import { PmdSpriteActor } from '../ui/PmdSpriteCanvas';
import { createPmdButton, createPmdWindow } from '../ui/PmdWindow';

export type CreditsFinishReason = 'completed' | 'skipped' | 'cancelled';

export interface CreditsSceneOptions {
  viewportEl: HTMLElement;
  saveManager: SaveStateManager;
  audioManager?: AudioManager;
  onStateChange?: () => void;
}

export interface CreditsSceneSnapshot {
  isOpen: boolean;
  scrollY: number;
  maxScrollY: number;
  reachedEnd: boolean;
  fastScrolling: boolean;
  castCardCount: number;
  bgmTrackId: string | null;
}

interface StarParticle {
  xFrac: number;
  yFrac: number;
  phase: number;
  size: 1 | 2;
  warm: boolean;
}

interface EmberParticle {
  xFrac: number;
  yFrac: number;
  speedY: number;
  driftX: number;
  phase: number;
}

const BASE_SCROLL_PX_PER_SEC = 46;
const FAST_SCROLL_MULTIPLIER = 3.8;

export class CreditsScene {
  public readonly rootEl: HTMLElement;
  private readonly backdropCanvas: HTMLCanvasElement;
  private readonly backdropCtx: CanvasRenderingContext2D;
  private readonly scrollViewportEl: HTMLElement;
  private readonly scrollTrackEl: HTMLElement;
  private readonly skipBtn: HTMLButtonElement;
  private readonly holdHintEl: HTMLElement;

  private readonly viewportEl: HTMLElement;
  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;

  private readonly stars: StarParticle[] = [];
  private readonly embers: EmberParticle[] = [];
  private activeSpriteActors: PmdSpriteActor[] = [];

  private openState = false;
  private fastMode = false;
  private pointerFastHolding = false;
  private activeHoldPointerId: number | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private reachedEnd = false;
  private animClockMs = 0;
  private lastRafMs = 0;
  private rafId: number | null = null;
  private finishResolver: ((reason: CreditsFinishReason) => void) | null = null;
  private audioUnsub: (() => void) | null = null;
  private introFallbackTimer: number | null = null;
  private previousTrackId: string | null = null;
  private readonly abortController = new AbortController();

  constructor(options: CreditsSceneOptions) {
    this.viewportEl = options.viewportEl;
    this.saveManager = options.saveManager;
    this.audioManager = options.audioManager ?? getAudioManager();
    this.onStateChange = options.onStateChange;

    for (let i = 0; i < 48; i++) {
      this.stars.push({
        xFrac: ((i * 67 + 13) % 100) / 100,
        yFrac: ((i * 37 + 7) % 78) / 100,
        phase: i * 0.71,
        size: i % 5 === 0 ? 2 : 1,
        warm: i % 4 === 0,
      });
    }
    for (let i = 0; i < 20; i++) {
      this.embers.push({
        xFrac: ((i * 53 + 29) % 100) / 100,
        yFrac: ((i * 43 + 17) % 100) / 100,
        speedY: 0.025 + (i % 4) * 0.008,
        driftX: ((i % 5) - 2) * 0.007,
        phase: i * 1.1,
      });
    }

    this.rootEl = document.createElement('section');
    this.rootEl.id = 'pmd-credits-scene';
    this.rootEl.className = 'pmd-credits-scene';
    this.rootEl.dataset.testid = 'credits-scene';
    this.rootEl.dataset.noLongpress = 'true';
    this.rootEl.hidden = true;

    this.backdropCanvas = document.createElement('canvas');
    this.backdropCanvas.className = 'pmd-credits-backdrop-canvas pmd-pixelated';
    this.backdropCanvas.dataset.testid = 'credits-backdrop-canvas';
    const ctx = this.backdropCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for CreditsScene.');
    }
    ctx.imageSmoothingEnabled = false;
    this.backdropCtx = ctx;

    this.scrollViewportEl = document.createElement('div');
    this.scrollViewportEl.className = 'pmd-credits-scroll-viewport';
    this.scrollViewportEl.dataset.testid = 'credits-scroll-viewport';

    this.scrollTrackEl = document.createElement('div');
    this.scrollTrackEl.className = 'pmd-credits-scroll-track';
    this.scrollTrackEl.dataset.testid = 'credits-scroll-track';
    this.scrollViewportEl.appendChild(this.scrollTrackEl);

    const topControls = document.createElement('div');
    topControls.className = 'pmd-credits-top-bar';

    this.holdHintEl = document.createElement('div');
    this.holdHintEl.className = 'pmd-credits-hold-hint';
    this.holdHintEl.textContent = 'Hold screen to fast-scroll';

    this.skipBtn = createPmdButton({
      label: 'Skip ▶▶',
      variant: 'primary',
      className: 'pmd-credits-skip-btn',
      testId: 'credits-skip-btn',
      ariaLabel: 'Skip ending credits',
      onTap: () => {
        this.audioManager.playSfx('cancel');
        this.finish('skipped');
      },
      tapOptions: { signal: this.abortController.signal, stopPropagation: true },
    });

    topControls.append(this.holdHintEl, this.skipBtn);
    this.rootEl.append(this.backdropCanvas, this.scrollViewportEl, topControls);
    this.viewportEl.appendChild(this.rootEl);

    // Unified Pointer Events for press-and-hold fast-scroll (ZERO keyboard listeners!)
    const sig = this.abortController.signal;
    this.scrollViewportEl.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        if (!this.openState) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('button')) return;
        this.activeHoldPointerId = e.pointerId;
        this.pointerFastHolding = true;
      },
      { signal: sig }
    );
    const clearHold = (e: PointerEvent) => {
      if (this.activeHoldPointerId === null || e.pointerId === this.activeHoldPointerId) {
        this.activeHoldPointerId = null;
        this.pointerFastHolding = false;
      }
    };
    window.addEventListener('pointerup', clearHold, { signal: sig });
    window.addEventListener('pointercancel', clearHold, { signal: sig });
    window.addEventListener(
      'resize',
      () => {
        if (this.openState) {
          this.syncLayoutMetrics();
          this.renderBackdrop();
        }
      },
      { signal: sig }
    );
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public setFastMode(enabled: boolean): void {
    this.fastMode = Boolean(enabled);
  }

  public handleBack(): void {
    if (this.openState) {
      this.finish('skipped');
    }
  }

  public getSnapshot(): CreditsSceneSnapshot {
    return {
      isOpen: this.openState,
      scrollY: Math.round(this.scrollY),
      maxScrollY: Math.round(this.maxScrollY),
      reachedEnd: this.reachedEnd,
      fastScrolling: this.pointerFastHolding,
      castCardCount: this.activeSpriteActors.length,
      bgmTrackId: this.audioManager.getCurrentTrackId(),
    };
  }

  public advanceScrollForTest(deltaMs: number): void {
    if (!this.openState) return;
    this.stepSimulation(Math.max(0, deltaMs));
    this.renderBackdrop();
  }

  public scrollToEndForTest(): void {
    if (!this.openState) return;
    this.syncLayoutMetrics();
    this.scrollY = this.maxScrollY;
    this.reachedEnd = true;
    this.holdHintEl.hidden = true;
    this.applyScrollTransform();
    this.renderBackdrop();
  }

  public play(): Promise<CreditsFinishReason> {
    if (this.openState) {
      this.finish('cancelled');
    }

    this.previousTrackId = this.audioManager.getCurrentTrackId();
    this.openState = true;
    this.pointerFastHolding = false;
    this.activeHoldPointerId = null;
    this.scrollY = 0;
    this.reachedEnd = false;
    this.animClockMs = 0;
    this.holdHintEl.hidden = false;

    this.buildCreditsContent(this.saveManager.getSave());

    this.rootEl.hidden = false;
    this.viewportEl.classList.add('is-battle-active');
    this.onStateChange?.();

    this.syncLayoutMetrics();
    if (this.fastMode) {
      // In fastMode with reduced-motion tests, start near the bottom or scroll briskly,
      // while still starting at 0 so scroll motion can be asserted before reaching the end.
      this.scrollY = 0;
    }
    this.applyScrollTransform();
    this.renderBackdrop();

    this.startEndingMusicSequence();
    this.startLoop();

    return new Promise<CreditsFinishReason>((resolve) => {
      this.finishResolver = resolve;
    });
  }

  private startEndingMusicSequence(): void {
    this.cleanupAudioSequence();
    const introTrack = this.audioManager.playBgm('ending_theme_intro', {
      fadeMs: 260,
      restart: true,
      loop: false,
    });
    if (!introTrack) {
      this.audioManager.playBgm('ending_theme', { fadeMs: 260, loop: true });
      return;
    }

    let sawIntroPlaying = false;
    this.audioUnsub = this.audioManager.subscribe((snap) => {
      if (!this.openState) return;
      if (snap.currentTrack?.id === introTrack.id && snap.isPlaying) {
        sawIntroPlaying = true;
      } else if (
        sawIntroPlaying &&
        snap.currentTrack?.id === introTrack.id &&
        !snap.isPlaying &&
        !snap.settings.muted
      ) {
        this.cleanupAudioSequence();
        this.audioManager.playBgm('ending_theme', { fadeMs: 140, loop: true });
      }
    });

    // Fallback chain in case browser audio is muted/blocked during the intro track
    this.introFallbackTimer = window.setTimeout(() => {
      this.introFallbackTimer = null;
      if (this.openState && this.audioManager.getCurrentTrackId() === introTrack.id) {
        this.cleanupAudioSequence();
        this.audioManager.playBgm('ending_theme', { fadeMs: 220, loop: true });
      }
    }, 44_000);
  }

  private cleanupAudioSequence(): void {
    if (this.audioUnsub) {
      this.audioUnsub();
      this.audioUnsub = null;
    }
    if (this.introFallbackTimer !== null) {
      window.clearTimeout(this.introFallbackTimer);
      this.introFallbackTimer = null;
    }
  }

  private buildCreditsContent(save: SaveData | null): void {
    this.destroyCastActors();
    this.scrollTrackEl.innerHTML = '';

    // Lead-in spacer so the title rises smoothly from the lower third
    const leadSpacer = document.createElement('div');
    leadSpacer.className = 'pmd-credits-lead-spacer';
    this.scrollTrackEl.appendChild(leadSpacer);

    // 1. Opening Title Banner
    const heroBlock = document.createElement('header');
    heroBlock.className = 'pmd-credits-hero-block';
    heroBlock.innerHTML = `
      <div class="pmd-credits-eyebrow">POKÉMON MYSTERY DUNGEON × FIRE EMBLEM</div>
      <h1 class="pmd-credits-main-title">MYSTERY EMBLEM</h1>
      <div class="pmd-credits-act-subtitle">Act I — The Verdant Commonwealth</div>
      <div class="pmd-credits-divider" aria-hidden="true"></div>
    `;
    this.scrollTrackEl.appendChild(heroBlock);

    // 2. Live Walking Sprite Cast Showcase
    const castSection = document.createElement('section');
    castSection.className = 'pmd-credits-section';
    const castHeading = document.createElement('h2');
    castHeading.className = 'pmd-credits-section-heading';
    castHeading.textContent = 'HEROES OF THE VERDANT COMMONWEALTH';
    const castGrid = document.createElement('div');
    castGrid.className = 'pmd-credits-cast-list';
    castGrid.dataset.testid = 'credits-cast-list';

    const roster = save?.roster ?? [];
    roster.forEach((unit, idx) => {
      castGrid.appendChild(this.createUnitCastCard(unit, idx));
    });

    // Core non-combatant & Commonwealth leaders as live walking sprites!
    castGrid.appendChild(
      this.createNpcCastCard({
        id: 'wimpod',
        assetId: WIMPOD_PMD_ASSET_ID,
        name: 'Wimpod',
        subtitle: 'Tactical Coward & Hazard Scholar',
      })
    );
    castGrid.appendChild(
      this.createNpcCastCard({
        id: 'serperior',
        assetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
        name: 'Chancellor Serperior',
        subtitle: 'Co-Ruler of the Verdant Commonwealth',
      })
    );
    castGrid.appendChild(
      this.createNpcCastCard({
        id: 'milotic',
        assetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
        name: 'High Seeress Milotic',
        subtitle: 'Co-Ruler of the Verdant Commonwealth',
      })
    );
    castGrid.appendChild(
      this.createNpcCastCard({
        id: 'kecleon',
        assetId: KECLEON_PMD_ASSET_ID,
        name: 'Kecleon',
        subtitle: 'Master Traveling Merchant',
      })
    );

    castSection.append(castHeading, castGrid);
    this.scrollTrackEl.appendChild(castSection);

    // 3. Creator & Inspiration Credits
    this.scrollTrackEl.appendChild(
      this.createCreditBlock('CREATED, DESIGNED & DIRECTED BY', [
        { primary: 'Adam Kenawell', secondary: 'Creator · Game Design, Balance & Engineering', testId: 'credits-creator-name' },
      ])
    );

    this.scrollTrackEl.appendChild(
      this.createCreditBlock('SPRITE & PORTRAIT ARTISTRY', [
        {
          primary: 'PMDCollab & SpriteCollab Community Artists',
          secondary: '8-Directional Pokémon Sprites & Multi-Emotion Portraits',
        },
      ])
    );

    this.scrollTrackEl.appendChild(
      this.createCreditBlock('ORIGINAL SOUNDTRACK & VISUAL INSPIRATION', [
        {
          primary: 'Pokémon Mystery Dungeon: Explorers of Sky',
          secondary: 'Chunsoft · The Pokémon Company (Music by Arata Iiyoshi, Hideki Sakamoto & Team)',
        },
        {
          primary: 'Fire Emblem Awakening',
          secondary: 'Intelligent Systems · Nintendo',
        },
      ])
    );

    const disclaimerEl = document.createElement('p');
    disclaimerEl.className = 'pmd-credits-disclaimer';
    disclaimerEl.textContent =
      'Mystery Emblem is a free, non-commercial fan project. Pokémon and Fire Emblem are trademarks of Nintendo, Creatures Inc., GAME FREAK inc., Spike Chunsoft, and Intelligent Systems.';
    this.scrollTrackEl.appendChild(disclaimerEl);

    // 4. Final Framed End Card (`Thank You for Playing!`)
    const endWrap = document.createElement('div');
    endWrap.className = 'pmd-credits-end-wrap';

    const endCard = createPmdWindow({
      variant: 'gold',
      testId: 'credits-end-card',
      className: 'pmd-credits-end-card',
    });

    const endEyebrow = document.createElement('div');
    endEyebrow.className = 'pmd-credits-end-eyebrow';
    endEyebrow.textContent = 'DEMO COMPLETE';

    const thankTitle = document.createElement('h2');
    thankTitle.className = 'pmd-credits-thank-title';
    thankTitle.textContent = 'Thank You for Playing the Mystery Emblem Demo!';

    const act2Line = document.createElement('p');
    act2Line.className = 'pmd-credits-act2-teaser';
    act2Line.textContent =
      'Act II — Beyond the Commonwealth & Across the Five Kingdoms · Coming Soon!';

    const statsLine = document.createElement('div');
    statsLine.className = 'pmd-credits-run-summary';
    const clearedCount = save?.campaign.completedChapterIds.length ?? 5;
    statsLine.textContent = `Chapters Cleared: ${clearedCount} / 5  ·  Allies Recruited: ${Math.max(3, roster.length)}`;

    const finishBtn = createPmdButton({
      label: 'Return to World Map ▶',
      variant: 'primary',
      className: 'pmd-credits-finish-btn',
      testId: 'credits-finish-btn',
      onTap: () => {
        this.audioManager.playSfx('confirm');
        this.finish('completed');
      },
    });

    endCard.append(endEyebrow, thankTitle, act2Line, statsLine, finishBtn);
    endWrap.appendChild(endCard);
    this.scrollTrackEl.appendChild(endWrap);
  }

  private createUnitCastCard(unit: OwnedPokemonInstance, index: number): HTMLElement {
    const sp = getSpeciesById(unit.speciesId);
    const speciesName = sp?.name ?? unit.speciesId;
    const visualAssetId = resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);

    let roleLabel = 'Ally of the Verdant Commonwealth';
    if (index === 0 || unit.isLord) {
      roleLabel = 'Sheltered Dragon Scion & Tribe Strategist';
    } else if (sp?.lineId === 'piplup_line') {
      roleLabel = 'Headstrong Vanguard & Childhood Best Friend';
    } else if (sp?.lineId === 'flabebe_line') {
      roleLabel = 'Sanctuary Healer & Heart of the Tribe';
    } else if (sp?.lineId === 'sewaddle_line') {
      roleLabel = 'Verdant Bluff Forest Scout';
    }

    const card = document.createElement('div');
    card.className = 'pmd-credits-cast-card';
    card.dataset.testid = `credits-cast-card-${unit.speciesId}`;

    const actor = new PmdSpriteActor({
      speciesIdOrAssetId: visualAssetId,
      initialAction: 'Walk',
      initialDirection: 2,
      fixedBoxPx: { width: 52, height: 52 },
    });
    void actor.ready();
    this.activeSpriteActors.push(actor);

    const spriteSlot = document.createElement('div');
    spriteSlot.className = 'pmd-credits-cast-sprite';
    spriteSlot.appendChild(actor.canvas);

    const meta = document.createElement('div');
    meta.className = 'pmd-credits-cast-meta';

    const nameRow = document.createElement('div');
    nameRow.className = 'pmd-credits-cast-name-row';

    const nickEl = document.createElement('span');
    nickEl.className = 'pmd-credits-cast-nick';
    nickEl.textContent = unit.nickname;
    nameRow.appendChild(nickEl);

    if (unit.nickname !== speciesName) {
      const spEl = document.createElement('span');
      spEl.className = 'pmd-credits-cast-species';
      spEl.textContent = `(${speciesName})`;
      nameRow.appendChild(spEl);
    }

    const lvEl = document.createElement('span');
    lvEl.className = 'pmd-credits-cast-level';
    lvEl.textContent = `Lv. ${unit.level}`;
    nameRow.appendChild(lvEl);

    const roleEl = document.createElement('div');
    roleEl.className = 'pmd-credits-cast-role';
    roleEl.textContent = roleLabel;

    meta.append(nameRow, roleEl);
    card.append(spriteSlot, meta);
    return card;
  }

  private createNpcCastCard(opts: {
    id: string;
    assetId: string;
    name: string;
    subtitle: string;
  }): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pmd-credits-cast-card is-npc';
    card.dataset.testid = `credits-cast-card-${opts.id}`;

    const actor = new PmdSpriteActor({
      speciesIdOrAssetId: opts.assetId,
      initialAction: 'Walk',
      initialDirection: 2,
      fixedBoxPx: { width: 52, height: 52 },
    });
    void actor.ready();
    this.activeSpriteActors.push(actor);

    const spriteSlot = document.createElement('div');
    spriteSlot.className = 'pmd-credits-cast-sprite';
    spriteSlot.appendChild(actor.canvas);

    const meta = document.createElement('div');
    meta.className = 'pmd-credits-cast-meta';

    const nameRow = document.createElement('div');
    nameRow.className = 'pmd-credits-cast-name-row';
    const nickEl = document.createElement('span');
    nickEl.className = 'pmd-credits-cast-nick';
    nickEl.textContent = opts.name;
    nameRow.appendChild(nickEl);

    const roleEl = document.createElement('div');
    roleEl.className = 'pmd-credits-cast-role';
    roleEl.textContent = opts.subtitle;

    meta.append(nameRow, roleEl);
    card.append(spriteSlot, meta);
    return card;
  }

  private createCreditBlock(
    heading: string,
    entries: ReadonlyArray<{ primary: string; secondary?: string; testId?: string }>
  ): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'pmd-credits-section';

    const h2 = document.createElement('h2');
    h2.className = 'pmd-credits-section-heading';
    h2.textContent = heading;
    sec.appendChild(h2);

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'pmd-credits-credit-entry';

      const p = document.createElement('div');
      p.className = 'pmd-credits-credit-primary';
      if (entry.testId) {
        p.dataset.testid = entry.testId;
      }
      p.textContent = entry.primary;
      row.appendChild(p);

      if (entry.secondary) {
        const s = document.createElement('div');
        s.className = 'pmd-credits-credit-secondary';
        s.textContent = entry.secondary;
        row.appendChild(s);
      }

      sec.appendChild(row);
    }

    return sec;
  }

  private syncLayoutMetrics(): void {
    const viewW = Math.max(320, this.viewportEl.clientWidth || window.innerWidth || 960);
    const viewH = Math.max(240, this.viewportEl.clientHeight || window.innerHeight || 540);

    // Low-res integer pixel sky buffer (`~1/3` viewport resolution) scaled sharply with `image-rendering: pixelated`
    const pixelScale = viewW >= 960 ? 3 : 2;
    const bufW = Math.max(160, Math.ceil(viewW / pixelScale));
    const bufH = Math.max(120, Math.ceil(viewH / pixelScale));
    if (this.backdropCanvas.width !== bufW || this.backdropCanvas.height !== bufH) {
      this.backdropCanvas.width = bufW;
      this.backdropCanvas.height = bufH;
      this.backdropCtx.imageSmoothingEnabled = false;
    }

    const trackH = this.scrollTrackEl.scrollHeight;
    this.maxScrollY = Math.max(0, trackH - viewH);
    if (this.scrollY > this.maxScrollY) {
      this.scrollY = this.maxScrollY;
    }
  }

  private applyScrollTransform(): void {
    this.scrollTrackEl.style.transform = `translate3d(0, ${-Math.round(this.scrollY)}px, 0)`;
  }

  private startLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.lastRafMs = performance.now();
    const tick = (now: number) => {
      if (!this.openState) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(80, Math.max(0, now - this.lastRafMs));
      this.lastRafMs = now;
      this.stepSimulation(dt);
      this.renderBackdrop();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stepSimulation(dtMs: number): void {
    this.animClockMs += dtMs;
    this.syncLayoutMetrics();

    if (!this.reachedEnd && this.maxScrollY > 0) {
      const mult = this.pointerFastHolding
        ? FAST_SCROLL_MULTIPLIER
        : this.fastMode
          ? 2.2
          : 1;
      const deltaPx = (BASE_SCROLL_PX_PER_SEC * mult * dtMs) / 1000;
      this.scrollY = Math.min(this.maxScrollY, this.scrollY + deltaPx);
      if (this.scrollY >= this.maxScrollY - 0.5) {
        this.scrollY = this.maxScrollY;
        this.reachedEnd = true;
        this.holdHintEl.hidden = true;
      }
      this.applyScrollTransform();
    }
  }

  private renderBackdrop(): void {
    const ctx = this.backdropCtx;
    const w = this.backdropCanvas.width;
    const h = this.backdropCanvas.height;
    ctx.imageSmoothingEnabled = false;

    // Banded GBA/NDS PMD twilight sky gradient
    const bands = [
      '#050916',
      '#081126',
      '#0d1b38',
      '#14274c',
      '#1d3560',
      '#283e6c',
      '#364672',
    ];
    const bandH = Math.ceil(h / bands.length);
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i * bandH, w, bandH + 1);
    }

    const sec = this.animClockMs / 1000;

    // Twinkling pixel stars
    for (const s of this.stars) {
      const twinkle = Math.sin(sec * 2.1 + s.phase);
      if (twinkle < -0.35) continue;
      const sx = Math.floor(s.xFrac * w);
      const sy = Math.floor(s.yFrac * h);
      ctx.fillStyle =
        twinkle > 0.55
          ? s.warm
            ? '#fff0a8'
            : '#ffffff'
          : s.warm
            ? '#d8b878'
            : '#88b4e8';
      ctx.fillRect(sx, sy, s.size, s.size);
    }

    // Distant Verdant Commonwealth forest & mountain silhouette along the bottom
    ctx.fillStyle = '#070f20';
    for (let x = 0; x < w; x += 4) {
      const ridge =
        Math.floor(Math.sin(x * 0.045) * 6 + Math.cos(x * 0.11) * 3) + 12;
      ctx.fillRect(x, h - ridge, 4, ridge);
    }

    // Rising golden Dragon Aura embers
    for (const e of this.embers) {
      const ex = Math.floor((((e.xFrac + sec * e.driftX) % 1) + 1) % 1 * w);
      const ey = Math.floor((((e.yFrac - sec * e.speedY) % 1) + 1) % 1 * h);
      const glow = Math.sin(sec * 3 + e.phase);
      ctx.fillStyle = glow > 0 ? '#f8d868' : '#e89838';
      ctx.fillRect(ex, ey, 1, 1);
    }
  }

  private destroyCastActors(): void {
    for (const actor of this.activeSpriteActors) {
      actor.destroy();
    }
    this.activeSpriteActors = [];
  }

  private finish(reason: CreditsFinishReason): void {
    if (!this.openState) return;
    this.openState = false;
    this.pointerFastHolding = false;
    this.activeHoldPointerId = null;
    this.cleanupAudioSequence();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.destroyCastActors();
    this.rootEl.hidden = true;

    if (this.previousTrackId) {
      this.audioManager.playBgm(this.previousTrackId, { fadeMs: 320 });
      this.previousTrackId = null;
    }

    this.onStateChange?.();

    if (this.finishResolver) {
      const resolve = this.finishResolver;
      this.finishResolver = null;
      resolve(reason);
    }
  }

  public destroy(): void {
    this.finish('cancelled');
    this.abortController.abort();
    this.rootEl.remove();
  }
}
