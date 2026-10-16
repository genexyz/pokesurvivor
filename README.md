# PokéSurvivor · Mystery Dungeon

A Pokémon bullet-heaven in the style of Survivor.io and Megabonk, with
_Pokémon Mystery Dungeon_ sprites, a roguelike layer, **966 Pokémon from all 9 generations**,
shinies and a gacha per region. Music and sound effects composed for the game.

Vanilla HTML + CSS + JavaScript on Canvas 2D. No framework, no runtime
dependencies, and the game itself runs **entirely locally**: no internet needed to play.

> **Crypto disclaimer**
>
> PokéSurvivor has **no official cryptocurrency, token or NFT**, and I have not
> created any. Any token using the game's name was created by third parties.
> **I take no responsibility for any purchase, sale or investment** you make
> with them, and nothing here is investment advice. The game is free and will
> stay free.

## Playing

You need [Node.js](https://nodejs.org) 22 or later:

```
npm install
npm run dev        # http://localhost:3000
```

The game starts in your browser's language (Spanish for Spanish browsers, English
otherwise); you can change it in **Settings**.

Sign in with Google or play as a guest, take the personality quiz and head into
the dungeon. Without a `DATABASE_URL`, `npm run dev` saves only in the browser
(no cloud); see [Development](#development).

| Key                      | Action               |
| ------------------------ | -------------------- |
| `W` `A` `S` `D` / arrows | Move                 |
| `1` `2` `3` `4`          | Pick the active move |
| `Q` / `E`                | Cycle moves          |
| `Esc` / `P`              | Pause                |

**On phone or tablet** (landscape): put your finger anywhere and drag to move
(the joystick appears where you touch), tap an attack at the bottom to switch to
it and the top-right button to pause. It can be installed as an app ("Add to Home
Screen"). **Settings** has sound, graphics quality (with an automatic mode),
damage numbers, reduced screen shake, FPS and the account.

Your Pokémon attacks on its own with the active move (or with all the moves of a
**bond**: each defeated legendary lets you fuse moves so they fire together from
a single slot, up to 4). Rocks, chests and tall grass can be broken; walls and
trees block enemy shots; water slows you down and lava burns (enemies too).

The map has **power altars**, healing **springs**, **locked chests** (stand next
to them for a few seconds) and **traps** that also hurt enemies. Sometimes a
**rift** opens: step in and you fight a **legendary** in a separate arena.

There is a **type chart** (a Bubble Beam hurts a Charmander more) and, every so
often, **weather** (sun, rain, sandstorm, snow, fog) that boosts some types and
weakens others.

Every day there are **missions** (and weekly ones) that give tickets and coins;
**achievements** give medals and titles, and your **profile** shows your 3
favorite Pokémon, your records and your medals. During runs you find **items**
(Leftovers, Choice Band...) and your moves **evolve** at max level. Enemies have
personalities: they heal, shield, call their pack or attack with a warning on the
ground.

**Upgrades** belong to each Pokémon. The **gacha** uses **tickets** earned by
playing (×1 from some Pokémon, ×10 from bosses and legendaries), and you pull on
a pixel-art slot machine.

Every enemy has a 1/4096 chance of being **shiny**: it sparkles, an arrow at the
edge of the screen tells you where it is, and if you defeat it you keep it. In the
gacha, 1 in 100 pulls is shiny. In the collection you choose your partner in its
normal or shiny version.

Music starts after the first click (browsers do not allow sound before that).
Volume and mute: the speaker button at the top right, or in the pause menu.

Without a cloud account, the save lives in the browser's `localStorage`: if you
clear the site's data, it is lost.

`videos/` holds gameplay recordings (with their music): a boss fight, catching a
wild shiny and a shiny in the gacha.

## Cloud saves and publishing

- **Self-hosted cloud (`server/`: Node + Postgres):** sign-in is Google only and
  your save follows you on any device. Variables in [.env.example](.env.example).
  Without `DATABASE_URL`, the game saves only in the browser.
- **Playing with friends (up to 4) and leaderboard:** with a cloud account, the
  **Friends** menu (add by nickname, invite to your lobby) and **Leaderboard** (time
  survived: solo or group, from today to all-time, friends, per Pokémon).
- **Publishing (Docker / Coolify):** [docs/PUBLISHING.md](docs/PUBLISHING.md).
- If you play on two computers at once or offline, the saves are **merged**:
  collections are combined (a Pokémon or a shiny is never lost), upgrades and
  stats keep the maximum, and coins and tickets use each device's own ledger
  (`src/js/core/save-merge.js`, the same merge in the browser and on the server).

## License

Code under [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) since
2026-10-14: it may be used, studied and modified, but **not for commercial
purposes** (neither selling the game nor charging for anything inside it). Versions
up to commit `b297089` were published under MIT. The sprites (CC BY-NC 4.0),
the font (OFL) and the Pokémon trademarks have their own terms: see
[LICENSE](LICENSE) and [CREDITS.md](CREDITS.md). Non-profit fan project.

**The only official website is [survivor.preciostcg.com](https://survivor.preciostcg.com).** The
game is and will remain free: if someone asks you to pay, it is not us.

## Development

| Command                               | What it does                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | Local server at http://localhost:3000 with `src/` + `public/`; reloads on save. With `.env` (DATABASE_URL), with cloud. |
| `npm run db:up`                       | Local Postgres in Docker (`docker-compose.dev.yml`).                                                                    |
| `npm run build`                       | Generates `dist/`: the bundled game (`js/app.min.js`), `version.json` and the web pages. Needs Python 3.                |
| `npm run build:force`                 | Same, but as a mandatory update for players.                                                                            |
| `npm run build:debug`                 | Same, without obfuscation (`G` reachable from the console).                                                             |
| `npm start`                           | Serves `dist/` as in production (run `npm run build` first).                                                            |
| `npm run clean`                       | Deletes `dist/` and `.cache/`.                                                                                          |
| `npm run lint` / `lint:fix`           | Checks the code with ESLint (and fixes what it can automatically).                                                      |
| `npm run format` / `format:check`     | Formats with Prettier / checks that everything is formatted.                                                            |
| `npm run docker:build` / `docker:run` | Production image (Node server) at http://localhost:8080.                                                                |
| `npm run data:*`                      | Regenerates data: `pokedex`, `sprites`, `credits`, `hover`, `icons`, `font` (Python).                                   |

Port: `PORT=4000 npm run dev`. Python: if it is not on the PATH, `PYTHON=/path/to/python`.

All code, comments and docs are in English. Spanish is only a UI translation: any
new on-screen text needs its Spanish entry in `src/js/data/lang-es.js`.

## Structure

```
src/
  index.html            the page: screens + script load order (edit it here)
  css/                  style.css (game, Mystery Dungeon style) and pages.css (web pages)
  js/
    core/     util, db (saving), audio (synthesizer + effects), input, i18n,
              sprites (PMD animator), camera, updater (automatic updates)
    data/     pokedex*, sprites-meta*, moves, starters (+ quiz), enemies,
              upgrades, music (scores), changelog, lang-es (Spanish UI)
    world/    tiles (pixel art in code), world (terrain, objects, collisions)
    entities/ player, enemy, projectile, pickup, fx
    systems/  combat, spawner, levelup, gacha...
    net/      live (WebSocket), social (nickname, friends, lobbies), net (WebRTC), coop, ranking
    ui/       icons (pixel art), ui, hud, login, test, menu, gacha-ui, run-ui...
    game.js   flow and main loop
    main.js   startup
public/                 copied as-is to dist/
  assets/pokemon/{dex}/ PMD sprite sheets* (Idle, Walk, Attack, Shoot, Charge, Hurt, Faint); s/ = shiny
  assets/icons/         app icons*
  assets/fonts/         Pixelify Sans (OFL) and its version with redrawn digits*
  contact/  favicon.ico  manifest.webmanifest  sw.js
scripts/                build and the scripts that regenerate the files marked with *
server/                 server (website, Google accounts, saves, leaderboard, co-op lobbies and signaling)
docs/                   publishing, SEO, domain, GDD
dist/                   generated by npm run build (not committed)
```

`*` = generated. To rebuild them (needs Python 3 + Pillow and internet, only that once):

```
npm run data:sprites    # normal and shiny sprites + src/js/data/sprites-meta.js
                        # (~20 min; can be interrupted and restarted: uses .cache/)
npm run data:pokedex    # src/js/data/pokedex.js
npm run data:credits    # CREDITS.md
```

## Implementation notes

- **PMD sprites.** Columns = frames, rows = 8 directions (Down, DownRight,
  Right, UpRight, Up, UpLeft, Left, DownLeft — verified with the `-Offsets.png` files).
  Each animation has its own frame size, so they are aligned by the
  **ground anchor** taken from `-Shadow.png`; without it the sprite would jump when attacking.
- **Coordinates.** An entity's `(x, y)` is its **feet**. Collisions happen on the
  ground plane; projectiles fly on that plane and are drawn raised with their
  shadow underneath.
- **World.** 16×16-tile chunks: the _data_ (terrain, objects) is cheap and always
  generated; the _image_ is baked at art resolution by writing into an
  `ImageData` (~4 ms per chunk in Chrome) and only for the visible ones.
- **Performance.** Spatial grid of enemies rebuilt every frame. With 420
  enemies, simulation + full render ≈ 3 ms per frame in Chrome.
- **Metadata in `.js`, not `.json`**, because `fetch()` is blocked on `file://`.
- **Shiny.** SpriteCollab shinies are the same drawing with another palette; they
  live in `s/` and only 30 have different geometry (the `sa` field in the metadata).
  Sheets are stored as PNG with an exact palette: same image, half the size.
- **Audio.** Web Audio synthesizer with a look-ahead scheduler (it schedules notes
  150 ms ahead) and convolution reverb with a generated impulse.
  The scores are in `js/data/music.js` in a custom text format.
  Effects have a minimum gap between repeats and a voice cap,
  so 400 enemies hit at once do not saturate the output.
- **Icons.** Character maps converted to canvas and data URLs; always at
  integer multiples of their size so pixels stay crisp.

## Credits and license

Sprites from [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under
**CC BY-NC 4.0** — **non-commercial** use with attribution; the list of artists
is in [`CREDITS.md`](CREDITS.md). Pokémon is the property of Nintendo, Creatures
Inc. and GAME FREAK. Non-profit fan project.
