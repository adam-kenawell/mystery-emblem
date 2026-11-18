/**
 * Reusable Fire Emblem Awakening-Style Unit Supports Menu (`SupportsMenuView.ts`)
 *
 * Renders the vertical roster list (`Portrait | Name | !`), Partner Popup (`C / B / A / S`),
 * dimmed camp playback via `DialogueOverlay`, and first-time Rank-Up confirmation banner.
 * Used in both Overworld Menu -> `Supports` and Chapter 3+ Battle Prep -> `Supports`.
 */

import { resolveUnitVisualAssetId } from '../assets/pmdAssetLoader';
import type { AudioManager } from '../audio/AudioManager';
import { getSpeciesById } from '../data/index';
import {
  formatLineSupportGiftTag,
  formatSupportStatBonusShort,
  getLineSupportStatBonus,
  getSupportConversationDoc,
  getSupportPartnersForActor,
  getSupportRankIndex,
  getSupportRanksUpTo,
  type SupportActorId,
} from '../data/supports/supportMatrix';
import {
  buildRosterActorLookup,
  compileSupportConversationScript,
  getReadySupportRank,
  getSupportPairProgress,
  resolveSupportActorIdForRosterUnit,
  unitHasAvailableSupportConversation,
} from '../engine/supportEngine';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { OwnedPokemonInstance, SaveData, SupportRank } from '../types/schemas';
import type { DialogueOverlay } from './DialogueOverlay';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { escapeUiHtml } from './inspector/UnitDetailCard';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';

export interface SupportsMenuControllerOptions {
  saveManager: SaveStateManager | (() => SaveStateManager);
  audioManager: AudioManager;
  dialogueOverlay?: DialogueOverlay;
  signal: AbortSignal;
  onSupportsMutated?: () => void;
  onLayerStateChanged?: () => void;
}

interface RankUpModalInfo {
  unitA: OwnedPokemonInstance;
  unitB: OwnedPokemonInstance;
  rank: SupportRank;
  bonusFromA: string;
  bonusFromB: string;
}

export class SupportsMenuController {
  private readonly opts: SupportsMenuControllerOptions;
  private listContainerEl: HTMLElement | null = null;
  private selectedActorId: SupportActorId | null = null;
  private rankUpInfo: RankUpModalInfo | null = null;
  private isPlayingScript = false;

  private partnerBackdropEl: HTMLElement | null = null;
  private partnerDialogEl: HTMLElement | null = null;
  private playbackBackdropEl: HTMLElement | null = null;
  private rankUpBackdropEl: HTMLElement | null = null;

  private listRenderAbort: AbortController | null = null;
  private popupRenderAbort: AbortController | null = null;
  private rankUpRenderAbort: AbortController | null = null;

  constructor(options: SupportsMenuControllerOptions) {
    this.opts = options;
    this.opts.signal.addEventListener('abort', () => this.destroy(), { once: true });
  }

  private getSaveManager(): SaveStateManager {
    return typeof this.opts.saveManager === 'function'
      ? this.opts.saveManager()
      : this.opts.saveManager;
  }

  public hasActiveSubLayer(): boolean {
    return Boolean(this.rankUpInfo || this.selectedActorId || this.isPlayingScript);
  }

  public isConversationPlaying(): boolean {
    return this.isPlayingScript;
  }

  public reset(): void {
    this.selectedActorId = null;
    this.rankUpInfo = null;
    this.isPlayingScript = false;
    this.popupRenderAbort?.abort();
    this.popupRenderAbort = null;
    this.rankUpRenderAbort?.abort();
    this.rankUpRenderAbort = null;
    if (this.partnerBackdropEl) this.partnerBackdropEl.hidden = true;
    if (this.playbackBackdropEl) this.playbackBackdropEl.hidden = true;
    if (this.rankUpBackdropEl) this.rankUpBackdropEl.hidden = true;
  }

  public destroy(): void {
    this.reset();
    this.listRenderAbort?.abort();
    this.listRenderAbort = null;
    this.partnerBackdropEl?.remove();
    this.partnerBackdropEl = null;
    this.partnerDialogEl = null;
    this.playbackBackdropEl?.remove();
    this.playbackBackdropEl = null;
    this.rankUpBackdropEl?.remove();
    this.rankUpBackdropEl = null;
  }

  public handleBack(): boolean {
    if (this.isPlayingScript) return true;
    if (this.rankUpInfo) {
      this.opts.audioManager.playSfx('select');
      this.dismissRankUpModal();
      return true;
    }
    if (this.selectedActorId) {
      this.opts.audioManager.playSfx('cancel');
      this.closePartnerPopup();
      return true;
    }
    return false;
  }

  public renderInto(containerEl: HTMLElement): void {
    this.listContainerEl = containerEl;
    this.listRenderAbort?.abort();
    this.listRenderAbort = new AbortController();
    const signal = this.listRenderAbort.signal;

    containerEl.innerHTML = '';
    const save = this.getSaveManager().getSave();
    if (!save) return;

    const wrap = document.createElement('div');
    wrap.className = 'pmd-supports-view';

    const hint = document.createElement('p');
    hint.className = 'pmd-subcard-text pmd-supports-hint';
    hint.textContent = 'Select a Pokemon to view support partners and ready conversations (!).';

    const listEl = document.createElement('div');
    listEl.className = 'pmd-supports-unit-list pmd-menu-list';
    listEl.dataset.testid = 'supports-unit-list';
    listEl.setAttribute('role', 'list');

    const rosterActors = buildRosterActorLookup(save);
    for (const unit of save.roster) {
      const actorId = resolveSupportActorIdForRosterUnit(unit, save);
      const sp = getSpeciesById(unit.speciesId);
      const giftTag = formatLineSupportGiftTag(sp?.lineId);
      const isReady = unitHasAvailableSupportConversation(unit, save, rosterActors);
      const hasAnyPartners = actorId
        ? getSupportPartnersForActor(actorId).some((p) => rosterActors.has(p.partnerActorId))
        : false;

      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.className = 'pmd-btn pmd-menu-row pmd-supports-unit-row';
      rowBtn.dataset.testid = `supports-unit-row-${unit.instanceId}`;
      rowBtn.setAttribute('role', 'listitem');

      const portraitSlot = document.createElement('div');
      portraitSlot.className = 'pmd-forecast-portrait-slot pmd-supports-portrait-slot';
      const portraitView = new PmdPortraitView({
        pixelScale: 1,
        testId: `supports-unit-portrait-${unit.instanceId}`,
      });
      portraitSlot.appendChild(portraitView.canvas);
      void portraitView.setPortrait({
        speciesIdOrAssetId: resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm),
        emotion: 'Normal',
      });

      const infoCol = document.createElement('div');
      infoCol.className = 'pmd-supports-unit-info';
      const nameEl = document.createElement('strong');
      nameEl.className = 'pmd-supports-unit-name';
      nameEl.textContent = unit.nickname;
      const metaEl = document.createElement('span');
      metaEl.className = 'pmd-supports-unit-meta';
      metaEl.textContent = hasAnyPartners
        ? `Gives: ${giftTag || 'Balanced'}`
        : 'No support partners yet';
      infoCol.append(nameEl, metaEl);

      const rightCol = document.createElement('div');
      rightCol.className = 'pmd-supports-unit-right';
      if (isReady) {
        const badge = document.createElement('span');
        badge.className = 'pmd-supports-exclaim';
        badge.dataset.testid = 'supports-unit-ready-badge';
        badge.setAttribute('aria-label', 'Support conversation ready');
        badge.textContent = '!';
        rightCol.appendChild(badge);
      }

      rowBtn.append(portraitSlot, infoCol, rightCol);
      bindPointerTap(
        rowBtn,
        () => {
          if (!actorId) return;
          this.opts.audioManager.playSfx('select');
          this.selectedActorId = actorId;
          this.renderPartnerPopup();
          this.opts.onLayerStateChanged?.();
        },
        { signal }
      );
      listEl.appendChild(rowBtn);
    }

    wrap.append(hint, listEl);
    containerEl.appendChild(wrap);

    if (this.selectedActorId && this.partnerBackdropEl && !this.partnerBackdropEl.hidden) {
      this.renderPartnerPopup();
    }
  }

  private ensurePartnerPopupDom(): void {
    if (this.partnerBackdropEl && this.partnerDialogEl) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'pmd-battle-modal-backdrop pmd-supports-modal-backdrop';
    backdrop.dataset.testid = 'supports-partner-popup';
    backdrop.hidden = true;

    const dialog = document.createElement('div');
    dialog.className = 'pmd-window pmd-window--gold pmd-supports-partner-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Unit Supports');
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    bindPointerTap(
      backdrop,
      (ev) => {
        if (ev.target === backdrop && !this.isPlayingScript) {
          this.opts.audioManager.playSfx('cancel');
          this.closePartnerPopup();
        }
      },
      { signal: this.opts.signal }
    );
    bindBackGestureSurface(
      backdrop,
      () => {
        if (!this.isPlayingScript) {
          this.handleBack();
        }
      },
      { signal: this.opts.signal }
    );

    this.partnerBackdropEl = backdrop;
    this.partnerDialogEl = dialog;
  }

  private ensurePlaybackBackdropDom(): HTMLElement {
    if (!this.playbackBackdropEl) {
      const el = document.createElement('div');
      el.className = 'pmd-supports-playback-backdrop';
      el.dataset.testid = 'supports-playback-backdrop';
      el.hidden = true;
      document.body.appendChild(el);
      this.playbackBackdropEl = el;
    }
    return this.playbackBackdropEl;
  }

  private ensureRankUpBackdropDom(): HTMLElement {
    if (!this.rankUpBackdropEl) {
      const el = document.createElement('div');
      el.className = 'pmd-battle-modal-backdrop pmd-supports-rankup-backdrop';
      el.dataset.testid = 'supports-rank-up-modal';
      el.hidden = true;
      bindBackGestureSurface(el, () => this.handleBack(), { signal: this.opts.signal });
      document.body.appendChild(el);
      this.rankUpBackdropEl = el;
    }
    return this.rankUpBackdropEl;
  }

  private closePartnerPopup(): void {
    this.selectedActorId = null;
    this.popupRenderAbort?.abort();
    this.popupRenderAbort = null;
    if (this.partnerBackdropEl) this.partnerBackdropEl.hidden = true;
    this.opts.onLayerStateChanged?.();
  }

  private dismissRankUpModal(): void {
    this.rankUpInfo = null;
    this.rankUpRenderAbort?.abort();
    this.rankUpRenderAbort = null;
    if (this.rankUpBackdropEl) this.rankUpBackdropEl.hidden = true;
    if (this.listContainerEl) this.renderInto(this.listContainerEl);
    if (this.selectedActorId) this.renderPartnerPopup();
    this.opts.onLayerStateChanged?.();
  }

  private renderPartnerPopup(): void {
    const save = this.getSaveManager().getSave();
    if (!save || !this.selectedActorId) {
      this.closePartnerPopup();
      return;
    }
    const rosterActors = buildRosterActorLookup(save);
    const subject = rosterActors.get(this.selectedActorId);
    if (!subject) {
      this.closePartnerPopup();
      return;
    }

    this.ensurePartnerPopupDom();
    this.popupRenderAbort?.abort();
    this.popupRenderAbort = new AbortController();
    const signal = this.popupRenderAbort.signal;

    const dialog = this.partnerDialogEl!;
    const backdrop = this.partnerBackdropEl!;
    const subjectSp = getSpeciesById(subject.speciesId);
    const subjectGift = formatLineSupportGiftTag(subjectSp?.lineId);

    dialog.innerHTML = `
      <div class="pmd-supports-popup-head">
        <div class="pmd-supports-popup-hero">
          <div class="pmd-forecast-portrait-slot pmd-supports-portrait-slot" data-support-hero-portrait></div>
          <div class="pmd-supports-popup-title-col">
            <h3 class="pmd-panel-title" style="margin:0;" data-testid="supports-partner-title">${escapeUiHtml(subject.nickname)}'s Supports</h3>
            <span class="pmd-supports-unit-meta">Adjacent Gift: ${escapeUiHtml(subjectGift || 'Balanced')}</span>
          </div>
        </div>
        <button type="button" class="pmd-btn pmd-chip-btn" data-testid="supports-partner-close-btn">Back</button>
      </div>
      <div class="pmd-supports-partner-list" data-testid="supports-partner-list"></div>
    `;

    const heroPortrait = new PmdPortraitView({ pixelScale: 1, testId: 'supports-popup-hero-portrait' });
    dialog.querySelector('[data-support-hero-portrait]')?.appendChild(heroPortrait.canvas);
    void heroPortrait.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(subject.speciesId, subject.cosmeticForm),
      emotion: 'Happy',
    });

    bindPointerTap(
      dialog.querySelector('[data-testid="supports-partner-close-btn"]'),
      () => {
        this.opts.audioManager.playSfx('cancel');
        this.closePartnerPopup();
      },
      { signal }
    );

    const partnerDefsByActor = new Map(
      getSupportPartnersForActor(this.selectedActorId).map((p) => [p.partnerActorId, p.pair])
    );
    const listEl = dialog.querySelector<HTMLElement>('[data-testid="supports-partner-list"]')!;
    let partnerCount = 0;

    for (const unit of save.roster) {
      const partnerActorId = resolveSupportActorIdForRosterUnit(unit, save);
      if (!partnerActorId || partnerActorId === this.selectedActorId) continue;
      const pairDef = partnerDefsByActor.get(partnerActorId);
      if (!pairDef) continue;
      partnerCount += 1;

      const progress = getSupportPairProgress(save.supports, this.selectedActorId, partnerActorId);
      const readyRank = getReadySupportRank(progress, pairDef.maxRank);
      const partnerSp = getSpeciesById(unit.speciesId);

      let bonusNote: string;
      if (progress.unlockedRank) {
        const curBonus = formatSupportStatBonusShort(
          getLineSupportStatBonus(partnerSp?.lineId, progress.unlockedRank)
        );
        bonusNote = `Rank ${progress.unlockedRank} Bonus: ${curBonus}`;
      } else {
        const cBonus = formatSupportStatBonusShort(getLineSupportStatBonus(partnerSp?.lineId, 'C'));
        bonusNote = `Grants at C: ${cBonus}`;
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'pmd-supports-partner-row';
      rowEl.dataset.testid = `supports-partner-row-${partnerActorId}`;

      const leftEl = document.createElement('div');
      leftEl.className = 'pmd-supports-partner-id';

      const pSlot = document.createElement('div');
      pSlot.className = 'pmd-forecast-portrait-slot pmd-supports-portrait-slot';
      const pView = new PmdPortraitView({
        pixelScale: 1,
        testId: `supports-partner-portrait-${partnerActorId}`,
      });
      pSlot.appendChild(pView.canvas);
      void pView.setPortrait({
        speciesIdOrAssetId: resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm),
        emotion: readyRank ? 'Happy' : 'Normal',
      });

      const pText = document.createElement('div');
      pText.className = 'pmd-supports-unit-info';
      const pName = document.createElement('strong');
      pName.className = 'pmd-supports-unit-name';
      pName.textContent = unit.nickname;
      const pBonus = document.createElement('span');
      pBonus.className = 'pmd-supports-unit-meta';
      pBonus.textContent = bonusNote;
      pText.append(pName, pBonus);
      leftEl.append(pSlot, pText);

      const ranksEl = document.createElement('div');
      ranksEl.className = 'pmd-supports-rank-pills';
      ranksEl.dataset.testid = `supports-rank-pills-${partnerActorId}`;

      for (const rank of getSupportRanksUpTo(pairDef.maxRank)) {
        const unlocked =
          progress.unlockedRank !== null &&
          getSupportRankIndex(progress.unlockedRank) >= getSupportRankIndex(rank);
        const ready = readyRank === rank;

        const rankBtn = document.createElement('button');
        rankBtn.type = 'button';
        rankBtn.className = `pmd-btn pmd-supports-rank-btn${
          ready ? ' is-ready' : unlocked ? ' is-unlocked' : ' is-locked'
        }`;
        rankBtn.dataset.testid = ready
          ? 'supports-rank-ready'
          : `supports-rank-${partnerActorId}-${rank}`;
        rankBtn.dataset.rank = rank;
        rankBtn.disabled = !ready && !unlocked;
        rankBtn.setAttribute(
          'aria-label',
          ready
            ? `${unit.nickname} Rank ${rank} ready`
            : unlocked
              ? `Replay ${unit.nickname} Rank ${rank}`
              : `${unit.nickname} Rank ${rank} locked`
        );

        const letterSpan = document.createElement('span');
        letterSpan.textContent = rank;
        rankBtn.appendChild(letterSpan);

        if (ready) {
          const ex = document.createElement('span');
          ex.className = 'pmd-supports-exclaim-mini';
          ex.textContent = '!';
          rankBtn.appendChild(ex);
        }

        if (ready || unlocked) {
          bindPointerTap(
            rankBtn,
            () => {
              void this.playSupportConversation(subject, unit, this.selectedActorId!, partnerActorId, rank, ready);
            },
            { signal }
          );
        }

        ranksEl.appendChild(rankBtn);
      }

      rowEl.append(leftEl, ranksEl);
      listEl.appendChild(rowEl);
    }

    if (partnerCount === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'pmd-subcard-text pmd-supports-empty';
      emptyEl.textContent = 'No recruited companions share support conversations with this Pokemon yet.';
      listEl.appendChild(emptyEl);
    }

    backdrop.hidden = false;
  }

  private async playSupportConversation(
    subjectUnit: OwnedPokemonInstance,
    partnerUnit: OwnedPokemonInstance,
    actorA: SupportActorId,
    actorB: SupportActorId,
    rank: SupportRank,
    unlocksOnFinish: boolean
  ): Promise<void> {
    if (this.isPlayingScript) return;
    const doc = getSupportConversationDoc(actorA, actorB, rank);
    if (!doc || !this.opts.dialogueOverlay) return;

    const saveManager = this.getSaveManager();
    const save = saveManager.getSave();
    const script = compileSupportConversationScript(doc, save);
    const playbackBackdrop = this.ensurePlaybackBackdropDom();

    this.opts.audioManager.playSfx('select');
    this.isPlayingScript = true;
    playbackBackdrop.hidden = false;
    this.opts.onLayerStateChanged?.();

    let reason: 'completed' | 'skipped' | 'cancelled' = 'completed';
    try {
      reason = await this.opts.dialogueOverlay.playScript(script);
    } finally {
      this.isPlayingScript = false;
      playbackBackdrop.hidden = true;
      this.opts.onLayerStateChanged?.();
    }

    if (unlocksOnFinish && (reason === 'completed' || reason === 'skipped')) {
      saveManager.unlockSupportRank(actorA, actorB, rank);
      this.opts.onSupportsMutated?.();
      this.opts.audioManager.playSfx('heal');

      const spA = getSpeciesById(subjectUnit.speciesId);
      const spB = getSpeciesById(partnerUnit.speciesId);
      const bonusFromA = formatSupportStatBonusShort(getLineSupportStatBonus(spA?.lineId, rank));
      const bonusFromB = formatSupportStatBonusShort(getLineSupportStatBonus(spB?.lineId, rank));

      this.showRankUpModal({
        unitA: subjectUnit,
        unitB: partnerUnit,
        rank,
        bonusFromA,
        bonusFromB,
      });
    }
  }

  private showRankUpModal(info: RankUpModalInfo): void {
    this.rankUpInfo = info;
    const backdrop = this.ensureRankUpBackdropDom();
    this.rankUpRenderAbort?.abort();
    this.rankUpRenderAbort = new AbortController();
    const signal = this.rankUpRenderAbort.signal;

    const card = document.createElement('div');
    card.className = 'pmd-window pmd-window--gold pmd-supports-rankup-dialog';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.innerHTML = `
      <span class="pmd-battle-kicker is-victory">SUPPORT RANK UP!</span>
      <div class="pmd-supports-rankup-portraits">
        <div class="pmd-forecast-portrait-slot pmd-supports-portrait-slot" data-rankup-p1></div>
        <span class="pmd-supports-rankup-badge" data-testid="supports-rank-up-letter">${info.rank}</span>
        <div class="pmd-forecast-portrait-slot pmd-supports-portrait-slot" data-rankup-p2></div>
      </div>
      <h3 class="pmd-supports-rankup-headline" data-testid="supports-rank-up-headline">
        ${escapeUiHtml(info.unitA.nickname)} and ${escapeUiHtml(info.unitB.nickname)} reached Support Rank ${info.rank}!
      </h3>
      <div class="pmd-supports-rankup-bonuses">
        <span><strong>${escapeUiHtml(info.unitA.nickname)}</strong> grants adjacent partner: <em>${escapeUiHtml(info.bonusFromA)}</em></span>
        <span><strong>${escapeUiHtml(info.unitB.nickname)}</strong> grants adjacent partner: <em>${escapeUiHtml(info.bonusFromB)}</em></span>
      </div>
      <button type="button" class="pmd-btn pmd-btn-primary" data-testid="supports-rank-up-continue-btn">Continue</button>
    `;

    const p1 = new PmdPortraitView({ pixelScale: 1, testId: 'supports-rankup-portrait-1' });
    const p2 = new PmdPortraitView({ pixelScale: 1, testId: 'supports-rankup-portrait-2' });
    card.querySelector('[data-rankup-p1]')?.appendChild(p1.canvas);
    card.querySelector('[data-rankup-p2]')?.appendChild(p2.canvas);
    void p1.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(info.unitA.speciesId, info.unitA.cosmeticForm),
      emotion: 'Joyous',
    });
    void p2.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(info.unitB.speciesId, info.unitB.cosmeticForm),
      emotion: 'Joyous',
      mirrorHorizontal: true,
    });

    bindPointerTap(
      card.querySelector('[data-testid="supports-rank-up-continue-btn"]'),
      () => {
        this.opts.audioManager.playSfx('select');
        this.dismissRankUpModal();
      },
      { signal }
    );

    backdrop.innerHTML = '';
    backdrop.appendChild(card);
    backdrop.hidden = false;
    this.opts.onLayerStateChanged?.();
  }
}
