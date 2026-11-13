# Mystery Emblem - Low-Token Architecture Map

Read this index first in every session before scanning directories. Read only the 1-2 files relevant to your task.

## 1. Core Architectural Invariants (`GEMINI.md`)
- **Manual Balance Only:** Never compute stats/growths from PokeAPI; read human-editable sharded JSON registries via `src/mystery-emblem/data/index.ts`.
- **Unified Pointer Events Only:** `pointerdown`/`pointermove`/`pointerup` (`src/mystery-emblem/ui/pointerControls.ts`); zero keyboard bindings; `>=44px` mobile hitboxes; persistent corner `Menu`/`Back` + long-press parity.
- **Tactical Combat Rules:** 4-move loadout; `Physical` = Range 1, `Special` = Range 2, `Support/Heal` = Range 1 or Range 2, never both (`heal`/`self_heal`/`status`/`shield`/`dance`; `wish` is a delayed heal via `supportPayload.delayedHeal` -> `pendingWishHeal`; `shield` -> `activeShields` flat damage reduction ticked at own phase start); `priority` defender counters strike before non-priority attacks (`defenderStrikesFirst`); dual `[E]` slots (one Physical + one Special, `data/equippedMoves.ts`) counter on Enemy Phase by range; zero pure stat-boost moves.
- **Strict Faction & Lv. 1-40 Curve:** `playable`, `enemy`, `convertible` (`gastly_line`, `sandile_line`, `seedot_line`, `deino_line`), and `ally_npc` (`kecleon_line`) enforced by `campaignConfig.ts` & `registryValidators.ts`; Stone promotions Lv. 10+ (Lv. 15 `eevee`), Gem Lv. 20+.
- **Pixel Rendering:** `imageSmoothingEnabled = false` + `image-rendering: pixelated`; `1x` native `24x24`px buffer + CSS scale (`ui/gridViewportMath.ts`); sprite footline `(frameW/2, frameH/2 + 4)` anchored at `(12, 20)`.
- **Hybrid Cloud Save (3 Files):** Immediate `localStorage` per file (`mystery_emblem_save_v2` = File 1, `mystery_emblem_save_v2_slot{2,3}`; active file in `mystery_emblem_active_slot_v1`; `mystery_emblem_map_overrides_v1`) + Firebase Auth/Firestore (File 1 + flat `customMapsEnvelopeJson` at `saves/{uid}`, Files 2-3 at `saves/{uid}/slots/slot{n}`; per-file `lastUpdated` timestamp resolution; `signInWithPopup` bound strictly to `click`). Every mutation autosaves to the active file; "Save Progress" (overworld menu, prep hub, battle field menu via `ui/SaveSlotOverlay.ts`) copies to any file. Mid-battle saves store `SaveData.battleSuspendJson` (`scenes/battle/battleSuspend.ts`), resumed by `continueCampaignFromTitle`; battle RNG is a persisted seeded mulberry32 (`engine/seededRng.ts`, `getBattleRng`).
- **Verification Gate:** Always run `npm run typecheck && npm run build && npm test` (`playwright.config.ts` serves `dist/`).

## 2. File Path, Responsibility & Export Index

### Entry Shell, App Bootstrap & Asset Utilities
- `src/pages/{index,about,characters,faq,how-to-play}.astro` - Thin `#mystery-emblem-root` HTML shell + SEO info pages.
- `src/mystery-emblem/app/{bootstrapApp,appContext,appSceneFactory,authAndTitleController,appBackStackWiring,chapterBattleLauncher,sceneRouterController,e2eDebugBridge}.ts` - App lifecycle, Google Auth & Title UI, LIFO `BackStackController`, multi-cutscene & pre-Overworld linear chain router (`Quiz` -> `cs_00` -> `cs_01` -> `Prologue` -> `cs_02` -> `Ch. 1` -> `cs_03` -> `Overworld` -> `Ch. 4` -> `cs_06` -> `Credits`), dev/test-gated `window.__MYSTERY_EMBLEM_DEBUG__`.
- `src/utils/sprite-utils.ts` - SpriteCollab & PokeAPI item URL builders (`spriteUrl`, `portraitUrl`, `itemSpriteUrl`), `loadImage`, `AnimData.xml` `<CopyOf>` parser.

### Data, Sharded Registries & Self-Contained Chapters (`src/mystery-emblem/data/`)
- `campaignConfig.ts` - Central 5-Act campaign rules (`MIN_UNIT_LEVEL=1`, `MAX_UNIT_LEVEL=40`, `STARTER_PARTNER_SPECIES_ID='quaxly'`, `STARTER_HEALER_SPECIES_ID='flabebe'`, `MENTOR_JAGEN_SPECIES_ID='mentor_quaquaval'`, `DRAGON_LORD_SPECIES_IDS`, `CONVERTIBLE_FACTION_LINE_IDS`, `ACT1_CREDITS_NODE_ID='chapter_04'`).
- `index.ts` - Hydrates sharded JSONs into O(1) maps & getters: `getSpeciesById`, `getMoveById`, `getItemById`, `getPersonalSkillById`, `getSpeciesLine`, `getRegistryValidationSummary`.
- `species/{line_learnsets,playable_core,playable_story,playable_quiz_early,playable_quiz_late,playable_paralogues,enemies_commonwealth_sand,enemies_empire_abyss,enemies_rift_paradox}.json` - 201 5-Act species across 79 lines (incl. `quaxly_line`, `phanpy_line`, `rhyhorn_line`, `mentor_quaquaval`, `smoliv_line`, `caterpie_line`, Ancient & Future Paradoxes, `hoopa`/`hoopa_unbound`, `dragapult`, `hydreigon`).
- `moves/{physical,special,support}.json`, `items/{consumables_and_vitamins,held_items,tms}.json`, `personal_skills.json` - Manual moves (incl. `aqua_step`, `nuzzle`, `hyperspace_hole`, `hyperspace_fury`), items (`paralyze_heal`), TMs, and personal skills.
- `chapters/{prologue,chapter_01..04,paralogue_01}/{chapter.json,dialogue/*.json}` - Self-contained Act 1 chapters: `prologue` (`Hometown Pitch` 2-phase Quaquaval + Town Trio sparring w/ `scripted_attack` `Nuzzle` & `give_unit_item` `Paralyze Heal`, `prologue/tutorialStaging.ts`), `chapter_01` (`Watering Hole`), `chapter_02` (`Foothill Trail` first Battle Prep w/ Quaquaval + Smoliv rescue), `chapter_03` (`Mountain Caves` 36x14 gauntlet w/ Machop & `seize` `win_battle` exit), `paralogue_01` (`Lush Prairie` Slakoth), and `chapter_04` (`Capital Outskirts` lone `Great Tusk` boss + Ground/Rock stampede herds + Starly/Caterpie/Pawmi arrival + post-cutscene Honedge/Sandile).
- `chapters/{chapterTypes,chapterCodec,mapValidator,defaultCatalog,index}.ts` & `mapOverrideStore.ts` - Chapter hydration (`preStoryCutsceneIds`, `postStoryCutsceneIds`, `chainsDirectlyIntoNodeId`, `postCutsceneRecruits`), validator, and override store.
- `cutscenes/{cs_00..cs_06_*.json,locations/*.json}` + `cutscenes/{cutsceneDocTypes,cutsceneRegistry,dialogueCompiler,locationCodec,mediaLibrary,previewSave}.ts` - 7 Act 1 story cutscenes & shared locations.
- `quizLordProfiles.ts`, `quizQuestions.ts` (`quizData.ts` barrel) - 5 Dragon Lord aura profiles & 8-question Dragon-only personality quiz.
- `overworld/{overworldGraphData,kecleonShopCatalog,skirmishEncounterData}.ts` (`overworldMapData.ts` barrel) - 6-node Act 1 Verdant Kingdom graph, 4 Kecleon Shop catalogs, Feral Skirmish tiers.
- `storyCutscenes.ts`, `creditsData.ts`, `accessControl.ts`, `allegiance.ts` - Multi-cutscene lookup (`getPre/PostChapterCutsceneIds`, `listStoryCutscenesInPlayOrder`), Act 1 credits cast + `DEMO_FEEDBACK_FORM_URL` demo CTA (`resolveCreditsEndCardCopy().feedbackFormUrl`, opened by `openDemoFeedbackForm` in `scenes/credits/creditsDomBuilder.ts` on real `click`), admin gate, unit-card realm allegiance (`Verdant`, `Sand`, `Steel`, `Forest`, `Rift`, `Feral`).
- `tutorials/{tutorialTypes,prologueDrillTopics,earlyChapterTopics,mechanicsAndTerrainTopics,tutorialTriggers}.ts` (`tutorialRegistry.ts` barrel) - **Quaquaval's Field Notes** coaching topics & `TUTORIAL_TRIGGER_RULES`.

### Schemas, Validators & Persistence (`types/`, `state/`)
- `types/{registrySchemas,battleSchemas,eventSchemas,saveSchemas}.ts` (`types/schemas.ts` barrel) - Core TS types (`SaveData` schema `v2`, `DungeonEventAction` incl. `give_unit_item`, `scripted_attack`, `win_battle`, `exceptPartner`).
- `types/validators/{registryValidators,saveValidator}.ts` (`types/validators.ts` barrel) - `validateAllRegistries`, faction separation checks, `validateSaveData` (`schemaVersion: 2`).
- `state/SaveStateManager.ts` + `state/{saveHelpersAndFactory,campaignSaveFactory,saveStorageIo,rosterAndMoveMutators,convoyAndItemMutators,battleCommitMutators,campaignAndTutorialMutators,overworldAndShopMutators,cloudReconciler,firestoreCodec,firebaseSync}.ts` - Modular `SaveStateManager` & `FirestoreSyncAdapter`.

### Assets, Audio & Modular Tactical Engine (`assets/`, `audio/`, `engine/`)
- `assets/{pmdAssetTypes,subformResolver,portraitAndItemLoader,spriteBundleLoader}.ts` (`pmdAssetLoader.ts` barrel) - 8-dir sprite/portrait/item loaders, Lord -> Flabebe (`0669`) & Florges (`0671`) flower subform resolver, `computePmdTileSpritePlacement`.
- `assets/{tilesetCatalog,tilesetOverlays,tilesetLoader}.ts` & `audio/{AudioManager,audioFadeAndSettings,webAudioSfxSynth,audioTracks}.ts` - 144 `24x24` PMD tilesets & EoS WebAudio BGM/SFX engine.
- `engine/speakerResolver.ts` - Central `{lord|partner|healer|healer_parent|mentor|advisor|unit|species|npc}` speaker/portrait/subform resolver (`resolveSpeaker`, `resolveDialogueSpeaker`).
- `engine/{overworldEngine,terrainAndPathfinding,combatEngine,progressionEngine,enemyAi,battleEvents,quizScoring,battleSetup,battleSpawnHelpers,fallbackPrepManager}.ts` - Overworld Dijkstra, terrain/A*/Danger Area, 18-type combat/status/forecast/counter/heal/dance math, rubber-banded EXP (`mentor_quaquaval` veteran penalty), AI, and declarative event evaluators.

### Scoped CSS, Shared UI Widgets & Scenes (`ui/`, `scenes/`)
- `ui/pmdWindow.css` + `ui/styles/{00-reset..26-battle-events}.css` - 28 scoped CSS modules.
- `ui/{PmdWindow,PmdSpriteCanvas,PmdUnitPortraitGrid,PmdItemIconGrid,typeColors,typewriterController,pointerControls,mapZoomController,pinchZoomTracker,gridViewportMath}.ts` + `ui/inspector/*`.
- `ui/{RecruitNicknameOverlay,QuizScene,DungeonPrepOverlay,DevToolsHarness,DialogueOverlay,TutorialOverlay}.ts` + `cutscene-editor/*`.
- `scenes/{OverworldScene,CutsceneScene,CreditsScene,BattleScene,ChapterMapEditorScene}.ts` + `scenes/{overworld,cutscene,credits,battle,editor}/*`.

## 3. Task Routing Quick-Lookup
- **Stats / Moves / Items / Skills:** `data/species/*.json`, `data/moves/*.json`, `data/items/*.json`, `data/personal_skills.json` + `types/validators/registryValidators.ts`
- **Add / Edit a Chapter, Dialogue, Event or Cutscene:** `data/chapters/{id}/{chapter.json,dialogue/*.json}`, `data/cutscenes/*.json`, `data/cutscenes/locations/*.json` + `types/eventSchemas.ts` + `data/cutscenes/cutsceneDocTypes.ts`
- **Combat / Pathfinding / AI / Events / EXP:** `engine/{combat,pathfinding,ai,events,progression}/*` + `scenes/battle/{battleCombatAnimator,battleEventActions,battleEventRunner,battlePhaseAndAiRunner}.ts`
