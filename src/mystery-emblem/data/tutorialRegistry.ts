/**
 * Mystery Emblem — Familiarity-Tailored Progressive Tutorial Registry (`tutorialRegistry.ts`)
 *
 * Modular slide architecture combining:
 * - `'fusion'`: Mystery Emblem-unique hybrid rules & HUD controls (ALWAYS shown as concise 1-card
 *   callouts, even when both Pokémon and Fire Emblem familiarity are set to `'none'` / "Very familiar").
 * - `'pokemon'`: Tailored to `pokemonTutorialDetail` (`'none'` skipped, `'brief'` 1-card refresher,
 *   `'detailed'` beginner-friendly breakdown with concrete examples).
 * - `'fire_emblem'`: Tailored to `fireEmblemTutorialDetail` (`'none'` skipped, `'brief'` 1-card refresher,
 *   `'detailed'` step-by-step tactical breakdown).
 *
 * Strictly covers only live, active gameplay mechanics.
 */

import type {
  DungeonMapDefinition,
  PokemonType,
  TutorialDetailLevel,
  TutorialFamiliarityPreferences,
} from '../types/schemas';

export type TutorialDomain = 'fusion' | 'pokemon' | 'fire_emblem';

export type TutorialCompendiumCategory =
  | 'controls_fusion'
  | 'combat_tactics'
  | 'prep_pokemon'
  | 'world_progression';

export const TUTORIAL_CATEGORY_LABELS: Readonly<Record<TutorialCompendiumCategory, string>> = {
  controls_fusion: 'Controls & Mystery Emblem Rules',
  combat_tactics: 'Combat, Ranges & Terrain',
  prep_pokemon: 'Squad Prep, Moves & Items',
  world_progression: 'World Map, Promotions & Shops',
};

export const TUTORIAL_CATEGORY_ORDER: ReadonlyArray<TutorialCompendiumCategory> = [
  'controls_fusion',
  'combat_tactics',
  'prep_pokemon',
  'world_progression',
];

export const TUTORIAL_DOMAIN_BADGES: Readonly<Record<TutorialDomain, string>> = {
  fusion: 'Mystery Emblem Core',
  pokemon: 'Pokémon Tip',
  fire_emblem: 'Tactical Tip',
};

export interface TutorialVisualChip {
  kind: 'badge' | 'type' | 'item' | 'species';
  label?: string;
  pokemonType?: PokemonType;
  itemId?: string;
  speciesId?: string;
  tone?: 'gold' | 'green' | 'cyan' | 'danger';
}

export interface TutorialSlideContent {
  heading: string;
  bullets: ReadonlyArray<string>;
  callout?: string;
  chips?: ReadonlyArray<TutorialVisualChip>;
}

export interface TutorialSlideSpec {
  id: string;
  domain: TutorialDomain;
  /** Shown regardless of familiarity (used for `'fusion'` mechanics & custom HUD controls) */
  always?: TutorialSlideContent | ReadonlyArray<TutorialSlideContent>;
  /** Concise 1-card refresher when series detail is `'brief'` ("Somewhat familiar") */
  brief?: TutorialSlideContent | ReadonlyArray<TutorialSlideContent>;
  /** Friendly, example-rich cards when series detail is `'detailed'` (Beginner) */
  detailed?: TutorialSlideContent | ReadonlyArray<TutorialSlideContent>;
}

export interface TutorialTopicDefinition {
  id: string;
  title: string;
  category: TutorialCompendiumCategory;
  summary: string;
  /** If true, popup only shows if at least one series tutorial detail !== `'none'` */
  skipPopupWhenBothVeryFamiliar?: boolean;
  slides: ReadonlyArray<TutorialSlideSpec>;
}

export interface ResolvedTutorialSlide extends TutorialSlideContent {
  specId: string;
  domain: TutorialDomain;
  domainLabel: string;
}

function toSlideArray(
  entry?: TutorialSlideContent | ReadonlyArray<TutorialSlideContent>
): ReadonlyArray<TutorialSlideContent> {
  if (!entry) return [];
  return Array.isArray(entry)
    ? (entry as ReadonlyArray<TutorialSlideContent>)
    : [entry as TutorialSlideContent];
}

export const TUTORIAL_TOPICS: ReadonlyArray<TutorialTopicDefinition> = [
  // ============================================================================
  // 1. Chapter 1 (`Western Beach`) — Cold Open Prep Nudge
  // ============================================================================
  {
    id: 'ch1_prep_ready',
    title: 'Ready for Battle!',
    category: 'prep_pokemon',
    summary: 'Jumping straight into Chapter 1 from the Chapter Prep hub.',
    skipPopupWhenBothVeryFamiliar: true,
    slides: [
      {
        id: 'ch1_prep_nudge',
        domain: 'fire_emblem',
        brief: {
          heading: 'Your Starting Trio Is Ready',
          chips: [
            { kind: 'species', speciesId: 'piplup', label: 'Piplup' },
            { kind: 'species', speciesId: 'flabebe', label: 'Flabébé' },
            { kind: 'badge', label: 'Fight!', tone: 'gold' },
          ],
          bullets: [
            'Your Dragon Lord, Piplup, and Flabébé already have moves and starting items equipped.',
            'Tap Fight! whenever you are ready to jump straight into Turn 1—we will cover custom loadouts in Chapter 2!',
          ],
          callout: 'Feel free to peek at View Map or Manage Units early if you are curious.',
        },
        detailed: {
          heading: 'Welcome to Chapter Prep!',
          chips: [
            { kind: 'species', speciesId: 'piplup', label: 'Piplup' },
            { kind: 'species', speciesId: 'flabebe', label: 'Flabébé' },
            { kind: 'badge', label: 'Fight!', tone: 'gold' },
          ],
          bullets: [
            'Before each dungeon battle, this Prep screen lets you organize your team and preview the map.',
            'For your first battle on Western Beach, all 3 of your heroes are already geared up and positioned!',
            'Tap Fight! at the bottom to start the battle right away—we will introduce team customization once new allies join.',
          ],
          callout: 'Tap Fight! to begin Turn 1 of Western Beach.',
        },
      },
    ],
  },

  // ============================================================================
  // 2. Chapter 1 (`Western Beach`) — Turn 1 Controls, Field Menu & Phases
  // ============================================================================
  {
    id: 'ch1_turn1_controls_phases',
    title: 'Dungeon Controls & Turn Phases',
    category: 'controls_fusion',
    summary: 'Camera panning, the empty-tile Field Menu, grid highlights, and defeat rules.',
    slides: [
      {
        id: 'ch1_controls_fusion',
        domain: 'fusion',
        always: {
          heading: 'Camera & Empty-Tile Field Menu',
          chips: [
            { kind: 'badge', label: 'Tap Empty Tile -> Menu', tone: 'gold' },
            { kind: 'badge', label: 'Danger Area', tone: 'danger' },
          ],
          bullets: [
            'Drag anywhere on the dungeon map to pan the camera, and pinch or scroll-wheel to zoom.',
            'Hover (PC) or tap any Pokémon to view its stats, moves, and item in the bottom-left HUD.',
            'Tap any empty floor tile (or right-click / long-press) to open the Field Menu for Danger Area, End Phase, Objective, and Settings!',
          ],
          callout: 'Tip: Toggle Danger Area from the Field Menu to highlight every tile enemies can strike.',
        },
      },
      {
        id: 'ch1_phases_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Phases, Highlights & Casual Retreats',
          chips: [
            { kind: 'badge', label: 'Blue: Move', tone: 'cyan' },
            { kind: 'badge', label: 'Red: Attack', tone: 'danger' },
            { kind: 'badge', label: '★ Lord KO = Defeat', tone: 'gold' },
          ],
          bullets: [
            'Command each ally once during Player Phase (Blue = movement, Red = attack, Green = heal), then enemies act on Enemy Phase.',
            'If your Dragon Lord (★) hits 0 HP, it is Game Over! Other allies who faint retreat from the current dungeon and return healthy next battle.',
          ],
        },
        detailed: [
          {
            heading: 'How Turn-Based Battles Work',
            chips: [
              { kind: 'badge', label: 'Player Phase', tone: 'cyan' },
              { kind: 'badge', label: 'Enemy Phase', tone: 'danger' },
            ],
            bullets: [
              'Battles alternate between Player Phase (all of your Pokémon act) and Enemy Phase (all enemy Pokémon move and attack).',
              'Tap one of your Pokémon to reveal Blue tiles (where it can walk), Red tiles (where its attacks reach), and Green tiles (healing range).',
              'Tap a Blue tile to move and choose Wait—or tap an enemy inside your Red range to preview an attack!',
            ],
            callout: 'Once every ally has acted (or you pick End Phase from an empty tile), Enemy Phase begins.',
          },
          {
            heading: 'Protecting Your Dragon Lord (★)',
            chips: [
              { kind: 'badge', label: '★ Dragon Lord', tone: 'gold' },
              { kind: 'badge', label: 'Allies Recover Post-Battle', tone: 'green' },
            ],
            bullets: [
              'Your quiz-chosen Dragon Lord is marked with a gold ★ star. If your Dragon Lord falls to 0 HP, the battle is lost!',
              'If another teammate faints, they retreat for the rest of this dungeon, but recover at full HP once you win.',
            ],
            callout: 'Keep an eye on enemy reach so multiple foes cannot gang up on a wounded hero.',
          },
        ],
      },
    ],
  },

  // ============================================================================
  // 3. First Combat Forecast Opened — R1/R2, [E] Counter, Types & Forecast Math
  // ============================================================================
  {
    id: 'ch1_first_combat_forecast',
    title: 'Combat Forecast, Ranges & [E] Counters',
    category: 'combat_tactics',
    summary: 'Physical (R1) vs Special (R2), single [E] counter-attacks, type matchups, and x2 doubling.',
    slides: [
      {
        id: 'combat_ranges_equipped_fusion',
        domain: 'fusion',
        always: {
          heading: 'R1 vs R2 & Single [E] Counter Rule',
          chips: [
            { kind: 'badge', label: 'Physical = R1', tone: 'gold' },
            { kind: 'badge', label: 'Special = R2', tone: 'cyan' },
            { kind: 'badge', label: '[E] Equipped', tone: 'green' },
          ],
          bullets: [
            'Physical moves strike at Range 1 (adjacent tiles). Special moves strike at Range 2 (exactly 2 tiles away, including diagonals of 1+1).',
            'When attacked on Enemy Phase, a unit can ONLY counter-attack with its single [E] Equipped move—and only if its range matches the attacker!',
            'Choosing a Physical (R1) or Special (R2) move in this forecast automatically sets it as that unit’s [E] move.',
          ],
          callout: 'Attack a Range-1 foe from 2 tiles away with a Special move (like Bubble) for a free uncountered hit!',
        },
      },
      {
        id: 'combat_types_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Type Multipliers, STAB & Stat Split',
          chips: [
            { kind: 'type', pokemonType: 'Water' },
            { kind: 'type', pokemonType: 'Fire' },
            { kind: 'type', pokemonType: 'Dragon' },
            { kind: 'badge', label: '1.25x STAB', tone: 'green' },
          ],
          bullets: [
            'Matchups scale tactical damage cleanly: 1.25x Super Effective (1.5x double-weak), 0.75x Resisted (0.5x double-resist), or 0x Immune.',
            'Using a move matching the user’s own type grants 1.25x STAB. Physical moves check Atk vs Def; Special moves check SpA vs SpD; PP resets after each dungeon.',
          ],
        },
        detailed: [
          {
            heading: 'Elemental Types & Bonus Damage',
            chips: [
              { kind: 'type', pokemonType: 'Water' },
              { kind: 'type', pokemonType: 'Fairy' },
              { kind: 'type', pokemonType: 'Dark' },
              { kind: 'badge', label: '1.25x STAB', tone: 'green' },
            ],
            bullets: [
              'Every Pokémon and move has an elemental Type. Hitting an enemy’s weakness boosts damage (1.25x or 1.5x), while resisted types deal less (0.75x, 0.5x, or 0x).',
              'For example, Fairy moves hit Dark-type foes like Poochyena for super-effective damage!',
              'Same-Type Attack Bonus (STAB): when a Water-type like Piplup uses a Water move, its power gets a built-in 1.25x boost.',
            ],
          },
          {
            heading: 'Physical vs Special Stats & PP',
            chips: [
              { kind: 'badge', label: 'Atk vs Def (R1)', tone: 'gold' },
              { kind: 'badge', label: 'SpA vs SpD (R2)', tone: 'cyan' },
            ],
            bullets: [
              'Physical moves (R1) compare your Attack (Atk) against the foe’s Defense (Def).',
              'Special moves (R2) compare your Special Attack (SpA) against the foe’s Special Defense (SpD)—great for cracking high-Def armored foes!',
              'Each move has Power Points (PP) showing how many times it can be used during this battle (restored automatically afterward).',
            ],
          },
        ],
      },
      {
        id: 'combat_forecast_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Reading Forecast Math, x2 Speed & Drops',
          chips: [
            { kind: 'badge', label: '+5 Spe = x2', tone: 'gold' },
            { kind: 'badge', label: 'Crit = 2x Dmg', tone: 'danger' },
            { kind: 'item', itemId: 'potion', label: 'DROP' },
          ],
          bullets: [
            'The forecast shows exact Dmg, Hit %, Crit % (2x total damage), and projected HP before you commit.',
            'Outspeeding a foe by +5 Speed or more triggers a follow-up strike (x2). Defeating foes with a DROP icon sends their item to your Convoy!',
          ],
        },
        detailed: {
          heading: 'Reading the Combat Forecast',
          chips: [
            { kind: 'badge', label: 'Dmg · Hit % · Crit %', tone: 'cyan' },
            { kind: 'badge', label: '+5 Spe = x2', tone: 'gold' },
            { kind: 'item', itemId: 'potion', label: 'DROP' },
          ],
          bullets: [
            'Dmg is damage per hit, Hit % is accuracy, and Crit % is your chance to deal 2x damage.',
            'If a Pokémon’s Speed (Spe) is at least 5 higher than its opponent’s, it attacks twice (shown as x2)!',
            'Tap different moves on the left bar to compare outcomes—and defeat enemies carrying a DROP icon to claim their treasure.',
          ],
          callout: 'When an enemy’s portrait winces in Pain, your attack is projected to knock them out!',
        },
      },
    ],
  },

  // ============================================================================
  // 4. First Damaged Ally / First Heal or Item Action — 1-Item Slot & Support
  // ============================================================================
  {
    id: 'ch1_healing_and_items',
    title: 'Healing Allies & The 1-Item Slot',
    category: 'prep_pokemon',
    summary: 'Passive Held Berries/Gear vs manual Consumables, plus Support/Heal moves.',
    slides: [
      {
        id: 'items_single_slot_fusion',
        domain: 'fusion',
        always: {
          heading: '1-Item Slot: Passive Gear vs Active Items',
          chips: [
            { kind: 'item', itemId: 'oran_berry', label: 'Oran Berry (Auto)' },
            { kind: 'item', itemId: 'potion', label: 'Potion (Manual)' },
            { kind: 'item', itemId: 'x_attack', label: 'X Attack' },
          ],
          bullets: [
            'Each Pokémon carries 1 item into battle—either a Passive Held Item OR an Active Consumable.',
            'Held Gear & Berries (like Piplup’s Oran Berry) trigger automatically during combat without spending your turn.',
            'Active Consumables (like Potions, Full Heals, or X-Items) are used manually by selecting Item from the unit’s command menu.',
          ],
          callout: 'Check the top-right item pip on unit portraits to see who is carrying an item!',
        },
      },
      {
        id: 'healing_moves_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Support / Heal Moves',
          chips: [
            { kind: 'species', speciesId: 'flabebe', label: 'Flabébé' },
            { kind: 'badge', label: 'Life Dew (R1-2)', tone: 'green' },
          ],
          bullets: [
            'Support/Heal moves like Flabébé’s Life Dew restore ally HP using move PP instead of consuming Potions.',
            'Healing moves never overwrite your offensive [E] Equipped move, so your healer can still counter-attack with its offensive spell!',
          ],
        },
        detailed: {
          heading: 'Restoring HP with Support Moves',
          chips: [
            { kind: 'species', speciesId: 'flabebe', label: 'Flabébé' },
            { kind: 'badge', label: 'Green = Heal Range', tone: 'green' },
          ],
          bullets: [
            'Some Pokémon—like Flabébé—know dedicated healing moves such as Life Dew that restore an ally’s HP from 1–2 tiles away.',
            'Select Flabébé, move within Green range of a wounded teammate, and tap that teammate (or Heal) to patch them up without spending any items!',
          ],
        },
      },
      {
        id: 'healer_positioning_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Healer EXP & Safe Positioning',
          chips: [
            { kind: 'badge', label: 'Heal Grants EXP', tone: 'gold' },
            { kind: 'badge', label: 'Avoid Danger Area', tone: 'danger' },
          ],
          bullets: [
            'Casting Support/Heal moves awards combat EXP so dedicated healers level up right alongside attackers.',
            'Keep squishier healers outside the purple-red Enemy Danger Area while healing frontliners from Range 2!',
          ],
        },
        detailed: {
          heading: 'Keeping Healers Safe Behind the Frontline',
          chips: [
            { kind: 'badge', label: 'Heal Grants EXP', tone: 'gold' },
            { kind: 'badge', label: 'Range 2 Safety', tone: 'cyan' },
          ],
          bullets: [
            'Support Pokémon earn EXP every time they heal a wounded teammate, helping them level up without taking risky melee fights.',
            'Because healers tend to have lower physical Defense, stand behind your sturdy frontliners and heal from 2 tiles away!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 5. Dynamic First Level-Up / Lv. 10 Stone — Growths & Manual Promotions
  // ============================================================================
  {
    id: 'levelup_and_evolution',
    title: 'Level-Ups & Evolution Stone Promotions',
    category: 'world_progression',
    summary: '100 EXP level-ups, stat growth rolls, and manual Lv. 10+ Evolution Stone promotion.',
    slides: [
      {
        id: 'manual_evolution_fusion',
        domain: 'fusion',
        always: {
          heading: 'Manual Evolution Promotions (Lv. 10+)',
          chips: [
            { kind: 'item', itemId: 'evolution_stone', label: 'Evolution Stone (Lv. 10+)' },
            { kind: 'item', itemId: 'evolution_gem', label: 'Evolution Gem (Lv. 20+)' },
          ],
          bullets: [
            'Pokémon in Mystery Emblem do NOT evolve automatically upon leveling up!',
            'Once a Stage-1 ally reaches Level 10+, promote them manually with an Evolution Stone (from Overworld Units, Chapter Prep, or mid-battle Evolve! if holding one).',
            'Promotions grant instant stat bonuses while keeping your continuous Level (1–40)—no level reset!',
          ],
          callout: 'You receive your first Evolution Stone early, so check who hits Lv. 10 first!',
        },
      },
      {
        id: 'evolution_learnsets_pokemon',
        domain: 'pokemon',
        brief: {
          heading: '3-Stage Lines & Level-Up Moves',
          chips: [
            { kind: 'badge', label: 'Stage 1 -> 2 -> 3', tone: 'gold' },
            { kind: 'badge', label: 'Learnset Unlocks', tone: 'green' },
          ],
          bullets: [
            'Most allies progress Stage 1 -> Stage 2 (Lv. 10+ Evolution Stone) -> Stage 3 (Lv. 20+ Evolution Gem), preserving custom nicknames.',
            'Leveling up and evolving unlocks stronger moves in a Pokémon’s move pool (auto-equipped if < 4 moves, or swappable in Units/Prep).',
          ],
        },
        detailed: {
          heading: 'Evolving & Unlocking Stronger Moves',
          chips: [
            { kind: 'species', speciesId: 'piplup', label: 'Piplup' },
            { kind: 'item', itemId: 'evolution_stone', label: 'Lv. 10+ Stone' },
          ],
          bullets: [
            'As Pokémon grow stronger, they can transform into more powerful evolved forms with higher stats and movement!',
            'Leveling up also teaches brand-new attacks. If your Pokémon already has 4 active moves, new moves are saved safely in its Move Pool so you can swap them in anytime.',
          ],
        },
      },
      {
        id: 'exp_growths_fe',
        domain: 'fire_emblem',
        brief: {
          heading: '100 EXP Curve & Percentage Growths',
          chips: [
            { kind: 'badge', label: '100 EXP = Lv Up', tone: 'gold' },
            { kind: 'badge', label: 'Rubber-Band EXP', tone: 'cyan' },
          ],
          bullets: [
            'Every 100 EXP triggers a Level-Up rolling each unit’s bespoke HP/Atk/Def/SpA/SpD/Spe growth percentages.',
            'EXP scales by level difference: lower-level allies catch up rapidly, while over-leveled units earn reduced EXP from weaker foes.',
          ],
        },
        detailed: {
          heading: 'How EXP & Stat Growths Work',
          chips: [
            { kind: 'badge', label: '100 EXP = +1 Level', tone: 'gold' },
          ],
          bullets: [
            'Dealing damage, defeating foes, and healing teammates all award Experience Points (EXP). Every 100 EXP raises that Pokémon’s Level by 1!',
            'Each species has unique strengths—a speedy striker gains Speed often, while a guardian gains HP and Defense—and sharing knockouts keeps your whole squad balanced.',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 6. Post-Ch. 1 Overworld Arrival — World Map, Party Menu & Anti-Grind
  // ============================================================================
  {
    id: 'overworld_and_skirmishes',
    title: 'The World Map & Party Menu',
    category: 'world_progression',
    summary: 'Road travel across kingdoms, Units/Items/System menu, and Feral Skirmishes.',
    slides: [
      {
        id: 'overworld_menu_fusion',
        domain: 'fusion',
        always: {
          heading: 'World Map Travel & Top-Right Menu',
          chips: [
            { kind: 'badge', label: 'Menu: Units · Items · System', tone: 'gold' },
            { kind: 'item', itemId: 'evolution_stone', label: 'Promote in Units' },
          ],
          bullets: [
            'Tap any unlocked World Map node to travel along kingdom roads, then tap your current story landmark to launch the next chapter.',
            'Open Menu (top-right, or right-click / long-press) anytime to manage Moves, equip Convoy items, rename allies, or use Evolution Stones!',
            'Cleared story chapters stay peaceful and cannot be replayed infinitely, keeping campaign progression tight.',
          ],
          callout: 'You can adjust Tutorial Detail or re-read unlocked tips anytime under Menu -> System!',
        },
      },
      {
        id: 'skirmishes_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Occasional Feral Skirmishes',
          chips: [
            { kind: 'badge', label: 'Bonus Skirmish', tone: 'danger' },
          ],
          bullets: [
            'After clearing chapters, a Feral Skirmish may occasionally appear on a cleared road node.',
            'Skirmishes offer optional bonus EXP and Gold for under-leveled recruits, and clear immediately once defeated.',
          ],
        },
        detailed: {
          heading: 'Optional Skirmish Battles',
          chips: [
            { kind: 'badge', label: 'Feral Skirmish = Bonus EXP & Gold', tone: 'danger' },
          ],
          bullets: [
            'Occasionally, wild feral Pokémon will appear on a previously cleared map location as an optional Skirmish.',
            'Travel back to that node if you want extra EXP and Gold before the next story chapter—once cleared, the road returns to normal!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 7. Chapter 2 Prep / First Manage Units — 4-Move Loadouts, [E] & View Map
  // ============================================================================
  {
    id: 'prep_units_and_moves',
    title: 'Customizing Loadouts & Starting Positions',
    category: 'prep_pokemon',
    summary: 'Selecting 4 active moves, setting your [E] counter move, and swapping blue tiles.',
    slides: [
      {
        id: 'prep_loadout_fusion',
        domain: 'fusion',
        always: {
          heading: '4-Move Loadout & Setting [E] Equipped',
          chips: [
            { kind: 'badge', label: 'Up to 4 Moves', tone: 'green' },
            { kind: 'badge', label: '[E] Counter Move', tone: 'gold' },
          ],
          bullets: [
            'In Manage Units, toggle up to 4 unlocked moves into each Pokémon’s active battle loadout.',
            'Tap [E] next to any offensive move to choose whether that unit counters adjacent melee foes (Physical R1) or ranged casters (Special R2) during Enemy Phase!',
          ],
          callout: 'Check your new recruits’ moves and [E] counter range before every battle.',
        },
      },
      {
        id: 'prep_pool_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Unlocked Move Pool & Nicknames',
          chips: [
            { kind: 'badge', label: 'Rename Anytime', tone: 'cyan' },
          ],
          bullets: [
            'Moves learned by level-up or TM stay permanently in a Pokémon’s Unlocked Move Pool so you can swap coverage per chapter.',
            'Tap the Rename pencil in Manage Units (or Overworld Units) whenever you want to give an ally a custom nickname!',
          ],
        },
        detailed: {
          heading: 'Swapping Moves & Naming Allies',
          chips: [
            { kind: 'badge', label: 'Permanent Move Pool', tone: 'green' },
            { kind: 'badge', label: 'Custom Nickname', tone: 'gold' },
          ],
          bullets: [
            'Even though a Pokémon brings at most 4 moves into a dungeon, it never permanently forgets unlocked moves—swap them freely between battles!',
            'You can also personalize any teammate’s nickname using the Rename button in Manage Units.',
          ],
        },
      },
      {
        id: 'prep_viewmap_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'View Map & Blue-Tile Position Swaps',
          chips: [
            { kind: 'badge', label: 'View Map', tone: 'cyan' },
            { kind: 'badge', label: 'Tap 2 Blue Tiles = Swap', tone: 'gold' },
          ],
          bullets: [
            'Tap View Map in Chapter Prep to scout enemy stats, droppable items, and terrain before Turn 1.',
            'Tap any two glowing Blue starting tiles while in View Map to swap where your deployed allies begin!',
          ],
        },
        detailed: {
          heading: 'Scouting & Rearranging Starting Spots',
          chips: [
            { kind: 'badge', label: 'View Map', tone: 'cyan' },
            { kind: 'badge', label: 'Tap 2 Blue Tiles', tone: 'gold' },
          ],
          bullets: [
            'Choose View Map before fighting to look over the entire dungeon, see what types of enemies wait ahead, and plan your route.',
            'Want a sturdy defender in front or a flier near a river? Simply tap two Blue starting squares to swap those teammates’ starting spots!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 8. First Manage Items (or Ch. 2 Prep) — Shared Convoy & Item Categories
  // ============================================================================
  {
    id: 'prep_items_and_convoy',
    title: 'The Shared Convoy & Item Categories',
    category: 'prep_pokemon',
    summary: 'Swapping items cleanly between your shared Convoy bag and unit slots.',
    slides: [
      {
        id: 'convoy_swap_fusion',
        domain: 'fusion',
        always: {
          heading: 'Shared Convoy & Instant Slot Swapping',
          chips: [
            { kind: 'item', itemId: 'muscle_band', label: 'Held Gear' },
            { kind: 'item', itemId: 'oran_berry', label: 'Berry' },
            { kind: 'item', itemId: 'potion', label: 'Consumable' },
          ],
          bullets: [
            'All unequipped rewards, purchases, and enemy drops live in your shared Convoy.',
            'In Manage Items, select a Pokémon and tap any Convoy item to equip it—any item they were previously holding automatically returns to the Convoy!',
          ],
        },
      },
      {
        id: 'item_categories_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Held Gear vs Consumables, Stones & X-Items',
          chips: [
            { kind: 'item', itemId: 'muscle_band', label: 'Muscle Band' },
            { kind: 'item', itemId: 'x_attack', label: 'X Attack' },
          ],
          bullets: [
            'Held Gear (like Muscle Band) grants permanent passive combat bonuses without being consumed; Berries auto-trigger once when needed.',
            'Potions heal HP, Evolution Stones promote Lv. 10+ units, and X-Items grant a +3 stat boost (or +20% Crit) for the rest of the dungeon.',
          ],
        },
        detailed: {
          heading: 'Choosing What Each Teammate Carries',
          chips: [
            { kind: 'item', itemId: 'muscle_band', label: '+2 Physical Dmg' },
            { kind: 'item', itemId: 'oran_berry', label: 'Auto-Heal' },
            { kind: 'item', itemId: 'x_attack', label: '1-Battle Boost' },
          ],
          bullets: [
            'Passive Gear (like Muscle Band) powers up every attack automatically and never runs out.',
            'Berries trigger on their own in a pinch, while Potions and X-Items are activated manually during battle to heal or power up for a tough boss.',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 9. Chapter 2 (`Verdant Bluff`) Turn 1 — Boss Objective & Water/Flying Traversal
  // ============================================================================
  {
    id: 'ch2_boss_and_traversal',
    title: 'Boss Battles & Water / Flying Traversal',
    category: 'combat_tactics',
    summary: 'Defeat Boss objective, stationary 0-Mov bosses, and crossing rivers.',
    slides: [
      {
        id: 'water_flying_traversal_fusion',
        domain: 'fusion',
        always: {
          heading: 'Crossing Rivers: Flying & Water-Types',
          chips: [
            { kind: 'type', pokemonType: 'Flying' },
            { kind: 'type', pokemonType: 'Water' },
            { kind: 'badge', label: '1 Mov Across Water', tone: 'cyan' },
          ],
          bullets: [
            'Most Grounded Pokémon cannot step into Water tiles—check the bottom-left Tile Info card anytime to inspect terrain!',
            'Flying allies soar across Water and rough terrain for just 1 Mov (receiving 0 terrain cover bonuses).',
            'Grounded Water-types (like Piplup) can ALSO wade across Water at 1 Mov while gaining +10% Avoid!',
          ],
          callout: 'Flank across the bluff’s stream with Piplup and your Flying recruit!',
        },
      },
      {
        id: 'defeat_boss_stationary_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Defeat Boss & Stationary Leaders (0 Mov)',
          chips: [
            { kind: 'badge', label: 'Objective: Defeat Boss', tone: 'gold' },
            { kind: 'badge', label: '0 Mov Stationary', tone: 'danger' },
          ],
          bullets: [
            'In Defeat Boss chapters, victory triggers immediately upon knocking out the enemy BOSS (Captain Aron).',
            'Stationary bosses have 0 Mov—they never leave their post, so check their equipped [E] range and claim any side-path DROPs before finishing them!',
          ],
        },
        detailed: {
          heading: 'Winning a "Defeat Boss" Chapter',
          chips: [
            { kind: 'badge', label: 'BOSS Badge', tone: 'danger' },
            { kind: 'badge', label: '0 Mov = Holds Post', tone: 'cyan' },
          ],
          bullets: [
            'Check the chapter objective in the Field Menu: here at Verdant Bluff, you win the moment you defeat Captain Aron (marked BOSS)!',
            'Captain Aron is Stationary (0 Mov), meaning he stays anchored on his tile and only strikes units within his weapon range.',
            'If other enemies carry valuable DROP items, defeat them first before landing the final blow on the boss!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 10. Chapter 3 (`Cleft Mountain`) Turn 1 — Dungeon Stairs & Reinforcements
  // ============================================================================
  {
    id: 'ch3_stairs_reinforcements',
    title: 'Dungeon Stairs & Enemy Reinforcements',
    category: 'combat_tactics',
    summary: 'Standing directly on Stairs tiles to block incoming enemy reinforcement waves.',
    slides: [
      {
        id: 'stairs_seal_fusion',
        domain: 'fusion',
        always: {
          heading: 'Sealing Dungeon Stairs',
          chips: [
            { kind: 'badge', label: 'Stairs: +1 Def/SpD · +10% Avo', tone: 'cyan' },
            { kind: 'badge', label: 'Stand On Stairs = Block Spawns', tone: 'gold' },
          ],
          bullets: [
            'Enemy reinforcements climb up from Dungeon Stairs tiles on scheduled turns!',
            'Standing any unit directly on a Stairs tile completely blocks reinforcements from spawning there ("STAIRS BLOCKED!") while granting +1 Def/SpD and +10% Avoid.',
          ],
          callout: 'Park a sturdy ally on exposed Stairs to shut down ambushes from behind!',
        },
      },
      {
        id: 'reinforcement_pacing_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Managing Reinforcement Waves',
          chips: [
            { kind: 'badge', label: 'Plug or Push Forward', tone: 'green' },
          ],
          bullets: [
            'On Rout maps with Stairs, either occupy nearby Stairs before waves arrive or keep squishier backliners clear of open stairwells.',
          ],
        },
        detailed: {
          heading: 'Staying Ready for Reinforcements',
          chips: [
            { kind: 'badge', label: 'Watch Open Stairs', tone: 'danger' },
          ],
          bullets: [
            'Don’t leave wounded healers right beside an unoccupied Stairs tile when ending your turn!',
            'Either station a tough teammate right on top of the Stairs to seal it, or form a defensive wall a couple of tiles back.',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 11. Chapter 4 (`River Shrine`) Turn 1 — Permanent Stat Vitamins & Drops
  // ============================================================================
  {
    id: 'ch4_vitamins',
    title: 'Permanent Stat Vitamins & Rare Drops',
    category: 'world_progression',
    summary: 'Claiming rare enemy drops like Protein for permanent stat upgrades.',
    slides: [
      {
        id: 'vitamins_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Permanent Stat Vitamins',
          chips: [
            { kind: 'item', itemId: 'protein', label: 'Protein (+Atk)' },
            { kind: 'item', itemId: 'calcium', label: 'Calcium (+SpA)' },
          ],
          bullets: [
            'Vitamins (HP Up, Protein, Iron, Calcium, Zinc, Carbos) permanently increase a Pokémon’s stat when used from Overworld Menu -> Units or Items.',
          ],
          callout: 'Unlike X-Items (1-battle boosts), Vitamin stat gains last for the entire campaign!',
        },
        detailed: {
          heading: 'Boosting Stats Permanently with Vitamins',
          chips: [
            { kind: 'item', itemId: 'protein', label: 'Protein' },
            { kind: 'item', itemId: 'hp_up', label: 'HP Up' },
          ],
          bullets: [
            'Special treasures called Vitamins permanently raise one of a Pokémon’s core stats for the rest of your adventure!',
            'Once you earn a Vitamin (like Protein in River Shrine), open Menu -> Units or Items on the World Map to power up your favorite teammate.',
          ],
        },
      },
      {
        id: 'securing_drops_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Securing Rare Enemy Drops',
          chips: [
            { kind: 'item', itemId: 'protein', label: 'DROP' },
          ],
          bullets: [
            'Inspect enemy commanders on Turn 1—defeating foes marked with a DROP icon automatically sends their treasure to your Convoy!',
          ],
        },
        detailed: {
          heading: 'Spotting Treasure-Carrying Enemies',
          chips: [
            { kind: 'item', itemId: 'protein', label: 'DROP Icon' },
          ],
          bullets: [
            'Tap enemy leaders to check their Character Info card—if you see a DROP item badge, knocking out that foe rewards you with that item!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 12. Post-Ch. 4 Overworld — Kecleon Shops & Single-Use TMs
  // ============================================================================
  {
    id: 'kecleon_shops_and_tms',
    title: 'Kecleon Shops & Teaching TMs',
    category: 'world_progression',
    summary: 'Visiting rotating World Map merchant stalls for TMs, Gear, Stones, and X-Items.',
    slides: [
      {
        id: 'kecleon_stalls_fusion',
        domain: 'fusion',
        always: {
          heading: '4 Rotating Kecleon Merchant Stalls',
          chips: [
            { kind: 'species', speciesId: '0352', label: 'Kecleon' },
            { kind: 'item', itemId: 'tm13_scald', label: 'TMs' },
            { kind: 'item', itemId: 'evolution_stone', label: 'Stones & Gear' },
          ],
          bullets: [
            'Rescuing Kecleon unlocks traveling merchant stalls across cleared World Map nodes!',
            'Each Kecleon hosts 1 of 4 specialty stalls: TM Stall, Held Gear, Apothecary (Potions & Evolution Stones), or X-Item Tactical Stall.',
            'Travel onto a node with a Kecleon sprite and tap Kecleon Shop to browse its current stock.',
          ],
        },
      },
      {
        id: 'tms_pokemon',
        domain: 'pokemon',
        brief: {
          heading: 'Single-Use TMs & Compatibility',
          chips: [
            { kind: 'item', itemId: 'tm09_thunderbolt', label: 'Single-Use TM' },
          ],
          bullets: [
            'Technical Machines (TMs) are single-use scrolls used from Overworld Menu -> Items (or Units) to permanently add a move to a compatible ally’s Move Pool.',
          ],
        },
        detailed: {
          heading: 'Teaching New Moves with TMs',
          chips: [
            { kind: 'item', itemId: 'tm09_thunderbolt', label: 'TM Scroll' },
            { kind: 'badge', label: 'Permanent Unlock', tone: 'green' },
          ],
          bullets: [
            'Technical Machines (TMs) let you teach powerful new attacks—like Thunderbolt, Ice Beam, or Scald—to compatible Pokémon!',
            'Each TM item is consumed after teaching it to one Pokémon, permanently unlocking that move in their Move Pool.',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 13. Chapter 5 (`Berry Orchards`) Prep — Deployment Cap & Mobile Bosses
  // ============================================================================
  {
    id: 'ch5_deployment_cap_and_mobile_boss',
    title: 'Deployment Caps & Aggressive Bosses',
    category: 'combat_tactics',
    summary: 'Choosing your active strike team and baiting mobile enemy commanders.',
    slides: [
      {
        id: 'deployment_cap_mobile_boss_fe',
        domain: 'fusion',
        always: {
          heading: 'Deployment Cap & Mobile Boss Range',
          chips: [
            { kind: 'badge', label: '6 / 6 Deployed', tone: 'gold' },
            { kind: 'species', speciesId: '0633', label: 'Commander Deino' },
          ],
          bullets: [
            'Your roster now exceeds this dungeon’s Deployment Cap! In Manage Units, toggle ✓ Deployed vs Standby to choose who enters battle (your ★ Dragon Lord is always deployed).',
            'Unlike stationary captains, mobile bosses like Commander Deino have full movement and will charge the moment any ally enters their attack range!',
          ],
          callout: 'Toggle Danger Area and bait mobile bosses with a high-Def/SpD tank rather than rushing in!',
        },
      },
      {
        id: 'bench_rotation_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Rotating Standby Gear & Coverage',
          chips: [
            { kind: 'badge', label: 'Swap Gear Freely', tone: 'cyan' },
          ],
          bullets: [
            'Remember to transfer Held Gear or Consumables off Standby allies in Manage Items so your deployed squad goes in at full strength.',
          ],
        },
        detailed: {
          heading: 'Picking the Best Team for the Map',
          chips: [
            { kind: 'type', pokemonType: 'Fairy' },
            { kind: 'type', pokemonType: 'Dragon' },
          ],
          bullets: [
            'Check View Map first to see which enemy types guard the battlefield—for example, Fairy and Ice moves shine against Dragon- and Dark-type foes!',
            'Before tapping Fight!, move any Held Items from benched Standby allies onto the heroes fighting today.',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 14. Dynamic Terrain — Trees / Foliage & Mountain Crags
  // ============================================================================
  {
    id: 'terrain_cover_woods_crags',
    title: 'Defensive Terrain: Trees & Mountains',
    category: 'combat_tactics',
    summary: 'Trading extra Movement cost for Defense, Special Defense, and Avoid cover.',
    slides: [
      {
        id: 'woods_crags_fusion',
        domain: 'fusion',
        always: {
          heading: 'Cover Bonuses vs Airborne Traversal',
          chips: [
            { kind: 'badge', label: 'Trees: +1 Def/SpD · +15% Avo', tone: 'green' },
            { kind: 'badge', label: 'Mountain: +2 Def/SpD · +20% Avo', tone: 'gold' },
            { kind: 'item', itemId: 'heavy_duty_boots', label: 'Heavy-Duty Boots' },
          ],
          bullets: [
            'Grounded units spend extra Movement in Trees (2 Mov) and Mountains (3 Mov; 2 Mov for Rock/Ground/Fighting) in exchange for strong Def, SpD, and Avoid bonuses!',
            'Flying and Levitate units glide over both for 1 Mov, but gain 0 cover bonuses. Grounded holders of Heavy-Duty Boots pay 1 Mov AND keep full cover!',
          ],
        },
      },
      {
        id: 'cover_baiting_fe',
        domain: 'fire_emblem',
        brief: {
          heading: 'Baiting Enemies from Cover',
          chips: [
            { kind: 'badge', label: 'End Turn in Cover', tone: 'cyan' },
          ],
          bullets: [
            'Stationing a frontliner on Trees or Mountain at the edge of Enemy Danger Area cuts incoming damage and boosts dodge chance during Enemy Phase.',
          ],
        },
        detailed: {
          heading: 'Using Terrain to Win Tough Exchanges',
          chips: [
            { kind: 'badge', label: 'Check Bottom-Left Tile Card', tone: 'cyan' },
          ],
          bullets: [
            'Instead of standing on open floor, end your turn on Trees or Mountain tiles whenever enemies are about to attack you—and try to lure enemies OFF cover before striking them!',
          ],
        },
      },
    ],
  },

  // ============================================================================
  // 15. Dynamic Terrain — PMD Wonder Tiles
  // ============================================================================
  {
    id: 'terrain_wonder_tiles',
    title: 'PMD Wonder Tiles',
    category: 'combat_tactics',
    summary: 'Fortified sanctuary tiles that boost defenses, heal HP each turn, and cleanse debuffs.',
    slides: [
      {
        id: 'wonder_tile_fusion',
        domain: 'fusion',
        always: {
          heading: 'Sanctuary of the Dungeon: Wonder Tiles',
          chips: [
            { kind: 'badge', label: '+2 Def/SpD · +20% Avo (All)', tone: 'gold' },
            { kind: 'badge', label: '20% HP Heal + Cleanse', tone: 'green' },
          ],
          bullets: [
            'Standing on a glowing PMD Wonder Tile grants +2 Def, +2 SpD, and +20% Avoid—even to Flying and Levitate Pokémon!',
            'At the start of your Phase, units standing on a Wonder Tile automatically recover 20% Max HP and clear temporary stat debuffs.',
          ],
          callout: 'Note: Enemies benefit from Wonder Tiles too—dislodge or lure them off!',
        },
      },
    ],
  },

  // ============================================================================
  // 16. Dynamic Terrain — Lava, Void Chasms & Low Barriers
  // ============================================================================
  {
    id: 'terrain_hazards_lava_void',
    title: 'Lava, Chasms & Levitate Shortcuts',
    category: 'combat_tactics',
    summary: 'Which traversal classes can cross molten Lava, deep Void Chasms, and Low Barriers.',
    slides: [
      {
        id: 'hazards_levitate_fusion',
        domain: 'fusion',
        always: {
          heading: 'Lava, Deep Chasms & Levitate Mastery',
          chips: [
            { kind: 'type', pokemonType: 'Fire' },
            { kind: 'badge', label: 'Flying: Crosses Lava', tone: 'cyan' },
            { kind: 'badge', label: 'Levitate: Crosses Void & Barriers', tone: 'gold' },
          ],
          bullets: [
            'Lava / Magma can be crossed at 1 Mov by Fire-types (+10% Avoid), Flying units, and Levitate units.',
            'Void / Chasms and Low Barriers block both Grounded AND Flying units—ONLY Pokémon with the Levitate traversal class can float across them (1 Mov)!',
          ],
        },
      },
    ],
  },
];

export const TUTORIAL_TOPIC_MAP: ReadonlyMap<string, TutorialTopicDefinition> = new Map(
  TUTORIAL_TOPICS.map((topic) => [topic.id, topic])
);

export function getTutorialTopicById(topicId: string): TutorialTopicDefinition | undefined {
  return TUTORIAL_TOPIC_MAP.get(topicId);
}

export interface ResolveTutorialSlidesOptions {
  /**
   * When true (player opened the topic intentionally from the Tutorials / Guide compendium),
   * series slides whose preference is `'none'` fall back to `'brief'` so veterans can still
   * look up any unlocked mechanic on demand.
   */
  compendiumFullView?: boolean;
}

export function resolveSlidesForTutorialTopic(
  topicId: string,
  prefs: TutorialFamiliarityPreferences,
  options?: ResolveTutorialSlidesOptions
): ResolvedTutorialSlide[] {
  const topic = TUTORIAL_TOPIC_MAP.get(topicId);
  if (!topic) return [];

  const compendiumFullView = Boolean(options?.compendiumFullView);

  if (
    !compendiumFullView &&
    topic.skipPopupWhenBothVeryFamiliar &&
    prefs.pokemonTutorialDetail === 'none' &&
    prefs.fireEmblemTutorialDetail === 'none'
  ) {
    return [];
  }

  const pickDetailSlides = (
    spec: TutorialSlideSpec,
    detail: TutorialDetailLevel
  ): ReadonlyArray<TutorialSlideContent> => {
    const effectiveDetail: TutorialDetailLevel =
      detail === 'none' && compendiumFullView ? 'brief' : detail;

    if (effectiveDetail === 'none') {
      return [];
    }
    if (effectiveDetail === 'detailed') {
      const detailedList = toSlideArray(spec.detailed);
      return detailedList.length > 0 ? detailedList : toSlideArray(spec.brief);
    }
    const briefList = toSlideArray(spec.brief);
    return briefList.length > 0 ? briefList : toSlideArray(spec.detailed);
  };

  const resolved: ResolvedTutorialSlide[] = [];

  for (const spec of topic.slides) {
    let contents: ReadonlyArray<TutorialSlideContent> = [];
    if (spec.domain === 'fusion') {
      contents = toSlideArray(spec.always);
    } else if (spec.domain === 'pokemon') {
      contents = pickDetailSlides(spec, prefs.pokemonTutorialDetail);
    } else if (spec.domain === 'fire_emblem') {
      contents = pickDetailSlides(spec, prefs.fireEmblemTutorialDetail);
    }

    for (const content of contents) {
      resolved.push({
        ...content,
        specId: spec.id,
        domain: spec.domain,
        domainLabel: TUTORIAL_DOMAIN_BADGES[spec.domain],
      });
    }
  }

  return resolved;
}

/**
 * Dynamically detects special dungeon terrain tutorials that apply to `map` so custom maps and
 * later chapters introduce Trees/Mountains, Wonder Tiles, and Lava/Void/Barriers the very first
 * time the player encounters them.
 */
export function detectDynamicMapTerrainTutorialIds(map: DungeonMapDefinition): string[] {
  let hasCover = false;
  let hasWonder = false;
  let hasLavaOrVoid = false;

  for (const row of map.tiles) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      const t = cell?.terrain;
      if (t === 'trees' || t === 'mountain') {
        hasCover = true;
      } else if (t === 'wonder_tile') {
        hasWonder = true;
      } else if (t === 'lava' || t === 'void' || t === 'barrier') {
        hasLavaOrVoid = true;
      }
    }
  }

  const topics: string[] = [];
  if (hasCover) topics.push('terrain_cover_woods_crags');
  if (hasWonder) topics.push('terrain_wonder_tiles');
  if (hasLavaOrVoid) topics.push('terrain_hazards_lava_void');
  return topics;
}
