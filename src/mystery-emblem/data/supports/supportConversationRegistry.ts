/**
 * Sharded Support Conversation JSON Registry (`supportConversationRegistry.ts`)
 */

import heroCoreRaw from './conversations/hero_core.json';
import heroExpeditionRaw from './conversations/hero_expedition.json';
import hometownBondsRaw from './conversations/hometown_bonds.json';
import townTrioBondsRaw from './conversations/town_trio_bonds.json';
import vanguardBondsRaw from './conversations/vanguard_bonds.json';
import { makeCanonicalSupportPairKey } from './supportMatrix';
import type { SupportConversationDoc, SupportRank } from './supportTypes';

export const SUPPORT_CONVERSATION_LIST: ReadonlyArray<SupportConversationDoc> = [
  ...(heroCoreRaw as unknown as SupportConversationDoc[]),
  ...(heroExpeditionRaw as unknown as SupportConversationDoc[]),
  ...(hometownBondsRaw as unknown as SupportConversationDoc[]),
  ...(vanguardBondsRaw as unknown as SupportConversationDoc[]),
  ...(townTrioBondsRaw as unknown as SupportConversationDoc[]),
];

const CONVERSATION_BY_KEY = new Map<string, SupportConversationDoc>();

for (const doc of SUPPORT_CONVERSATION_LIST) {
  CONVERSATION_BY_KEY.set(`${doc.pairKey}::${doc.rank}`, doc);
}

export function getSupportConversationDoc(
  actorIdA: string,
  actorIdB: string,
  rank: SupportRank
): SupportConversationDoc | undefined {
  if (!actorIdA || !actorIdB || actorIdA === actorIdB) return undefined;
  const pairKey = makeCanonicalSupportPairKey(actorIdA, actorIdB);
  return CONVERSATION_BY_KEY.get(`${pairKey}::${rank}`);
}
