# Mystery Emblem — Low-Token Architecture Map

Read this index first in every session before scanning directories. Read only the 1–2 files relevant to your task.

## 1. Core Architectural Invariants (`GEMINI.md`)
- **Manual Balance Only:** Never compute stats/growths from PokéAPI; read human-editable sharded JSON registries via `src/mystery-emblem/data/index.ts`.
- **Unified Pointer Events Only:** `pointerdown`/`pointermove`/`pointerup` (`src/mystery-emblem/ui/pointerControls.ts`); zero keyboard bindings; `>=44px` mobile hitboxes; persistent corner `Menu`/`Back` + long-press parity.
- **Tactical Combat Rules:** 4-move loadout; `Physical` = Range 1, `Special` = Range 2, `Support/Heal` = Range 1 or 1–2 (`heal`/`self_heal`/`status`/`shield`/`dance`); single `[E]` Equipped move counters on Enemy Phase; zero pure stat-boost moves.
- **Strict Faction & Lv. 1–40 Curve:** `playable`, `enemy`, `convertible` (`gastly_line`, `sandile_line`, `seedot_line`), and `ally_npc` (`kecleon_line`) enforced by `campaignConfig.ts` & `registryValidators.ts`; Stone promotions Lv. 10+ (Lv. 15 `eevee`/`wimpod`), Gem Lv. 20+.
- **Pixel Rendering:** `imageSmoothingEnabled = false` + `image-rendering: pixelated`; `1x` native `24x24`px buffer + CSS scale (`ui/gridViewportMath.ts`); sprite footline `(frameW/2, frameH/2 + 4)` anchored at `(12, 20)`.
- **Hybrid Cloud Save:** Immediate `localStorage` (`mystery_emblem_save_v1`, `mystery_emblem_map_overrides_v1`) + Firebase Auth/Firestore (`saves/{uid}`, flat `customMapsEnvelopeJson`, `lastUpdated` timestamp resolution; `signInWithPopup` bound strictly to `click`).
- **Module Size & Verification Gate:** Every `.ts`/`.css`/`.astro` file stays `<=308` raw lines. Always run `npm run typecheck && npm run build && npm test` (`playwright.config.ts` serves `dist/`).

## 2. File Path, Responsibility & Export Index

### Entry Shell, App Bootstrap & Asset Utilities
- `src/pages/index.astro` — Thin 139-line `#mystery-emblem-root` HTML shell delegating to `initMysteryEmblemApp`.
- `src/mystery-emblem/app/{bootstrapApp,appContext,appSceneFactory,authAndTitleController,appBackStackWiring,chapterBattleLauncher,sceneRouterController,e2eDebugBridge}.ts` — App lifecycle, Google Auth & Title UI, LIFO `BackStackController` wiring, scene router (`Quiz`/`NG+` -> `Cutscene` -> `Battle` <-> `Overworld` -> `Credits`), dev/test-gated `window.__MYSTERY_EMBLEM_DEBUG__`.
- `src/utils/sprite-utils.ts` — SpriteCollab & PokeAPI item URL builders (`spriteUrl`, `portraitUrl`, `itemSpriteUrl`), `loadImage`, `AnimData.xml` `<CopyOf>` parser (`fetchDetailedAnimData`, `calcFrameInfo`).

### Data, Sharded Registries & Self-Contained Chapters (`src/mystery-emblem/data/`)
- `campaignConfig.ts` — Central campaign rules (`MIN_UNIT_LEVEL=1`, `MAX_UNIT_LEVEL=40`, promotion levels, `ADVISOR_EVOLVED_SPECIES_ID`, `DRAGON_LORD_SPECIES_IDS`, `CONVERTIBLE_FACTION_LINE_IDS`, `INITIAL_CAMPAIGN_CONVOY`, `DEFAULT_QUIZ_SEEDS`, `formatCampaignChapterLabel`, `formatCampaignShortCode`).
- `index.ts` — Hydrates sharded JSONs into O(1) maps & getters: `getSpeciesById`, `getMoveById`, `getItemById`, `getPersonalSkillById`, `getSpeciesLine`, `getRegistryValidationSummary`.
- `species/{line_learnsets,playable_core,playable_story,playable_quiz_early,playable_quiz_late,playable_paralogues,enemies_commonwealth_sand,enemies_empire_abyss}.json` — 182 Lore-Bible species across 63 lines + family-shared learnsets/TM compatibility.
- `moves/{physical,special,support}.json`, `items/{consumables_and_vitamins,held_items,tms}.json`, `personal_skills.json` — Manual moves (incl. `feather_dance_step` `dance`), items, TMs, and personal skills.
- `chapters/{prologue,chapter_01..04}/{chapter.json,scripts.ts,*cutscene.ts}` — Self-contained per-chapter compact tile rows, `playerSpawns`/`npcSpawns`/`enemySpawns`, `reinforcements`, declarative `events`, pre/post story cutscene IDs, Intro/Outro/event scripts, and stage cutscenes (`chapters/cutsceneStages.ts`).
- `chapters/{chapterTypes,chapterCodec,mapValidator,defaultCatalog,scriptHelpers,index}.ts` & `mapOverrideStore.ts` — Chapter hydration, map/event/reinforcement validator, and custom map override store (`campaignRegistry.ts` & `chapterMapRegistry.ts` barrels).
- `quizLordProfiles.ts`, `quizQuestions.ts` (`quizData.ts` barrel) — 5 Dragon Lord aura profiles & 8-question Lore-Bible personality quiz (`slot1Flying`..`slot8Ice`).
- `overworld/{overworldGraphData,kecleonShopCatalog,skirmishEncounterData}.ts` (`overworldMapData.ts` barrel) — Wonder Map graph, 4 Kecleon Shop stock catalogs, Feral Skirmish layouts & scout builds.
- `storyCutscenes.ts`, `creditsData.ts`, `accessControl.ts` — Story cutscene barrel, parameterized credits metadata & Wimpod/Golisopod deduplication, admin gate.
- `tutorials/{tutorialTypes,earlyChapterTopics,mechanicsAndTerrainTopics,tutorialTriggers}.ts` (`tutorialRegistry.ts` barrel) — 15 Wimpod coaching topics & declarative `TUTORIAL_TRIGGER_RULES`.

### Schemas, Validators & Persistence (`types/`, `state/`)
- `types/{registrySchemas,battleSchemas,eventSchemas,saveSchemas}.ts` (`types/schemas.ts` barrel) — Core TS types (`PokemonSpeciesDefinition`, `MoveDefinition`, `ItemDefinition`, `DungeonMapDefinition`, `ReinforcementWaveDefinition`, `DungeonEventDefinition`, `OwnedPokemonInstance`, `SaveData`, `UnitBattleFaction`, `UnitCosmeticForm`).
- `types/validators/{registryValidators,saveValidator}.ts` (`types/validators.ts` barrel) — `validateAllRegistries`, faction separation checks, `validateSaveData`.
- `state/SaveStateManager.ts` + `state/{saveHelpersAndFactory,campaignSaveFactory,saveStorageIo,rosterAndMoveMutators,convoyAndItemMutators,battleCommitMutators,campaignAndTutorialMutators,overworldAndShopMutators,cloudReconciler,firestoreCodec,firebaseSync}.ts` — Modular `SaveStateManager` & `FirestoreSyncAdapter` (campaign init, NG+ flag, branched `useEvolutionItemOnUnit`, `promoteAdvisorToPlayableRoster`, Convoy/TM/vitamin/shop/skirmish mutators, `lastUpdated` cloud sync).

### Assets, Audio & Modular Tactical Engine (`assets/`, `audio/`, `engine/`)
- `assets/{pmdAssetTypes,subformResolver,portraitAndItemLoader,spriteBundleLoader}.ts` (`pmdAssetLoader.ts` barrel) — 8-dir sprite/portrait/item loaders, Lord -> Flabébé flower & Oricorio style subform resolver, `computePmdTileSpritePlacement`.
- `assets/{tilesetCatalog,tilesetOverlays,tilesetLoader}.ts` — 144 `24x24` PMD tileset loader & pixel-art `stairs`/`wonder_tile`/`barrier` overlays.
- `audio/{AudioManager,audioFadeAndSettings,webAudioSfxSynth,audioTracks}.ts` — `getAudioManager`, `AudioManager`, WebAudio `3x` compressor SFX synth, `PMD_BGM_TRACKS`.
- `engine/speakerResolver.ts` — Central `{lord|partner|healer|advisor|quiz_slot|unit|species|npc}` speaker/portrait/subform resolver & Wimpod -> Golisopod roster transition.
- `engine/overworld/{overworldGraphState,overworldPathfinding,overworldSpawners}.ts` (`overworldEngine.ts` barrel) — Overworld graph reconciliation, Dijkstra road routing, post-battle shop/skirmish spawners.
- `engine/terrainAndPathfinding.ts` + `engine/pathfinding/{terrainRules,attackEnvelope,pathfindingAStar}.ts` — Traversal (`Grounded`/`Flying`/`Levitate`), `areBattleFactionsAllied` (`player`+`npc` allied pass-through), Dijkstra reachability, A*, Danger Area union.
- `engine/combatEngine.ts` + `engine/combat/{typeEffectiveness,combatTypesAndStats,combatForecast,combatResolver,attackPlanFinder,supportHealEngine,danceEngine}.ts` — 18-type chart, skills/items, FE forecast, single `[E]` counter & double-attack resolution, support heals/consumables, and Oricorio Dancer turn-refresh (`findBestDancePlanForAlly` w/ anti-Dancer-loop guard).
- `engine/progressionEngine.ts` + `engine/progression/{expAndLevelUp,battlePromotion}.ts` — Rubber-banded EXP, manual growth rolls, mid-battle Stone/Gem promotions, `commitBattleResults`.
- `engine/enemyAi.ts` + `engine/ai/{aiPursuitField,enemyTurnPlanner}.ts` — `chooseEnemyAction` (targets `player`/`npc`, prioritizes `isLord`/`mustSurvive`) & `chooseNpcAllyAction` (Green `'npc'` AI vs `'enemy'`).
- `engine/battleEvents.ts` + `engine/events/eventEvaluator.ts` — Pure declarative evaluators for `turn_start`, `talk` (`findBestTalkPlanForTarget`), `unit_defeated`, `tile_reached`, and `battle_victory` + `resolveDefaultObjectiveLabel`.
- `engine/{quizScoring,battleSetup,battleSpawnHelpers,fallbackPrepManager}.ts` — Quiz tally, `playerSpawns`/`npcSpawns`/`enemySpawns` instantiation, spiral free-tile search, and fallback test-battle save factory.

### Scoped CSS, Shared UI Widgets & Scenes (`ui/`, `scenes/`)
- `ui/pmdWindow.css` + `ui/styles/{00-reset..26-battle-events}.css` — 28 cascade-preserving `<=275`-line scoped CSS modules.
- `ui/PmdWindow.ts`, `ui/{pmdSpriteScheduler,PmdSpriteActor,PmdPortraitView}.ts` (`PmdSpriteCanvas.ts`), `ui/PmdUnitPortraitGrid.ts`, `ui/PmdItemIconGrid.ts`, `ui/typeColors.ts`, `ui/typewriterController.ts`, `ui/pointerControls.ts`, `ui/{mapZoomController,pinchZoomTracker,gridViewportMath}.ts`.
- `ui/inspector/{UnitDetailCard,MoveLoadoutEditor,ItemActionInspector,OverworldUnitSubboxes}.ts` — Shared 7-stat cards, 5-branch Stone/Gem evolution controls, 4-move loadout/TM editors, and Convoy item action inspectors.
- `ui/RecruitNicknameOverlay.ts`, `ui/QuizScene.ts` (`ui/quiz/*`), `ui/DungeonPrepOverlay.ts` (`ui/prep/*`), `ui/DevToolsHarness.ts` (`ui/devtools/*`), `ui/{DialogueDomView,DialogueOverlay}.ts`, `ui/TutorialOverlay.ts` (`ui/tutorial/*`).
- `scenes/OverworldScene.ts` (`scenes/overworld/*`), `scenes/CutsceneScene.ts` (`scenes/cutscene/*`), `scenes/CreditsScene.ts` (`scenes/credits/*`).
- `scenes/BattleScene.ts` + `scenes/battle/{battlePublicTypes,battleTypesAndState,battleDomShell,battleModalsDom,battleForecastDom,battlePrepOverlayWiring,battlePrepAndAssets,battlePrepSlotActions,battleLifecycleController,battleUnitQueries,battleDangerAndViewportState,battleRangeZonePainter,battleFloatingCallouts,battleUnitSpriteRenderer,battleCanvasRenderer,battleBannersAndTransitions,battleHudCards,battleSelectionAndMenu,battleCommandExecution,battleForecastMoveList,battleAttackForecastView,battleHealForecastView,battleHealForecastAndConfirm,battleWalkAndHealAnimator,battleCombatAnimator,battleLevelUpModal,battleOutcomeModals,battleAllyPhaseRunner,battlePhaseAndAiRunner,battleTalkChoiceModal,battleDanceController,battleEventActions,battleEventRunner,battleFieldMenuController,battleFieldSubmodalViews,battleHoverPreview,battleTileTapHandler,battleUnitSelectedTap,battleStagePointers,battleUiButtonBindings,battleTutorialSpotlights,battleTutorialIntegration,battleBackAndCheats}.ts`.
- `scenes/ChapterMapEditorScene.ts` + `scenes/editor/{editorTypesAndState,editorDomShell,editorAssetsAndPalette,editorBrushAndUndo,editorCanvasRenderer,editorHudAndDrawerBindings,editorLifecycleHelpers,editorModalBindings,editorPersistenceActions,editorSidebarAndStatus,editorSpawnsAndResize,editorStagePointers,editorStairsWaveTool}.ts`.

## 3. Task Routing Quick-Lookup
- **Stats / Moves / Items / Skills:** `data/species/*.json`, `data/moves/*.json`, `data/items/*.json`, `data/personal_skills.json` + `types/validators/registryValidators.ts`
- **Add / Edit a Chapter, Script, Event or Cutscene:** `data/chapters/{id}/{chapter.json,scripts.ts,*cutscene.ts}` + `types/eventSchemas.ts` + `data/chapters/{defaultCatalog,index}.ts` + `data/storyCutscenes.ts`
- **Shared Unit/Move/Item/Evolution UI:** `ui/inspector/*` + `ui/prep/*` + `scenes/overworld/Overworld{Units,Items}TabRenderer.ts`
- **Combat / Dance / Pathfinding / AI / Events / EXP:** `engine/{combat,pathfinding,ai,events,progression}/*` + `scenes/battle/{battleCombatAnimator,battleDanceController,battleEventActions,battleEventRunner,battleAllyPhaseRunner,battlePhaseAndAiRunner}.ts`
- **Battle HUD / Pointers / Forecasts / Map Editor:** `scenes/battle/*`, `scenes/editor/*`, `ui/gridViewportMath.ts`
