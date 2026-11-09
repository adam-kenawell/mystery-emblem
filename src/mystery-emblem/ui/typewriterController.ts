/**
 * Shared Typewriter Text Reveal Controller (`typewriterController.ts`)
 */

export interface TypewriterStartOptions {
  targetEl: HTMLElement;
  text: string;
  msPerTick: number;
  charsPerTick?: number;
  instant?: boolean;
  onTick?: () => void;
}

export function prefersReducedMotionEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export class TypewriterController {
  private fullText = '';
  private revealedChars = 0;
  private timerId: number | null = null;
  private activeTargetEl: HTMLElement | null = null;

  public isAnimating(): boolean {
    return this.timerId !== null && this.revealedChars < this.fullText.length;
  }

  public stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public completeImmediately(): void {
    this.stop();
    this.revealedChars = this.fullText.length;
    if (this.activeTargetEl) {
      this.activeTargetEl.textContent = this.fullText;
    }
  }

  public start(options: TypewriterStartOptions): void {
    this.stop();
    this.activeTargetEl = options.targetEl;
    this.fullText = options.text;

    if (options.instant || options.msPerTick <= 0 || options.text.length === 0) {
      this.revealedChars = options.text.length;
      options.targetEl.textContent = options.text;
      return;
    }

    const step = Math.max(1, options.charsPerTick ?? 2);
    this.revealedChars = 0;
    options.targetEl.textContent = '';

    this.timerId = window.setInterval(() => {
      this.revealedChars = Math.min(this.fullText.length, this.revealedChars + step);
      if (this.activeTargetEl) {
        this.activeTargetEl.textContent = this.fullText.slice(0, this.revealedChars);
      }
      options.onTick?.();
      if (this.revealedChars >= this.fullText.length) {
        this.stop();
      }
    }, options.msPerTick);
  }

  public updateTextPreservingProgress(targetEl: HTMLElement, nextText: string): void {
    const wasComplete = !this.isAnimating();
    this.activeTargetEl = targetEl;
    this.fullText = nextText;
    if (wasComplete) {
      this.revealedChars = nextText.length;
      targetEl.textContent = nextText;
    }
  }
}
