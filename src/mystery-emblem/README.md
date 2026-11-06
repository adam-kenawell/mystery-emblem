# Mystery Emblem — Project Directory

This directory (`src/mystery-emblem/`) houses all data registries, state management, UI components, scenes, and tactical engine modules for **Mystery Emblem**.

## Folder Structure

- `data/` — Human-editable JSON/TypeScript balance registries (`pokemon_species.json`, `moves.json`, `items.json`, `personal_skills.json`, `quiz_questions.json`, `chapters.json`)
- `types/` — TypeScript interfaces and schema validators
- `state/` — Hybrid `SaveStateManager` (`localStorage` + Firebase Auth / Cloud Firestore sync + JSON export/import)
- `assets/` — PMD Collab / SpriteCollab sprite and multi-emotion portrait loaders
- `ui/` — Reusable *Pokémon Mystery Dungeon: Explorers of Sky* window frames, portrait dialogue overlay, and mobile Menu/Back controls
- `scenes/` — Quiz, Partner Select, Overworld, Pre-Battle Prep, and Tactical Dungeon Battle scenes
- `engine/` — Grid pathfinding, terrain traversal, combat forecast, turn phase sequencer, and AI controller
