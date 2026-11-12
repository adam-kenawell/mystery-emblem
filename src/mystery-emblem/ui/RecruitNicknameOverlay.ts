/**
 * Mystery Emblem - Reusable PMD Rename Modal (`RecruitNicknameOverlay`)
 */

import { resolveUnitVisualAssetId } from '../assets/pmdAssetLoader';
import { getAudioManager, type AudioManager } from '../audio/AudioManager';
import { getPersonalSkillById, getSpeciesById } from '../data/index';
import type { SaveStateManager } from '../state/SaveStateManager';
import type { OwnedPokemonInstance } from '../types/schemas';
import { PmdPortraitView } from './PmdSpriteCanvas';
import { bindBackGestureSurface, bindPointerTap } from './pointerControls';
import { renderColoredTypesHtml } from './typeColors';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PromptRecruitsOptions {
  bannerText?: string;
}

export class RecruitNicknameOverlay {
  public readonly rootEl: HTMLElement;
  private readonly modalTitleEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly stepBadgeEl: HTMLElement;
  private readonly speciesTitleEl: HTMLElement;
  private readonly speciesMetaEl: HTMLElement;
  private readonly skillDescEl: HTMLElement;
  private readonly inputEl: HTMLInputElement;
  private readonly portraitView: PmdPortraitView;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly secondaryBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;

  private readonly saveManager: SaveStateManager;
  private readonly audioManager: AudioManager;
  private readonly onStateChange?: () => void;
  private readonly abortController = new AbortController();

  private mode: 'recruit' | 'rename' = 'rename';
  private activeSaveManagerOverride: SaveStateManager | null = null;
  private queue: OwnedPokemonInstance[] = [];
  private queueIndex = 0;
  private resolver: (() => void) | null = null;

  constructor(
    mountParent: HTMLElement,
    saveManager: SaveStateManager,
    options?: { audioManager?: AudioManager; onStateChange?: () => void }
  ) {
    this.saveManager = saveManager;
    this.audioManager = options?.audioManager ?? getAudioManager();
    this.onStateChange = options?.onStateChange;

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'pmd-modal-backdrop';
    this.rootEl.dataset.testid = 'recruit-nickname-modal';
    this.rootEl.hidden = true;
    this.rootEl.style.zIndex = '96';

    this.rootEl.innerHTML = `
      <div class="pmd-window pmd-modal-card" role="dialog" aria-modal="true" aria-label="Pokémon Nickname" style="width:min(420px, 94vw); max-height:min(90dvh, 480px); overflow-y:auto;">
        <div class="pmd-devtools-row-between" style="margin-bottom:6px;">
          <h2 class="pmd-modal-title" data-nickname-modal-title style="margin:0; color:#f8f800;">RENAME</h2>
          <span class="pmd-chapter-badge" data-recruit-step-badge hidden>1 / 1</span>
        </div>
        <p class="pmd-modal-sub" data-recruit-banner style="margin:0 0 8px; color:#a8e0f8; font-size:13px;" hidden></p>
        <div class="pmd-forecast-unit-head" style="background:#16344c; border:2px solid #a8c0e0; padding:8px; margin-bottom:8px;">
          <div class="pmd-forecast-portrait-slot" data-recruit-portrait></div>
          <div class="pmd-forecast-unit-id">
            <strong class="pmd-forecast-unit-name" data-testid="recruit-species-title">Axew</strong>
            <span class="pmd-forecast-unit-meta" data-recruit-species-meta>Dragon · Lv. 1</span>
            <span class="pmd-forecast-unit-meta" data-recruit-skill-desc style="color:#58f858; margin-top:2px;"></span>
          </div>
        </div>
        <label class="pmd-field-label" for="pmd-recruit-nickname-input">Nickname</label>
        <input
          id="pmd-recruit-nickname-input"
          data-testid="recruit-nickname-input"
          class="pmd-text-input"
          type="text"
          maxlength="16"
          autocomplete="off"
        />
        <div class="pmd-modal-actions" style="margin-top:0.65rem; display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end;">
          <button type="button" class="pmd-btn" data-testid="rename-cancel-btn" style="min-height:44px;" hidden>
            Cancel
          </button>
          <button type="button" class="pmd-btn" data-testid="recruit-nickname-skip-all-btn" style="min-height:44px;">
            Default
          </button>
          <button type="button" class="pmd-btn pmd-btn-primary" data-testid="recruit-nickname-confirm-btn" style="min-height:44px;">
            Save
          </button>
        </div>
      </div>
    `;

    this.modalTitleEl = this.rootEl.querySelector('[data-nickname-modal-title]')!;
    this.bannerEl = this.rootEl.querySelector('[data-recruit-banner]')!;
    this.stepBadgeEl = this.rootEl.querySelector('[data-recruit-step-badge]')!;
    this.speciesTitleEl = this.rootEl.querySelector('[data-testid="recruit-species-title"]')!;
    this.speciesMetaEl = this.rootEl.querySelector('[data-recruit-species-meta]')!;
    this.skillDescEl = this.rootEl.querySelector('[data-recruit-skill-desc]')!;
    this.inputEl = this.rootEl.querySelector('[data-testid="recruit-nickname-input"]')!;
    this.confirmBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-confirm-btn"]')!;
    this.secondaryBtn = this.rootEl.querySelector('[data-testid="recruit-nickname-skip-all-btn"]')!;
    this.cancelBtn = this.rootEl.querySelector('[data-testid="rename-cancel-btn"]')!;

    this.portraitView = new PmdPortraitView({ testId: 'recruit-nickname-portrait' });
    this.rootEl.querySelector('[data-recruit-portrait]')!.appendChild(this.portraitView.canvas);

    mountParent.appendChild(this.rootEl);

    const signal = this.abortController.signal;
    bindPointerTap(this.confirmBtn, () => this.confirmCurrentAndAdvance(), {
      signal,
      stopPropagation: true,
    });
    bindPointerTap(
      this.secondaryBtn,
      () => {
        if (this.mode === 'rename') {
          const current = this.queue[0];
          if (current) {
            const sp = getSpeciesById(current.speciesId);
            this.inputEl.value = sp?.name ?? current.speciesId;
            this.confirmCurrentAndAdvance();
          }
        } else {
          this.finishAll();
        }
      },
      { signal, stopPropagation: true }
    );
    bindPointerTap(
      this.cancelBtn,
      () => {
        this.audioManager.playSfx('cancel');
        this.finishAll();
      },
      { signal, stopPropagation: true }
    );
    bindPointerTap(
      this.rootEl,
      (ev) => {
        if (ev.target === this.rootEl && this.mode === 'rename') {
          this.audioManager.playSfx('cancel');
          this.finishAll();
        }
      },
      { signal }
    );
    bindBackGestureSurface(
      this.rootEl,
      () => {
        if (this.mode === 'rename') {
          this.audioManager.playSfx('cancel');
          this.finishAll();
        } else {
          this.confirmCurrentAndAdvance();
        }
      },
      { signal }
    );
  }

  public isOpen(): boolean {
    return !this.rootEl.hidden;
  }

  public async promptRenameUnit(
    instanceId: string,
    overrideManager?: SaveStateManager
  ): Promise<void> {
    const mgr = overrideManager ?? this.saveManager;
    const save = mgr.getSave();
    const unit = save?.roster.find((u) => u.instanceId === instanceId);
    if (!unit) return;

    if (this.resolver) {
      const prev = this.resolver;
      this.resolver = null;
      prev();
    }

    this.mode = 'rename';
    this.activeSaveManagerOverride = mgr;
    this.queue = [unit];
    this.queueIndex = 0;

    this.modalTitleEl.textContent = 'RENAME';
    this.bannerEl.hidden = true;
    this.stepBadgeEl.hidden = true;
    this.cancelBtn.hidden = false;
    this.secondaryBtn.textContent = 'Default';
    this.secondaryBtn.hidden = false;

    this.rootEl.hidden = false;
    this.audioManager.playSfx('select');
    this.renderCurrentUnit();
    this.onStateChange?.();

    return new Promise<void>((resolve) => {
      this.resolver = resolve;
    });
  }

  public handleBack(): void {
    if (!this.isOpen()) return;
    if (this.mode === 'rename') {
      this.audioManager.playSfx('cancel');
      this.finishAll();
    } else {
      this.confirmCurrentAndAdvance();
    }
  }

  private renderCurrentUnit(): void {
    const current = this.queue[this.queueIndex];
    if (!current) {
      this.finishAll();
      return;
    }

    const sp = getSpeciesById(current.speciesId);
    const skill = sp ? getPersonalSkillById(sp.personalSkillId) : undefined;
    this.stepBadgeEl.textContent = `${this.queueIndex + 1} / ${this.queue.length}`;
    this.speciesTitleEl.textContent = sp?.name ?? current.speciesId;
    this.speciesMetaEl.innerHTML = `Lv. ${current.level} · ${renderColoredTypesHtml(sp?.types ?? ['Normal'], ' / ')} · ${escapeHtml(sp?.traversalClass ?? 'Grounded')}`;
    this.skillDescEl.textContent = skill && this.mode === 'recruit' ? `${skill.name}` : '';
    this.inputEl.value = current.nickname || sp?.name || current.speciesId;

    this.confirmBtn.textContent =
      this.mode === 'rename'
        ? 'Save'
        : this.queueIndex + 1 < this.queue.length
          ? 'Next ▶'
          : 'Confirm';

    void this.portraitView.setPortrait({
      speciesIdOrAssetId: resolveUnitVisualAssetId(current.speciesId, current.cosmeticForm),
      emotion: 'Happy',
    });
  }

  private confirmCurrentAndAdvance(): void {
    const current = this.queue[this.queueIndex];
    const mgr = this.activeSaveManagerOverride ?? this.saveManager;
    if (current) {
      const sp = getSpeciesById(current.speciesId);
      const trimmed = this.inputEl.value.trim() || sp?.name || current.nickname || 'Ally';
      try {
        mgr.renamePokemon(current.instanceId, trimmed);
      } catch {
        // Ignore if save was reset externally
      }
    }

    this.audioManager.playSfx('select');
    this.queueIndex += 1;
    if (this.queueIndex >= this.queue.length) {
      this.finishAll();
    } else {
      this.renderCurrentUnit();
    }
  }

  private finishAll(): void {
    this.rootEl.hidden = true;
    this.queue = [];
    this.queueIndex = 0;
    this.activeSaveManagerOverride = null;
    this.onStateChange?.();
    if (this.resolver) {
      const done = this.resolver;
      this.resolver = null;
      done();
    }
  }

  public destroy(): void {
    this.finishAll();
    this.abortController.abort();
    this.rootEl.remove();
  }
}
