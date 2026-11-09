/**
 * Mystery Emblem — Campaign Mechanics & Dynamic Terrain Topics 7–15 (`mechanicsAndTerrainTopics.ts`)
 *
 * Covers Convoy gear, Bosses & Water/Flying, Dungeon Stairs, Vitamins & Drops,
 * Kecleon Shops & TMs, Deployment Caps & Mobile Bosses, Trees/Mountains, Wonder Tiles, and Lava/Void.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const MECHANICS_AND_TERRAIN_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'prep_items_and_convoy',
    title: 'Shared Convoy & Gear vs Consumables',
    category: 'prep_pokemon',
    summary: 'Swapping Held Gear, Berries, Potions, Stones, and X-Items via your shared Convoy.',
    beats: [
      {
        id: 'convoy_beat1',
        emotion: 'Happy',
        dialogue:
          'I guard the shared Convoy bag! Select any teammate and tap an item to equip their 1 slot (old items return safely to the bag). Held Gear boosts every fight, Berries auto-heal, and X-Items buff a stat for the whole dungeon!',
        chips: [
          { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
          { kind: 'item', itemId: 'x_attack', label: 'X-Item (+3 Stat)' },
        ],
      },
    ],
  },
  {
    id: 'ch2_boss_and_traversal',
    title: 'Boss Battles & Water / Flying Traversal',
    category: 'combat_tactics',
    summary: 'Winning Defeat Boss maps, 0-Mov stationary bosses, and crossing rivers.',
    beats: [
      {
        id: 'ch2_beat1_water_flying',
        emotion: 'Surprised',
        dialogue:
          'Heads up—most Grounded Pokémon can’t cross Water! Flying allies soar over rivers at 1 Mov (0 terrain cover), and Water-types like {partner} wade right across at 1 Mov WITH +10% Avoid!',
        chips: [
          { kind: 'type', pokemonType: 'Flying' },
          { kind: 'type', pokemonType: 'Water' },
          { kind: 'badge', label: '1 Mov Across Water', tone: 'cyan' },
        ],
      },
      {
        id: 'ch2_beat2_stationary_boss',
        emotion: 'Happy',
        dialogue:
          'This is a Defeat Boss battle: KO Captain Aron (marked BOSS) and we win instantly! He’s Stationary (0 Mov), so snag any side-path DROP items before finishing him off!',
        chips: [
          { kind: 'badge', label: 'Defeat Boss = Instant Win', tone: 'gold' },
          { kind: 'badge', label: '0 Mov Stationary', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Dungeon Stairs & Enemy Reinforcements',
    category: 'combat_tactics',
    summary: 'Standing directly on Stairs tiles to block incoming enemy reinforcement waves.',
    beats: [
      {
        id: 'ch3_beat1_stairs',
        emotion: 'Shouting',
        dialogue:
          'Enemy reinforcements climb up from Dungeon Stairs on later turns! Park any teammate directly ON a Stairs tile to completely block spawns ("STAIRS BLOCKED!") while getting +1 Def/SpD and +10% Avoid!',
        chips: [
          { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
          { kind: 'badge', label: '+1 Def/SpD · +10% Avo', tone: 'cyan' },
        ],
      },
    ],
  },
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Defeating DROP-carrying foes and using Vitamins for permanent campaign stat boosts.',
    beats: [
      {
        id: 'ch4_beat1_vitamins',
        emotion: 'Surprised',
        dialogue:
          'Ooh, shiny loot! Defeating enemies marked with a DROP icon sends their treasure straight to our Convoy—and Vitamins (like Protein) permanently raise a Pokémon’s stat for the whole campaign when used on the World Map!',
        chips: [
          { kind: 'item', itemId: 'protein', label: 'Permanent +Stat' },
          { kind: 'badge', label: 'KO Enemy w/ DROP', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Browsing 4 rotating World Map Kecleon stalls and teaching permanent TM moves.',
    beats: [
      {
        id: 'shop_beat1_stalls',
        emotion: 'Happy',
        dialogue:
          'Kecleon’s traveling merchants now visit cleared World Map nodes with 4 rotating stalls: TMs, Held Gear, Apothecary (Potions & Stones!), and X-Items! Walk onto a Kecleon node to shop!',
        chips: [
          { kind: 'species', speciesId: '0352', label: 'Kecleon Shop' },
          { kind: 'item', itemId: 'evolution_stone', label: 'Stones & Gear' },
        ],
      },
      {
        id: 'shop_beat2_tms',
        emotion: 'Normal',
        dialogue:
          'TMs are single-use scrolls used from Overworld Menu -> Items or Units—once taught, that move stays permanently unlocked in that Pokémon’s Move Pool forever!',
        chips: [{ kind: 'item', itemId: 'tm13_scald', label: 'Permanent Move Unlock' }],
      },
    ],
  },
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Mobile Bosses',
    category: 'combat_tactics',
    summary: 'Rotating your active strike team and baiting mobile enemy commanders.',
    beats: [
      {
        id: 'ch5_beat1_cap',
        emotion: 'Worried',
        dialogue:
          'Our squad outnumbers this dungeon’s Deployment Cap! Toggle ✓ Deployed vs Standby in Manage Units ({lord} ★ is always in), and move Held Gear off benched pals onto today’s fighters!',
        chips: [{ kind: 'badge', label: 'Rotate Standby Gear', tone: 'gold' }],
      },
      {
        id: 'ch5_beat2_mobile_boss',
        emotion: 'Teary-Eyed',
        dialogue:
          'And watch out—Commander Deino is NOT stationary! Mobile bosses have full Mov and will charge the instant anyone enters their Danger Area, so bait him carefully with a sturdy tank!',
        chips: [{ kind: 'species', speciesId: '0633', label: 'Mobile Boss Charges!' }],
      },
    ],
  },
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Cover: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Using Trees and Mountains for Defense, Special Defense, and Avoid bonuses.',
    beats: [
      {
        id: 'terrain_woods_beat1',
        emotion: 'Happy',
        dialogue:
          'Hiding in bushes actually works! Grounded units pay extra Mov in Trees (+1 Def/SpD, +15% Avo) and Mountains (+2 Def/SpD, +20% Avo) for huge cover—while Flying/Levitate glide over at 1 Mov with 0 cover (and Heavy-Duty Boots get both)!',
        chips: [
          { kind: 'badge', label: 'Trees: +1 Def/SpD · +15% Avo', tone: 'green' },
          { kind: 'badge', label: 'Mountain: +2 Def/SpD · +20% Avo', tone: 'gold' },
        ],
      },
    ],
  },
  {
    id: 'terrain_wonder_tiles',
    title: 'PMD Wonder Tiles',
    category: 'combat_tactics',
    summary: 'Sanctuary tiles granting +2 Def/SpD, +20% Avoid, 20% HP regen, and debuff cleansing.',
    beats: [
      {
        id: 'terrain_wonder_beat1',
        emotion: 'Surprised',
        dialogue:
          'A glowing PMD Wonder Tile! Standing on it grants +2 Def/SpD and +20% Avoid (even to Fliers!), heals 20% HP each turn, and clears debuffs—just lure enemies OFF it so they don’t hog my dream hiding spot!',
        chips: [
          { kind: 'badge', label: '+2 Def/SpD · +20% Avo', tone: 'gold' },
          { kind: 'badge', label: '20% Heal + Cleanse', tone: 'green' },
        ],
      },
    ],
  },
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Shortcuts',
    category: 'combat_tactics',
    summary: 'Crossing Lava with Fire/Flying/Levitate, and Void Chasms or Barriers exclusively with Levitate.',
    beats: [
      {
        id: 'terrain_hazards_beat1',
        emotion: 'Dizzy',
        dialogue:
          'YIKES, don’t look down! Fire-types (+10% Avo), Flying, and Levitate cross Lava at 1 Mov—but deep Void Chasms and Low Barriers block even Fliers! ONLY Levitate Pokémon can float across them!',
        chips: [
          { kind: 'type', pokemonType: 'Fire' },
          { kind: 'badge', label: 'Levitate Only: Void & Barriers', tone: 'gold' },
        ],
      },
    ],
  },
];
