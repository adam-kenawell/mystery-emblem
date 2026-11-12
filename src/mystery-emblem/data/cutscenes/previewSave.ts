/**
 * Default Preview Party for the Cutscene Editor (`previewSave.ts`)
 *
 * An Axew hero with default names, Quaquaval, and every Act 1 recruit already
 * joined, with all demo chapters cleared. Never written to storage.
 */

import { RAW_CHAPTER_JSON_LIST } from '../chapters/defaultCatalog';
import { buildNewCampaignSaveData } from '../../state/campaignSaveFactory';
import { createPokemonInstance } from '../../state/saveHelpersAndFactory';
import type { SaveData } from '../../types/schemas';

const PREVIEW_RECRUIT_SPECIES_IDS = [
  'mentor_quaquaval',
  'smoliv',
  'machop',
  'slakoth',
  'starly',
  'caterpie',
  'pawmi',
  'honedge',
  'sandile',
];

let cached: SaveData | null = null;

export function buildPreviewSave(): SaveData {
  if (cached) return cached;
  const save = buildNewCampaignSaveData(
    { lordSpeciesId: 'axew', currentChapterId: 'chapter_02', startingLevel: 5 },
    false
  );
  for (const speciesId of PREVIEW_RECRUIT_SPECIES_IDS) {
    try {
      const level = speciesId === 'mentor_quaquaval' ? 12 : 5;
      save.roster.push(createPokemonInstance({ speciesId, level }));
    } catch {
      // Species missing from the registry: skip it in the preview
    }
  }
  save.campaign.completedChapterIds = RAW_CHAPTER_JSON_LIST.map((c) => c.id);
  cached = save;
  return save;
}
