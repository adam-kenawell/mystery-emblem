/**
 * Cutscene Stage DOM Shell & Integer Pixel Canvas Sizing (`cutsceneDomShell.ts`)
 */

import { createPmdButton } from '../../ui/PmdWindow';
import { MAP_DEFAULT_SCALE } from '../../ui/mapZoomController';

export interface CutsceneDomShell {
  rootEl: HTMLElement;
  stageWrapEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  locationBannerEl: HTMLElement;
  introSkipBtn: HTMLButtonElement;
  syncViewportSize: (
    isOpen: () => boolean,
    onResizeRender: () => void
  ) => { viewHeightCss: number; displayScale: number };
  disconnectResize: () => void;
}

export function buildCutsceneDomShell(opts: {
  viewportEl: HTMLElement;
  signal: AbortSignal;
  onIntroSkipTap: () => void;
  onStageTapInterrupt: () => void;
}): CutsceneDomShell {
  const rootEl = document.createElement('section');
  rootEl.id = 'pmd-cutscene-scene';
  rootEl.className = 'pmd-cutscene-scene';
  rootEl.dataset.testid = 'cutscene-scene';
  rootEl.dataset.noLongpress = 'true';
  rootEl.hidden = true;

  const stageWrapEl = document.createElement('div');
  stageWrapEl.className = 'pmd-cutscene-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'pmd-cutscene-canvas pmd-pixelated';
  canvas.dataset.testid = 'cutscene-canvas';
  canvas.style.flexShrink = '0';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D context for CutsceneScene.');
  ctx.imageSmoothingEnabled = false;
  stageWrapEl.appendChild(canvas);

  const locationBannerEl = document.createElement('div');
  locationBannerEl.className =
    'pmd-window pmd-window--compact pmd-window--translucent pmd-cutscene-location-pill';
  locationBannerEl.dataset.testid = 'cutscene-location-banner';

  const introSkipBtn = createPmdButton({
    label: 'Skip',
    className: 'pmd-cutscene-intro-skip-btn',
    testId: 'cutscene-intro-skip-btn',
    ariaLabel: 'Skip cutscene',
    onTap: () => opts.onIntroSkipTap(),
    tapOptions: { signal: opts.signal, stopPropagation: true },
  });
  introSkipBtn.hidden = true;

  rootEl.append(stageWrapEl, locationBannerEl, introSkipBtn);
  opts.viewportEl.appendChild(rootEl);

  stageWrapEl.addEventListener(
    'pointerup',
    (ev: PointerEvent) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      opts.onStageTapInterrupt();
    },
    { signal: opts.signal }
  );

  let resizeObserver: ResizeObserver | null = null;

  const syncViewportSize = (isOpen: () => boolean, onResizeRender: () => void) => {
    const rect = stageWrapEl.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth || 960));
    const h = Math.max(240, Math.round(rect.height || window.innerHeight || 540));
    const displayScale = MAP_DEFAULT_SCALE;
    const nativeW = Math.max(160, Math.ceil(w / displayScale));
    const nativeH = Math.max(120, Math.ceil(h / displayScale));
    if (canvas.width !== nativeW || canvas.height !== nativeH) {
      canvas.width = nativeW;
      canvas.height = nativeH;
    }
    canvas.style.width = `${nativeW * displayScale}px`;
    canvas.style.height = `${nativeH * displayScale}px`;
    ctx.imageSmoothingEnabled = false;

    if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!isOpen()) return;
        syncViewportSize(isOpen, onResizeRender);
        onResizeRender();
      });
      resizeObserver.observe(stageWrapEl);
    }

    return { viewHeightCss: h, displayScale };
  };

  return {
    rootEl,
    stageWrapEl,
    canvas,
    ctx,
    locationBannerEl,
    introSkipBtn,
    syncViewportSize,
    disconnectResize: () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    },
  };
}
