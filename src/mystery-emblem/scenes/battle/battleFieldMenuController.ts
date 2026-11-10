/**
 * Cursor-Anchored Translucent 6-Option Dungeon Field Menu Controller (`dungeon-field-menu`)
 */

import { tileCenterToClientPoint } from '../../ui/gridViewportMath';
import { syncHudControls } from './battleDangerAndViewportState';
import { renderFieldSubmodalContents } from './battleFieldSubmodalViews';
import { updateBattleInfoStrip } from './battleHudCards';
import type { BattleFieldMenuSubView } from './battlePublicTypes';
import type { BattleControllerContext } from './battleTypesAndState';

export function openSystemMenu(
  ctx: BattleControllerContext,
  subView: BattleFieldMenuSubView = 'root',
  tapClientX?: number,
  tapClientY?: number
): void {
  const { state, dom, audioManager, tutorialOverlay } = ctx;
  state.systemMenuOpen = true;
  if (
    typeof tapClientX === 'number' &&
    Number.isFinite(tapClientX) &&
    typeof tapClientY === 'number' &&
    Number.isFinite(tapClientY)
  ) {
    state.lastFieldMenuAnchorClient = { x: tapClientX, y: tapClientY };
  } else if (state.phase !== 'dungeon_prep') {
    const pt = tileCenterToClientPoint(
      dom.canvas,
      state.cam,
      state.inspectedTile.x,
      state.inspectedTile.y
    );
    state.lastFieldMenuAnchorClient = { x: pt.clientX, y: pt.clientY };
  } else {
    state.lastFieldMenuAnchorClient = null;
  }
  syncHudControls(state, dom);
  dom.systemMenuBackdropEl.hidden = false;
  setSystemMenuSubView(ctx, subView, { skipLayerNotify: true });
  updateBattleInfoStrip(ctx);
  audioManager.playSfx('select');
  ctx.onLayerStateChanged();
  if (subView === 'root') {
    tutorialOverlay?.notifyActionCompleted('battle_open_field_menu');
  }
}

export function closeSystemMenu(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  state.systemMenuOpen = false;
  state.systemMenuSubView = 'root';
  dom.systemMenuBackdropEl.hidden = true;
  dom.systemMenuBackdropEl.classList.remove('is-submodal');
  dom.fieldSubmodalCardEl.hidden = true;
  dom.fieldSubmodalCardEl.classList.remove('is-units-panel');
  dom.fieldSubmodalCardEl.innerHTML = '';
  updateBattleInfoStrip(ctx);
  ctx.onLayerStateChanged();
}

export function positionFieldMenuCard(ctx: BattleControllerContext): void {
  const { state, dom } = ctx;
  const stageRect = dom.canvasStageEl.getBoundingClientRect();
  const stageW = stageRect.width || dom.canvasStageEl.clientWidth || 640;
  const stageH = stageRect.height || dom.canvasStageEl.clientHeight || 480;
  const menuW = dom.fieldMenuCardEl.offsetWidth || 228;
  const menuH = dom.fieldMenuCardEl.offsetHeight || 338;
  const EDGE_PAD = 8;
  const CURSOR_GAP_X = 12;
  const CURSOR_OFFSET_Y = 14;

  let left: number;
  let top: number;

  if (state.lastFieldMenuAnchorClient) {
    const localX = state.lastFieldMenuAnchorClient.x - stageRect.left;
    const localY = state.lastFieldMenuAnchorClient.y - stageRect.top;

    left = localX + CURSOR_GAP_X;
    if (left + menuW > stageW - EDGE_PAD) {
      const flippedLeft = localX - menuW - CURSOR_GAP_X;
      if (flippedLeft >= EDGE_PAD || localX > stageW / 2) {
        left = flippedLeft;
      }
    }
    left = Math.max(EDGE_PAD, Math.min(Math.max(EDGE_PAD, stageW - menuW - EDGE_PAD), left));

    const overlapsTopRightCornerBtn =
      state.phase === 'dungeon_prep' && left + menuW > stageW - 136;
    const overlapsTopLeftCornerBtn = left < 148;
    const minTop =
      overlapsTopRightCornerBtn || overlapsTopLeftCornerBtn
        ? stageH <= 500
          ? 56
          : 64
        : EDGE_PAD;
    const maxTop = Math.max(EDGE_PAD, stageH - menuH - EDGE_PAD);
    top = Math.max(Math.min(minTop, maxTop), Math.min(maxTop, localY - CURSOR_OFFSET_Y));
  } else {
    left = Math.max(EDGE_PAD, stageW - menuW - 12);
    const maxTop = Math.max(EDGE_PAD, stageH - menuH - EDGE_PAD);
    top = Math.min(stageH <= 500 ? 56 : 64, maxTop);
  }

  dom.fieldMenuCardEl.style.left = `${Math.round(left)}px`;
  dom.fieldMenuCardEl.style.top = `${Math.round(top)}px`;
}

export function setSystemMenuSubView(
  ctx: BattleControllerContext,
  subView: BattleFieldMenuSubView,
  opts?: { skipLayerNotify?: boolean }
): void {
  const { state, dom } = ctx;
  state.systemMenuSubView = subView;
  syncHudControls(state, dom);

  if (subView === 'root') {
    dom.systemMenuBackdropEl.classList.remove('is-submodal');
    dom.fieldMenuCardEl.hidden = false;
    dom.fieldSubmodalCardEl.hidden = true;
    dom.fieldSubmodalCardEl.classList.remove('is-units-panel');
    dom.fieldSubmodalCardEl.removeAttribute('data-testid');
    dom.fieldSubmodalCardEl.innerHTML = '';
    if (!dom.systemMenuBackdropEl.hidden) {
      positionFieldMenuCard(ctx);
    }
    if (!opts?.skipLayerNotify) {
      ctx.onLayerStateChanged();
    }
    return;
  }

  dom.systemMenuBackdropEl.classList.add('is-submodal');
  dom.fieldMenuCardEl.hidden = true;
  dom.fieldSubmodalCardEl.hidden = false;
  renderFieldSubmodalContents(ctx, subView, {
    closeSystemMenu: () => closeSystemMenu(ctx),
    setSubView: (next) => setSystemMenuSubView(ctx, next),
  });
  if (!opts?.skipLayerNotify) {
    ctx.onLayerStateChanged();
  }
}
