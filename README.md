# Mystery Emblem

**Live Game:** [https://mysteryemblem.com](https://mysteryemblem.com)

A browser-based tactical RPG combining *Fire Emblem Awakening* grid combat, manual growth rates, and character supports with *Pokémon Mystery Dungeon: Explorers of Sky* pixel-art dungeon tilesets, 8-directional sprites, portraits, and soundtrack.

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` with your Firebase Web SDK keys to enable Google Sign-In + Cloud Firestore cross-device save sync (local saves work offline out-of-the-box via `localStorage`).

## Build & Verification

```bash
npm run build
npm test
```
