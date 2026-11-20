/**
 * Fire Emblem-Style Level-Up Modal, New-Move Learned Modal & EXP Award Sequencer
 */

import { getMoveById } from '../../data/index';
import type { BattleUnitState } from '../../engine/combatEngine';
import { awardBattleUnitExp, type LevelUpResult } from '../../engine/progressionEngine';
import type { MoveDefinition } from '../../types/schemas';
import { renderColoredTypeHtml } from '../../ui/typeColors';
import { waitBattleMs } from './battleBannersAndTransitions';
import { updateBattleInfoStrip } from './battleHudCards';
import { triggerBattleTutorial } from './battleTutorialIntegration';
import { getBattleRng, type BattleControllerContext } from './battleTypesAndState';
import { escapeHudHtml, getUnitVisualKey } from './battleUnitQueries';

export interface MoveLearnedModalDetails {
  headline: string;
  moveName: string;
  type: MoveDefinition['type'];
  categoryLabel: string;
  damageLabel: string;
  damageText: string;
  hitText: string;
  critText: string;
  rangeText: string;
  ppText: string;
  description: string;
  equipNote: string;
}

export function buildMoveLearnedModalDetails(
  unitNickname: string,
  move: MoveDefinition,
  opts?: { autoEquipped?: boolean }
): MoveLearnedModalDetails {
  const isSupport = move.category === 'Support/Heal';
  const [rMin, rMax] = move.range;
  const rangeText = rMin === rMax ? `${rMin}` : `${rMin}-${rMax}`;
  let damageLabel = 'DMG';
  let damageText = `${move.mt}`;
  if (isSupport) {
    if (move.supportPayload?.healAmount) {
      damageLabel = 'HEAL';
      damageText = `+${move.supportPayload.healAmount} HP`;
    } else if (move.supportPayload?.healPercentMaxHp) {
      damageLabel = 'HEAL';
      damageText = `+${move.supportPayload.healPercentMaxHp}% HP`;
    } else if (move.supportPayload?.inflictStatus) {
      damageLabel = 'EFF';
      damageText = move.supportPayload.inflictStatus;
    } else if (move.supportPayload?.shieldDamageReduction) {
      damageLabel = 'EFF';
      damageText = `-${move.supportPayload.shieldDamageReduction} DMG`;
    } else {
      damageLabel = 'EFF';
      damageText = '--';
    }
  }
  return {
    headline: `${unitNickname} learned ${move.name}!`,
    moveName: move.name,
    type: move.type,
    categoryLabel: move.priority ? `${move.category} · Priority` : move.category,
    damageLabel,
    damageText,
    hitText: `${move.hit}%`,
    critText: isSupport ? '--' : `${move.crit}%`,
    rangeText,
    ppText: `${move.pp}`,
    description: move.description,
    equipNote: opts?.autoEquipped
      ? 'Automatically equipped and ready to use in this battle!'
      : 'Move slots full (4/4). Equip this move after the battle ends in the Units menu.',
  };
}

const activeLevelUpTimers = new WeakMap<HTMLElement, number[]>();

function clearLevelUpStatTimers(backdrop: HTMLElement): void {
  const timers = activeLevelUpTimers.get(backdrop);
  if (!timers) return;
  for (const id of timers) window.clearTimeout(id);
  activeLevelUpTimers.delete(backdrop);
}

export function dismissLevelUpModal(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  clearLevelUpStatTimers(dom.levelUpModalBackdropEl);
  if (dom.levelUpModalBackdropEl.hidden && !state.levelUpResolver) return;
  dom.levelUpModalBackdropEl.hidden = true;
  const resolver = state.levelUpResolver;
  state.levelUpResolver = null;
  ctx.onLayerStateChanged();
  ctx.renderNow();
  resolver?.();
}

export function dismissMoveLearnedModal(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  if (dom.moveLearnedModalBackdropEl.hidden && !state.moveLearnedResolver) return;
  dom.moveLearnedModalBackdropEl.hidden = true;
  const resolver = state.moveLearnedResolver;
  state.moveLearnedResolver = null;
  ctx.onLayerStateChanged();
  ctx.renderNow();
  resolver?.();
}

export function presentLevelUpModalAsync(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  roll: LevelUpResult,
  runGen: number
): Promise<void> {
  const { state, dom, audioManager } = ctx;
  if (!state.openState || runGen !== state.battleRunGen) {
    return Promise.resolve();
  }

  clearLevelUpStatTimers(dom.levelUpModalBackdropEl);

  const titleEl = dom.levelUpModalBackdropEl.querySelector('[data-testid="levelup-unit-title"]');
  const levelLineEl = dom.levelUpModalBackdropEl.querySelector(
    '[data-testid="levelup-level-line"]'
  );
  const statsGridEl = dom.levelUpModalBackdropEl.querySelector<HTMLElement>(
    '[data-testid="levelup-stats-grid"]'
  );
  const extraNotesEl = dom.levelUpModalBackdropEl.querySelector<HTMLElement>(
    '[data-testid="levelup-extra-notes"]'
  );

  if (titleEl) {
    titleEl.textContent = `${unit.nickname} (${roll.speciesName})`;
  }
  if (levelLineEl) {
    levelLineEl.textContent = `Lv. ${roll.previousLevel} → Lv. ${roll.newLevel}`;
  }

  void dom.levelUpPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(unit),
    emotion: 'Happy',
    mirrorHorizontal: false,
  });

  const pendingUpgrades: Array<{
    cell: HTMLElement;
    valEl: HTMLElement;
    afterVal: number;
    gain: number;
  }> = [];

  if (statsGridEl) {
    statsGridEl.innerHTML = '';
    const statDefs: ReadonlyArray<{
      key: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
      label: string;
    }> = [
      { key: 'hp', label: 'HP' },
      { key: 'atk', label: 'ATK' },
      { key: 'def', label: 'DEF' },
      { key: 'spa', label: 'SPA' },
      { key: 'spd', label: 'SPD' },
      { key: 'spe', label: 'SPE' },
    ];
    for (const sd of statDefs) {
      const gain = roll.statGains[sd.key];
      const beforeVal = roll.statsBefore[sd.key];
      const afterVal = roll.statsAfter[sd.key];
      const cell = document.createElement('div');
      cell.className = 'pmd-prep-stat-box pmd-levelup-stat-box';
      cell.dataset.testid = `levelup-stat-${sd.key}`;
      cell.innerHTML = `<span class="pmd-prep-stat-lbl">${sd.label}</span><strong class="pmd-prep-stat-val" data-levelup-val>${beforeVal}</strong>`;
      const valEl = cell.querySelector<HTMLElement>('[data-levelup-val]')!;
      statsGridEl.appendChild(cell);
      if (gain > 0) {
        pendingUpgrades.push({ cell, valEl, afterVal, gain });
      }
    }
    const movCell = document.createElement('div');
    movCell.className = 'pmd-prep-stat-box pmd-levelup-stat-box';
    movCell.dataset.testid = 'levelup-stat-mov';
    movCell.innerHTML = `<span class="pmd-prep-stat-lbl">MOV</span><strong class="pmd-prep-stat-val">${roll.statsAfter.mov}</strong>`;
    statsGridEl.appendChild(movCell);
  }

  if (extraNotesEl) {
    extraNotesEl.textContent = '';
    extraNotesEl.hidden = true;
  }

  dom.levelUpModalBackdropEl.hidden = false;
  ctx.onLayerStateChanged();
  ctx.renderNow();

  if (pendingUpgrades.length > 0) {
    const timers: number[] = [];
    const baseDelayMs = 240;
    const stepDelayMs = 210;
    pendingUpgrades.forEach((item, idx) => {
      const tId = window.setTimeout(() => {
        if (dom.levelUpModalBackdropEl.hidden || !state.openState || runGen !== state.battleRunGen) {
          return;
        }
        item.cell.classList.add('is-upgraded', 'is-popping');
        item.valEl.innerHTML = `${item.afterVal} <em class="pmd-levelup-stat-gain">+${item.gain}</em>`;
        audioManager.playSfx('select');
      }, baseDelayMs + idx * stepDelayMs);
      timers.push(tId);
    });
    activeLevelUpTimers.set(dom.levelUpModalBackdropEl, timers);
  }

  return new Promise<void>((resolve) => {
    state.levelUpResolver = resolve;
  });
}

export function presentMoveLearnedModalAsync(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  move: MoveDefinition,
  runGen: number,
  opts?: { autoEquipped?: boolean }
): Promise<void> {
  const { state, dom } = ctx;
  if (!state.openState || runGen !== state.battleRunGen) {
    return Promise.resolve();
  }

  const autoEquipped = Boolean(opts?.autoEquipped);
  const details = buildMoveLearnedModalDetails(unit.nickname, move, { autoEquipped });
  const backdrop = dom.moveLearnedModalBackdropEl;
  const headlineEl = backdrop.querySelector('[data-testid="move-learned-headline"]');
  const sublineEl = backdrop.querySelector('[data-testid="move-learned-subline"]');
  const moveNameEl = backdrop.querySelector('[data-testid="move-learned-name"]');
  const typeCatEl = backdrop.querySelector('[data-testid="move-learned-type-cat"]');
  const statsGridEl = backdrop.querySelector<HTMLElement>('[data-testid="move-learned-stats-grid"]');
  const descEl = backdrop.querySelector('[data-testid="move-learned-description"]');
  const equipNoteEl = backdrop.querySelector<HTMLElement>('[data-testid="move-learned-equip-note"]');

  if (headlineEl) headlineEl.textContent = details.headline;
  if (sublineEl) sublineEl.textContent = `Lv. ${unit.level} ${unit.speciesName}`;
  if (moveNameEl) moveNameEl.textContent = details.moveName;
  if (typeCatEl) {
    typeCatEl.innerHTML = `${renderColoredTypeHtml(details.type)} · ${escapeHudHtml(details.categoryLabel)}`;
  }

  void dom.moveLearnedPortraitView.setPortrait({
    speciesIdOrAssetId: getUnitVisualKey(unit),
    emotion: 'Inspired',
    mirrorHorizontal: false,
  });

  if (statsGridEl) {
    statsGridEl.innerHTML = '';
    const statCells: ReadonlyArray<{ testId: string; label: string; value: string; highlight?: boolean }> = [
      { testId: 'move-learned-stat-dmg', label: details.damageLabel, value: details.damageText, highlight: true },
      { testId: 'move-learned-stat-hit', label: 'HIT', value: details.hitText },
      { testId: 'move-learned-stat-crit', label: 'CRT', value: details.critText },
      { testId: 'move-learned-stat-rng', label: 'RNG', value: details.rangeText },
      { testId: 'move-learned-stat-pp', label: 'PP', value: details.ppText },
    ];
    for (const sc of statCells) {
      const cell = document.createElement('div');
      cell.className = `pmd-prep-stat-box pmd-move-learned-stat-chip${sc.highlight ? ' is-highlight' : ''}`;
      cell.dataset.testid = sc.testId;
      cell.innerHTML = `<span class="pmd-prep-stat-lbl">${escapeHudHtml(sc.label)}</span><strong class="pmd-prep-stat-val">${escapeHudHtml(sc.value)}</strong>`;
      statsGridEl.appendChild(cell);
    }
  }

  if (descEl) descEl.textContent = details.description;
  if (equipNoteEl) {
    equipNoteEl.textContent = details.equipNote;
    equipNoteEl.style.color = autoEquipped ? '#98f8b8' : '#ffd878';
  }

  backdrop.hidden = false;
  ctx.onLayerStateChanged();
  ctx.renderNow();

  return new Promise<void>((resolve) => {
    state.moveLearnedResolver = resolve;
  });
}

export async function grantExpAndHandleLevelUps(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  expGain: number,
  runGen: number
): Promise<void> {
  const { state, audioManager } = ctx;
  if (
    !state.openState ||
    runGen !== state.battleRunGen ||
    unit.faction !== 'player' ||
    unit.defeated ||
    unit.currentHp <= 0 ||
    expGain <= 0
  ) {
    return;
  }

  const rng = getBattleRng(state);
  const { expAdded, levelUps } = awardBattleUnitExp(unit, expGain, rng);
  if (expAdded <= 0) return;

  updateBattleInfoStrip(ctx);
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return;

  for (const lv of levelUps) {
    state.levelUpHistory.push(lv);
    audioManager.playSfx('victory_fanfare');
    await presentLevelUpModalAsync(ctx, unit, lv, runGen);
    if (!state.openState || runGen !== state.battleRunGen) return;
    const autoEqSet = new Set(lv.autoEquippedMoveIds ?? []);
    for (const moveId of lv.newlyLearnedMoveIds) {
      const move = getMoveById(moveId);
      if (!move) continue;
      audioManager.playSfx('victory_fanfare');
      await presentMoveLearnedModalAsync(ctx, unit, move, runGen, {
        autoEquipped: autoEqSet.has(moveId),
      });
      if (!state.openState || runGen !== state.battleRunGen) return;
    }
    updateBattleInfoStrip(ctx);
  }

  if (levelUps.length > 0) {
    await triggerBattleTutorial(ctx, 'levelup_and_growth');
  }
}
