/**
 * Portrait Cell Builder for Deployed Squad `Units` Panel (`battleUnitsRosterCell.ts`)
 */

import type { PmdPortraitEmotion } from '../../assets/pmdAssetLoader';
import { getItemById } from '../../data/index';
import type { BattleUnitState } from '../../engine/combatEngine';
import { createMiniItemIcon } from '../../ui/PmdItemIconGrid';
import { PmdPortraitView } from '../../ui/PmdSpriteCanvas';
import { bindPointerTap } from '../../ui/pointerControls';
import { getUnitVisualKey } from './battleUnitQueries';

export function createRosterUnitPortraitBtn(
  unit: BattleUnitState,
  isSelected: boolean,
  onSelect: () => void,
  signal: AbortSignal
): HTMLButtonElement {
  const isFainted = unit.defeated || unit.currentHp <= 0;
  const btn = document.createElement('button');
  btn.type = 'button';
  const classes = ['pmd-btn', 'pmd-unit-portrait-cell'];
  if (isSelected) classes.push('is-selected', 'is-active');
  if (isFainted) classes.push('is-fainted');
  else if (unit.waited) classes.push('is-benched');
  btn.className = classes.join(' ');
  btn.dataset.testid = `dungeon-units-cell-${unit.id}`;
  btn.setAttribute('aria-label', `${unit.nickname}${isFainted ? ' (Fainted)' : ''}`);

  const inner = document.createElement('span');
  inner.className = 'pmd-unit-portrait-inner';
  const view = new PmdPortraitView({
    pixelScale: 1,
    testId: `dungeon-units-portrait-${unit.id}`,
  });
  inner.appendChild(view.canvas);
  btn.appendChild(inner);

  const visKey = getUnitVisualKey(unit);
  const restEmotion: PmdPortraitEmotion = isFainted ? 'Pain' : isSelected ? 'Happy' : 'Normal';
  void view.setPortrait({ speciesIdOrAssetId: visKey, emotion: restEmotion });

  const rolePip = document.createElement('span');
  if (isFainted) {
    rolePip.className = 'pmd-portrait-pip is-fainted';
    rolePip.textContent = 'KO';
    btn.appendChild(rolePip);
  } else if (unit.isLord) {
    rolePip.className = 'pmd-portrait-pip is-lord';
    rolePip.textContent = '★';
    btn.appendChild(rolePip);
  } else if (!unit.waited) {
    rolePip.className = 'pmd-portrait-pip is-deployed';
    rolePip.textContent = '✓';
    btn.appendChild(rolePip);
  }

  const itemId = unit.heldItemId ?? unit.consumableItemId;
  if (itemId && getItemById(itemId)) {
    const itemPip = document.createElement('span');
    itemPip.className = 'pmd-portrait-pip is-item has-icon';
    itemPip.setAttribute('aria-hidden', 'true');
    itemPip.appendChild(createMiniItemIcon(itemId, { sizePx: 14, cropped: true, decorative: true }));
    btn.appendChild(itemPip);
  }

  if (!isFainted) {
    btn.addEventListener(
      'pointerenter',
      (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        btn.classList.add('is-hovered');
        void view.setPortrait({ speciesIdOrAssetId: visKey, emotion: 'Happy' });
      },
      { signal }
    );
    btn.addEventListener(
      'pointerleave',
      (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        btn.classList.remove('is-hovered');
        if (!isSelected) void view.setPortrait({ speciesIdOrAssetId: visKey, emotion: 'Normal' });
      },
      { signal }
    );
  }

  bindPointerTap(btn, onSelect, { signal });
  return btn;
}
