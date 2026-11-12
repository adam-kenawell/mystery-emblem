/**
 * Mystery Emblem - Serializable Seeded PRNG (mulberry32)
 *
 * The whole generator state is one uint32, so a mid-battle save can store it and a reload
 * replays identical hit/crit/status/level-up rolls for identical player actions.
 */

export interface SeededRngHolder {
  rngState: number;
}

export function createRandomRngSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

export function nextSeededRandom(holder: SeededRngHolder): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
