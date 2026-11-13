/**
 * Fire Emblem-Style Level-Up Modal, New-Move Learned Modal & EXP Award Sequencer
 */

import { getMoveById } from '../../data/index';
import type { BattleUnitState } from '../../engine/combatEngine';
import { awardBattleUnitExp, type LevelUpResult } from '../../engine/progressionEngine';
import type { MoveDefinition } from '../../types/schemas';
import { renderColoredTypeHtml } from '../../ui/typeColors';
import { waitBattleMs } from './battleBannersAndTransitions';
import { spawnFloatingText } from './battleFloatingCallouts';
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
  move: MoveDefinition
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
    } else {
      damageLabel = 'EFF';
      damageText = '--';
    }
  }
  return {
    headline: `${unitNickname} learned ${move.name}!`,
    moveName: move.name,
    type: move.type,
    categoryLabel: move.category,
    damageLabel,
    damageText,
    hitText: `${move.hit}%`,
    critText: isSupport ? '--' : `${move.crit}%`,
    rangeText,
    ppText: `${move.pp}`,
    description: move.description,
    equipNote: 'Equip this move after the battle ends in the Units menu.',
  };
}

export function dismissLevelUpModal(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
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
  const { state, dom } = ctx;
  if (!state.openState || runGen !== state.battleRunGen) {
    return Promise.resolve();
  }

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
      const cell = document.createElement('div');
      cell.className = 'pmd-prep-stat-cell';
      cell.dataset.testid = `levelup-stat-${sd.key}`;
      if (gain > 0) {
        cell.style.borderColor = '#f8d048';
      }
      const valText =
        gain > 0 ? `${roll.statsAfter[sd.key]} (+${gain})` : `${roll.statsAfter[sd.key]}`;
      cell.innerHTML = `<span>${sd.label}</span><strong style="${gain > 0 ? 'color:#ffe066;' : ''}">${valText}</strong>`;
      statsGridEl.appendChild(cell);
    }
    const movCell = document.createElement('div');
    movCell.className = 'pmd-prep-stat-cell';
    movCell.dataset.testid = 'levelup-stat-mov';
    movCell.innerHTML = `<span>MOV</span><strong>${roll.statsAfter.mov}</strong>`;
    statsGridEl.appendChild(movCell);
  }

  if (extraNotesEl) {
    extraNotesEl.textContent = '';
    extraNotesEl.hidden = true;
  }

  dom.levelUpModalBackdropEl.hidden = false;
  ctx.onLayerStateChanged();
  ctx.renderNow();

  return new Promise<void>((resolve) => {
    state.levelUpResolver = resolve;
    if (state.fastMode && !state.pauseOnLevelUpInFastMode) {
      window.setTimeout(() => {
        if (state.levelUpResolver === resolve) {
          dismissLevelUpModal(ctx);
        }
      }, 45);
    }
  });
}

export function presentMoveLearnedModalAsync(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  move: MoveDefinition,
  runGen: number
): Promise<void> {
  const { state, dom } = ctx;
  if (!state.openState || runGen !== state.battleRunGen) {
    return Promise.resolve();
  }

  const details = buildMoveLearnedModalDetails(unit.nickname, move);
  const backdrop = dom.moveLearnedModalBackdropEl;
  const headlineEl = backdrop.querySelector('[data-testid="move-learned-headline"]');
  const sublineEl = backdrop.querySelector('[data-testid="move-learned-subline"]');
  const moveNameEl = backdrop.querySelector('[data-testid="move-learned-name"]');
  const typeCatEl = backdrop.querySelector('[data-testid="move-learned-type-cat"]');
  const statsGridEl = backdrop.querySelector<HTMLElement>('[data-testid="move-learned-stats-grid"]');
  const descEl = backdrop.querySelector('[data-testid="move-learned-description"]');
  const equipNoteEl = backdrop.querySelector('[data-testid="move-learned-equip-note"]');

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
      { testId: 'move-learned-stat-crit', label: 'CRIT', value: details.critText },
      { testId: 'move-learned-stat-rng', label: 'RNG', value: details.rangeText },
      { testId: 'move-learned-stat-pp', label: 'PP', value: details.ppText },
    ];
    for (const sc of statCells) {
      const cell = document.createElement('div');
      cell.className = 'pmd-prep-stat-cell';
      cell.dataset.testid = sc.testId;
      if (sc.highlight) {
        cell.style.borderColor = '#f8d048';
      }
      cell.innerHTML = `<span>${escapeHudHtml(sc.label)}</span><strong style="${sc.highlight ? 'color:#ffe066;' : ''}">${escapeHudHtml(sc.value)}</strong>`;
      statsGridEl.appendChild(cell);
    }
  }

  if (descEl) descEl.textContent = details.description;
  if (equipNoteEl) equipNoteEl.textContent = details.equipNote;

  backdrop.hidden = false;
  ctx.onLayerStateChanged();
  ctx.renderNow();

  return new Promise<void>((resolve) => {
    state.moveLearnedResolver = resolve;
    if (state.fastMode && !state.pauseOnLevelUpInFastMode) {
      window.setTimeout(() => {
        if (state.moveLearnedResolver === resolve) {
          dismissMoveLearnedModal(ctx);
        }
      }, 45);
    }
  });
}

export async function grantExpAndHandleLevelUps(
  ctx: BattleControllerContext,
  unit: BattleUnitState,
  expGain: number,
  runGen: number
): Promise<void> {
  const { state, dom, audioManager } = ctx;
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

  spawnFloatingText(state, dom, unit.x, unit.y, `+${expAdded} EXP`, '#7ce8ff', 900);
  updateBattleInfoStrip(ctx);
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return;

  for (const lv of levelUps) {
    state.levelUpHistory.push(lv);
    audioManager.playSfx('victory_fanfare');
    await presentLevelUpModalAsync(ctx, unit, lv, runGen);
    if (!state.openState || runGen !== state.battleRunGen) return;
    for (const moveId of lv.newlyLearnedMoveIds) {
      const move = getMoveById(moveId);
      if (!move) continue;
      audioManager.playSfx('victory_fanfare');
      await presentMoveLearnedModalAsync(ctx, unit, move, runGen);
      if (!state.openState || runGen !== state.battleRunGen) return;
    }
    updateBattleInfoStrip(ctx);
  }

  if (levelUps.length > 0) {
    await triggerBattleTutorial(ctx, 'levelup_and_growth');
  }
}
