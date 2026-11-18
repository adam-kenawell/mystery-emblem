/**
 * Mystery Emblem - Core Campaign Coaching Topics (`earlyChapterTopics.ts`)
 *
 * Voiced by Quaquaval as non-blocking one-liners with single-screen Field Notes. Zero em dashes.
 */

import type { TutorialTopicDefinition } from './tutorialTypes';

export const EARLY_CHAPTER_TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Moving, Waiting & Danger Area',
    category: 'controls_fusion',
    summary: 'Stride into blue tiles, check attack ranges, and toggle the enemy Danger Area.',
    chips: [
      { kind: 'badge', label: 'Blue: Move', tone: 'cyan' },
      { kind: 'badge', label: 'Red: Attack', tone: 'danger' },
      { kind: 'badge', label: 'Right-Click: Danger Area', tone: 'gold' },
    ],
    bullets: [
      'Tap a ready teammate to view its Blue movement range, Red attack border, and Green support range.',
      'Right-click an empty square (or long-press on mobile) to toggle the purple Enemy Danger Area.',
      'Once all allies act (or you select End Phase from the Field Menu), Enemy Phase begins. If {lord}, {partner}, or {healer} hits 0 HP, the battle is lost.',
    ],
    beats: [
      {
        id: 'ch1_turn1_quip',
        emotion: 'Determined',
        dialogue:
          'Move allies across blue tiles, and right-click (or long-press) anytime to toggle the Danger Area!',
      },
    ],
  },
  {
    id: 'levelup_and_growth',
    title: 'Level-Ups & Growth',
    category: 'world_progression',
    summary: 'Raising stats and unlocking new moves through level-ups.',
    chips: [{ kind: 'badge', label: '100 EXP = +1 Lv', tone: 'gold' }],
    bullets: [
      'Combat, healing, and support actions earn EXP; every 100 EXP raises your level and rolls stat growths.',
      'New moves learned mid-battle unlock into your movepool immediately for review.',
      'Open the Units menu in Battle Prep or on the World Map after battle to equip newly learned moves.',
    ],
    beats: [
      {
        id: 'levelup_beat1_exp',
        emotion: 'Happy',
        dialogue:
          'Every battle and heal builds experience, raising stats and unlocking new moves as you level up.',
      },
    ],
  },
  {
    id: 'overworld_and_skirmishes',
    title: 'The World Map & Foothill Trail',
    category: 'world_progression',
    summary: 'Marching between connected landmarks on the world map.',
    chips: [{ kind: 'badge', label: 'Tap Nodes to Travel', tone: 'cyan' }],
    bullets: [
      'Tap any unlocked node along connected paths on the World Map to march your squad there.',
      'Red nodes hold uncleared chapters; green nodes mark cleared landmarks you can revisit.',
      'Use the bottom dock at your current landmark to launch the chapter battle or visit roadside stalls.',
    ],
    beats: [
      {
        id: 'ow_step1_march_landmarks',
        emotion: 'Determined',
        dialogue:
          'The road to the capital stretches ahead, so tap any connected landmark on the map whenever you are ready to march.',
      },
    ],
  },
  {
    id: 'overworld_expedition_menu',
    title: 'The Expedition Menu',
    category: 'world_progression',
    summary: 'Managing your squad, items, saves, and Field Notes between battles.',
    chips: [{ kind: 'badge', label: 'Units · Items · System', tone: 'gold' }],
    bullets: [
      'Units lets you review stats, customize 4-move loadouts, teach TMs, and feed permanent Vitamins.',
      'Items opens the shared Convoy so you can equip held gear, Berries, and medicine across your team.',
      'System holds Save Progress, Quaquaval Coaching toggles, and all unlocked Field Notes.',
    ],
    beats: [
      {
        id: 'ow_menu_quip',
        emotion: 'Normal',
        dialogue:
          'Before marching on, you can open Menu in the top-right corner anytime to manage moves, items, saves, and Field Notes.',
      },
    ],
  },
  {
    id: 'overworld_supports_unlocked',
    title: 'Unit Supports & Bond Bonuses',
    category: 'world_progression',
    summary: 'Build C to S bonds by fighting beside allies or healing teammates, then unlock conversations.',
    chips: [
      { kind: 'badge', label: 'Ranks C · B · A · S', tone: 'gold' },
      { kind: 'badge', label: '! = Conversation Ready', tone: 'green' },
    ],
    bullets: [
      'Attacking or countering beside an ally and healing teammates builds their Support points, marked by floating hearts in battle.',
      'Open Menu -> Supports on the World Map (or Battle Prep from Chapter 3 onward) whenever an ! badge appears to watch conversations.',
      'Unlocked C, B, A, and S bonds grant each Pokemon signature adjacent combat stat bonuses visible on the Battle Unit Info card.',
    ],
    beats: [
      {
        id: 'ow_supports_quip',
        emotion: 'Happy',
        dialogue:
          'Fighting side by side and healing teammates builds their bond, so open Menu and check Supports whenever an exclamation mark appears to hear their conversations and unlock adjacent stat boosts!',
      },
    ],
  },
  {
    id: 'rift_tremors_wild_pokemon',
    title: 'Rift Tremors on the Roads',
    category: 'world_progression',
    summary: 'Rift tremors stir restless wild Pokemon along roads you have already cleared.',
    chips: [{ kind: 'badge', label: 'Restless Wild Pack', tone: 'danger' }],
    bullets: [
      'Wild skirmish packs appear periodically on cleared landmarks and award bonus Gold if defeated.',
      'Frightened wild Pokemon charge immediately, so brace your front line from Turn 1.',
      'Skirmishes are optional: you can clear them for extra EXP and Gold or march straight past.',
    ],
    beats: [
      {
        id: 'rift_tremors_quip',
        emotion: 'Worried',
        dialogue:
          'Rift tremors have stirred up a restless wild pack along the cleared roads, so stay sharp if you choose to engage them.',
      },
    ],
  },
  {
    id: 'prep_units_and_moves',
    title: 'Battle Prep, Moves & Formation',
    category: 'prep_pokemon',
    summary: 'Pick your active squad, customize moves and items, and arrange map spots.',
    chips: [
      { kind: 'badge', label: '4 Active Moves', tone: 'green' },
      { kind: 'badge', label: 'View Map = Swap Spots', tone: 'cyan' },
    ],
    bullets: [
      'Manage Units lets you choose who deploys, customize 4-move loadouts, and check [E] counter slots.',
      'Manage Items lets you pass held gear, Berries, Potions, and status cures from the shared Convoy.',
      'View Map lets you scout enemy positions, toggle the Danger Area, and tap two blue tiles to swap starting spots.',
    ],
    beats: [
      {
        id: 'prep_hub_quip',
        emotion: 'Determined',
        dialogue:
          'Before you enter battle, you can adjust equipped moves, swap items, and rearrange starting positions from this Prep menu.',
      },
    ],
  },
];
