# PokéSurvivor — how we work and publish

Fixed rules from the project owner. They ALWAYS apply.

## Language

The codebase (code, comments, docs, logs, identifiers) is in English. Spanish exists only as a UI
translation in `src/js/data/lang-es.js`: any new on-screen English text needs its Spanish entry there.

## Publishing a version

1. Edit `src/` (the page is `src/index.html`; static files go in `public/`). `dist/` is generated and never committed.
2. `npm run build` (or `npm run build:force` for a mandatory update); `npm start` to see it.
   - `scripts/build.js` runs Vite (`vite.config.mjs`): `dist/index.html`, `dist/js/app-<hash>.js` (obfuscated) and
     **`dist/version.json`** (this version's fingerprint, also in `<meta name="ps-version">`);
     then `scripts/export_data.js` and `scripts/make_seo_pages.py` generate the web pages.
   - The game is ES modules (`src/js/main.js` is the entry): export what other files use, import what you use. No globals.
3. Commit (no "Co-Authored-By" or any AI signature) and `git push origin main` only when the owner asks.
   Coolify rebuilds the image (`Dockerfile`) and publishes on its own. See `docs/PUBLISHING.md`.

## Automatic player updates (mandatory)

When a version is published, every player must move to the new version without losing anything
(`src/js/core/updater.js`, checks `version.json` every 5 min):

- **Outside a run** (menu, including the co-op lobby): 5 s notice and the page reloads.
  If the player is in the gacha, the upgrade shop, the settings or typing in a field, it waits until they finish.
- **In a run**: left alone. When it ends, the run is saved as usual and the page reloads on returning to the menu.
- Anything pending is uploaded to the cloud before reloading.
  Do not remove `updater.js` or the `ps-release` plugin in `vite.config.mjs` (it writes `version.json` and the meta).

## What's new (changelog)

Each game change or bug fix also goes in `src/js/data/changelog.js`, in English and Spanish
(`[en, es]` pairs), in `new` / `chg` / `fix` of today's date. Server, database or cost changes
do NOT go there.

## Servers

- Everything on Coolify, no paid services: the website at **https://survivor.preciostcg.com** and its server
  (`server/`: Node + Coolify's Postgres 18, `DATABASE_URL`). Firebase was removed on 2026-10-16.
- Accounts: Google ONLY (better-auth, `server/auth.mjs`), using the precios-tcg OAuth client.
  No username and password. Environment variables in `.env.example`.
- Co-op: lobbies, invitations, online friends and WebRTC signaling go through the
  `/ws` WebSocket (`server/live.mjs`); the match runs directly between browsers (Google's free
  STUN). If a TURN server were ever needed, a self-hosted one (coturn) on Coolify, never a paid one.
- Maintenance: `MAINTENANCE` in `src/js/main.js` (`?dev` lets you in to test).
