# Mystery Emblem - Project Directory

This directory (`src/mystery-emblem/`) houses all data registries, state management, UI components, scenes, and tactical engine modules for **Mystery Emblem**.

## Folder Structure

- `data/` - Human-editable sharded JSON registries (`species/`, `moves/`, `items/`, `chapters/`, `cutscenes/`, `overworld/`, `supports/`, `tutorials/`)
- `types/` - TypeScript interfaces and schema validators
- `state/` - Hybrid `SaveStateManager` (`localStorage` + Firebase Auth / Cloud Firestore sync + JSON export/import)
- `assets/` - PMD Collab / SpriteCollab sprite, tileset, and multi-emotion portrait loaders
- `audio/` - Explorers of Sky BGM player and WebAudio SFX synthesizer
- `ui/` - Reusable PMD window frames, portrait/item grids, dialogue/tutorial overlays, prep UI, supports menu, and DevTools
- `scenes/` - Quiz, Partner Select, Overworld, Pre-Battle Prep, Tactical Dungeon Battle (`battle/`), Cutscene, Credits, and Map Editor scenes
- `engine/` - Grid pathfinding, terrain traversal, combat forecast, turn phase sequencer, and AI controller
- `cutscene-editor/` - Desktop-only localhost cutscene and location editor
