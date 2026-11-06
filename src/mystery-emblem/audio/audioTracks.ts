/**
 * Mystery Emblem — PMD: Explorers of Sky Audio Track Manifest
 *
 * Auto-discovers all audio tracks dropped into `/assets/audio/` via Vite `import.meta.glob`
 * (streamed lazily on demand via URL—zero upfront bundle memory bloat) and provides semantic
 * scene/cutscene cue aliases that resolve cleanly as tracks are added.
 */

export interface PmdBgmTrack {
  /** Normalized 3-digit track number (e.g. `"004"`) or slug if unnumbered */
  id: string;
  trackNumber: string | null;
  title: string;
  fileName: string;
  url: string;
  /** True for looping background tracks; false for one-shot jingles/fanfares */
  loop: boolean;
}

const rawAudioModules = import.meta.glob<string>(
  '/assets/audio/*.{mp3,webm,ogg,opus,m4a,wav}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
);

/** Track numbers that are one-shot fanfares/jingles rather than continuous loops */
const NON_LOOPING_TRACK_IDS = new Set<string>(['007', '010', '013', '028']);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseAudioEntry(globPath: string, url: string): PmdBgmTrack {
  const fileName = globPath.split('/').pop() ?? globPath;
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const numberedMatch = withoutExt.match(/^(\d{1,3})\.\s*(.+)$/);

  if (numberedMatch) {
    const trackNumber = numberedMatch[1].padStart(3, '0');
    const title = numberedMatch[2].trim();
    return {
      id: trackNumber,
      trackNumber,
      title,
      fileName,
      url,
      loop: !NON_LOOPING_TRACK_IDS.has(trackNumber),
    };
  }

  return {
    id: slugify(withoutExt),
    trackNumber: null,
    title: withoutExt.trim(),
    fileName,
    url,
    loop: true,
  };
}

export const PMD_BGM_TRACKS: ReadonlyArray<PmdBgmTrack> = Object.entries(rawAudioModules)
  .map(([globPath, url]) => parseAudioEntry(globPath, url))
  .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));

const tracksById = new Map<string, PmdBgmTrack>();
const tracksBySlug = new Map<string, PmdBgmTrack>();

for (const track of PMD_BGM_TRACKS) {
  tracksById.set(track.id.toLowerCase(), track);
  tracksBySlug.set(slugify(track.title), track);
}

/**
 * Semantic cue aliases used by scenes, menus, and `DialogueScript` lines.
 * Maps readable cue names to track IDs (with ordered fallbacks if a rip is not yet present).
 */
export const PMD_BGM_ALIASES: Readonly<Record<string, ReadonlyArray<string>>> = {
  exploration_theme: ['001'],
  top_menu: ['002', '001'],
  personality_quiz: ['003', '002'],
  beach_at_dusk: ['004', '015'],
  beach_cave: ['005'],
  depths_of_the_pit: ['006'],
  title_fanfare: ['007', '001'],
  wigglytuff_guild: ['008', '011'],
  guildmaster: ['009'],
  goodnight: ['010'],
  drenched_bluff: ['012'],
  job_clear: ['013'],
  treasure_town: ['014', '008'],
  heartwarming: ['015', '004'],
  growing_anxiety: ['016', '039'],
  oh_no: ['017', '022'],
  mt_bristle: ['018'],
  boss_battle: ['019', '038'],
  time_gear_remix: ['020', '006'],
  gatekeepers: ['021'],
  outlaw: ['022', '019'],
  saw_something_again: ['023', '006'],
  waterfall_cave: ['024'],
  kecleon_shop: ['025', '027'],
  team_skull: ['026'],
  spinda_cafe: ['027'],
  apple_woods: ['029'],
  craggy_coast: ['030'],
  cave_and_side_path: ['031'],
  mt_horn: ['032'],
  foggy_forest: ['033'],
  steam_cave: ['034'],
  upper_steam_cave: ['035'],
  amp_plains: ['036'],
  far_amp_plains: ['037'],
  monster_house: ['038', '019'],
  rising_fear: ['039', '016'],
};

export function resolveBgmTrack(idOrAlias: string | null | undefined): PmdBgmTrack | null {
  if (!idOrAlias) return null;
  const key = idOrAlias.trim().toLowerCase();
  if (!key) return null;

  const aliasTargets = PMD_BGM_ALIASES[key];
  if (aliasTargets) {
    for (const candidate of aliasTargets) {
      const found = tracksById.get(candidate.toLowerCase());
      if (found) return found;
    }
  }

  // Direct ID match (e.g. "004" or "4")
  const direct = tracksById.get(key);
  if (direct) return direct;

  if (/^\d{1,3}$/.test(key)) {
    const padded = key.padStart(3, '0');
    const byPadded = tracksById.get(padded);
    if (byPadded) return byPadded;
  }

  return tracksBySlug.get(slugify(key)) ?? null;
}
