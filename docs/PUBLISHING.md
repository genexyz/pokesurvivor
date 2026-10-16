# Publishing the game (Coolify + Docker)

The game is a static website plus a small Node server (`server/`) with
Postgres for the cloud: Google accounts, saves, friends, leaderboard and co-op
lobbies. `npm run build` generates the website in `dist/` and the `Dockerfile`
builds an image with the server, which serves `dist/` and the cloud. It is
published on **Coolify**, at **https://survivor.preciostcg.com**. No paid services:
Postgres runs on the same Coolify and co-op only uses Google's free STUN.

## 1. Create the application in Coolify (once)

0. **Postgres:** in the same project, **+ New → Database → PostgreSQL**. Copy its
   internal URL (`postgres://...`): it is the `DATABASE_URL` below. Turn on its
   scheduled backups (Backups) if you like.
1. **Projects → (your project) → + New → Public/Private Repository** and pick this
   repository, branch `main`.
2. **Build Pack: Dockerfile** (uses the `Dockerfile` at the root).
3. **Ports Exposes: `80`**.
4. **Domains:** `https://survivor.preciostcg.com`. Coolify (Traefik) gets the
   HTTPS certificate on its own (and lets the `/ws` WebSocket through with no extra setup).
   In the preciostcg.com DNS, an `A` record `survivor` pointing to the server's IP.
   4b. **Environment Variables** (see `.env.example`):
   - `DATABASE_URL`: the one from the Postgres in step 0
   - `BETTER_AUTH_URL=https://survivor.preciostcg.com`
   - `BETTER_AUTH_SECRET`: a new one, `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the same as precios-tcg
   - `ADMIN_EMAILS`: your Google email (for leaderboard moderation)
     4c. **Google Cloud Console → APIs & Services → Credentials →** the precios-tcg
     OAuth client: add the origin `https://survivor.preciostcg.com` and the redirect
     URI `https://survivor.preciostcg.com/api/auth/callback/google` (and, for
     local testing, `http://localhost:3000/api/auth/callback/google`).
     Google's "Choose an account" screen shows that client's app name.
5. Turn on **Auto Deploy** (GitHub webhook) so every `git push` publishes.
6. **Deploy**.

The image runs `npm ci`, `npm run build` (Node + Python inside the container) and
starts `node server/index.mjs` on port 80. On startup, the server creates or
updates the Postgres tables by itself. Nothing needs to be installed on the server.

## 2. Updating the game

```
npm run build        # optional: check locally that it builds (npm start to see it)
git add -A
git commit -m "What you changed"
git push             # Coolify rebuilds and publishes
```

`dist/` is not committed: the image generates it on every deploy.

Players move to the new version on their own (`src/js/core/updater.js` checks
`/version.json` every 5 min). The server serves `version.json` and the pages with no cache
and `js/app.min.js` with a long cache (the URL carries the `?v=` fingerprint).

### Mandatory update

To also cut short the runs in progress (keeping what was earned), add the
**Build Variable** `BUILD_ARGS=--force` in Coolify, deploy, and then remove it.
Locally this is `npm run build:force`. The old flag name `--forzar` still works as
an alias, but if Coolify still has `BUILD_ARGS=--forzar` saved, update it to `--force`.

## 3. Testing locally

```
cp .env.example .env   # and fill in BETTER_AUTH_SECRET and the Google keys
npm run db:up          # Postgres in Docker (docker-compose.dev.yml)
npm run dev            # http://localhost:3000, with cloud; without DATABASE_URL it runs in local mode
```

The image: `npm run docker:build` and `npm run docker:run` (http://localhost:8080;
its `DATABASE_URL` must be reachable from inside the container, e.g.
`host.docker.internal` instead of `localhost`).

## 4. Cloud and domain

- The cloud (accounts, saves, co-op) is only enabled on the domains in
  `HOSTS` in `src/js/core/db.js`; on any other domain the game runs in local mode and
  warns that it is not the official website. For another domain: add it to `HOSTS`, change
  `BETTER_AUTH_URL` and the redirect URI of the Google OAuth client.
- The generated pages use `SITE = 'https://survivor.preciostcg.com/'`
  (`scripts/make_seo_pages.py`) and `src/index.html` has that URL in og:image:
  change them if you publish on another domain.

## 5. Search engines

Indexing is turned off on purpose: this is an internal mini-game. See [SEO.md](SEO.md).

## Reminders

- **No money**: no ads, no donations in exchange for anything, no payments.
  The sprite license (CC BY-NC) and the code license (PolyForm
  Noncommercial) require it, and it is what most reduces the risk of Nintendo asking for a takedown.
- If a rights claim arrives at the legal notice email address, deal with it
  quickly: removing what they ask for usually settles the matter.
