/**
 * Mystery Emblem - Audio Settings Persistence, Crossfade & Browser Unlock Helpers (`audioFadeAndSettings.ts`)
 *
 * Strictly obeys Rule 2 (`pointerdown` / `click` unlock ONLY; zero keyboard listeners).
 */

export const AUDIO_SETTINGS_STORAGE_KEY = 'mystery_emblem_audio_v2';
const LEGACY_AUDIO_SETTINGS_STORAGE_KEY = 'mystery_emblem_audio_v1';

export const DEFAULT_BGM_VOLUME = 0.25;
export const DEFAULT_SFX_VOLUME = 0.9;

export interface AudioSettings {
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

export function clampAudio01(val: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

export function loadPersistedAudioSettings(): AudioSettings {
  const settings: AudioSettings = {
    muted: false,
    bgmVolume: DEFAULT_BGM_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
  };
  if (typeof window === 'undefined') return settings;
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      if (typeof parsed.muted === 'boolean') settings.muted = parsed.muted;
      if (typeof parsed.bgmVolume === 'number') {
        settings.bgmVolume = clampAudio01(parsed.bgmVolume, DEFAULT_BGM_VOLUME);
      }
      if (typeof parsed.sfxVolume === 'number') {
        settings.sfxVolume = clampAudio01(parsed.sfxVolume, DEFAULT_SFX_VOLUME);
      }
      return settings;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_AUDIO_SETTINGS_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw) as Partial<AudioSettings>;
      if (typeof legacyParsed.muted === 'boolean') settings.muted = legacyParsed.muted;
      savePersistedAudioSettings(settings);
    }
  } catch {
    // Ignore corrupt or unavailable localStorage
  }
  return settings;
}

export function savePersistedAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function disposeAudioElement(
  audio: HTMLAudioElement,
  fadingOutElements: Map<HTMLAudioElement, number>
): void {
  const timer = fadingOutElements.get(audio);
  if (timer !== undefined) {
    window.clearInterval(timer);
    fadingOutElements.delete(audio);
  }
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    // Ignore cleanup errors
  }
}

export function retireFadingAudioElement(
  audio: HTMLAudioElement,
  fadeMs: number,
  fadingOutElements: Map<HTMLAudioElement, number>
): void {
  const startVol = audio.volume;
  if (fadeMs <= 0 || audio.paused || startVol <= 0.01) {
    disposeAudioElement(audio, fadingOutElements);
    return;
  }

  const stepMs = 25;
  const steps = Math.max(1, Math.round(fadeMs / stepMs));
  let currentStep = 0;

  const timer = window.setInterval(() => {
    currentStep++;
    const ratio = Math.max(0, 1 - currentStep / steps);
    audio.volume = Math.max(0, Math.min(1, startVol * ratio));
    if (ratio <= 0.01) disposeAudioElement(audio, fadingOutElements);
  }, stepMs);

  fadingOutElements.set(audio, timer);
}

export function startAudioFadeInTimer(params: {
  audio: HTMLAudioElement;
  fadeMs: number;
  getEffectiveTargetVolume: () => number;
  isStillActive: () => boolean;
  onComplete: () => void;
}): number | null {
  const { audio, fadeMs, getEffectiveTargetVolume, isStillActive, onComplete } = params;
  const target = getEffectiveTargetVolume();
  if (fadeMs <= 0 || target <= 0) {
    audio.volume = target;
    return null;
  }

  const stepMs = 25;
  const steps = Math.max(1, Math.round(fadeMs / stepMs));
  let currentStep = 0;

  return window.setInterval(() => {
    if (!isStillActive()) {
      onComplete();
      return;
    }
    currentStep++;
    const liveTarget = getEffectiveTargetVolume();
    const ratio = Math.min(1, currentStep / steps);
    audio.volume = Math.max(0, Math.min(1, liveTarget * ratio));
    if (ratio >= 1) onComplete();
  }, stepMs);
}

export function bindAudioBrowserHooks(params: {
  onUserGesture: () => void;
  onVisibilityHidden: () => void;
  onVisibilityShown: () => void;
}): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('pointerdown', params.onUserGesture, { capture: true, passive: true });
  window.addEventListener('click', params.onUserGesture, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) params.onVisibilityHidden();
    else params.onVisibilityShown();
  });
}
