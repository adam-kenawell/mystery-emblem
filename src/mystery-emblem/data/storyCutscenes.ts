/**
 * Mystery Emblem — Out-of-Dungeon Story Cutscene Registry (`storyCutscenes.ts`)
 *
 * Choreographed PMD-style non-combat sprite stage cutscenes for the 5-Chapter Act 1 Demo:
 * 1. `cs_01_coastal_friends`    (Pre-Ch. 1, before Western Beach)
 * 2. `cs_02_sanctuary_reveal`   (Post-Ch. 1, after Western Beach — w/ live Serperior & Milotic sprites)
 * 3. `cs_03_bluff_campfire`     (Post-Ch. 2, after Verdant Bluff — evening campfire + recruit cameos)
 * 4. `cs_04_watchtower_bells`   (Post-Ch. 3, after Cleft Mountain — Dragon Watchtower + distress bells)
 * 5. `cs_05_sanctuary_war_room` (Post-Ch. 4, after River Shrine — live Kecleon, Serperior & Milotic war council)
 * 6. `cs_06_orchard_celebration`(Post-Ch. 5 Finale, after Berry Orchards — twilight celebration -> Credits)
 *
 * Canon & Core Four Personalities:
 * - `{lord}` (Dragon Lord): Quieter, observant, analytical, dryly fond steadying presence; grew up right alongside
 *   Piplup, Flabébé, and Wimpod in the same Verdant Commonwealth coastal tribe (never washed ashore / zero amnesia),
 *   quietly sheltered in childhood by Chancellor Serperior and High Seeress Milotic.
 * - `{partner}` (Piplup): Headstrong, proud, rushes straight into danger, fiercely loyal best friend.
 * - `{healer}` (Flabébé): Warm-hearted caretaker always thinking of her friends and how best to protect others.
 * - `{advisor}` (Wimpod, `0767`): Total wimp who obsessively studies enemy hazards, attack ranges, and terrain rules
 *   specifically because he is terrified of getting squished.
 */

import type {
  StoryCutsceneDefinition,
} from '../scenes/CutsceneScene';
import type { DungeonMapTileCell, TerrainType } from '../types/schemas';
import type { DialogueSpeakerRef } from '../ui/DialogueOverlay';
import {
  CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
} from './campaignRegistry';
import { KECLEON_PMD_ASSET_ID } from './overworldMapData';

const SERPERIOR_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
  speciesName: 'Serperior',
  nickname: 'Chancellor Serperior',
};

const MILOTIC_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
  speciesName: 'Milotic',
  nickname: 'High Seeress Milotic',
};

const KECLEON_SPEAKER: DialogueSpeakerRef = {
  kind: 'npc',
  pmdAssetId: KECLEON_PMD_ASSET_ID,
  speciesName: 'Kecleon',
  nickname: 'Kecleon',
};

function cell(
  terrain: TerrainType,
  tilesetId: string,
  chunkIndex: number
): DungeonMapTileCell {
  return { terrainType: terrain, tilesetId, chunkIndex };
}

function buildGrid(
  width: number,
  height: number,
  pickCell: (x: number, y: number) => DungeonMapTileCell
): DungeonMapTileCell[][] {
  const rows: DungeonMapTileCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: DungeonMapTileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(pickCell(x, y));
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Stage 1 (`002` Coast/Beach): Sunny tribe shoreline trail overlooking sparkling eastern tidewaters.
 */
const STAGE_01_COASTAL_MEADOW = buildGrid(16, 11, (x, y) => {
  const t = '002';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 38);
    if (x === 15) return cell('wall', t, 37);
    return cell('wall', t, 2);
  }
  if (y === 10) {
    if (x === 0) return cell('wall', t, 39);
    if (x >= 12) return cell('water', t, 43);
    return cell('wall', t, 5);
  }
  if (x === 0) return cell('wall', t, 3);
  // Sparkling ocean shoreline on the right edge
  if (x >= 13 && y >= 2 && y <= 9) {
    return cell('water', t, 43);
  }
  if (x === 12 && (y === 3 || y === 4 || y === 7 || y === 8)) {
    return cell('water', t, 43);
  }
  // Scenic coastal boulders (including a big safe rock Wimpod eyes fondly)
  if ((x === 3 && y === 2) || (x === 10 && y === 2) || (x === 4 && y === 8)) {
    return cell('wall', t, 27);
  }
  // Tide-pool shimmer
  if (x === 9 && y === 8) {
    return cell('water', t, 43);
  }
  const pattern = (x * 7 + y * 13) % 9;
  if (pattern === 0) return cell('floor', t, 98);
  if (pattern === 1 || pattern === 2) return cell('floor', t, 32);
  if (pattern === 3) return cell('floor', t, 34);
  return cell('floor', t, 28);
});

/**
 * Stage 2 (`042` Emerald Heartwood): Verdant Commonwealth Sanctuary with crystal spring & flower meadow.
 */
const STAGE_02_SANCTUARY_GLADE = buildGrid(16, 12, (x, y) => {
  const t = '042';
  if (y === 0) return cell('wall', t, 1);
  if (y === 1) return cell('wall', t, 2);
  if (y === 11) {
    if (x >= 6 && x <= 9) return cell('floor', t, 126);
    return cell('wall', t, 5);
  }
  if (x === 0 || x === 15) return cell('tree', t, 2);
  if ((x === 1 || x === 14) && (y <= 4 || y >= 9)) return cell('tree', t, 2);
  // Twin Sanctuary crystal pools flanking the central dais
  if ((x >= 3 && x <= 5 && y >= 3 && y <= 4) || (x >= 10 && x <= 12 && y >= 3 && y <= 4)) {
    return cell('water', t, 39);
  }
  // Blossom tiles around the central glade
  if (
    (x === 5 && y === 6) ||
    (x === 10 && y === 6) ||
    (x === 4 && y === 8) ||
    (x === 11 && y === 8) ||
    (x === 7 && y === 2) ||
    (x === 8 && y === 2)
  ) {
    return cell('floor', t, 124);
  }
  // Central ceremonial stone path
  if (x >= 7 && x <= 8 && y >= 3 && y <= 10) {
    return cell('floor', t, 126);
  }
  return cell('floor', t, 28);
});

/**
 * Stage 3 (`003` Verdant Bluff): Dusk ridge campsite overlooking the eastern mountain pass.
 */
const STAGE_03_BLUFF_CAMP = buildGrid(16, 11, (x, y) => {
  const t = '003';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 34);
    if (x === 15) return cell('wall', t, 33);
    return cell('wall', t, 2);
  }
  if (y === 10) return cell('wall', t, 5);
  if (x === 0) return cell('wall', t, 3);
  if (x === 15 && (y <= 2 || y >= 8)) return cell('wall', t, 21);
  // Bluff stream along the eastern cliff drop-off
  if (x >= 14 && y >= 3 && y <= 7) {
    return cell('water', t, 41);
  }
  // Boulders framing the campsite
  if ((x === 3 && y === 3) || (x === 11 && y === 2) || (x === 3 && y === 8)) {
    return cell('wall', t, 27);
  }
  const mix = (x * 5 + y * 11) % 7;
  if (mix === 0) return cell('floor', t, 131);
  if (mix === 1) return cell('floor', t, 9);
  return cell('floor', t, 28);
});

/**
 * Stage 4 (`014` Cleft Mountain): Ancient Dragon Kingdom stone watchtower parapet above misty chasms.
 */
const STAGE_04_WATCHTOWER_PARAPET = buildGrid(16, 11, (x, y) => {
  const t = '014';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 55);
    return cell('wall', t, 2);
  }
  if (y === 10) {
    if (x >= 6 && x <= 9) return cell('floor', t, 15);
    return cell('void', t, 73);
  }
  if (x === 0) return cell('wall', t, 3);
  if (x === 15) return cell('wall', t, 22);
  // Mountain chasm overlooks on lower corners
  if ((x <= 3 || x >= 12) && y >= 8) {
    return cell('void', t, 73);
  }
  // Ancient stone pillars flanking the Dragon rune
  if ((x === 5 && y === 3) || (x === 10 && y === 3)) {
    return cell('mountain', t, 2);
  }
  if ((x + y) % 3 === 0) return cell('floor', t, 15);
  return cell('floor', t, 29);
});

/**
 * Stage 5 (`016` River Shrine): Cleared stone shrine courtyard spanned by clear river channels.
 */
const STAGE_05_SHRINE_COURTYARD = buildGrid(16, 12, (x, y) => {
  const t = '016';
  if (y === 0) {
    if (x === 0) return cell('wall', t, 39);
    if (x === 15) return cell('wall', t, 50);
    if (x >= 7 && x <= 8) return cell('floor', t, 64);
    return cell('wall', t, 2);
  }
  if (y === 11) {
    if (x === 0) return cell('wall', t, 37);
    if (x === 15) return cell('wall', t, 49);
    return cell('wall', t, 5);
  }
  if (x === 0) return cell('wall', t, 18);
  if (x === 15) return cell('wall', t, 32);
  // Twin shrine river channels with a central stone bridge
  if ((x >= 2 && x <= 4 && y >= 2 && y <= 9) || (x >= 11 && x <= 13 && y >= 2 && y <= 9)) {
    if (y === 5 || y === 6) {
      return cell('floor', t, 64);
    }
    return cell('water', t, 42);
  }
  // Shrine pillars
  if ((x === 5 && y === 2) || (x === 10 && y === 2) || (x === 5 && y === 9) || (x === 10 && y === 9)) {
    return cell('wall', t, 28);
  }
  if (x >= 7 && x <= 8) return cell('floor', t, 64);
  if ((x + y) % 4 === 0) return cell('floor', t, 47);
  return cell('floor', t, 9);
});

/**
 * Stage 6 (`042` Berry Orchards & Sanctuary Overlook): Lantern-lit twilight orchard plaza.
 */
const STAGE_06_ORCHARD_TWILIGHT = buildGrid(18, 12, (x, y) => {
  const t = '042';
  if (y === 0) return cell('wall', t, 1);
  if (y === 1) {
    // Open starlit overlook gap in the center-north canopy
    if (x >= 7 && x <= 10) return cell('water', t, 39);
    return cell('wall', t, 2);
  }
  if (y === 11) return cell('wall', t, 5);
  if (x === 0 || x === 17) return cell('tree', t, 2);
  // Shimmering star-pool along the northern overlook
  if (y === 2 && (x === 6 || x === 11)) {
    return cell('water', t, 45);
  }
  // Festive flower carpets
  if (
    (x === 4 && y === 5) ||
    (x === 13 && y === 5) ||
    (x === 5 && y === 8) ||
    (x === 12 && y === 8) ||
    (x === 8 && y === 4) ||
    (x === 9 && y === 4)
  ) {
    return cell('floor', t, 124);
  }
  if (x >= 8 && x <= 9 && y >= 3 && y <= 10) {
    return cell('floor', t, 126);
  }
  return cell('floor', t, 28);
});

export const DEMO_STORY_CUTSCENES: ReadonlyArray<StoryCutsceneDefinition> = [
  // =========================================================================
  // 1. PRE-CHAPTER 1: Morning Patrol with the Coastal Tribe Core Four
  // =========================================================================
  {
    id: 'cs_01_coastal_friends',
    chapterOrder: 1,
    title: 'Morning Patrol',
    locationLabel: 'Coastal Trail · Verdant Commonwealth',
    lightingMood: 'morning_coast',
    width: 16,
    height: 11,
    tiles: STAGE_01_COASTAL_MEADOW,
    props: [{ id: 'coast_berries', kind: 'berry_basket', x: 5, y: 4 }],
    initialCamera: { x: 7.5, y: 5.5 },
    actors: [
      { actorId: 'lord', role: { kind: 'lord' }, x: 3, y: 5, direction: 'Right' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 4, y: 6, direction: 'Right' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 3, y: 6, direction: 'Right' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 2, y: 5, direction: 'Right' },
    ],
    openingDurationMs: 950,
    openingActions: [
      {
        type: 'walk',
        actorId: 'partner',
        path: [
          { x: 7, y: 6 },
          { x: 9, y: 5 },
        ],
        speedTilesPerSec: 4.4,
        endDirection: 'Left',
      },
      {
        type: 'hop',
        actorId: 'partner',
        count: 2,
        delayMs: 650,
      },
      {
        type: 'emote',
        actorId: 'partner',
        emote: 'music',
        durationMs: 1100,
        delayMs: 650,
      },
      {
        type: 'walk',
        actorId: 'lord',
        path: [{ x: 6, y: 5 }],
        speedTilesPerSec: 3.2,
        endDirection: 'Right',
      },
      {
        type: 'walk',
        actorId: 'healer',
        path: [{ x: 6, y: 6 }],
        speedTilesPerSec: 3.2,
        endDirection: 'Right',
      },
      {
        type: 'walk',
        actorId: 'advisor',
        path: [{ x: 5, y: 5 }],
        speedTilesPerSec: 3.4,
        endDirection: 'Right',
      },
    ],
    lineCues: {
      0: [
        { type: 'hop', actorId: 'partner', count: 2 },
        { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
      ],
      1: [
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 7, y: 6 }],
          speedTilesPerSec: 3.0,
          endDirection: 'UpRight',
        },
        { type: 'emote', actorId: 'healer', emote: 'music', durationMs: 1100 },
      ],
      2: [
        { type: 'emote', actorId: 'partner', emote: 'angry', durationMs: 900 },
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 8, y: 5 }],
          speedTilesPerSec: 3.8,
          endDirection: 'DownLeft',
        },
      ],
      3: [
        { type: 'shake', actorId: 'advisor', durationMs: 520 },
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1250 },
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 5, y: 6 }, { x: 5, y: 5 }],
          speedTilesPerSec: 4.0,
          endDirection: 'Right',
        },
      ],
      4: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 7, y: 5 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Right',
        },
        { type: 'face', actorId: 'partner', targetActorId: 'lord' },
        { type: 'face', actorId: 'healer', targetActorId: 'lord' },
      ],
      5: [
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
        { type: 'hop', actorId: 'advisor', count: 1 },
      ],
      6: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 10, y: 5 }],
          speedTilesPerSec: 3.4,
          endDirection: 'Right',
        },
        { type: 'camera', x: 9.0, y: 5.5, durationMs: 520 },
        { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 1200, delayMs: 320 },
      ],
      7: [
        { type: 'screenShake', durationMs: 280, intensityPx: 2 },
        { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950 },
        { type: 'emote', actorId: 'healer', emote: 'exclamation', durationMs: 950 },
        { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1100 },
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 9, y: 6 }],
          speedTilesPerSec: 3.6,
          endDirection: 'Right',
        },
      ],
      8: [
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 11, y: 4 }],
          speedTilesPerSec: 4.8,
          endDirection: 'Right',
        },
        { type: 'hop', actorId: 'partner', count: 2, delayMs: 360 },
      ],
      9: [
        { type: 'shake', actorId: 'advisor', durationMs: 600 },
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1300 },
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 8, y: 5 }],
          speedTilesPerSec: 4.2,
          endDirection: 'Right',
        },
      ],
      10: [
        { type: 'pose', actorId: 'lord', action: 'Attack', durationMs: 520 },
        { type: 'face', actorId: 'partner', direction: 'Right' },
        { type: 'face', actorId: 'healer', direction: 'Right' },
      ],
    },
    buildScript: () => ({
      id: 'cs_01_coastal_friends',
      title: 'Coastal Trail',
      bgm: 'in_the_morning_sun',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Joyous',
          text: 'Ha! Smell that sea breeze, team! Best morning patrol gig in the whole tribe—clear skies, zero chores, and yours truly leading the vanguard!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'left',
          emotion: 'Happy',
          text: 'Hehe, by "leading the vanguard," do you mean tripping over two Krabby shells before we even left the village path, {partner}?',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Angry',
          text: 'T-those shells ambushed my flippers! Tell her, {lord}—we grew up running this coast together, you know I was scouting for traps!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Worried',
          text: 'Speaking of traps—did ANY of you read the updated Hazard & Enemy Range notes I stayed up all night writing?! One wild claw out here and I am bug soup!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'Every page, Wimpod. Between {partner} sprinting straight toward trouble and you sprinting straight away from it, our patrol pace actually averages out.',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Happy',
          text: 'And I packed extra Oran Berries for all four of us—including yours, {lord}, so no quietly sneaking your share into Wimpod’s satchel today!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Surprised',
          text: '...Hold on, everyone. Quiet for a second. Look past the tide rocks toward Western Beach—why have all the Wingull gone silent?',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Worried',
          text: 'Oh no... purple miasma is curling around our tribe’s coastal shrine! And those heavy steel footprints in the wet sand—those aren’t ours!',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Determined',
          text: 'Raiders?! On OUR tribe’s beach?! Not on my watch—come on, let’s go kick them right back into the surf!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Teary-Eyed',
          text: 'WAIT, {partner}, WE HAVEN’T CALCULATED THEIR ATTACK RANGES YET! Ugh, why are my best friends like this?! Save a big sturdy boulder for me to hide behind!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Don’t let {partner} charge in alone, {healer}! Keep your eyes sharp from cover, Wimpod—we protect Western Beach together!',
        },
      ],
    }),
  },

  // =========================================================================
  // 2. POST-CHAPTER 1: Sanctuary Reveal w/ Live Serperior & Milotic Sprites
  // =========================================================================
  {
    id: 'cs_02_sanctuary_reveal',
    chapterOrder: 2,
    title: 'The Sheltered Scion',
    locationLabel: 'Emerald Sanctuary · Verdant Commonwealth',
    lightingMood: 'sanctuary_glow',
    width: 16,
    height: 12,
    tiles: STAGE_02_SANCTUARY_GLADE,
    props: [
      { id: 'sanctuary_gem_top', kind: 'sanctuary_crystal', x: 7, y: 2 },
      { id: 'sanctuary_lantern_l', kind: 'lantern', x: 5, y: 5 },
      { id: 'sanctuary_lantern_r', kind: 'lantern', x: 10, y: 5 },
    ],
    initialCamera: { x: 7.5, y: 5.5 },
    actors: [
      {
        actorId: 'serperior',
        role: {
          kind: 'npc',
          pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
          name: 'Chancellor Serperior',
        },
        x: 6,
        y: 4,
        direction: 'Down',
      },
      {
        actorId: 'milotic',
        role: {
          kind: 'npc',
          pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
          name: 'High Seeress Milotic',
        },
        x: 9,
        y: 4,
        direction: 'Down',
      },
      { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 10, direction: 'Up' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 10, direction: 'Up' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 10, direction: 'Up' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 10, direction: 'Up' },
    ],
    openingDurationMs: 950,
    openingActions: [
      {
        type: 'walk',
        actorId: 'lord',
        path: [{ x: 7, y: 7 }],
        speedTilesPerSec: 3.2,
        endDirection: 'Up',
      },
      {
        type: 'walk',
        actorId: 'partner',
        path: [{ x: 8, y: 7 }],
        speedTilesPerSec: 3.5,
        endDirection: 'Up',
      },
      {
        type: 'walk',
        actorId: 'healer',
        path: [{ x: 6, y: 8 }],
        speedTilesPerSec: 3.1,
        endDirection: 'Up',
      },
      {
        type: 'walk',
        actorId: 'advisor',
        path: [{ x: 9, y: 8 }],
        speedTilesPerSec: 3.4,
        endDirection: 'Up',
      },
    ],
    lineCues: {
      0: [
        { type: 'hop', actorId: 'partner', count: 2 },
        { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 1100 },
      ],
      1: [
        { type: 'shake', actorId: 'advisor', durationMs: 500 },
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
      ],
      2: [
        {
          type: 'walk',
          actorId: 'milotic',
          path: [{ x: 8, y: 5 }],
          speedTilesPerSec: 2.2,
          endDirection: 'DownLeft',
        },
        { type: 'auraPulse', actorId: 'lord', durationMs: 1100, delayMs: 250 },
      ],
      3: [
        {
          type: 'walk',
          actorId: 'serperior',
          path: [{ x: 7, y: 5 }],
          speedTilesPerSec: 2.4,
          endDirection: 'Down',
        },
      ],
      4: [
        { type: 'emote', actorId: 'lord', emote: 'question', durationMs: 1150 },
        { type: 'face', actorId: 'lord', direction: 'DownRight' },
        { type: 'face', actorId: 'partner', targetActorId: 'lord' },
        { type: 'face', actorId: 'healer', targetActorId: 'lord' },
      ],
      5: [
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 6, y: 7 }],
          speedTilesPerSec: 3.0,
          endDirection: 'Right',
        },
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1250 },
      ],
      6: [
        { type: 'hop', actorId: 'partner', count: 2 },
        { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
        { type: 'face', actorId: 'lord', direction: 'Up' },
      ],
      7: [
        {
          type: 'walk',
          actorId: 'milotic',
          path: [{ x: 9, y: 5 }],
          speedTilesPerSec: 2.2,
          endDirection: 'DownLeft',
        },
        { type: 'face', actorId: 'partner', direction: 'Up' },
        { type: 'face', actorId: 'healer', direction: 'Up' },
      ],
      8: [
        {
          type: 'walk',
          actorId: 'serperior',
          path: [{ x: 7, y: 4 }],
          speedTilesPerSec: 2.4,
          endDirection: 'Down',
        },
        { type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 560 },
      ],
      9: [
        { type: 'shake', actorId: 'advisor', durationMs: 580 },
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1300 },
      ],
      10: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 7, y: 6 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Up',
        },
        { type: 'auraPulse', actorId: 'lord', durationMs: 1250 },
        { type: 'hop', actorId: 'partner', count: 1, delayMs: 350 },
      ],
    },
    buildScript: () => ({
      id: 'cs_02_sanctuary_reveal',
      title: 'Emerald Sanctuary',
      bgm: 'thoughts_for_friends',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'Chancellor Serperior! High Seeress Milotic! You HAVE to tell us what just happened on Western Beach—golden light flared right off {lord}’s scales!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Stunned',
          text: 'I checked every page of our coastal tribe handbook and "bursting into ancient golden radiance" is definitely not listed under normal growing pains!',
        },
        {
          speaker: MILOTIC_SPEAKER,
          side: 'right',
          emotion: 'Sad',
          text: 'Step closer, little ones. That warm golden light is Dragon Aura... a truth Chancellor Serperior and I quietly guarded so {lord} could grow up safe and free.',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'left',
          emotion: 'Normal',
          text: 'Years ago, when the ancient Dragon Kingdom fell, we sheltered {lord} as a tiny hatchling within your coastal tribe—with no royal title, so {lord} would know ordinary joy and true friendship first.',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Surprised',
          text: 'A survivor of the Dragon Kingdom...? All my life I thought I was just another kid from the coast. {partner}, {healer}, Wimpod... does this change who I am to you?',
        },
        {
          speaker: { kind: 'healer' },
          side: 'right',
          emotion: 'Happy',
          text: 'Not for a single heartbeat! Secret Dragon heritage or not, you’re still *our* {lord}—the friend who shared berry rations in rainstorms and untangled seaweed from Wimpod’s antennae!',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Joyous',
          text: 'Yeah! Same tribe, same squad—forever! Honestly, finding out my best friend is secretly a legendary Dragon just makes our team ten times cooler!',
        },
        {
          speaker: MILOTIC_SPEAKER,
          side: 'right',
          emotion: 'Worried',
          text: 'Hold tight to that bond. Generations ago, Royal Tactician Gengar betrayed the Dragon Court and tore open the southeastern Abyss, whose miasma drives wild Pokémon Feral.',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'left',
          emotion: 'Determined',
          text: 'Now Emperor Kingambit’s Ironscale Empire marches into our Verdant Commonwealth claiming "martial law" is the only cure. Captain Aron has already blockaded the northern road at Verdant Bluff!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Crying',
          text: 'A cursed Abyss AND an invading Steel-type Empire?! My antennae want to retire—except if I don’t come along, {partner} will forget enemy attack ranges exist in three minutes flat!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'The Dragon Kingdom may be my past, Chancellor—but this tribe and these friends are my home. Point us north to Verdant Bluff; we’ll break Captain Aron’s blockade together!',
        },
      ],
    }),
  },

  // =========================================================================
  // 3. POST-CHAPTER 2: Evening Bluff Campfire & Friendly Banter
  // =========================================================================
  {
    id: 'cs_03_bluff_campfire',
    chapterOrder: 3,
    title: 'Sparks Over the Bluff',
    locationLabel: 'Bluff Overlook Camp · Evening',
    lightingMood: 'campfire_dusk',
    width: 16,
    height: 11,
    tiles: STAGE_03_BLUFF_CAMP,
    props: [
      { id: 'bluff_fire', kind: 'campfire', x: 7, y: 5 },
      { id: 'camp_berries_1', kind: 'berry_basket', x: 6, y: 4 },
      { id: 'camp_berries_2', kind: 'berry_basket', x: 10, y: 6 },
    ],
    initialCamera: { x: 7.5, y: 5.5 },
    actors: [
      { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 5, direction: 'Left' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 7, y: 6, direction: 'Up' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 5, direction: 'Right' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 7, y: 4, direction: 'Down' },
      { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 10, y: 4, direction: 'DownLeft' },
      { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 11, y: 5, direction: 'Left' },
    ],
    openingDurationMs: 650,
    openingActions: [
      { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1000 },
      { type: 'emote', actorId: 'recruit_0', emote: 'joy', durationMs: 1000, delayMs: 250 },
    ],
    lineCues: {
      0: [
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 8, y: 6 }],
          speedTilesPerSec: 3.8,
          endDirection: 'UpLeft',
        },
        { type: 'hop', actorId: 'partner', count: 2, delayMs: 260 },
        { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
      ],
      1: [
        { type: 'hop', actorId: 'advisor', count: 1 },
        { type: 'emote', actorId: 'advisor', emote: 'music', durationMs: 1150 },
      ],
      2: [
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 6, y: 6 }, { x: 7, y: 6 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Right',
        },
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1100 },
      ],
      3: [
        { type: 'emote', actorId: 'partner', emote: 'sweat', durationMs: 1050 },
        { type: 'hop', actorId: 'recruit_1', count: 1, delayMs: 220 },
      ],
      4: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 12, y: 5 }],
          speedTilesPerSec: 3.0,
          endDirection: 'Right',
        },
        { type: 'camera', x: 9.2, y: 5.5, durationMs: 560 },
        { type: 'face', actorId: 'partner', direction: 'Right' },
        { type: 'face', actorId: 'healer', direction: 'Right' },
      ],
      5: [
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 9, y: 4 }, { x: 10, y: 5 }],
          speedTilesPerSec: 4.0,
          endDirection: 'Right',
        },
        { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1050 },
      ],
      6: [
        { type: 'face', actorId: 'lord', direction: 'Left' },
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 10, y: 6 }],
          speedTilesPerSec: 3.6,
          endDirection: 'UpRight',
        },
        { type: 'hop', actorId: 'partner', count: 1, delayMs: 360 },
      ],
    },
    buildScript: () => ({
      id: 'cs_03_bluff_campfire',
      title: 'Campfire on Verdant Bluff',
      bgm: 'at_the_end_of_the_day',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Joyous',
          text: '"NONE PASS VERDANT BLUFF!"—haha! Did you see Captain Aron’s face when he realized standing glued to one post meant we could line up around him for free?!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Inspired',
          text: 'Honestly? Zero movement on fortified terrain is my dream lifestyle! If Captain Aron wasn’t working for an invading Empire, he and I could start a Stationary Appreciation Club!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'left',
          emotion: 'Happy',
          text: 'Hold still a second, {partner}—you scuffed your flipper showing off again. Here, warm Oran cider for everyone, and extra shares for our newest teammates by the baskets!',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'Hey, battle scuffs look heroic! Though... okay, yeah, that cider smells amazing. Thanks, {healer}. What are you scouting over by the ridge, {lord}?',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Worried',
          text: 'Cleft Mountain to the east. See that faint violet haze curling around the old Dragon watchtower? That peak is riddled with subterranean shafts and old stairwells.',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Surprised',
          text: 'AHA! {lord} spotted it! Subterranean shafts mean Dungeon Stairs—enemy reserves can climb straight up behind us unless a sturdy unit stands right on the Stairs tile to cork it!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'And no, Wimpod, nobody is using your shell as a stair-plug. Get some sleep around the fire, everyone—at dawn we climb Cleft Mountain.',
        },
      ],
    }),
  },

  // =========================================================================
  // 4. POST-CHAPTER 3: Watchtower Relics & River Shrine Distress Bells
  // =========================================================================
  {
    id: 'cs_04_watchtower_bells',
    chapterOrder: 4,
    title: 'Echoes of the Watchtower',
    locationLabel: 'Dragon Watchtower · Cleft Mountain',
    lightingMood: 'mountain_mist',
    width: 16,
    height: 11,
    tiles: STAGE_04_WATCHTOWER_PARAPET,
    props: [
      { id: 'watchtower_rune', kind: 'ancient_rune', x: 7, y: 3 },
      { id: 'watchtower_lantern_l', kind: 'lantern', x: 4, y: 4 },
      { id: 'watchtower_lantern_r', kind: 'lantern', x: 11, y: 4 },
    ],
    initialCamera: { x: 7.5, y: 5.5 },
    actors: [
      { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 5, direction: 'Up' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 6, direction: 'UpLeft' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 6, direction: 'UpRight' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 8, y: 7, direction: 'Up' },
      { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 4, y: 6, direction: 'Right' },
      { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 11, y: 6, direction: 'Left' },
      { actorId: 'recruit_2', role: { kind: 'cameo_recruit', slotIndex: 2 }, x: 5, y: 4, direction: 'DownRight' },
    ],
    openingDurationMs: 700,
    openingActions: [
      {
        type: 'walk',
        actorId: 'lord',
        path: [{ x: 7, y: 4 }],
        speedTilesPerSec: 2.6,
        endDirection: 'Up',
      },
      { type: 'auraPulse', actorId: 'lord', durationMs: 1150, delayMs: 350 },
    ],
    lineCues: {
      0: [
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 6, y: 5 }],
          speedTilesPerSec: 2.8,
          endDirection: 'UpRight',
        },
      ],
      1: [
        { type: 'face', actorId: 'lord', direction: 'DownRight' },
        { type: 'hop', actorId: 'partner', count: 2 },
        { type: 'emote', actorId: 'partner', emote: 'music', durationMs: 1100 },
      ],
      2: [
        { type: 'emote', actorId: 'advisor', emote: 'joy', durationMs: 1050 },
        { type: 'hop', actorId: 'advisor', count: 1 },
      ],
      3: [
        { type: 'screenShake', durationMs: 360, intensityPx: 2 },
        { type: 'emote', actorId: 'lord', emote: 'exclamation', durationMs: 1000 },
        { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 1000 },
        { type: 'emote', actorId: 'healer', emote: 'exclamation', durationMs: 1000 },
        { type: 'emote', actorId: 'advisor', emote: 'exclamation', durationMs: 1000 },
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 8, y: 9 }],
          speedTilesPerSec: 4.8,
          endDirection: 'Down',
        },
        { type: 'camera', x: 7.5, y: 6.5, durationMs: 450 },
      ],
      4: [
        { type: 'shake', actorId: 'advisor', durationMs: 520 },
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 7, y: 9 }],
          speedTilesPerSec: 5.2,
          endDirection: 'Down',
        },
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1200 },
      ],
      5: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 7, y: 8 }],
          speedTilesPerSec: 3.8,
          endDirection: 'Down',
        },
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 6, y: 8 }],
          speedTilesPerSec: 3.8,
          endDirection: 'Down',
        },
      ],
    },
    buildScript: () => ({
      id: 'cs_04_watchtower_bells',
      title: 'Dragon Watchtower',
      bgm: 'calm_cutscene',
      lines: [
        {
          speaker: { kind: 'healer' },
          side: 'left',
          emotion: 'Worried',
          text: 'The stone crest is glowing softly in answer to you, {lord}... How are you holding up, seeing an actual watchtower of the old Dragon Kingdom?',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'It feels warm—like half-remembering a lullaby. Then I turn around and see {partner} trying to balance a mountain pebble on his beak, and I feel completely grounded again.',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Happy',
          text: 'Plus, zero monsters popped out of the last stairwell AND nobody tripped down a cliff! I am officially rating this mission a ten out of—',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Surprised',
          text: 'Whoa—hear those bronze bells echoing up from the valley?! {lord}, look down at River Shrine! Ironscale troops have Master Merchant Kecleon’s wagons pinned between the rapids!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'left',
          emotion: 'Shouting',
          text: 'NOT KECLEON!! Do you realize what happens to your HP bars without his Potions, Oran Berries, and Evolution Stones?! MOVE YOUR LEGS, PEOPLE, THIS IS CODE RED!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'First time in history Wimpod is leading the charge down a mountain. Stay right with him, {partner}, {healer}—let’s free River Shrine!',
        },
      ],
    }),
  },

  // =========================================================================
  // 5. POST-CHAPTER 4: Shrine Council w/ Live Kecleon, Serperior & Milotic
  // =========================================================================
  {
    id: 'cs_05_sanctuary_war_room',
    chapterOrder: 5,
    title: 'Council at River Shrine',
    locationLabel: 'River Shrine Courtyard · Verdant Commonwealth',
    lightingMood: 'shrine_courtyard',
    width: 16,
    height: 12,
    tiles: STAGE_05_SHRINE_COURTYARD,
    props: [
      { id: 'shrine_wares_l', kind: 'berry_basket', x: 6, y: 6 },
      { id: 'shrine_wares_r', kind: 'berry_basket', x: 9, y: 6 },
      { id: 'shrine_lantern_l', kind: 'lantern', x: 6, y: 3 },
      { id: 'shrine_lantern_r', kind: 'lantern', x: 9, y: 3 },
    ],
    initialCamera: { x: 7.5, y: 5.5 },
    actors: [
      {
        actorId: 'kecleon',
        role: {
          kind: 'npc',
          pmdAssetId: KECLEON_PMD_ASSET_ID,
          name: 'Kecleon',
        },
        x: 7,
        y: 5,
        direction: 'Down',
      },
      {
        actorId: 'serperior',
        role: {
          kind: 'npc',
          pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
          name: 'Chancellor Serperior',
        },
        x: 7,
        y: 1,
        direction: 'Down',
      },
      {
        actorId: 'milotic',
        role: {
          kind: 'npc',
          pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
          name: 'High Seeress Milotic',
        },
        x: 8,
        y: 1,
        direction: 'Down',
      },
      { actorId: 'lord', role: { kind: 'lord' }, x: 7, y: 7, direction: 'Up' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 8, y: 7, direction: 'Up' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 6, y: 7, direction: 'UpRight' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 9, y: 7, direction: 'UpLeft' },
    ],
    openingDurationMs: 650,
    openingActions: [
      { type: 'hop', actorId: 'kecleon', count: 2 },
      { type: 'emote', actorId: 'kecleon', emote: 'joy', durationMs: 1100 },
    ],
    lineCues: {
      0: [
        {
          type: 'walk',
          actorId: 'kecleon',
          path: [{ x: 8, y: 6 }],
          speedTilesPerSec: 3.4,
          endDirection: 'DownRight',
        },
        { type: 'hop', actorId: 'kecleon', count: 1, delayMs: 280 },
      ],
      1: [
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 9, y: 6 }],
          speedTilesPerSec: 3.6,
          endDirection: 'Left',
        },
        { type: 'emote', actorId: 'advisor', emote: 'heart', durationMs: 1200 },
      ],
      2: [
        {
          type: 'walk',
          actorId: 'kecleon',
          path: [{ x: 5, y: 5 }],
          speedTilesPerSec: 3.2,
          endDirection: 'Right',
        },
        {
          type: 'walk',
          actorId: 'serperior',
          path: [{ x: 7, y: 4 }],
          speedTilesPerSec: 2.6,
          endDirection: 'Down',
        },
        {
          type: 'walk',
          actorId: 'milotic',
          path: [{ x: 8, y: 4 }],
          speedTilesPerSec: 2.6,
          endDirection: 'Down',
        },
        { type: 'face', actorId: 'advisor', direction: 'UpLeft' },
      ],
      3: [
        { type: 'emote', actorId: 'partner', emote: 'exclamation', durationMs: 950 },
        { type: 'pose', actorId: 'serperior', action: 'Special', durationMs: 520 },
      ],
      4: [
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 7, y: 6 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Up',
        },
      ],
      5: [
        { type: 'hop', actorId: 'partner', count: 2 },
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 6, y: 6 }],
          speedTilesPerSec: 3.0,
          endDirection: 'Up',
        },
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1000 },
      ],
      6: [
        { type: 'auraPulse', actorId: 'lord', durationMs: 1150 },
        { type: 'hop', actorId: 'kecleon', count: 1, delayMs: 250 },
      ],
    },
    buildScript: () => ({
      id: 'cs_05_sanctuary_war_room',
      title: 'Council at River Shrine',
      bgm: 'one_for_all',
      lines: [
        {
          speaker: KECLEON_SPEAKER,
          side: 'right',
          emotion: 'Joyous',
          text: 'Splendidly rescued, my friends! My Kecleon Shops are officially open across cleared World Map roads—and here, Master Wimpod, a complimentary Oran Berry for your nerves!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Inspired',
          text: 'Sniff... finally, a merchant who understands preventative cowardice! I will treasure this emergency berry with my life!',
        },
        {
          speaker: MILOTIC_SPEAKER,
          side: 'right',
          emotion: 'Worried',
          text: 'Well fought at the river, {lord}, {partner}, {healer}. Forgive our haste—scouts just brought grave word from the heart of the Commonwealth.',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'left',
          emotion: 'Determined',
          text: 'Sensing your awakened Dragon Aura, Commander Deino himself has marched his Ironscale vanguard—alongside Captains Linoone and Morgrem—directly into Berry Orchards!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Determined',
          text: 'Berry Orchards feeds every tribe in the Commonwealth. Unlike Aron, Commander Deino won’t sit anchored to a post—we’ll need to check our loadouts, draw out his captains, and strike as one.',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Determined',
          text: 'Let Deino bring his whole vanguard! Nobody starves our home while the four of us—and our whole squad—are standing!',
        },
        {
          speaker: MILOTIC_SPEAKER,
          side: 'right',
          emotion: 'Normal',
          text: 'Stock up at Kecleon’s stalls when you are ready, {lord}. May the bond of your tribe light the road to Berry Orchards!',
        },
      ],
    }),
  },

  // =========================================================================
  // 6. POST-CHAPTER 5 FINALE: Twilight Orchard Celebration -> Ending Credits
  // =========================================================================
  {
    id: 'cs_06_orchard_celebration',
    chapterOrder: 6,
    title: 'Beneath the Orchard Stars',
    locationLabel: 'Berry Orchards Overlook · Twilight',
    lightingMood: 'twilight_festival',
    width: 18,
    height: 12,
    tiles: STAGE_06_ORCHARD_TWILIGHT,
    props: [
      { id: 'fest_lantern_1', kind: 'lantern', x: 6, y: 4 },
      { id: 'fest_lantern_2', kind: 'lantern', x: 11, y: 4 },
      { id: 'fest_lantern_3', kind: 'lantern', x: 5, y: 7 },
      { id: 'fest_lantern_4', kind: 'lantern', x: 12, y: 7 },
      { id: 'fest_berries_l', kind: 'berry_basket', x: 4, y: 6 },
      { id: 'fest_berries_r', kind: 'berry_basket', x: 13, y: 6 },
    ],
    initialCamera: { x: 8.5, y: 6.0 },
    actors: [
      {
        actorId: 'serperior',
        role: {
          kind: 'npc',
          pmdAssetId: CHANCELLOR_SERPERIOR_PMD_ASSET_ID,
          name: 'Chancellor Serperior',
        },
        x: 7,
        y: 4,
        direction: 'DownRight',
      },
      {
        actorId: 'milotic',
        role: {
          kind: 'npc',
          pmdAssetId: HIGH_SEERESS_MILOTIC_PMD_ASSET_ID,
          name: 'High Seeress Milotic',
        },
        x: 10,
        y: 4,
        direction: 'DownLeft',
      },
      {
        actorId: 'kecleon',
        role: {
          kind: 'npc',
          pmdAssetId: KECLEON_PMD_ASSET_ID,
          name: 'Kecleon',
        },
        x: 13,
        y: 5,
        direction: 'DownLeft',
      },
      { actorId: 'lord', role: { kind: 'lord' }, x: 8, y: 6, direction: 'Down' },
      { actorId: 'partner', role: { kind: 'partner' }, x: 9, y: 6, direction: 'DownLeft' },
      { actorId: 'healer', role: { kind: 'healer' }, x: 7, y: 6, direction: 'Right' },
      { actorId: 'advisor', role: { kind: 'advisor' }, x: 10, y: 6, direction: 'Left' },
      { actorId: 'recruit_0', role: { kind: 'cameo_recruit', slotIndex: 0 }, x: 4, y: 5, direction: 'DownRight' },
      { actorId: 'recruit_1', role: { kind: 'cameo_recruit', slotIndex: 1 }, x: 5, y: 8, direction: 'UpRight' },
      { actorId: 'recruit_2', role: { kind: 'cameo_recruit', slotIndex: 2 }, x: 12, y: 8, direction: 'UpLeft' },
      { actorId: 'recruit_3', role: { kind: 'cameo_recruit', slotIndex: 3 }, x: 14, y: 7, direction: 'Left' },
    ],
    openingDurationMs: 850,
    openingActions: [
      { type: 'hop', actorId: 'partner', count: 2 },
      { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1200 },
      { type: 'emote', actorId: 'kecleon', emote: 'music', durationMs: 1200, delayMs: 200 },
      { type: 'hop', actorId: 'recruit_0', count: 1, delayMs: 300 },
      { type: 'hop', actorId: 'recruit_2', count: 1, delayMs: 420 },
    ],
    lineCues: {
      0: [
        { type: 'hop', actorId: 'partner', count: 2 },
        { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1150 },
      ],
      1: [
        { type: 'hop', actorId: 'advisor', count: 2 },
        { type: 'emote', actorId: 'advisor', emote: 'music', durationMs: 1200 },
      ],
      2: [
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1200 },
        { type: 'face', actorId: 'lord', targetActorId: 'healer' },
      ],
      3: [
        {
          type: 'walk',
          actorId: 'serperior',
          path: [{ x: 8, y: 4 }],
          speedTilesPerSec: 2.4,
          endDirection: 'Down',
        },
        { type: 'face', actorId: 'lord', direction: 'Up' },
        { type: 'face', actorId: 'partner', direction: 'Up' },
        { type: 'face', actorId: 'healer', direction: 'Up' },
        { type: 'face', actorId: 'advisor', direction: 'Up' },
      ],
      4: [
        {
          type: 'walk',
          actorId: 'milotic',
          path: [{ x: 9, y: 4 }],
          speedTilesPerSec: 2.4,
          endDirection: 'Down',
        },
      ],
      5: [
        {
          type: 'walk',
          actorId: 'serperior',
          path: [{ x: 6, y: 4 }],
          speedTilesPerSec: 2.5,
          endDirection: 'DownRight',
        },
        {
          type: 'walk',
          actorId: 'milotic',
          path: [{ x: 11, y: 4 }],
          speedTilesPerSec: 2.5,
          endDirection: 'DownLeft',
        },
        {
          type: 'walk',
          actorId: 'lord',
          path: [{ x: 8, y: 3 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Up',
        },
        {
          type: 'walk',
          actorId: 'partner',
          path: [{ x: 9, y: 3 }],
          speedTilesPerSec: 3.0,
          endDirection: 'Up',
        },
        {
          type: 'walk',
          actorId: 'healer',
          path: [{ x: 7, y: 3 }],
          speedTilesPerSec: 2.8,
          endDirection: 'Up',
        },
        {
          type: 'walk',
          actorId: 'advisor',
          path: [{ x: 10, y: 3 }],
          speedTilesPerSec: 3.0,
          endDirection: 'Up',
        },
        { type: 'camera', x: 8.5, y: 4.2, durationMs: 750 },
      ],
      6: [
        { type: 'emote', actorId: 'advisor', emote: 'sweat', durationMs: 1100 },
        { type: 'hop', actorId: 'partner', count: 1, delayMs: 260 },
      ],
      7: [
        { type: 'auraPulse', actorId: 'lord', durationMs: 1400 },
        { type: 'emote', actorId: 'healer', emote: 'heart', durationMs: 1300, delayMs: 200 },
        { type: 'emote', actorId: 'partner', emote: 'joy', durationMs: 1300, delayMs: 320 },
      ],
    },
    buildScript: () => ({
      id: 'cs_06_orchard_celebration',
      title: 'Beneath the Orchard Stars',
      bgm: 'a_wish_for_peace',
      lines: [
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Joyous',
          text: 'Commander Deino and his whole vanguard—sent packing! Not bad for four friends who started the week arguing over Krabby shells on morning patrol, huh?!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Inspired',
          text: 'AND for the record, I only hid behind TWO berry bushes during the finale instead of three! That is measurable bravery growth AND my survival notes worked!',
        },
        {
          speaker: { kind: 'healer' },
          side: 'left',
          emotion: 'Happy',
          text: 'Best of all, every single one of us made it back to see the orchard lanterns together. Look how many new friends are sharing our table tonight, {lord}!',
        },
        {
          speaker: SERPERIOR_SPEAKER,
          side: 'left',
          emotion: 'Happy',
          text: 'Tonight, the Verdant Commonwealth breathes free because of your courage. Yet Deino’s parting words ring true—Emperor Kingambit’s legions and Gengar’s Abyss reach far beyond our woods.',
        },
        {
          speaker: MILOTIC_SPEAKER,
          side: 'right',
          emotion: 'Happy',
          text: 'When the roads to the distant kingdoms open, {lord}, you will not walk them as a lone echo of the vanished Dragon Court—you walk them with the family who raised your heart.',
        },
        {
          speaker: { kind: 'partner' },
          side: 'right',
          emotion: 'Happy',
          text: 'Hear that, guys? Five whole kingdoms out past that horizon! Bet you ten Oran Berries I reach the border pass first!',
        },
        {
          speaker: { kind: 'advisor' },
          side: 'right',
          emotion: 'Worried',
          text: 'Five kingdoms’ worth of boss attack ranges?! Ugh... Kecleon, I’m going to need a way bigger waterproof notebook!',
        },
        {
          speaker: { kind: 'lord' },
          side: 'left',
          emotion: 'Happy',
          text: 'Pack two notebooks, Wimpod—and save some berries for the road, {partner}, {healer}. Whatever waits beyond our coast... we face it together.',
        },
      ],
    }),
  },
];

export const STORY_CUTSCENE_BY_ID: Readonly<Record<string, StoryCutsceneDefinition>> =
  Object.fromEntries(DEMO_STORY_CUTSCENES.map((cs) => [cs.id, cs]));

/** Story cutscenes triggered BEFORE entering a demo chapter node for the first time */
export const PRE_CHAPTER_STORY_CUTSCENE_BY_NODE_ID: Readonly<Record<string, string>> = {
  prologue: 'cs_01_coastal_friends',
};

/** Story cutscenes triggered AFTER clearing a demo chapter node for the first time (on battle exit) */
export const POST_CHAPTER_STORY_CUTSCENE_BY_NODE_ID: Readonly<Record<string, string>> = {
  prologue: 'cs_02_sanctuary_reveal',
  chapter_01: 'cs_03_bluff_campfire',
  chapter_02: 'cs_04_watchtower_bells',
  chapter_03: 'cs_05_sanctuary_war_room',
  chapter_04: 'cs_06_orchard_celebration',
};

export function getStoryCutsceneById(id: string): StoryCutsceneDefinition | undefined {
  return STORY_CUTSCENE_BY_ID[id];
}
