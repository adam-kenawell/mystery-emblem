/**
 * Credits Scroll Track & Live Walking Sprite Cast DOM Builder (`creditsDomBuilder.ts`)
 */

import { resolveUnitVisualAssetId } from '../../assets/pmdAssetLoader';
import {
  CREDITS_HERO_META,
  CREDITS_LEGAL_DISCLAIMER,
  CREDITS_STATIC_SECTIONS,
  DEMO_FEEDBACK_FORM_URL,
  getCreditsNpcShowcaseList,
  resolveCreditsEndCardCopy,
  resolveUnitCreditsRoleLabel,
  type CreditsNpcCastSpec,
  type CreditsSectionBlock,
} from '../../data/creditsData';
import { getSpeciesById } from '../../data/index';
import type { OwnedPokemonInstance, SaveData } from '../../types/schemas';
import { PmdSpriteActor } from '../../ui/PmdSpriteCanvas';
import { createPmdButton, createPmdWindow } from '../../ui/PmdWindow';

export function openDemoFeedbackForm(url: string = DEMO_FEEDBACK_FORM_URL): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function mountWalkingSpriteSlot(assetId: string, actorsOut: PmdSpriteActor[]): HTMLElement {
  const actor = new PmdSpriteActor({
    speciesIdOrAssetId: assetId,
    initialAction: 'Walk',
    initialDirection: 2,
    fixedBoxPx: { width: 52, height: 52 },
  });
  void actor.ready();
  actorsOut.push(actor);
  const spriteSlot = document.createElement('div');
  spriteSlot.className = 'pmd-credits-cast-sprite';
  spriteSlot.appendChild(actor.canvas);
  return spriteSlot;
}

function createUnitCastCard(
  unit: OwnedPokemonInstance,
  index: number,
  actorsOut: PmdSpriteActor[]
): HTMLElement {
  const sp = getSpeciesById(unit.speciesId);
  const speciesName = sp?.name ?? unit.speciesId;
  const visualAssetId = resolveUnitVisualAssetId(unit.speciesId, unit.cosmeticForm);

  const card = document.createElement('div');
  card.className = 'pmd-credits-cast-card';
  card.dataset.testid = `credits-cast-card-${unit.speciesId}`;

  const meta = document.createElement('div');
  meta.className = 'pmd-credits-cast-meta';
  const nameRow = document.createElement('div');
  nameRow.className = 'pmd-credits-cast-name-row';

  const nickEl = document.createElement('span');
  nickEl.className = 'pmd-credits-cast-nick';
  nickEl.textContent = speciesName;
  nameRow.appendChild(nickEl);

  const lvEl = document.createElement('span');
  lvEl.className = 'pmd-credits-cast-level';
  lvEl.textContent = `Lv. ${unit.level}`;
  nameRow.appendChild(lvEl);

  const roleEl = document.createElement('div');
  roleEl.className = 'pmd-credits-cast-role';
  roleEl.textContent = resolveUnitCreditsRoleLabel(unit, index);

  meta.append(nameRow, roleEl);
  card.append(mountWalkingSpriteSlot(visualAssetId, actorsOut), meta);
  return card;
}

function createNpcCastCard(opts: CreditsNpcCastSpec, actorsOut: PmdSpriteActor[]): HTMLElement {
  const card = document.createElement('div');
  card.className = 'pmd-credits-cast-card is-npc';
  card.dataset.testid = `credits-cast-card-${opts.id}`;

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
  card.append(mountWalkingSpriteSlot(opts.assetId, actorsOut), meta);
  return card;
}

function createCreditBlock(section: CreditsSectionBlock): HTMLElement {
  const sec = document.createElement('section');
  sec.className = 'pmd-credits-section';
  const h2 = document.createElement('h2');
  h2.className = 'pmd-credits-section-heading';
  h2.textContent = section.heading;
  sec.appendChild(h2);

  for (const entry of section.entries) {
    const row = document.createElement('div');
    row.className = 'pmd-credits-credit-entry';
    const p = document.createElement('div');
    p.className = 'pmd-credits-credit-primary';
    if (entry.testId) p.dataset.testid = entry.testId;
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

export function buildCreditsScrollDom(opts: {
  scrollTrackEl: HTMLElement;
  save: SaveData | null;
  onFinishTap: () => void;
  openFeedbackForm?: (url: string) => void;
}): PmdSpriteActor[] {
  const { scrollTrackEl, save } = opts;
  scrollTrackEl.innerHTML = '';
  const actorsOut: PmdSpriteActor[] = [];

  const leadSpacer = document.createElement('div');
  leadSpacer.className = 'pmd-credits-lead-spacer';
  scrollTrackEl.appendChild(leadSpacer);

  const heroBlock = document.createElement('header');
  heroBlock.className = 'pmd-credits-hero-block';
  const subtitle =
    save?.campaign.campaignMode === 'main'
      ? CREDITS_HERO_META.actSubtitleFull
      : CREDITS_HERO_META.actSubtitleDemo;
  heroBlock.innerHTML = `
    <div class="pmd-credits-eyebrow">${CREDITS_HERO_META.eyebrow}</div>
    <h1 class="pmd-credits-main-title">${CREDITS_HERO_META.mainTitle}</h1>
    <div class="pmd-credits-act-subtitle">${subtitle}</div>
    <div class="pmd-credits-divider" aria-hidden="true"></div>
  `;
  scrollTrackEl.appendChild(heroBlock);

  const castSection = document.createElement('section');
  castSection.className = 'pmd-credits-section';
  const castHeading = document.createElement('h2');
  castHeading.className = 'pmd-credits-section-heading';
  castHeading.textContent = CREDITS_HERO_META.castSectionHeading;
  const castGrid = document.createElement('div');
  castGrid.className = 'pmd-credits-cast-list';
  castGrid.dataset.testid = 'credits-cast-list';

  (save?.roster ?? []).forEach((unit, idx) => {
    castGrid.appendChild(createUnitCastCard(unit, idx, actorsOut));
  });
  for (const npc of getCreditsNpcShowcaseList(save)) {
    castGrid.appendChild(createNpcCastCard(npc, actorsOut));
  }

  castSection.append(castHeading, castGrid);
  scrollTrackEl.appendChild(castSection);

  for (const section of CREDITS_STATIC_SECTIONS) {
    scrollTrackEl.appendChild(createCreditBlock(section));
  }

  const disclaimerEl = document.createElement('p');
  disclaimerEl.className = 'pmd-credits-disclaimer';
  disclaimerEl.textContent = CREDITS_LEGAL_DISCLAIMER;
  scrollTrackEl.appendChild(disclaimerEl);

  const endCopy = resolveCreditsEndCardCopy(save);
  const endWrap = document.createElement('div');
  endWrap.className = 'pmd-credits-end-wrap';
  const endCard = createPmdWindow({
    variant: 'gold',
    testId: 'credits-end-card',
    className: 'pmd-credits-end-card',
  });

  const endEyebrow = document.createElement('div');
  endEyebrow.className = 'pmd-credits-end-eyebrow';
  endEyebrow.textContent = endCopy.eyebrow;

  const thankTitle = document.createElement('h2');
  thankTitle.className = 'pmd-credits-thank-title';
  thankTitle.textContent = endCopy.thankTitle;

  const teaserLine = document.createElement('p');
  teaserLine.className = 'pmd-credits-act2-teaser';
  teaserLine.textContent = endCopy.teaserLine;

  const statsLine = document.createElement('div');
  statsLine.className = 'pmd-credits-run-summary';
  statsLine.textContent = endCopy.statsLine;

  const finishBtn = createPmdButton({
    label: endCopy.finishButtonLabel,
    variant: 'primary',
    className: 'pmd-credits-finish-btn',
    testId: 'credits-finish-btn',
    onTap: endCopy.feedbackFormUrl ? undefined : () => opts.onFinishTap(),
  });
  const feedbackUrl = endCopy.feedbackFormUrl;
  if (feedbackUrl) {
    finishBtn.dataset.feedbackUrl = feedbackUrl;
    // Real 'click' keeps window.open inside the user gesture so mobile browsers never block the popup.
    finishBtn.addEventListener('click', () => {
      (opts.openFeedbackForm ?? openDemoFeedbackForm)(feedbackUrl);
      opts.onFinishTap();
    });
  }

  endCard.append(endEyebrow, thankTitle, teaserLine, statsLine, finishBtn);
  endWrap.appendChild(endCard);
  scrollTrackEl.appendChild(endWrap);

  return actorsOut;
}
