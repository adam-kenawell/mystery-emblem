/**
 * Branching Mid-Battle `Talk` Choice Modal (`battleTalkChoiceModal.ts`)
 *
 * Powers twin/branching mid-battle recruitment decisions (e.g., Paralogue 4
 * `Nidoran♂` vs `Nidoran♀`) using Unified Pointer Events and PMD portrait chips.
 */

import { interpolateCampaignText } from '../../engine/speakerResolver';
import type { DungeonTalkChoiceOption } from '../../types/schemas';
import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import { bindPointerTap } from '../../ui/pointerControls';
import type { BattleDomRefs } from './battleDomShell';
import type { BattleControllerContext, BattleRuntimeState } from './battleTypesAndState';
import { escapeHudHtml } from './battleUnitQueries';

export function dismissTalkChoiceModal(
  state: BattleRuntimeState,
  dom: BattleDomRefs,
  selectedOption: DungeonTalkChoiceOption | null = null
): void {
  dom.talkChoiceBackdropEl.hidden = true;
  dom.talkChoiceBackdropEl.innerHTML = '';
  if (state.talkChoiceResolver) {
    const resolve = state.talkChoiceResolver;
    state.talkChoiceResolver = null;
    resolve(selectedOption);
  }
}

export function presentTalkChoiceModalAsync(
  ctx: BattleControllerContext,
  promptTitle: string,
  promptSubtitle: string | undefined,
  options: ReadonlyArray<DungeonTalkChoiceOption>
): Promise<DungeonTalkChoiceOption | null> {
  const { state, dom, saveManager, audioManager } = ctx;
  dismissTalkChoiceModal(state, dom, null);
  if (!state.openState || options.length === 0) {
    return Promise.resolve(null);
  }

  const save = saveManager.getSave();
  const resolvedTitle = interpolateCampaignText(promptTitle, save);
  const resolvedSub = promptSubtitle
    ? interpolateCampaignText(promptSubtitle, save)
    : undefined;

  const modalEl = document.createElement('div');
  modalEl.className = 'pmd-window pmd-talk-choice-modal';
  modalEl.dataset.testid = 'battle-talk-choice-modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.innerHTML = `
    <h3 class="pmd-panel-title" data-testid="talk-choice-title">${escapeHudHtml(resolvedTitle)}</h3>
    ${resolvedSub ? `<p class="pmd-panel-sub" data-testid="talk-choice-subtitle">${escapeHudHtml(resolvedSub)}</p>` : ''}
    <div class="pmd-talk-choice-options" data-testid="talk-choice-options"></div>
    <div class="pmd-battle-outcome-actions">
      <button type="button" class="pmd-btn" data-testid="talk-choice-cancel-btn">Cancel</button>
    </div>
  `;

  const optionsWrap = modalEl.querySelector<HTMLElement>('[data-testid="talk-choice-options"]')!;
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-btn pmd-btn-primary pmd-talk-choice-btn';
    btn.dataset.testid = `talk-choice-opt-${opt.id}`;

    if (opt.portraitSpeciesId) {
      const slot = document.createElement('span');
      slot.className = 'pmd-talk-choice-portrait';
      const pv = new PmdPortraitView({ pixelScale: 1 });
      slot.appendChild(pv.canvas);
      void pv.setPortrait({
        speciesIdOrAssetId: opt.portraitSpeciesId,
        emotion: 'Normal',
      });
      btn.appendChild(slot);
    }

    const copyEl = document.createElement('span');
    copyEl.className = 'pmd-talk-choice-copy';
    const lblText = interpolateCampaignText(opt.label, save);
    const descText = opt.description ? interpolateCampaignText(opt.description, save) : '';
    copyEl.innerHTML = `
      <span class="pmd-talk-choice-label">${escapeHudHtml(lblText)}</span>
      ${descText ? `<span class="pmd-talk-choice-desc">${escapeHudHtml(descText)}</span>` : ''}
    `;
    btn.appendChild(copyEl);

    bindPointerTap(btn, () => {
      audioManager.playSfx('select');
      dismissTalkChoiceModal(state, dom, opt);
      ctx.onLayerStateChanged();
      ctx.renderNow();
    });
    optionsWrap.appendChild(btn);
  }

  bindPointerTap(
    modalEl.querySelector<HTMLElement>('[data-testid="talk-choice-cancel-btn"]'),
    () => {
      audioManager.playSfx('cancel');
      dismissTalkChoiceModal(state, dom, null);
      ctx.onLayerStateChanged();
      ctx.renderNow();
    }
  );

  dom.talkChoiceBackdropEl.innerHTML = '';
  dom.talkChoiceBackdropEl.appendChild(modalEl);
  dom.talkChoiceBackdropEl.hidden = false;
  ctx.onLayerStateChanged();
  ctx.renderNow();

  return new Promise<DungeonTalkChoiceOption | null>((resolve) => {
    state.talkChoiceResolver = resolve;
  });
}
