/**
 * Default Preview Party for the Cutscene Editor (`previewSave.ts`)
 *
 * An Axew hero with default names, Sir Empoleon, and every Part 1A recruit already
 * joined, with all demo chapters cleared. Never written to storage.
 */

import { RAW_CHAPTER_JSON_LIST } from '../chapters/defaultCatalog';
import { buildNewCampaignSaveData } from '../../state/campaignSaveFactory';
import { createPokemonInstance } from '../../state/saveHelpersAndFactory';
import type { SaveData } from '../../types/schemas';

const PREVIEW_RECRUIT_SPECIES_IDS = ['pidgey', 'sewaddle', 'ralts', 'elekid', 'slakoth', 'duskull'];

let cached: SaveData | null = null;

export function buildPreviewSave(): SaveData {
  if (cached) return cached;
  const save = buildNewCampaignSaveData(
    { lordSpeciesId: 'axew', currentChapterId: 'chapter_01', startingLevel: 5 },
    false
  );
  for (const speciesId of PREVIEW_RECRUIT_SPECIES_IDS) {
    try {
      save.roster.push(createPokemonInstance({ speciesId, level: 5 }));
    } catch {
      // Species missing from the registry: skip it in the preview
    }
  }
  save.campaign.completedChapterIds = RAW_CHAPTER_JSON_LIST.map((c) => c.id);
  cached = save;
  return save;
}
