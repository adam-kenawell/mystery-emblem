/**
 * Shared Dialogue Speaker Helpers for Chapter Intro/Outro & Story Cutscene Scripts (`scriptHelpers.ts`)
 */

import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  COMMANDER_DEINO_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
  KECLEON_PMD_ASSET_ID,
} from '../campaignConfig';
import { getSpeciesById } from '../index';
import type { DialogueSpeakerRef } from '../../engine/speakerResolver';
import type { SaveData } from '../../types/schemas';

export const SERPERIOR_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  speciesName: 'Serperior',
  nickname: 'Chancellor Serperior',
};

export const MILOTIC_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
  speciesName: 'Milotic',
  nickname: 'High Seeress Milotic',
};

export const KECLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KECLEON_PMD_ASSET_ID,
  speciesName: 'Kecleon',
  nickname: 'Kecleon',
};

export const ARON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: '0304',
  speciesName: 'Aron',
  nickname: 'Captain Aron',
};

export const DEINO_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: COMMANDER_DEINO_PMD_ASSET_ID,
  speciesName: 'Deino',
  nickname: 'Commander Deino',
};

export function findRecruitSpeaker(
  save: SaveData | null,
  fallbackSpeciesId: string
): DialogueSpeakerRef {
  if (save) {
    const fallbackSp = getSpeciesById(fallbackSpeciesId);
    const matched = save.roster.find((u) => {
      if (u.speciesId === fallbackSpeciesId) return true;
      const sp = getSpeciesById(u.speciesId);
      return Boolean(fallbackSp && sp && sp.lineId === fallbackSp.lineId);
    });
    if (matched) {
      return {
        kind: 'unit',
        instanceId: matched.instanceId,
        fallbackSpeciesId,
      };
    }
  }
  return {
    kind: 'species',
    speciesId: fallbackSpeciesId,
  };
}
