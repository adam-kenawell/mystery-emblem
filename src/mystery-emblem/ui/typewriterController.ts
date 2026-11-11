/**
 * Shared Typewriter Text Reveal Controller (`typewriterController.ts`)
 *
 * Supports inline dialogue tags: `[pause]` / `[pause 1.5]` (seconds), `[shake]…[/shake]`,
 * and `[slow]…[/slow]`. Untagged text renders exactly as plain text.
 */

export interface TypewriterStartOptions {
  targetEl: HTMLElement;
  text: string;
  msPerTick: number;
  charsPerTick?: number;
  instant?: boolean;
  onTick?: () => void;
}

export type RichTextStyle = 'shake' | 'slow';

export type RichTextSegment =
  | { kind: 'text'; text: string; style?: RichTextStyle }
  | { kind: 'pause'; ms: number };

const TAG_RE = /\[(\/?)(pause|shake|slow)(?:\s+([\d.]+))?\]/gi;
const DEFAULT_PAUSE_MS = 500;
const SLOW_EXTRA_TICKS = 3;

export function parseRichDialogueText(raw: string): RichTextSegment[] {
  const out: RichTextSegment[] = [];
  const styleStack: RichTextStyle[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const style = styleStack[styleStack.length - 1];
    out.push(style ? { kind: 'text', text, style } : { kind: 'text', text });
  };
  for (const m of raw.matchAll(TAG_RE)) {
    pushText(raw.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const closing = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    if (tag === 'pause') {
      if (!closing) {
        const secs = m[3] ? Number(m[3]) : NaN;
        out.push({ kind: 'pause', ms: Number.isFinite(secs) ? Math.round(secs * 1000) : DEFAULT_PAUSE_MS });
      }
    } else if (closing) {
      const idx = styleStack.lastIndexOf(tag as RichTextStyle);
      if (idx >= 0) styleStack.splice(idx, 1);
    } else {
      styleStack.push(tag as RichTextStyle);
    }
  }
  pushText(raw.slice(last));
  return out;
}

export function stripRichDialogueTags(raw: string): string {
  return raw.replace(TAG_RE, '');
}

export function prefersReducedMotionEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type RevealUnit = { ch: string; style?: RichTextStyle } | { pauseMs: number };

function toUnits(text: string): RevealUnit[] {
  const units: RevealUnit[] = [];
  for (const seg of parseRichDialogueText(text)) {
    if (seg.kind === 'pause') units.push({ pauseMs: seg.ms });
    else for (const ch of seg.text) units.push(seg.style ? { ch, style: seg.style } : { ch });
  }
  return units;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class TypewriterController {
  private units: RevealUnit[] = [];
  private revealed = 0;
  private waitMs = 0;
  private slowDebt = 0;
  private msPerTick = 10;
  private charsPerTick = 2;
  private timerId: number | null = null;
  private activeTargetEl: HTMLElement | null = null;
  private onTick?: () => void;

  public isAnimating(): boolean {
    return this.timerId !== null && this.revealed < this.units.length;
  }

  public stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public completeImmediately(): void {
    this.stop();
    this.revealed = this.units.length;
    this.render();
  }

  public start(options: TypewriterStartOptions): void {
    this.stop();
    this.activeTargetEl = options.targetEl;
    this.units = toUnits(options.text);
    this.msPerTick = options.msPerTick;
    this.charsPerTick = Math.max(1, options.charsPerTick ?? 2);
    this.onTick = options.onTick;
    this.waitMs = 0;
    this.slowDebt = 0;

    if (options.instant || options.msPerTick <= 0 || this.units.length === 0) {
      this.revealed = this.units.length;
      this.render();
      return;
    }

    this.revealed = 0;
    this.render();
    this.timerId = window.setInterval(() => this.tick(), options.msPerTick);
  }

  public updateTextPreservingProgress(targetEl: HTMLElement, nextText: string): void {
    const wasComplete = !this.isAnimating();
    this.activeTargetEl = targetEl;
    this.units = toUnits(nextText);
    this.revealed = wasComplete ? this.units.length : Math.min(this.revealed, this.units.length);
    this.render();
  }

  private tick(): void {
    if (this.waitMs > 0) {
      this.waitMs -= this.msPerTick;
      return;
    }
    if (this.slowDebt > 0) {
      this.slowDebt -= 1;
      return;
    }
    let budget = this.charsPerTick;
    let revealedAny = false;
    while (budget > 0 && this.revealed < this.units.length) {
      const unit = this.units[this.revealed]!;
      if ('pauseMs' in unit) {
        this.revealed += 1;
        this.waitMs = unit.pauseMs;
        break;
      }
      this.revealed += 1;
      revealedAny = true;
      if (unit.style === 'slow') {
        this.slowDebt = SLOW_EXTRA_TICKS;
        break;
      }
      budget -= 1;
    }
    this.render();
    if (revealedAny) this.onTick?.();
    if (this.revealed >= this.units.length) this.stop();
  }

  private render(): void {
    const el = this.activeTargetEl;
    if (!el) return;
    const shown = this.units.slice(0, this.revealed);
    if (!shown.some((u) => 'ch' in u && u.style)) {
      el.textContent = shown.map((u) => ('ch' in u ? u.ch : '')).join('');
      return;
    }
    let html = '';
    let openStyle: RichTextStyle | undefined;
    for (const u of shown) {
      if (!('ch' in u)) continue;
      if (u.style !== openStyle) {
        if (openStyle) html += '</span>';
        if (u.style) html += `<span class="pmd-text-${u.style}">`;
        openStyle = u.style;
      }
      html += escapeHtml(u.ch);
    }
    if (openStyle) html += '</span>';
    el.innerHTML = html;
  }
}
