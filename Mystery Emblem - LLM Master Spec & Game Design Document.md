# **Mystery Emblem — LLM Master Spec & Game Design Document**

**Author:** Adam Kenawell  
**Platform:** Web Browser (hosted on existing Pokémon Mystery Dungeon sprite/animation API site)  
**Core Concept:** A tactical RPG fan game that mixes the grid-based combat, growth rates, overworld map, and battle prep of Fire Emblem (specifically Fire Emblem Awakening) with the characters, lore, moves, types, and items of Pokémon (using Pokémon Mystery Dungeon sprites and animations).

# **PART 1: STORY & GAME FLOW (STARTING FOCUS)**

## **1.1 The "Pokémon Mystery Dungeon" Starting Quiz, Dragon Lord & Partner Selection**

When a player starts a new save file, the game opens with a 9-question personality quiz in the style of *Pokémon Mystery Dungeon*, followed by a Partner selection screen.

* **Dual-Purpose Quiz Mechanics (Lord Selection \+ Mixed-Group Recruit Seeding):**  
  * **1\. Determines Your "Dragon Lord":** Each answer adds personality points toward one of the **8 Stage-1 Dragon Pokémon**. At the end of the quiz, the highest-scoring trait assigns your Lord (with an optional manual override). Because the main story revolves around your Lord being the **only Pokémon in the world who possesses the ancient "Dragon Power"** needed to unite the warring kingdoms and stop the world's destruction, no other Dragon-line units appear as standard recruits.  
  * **2\. Determines Future Chapter Recruits (Singles, Duos & a Trio):** To keep recruitment pacing varied and unpredictable, each quiz question seeds a different group size for a future chapter:  
    * **Single Recruits:** Your Partner's Best-Friend Healer in the Prologue (Q1), a solo Electric-type in Chapter 4 (Q4), and a solo Fire-type in Chapter 8 (Q7).  
    * **Paired Duos:** A starting-route Bug & Flying duo in Chapter 1 (Q2), a Ghost & Psychic duo in Chapter 2 (Q3), a Water & Grass duo in Chapter 7 (Q6), a Steel & Fairy duo in Chapter 10 (Q8), and an Ice & Armored duo in Chapter 12 (Q9).  
    * **Three-Pokémon Trio:** A Fighting, Rock & Ground trio that joins all at once in Chapter 5 (Q5).  
* **The 8 Dragon Lord Options (All 3-Stage Pseudo-Legendary / Dragon Lines):**  
  * **Dratini** (Dratini \-\> Dragonair \-\> Dragonite) — *Mystic / Gentle trait*  
  * **Bagon** (Bagon \-\> Shelgon \-\> Salamence) — *Bold / Determined trait*  
  * **Gible** (Gible \-\> Gabite \-\> Garchomp) — *Fierce / Impulsive trait*  
  * **Deino** (Deino \-\> Zweilous \-\> Hydreigon) — *Tenacious / Relentless trait*  
  * **Goomy** (Goomy \-\> Sliggoo \-\> Goodra) — *Kind / Resilient trait*  
  * **Jangmo-o** (Jangmo-o \-\> Hakamo-o \-\> Kommo-o) — *Honorable / Disciplined trait*  
  * **Dreepy** (Dreepy \-\> Drakloak \-\> Dragapult) — *Clever / Swift trait*  
  * **Frigibax** (Frigibax \-\> Arctibax \-\> Baxcalibur) — *Stoic / Composed trait*  
* **The 9-Question Personality Quiz Script, Trait Weights & Recruit Seeds:**  
  * Each question is presented in second-person *Pokémon Mystery Dungeon: Explorers of Sky* style. Question 1 offers 6 choices (seeding the 6 Prologue Healers), while Questions 2 through 9 each offer 3 choices (24 choices across Q2–Q9, where each of the 8 Dragon Lords serves as the primary **\+2 point** trait exactly 3 times and the secondary **\+1 point** trait exactly 3 times).  
  * **Tie-Breaker & Manual Override Rule:** If two or more Dragon Lords tie for the highest trait score after Question 9, the tie is broken by whichever tied Dragon Lord received points earliest in the quiz. On the Lord reveal screen, the player may either accept their quiz-assigned Dragon Lord or manually override the result to pick any of the 8 Dragon Lords.

**Question 1 — Prologue Healer Seed (Partner's Best Friend):**  
*Prompt: "A fierce storm has just passed over your coastal village, and a weary traveler stumbles into the town square looking exhausted. How do you help them recover?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Prologue Healer Recruit |
| :---- | :---- | :---- | :---- |
| **A** | "Bring them a warm meal and a soft blanket right away." | **Goomy \+2**, **Dratini \+1** | **Happiny** (Chansey \-\> Blissey) |
| **B** | "Gather soothing herbs and flowers to calm their spirits." | **Dratini \+2**, **Dreepy \+1** | **Flabébé** (Floette \-\> Florges) |
| **C** | "Rally the neighbors and cheer them up with a lively smile\!" | **Bagon \+2**, **Gible \+1** | **Bounsweet** (Steenee \-\> Tsareena) |
| **D** | "Lead them somewhere quiet so they can rest in peace and silence." | **Frigibax \+2**, **Deino \+1** | **Hatenna** (Hattrem \-\> Hatterene) |
| **E** | "Check their supplies and share your own rations for the road ahead." | **Jangmo-o \+2**, **Goomy \+1** | **Smoliv** (Dolliv \-\> Arboliva) |
| **F** | "Tell them an encouraging story to bring back their luck and hope." | **Dreepy \+2**, **Bagon \+1** | **Togepi** (Togetic \-\> Togekiss) |

**Question 2 — Chapter 1 Route-1 Bug & Flying Duo Seed:**  
*Prompt: "You are setting out on your very first expedition up a misty coastal bluff when the main trail splits into three paths. Which route do you take?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 1 Duo Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "The familiar, sunlit dirt road where I can see the horizon clearly." | **Bagon \+2**, **Jangmo-o \+1** | **Caterpie & Pidgey** (Kanto) |
| **B** | "The winding forest footpath shaded by tall, rustling canopy trees." | **Goomy \+2**, **Dratini \+1** | **Sewaddle & Pidove** (Unova) |
| **C** | "The steep rocky shortcut climbing straight up the seaside cliffs." | **Gible \+2**, **Deino \+1** | **Grubbin & Pikipek** (Alola) |

**Question 3 — Chapter 2 Ghost & Psychic Duo Seed:**  
*Prompt: "While exploring an ancient mountain ruin at dusk, you hear eerie footsteps echoing from behind a locked stone door. What is your first instinct?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 2 Duo Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "Study the runes on the doorframe to outsmart whatever is inside." | **Dreepy \+2**, **Frigibax \+1** | **Duskull & Abra** |
| **B** | "Reach out with empathy—someone inside might be trapped and scared." | **Dratini \+2**, **Goomy \+1** | **Duskull & Ralts** |
| **C** | "Brace yourself and hold your ground until the mystery reveals itself." | **Frigibax \+2**, **Jangmo-o \+1** | **Duskull & Solosis** |

**Question 4 — Chapter 4 Solo Electric Attacker Seed:**  
*Prompt: "Enemy scouts have spotted your camp from the treetops and are about to signal their main force\! How do you react?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 4 Solo Recruit |
| :---- | :---- | :---- | :---- |
| **A** | "Dash in with a burst of speed to surprise them before they can move\!" | **Dreepy \+2**, **Bagon \+1** | **Pichu** (Pikachu \-\> Raichu) |
| **B** | "Lock eyes with their leader and charge straight at them to break their nerve\!" | **Gible \+2**, **Deino \+1** | **Shinx** (Luxio \-\> Luxray) |
| **C** | "Coordinate with your squad to cut off their escape route from range." | **Jangmo-o \+2**, **Frigibax \+1** | **Mareep** (Flaaffy \-\> Ampharos) |

**Question 5 — Chapter 5 Fighting, Rock & Ground Trio Seed:**  
*Prompt: "A heavily armed vanguard is marching down a narrow coastal pass toward your allies. What kind of frontline strategy do you trust most?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 5 Trio Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "A balanced formation that adapts to terrain and strikes from every angle." | **Jangmo-o \+2**, **Dreepy \+1** | **Machop, Geodude & Trapinch** |
| **B** | "An unbreakable wall of muscle and stone that refuses to yield an inch." | **Deino \+2**, **Frigibax \+1** | **Machop, Roggenrola & Rhyhorn** |
| **C** | "A relentless, hard-hitting charge that overwhelms their line before they dig in." | **Gible \+2**, **Bagon \+1** | **Mankey, Nacli & Rhyhorn** |

**Question 6 — Chapter 7 Water & Grass Duo Seed:**  
*Prompt: "After a grueling battle, your team makes camp beside a quiet pond in a foggy forest. How do you spend the evening watch?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 7 Duo Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "Practicing combat drills by the water's edge to stay sharp for tomorrow." | **Bagon \+2**, **Jangmo-o \+1** | **Poliwag & Bellsprout** |
| **B** | "Listening to the rain on the lily pads and keeping everyone's spirits light." | **Goomy \+2**, **Dreepy \+1** | **Lotad & Oddish** |
| **C** | "Standing silent guard on the perimeter so the rest of the squad can sleep." | **Deino \+2**, **Dratini \+1** | **Tympole & Budew** |

**Question 7 — Chapter 8 Solo Fire Attacker Seed:**  
*Prompt: "Deep inside a volcanic cavern, a river of magma blocks the bridge to the enemy commander. What drives you to push forward through the heat?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 8 Solo Recruit |
| :---- | :---- | :---- | :---- |
| **A** | "Pure fiery grit—no obstacle is going to stand in my way\!" | **Gible \+2**, **Deino \+1** | **Magby** (Magmar \-\> Magmortar) |
| **B** | "The thrill of soaring over danger and striking where they least expect it." | **Bagon \+2**, **Dreepy \+1** | **Fletchling** (Fletchinder \-\> Talonflame) |
| **C** | "A quiet, burning resolve to uncover the truth hidden in the shadows." | **Dratini \+2**, **Frigibax \+1** | **Litwick** (Lampent \-\> Chandelure) |

**Question 8 — Chapter 10 Steel & Fairy Duo Seed:**  
*Prompt: "While crossing a vast desert, you discover a buried treasure chest half-covered in sand. What do you hope to find inside?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 10 Duo Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "A giant, custom-forged weapon that can smash through enemy armor\!" | **Deino \+2**, **Gible \+1** | **Tinkatink & Cleffa** |
| **B** | "A dependable piece of gear that keeps my whole team working in sync." | **Jangmo-o \+2**, **Goomy \+1** | **Klink & Azurill** |
| **C** | "An ancient, mysterious gadget pulsing with strange energy." | **Dreepy \+2**, **Dratini \+1** | **Magnemite & Igglybuff** |

**Question 9 — Chapter 12 Ice & Armored/Tech Duo Seed:**  
*Prompt: "You finally stand before the crystal gates of the enemy stronghold as a bitter blizzard howls around you. What final thought crosses your mind before battle?"*

| Option | Player Answer Choice | Dragon Lord Trait Points | Chapter 12 Duo Recruits |
| :---- | :---- | :---- | :---- |
| **A** | "Keep a cool head—every move on the grid is a puzzle waiting to be solved." | **Frigibax \+2**, **Dratini \+1** | **Galarian Mime Jr. & Beldum** |
| **B** | "Trust in the bonds we've built—we'll weather any storm together." | **Goomy \+2**, **Bagon \+1** | **Vanillite & Porygon** |
| **C** | "No hesitation—press forward until the very last enemy falls\!" | **Deino \+2**, **Gible \+1** | **Swinub & Blipbug** |

* **Partner Pokémon Selection & The Prologue Trio (Lord \+ Partner \+ Best-Friend Healer):**  
  * Immediately after the quiz reveals your Dragon Lord, you freely select your **Partner Pokémon** from any of the classic **Stage-1 Starter Pokémon** (e.g., Bulbasaur, Charmander, Squirtle, Chikorita, Cyndaquil, Totodile, Treecko, Torchic, Mudkip, Turtwig, Chimchar, Piplup, Rowlet, Litten, Popplio, etc.).  
  * You begin the Prologue with a balanced **3-Pokémon squad**: your **Dragon Lord**, your **Partner**, and your Partner's **Best Friend (Healer)** seeded by Question 1:  
    * **Happiny** (Happiny \-\> Chansey \-\> Blissey)  
    * **Flabébé** (Flabébé \-\> Floette \-\> Florges)  
    * **Bounsweet** (Bounsweet \-\> Steenee \-\> Tsareena)  
    * **Hatenna** (Hatenna \-\> Hattrem \-\> Hatterene)  
    * **Smoliv** (Smoliv \-\> Dolliv \-\> Arboliva)  
    * **Togepi** (Togepi \-\> Togetic \-\> Togekiss)  
* **The "Lord" Mechanic & Dragon Power Progression:**  
  * **Force Deployed & Defeat Condition:** Your Lord must be deployed in every main story battle, and if your Lord faints, it triggers an immediate Game Over for that map.  
  * **Leader Passive (Dragon Aura):** Allied Pokémon within 2 tiles of your Lord receive \+10% Hit and \+10% Avoid.  
  * **Unlocking the Dragon Power:** As the campaign progresses through the war between the kingdoms and your Lord uncovers the truth of their royal Dragon lineage, their dormant Dragon Power awakens at key story turning points—granting promotion resonances at Level 10 (Stage 2\) and Level 20 (Stage 3\) and unlocking a signature Dragon move in Act 4 required to pierce the final boss's barrier.  
* **New Game Plus (NG+) Mode (Manual Roster Selection):**  
  * Completing the main campaign (clearing Chapter 25\) unlocks **New Game Plus** when starting a new save file.  
  * **The Only Difference:** Instead of taking the 9-question personality quiz to randomly/trait-seed your units, New Game Plus opens a **Custom Roster Selection Screen** at the start of the run. From this screen, the player manually chooses:  
    * **1\. Their Dragon Lord** (picking directly from the 8 Stage-1 Dragon options: Dratini, Bagon, Gible, Deino, Goomy, Jangmo-o, Dreepy, or Frigibax).  
    * **2\. Their Partner Pokémon** (any Stage-1 Starter Pokémon).  
    * **3\. Every Chapter Recruit Option (Q1–Q9 Slots):** Manually selecting which Prologue Healer (Q1) and which specific single, duo, or trio options (Q2–Q9) will appear in Chapters 1, 2, 4, 5, 7, 8, 10, and 12\.  
  * All other campaign mechanics, enemy levels, story events, and progression rules remain 100% identical to a standard playthrough.  
* **Persistent Pokémon Nicknaming & Renaming Anytime:**  
  * Whenever a Pokémon joins your roster (including your Dragon Lord after the quiz, your Partner, your Prologue Healer, and every chapter or paralogue recruit), the game prompts the player to give that Pokémon a custom **Nickname** (or keep its default species name).  
  * Custom nicknames are stored persistently in the save state throughout the entire campaign and are preserved when the Pokémon evolves into Stage 2 and Stage 3\.  
  * The player can **rename any of their Pokémon at any point in the game** via the Units / Roster menu on the Overworld or during the Pre-Battle Prep screen. All dialogue boxes, combat forecasts, and status screens display the Pokémon's nickname alongside its current species name.

## **1.2 The Overworld (Fire Emblem Awakening Style)**

Between battles, the player navigates a node-based Overworld map connected by paths, working the same way as the world map in *Fire Emblem Awakening*.

* **Story Chapter Nodes:** Advancing to the next uncompleted node triggers the next chapter's story dialogue and main battle. Clearing a chapter unlocks the next path on the map.  
* **Overworld Skirmishes (Occasional Spawns — No Infinite Grinding):**  
* Wild/Feral Skirmishes **only occasionally appear** on previously cleared map nodes across the Overworld (spawning with a low random chance after clearing a chapter, just like in *Fire Emblem Awakening*).  
  * Because skirmishes are limited and expire/clear once fought, the player **cannot endlessly grind levels** on the Overworld, keeping the campaign's Level 1–30 difficulty curve tight and meaningful.  
* **Overworld Kecleon Shops (Unlocked in Paralogue 2 — Random Spawns & 4 Shop Types):**  
  * After rescuing **Master Merchant Kecleon** and his supply caravan from Imperial poachers in **Paralogue 2 (Oran Forest)**, **Kecleon Shops** (represented by a Kecleon sprite) permanently unlock and appear randomly at different cleared nodes across the Overworld map.  
  * Whenever a Kecleon sprite spawns on a node, it opens one of **four distinct shop types**:  
2. **TM Shop:** Sells single-use, general-purpose Technical Machines (TMs) for teaching coverage and utility moves.  
3. **Held Item Shop:** Sells passive Held Items (type boosters, berries, combat gear) for a Pokémon's Held Item slot.  
4. **Healing Item Shop:** Sells active recovery and curing items (Potions, Super Potions, Hyper Potions, Full Heals, Revives/Seeds) as well as **Evolution Stones** and **Evolution Gems** at key story milestones.  
5. **X-Item Shop:** Sells single-battle stat-boosting consumables (*X Attack*, *X Defense*, *X Sp. Atk*, *X Sp. Def*, *X Speed*, *Dire Hit*).

## **1.3 The Pre-Battle Sequence (Battle Prep Screen)**

Once the player enters a Chapter or Skirmish node, the game loads the Battle Prep screen before Turn 1 starts. From here, the player can:

6. **View the Map:** Freely pan around the battlefield grid to check terrain types, choke points, Wonder Tiles, and enemy starting positions. Clicking an enemy shows their level, stats, type, movement range, and equipped moves.  
7. **Select Units (Scaling Fire Emblem Deployment Slots):** Pick Pokémon from your roster to bring to the fight and swap their starting positions on the blue deployment tiles. Rather than a flat 6-unit cap, map deployment limits scale across the campaign just like traditional *Fire Emblem* games:  
   * **Prologue:** 3 Deployment Slots (Lord, Partner, and Partner's Friend)  
   * **Act 1 (Chapters 1 – 6):** 5 to 8 Deployment Slots  
   * **Act 2 (Chapters 7 – 13):** 8 to 10 Deployment Slots  
   * **Act 3 & Act 4 (Chapters 14 – 25):** 10 to 12 Deployment Slots  
8. **Equip Moves (4-Move Loadout & Single Active Move):** Each Pokémon can equip up to **4 moves** for the upcoming battle from all the moves it has unlocked so far (via level-up or TMs). You also choose which **single move** starts as that Pokémon's currently equipped move for Enemy Phase counter-attacks.  
9. **Manage Items:** Each Pokémon has 2 item slots:  
   * **1 Held Item Slot (Passive):** Items like Leftovers, Oran Berry, or Mystic Water that grant passive stat boosts or automatic effects in combat.  
   * **1 Consumable / Utility Slot (Active):** Items like Potions, Full Heals, **Evolution Stones**, or **Evolution Gems** that use the unit's action for the turn when activated.

## **1.4 Campaign Storyline, Warring Kingdoms, Mixed Quiz Recruits & 25-Chapter Progression**

**World & Premise (The Five Kingdoms & The Lost Dragon Lineage):**   
In a world inhabited solely by Pokémon, the continent is divided into five major realms: the coastal **Verdant Commonwealth** led by **Chancellor Serperior**, the mountain-dwelling **Cragforge Clans** of **High Thane Copperajah**, the secluded **Mistveil Enclave** guided by **High Seeress Milotic**, the desert **Mirage Sultanate** ruled by **Sultan Hippowdon**, and the militaristic **Ironscale Kingdom** under **Emperor Kingambit** (with **Royal Protector Aegislash**, **General Krookodile**, and **Royal Tactician Gengar**). Decades ago, the five realms knew peace under the mediation of the royal **Dragon Clan**, until the Dragon lineage vanished in a sudden night of betrayal.  
Now, the Ironscale Kingdom has launched a sudden, ruthless war of conquest to overthrow all the neighboring kingdoms—unleashing terrifying "Feral" shock troops (Pokémon driven into mindless, glowing-eyed berserker rage by Gengar's forbidden shadow experiments). You wake up washed ashore in the Verdant Commonwealth with no memory of your past, rescued by your chosen **Partner Starter Pokémon** and their healer best friend. When an Ironscale scouting party attacks, your dormant **Dragon Power** flares to life—revealing you to **Chancellor Serperior** as the last surviving heir of the Dragon Lineage, the only leader capable of rallying the fractured kingdoms and uncovering the dark conspiracy behind the war.  
**Zero Player/Enemy Roster Overlap & Strict 3-Stage Playable Rule:**   
Every standard playable Pokémon on the player's roster must belong to a **3-stage evolution line** (evolving via an Evolution Stone at Level 10+ and an Evolution Gem at Level 20+, with Paralogue 2's **Eevee** serving as a special Level 15 branching exception). Enemy Pokémon do not need to adhere to the 3-stage evolution rule (and may include 1-stage, 2-stage, and 3-stage Pokémon). To strictly preserve distinct faction identities between the player's liberation alliance and the Ironscale Kingdom, **no Pokémon evolutionary line appearing in the enemy army may ever be recruited or used by the player**, with the **sole exception of a single defecting Gastly in Paralogue 6** (meaning **Aron \-\> Lairon \-\> Aggron**, **Spheal \-\> Sealeo \-\> Walrein**, **Timburr \-\> Gurdurr \-\> Conkeldurr**, **Seedot \-\> Nuzleaf \-\> Shiftry**, and **Venipede \-\> Whirlipede \-\> Scolipede** are strictly enemy lines and never playable).  
**Key Non-Playable Rulers & Allied Story Characters:**

* **Chancellor Serperior (Verdant Commonwealth):** The wise statesperson of the coastal republic who recognizes your royal Dragon crest in Chapter 1, sponsors your liberation militia, and coordinates naval logistics in Act 3 and Act 4\.  
* **High Thane Copperajah (Cragforge Clans):** The honorable, ancient forge-lord of the central mountains who stayed loyal to the old Dragon Clan treaties. Betrayed and imprisoned by his warmongering lieutenant **Clan Warlord Aggron** in Act 1, and liberated by your army in Chapter 18 to awaken your Lord's final promotion resonance.  
* **High Seeress Milotic (Mistveil Enclave):** The mystic ruler of the eastern wetlands and Foggy Forest. Initially suspecting the Mirage Sultanate of staging Feral border raids, she joins your coalition once you expose Gengar's false-flag saboteurs in Chapters 7 through 9 and helps your Lord channel the First Dragon Resonance.  
* **Sultan Hippowdon (Mirage Sultanate):** The boisterous ruler of the southern desert oasis. After you save him from Gengar's subterranean sappers beneath his palace in Chapter 11, he commits the Sultanate's treasury and desert garrisons to your liberation army.  
* **Master Merchant Kecleon (Traveling Shopkeeper):** A resourceful merchant ambushed by Imperial poachers in **Paralogue 2 (Oran Forest)**. Rescuing Kecleon and his supply caravan during that Paralogue permanently unlocks random **Kecleon Shops** (TM, Held Item, Healing/Evolution, and X-Item shops) across cleared Overworld nodes.

**Major Story Twists & Act Arcs:**

* **Act 1 Twist (Warlord Aggron's Mountain Betrayal):** After pushing Ironscale raiders off the Verdant coast for **Chancellor Serperior**, your militia marches to Mt. Horn (Ch. 6\) expecting to join forces with **High Thane Copperajah**—only to discover that **Clan Warlord Aggron** has overthrown and imprisoned Copperajah, secretly selling out the mountain pass to **Siege Warden Coalossal** and **Sky Marshal Corviknight** and forcing your army into a desperate retreat east.  
* **Act 2 Twist (The False-Flag Conspiracy):** Escaping into the Mistveil Enclave, you prove to **High Seeress Milotic** and **Sultan Hippowdon** that **Royal Tactician Gengar** and **Grand Oracle Gothitelle** have been staging fake Feral attacks to trick the eastern kingdoms into blaming each other. When you defeat **General Krookodile** at Crystal Crossing (Ch. 13), the proud general warns you that **Emperor Kingambit** is no longer in control: Gengar's shadow cabal is using the bloodshed of the war—and hunting your Dragon Power—to unseal an ancient abyssal entity beneath the continent.  
* **Act 3 Twist (The Ancestral Murals & The Liberation of Cragforge):** Crossing into the occupied north to spark a liberation rebellion, you hold the Sealed Ruin (Ch. 16\) where ancient murals reveal that Gengar orchestrated the massacre of your Dragon family years ago and that you were smuggled out to sea as an infant to survive. You then strike back into the mountains to defeat **Clan Warlord Aggron** and **Siege Warden Coalossal** (Ch. 17–18), freeing **High Thane Copperajah** to unite the Cragforge Clans behind your banner before storming Blizzard Island (Ch. 20).  
* **Act 4 Twist (The Fall of Gengar & The Abyssal Awakening):** Launching a naval assault with **Chancellor Serperior**'s fleet across Miracle Sea (Ch. 21\) and breaching Aegis Cave (Ch. 22), you strike down **Royal Tactician Gengar** in his volcanic sanctum at Dark Crater (Ch. 23), but his dying ritual unseals the abyssal rift. After defeating **Royal Protector Aegislash** at Temporal Spire (Ch. 24), your fully awakened Dragon Lord leads the united alliance of **Serperior**, **Copperajah**, **Milotic**, and **Hippowdon** to confront **Emperor Kingambit** at the Throne Pinnacle in Spatial Rift (Ch. 25\) to save the world.

**Mixed-Group Quiz Recruitment Table (Singles, Duos & a Trio — All 3-Stage Playable Lines):**   
Recruitment is front-loaded into Acts 1 and 2, mixing up solo recruits, iconic pairs (starting with a Route-1 Bug & Flying duo), and a 3-unit trio:

| Quiz Question | Group Size & Theme | Chapter | Option A Recruit(s) | Option B Recruit(s) | Option C (+ D/E/F for Q1) Recruit(s) |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Q1** | **Single:** Partner's Healer Friend | **Prologue** | **Happiny** / **Flabébé** | **Bounsweet** / **Hatenna** | **Smoliv** / **Togepi** |
| **Q2** | **Duo:** Route-1 Bug & Flying Pair | **Chapter 1** | **Caterpie & Pidgey** (Kanto) | **Sewaddle & Pidove** (Unova) | **Grubbin & Pikipek** (Alola) |
| **Q3** | **Duo:** Ghost & Psychic Pair | **Chapter 2** | **Duskull & Abra** | **Duskull & Ralts** | **Duskull & Solosis** |
| **Q4** | **Single:** Solo Electric Attacker | **Chapter 4** | **Pichu** (Electric) | **Shinx** (Electric) | **Mareep** (Electric) |
| **Q5** | **Trio:** Fighting, Rock & Ground | **Chapter 5** | **Machop, Geodude & Trapinch** | **Machop, Roggenrola & Rhyhorn** | **Mankey, Nacli & Rhyhorn** |
| **Q6** | **Duo:** Water & Grass Pair | **Chapter 7** | **Poliwag & Bellsprout** | **Lotad & Oddish** | **Tympole & Budew** |
| **Q7** | **Single:** Solo Fire Attacker | **Chapter 8** | **Magby** (Fire) | **Fletchling** (Fire/Flying) | **Litwick** (Ghost/Fire) |
| **Q8** | **Duo:** Steel & Fairy Pair | **Chapter 10** | **Tinkatink & Cleffa** | **Klink & Azurill** | **Magnemite & Igglybuff** |
| **Q9** | **Duo:** Ice & Armored Pair | **Chapter 12** | **Galarian Mime Jr. & Beldum** | **Vanillite & Porygon** | **Swinub & Blipbug** |

**Main Campaign (Prologue \+ 25 Chapters across 4 Acts):**  
Every map uses authentic dungeon tilesets from *Pokémon Mystery Dungeon: Explorers of Sky*.

### **Act 1: The Invasion of the Verdant Coast (Prologue – Chapter 6\) — *Varied Early Pacing***

| Chapter (Deploy Cap) | PMD: EoS Dungeon Tileset | Map & Story Progression | Recruitable Stage-1 Pokémon (Mixed Group Sizes) |
| :---- | :---- | :---- | :---- |
| **Prologue** (3 Units) | **Beach Cave** (Sand & shallow water) | Your Partner and their healer best friend find you washed ashore; your Dragon Aura awakens as Ironscale scouts attack the beach. | **Your Dragon Lord**, **Your Partner**, and **Q1 Healer Friend (Single)** (Happiny / Flabébé / Bounsweet / Hatenna / Smoliv / Togepi) |
| **Chapter 1** (5 Units) | **Drenched Bluff** (Rocky bluffs & water pools) | Travelling up the coastal route to meet **Chancellor Serperior** in the Commonwealth capital, a local Bug and Flying pair joins your cause. Unlocks Overworld. | **Q2 Route-1 Bug & Flying (Duo)** (Caterpie & Pidgey / Sewaddle & Pidove / Grubbin & Pikipek) |
| **Chapter 2** (6 Units) | **Mt. Bristle** (Mountain crags & trees) | Sent by **Chancellor Serperior** toward the mountain border fort, a wandering Ghost and Psychic duo helps you fend off **Gothita**'s Ironscale raiders. | **Q3 Ghost & Psychic (Duo)** (Duskull & Abra / Duskull & Ralts / Duskull & Solosis) |
| **Chapter 3** (6 Units) | **Waterfall Cave** (Underground streams & bridges) | You infiltrate the cavern behind the falls to rescue Commonwealth envoys held by an Ironscale garrison captain. | **None** (Early tactical test using your 7-unit squad across water and bridges) |
| **Chapter 4** (7 Units) | **Apple Woods** (Dense trees & Wonder Tiles) | Ambushed in the woods by **Seedot** guerillas and Feral shock troops climbing **Dungeon Stairs** tiles; a lone Electric attacker steps in to help zap enemy fliers. | **Q4 Electric Attacker (Single)** (Pichu / Shinx / Mareep) |
| **Chapter 5** (8 Units) | **Craggy Coast** (High coastal cliffs & sea water) | A three-unit mercenary band (Fighting, Rock, and Ground) helps you hold the coastal road against **Sandile**, **Galarian Zigzagoon**, and **Impidimp**. | **Q5 Fighting, Rock & Ground (Trio)** (Machop, Geodude & Trapinch / Machop, Roggenrola & Rhyhorn / Mankey, Nacli & Rhyhorn) |
| **Chapter 6** (8 Units) | **Mt. Horn** (Steep mountain switchbacks) | **Act 1 Twist:** You reach Mt. Horn expecting to join **High Thane Copperajah**, but **Clan Warlord Aggron** has imprisoned Copperajah and betrayed the pass to **Siege Warden Coalossal** and **Sky Marshal Corviknight**, forcing a fighting escape east. | None (Lets your newly expanded squad shine after the Ch. 5 Trio) |

### **Act 2: The Eastern Coalition & The False Flag (Chapters 7 – 13\) — *Core Roster Completion***

| Chapter (Deploy Cap) | PMD: EoS Dungeon Tileset | Map & Story Progression | Recruitable Stage-1 Pokémon (Mixed Group Sizes) |
| :---- | :---- | :---- | :---- |
| **Chapter 7** (9 Units) | **Foggy Forest** (Misty trees & shallow ponds) | Escaping into the Mistveil Enclave to seek an audience with **High Seeress Milotic** as Feral Skirmishes unlock on the Overworld and the first **Evolution Stones** (Lv. 10 promotion) appear. | **Q6 Water & Grass (Duo)** (Poliwag & Bellsprout / Lotad & Oddish / Tympole & Budew) |
| **Chapter 8** (9 Units) | **Steam Cave** (Volcanic rock & Lava rivers) | Guided by **High Seeress Milotic** to the border volcano; your Lord awakens their First Dragon Resonance as a lone Fire-type joins to fight Boss Carkol. | **Q7 Fire Attacker (Single)** (Magby / Fletchling / Litwick) |
| **Chapter 9** (9 Units) | **Amp Plains** (Savannah plains & tree clusters) | Exposing **Gothorita**'s false-flag saboteurs on the open plains to prove the Mirage Sultanate's innocence to **High Seeress Milotic** while plugging three **Stairs** tiles. | **Starly (Single)** (Flying border scout, Turn 1\) |
| **Chapter 10** (10 Units) | **Northern Desert** (Sand dunes & high rock walls) | Entering the Mirage Sultanate and breaking Boss Krokorok's desert siege outside **Sultan Hippowdon**'s oasis. | **Q8 Steel & Fairy (Duo)** (Tinkatink & Cleffa / Klink & Azurill / Magnemite & Igglybuff) |
| **Chapter 11** (10 Units) | **Quicksand Cave** (Sand pits & subterranean chasms) | Descending beneath the desert palace to stop Gengar's sappers from assassinating **Sultan Hippowdon** and framing the Mistveil Enclave. | **Lillipup (Single)** (Normal 3-stage loyal palace guard, Turn 1\) |
| **Chapter 12** (10 Units) | **Crystal Cave** (Crystal pillars & narrow corridors) | An indoor maze backed by **Sultan Hippowdon**'s alliance where crystal barriers block Grounded and Flying units, testing your positioning against Boss Doublade / Aegislash. | **Q9 Ice & Armored/Tech (Duo)** (Galarian Mime Jr. & Beldum / Vanillite & Porygon / Swinub & Blipbug) |
| **Chapter 13** (10 Units) | **Crystal Crossing** (Frozen lake, ice trees & water) | **Act 2 Twist:** Defeating General Krookodile at the frozen crossing; he reveals Gengar is manipulating Emperor Kingambit to unseal an abyssal calamity. | None (Boss milestone chapter) |

### **Act 3: The Northern Rebellion & The Imperial Schism (Chapters 14 – 20\) — *Tapering Recruitment***

| Chapter (Deploy Cap) | PMD: EoS Dungeon Tileset | Map & Story Progression | Recruitable Stage-1 Pokémon |
| :---- | :---- | :---- | :---- |
| **Chapter 14** (10 Units) | **Chasm Cave** (Deep Void chasms & rope bridges) | Crossing the northern abyss back into occupied Cragforge territory where **Void** tiles block both Grounded and Flying units across narrow bridges. | None (Focuses on promoting your core squad) |
| **Chapter 15** (11 Units) | **Dark Hill** (Dead trees, cliffs & stairs) | Night battle on a haunted hill overrun by **Gothitelle** and Gengar's Feral Ghost and Dark experiments pouring out of Stairs tiles. | None |
| **Chapter 16** (11 Units) | **Sealed Ruin** (Ancient stone walls & Wonder Tiles) | **Act 3 Twist:** Holding the ancestral Dragon Ruin for 10 turns; murals reveal Gengar wiped out your Dragon clan, awakening your Lord's Lv. 20 **Evolution Gem** power. | None (First Evolution Gems awarded on clear) |
| **Chapter 17** (11 Units) | **Dusk Forest** (Autumn trees & narrow choke points) | Defeating the traitor **Clan Warlord Aggron** in the autumn mountain woods as you march to liberate the Cragforge capital. | **Whismur (Single)** (Normal sound-based ranged support, Turn 1\) |
| **Chapter 18** (11 Units) | **Treeshroud Forest** (Overgrown ancient woods & pools) | Toppling Siege Warden Coalossal in Treeshroud Forest and liberating **High Thane Copperajah**, uniting the Cragforge Clans behind your coalition. | None |
| **Chapter 19** (12 Units) | **Brine Cave** (Saltwater caverns & coastal cliffs) | Linking up with **Chancellor Serperior**'s Commonwealth fleet at the seaside staging port to capture the imperial flagship and sail for the heartland. | None |
| **Chapter 20** (12 Units) | **Blizzard Island** (Snowy mountains & ice chasms) | Storming **Grand Oracle Gothitelle**'s northern citadel in a blizzard as northern resistance forces rally against Gengar's shadow cabal, splitting the Empire in two. | **Pawmi (Single)** (Electric/Fighting northern rebel scout, Turn 1\) |

### **Act 4: The Fall of Ironscale & The Abyssal Awakening (Chapters 21 – 25\) — *Endgame Gauntlet***

| Chapter (Deploy Cap) | PMD: EoS Dungeon Tileset | Map & Story Progression | Recruitable Stage-1 Pokémon |
| :---- | :---- | :---- | :---- |
| **Chapter 21** (12 Units) | **Miracle Sea** (Island chain, deep water & bridges) | Island-hopping naval assault with **Chancellor Serperior**'s fleet across the outer sea defenses of the Ironscale Capital against **Sky Marshal Corviknight**. | None |
| **Chapter 22** (12 Units) | **Aegis Cave** (Ancient rune chambers & stone pillars) | Breaching the subterranean gatehouse of the capital guarded by **Siege Warden Coalossal**, **Aggron**'s armor remnants, and active Stairs tiles. | **Larvitar (Single)** (Low-level Rock/Dark prisoner in a royal dungeon cell; classic late-game "Est" unit) |
| **Chapter 23** (12 Units) | **Dark Crater** (Volcanic caldera & Lava rivers) | **Act 4 Twist:** Defeating Shadow Tactician Gengar in the volcanic sanctum, whose sacrificial ritual shatters the seal on the abyssal rift. | None |
| **Chapter 24** (12 Units) | **Temporal Tower / Spire** (Floating clockwork ruins & Void) | Climbing the collapsing spire to defeat Royal Protector Aegislash as your Lord unlocks their ultimate Dragon Power. | None (Penultimate gauntlet) |
| **Chapter 25** (12 Units) | **Spatial Rift / Sky Peak Pinnacle** (Void chasms, Lava vents, Trees & Wonder Tiles) | Backed by the united armies of **Serperior**, **Copperajah**, **Milotic**, and **Hippowdon**, your fully awakened Dragon Lord leads your 12-unit squad to defeat Emperor Kingambit at the Throne Pinnacle and restore peace to the kingdoms. | None (Final Boss Map) |

### **Optional Paralogue Chapters (Special Mechanics Units, Kecleon Rescue & Extra Recruits)**

Clearing certain main chapters unlocks optional **Paralogue nodes** branching off the Overworld map, featuring two signature special-mechanic recruits (**Slakoth** and **Eevee**), the rescue of **Master Merchant Kecleon**, and extra side-story units:

| Paralogue | Unlocks After | PMD: EoS Dungeon Tileset | Mission Hook & Special Recruit Mechanics |
| :---- | :---- | :---- | :---- |
| **Paralogue 1 (The Aptitude Slacker)** | Chapter 3 | **Lush Prairie** (Tall grass & trees) | Wake up and protect a lazy, under-leveled **Slakoth** cornered by feral bandits. **Special Mechanic (Donnel Archetype):** Slakoth starts at Level 1 with awful sleepy base stats (18 HP / 4 Atk / 4 Def / 4 SpA / 4 SpD / 4 Spe, 4 Mov), but its unique passive ability **Hidden Potential** permanently adds **\+20% to all six of its stat growth rates**, turning it into an unstoppable late-game juggernaut as Vigoroth (Lv. 10\) and Slaking (Lv. 20\) if you invest the time to train it. |
| **Paralogue 2 (The Merchant & The Shrine)** | Chapter 6 | **Oran Forest** (Berry woods & ancient shrine) | Imperial poachers have cornered a lone **Eevee** at an elemental forest shrine and captured **Master Merchant Kecleon**'s supply caravan. **Dual Reward (Kecleon Shop Unlock \+ Branching Lv. 15 Evolution):** Clearing the map rescues **Kecleon** (permanently unlocking random **Kecleon Shops** across cleared Overworld nodes) and recruits **Eevee**, a unique 2-stage exception that **evolves only once at Level 15+** using an Evolution Stone into **any of the 8 Eeveelutions** (**Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon, or Sylveon**) with a doubled promotion stat bonus. |
| **Paralogue 3 (The Twin Horns)** | Chapter 8 | **Serenity River** (Lush riverbanks & water) | Rescue and recruit either **Nidoran Male (Nidoran♂ \-\> Nidorino \-\> Nidoking)** or **Nidoran Female (Nidoran♀ \-\> Nidorina \-\> Nidoqueen)** depending on which one your Lord talks to during the battle; rewards an **Evolution Stone**. |
| **Paralogue 4 (The Cave Pass)** | Chapter 11 | **Labyrinth Cave** (Winding rock maze) | Help a lone **Teddiursa** (Teddiursa \-\> Ursaring \-\> Ursaluna) fight off **Lairon** raiders blocking the cave pass; rewards an **Evolution Stone**. |
| **Paralogue 5 (The Peak Wind)** | Chapter 15 | **Mt. Travail** (Steep rocky peaks) | Climb the mountain peaks to calm and recruit **Hoppip** (Hoppip \-\> Skiploom \-\> Jumpluff) and earn a rare Held Item. |
| **Paralogue 6 (The Defecting Phantom)** | Chapter 18 | **Concealed Ruins** (Locked rooms & stairs) | A disillusioned **Gastly** in the enemy ranks wants to leave the Ironscale army and switch sides. Moving your Dragon Lord to talk to Gastly mid-battle causes it to defect and join your team (and rewards an **Evolution Gem**). **This Gastly is the ONLY Pokémon in the entire game that is part of the enemy's Pokémon pool and can also join your team.** |

## **1.5 Enemy Hierarchy, Recurring Commanders & Infantry Roster**

### **1.5.1 The Imperial High Command & Traitor Bosses**

The Ironscale Kingdom's military (alongside its Cragforge traitor allies) is led by a recurring cast of commanders whose evolutionary lines also supply the core infantry of the enemy army:

* **Emperor Kingambit (Supreme Ruler & Chapter 25 Final Boss):** Overarching antagonist of the campaign and Final Boss at the Throne Pinnacle in Chapter 25\. A towering Steel/Dark warlord who seeks to conquer the five kingdoms and extinguish the Dragon Lineage. Wields Supreme Overlord (boosting his stats for each defeated royal guard squad until your Dragon Lord breaks his barrier) with 1-range Kowtow Cleave and 2-range Flash Cannon / Dark Pulse.  
* **Royal Protector Aegislash (Kingambit's Right-Hand Man & Main Protector):** The Emperor's unyielding bodyguard and second-in-command. Appears as an intimidating mid-game boss in Chapter 12 (Crystal Cave) and Chapter 16 (Sealed Ruin) before serving as the penultimate boss in Chapter 24 (Temporal Spire) and guarding Kingambit's throne room. Uses Stance Change to shift to Shield Forme (+4 Def/SpD) on Player Phase and Blade Forme (+4 Atk/SpA) when attacking.  
* **Royal Tactician Gengar (Shadow Mastermind & Chapter 23 Boss):** Leader of the shadow cabal who orchestrated the massacre of the Dragon Clan decades ago, runs the forbidden "Feral" berserker experiments, and manipulates Emperor Kingambit into unsealing the abyssal rift before falling at Dark Crater in Chapter 23\.  
* **The Recurring Raider Trio — General Krookodile, Captain Obstagoon & Captain Grimmsnarl (Acts 1–4 Rivals):** A recurring group of rowdy Imperial captains led by General Krookodile who act as persistent rivals throughout the entire game, evolving alongside your squad across the four acts:  
  * **Act 1 (Chapters 0, 1, 4, 5):** Sandile (Ground/Dark), Galarian Zigzagoon (Dark/Normal), and Impidimp (Dark/Fairy) — Lv. 3 to Lv. 9\.  
  * **Act 2 (Chapters 8, 10, 13):** Krokorok, Galarian Linoone, and Morgrem — Lv. 11 to Lv. 17\.  
  * **Act 3 & Act 4 (Chapters 13, 17, 23):** Krookodile, Obstagoon, and Grimmsnarl — Lv. 21 to Lv. 28\.  
  * **Story & Tactical Synergy:** Obstagoon uses Obstruct and Parting Shot to debuff and block lanes, Grimmsnarl sets up Reflect/Light Screen or Spirit Break debuffs, and Krookodile sweeps in with high-Attack Earthquake and Crunch. Proud of his martial honor, Krookodile despises Gengar's Feral experiments and warns your Lord of Gengar's conspiracy after his defeat in Chapter 13\.  
* **Grand Oracle Gothitelle (Gothita \-\> Gothorita \-\> Gothitelle):** The Empire's psychic spymaster and strategist who engineers the false-flag war in Act 2 and commands the northern citadel on Blizzard Island (Ch. 20). Appears as Gothita (Ch. 2), Gothorita (Ch. 9), and Gothitelle (Ch. 15 & Ch. 20).  
* **Sky Marshal Corviknight (Rookidee \-\> Corvisquire \-\> Corviknight):** Commander of the Ironscale Sky Fleet. Leads the mountain ambush at Mt. Horn (Ch. 6), harries your army across Chasm Cave (Ch. 14\) and Brine Cave (Ch. 19), and serves as the Chapter 21 boss at Miracle Sea.  
* **Siege Warden Coalossal (Rolycoly \-\> Carkol \-\> Coalossal):** Commander of the Empire's heavy armor and forge legions. Leads the Mt. Horn blockade (Ch. 6), commands Boss Carkol's garrison in Steam Cave (Ch. 8), oversees the Treeshroud occupation (Ch. 18), and guards the subterranean gatehouse of Aegis Cave (Ch. 22).  
* **Clan Warlord Aggron (Aron \-\> Lairon \-\> Aggron):** The treacherous Cragforge warlord who overthrows and imprisons **High Thane Copperajah**, selling out the Commonwealth to the Ironscale Kingdom at Mt. Horn (Ch. 6\) before being defeated when your coalition returns to liberate the Cragforge mountains in Chapter 17 (Dusk Forest).

### **1.5.2 Standard Enemy Infantry, Dungeon Stairs Reinforcements & Specialist Units (All 17 Non-Dragon Types)**

Unlike the player's roster (which is strictly limited to 3-stage lines for growth balance), enemy units do not need to adhere to the 3-stage evolution rule. Standard 3-stage Ironscale infantry scale from Stage 1 (Act 1: Lv. 1–9) to Stage 2 (Act 2: Lv. 10–19) and Stage 3 (Acts 3–4: Lv. 20–30), supplemented by 1-stage and 2-stage regional specialists to cover all 17 non-Dragon elemental types:

* **Blade Infantry (Mercenary / Hero equivalent):** Pawniard \-\> Bisharp \-\> Kingambit (Elite Guard). Balanced 5-Mov Steel/Dark physical frontline infantry.  
* **Cragforge Heavy Guard (Mountain Armor equivalent):** Aron \-\> Lairon \-\> Aggron. 4-Mov Steel/Rock high-Defense mountain infantry with *Sturdy* loyal to Traitor Warlord Aggron. *(Strictly enemy-only; Aron is not playable).*  
* **Sky Lancers (Pegasus / Wyvern Rider equivalent):** Rookidee \-\> Corvisquire \-\> Corviknight. 6-Mov Flying flankers that ignore Trees, Water, and Mountains; weak to Electric and Fire.  
* **Siege Armor (Armor Knight / General equivalent):** Rolycoly \-\> Carkol \-\> Coalossal. 4-Mov Rock/Fire heavy tanks that lock down choke points and walk across Lava tiles at 1 Mov.  
* **Outrider Raiders (Brigand / Berserker equivalent):** Galarian Zigzagoon \-\> Galarian Linoone \-\> Obstagoon. Fast 6-Mov Dark/Normal shock troops that frequently climb up from Dungeon Stairs tiles.  
* **Hex Tricksters (Thief / Trickster equivalent):** Impidimp \-\> Morgrem \-\> Grimmsnarl. 5-Mov Dark/Fairy disruptors with 1-range physical attacks and 2-range status/stat debuffs.  
* **Dune Breakers (Cavalier / Great Knight equivalent):** Sandile \-\> Krokorok \-\> Krookodile. High-Attack 5–6 Mov Ground/Dark physical sweepers immune to Electric and Psychic.  
* **Shadow Oracles (Mage / Sage equivalent):** Gothita \-\> Gothorita \-\> Gothitelle. 5-Mov Psychic 2-range Special artillery that punish low-Sp. Def physical tanks.  
* **Royal Sentinels (Swordmaster / Baron equivalent):** Honedge \-\> Doublade \-\> Aegislash. High-Defense Steel/Ghost elite guards stationed in ruin, temple, and capital chapters.  
* **Phantom Mages (Dark Flier / Sorcerer equivalent):** Gastly \-\> Haunter \-\> Gengar. 6-Mov Levitate Ghost/Poison ranged units that float across Void, Water, and Lava tiles. *(Strictly enemy-only, except for the single Gastly that switches sides in Paralogue 6).*  
* **Volt Gunners (Archer / Sniper equivalent):** Elekid \-\> Electabuzz \-\> Electivire. Electric 2-range anti-flier specialists deployed behind enemy lines to cover Rookidee/Corviknight squads.  
* **Nightwing Raiders (Wyvern / Assassin equivalent):** Zubat \-\> Golbat \-\> Crobat. Fast 6-Mov Poison/Flying flankers used in cave and night chapters.  
* **Abyssal Dragoons (Pirate / Naval equivalent):** Tynamo \-\> Eelektrik \-\> Eelektross. Levitate Electric units used on river, swamp, and naval maps.  
* **Glacial Marines (Amphibious Tank equivalent):** Spheal \-\> Sealeo \-\> Walrein. Bulky 4–5 Mov Ice/Water frontline units deployed on coastal, river, frozen lake, and blizzard maps (Ch. 5, 13, 19, 20, 21). *(Strictly enemy-only).*  
* **Venom Outriders (Poison Cavalry equivalent):** Venipede \-\> Whirlipede \-\> Scolipede. Fast 6-Mov Bug/Poison flankers that pressure Grass and Fairy healers.  
* **Siege Brawlers (Fighter / Warrior equivalent):** Timburr \-\> Gurdurr \-\> Conkeldurr. High-HP, high-Attack Fighting wall-breakers with *Guts* deployed to smash player Rock, Steel, and Ice tanks. *(Strictly enemy-only).*  
* **Briar Ambushers (Forest Guerilla equivalent):** Seedot \-\> Nuzleaf \-\> Shiftry. Agile Grass/Dark woodland ambushers in forest chapters (Apple Woods, Foggy Forest, Dusk Forest, Treeshroud Forest). *(Strictly enemy-only).*  
* **Regional 1-Stage & 2-Stage Specialists:** **Skarmory** (1-stage Steel/Flying high-Defense mountain air-tanks), **Croagunk \-\> Toxicroak** (2-stage Poison/Fighting desert and swamp saboteurs), **Stufful \-\> Bewear** (2-stage Normal/Fighting "Feral" shock berserkers), and **Spiritomb** (1-stage Ghost/Dark abyssal temple guardians).

## **1.6 Cutscenes, Dialogue & PMD Character Portraits**

All story cutscenes, chapter introductions, boss battle pre-combat banters, and mid-battle recruitment conversations (when using the "Talk" command on the grid) use authentic **Pokémon Mystery Dungeon character portraits**.

* **Asset Source:** Character portraits (including full facial expression sheets such as Normal, Happy, Determined, Angry, Pain, Worried, Surprised, and Sad) are pulled directly from the same online Git repository (PMD Collab / SpriteCollab repo) that provides the Pokémon map sprites and animations.  
* **Presentation Style:** Dialogue boxes render at the bottom of the screen with the speaking Pokémon's emotion portrait framed on the left or right (matching the classic *Pokémon Mystery Dungeon: Explorers of Sky* dialogue layout), dynamically swapping portrait expressions to match the tone of each line and updating automatically as your Lord, Partner, and recruits evolve into Stage 2 and Stage 3\.

# **PART 2: CORE GAME & BATTLE MECHANICS**

## **2.1 Manually Customized Base Stats, Growth Rates & Leveling Curve**

Rather than using an automated mathematical formula to convert PokéAPI base stats into Fire Emblem numbers, **every Pokémon's Base Stats, Join Level, Movement (Mov), and Percentage Growth Rates (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`) are manually customized and tuned** through playtesting.

* **Manual Stat & Growth Configuration:**  
  * Each playable and enemy Pokémon stage is defined in a central, human-editable data table/JSON file with explicit values for its starting/base stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `Mov`), its join level, and its six percentage growth rates (`0%–100%`).  
  * This allows complete creative control over unit archetypes (e.g., making a specific Pokémon a high-HP/low-Defense sponge, a glass-cannon speedster, or a balanced all-rounder without being locked to mainline Pokémon stat quirks).  
* **Continuous Leveling & Hard Cap (Level 40):**  
  * Units use a continuous level counter from **Level 1 up to a hard cap of Level 40** (evolving does not reset a unit's displayed level to 1).  
* **Expected Campaign Level Pacing:**  
  * **Act 1 (Prologue – Chapter 6):** Levels 1 to 10  
  * **Act 2 (Chapters 7 – 13):** Levels 10 to 17 (Stage 2 evolutions unlock at Level 10 via **Evolution Stones**)  
  * **Act 3 (Chapters 14 – 20):** Levels 17 to 24 (Stage 3 evolutions unlock at Level 20 via **Evolution Gems**)  
  * **Act 4 (Chapters 21 – 25):** Levels 24 to \~30 (Most core units finish the final chapter around **Level 30**, leaving Levels 31–40 as headroom so units almost never hit the hard cap during normal play)  
* **EXP Gain & Level-Up Rolls:**  
  * Every **100 EXP** triggers a level-up and rolls `1–100` against each stat's manually assigned growth rate to determine whether that stat increases by `+1`.  
  * **Damage EXP (Per Combat Round):** `clamp(15 + (Enemy_Lv - Unit_Lv) * 3, 1, 30)`  
  * **Defeat Bonus EXP (Added on KO):** `clamp(35 + (Enemy_Lv - Unit_Lv) * 6, 5, 70)` (50 total EXP for an equal-level KO, scaling down if over-leveled or scaling up to help under-leveled recruits catch up).  
  * **Support / Heal Move EXP:** `clamp(20 - max(0, Unit_Lv - Chapter_Lv) * 3, 5, 20)`

## **2.2 Static Movement (Mov) & PMD: Explorers of Sky Dungeon Terrain**

Each Pokémon stage has a manually assigned **Movement (`Mov`)** stat (typically between **4 and 7 tiles**) that **does not** increase on random level-ups (it only changes if the Pokémon evolves into a stage with a different assigned `Mov`, or via a specific Personal Skill/Held Item).

* **Typical Movement Tiers:**  
  * **4 Mov:** Heavy / Armored tanks and slow bruisers (e.g., Aron, Beldum, Geodude, Rolycoly, Slakoth)  
  * **5 Mov:** Standard balanced infantry and casters (e.g., most Stage-1 and Stage-2 starters, Machop, Poliwag, Duskull)  
  * **6 Mov:** Swift flankers, flyers, and promoted sweepers (e.g., Pidgey, Starly, Gastly, Abra, Obstagoon)  
  * **7 Mov:** Hyper-speed glass cannons and fully promoted speedsters (e.g., Dragapult, Jolteon, Crobat)

**Terrain Traversal Classes:**

10. **Grounded:** Standard movement costs and terrain Defense/Avoid bonuses. (Water-types cross Water tiles at 1 Mov; Fire-types cross Lava tiles at 1 Mov without taking burn damage; Rock/Ground/Fighting-types cross Mountains at 2 Mov instead of 3).  
11. **Flying (Flying-Types):** Works like flyers in Fire Emblem. Pays 1 Mov across Trees, Water, Lava, and Mountains, gets 0 terrain Defense/Avoid bonuses, and cannot cross **Void / Chasm** tiles or thick **Dungeon Walls**.  
12. **Levitate (Units with the Levitate Personal Skill):** True omni-traversal. Bypasses almost all tiles at 1 Mov cost—including **Void / Chasm** tiles, **Lava**, **Water**, and low **Barriers** that block other units. Gets 0 terrain bonuses except on Wonder Tiles and Stairs.

| PMD: EoS Tile Type | Grounded Mov | Flying Mov | Levitate Mov | Tile Effect & Bonuses (Grounded Only unless noted) |
| :---- | :---- | :---- | :---- | :---- |
| **Dungeon Floor** | 1 | 1 | 1 | \+0 Def/SpD, 0% Avoid |
| **Trees / Foliage** | 2 | 1 | 1 | \+1 Def/SpD, \+15% Avoid |
| **Dungeon Stairs** | 1 | 1 | 1 | \+1 Def/SpD, \+10% Avoid (All units); Spawns enemy reinforcements unless blocked by a player unit |
| **Water / Stream** | Impassable (1 if Water) | 1 | 1 | \+0 Def/SpD, \+10% Avoid (Water-types only) |
| **Lava / Magma** | Impassable (1 if Fire) | 1 | 1 | \+0 Def/SpD, \+10% Avoid (Fire-types only) |
| **Mountain / Crag** | 3 (2 if Rock/Ground/Fight) | 1 | 1 | \+2 Def/SpD, \+20% Avoid |
| **Void / Chasm** | Impassable | Impassable | 1 | \+0 Def/SpD, 0% Avoid; Only Levitate units can cross |
| **Wonder Tile** | 1 | 1 | 1 | \+2 Def/SpD, \+20% Avoid, Heals 20% HP & clears debuffs each turn (All units) |

## **2.3 Combat Mechanics, Move Stats, Status Effects & Single-Equipped Enemy Phase**

Moves function like **weapons and tomes in Fire Emblem**, with manually balanced tactical stats and a **single-equipped move rule** for Enemy Phase counter-attacks.

* **Move Attributes (Fire Emblem Weapon Stats):**  
  Every move in the game's move database is defined by the following stats:  
  * **Type:** One of the 18 Pokémon elemental types (determines STAB and Type Chart effectiveness).  
  * **Category & Range:**  
    * **Physical Moves (Range 1):** Attack adjacent orthogonal tiles (`1` tile away). Targets `Attack` vs. `Defense` (e.g., *Tackle*, *Scratch*, *Mach Punch*, *Bite*, *Rock Slide*, *Earthquake*).  
    * **Special Moves (Range 2):** Attack tiles at a distance of `2` (`2` tiles away; cannot hit adjacent foes at `1` range unless specified by a rare move effect). Targets `Sp. Atk` vs. `Sp. Def` (e.g., *Water Gun*, *Ember*, *Thunder Shock*, *Confusion*, *Shadow Ball*).  
    * **Healing & Status-Inflicting Support Moves (Range 1 or 1–2):** Direct ally healing moves (e.g., *Heal Pulse*, *Soft-Boiled*, *Wish*) or status-condition moves (e.g., *Thunder Wave*, *Will-O-Wisp*, *Toxic*, *Hypnosis*) used on Player Phase. Cannot be used to counter-attack on Enemy Phase.  
  * **No Dedicated Stat-Boosting or Stat-Lowering Moves:**  
    * Pure stat-changing moves like *Growl*, *Tail Whip*, *Leer*, *Swords Dance*, *Calm Mind*, or *Dragon Dance* **do not exist in the game** to prevent turtling and stat-stacking from breaking the tactical math.  
    * Instead, **stat boosts and stat drops only occur as random-chance secondary effects attached to damaging moves** (for example, *Shadow Ball* or *Psychic* having a `20%` chance to lower the target's `Sp. Def` by `-2` for 2 turns, *Crunch* having a `20%` chance to lower `Defense` by `-2`, or *Metal Claw* / *Flame Charge* having a `20%` chance to boost the user's `Attack` or `Speed` by `+2`).  
  * **Might (Mt):** The flat base power of the move (similar to Weapon Might in *Fire Emblem*, typically scaling from `3–5 Mt` for early moves like *Tackle*/*Water Gun* up to `10–14 Mt` for endgame moves like *Flamethrower*/*Close Combat*).  
  * **Hit (%):** The base accuracy percentage of the move (e.g., `90%`, `100%`, `75%`).  
  * **Crit (%):** Critical hit chance bonus granted by the move (typically `0%–5%`, or `15%–25%` for high-crit moves like *Slash*, *Night Slash*, or *Shadow Claw*).  
  * **PP (Uses per Battle):** How many times the move can be used during a map (acting as weapon durability that refreshes between chapters).  
  * **Secondary Effect (Optional):** Random percentage chance (`10%–30%`) to inflict a Status Condition or apply a temporary stat buff/debuff on hit.  
* **4-Move Battle Loadout & Single-Equipped Move Rule (Enemy Phase):**  
  * **Pre-Battle Loadout (Up to 4 Moves):** During the Pre-Battle (Battle Prep) screen, the player can equip up to **4 moves** onto each Pokémon from that unit's unlocked learnset.  
  * **Player Phase Selection:** On Player Phase, when a unit initiates combat, the player can freely pick **any of the unit's 4 equipped moves** that is in range of the target.  
  * **Single Equipped Move During Enemy Phase:** Just like weapon equipping in *Fire Emblem*, **a Pokémon can only have ONE offensive move equipped at a time during Enemy Phase**:  
    * Whichever offensive move the Pokémon used most recently on Player Phase (or whichever move the player manually sets via the **"Equip"** submenu before ending the unit's turn) is marked with an **\[E\] (Equipped)** badge.  
    * During **Enemy Phase**, the defending Pokémon can **only counter-attack if its single currently equipped \[E\] move matches the range of the enemy's attack**.  
* **Damage, STAB, Type Chart & Critical Hit Multipliers:**  
  * **STAB (Same-Type Attack Bonus):** Grants a **1.25x multiplier** to damage when the move's elemental type matches one of the user's types (`M_STAB = 1.25`, otherwise `1.0`).  
  * **Type Effectiveness Multipliers (`M_Type`):**  
    * **Extremely Effective (Double Weakness):** `1.5x`  
    * **Super Effective (Single Weakness):** `1.25x`  
    * **Neutral:** `1.0x`  
    * **Not Very Effective (Single Resistance):** `0.75x`  
    * **Mostly Ineffective (Double Resistance):** `0.5x`  
    * **Immune:** `0x` (Deals `0` damage)  
  * **Critical Hits (`M_Crit`):** Multiply damage by **2.0x** (`M_Crit = 2.0`, otherwise `1.0`).  
    * **Crit Rate (%):** `clamp(Move Crit + floor(User Speed / 2) + Item/Skill Bonus, 0, 100)`  
  * **Combat Damage Formulas:**  
    * **Effective Attack:** `floor(User Atk * 0.5)` if the user is **Burned** (for Physical moves), or `floor(User SpA * 0.5)` if the user is **Frozen** (for Special moves); otherwise full `User Atk` or `User SpA`.  
    * **Raw Base Damage:** `max(1, (Effective Atk or SpA + Move Mt) - (Target Def or SpD + Terrain Bonus))`  
    * **Final Damage:** `0` if `M_Type == 0`; otherwise `max(1, floor(Raw Base Damage * M_STAB * M_Type * M_Crit))`  
  * **Doubling (Follow-Up Attack):** Triggers if `(User Speed - Target Speed) >= 5`.  
  * **Hit Rate (%):** `clamp(Move Hit + (User Speed - Target Speed) * 2 - Terrain Avoid, 15, 100)`  
* **The 5 Status Conditions:**  
  A unit can only be afflicted with **one non-volatile status condition at a time** (cleared after battle, on a Wonder Tile, or via a Full Heal / Lum Berry):

| Status Condition | Tactical Effect on the Grid | Duration / Cure Rule |
| :---- | :---- | :---- |
| **Paralysis (PAR)** | Each time the unit attempts an attack (on Player Phase or Enemy Phase), there is a **1/3 chance (33.3%)** that it is fully paralyzed and loses that attack. | Persists until cured or battle ends (Electric-types are immune). |
| **Poison (PSN)** | The unit loses **1/8 of its Max HP** at the start of each of its phases (cannot reduce HP below 1 outside combat, or KOs at 0 HP). | Persists until cured or battle ends (Poison and Steel-types are immune). |
| **Burn (BRN)** | The unit loses **1/16 of its Max HP** at the start of each of its phases, and its **Physical damage is halved (0.5x)**. | Persists until cured or battle ends (Fire-types are immune). |
| **Freeze (FRZ)** | Cuts the unit's **Movement (Mov) in half** (`floor(Mov / 2)`) and **halves its Special damage (0.5x)**. | Automatically thaws after **2 to 5 turns** (or immediately if hit by a Fire-type move; Ice-types are immune). |
| **Sleep (SLP)** | The unit **cannot act at all** (cannot move, attack, counter-attack, or use items) during its turn. | Lasts **1 to 2 turns**, then the unit wakes up automatically at the start of its phase. |

## **2.4 Evolution & Promotion System (Fire Emblem Class Change Model)**

To mirror the class promotion system of *Fire Emblem*, standard playable Pokémon belong to **3-stage evolution lines** and evolve using two universal promotion items along the continuous Level 1–40 curve (with two special Paralogue exceptions):

* **Stage 1 to Stage 2 (Level 10+):** Once a base-stage Pokémon reaches **Level 10** (or higher), it can use an **Evolution Stone** to evolve into its middle stage. Its level remains at its current number and it continues leveling toward Level 20\.  
* **Stage 2 to Stage 3 (Level 20+):** Once a middle-stage Pokémon reaches **Level 20** (or higher), it can use an **Evolution Gem** to evolve into its final stage, continuing toward \~Level 30 (hard cap Level 40).  
* **How Evolution Items Are Used:** Players can use an Evolution Stone or Evolution Gem during Battle Prep / on the Overworld, or equip it in a Pokémon's active Consumable slot and trigger the evolution mid-battle as that unit's turn action (just like a Master Seal in *Fire Emblem*).  
* **What Happens on Evolution (Manually Configured Promotion Bonuses):**  
  * **Immediate Stat Promotion Bonus:** The Pokémon immediately gains the **manually configured promotion stat bonuses** defined for its new evolution stage (`+HP`, `+Atk`, `+Def`, `+SpA`, `+SpD`, `+Spe`).  
  * **Growth Rate & Personal Skill Upgrade:** The Pokémon's percentage growth rates and Personal Skill update to the manually configured values of the new evolution stage.  
  * **Movement & Traversal Update:** The unit's Movement (`Mov`) updates to the new stage's configured `Mov`, and its Terrain Traversal Class updates if it gains the Flying type or Levitate Personal Skill.  
  * **Sprite & Portrait Upgrade:** The unit's map sprite, animations, and dialogue emotion portraits swap to the new stage's PMD assets.  
* **Special Paralogue Unit Rules (Eevee & Slakoth):**  
  * **Eevee (Single Branching Evolution at Level 15+):** Recruited in Paralogue 2, Eevee is the sole 2-stage exception in the roster. Eevee evolves **only once at Level 15+** when given an **Evolution Stone**, opening a branching selection modal allowing the player to choose **any of the 8 Eeveelutions** (**Vaporeon**, **Jolteon**, **Flareon**, **Espeon**, **Umbreon**, **Leafeon**, **Glaceon**, or **Sylveon**) with custom promotion bonuses and growth rates tuned for a single-promotion unit.  
  * **Slakoth ("Aptitude" Growth Unit):** Recruited in Paralogue 1 at Level 1, Slakoth functions like Donnel in *Fire Emblem Awakening*. It starts with very low manually tuned base stats, but its Personal Skill **Hidden Potential** permanently adds a flat **\+20% to all six of its stat growth rates** across all three of its evolution stages (Slakoth \-\> Vigoroth at Lv. 10 \-\> Slaking at Lv. 20).

## **2.5 Move Learning Progression & Single-Use General TMs**

Pokémon build their move pools through a combination of **unique, irregular level-up learnsets** and **consumable, general-purpose TMs**:

* **Bespoke Level-Up Learnsets (Non-Uniform Pacing):**  
  * Pokémon **do not** learn a new move every single level or on a rigid universal schedule.  
  * Instead, each Pokémon has a manually curated level-up learnset table where it learns specific moves at varied, character-defining levels (for example, one Pokémon might learn moves at Levels `1, 4, 9, 13, 18, 23, 28`, while another learns moves at Levels `1, 3, 7, 10, 16, 20, 26`).  
  * This makes every character's leveling journey and power spikes feel distinct—some units unlock their signature high-Might or status-inflicting move early, while others unlock a game-changing move right after promoting.  
* **Unlocked Move Pool vs. 4-Move Active Loadout:**  
  * Whenever a Pokémon learns a new move (via level-up or TM), that move is permanently added to that unit's **Unlocked Move Pool**.  
  * If a Pokémon learns a 5th+ move mid-battle, the player can either swap it into one of the unit's 4 active slots immediately or send it to the unit's Unlocked Move Pool.  
  * During the **Pre-Battle (Battle Prep) Screen**, the player can freely swap any **4 moves** in and out of the unit's active loadout from its full Unlocked Move Pool at no cost.  
* **Technical Machines (TMs) — Single-Use & General Purpose:**  
  * **Consumable One-Time Use:** TMs are single-use items found in dungeon chests, dropped by commanders, or purchased in Overworld shops. **Once a TM is used to teach a move to a Pokémon, the TM is consumed and disappears from your inventory** (working like classic Pokémon TMs and *Fire Emblem* skill scrolls).  
  * **General-Purpose Move Pool:** While level-up learnsets focus on a Pokémon's unique signature moves, TMs provide **broader, general-purpose offensive and utility moves** (e.g., *Protect*, *Swift*, *Return*, *Dig*, *Aerial Ace*, *Brick Break*, *Flamethrower*, *Ice Beam*, *Thunderbolt*, *Shadow Ball*, *Reflect*, *Light Screen*, *Toxic*, *Rest*).  
  * **Compatibility:** Each TM specifies which Pokémon (by Type or explicit compatibility list) can learn it, letting players spend scarce TMs to patch a favorite unit's range or elemental coverage (such as giving a pure 1-range physical brawler a 2-range Special TM so it can fight at range when needed).

## **2.6 Personal Skills (Translated from Pokémon Abilities)**

Every Pokémon has a **Personal Skill** derived from its ability in the mainline Pokémon series (functioning like Personal Skills in *Fire Emblem Fates*, *Three Houses*, or *Engage*).

* **Manually Designed & Balanced:**  
  * Rather than importing raw mainline Pokémon mechanics, **every Personal Skill's exact tactical effect on the grid is manually decided and balanced by the developer**.  
  * Each Pokémon has 1 innate Personal Skill (which can either stay the same across its 3 stages or upgrade when it evolves at Levels 10 and 20, depending on manual configuration).  
* **Representative Examples (Subject to Manual Balancing):**  
  * **Hidden Potential (Slakoth Line):** Permanently increases all six stat growth rates by `+20%`.  
  * **Levitate (Gastly / Duskull / Vibrava / Hydreigon, etc.):** Grants the **Levitate** terrain traversal class, allowing the unit to cross Void, Lava, Water, and Barrier tiles at `1 Mov` cost.  
  * **Overgrow / Blaze / Torrent (Starter Lines):** Grants `+3 Damage` with Grass / Fire / Water moves when the unit's current HP is at or below `50%`.  
  * **Intimidate (Shinx / Starly / Krookodile Lines):** At the start of Player Phase (or when moving adjacent), inflicts `-2 Attack` for 1 turn on enemies within `2 tiles`.  
  * **Guts (Machop / Timburr / Obstagoon Lines):** Grants `+3 Attack` when afflicted with a status condition (Burn, Poison, Paralysis) and ignores Burn's Attack reduction.  
  * **Sturdy (Geodude / Roggenrola / Aron Lines):** Once per battle, if the unit is at `100% HP` and would be KO'd by an attack, it survives with `1 HP`.  
  * **Stance Change (Aegislash Line):** Grants `+4 Def / +4 Sp. Def` when defending on Enemy Phase (Shield Forme) and `+4 Atk / +4 Sp. Atk` when initiating combat on Player Phase (Blade Forme).

## **2.7 Items System: X-Items, Permanent Stat Boosters & Held Items Catalog**

Every Pokémon has **2 Item Slots** during battle: **1 Consumable / Utility Slot** (activated as a turn action on Player Phase) and **1 Held Item Slot** (providing passive in-battle effects).

### **2.7.1 X-Items (Single-Battle Stat Boosters)**

Purchased from **Kecleon X-Item Shops** or found in dungeon chests, **X-Items** are single-use consumables placed in a unit's Consumable Slot. Using an X-Item consumes the unit's action for that turn and grants a **one-time stat boost that lasts for the entire remainder of the current battle**, reverting to normal once the chapter ends (cannot stack the same X-Item twice on the same unit in one battle):

* **X Attack:** Grants `+3 Attack` for the rest of the battle.  
* **X Defense:** Grants `+3 Defense` for the rest of the battle.  
* **X Sp. Atk:** Grants `+3 Sp. Atk` for the rest of the battle.  
* **X Sp. Def:** Grants `+3 Sp. Def` for the rest of the battle.  
* **X Speed:** Grants `+3 Speed` (and `+6% Avoid`) for the rest of the battle.  
* **Dire Hit:** Grants `+20% Critical Hit Rate` for the rest of the battle.

### **2.7.2 Permanent Stat-Boosting Items (Vitamins — Very Rare)**

Working just like stat-boosting items in *Fire Emblem* (Energy Drop, Spirit Dust, Speedwing, Dracoshield, Angelic Robe), **Vitamins** are **very rare, single-use items** obtained only from major boss drops, hidden dungeon chests, or Paralogue rewards. Using one permanently increases a Pokémon's base stat:

* **HP Up:** Permanently increases a Pokémon's **Max HP by \+3**.  
* **Protein:** Permanently increases a Pokémon's **Attack by \+2**.  
* **Iron:** Permanently increases a Pokémon's **Defense by \+2**.  
* **Calcium:** Permanently increases a Pokémon's **Sp. Atk by \+2**.  
* **Zinc:** Permanently increases a Pokémon's **Sp. Def by \+2**.  
* **Carbos:** Permanently increases a Pokémon's **Speed by \+2**.  
* **PP Max / PP Up:** Permanently increases the per-battle **PP (uses) of a chosen move by \+3**.

### **2.7.3 Held Items Catalog (Passive Slot)**

Each Pokémon can equip **1 Held Item** in its passive slot. Reusable gear persists across battles, while consumable **Berries** trigger automatically when their threshold is met during battle:

| Held Item | Category | Special Tactical Effect in Battle |
| :---- | :---- | :---- |
| **Leftovers** | Reusable Gear | Restores **10% Max HP** (`min 2 HP`) at the start of every Player Phase. |
| **Shell Bell** | Reusable Gear | Whenever the holder deals damage in combat, restores HP equal to **25% of the damage dealt**. |
| **Oran Berry** | Consumable Berry | Automatically consumed when HP drops to **50% or below**, immediately restoring **10 HP**. |
| **Sitrus Berry** | Consumable Berry | Automatically consumed when HP drops to **50% or below**, immediately restoring **40% Max HP**. |
| **Lum Berry** | Consumable Berry | Automatically consumed the moment the holder is afflicted with any **Status Condition** (PAR, PSN, BRN, FRZ, SLP), curing it immediately. |
| **Type Enhancers** (*Charcoal, Mystic Water, Miracle Seed, Magnet, Never-Melt Ice, Black Belt, Sharp Beak, Poison Barb, Soft Sand, Hard Stone, Twisted Spoon, Silver Powder, Spell Tag, Dragon Fang, Black Glasses, Metal Coat, Silk Scarf, Pixie Plate*) | Reusable Gear | Increases the damage of moves matching that item's elemental type by **\+2 flat damage** (or `1.15x`). |
| **Muscle Band** | Reusable Gear | Increases the damage of all **Physical (1-range) moves** by **\+2**. |
| **Wise Glasses** | Reusable Gear | Increases the damage of all **Special (2-range) moves** by **\+2**. |
| **Expert Belt** | Reusable Gear | Increases the damage of **Super Effective** and **Extremely Effective** moves by an extra **\+3 damage**. |
| **Life Orb** | Reusable Gear | Increases all damage dealt by **\+4**, but the holder loses **10% Max HP** after each combat in which it attacks. |
| **Choice Band** | Reusable Gear | Increases **Attack by \+4**, but locks the holder into using only the first move it selects for the rest of the map (unless unequipped). |
| **Choice Specs** | Reusable Gear | Increases **Sp. Atk by \+4**, but locks the holder into using only the first move it selects for the rest of the map. |
| **Choice Scarf** | Reusable Gear | Increases **Speed by \+4** and **Movement (Mov) by \+1**, but locks the holder into using only the first move it selects for the rest of the map. |
| **Assault Vest** | Reusable Gear | Increases **Sp. Def by \+4**, but prevents the holder from using non-damaging Support/Healing moves. |
| **Eviolite** | Reusable Gear | Grants **\+3 Defense and \+3 Sp. Def** as long as the holder is not in its final (Stage 3 / Eeveelution) evolution stage. |
| **Rocky Helmet** | Reusable Gear | If an enemy strikes the holder with a **1-range Physical move**, the attacker takes **20% of its Max HP** as recoil damage after combat. |
| **Focus Sash** | Single-Battle Gear | If the holder is at **100% HP** and would be KO'd by an attack, it survives with **1 HP** (triggers once per battle). |
| **Heavy-Duty Boots** | Reusable Gear | Grounded holder ignores movement penalties on **Trees/Foliage** and **Mountain** tiles (pays 1 Mov). |
| **Scope Lens** | Reusable Gear | Increases the holder's **Critical Hit Rate by \+15%**. |
| **Wide Lens** | Reusable Gear | Increases the holder's **Hit Rate (Accuracy) by \+15%**. |
| **Quick Claw** | Reusable Gear | On Enemy Phase, gives a **25% chance** for the holder to strike **before** the initiating enemy attacks (Vantage effect). |

## **2.8 Character Support System (Levels 1–5 & Up to 3 Adjacent Allies)**

Inspired by the Support system in *Fire Emblem Awakening*—but streamlined so it focuses purely on tactical grid positioning without requiring hundreds of separate support cutscene scripts—Pokémon build **Support Levels (1 through 5\)** by fighting side-by-side.

* **How Support Grows in Battle:**  
  * Whenever a player Pokémon engages in combat (initiating an attack on Player Phase, defending/counter-attacking on Enemy Phase, or using a healing/support move) while **orthogonally adjacent (1 tile away)** to one or more allied Pokémon, a small bond/heart visual effect triggers over the adjacent allies and each pair gains **\+1 Support Point**.  
  * Support points and unlocked Support Levels are tracked persistently per Pokémon pair across the entire campaign and can be inspected in the **Supports** menu on the Overworld or Battle Prep screen.  
* **Support Level Thresholds (Levels 1 to 5):**  
  * **Support Level 1:** 5 cumulative adjacent combat interactions  
  * **Support Level 2:** 12 cumulative adjacent combat interactions  
  * **Support Level 3:** 22 cumulative adjacent combat interactions  
  * **Support Level 4:** 35 cumulative adjacent combat interactions  
  * **Support Level 5 (Max):** 50 cumulative adjacent combat interactions  
* **Adjacency Combat Stat Bonuses (Works with Up to 3 Adjacent Pokémon):**  
  * Whenever a Pokémon enters combat, the engine checks all orthogonally adjacent tiles (1 tile N, S, E, W) for allied Pokémon that share a Support Level (`1–5`) with the fighting unit.  
  * A Pokémon can receive support bonuses from **up to 3 adjacent allied Pokémon simultaneously**, and the stat bonuses from all qualifying adjacent allies (up to 3\) **stack additively** during combat:

| Support Level | Atk & Sp. Atk Bonus | Def & Sp. Def Bonus | Hit Rate Bonus | Avoid Bonus | Crit Bonus |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Level 1** | \+1 Atk / \+1 SpA | \+0 Def / \+0 SpD | \+3% Hit | \+3% Avoid | \+2% Crit |
| **Level 2** | \+1 Atk / \+1 SpA | \+1 Def / \+1 SpD | \+5% Hit | \+5% Avoid | \+4% Crit |
| **Level 3** | \+2 Atk / \+2 SpA | \+1 Def / \+1 SpD | \+8% Hit | \+8% Avoid | \+6% Crit |
| **Level 4** | \+2 Atk / \+2 SpA | \+2 Def / \+2 SpD | \+10% Hit | \+10% Avoid | \+8% Crit |
| **Level 5** | \+3 Atk / \+3 SpA | \+3 Def / \+3 SpD | \+15% Hit | \+15% Avoid | \+10% Crit |

  * *3-Ally Cap Rule:* If a unit happens to be surrounded on all 4 orthogonal sides by supported allies, only the **3 highest-level support partners** apply their bonuses.

# **PART 3: LLM AGENT INSTRUCTIONS, UI AESTHETIC, CONTROLS & ARCHITECTURE**

## **3.1 Cross-Platform Requirement (PC & Mobile Parity)**

* **Strict PC \+ Mobile Mandate for the LLM Agent:** Every feature, screen, menu modal, and canvas interaction built for *Mystery Emblem* **must be 100% playable and responsive on both PC (Desktop Mouse) and Mobile (Touchscreen)** browsers.  
* **Agent Verification Checklist on Every Feature Addition:**  
  * **Unified Pointer Events:** Use unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`) or paired Mouse \+ Touch handlers so panning, clicking nodes, selecting tiles, and navigating menus work identically with a mouse cursor or a finger tap.  
  * **Responsive Layout & Touch Targets:** All menus, unit cards, and action buttons must scale cleanly across desktop (`16:9`) and mobile (`portrait` or `landscape`) viewports, with touch-friendly button hitboxes (`minimum 44x44px`) and scrollable lists that support touch-drag.  
  * **Right-Click Parity on Mobile:** Because right-click opens menus and cancels actions on PC, the UI **must always provide a visible PMD-styled "Menu / Back" button in the screen corner (plus long-press support)** so mobile players have effortless one-tap access to every right-click function.

## **3.2 Pokémon Mystery Dungeon Visual & Menu Aesthetic**

* **UI Window Styling:** All menus, dialogue frames, unit stat sheets, shop interfaces, and combat forecast panels must match the classic *Pokémon Mystery Dungeon: Explorers of Sky* aesthetic:  
  * **Window Backgrounds:** Deep translucent navy/charcoal backgrounds (`rgba(16, 24, 40, 0.92)`).  
  * **Borders & Frames:** Classic PMD double-layered pixel-art window borders (outer cyan/blue trim with inner gold/white corner accents).  
  * **Typography:** Crisp pixel/bitmap RPG font (e.g., *Press Start 2P*, *VT323*, or *PMD Wonder Mail* font) with drop shadows for high legibility on both PC monitors and phone screens.  
  * **Portraits & Sprites:** Pull all character emotion portraits and directional 8-way map sprites directly from the existing site's PMD Git repository endpoints.

## **3.3 Strictly Point-and-Click / Touch Controls (Zero Keyboard Controls)**

* **No Keyboard Controls:** The agent must **not** bind or require any keyboard keys (`WASD`, arrow keys, `Space`, `Enter`, `Esc`). Every interaction in the game is 100% point-and-click (PC) and tap/drag (Mobile):  
  * **Map Panning (Overworld & Battle Grid):** Click-and-drag (PC) or single-finger touch-drag (Mobile) pans the camera smoothly across the Overworld map or the tactical battlefield grid.  
  * **Overworld Node Movement:** Clicking/tapping any unlocked node on the Overworld map moves the player's Lord sprite along the path to that node. Clicking/tapping the active node opens the prompt to start the Chapter, fight the Skirmish, or enter the Kecleon Shop.  
  * **Right-Click (PC) / Menu Button or Long-Press (Mobile):**  
    * When viewing the **Overworld Map** or an **empty state on the Battle Grid**, right-clicking (or tapping the on-screen **Menu** button) opens the main system menu.  
    * When inside any **submenu, unit movement preview, or target selector**, right-clicking (or tapping the **Back / Cancel** button) steps back one menu level or cancels the unit's uncommitted movement.

## **3.4 Fire Emblem Awakening-Style Menu Systems & Guidelines**

The agent must structure the game's menu flows after *Fire Emblem Awakening*, styled with the *Pokémon Mystery Dungeon* visual skin:

13. **Overworld Right-Click Menu:**  
    * **Units / Roster:** Inspect all recruited Pokémon, view their stats/growths/Personal Skills, **rename any Pokémon's nickname at any time**, or use permanent stat boosters (Vitamins) and Evolution Stones/Gems.  
    * **Items / Convoy:** Manage the global inventory of Held Items, Consumables, X-Items, and single-use TMs, and swap items onto or off of any Pokémon.  
    * **Supports:** View a relationship matrix showing the current Support Level (`1–5`) and progress bar between any pair of Pokémon in your roster.  
    * **Save / System:** Save current campaign progress, sign in or out with a **Google Account** ("Sign in with Google" via Firebase Authentication, also accessible from the Title Screen) to automatically sync save data across desktop and mobile devices via Cloud Firestore, export/import a manual JSON backup file, or return to the Title / New Game Plus screen.  
14. **Pre-Battle (Battle Prep) Menu:**  
    * **Select Units:** Grid of all owned Pokémon; click/tap to toggle deployment up to the chapter's deployment cap (with the Dragon Lord locked in as mandatory).  
    * **View Map & Swap Positions:** Pan around the dungeon map to inspect enemies, terrain, and Stairs tiles; click/tap two blue deployment tiles to swap the starting positions of deployed Pokémon.  
    * **Check / Equip Loadout:** Select any Pokémon to equip up to **4 Moves** from its Unlocked Move Pool, designate its single **\[E\] Equipped Move** for Enemy Phase, equip **1 Held Item** and **1 Consumable**, teach a **TM**, or **edit its Nickname**.  
    * **Fight\! (Start Battle):** Begins Turn 1 of Player Phase.  
15. **In-Battle Tactical Menus:**  
    * **Unit Selection & Action Menu:** Clicking/tapping an unmoved player Pokémon highlights its valid movement tiles (Blue) and attack range (Red). Clicking a destination tile moves the unit there and opens the floating *Fire Emblem* command menu beside the unit:  
      * **Attack:** Opens the 4-move selector (filtering to moves whose range can hit an enemy from that tile), then displays the **Combat Forecast Panel** (showing HP, Damage, Hit %, Crit %, Doubling `x2`, active Support bonuses from up to 3 adjacent allies, and whether the enemy can counter-attack). Clicking **Confirm** executes combat.  
      * **Heal / Status:** Appears if the unit has a Range 1–2 healing or status move and a valid target is in range.  
      * **Talk:** Appears in gold when adjacent to a recruitable character (such as Nidoran in Paralogue 3 or the defecting Gastly in Paralogue 6).  
      * **Item / Equip:** Change which of the unit's 4 moves is marked **\[E\] Equipped** for Enemy Phase, or use the unit's active Consumable (Potion, X-Item, Evolution Stone/Gem).  
      * **Wait:** Ends the unit's action for the turn and renders its sprite in a rested/dimmed state.  
    * **Battlefield Right-Click Menu (When No Unit Is Selected):**  
      * **Danger Area (Toggle):** Highlights the combined attack range of all enemies on the map in red/purple (matching *Fire Emblem Awakening*), or click individual enemies to toggle their personal threat range.  
      * **Unit List:** Tabular overview of all deployed units, their current HP, status conditions, equipped move, and adjacent support partners.  
      * **Objective / Chapter Info:** Displays the victory condition (Rout Enemy, Defeat Boss, or Defend for X Turns), turn count, and Lord defeat condition.  
      * **End Turn:** Immediately ends Player Phase and starts Enemy Phase.

## **3.5 Custom LLM Agent System Instructions (Read Before Every Session)**

The following system instructions must be read and strictly obeyed by the coding LLM agent on every prompt, file edit, and feature implementation:

* **1\. Role & Core Mandate:** You are the Lead Game Engineer building *Mystery Emblem*, a browser-based tactical RPG combining *Fire Emblem Awakening* gameplay systems with *Pokémon Mystery Dungeon: Explorers of Sky* visuals, dungeon tilesets, sprites, and character portraits.  
* **2\. Rule 1 — 100% Data-Driven Manual Balance (Zero Automated Stat Formulas):** Never use automated formulas to calculate stats or growth rates from PokéAPI base stats. Every Pokémon's Base Stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`), `Mov`, Join Level, 6 Percentage Growth Rates, Promotion Bonuses, Learnset levels, and Personal Skill must be read from human-editable JSON/TypeScript data files so the developer can manually tune every unit.  
* **3\. Rule 2 — Strict PC & Mobile Parity (Unified Pointer Events Only):** Every screen, canvas interaction, and menu modal must work cleanly on both Desktop (Mouse) and Mobile (Touchscreen) browsers. Never bind or require keyboard keys (`WASD`, arrow keys, `Space`, `Enter`, `Esc`). Use unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`) for clicking/tapping and click-and-drag/touch-drag camera panning. Always render an on-screen PMD-styled **Menu / Back** button (and support long-press) on mobile to mirror PC right-click behavior.  
* **4\. Rule 3 — Authentic PMD Visual Skin & Asset Pipeline:** All UI windows, menus, combat forecasts, and dialogue boxes must use the *Pokémon Mystery Dungeon: Explorers of Sky* aesthetic (deep navy translucent backgrounds, double-layered pixel borders, and bitmap RPG typography). Pull all 8-directional unit animations and multi-emotion character portraits directly from the existing site's PMD Git repository endpoints.  
* **5\. Rule 4 — Single-Equipped Enemy Phase & Clean Tactical Math:** Enforce the 4-move battle loadout where Physical moves are Range 1, Special moves are Range 2, and **only one offensive move is marked `[E] Equipped` at a time during Enemy Phase** (meaning a unit can only counter-attack on Enemy Phase if its single equipped move matches the attacker's range). Exclude all pure stat-changing moves (like *Growl* or *Swords Dance*); stat buffs and debuffs may only occur as random-chance secondary effects on damaging moves, or via X-Items, Personal Skills, and Held Items.  
* **6\. Rule 5 — Strict Faction Separation & 3-Stage Promotion Curve:** Never allow enemy Pokémon lines to appear in the player's recruitable pool, with the **sole exception of the single defecting Gastly in Paralogue 6**. Enforce the continuous Level 1–40 curve (targeting \~Level 30 by Chapter 25\) with **Evolution Stones** at Level 10+ and **Evolution Gems** at Level 20+ (plus the Paralogue exceptions for Level 15 branching Eevee and Hidden Potential \+20% growth Slakoth).  
* **7\. Rule 6 — Incremental Step-by-Step Execution & Verification Gates:** Implement the game one step at a time following the roadmap in Section 3.6. Do **not** skip ahead to the next step until every item in the current step's **Verification Checklist** has been tested and confirmed working on both Desktop and Mobile viewports.  
* **8\. Rule 7 — Cross-Device Save Sync via Google Sign-In (Firebase Auth \+ Firestore) & localStorage:** Because the game is hosted as a static site on GitHub Pages, implement a hybrid `SaveStateManager` that writes immediately to `localStorage` (with a `lastUpdated` UTC timestamp) for instant offline-capable saving, and automatically syncs the save JSON to **Cloud Firestore** (`saves/{uid}`) whenever the player is signed in with their **Google Account** via **Firebase Authentication**. On startup or sign-in, compare `lastUpdated` timestamps between `localStorage` and Firestore so switching between desktop and mobile always loads the most recent campaign state.

---

## **3.6 Step-by-Step Implementation Roadmap & Verification Gates**

The LLM agent must implement *Mystery Emblem* in the following 10 sequential steps, running all verification checks at the end of each step before proceeding:

### **Step 1: Core Data Schemas, Manual Balance Registries & Save State Manager**

* **What to Implement:**  
  * Create human-editable JSON/TypeScript registries for:  
    * `pokemon_species.json`: Species ID, stage (1, 2, or 3), elemental types, manual base stats (`HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `Mov`), manual growth rates (`0%–100%`), terrain traversal class (`Grounded`, `Flying`, `Levitate`), Personal Skill ID, bespoke level-up learnset table, compatible TM list, evolution target/level/item, manual promotion stat bonuses, and PMD sprite/portrait asset IDs.  
    * `moves.json`: Move ID, name, elemental type, category (`Physical` \= Range 1, `Special` \= Range 2, `Support/Heal` \= Range 1 or 1–2), `Mt`, `Hit`, `Crit`, `PP`, and optional random-chance secondary effect (status condition or temporary stat buff/debuff). Confirm zero pure stat-boosting/lowering moves exist.  
    * `items.json`: Definitions for Passive Held Items (Leftovers, Shell Bell, Berries, Type Enhancers, Choice items, Eviolite, Rocky Helmet, Heavy-Duty Boots, etc.), Active Consumables (Potions, Full Heals, Evolution Stones, Evolution Gems), X-Items, Permanent Stat Vitamins, and single-use general TMs.  
  * Build the persistent `SaveStateManager` (`localStorage` \+ **Google Account Sign-In via Firebase Authentication & Cloud Firestore** \+ JSON export/import) tracking owned Pokémon instances (including persistent custom nickname, level, exp, current stats, unlockedMoves, 4-move loadout, equippedMoveId, heldItemId, consumableItemId), Convoy inventory, Support Points matrix (pairKey \-\> points & level 1–5), Overworld node states, `newGamePlusUnlocked` flag, and a `lastUpdated` timestamp:  
    * **Local & Cloud Hybrid Sync:** Every save action writes immediately to `localStorage` and, if the user is authenticated via Google Sign-In, writes the save state payload to `saves/{uid}` in Cloud Firestore (protected by Firestore security rules restricting read/write to `request.auth.uid == uid`).  
    * **Cross-Device Timestamp Resolution:** When loading the game on a second device (e.g., switching from PC to mobile) or signing in with Google for the first time on a device, compare the `lastUpdated` timestamp in Firestore against `localStorage` and load the newer state (syncing local guest progress up to Firestore if the local save is newer).  
* **Step 1 Verification Checklist:**  
  * \[ \] Confirm all 8 Dragon Lords, starter Partners, Q1–Q9 quiz recruits, Paralogue recruits (Slakoth, Eevee, Nidoran♂/♀, Teddiursa, Hoppip, and Paralogue 6 Gastly), and enemy lines validate against the schema with zero unintended player/enemy overlap.  
  * \[ \] Confirm saving, loading, and renaming a Pokémon's nickname persists cleanly across page reloads in `localStorage` and syncs accurately to Cloud Firestore when signed in with a Google Account across desktop and mobile sessions.

### **Step 2: PMD Asset Loader, UI Window Framework & Portrait Dialogue Engine**

* **What to Implement:**  
  * Connect the existing site's PMD Git repository endpoints to load 8-directional map sprite animations (`Idle`, `Walk`, `Attack`, `Special`, `Hurt`) and multi-emotion character portraits (`Normal`, `Happy`, `Determined`, `Angry`, `Pain`, `Worried`, `Surprised`, `Sad`).  
  * Build the reusable PMD UI Window component (translucent navy background, double-layered cyan/gold pixel borders, bitmap font) and the persistent mobile **Menu / Back** corner button.  
  * Build the `DIALOGUE_OVERLAY` engine that displays character portraits on the left/right, shows the speaking Pokémon's custom nickname and species name, swaps facial expressions per line, and advances on click/tap.  
* **Step 2 Verification Checklist:**  
  * \[ \] Confirm PMD sprites and emotion portraits render sharply with `image-rendering: pixelated` and automatically update when a unit's evolution stage changes.  
  * \[ \] Confirm dialogue boxes and UI windows scale without clipping on both `1920x1080` desktop and `390x844` / `844x390` mobile viewports using only click/tap inputs.

### **Step 3: Starting Personality Quiz, Partner Select, Nickname Modal & New Game Plus Selector**

* **What to Implement:**  
  * Build `QUIZ_SCENE` with the 9 multiple-choice questions that simultaneously tally trait points for the 8 Stage-1 Dragon Lords and seed the Q1–Q9 chapter recruitment slots (Prologue Healer, Ch. 1 Bug/Flying duo, Ch. 2 Ghost/Psychic duo, Ch. 4 Electric solo, Ch. 5 Fighting/Rock/Ground trio, Ch. 7 Water/Grass duo, Ch. 8 Fire solo, Ch. 10 Steel/Fairy duo, Ch. 12 Ice/Armored duo).  
  * Build the Partner Starter selection screen (allowing selection of any Stage-1 Starter Pokémon).  
  * Build the reusable **Nickname Modal** that prompts the player to name each newly recruited Pokémon (and can be reopened anytime from the Units menu).  
  * Build `NG_PLUS_SELECT_SCENE` (available when `newGamePlusUnlocked` is true), replacing the quiz with a manual selection screen for the Dragon Lord, Partner, Q1 Healer, and all Q2–Q9 chapter recruit slots.  
* **Step 3 Verification Checklist:**  
  * \[ \] Confirm completing the quiz initializes the Prologue squad (Dragon Lord, Partner, and Q1 Healer Friend), prompts for nicknames on all three, and stores the exact Q2–Q9 recruit seeds in the save state.  
  * \[ \] Confirm toggling `newGamePlusUnlocked` enables the New Game Plus manual roster picker and correctly populates all chosen recruits.

### **Step 4: Fire Emblem Awakening Overworld Map, Kecleon Shops & Skirmish Spawner**

* **What to Implement:**  
  * Build `OVERWORLD_SCENE` rendering the node-based continent map across the five kingdoms.  
  * Implement click-and-drag (PC) and single-finger touch-drag (Mobile) camera panning, plus click/tap node traversal that moves the Lord sprite along connected paths.  
  * Implement the occasional **Feral Skirmish Spawner** (low random chance to spawn on a cleared node after finishing a chapter; clears immediately after victory so players cannot infinitely grind).  
  * Implement the random **Kecleon Shop Spawner** (spawning a Kecleon sprite on cleared nodes that opens 1 of the 4 shop types: TM Shop, Held Item Shop, Healing/Evolution Item Shop, or X-Item Shop).  
  * Build the Overworld Right-Click / Mobile Menu modal (`Units / Roster` with anytime nickname editing, Vitamin use, and Evolution Stone/Gem promotion; `Items / Convoy`; `Supports` viewer; `Save / System`).  
* **Step 4 Verification Checklist:**  
  * \[ \] Confirm panning the Overworld map, moving between nodes, and opening/closing the right-click/mobile menu work smoothly on both PC mouse and mobile touch.  
  * \[ \] Confirm buying and teaching a TM consumes the TM from inventory and adds the move to the Pokémon's permanent Unlocked Move Pool.  
  * \[ \] Confirm using a Vitamin permanently increases the target stat, and confirm renaming a Pokémon in the Units menu updates its name across all screens.

### **Step 5: PMD Dungeon Grid Renderer, Terrain Traversal & Pathfinding Engine**

* **What to Implement:**  
  * Build the tactical battlefield grid renderer using *Pokémon Mystery Dungeon: Explorers of Sky* dungeon tilesets (`Dungeon Floor`, `Trees / Foliage`, `Dungeon Stairs`, `Water`, `Lava`, `Mountain`, `Void / Chasm`, and `Wonder Tile`).  
  * Implement Dijkstra / A\* pathfinding and range highlighting (Blue movement tiles, Red attack tiles, and the toggleable purple/red enemy **Danger Area** overlay) enforcing the 3 Terrain Traversal Classes:  
    * `Grounded` (affected by terrain costs/bonuses; Water-types cross Water at 1 Mov, Fire-types cross Lava at 1 Mov, Rock/Ground/Fighting cross Mountains at 2 Mov, Heavy-Duty Boots ignore Tree/Mountain penalties).  
    * `Flying` (1 Mov across Trees, Water, Lava, Mountains; 0 terrain bonuses; blocked by Void/Chasm and Walls).  
    * `Levitate` (1 Mov across Void/Chasm, Lava, Water, Trees, Mountains, and low Barriers; 0 terrain bonuses except on Wonder Tiles and Stairs).  
* **Step 5 Verification Checklist:**  
  * \[ \] Confirm Grounded, Flying, and Levitate units highlight the exact legal movement tiles across every PMD terrain type (especially verifying that only Levitate units can cross Void/Chasm tiles).  
  * \[ \] Confirm click-and-drag and touch-drag pan the battle camera without accidentally selecting or moving units.

### **Step 6: Pre-Battle Sequence (`PREP_SCENE`) & Loadout Manager**

* **What to Implement:**  
  * Build `PREP_SCENE` loaded before Turn 1 of every battle with the 4 core *Fire Emblem* prep options:  
    * **1\. Select Units:** Toggle units in/out of the squad up to the chapter's deployment cap (`3` in Prologue, `5–8` in Act 1, `8–10` in Act 2, `10–12` in Acts 3–4), keeping the Dragon Lord locked in on story chapters.  
    * **2\. View Map & Swap Positions:** Pan the map to inspect enemies, terrain, and Stairs tiles; click/tap any two blue deployment tiles to swap the starting positions of deployed Pokémon.  
    * **3\. Check / Equip Loadout:** Select up to **4 active moves** from each Pokémon's Unlocked Move Pool, set its single **\[E\] Equipped Move** for Enemy Phase, equip **1 Held Item** and **1 Consumable**, or edit its nickname.  
    * **4\. Fight\!:** Transition into Turn 1 of `BATTLE_SCENE`.  
* **Step 6 Verification Checklist:**  
  * \[ \] Confirm deployment caps and mandatory Dragon Lord deployment are enforced.  
  * \[ \] Confirm swapping two units on blue deployment tiles and changing a unit's 4 active moves, `[E]` Equipped move, and Held/Consumable items carry over into Turn 1 of battle on both PC and mobile.

### **Step 7: Turn Phase Sequencer, Combat Math, Single-Equipped Counter & Status Engine**

* **What to Implement:**  
  * Build the `Player Phase` and `Enemy Phase` state machine, including start-of-phase triggers: Wonder Tile healing (`20% HP` \+ clear debuffs), Leftovers healing (`10% HP`), Poison damage (`1/8 HP`), Burn damage (`1/16 HP`), Freeze thaw roll (`2–5 turns`), Sleep wake check (`1–2 turns`), and **Dungeon Stairs** enemy reinforcement spawns (blocked if a player unit is standing on the Stairs tile).  
  * Build the in-battle floating command menu (`Attack`, `Heal / Status`, `Talk`, `Item / Equip`, `Wait`) and the **Combat Forecast Panel**.  
  * Implement the exact combat resolution sequence:  
    * Check Paralysis (`1/3` chance to skip attack) and Sleep (cannot act or counter).  
    * Calculate Damage using Effective Atk/SpA (halved by Burn for Physical or Freeze for Special), Move Might, Terrain Defense, STAB (`1.25x`), Type Effectiveness (`0x`, `0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`), and Critical Hits (`2.0x`).  
    * Enforce the **Single-Equipped Move Counter Rule**: On Enemy Phase, the defender only counter-attacks if its single `[E]` move matches the attacker's range (`1` for Physical, `2` for Special) and has `PP > 0`.  
    * Resolve Follow-Up Attack (Doubling when `Speed difference >= 5`) and roll random-chance secondary move effects (status infliction or temporary stat buffs/debuffs).  
* **Step 7 Verification Checklist:**  
  * \[ \] Confirm a unit with a Range 1 `[E]` move counter-attacks Range 1 foes on Enemy Phase but **cannot** counter Range 2 foes (and vice versa for a Range 2 `[E]` move).  
  * \[ \] Confirm all 5 status conditions (PAR, PSN, BRN, FRZ, SLP), Type multipliers (including `0x` immunities), STAB (`1.25x`), Crits (`2.0x`), and Dungeon Stairs blocking behave exactly as specified.  
  * \[ \] Confirm right-clicking (PC) or tapping Back (Mobile) cancels uncommitted unit movement and returns the unit to its starting tile.

### **Step 8: Character Supports (Levels 1–5), Personal Skills & Held/X-Item Combat Hooks**

* **What to Implement:**  
  * Implement orthogonal adjacency detection (`1 tile N, S, E, W`) during combat:  
    * Award `+1 Support Point` between the fighting unit and each orthogonally adjacent allied Pokémon (with a brief bond visual effect), unlocking Support Levels 1 through 5 at `5, 12, 22, 35, and 50` points.  
    * Sum the Support stat bonuses (`Atk`, `SpA`, `Def`, `SpD`, `Hit`, `Avoid`, `Crit`) from **up to 3 adjacent supported allies** (taking the highest 3 if surrounded on all 4 sides) and display them in the Combat Forecast Panel.  
  * Implement all Personal Skill hooks (including the Lord's 2-tile Dragon Aura, Slakoth's Hidden Potential `+20%` growths, Levitate traversal, Overgrow/Blaze/Torrent, Intimidate, Guts, Sturdy, Aegislash's Stance Change, and Kingambit's Supreme Overlord).  
  * Implement all Held Item triggers (auto-consuming Oran/Sitrus/Lum Berries, Shell Bell lifesteal, Life Orb recoil, Choice locks, Eviolite check, Rocky Helmet recoil, Focus Sash survival, Quick Claw `25%` Vantage) and single-battle X-Item boosts (`+3` stat or `+20%` Crit for the remainder of the map).  
* **Step 8 Verification Checklist:**  
  * \[ \] Confirm fighting adjacent to 1, 2, or 3 supported allies increments Support Points and applies the exact additive stat bonuses in combat.  
  * \[ \] Confirm Held Items, Personal Skills, and X-Items trigger properly in battle and that X-Item buffs reset to normal once the battle ends.

### **Step 9: EXP Rubber-Banding, Level-Up Growth Modal & Evolution Promotion System**

* **What to Implement:**  
  * Implement the level-difference EXP formulas (Damage EXP \+ KO Bonus EXP \+ Heal/Support EXP) along the continuous Level 1–40 curve.  
  * Build the *Fire Emblem*\-style **Level-Up Modal** that rolls `1–100` against each of the unit's 6 manually configured growth rates (plus `+20%` for Slakoth) and animates `+1` stat increases.  
  * Implement level-up move learning: when a unit reaches a level in its bespoke learnset table, unlock the move and prompt to equip it if all 4 active slots are full.  
  * Implement the **Evolution Promotion System** (usable in Overworld/Prep menus or mid-battle via the Consumable slot):  
    * **Evolution Stone (Level 10+):** Promotes Stage 1 to Stage 2\.  
    * **Evolution Gem (Level 20+):** Promotes Stage 2 to Stage 3\.  
    * **Eevee Branching Promotion (Level 15+ via Evolution Stone):** Opens the 8-way Eeveelution selection modal.  
    * Apply manual promotion stat bonuses, update growth rates/Personal Skill/`Mov`/traversal class, and swap to the new stage's PMD sprites and portraits while preserving the unit's continuous level and custom nickname.  
* **Step 9 Verification Checklist:**  
  * \[ \] Confirm leveling up triggers stat rolls using the unit's manual growth rates and unlocks level-up moves at the configured levels.  
  * \[ \] Confirm evolving at Level 10, Level 15 (Eevee), and Level 20 applies manual promotion bonuses, keeps the unit's current level number and nickname, and updates its sprites and portraits.

### **Step 10: Campaign Scripting (Prologue \+ 25 Chapters \+ 6 Paralogues), Boss AI & End-to-End Polish**

* **What to Implement:**  
  * Build the CPU Enemy AI controller (scoring legal attacks by damage dealt vs. counter damage taken, prioritizing free hits against player units whose `[E]` move cannot counter at that range, and executing Boss/Commander behaviors).  
  * Populate all map layouts (using *Explorers of Sky* dungeon tilesets), enemy placements, Stairs reinforcement schedules, and PMD portrait cutscene/recruitment scripts across the **Prologue, 25 Main Chapters, and 6 Paralogues**.  
  * Implement mid-battle **Talk** recruitment events on the grid (including choosing between Nidoran♂ and Nidoran♀ in Paralogue 3, and recruiting the defecting enemy **Gastly** in Paralogue 6—the only enemy-line Pokémon that can join the player's team).  
  * Implement victory and defeat flows (Lord fainting triggers immediate Game Over; clearing Chapter 25 against Final Boss Emperor Kingambit unlocks **New Game Plus**).  
* **Step 10 Verification Checklist:**  
  * \[ \] Confirm the `Talk` command recruits mid-battle allies (including Paralogue 3 Nidoran and Paralogue 6 Gastly) and opens the Nickname Modal.  
  * \[ \] Confirm Lord defeat triggers Game Over on every map, and clearing Chapter 25 unlocks New Game Plus mode.  
  * \[ \] Run a complete end-to-end verification pass across both Desktop (mouse point-and-click \+ right-click menus) and Mobile (touch tap/drag \+ on-screen Menu/Back button) to confirm 100% playability.