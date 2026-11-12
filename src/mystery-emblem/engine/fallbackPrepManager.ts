/**
 * Isolated In-Memory Fallback `SaveStateManager` for Map Editor `Test Battle`
 */

import { MENTOR_JAGEN_SPECIES_ID, STARTING_CAMPAIGN_LEVEL } from '../data/campaignConfig';
import { InMemoryCloudSyncAdapter } from '../state/firebaseSync';
import { SaveStateManager, type StorageLike } from '../state/SaveStateManager';

/**
 * Isolated in-memory `SaveStateManager` used only when launching Map Editor `Test Battle`
 * while no campaign save exists yet.
 */
export function createFallbackBattlePrepManager(minSquadSize = 5): SaveStateManager {
  const mem = new Map<string, string>();
  const memStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
  const mgr = new SaveStateManager(memStorage, new InMemoryCloudSyncAdapter(new Map()));
  mgr.createNewCampaignSave({
    lordSpeciesId: 'axew',
    partnerSpeciesId: 'quaxly',
    healerSpeciesId: 'flabebe',
    startingLevel: STARTING_CAMPAIGN_LEVEL,
    scaleStatsToLevel: false,
    campaignMode: 'demo',
  });

  const extraPool = [
    MENTOR_JAGEN_SPECIES_ID,
    'smoliv',
    'machop',
    'slakoth',
    'starly',
    'caterpie',
    'pawmi',
  ];
  let idx = 0;
  while ((mgr.getSave()?.roster.length ?? 0) < Math.min(8, minSquadSize) && idx < extraPool.length) {
    const spId = extraPool[idx]!;
    mgr.recruitPokemon({
      speciesId: spId,
      level: spId === MENTOR_JAGEN_SPECIES_ID ? 12 : 3,
      scaleStatsToLevel: spId !== MENTOR_JAGEN_SPECIES_ID,
    });
    idx += 1;
  }

  mgr.addConvoyItem('evolution_stone', 1);
  mgr.addConvoyItem('super_potion', 1);
  return mgr;
}
