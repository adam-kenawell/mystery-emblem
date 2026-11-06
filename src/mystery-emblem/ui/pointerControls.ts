/**
 * Unified Pointer Event Controls & Back-Stack Controller (Rule 2)
 *
 * Strictly enforces PC (Mouse + Right-Click) and Mobile (Touch + Long-Press + Corner Button)
 * parity using unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
 * Zero keyboard event listeners (`keydown`, `keyup`, `keypress`) are ever registered.
 */

export interface BindPointerTapOptions {
  signal?: AbortSignal;
  stopPropagation?: boolean;
  maxMovePx?: number;
}

export function bindPointerTap(
  el: HTMLElement | null,
  handler: (ev: PointerEvent) => void,
  options?: BindPointerTapOptions
): void {
  if (!el) return;
  const signal = options?.signal;
  const maxMovePx = options?.maxMovePx ?? 12;

  let startX = 0;
  let startY = 0;
  let activePointerId: number | null = null;

  el.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      if (options?.stopPropagation) {
        ev.stopPropagation();
      }
      activePointerId = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
    },
    signal ? { signal } : undefined
  );

  el.addEventListener(
    'pointerup',
    (ev: PointerEvent) => {
      if (activePointerId !== ev.pointerId) return;
      activePointerId = null;
      if (options?.stopPropagation) {
        ev.stopPropagation();
      }
      if ((el as HTMLButtonElement).disabled) return;
      const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (moved <= maxMovePx) {
        handler(ev);
      }
    },
    signal ? { signal } : undefined
  );

  el.addEventListener(
    'pointercancel',
    () => {
      activePointerId = null;
    },
    signal ? { signal } : undefined
  );
}

export interface BackGestureOptions {
  signal?: AbortSignal;
  longPressMs?: number;
  ignoreSelector?: string;
}

/**
 * Binds PC Right-Click (`contextmenu`) and Mobile Touch Long-Press (`520ms`) to a unified
 * System Menu / Back callback.
 */
export function bindBackGestureSurface(
  surfaceEl: HTMLElement | null,
  onBackOrMenu: () => void,
  options?: BackGestureOptions
): void {
  if (!surfaceEl) return;
  const signal = options?.signal;
  const longPressMs = options?.longPressMs ?? 520;
  const ignoreSelector =
    options?.ignoreSelector ?? 'button, input, select, textarea, [data-no-longpress="true"]';

  surfaceEl.addEventListener(
    'contextmenu',
    (ev: MouseEvent) => {
      ev.preventDefault();
      onBackOrMenu();
    },
    signal ? { signal } : undefined
  );

  let longPressTimer: number | null = null;
  let lpStartX = 0;
  let lpStartY = 0;

  const cancelTimer = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  surfaceEl.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.pointerType !== 'touch') return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest(ignoreSelector)) return;
      lpStartX = ev.clientX;
      lpStartY = ev.clientY;
      cancelTimer();
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        onBackOrMenu();
      }, longPressMs);
    },
    signal ? { signal } : undefined
  );

  surfaceEl.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (longPressTimer !== null && Math.hypot(ev.clientX - lpStartX, ev.clientY - lpStartY) > 12) {
        cancelTimer();
      }
    },
    signal ? { signal } : undefined
  );

  surfaceEl.addEventListener('pointerup', cancelTimer, signal ? { signal } : undefined);
  surfaceEl.addEventListener('pointercancel', cancelTimer, signal ? { signal } : undefined);
}

export interface BackLayerEntry {
  id: string;
  isActive: () => boolean;
  onBack: () => void;
}

/**
 * Coordinates LIFO dismissal of modals/overlays/menus and keeps the persistent corner
 * Menu / Back button label synchronized across PC and mobile viewports.
 */
export class BackStackController {
  private readonly layers: BackLayerEntry[] = [];
  private readonly cornerBtn: HTMLButtonElement | null;
  private readonly onOpenRootMenu: () => void;

  constructor(cornerBtn: HTMLButtonElement | null, onOpenRootMenu: () => void) {
    this.cornerBtn = cornerBtn;
    this.onOpenRootMenu = onOpenRootMenu;
  }

  public registerLayer(entry: BackLayerEntry): void {
    const existingIdx = this.layers.findIndex((l) => l.id === entry.id);
    if (existingIdx >= 0) {
      this.layers.splice(existingIdx, 1);
    }
    this.layers.push(entry);
    this.syncButtonLabel();
  }

  public hasActiveLayer(): boolean {
    return this.layers.some((l) => l.isActive());
  }

  public syncButtonLabel(): void {
    if (!this.cornerBtn) return;
    const isSubLayerOpen = this.hasActiveLayer();
    this.cornerBtn.textContent = isSubLayerOpen ? 'Back' : 'Menu';
    this.cornerBtn.setAttribute(
      'aria-label',
      isSubLayerOpen ? 'Back or Close' : 'Open System Menu'
    );
  }

  public triggerMenuOrBack(): void {
    // Walk from top-most registered priority layer down to base layer
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i]!;
      if (layer.isActive()) {
        layer.onBack();
        this.syncButtonLabel();
        return;
      }
    }
    this.onOpenRootMenu();
    this.syncButtonLabel();
  }
}
