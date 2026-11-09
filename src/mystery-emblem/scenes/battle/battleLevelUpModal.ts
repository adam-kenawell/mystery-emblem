/**
 * Fire Emblem-Style Level-Up Modal Presentation & EXP Award Sequencer
 */

import { getMoveById } from '../../data/index';
import type { BattleUnitState } from '../../engine/combatEngine';
import { awardBattleUnitExp, type LevelUpResult } from '../../engine/progressionEngine';
import { waitBattleMs } from './battleBannersAndTransitions';
import { spawnFloatingText } from './battleFloatingCallouts';
import { updateBattleInfoStrip } from './battleHudCards';
import { triggerBattleTutorial } from './battleTutorialIntegration';
import type { BattleControllerContext } from './battleTypesAndState';
import { getUnitVisualKey } from './battleUnitQueries';

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
    const notes: string[] = [];
    if (roll.newlyLearnedMoveIds.length > 0) {
      const moveNames = roll.newlyLearnedMoveIds
        .map((mId) => getMoveById(mId)?.name ?? mId)
        .join(', ');
      notes.push(`Learned ${moveNames}!`);
    }
    if (roll.canPromoteWithStoneNow) {
      notes.push(`★ Evolution Stone Ready at Lv. ${roll.newLevel}!`);
    }
    if (notes.length > 0) {
      extraNotesEl.textContent = notes.join(' · ');
      extraNotesEl.hidden = false;
    } else {
      extraNotesEl.textContent = '';
      extraNotesEl.hidden = true;
    }
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

  const rng = state.customRng ?? Math.random;
  const { expAdded, levelUps } = awardBattleUnitExp(unit, expGain, rng);
  if (expAdded <= 0) return;

  spawnFloatingText(state, dom, unit.x, unit.y, `+${expAdded} EXP`, '#7ce8ff', 900);
  updateBattleInfoStrip(ctx);
  await waitBattleMs(state, 220);
  if (!state.openState || runGen !== state.battleRunGen) return;

  for (const lv of levelUps) {
    state.levelUpHistory.push(lv);
    audioManager.playSfx('victory_fanfare');
    spawnFloatingText(state, dom, unit.x, unit.y, `LEVEL UP! Lv.${lv.newLevel}`, '#ffe066', 1100);
    await presentLevelUpModalAsync(ctx, unit, lv, runGen);
    if (!state.openState || runGen !== state.battleRunGen) return;
    updateBattleInfoStrip(ctx);
  }

  if (levelUps.length > 0) {
    await triggerBattleTutorial(ctx, 'levelup_and_evolution');
  }
}
