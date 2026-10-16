# Community suggestions (open PRs)

Reviewed on 2026-10-16. Source: the **37 open PRs on upstream `JPTER78/pokesurvivor`**. `origin`
(`genexyz/pokesurvivor`) has no open PRs.

> **Compatibility note.** Every PR targets the old upstream codebase: the global `G.*` object,
> `dev.html`, `tools/build.js`, `js/app.min.js`, Spanish-source i18n and Firebase/Firestore. This repo
> now uses Vite with ES modules (`src/js/main.js`), English as the primary language with `lang-es.js`,
> Postgres on Coolify and Google-only login. None of these PRs can be merged as they are. Read them
> as designs or reference implementations to port into `src/`. Work that only applies to Firebase is
> obsolete.

## Quick index

| PR | Author | Category | Summary | Size |
|---|---|---|---|---|
| #171 | @emiramirez24 | UI/HUD | Damage meter ("Recount") per move / per co-op player | +403 / -47 |
| #170 | @jtvaldivia | Gacha | "All regions" banner with all 966 Pokémon | +119 / -15 |
| #169 | @jtvaldivia | UI | Pokémon search in collection + reusable searchable dropdown | +288 / -64 |
| #166 | @wuzkkavin | Localization | Traditional Chinese (zh-TW) | +2217 / -23 |
| #161 | @aaronariasperez | Infra | Fewer Firestore writes (obsolete) | +13 / -6 |
| #160 | @s10200069 | Mobile fix | iOS home-screen app: move icons unreachable after rotation | +27 / -6 |
| #157 | @egrossetto | Gacha | Open without slot-machine animation | +42 / -9 |
| #148 | @sfhsu | Localization | Traditional Chinese | +2613 / -73 |
| #147 | @SonJorell | Controls | Full gamepad support, remapping, virtual cursor, rumble | +1485 / -72 |
| #146 | @Rampim | Mobile fix | iOS PWA viewport and touch alignment (broad) | +774 / -125 |
| #144 | @Ivankirito22 | Security | Validate other players' data, harden co-op | +2308 / -1698 |
| #143 | @ZeroTrace | UI/HUD | Stats in pause, level-card deltas, XP bar numbers | +99 / -5 |
| #142 | @ZeroTrace | UI/HUD | Buff icons with remaining-time rings + altar powers | +43 / -27 |
| #141 | @ZeroTrace | Controls | Small gamepad support with button remapping | +270 / -5 |
| #128 | @sennett-lau | Gameplay | Terastallization (Tera Orb, Tera Blast, Stellar) | +1037 / -60 |
| #124 | @Tiliko2803 | Mixed | Friend lookup fix + hidden "Challenges" mode + unrelated extras | +4158 / -1169 |
| #118 | @GuilleFF98 | Gameplay | In-run level-up evolution (Bulbasaur PoC) | +343 / -19 |
| #113 | @ElChusky | Controls | Touch joystick "follow finger" toggle | +13 / -6 |
| #108 | @Ayablack | Localization | Brazilian Portuguese (depends on #67) | +3290 / -21 |
| #107 | @eloy-garrido | **Game mode** | Kanto Stages & Gyms, Stage 1 (Brock) | +1432 / -48 |
| #102 | @joorgecamacho | Performance | Thermal/fill-rate optimizations, FPS cap | +119 / -38 |
| #101 | @eloy-garrido | Gameplay | Confirm before equipping the first item | +47 / -32 |
| #98 | @sennett-lau | Collection | Size variants XS–XL | +545 / -62 |
| #88 | @wheart22 | Localization | Simplified Chinese | +11580 / -141 |
| #82 | @mRuggi | Localization | Italian | +1301 / -61 |
| #75 | @sennett-lau | Collection | Female forms and female shinies | +582 / -213 |
| #74 | @DabaoHuang | Localization | Traditional Chinese (zh-Hant) | +3154 / -66 |
| #72 | @limcross | Co-op | Co-op "try again" with ready check (depends on #70) | +177 / -13 |
| #70 | @limcross | QoL | "Try again" after a run | +41 / -5 |
| #67 | @KamelAkar | Localization | French | +2042 / -19 |
| #64 | @username0239409j | Controls | Aim towards mouse cursor (PC) | +123 / -17 |
| #57 | @olivo28 | Gameplay | Stat growth per level, skip reward, GBA stat sheet | +1483 / -155 |
| #56 | @Yoyiyoniu | UI/HUD | Move tooltip on hover / long-press | +145 / -8 |
| #45 | @alvaroolt | Co-op fix | Shared-pause fixes (eternal "X is choosing") | +1584 / -172 |
| #36 | @Balhus | Gameplay | Auto-aim prioritizes nearby small chests | +18 / -7 |
| #19 | @IvanFreireDacoba | Controls | Gamepad, manual aim, Android handheld app | +2673 / -25 |
| #14 | @aggarcia42 | **Gameplay rework** | All moves at once, passives, fusions, elemental reactions | +13717 / -10080 |

---

## 1. Game modes

### #107 — Kanto Stages & Gyms (@eloy-garrido)
> **Ported (2026-10-16)** as Story mode, redesigned and with all 8 Kanto gyms: see `STORY_MODE.md`.

- **Play** opens a mode selector with two options: *Endless* (the current mode) and *Kanto Gyms*. Kanto Gyms lists 8 stages, each with its badge art, its leader portrait and its status (Play / COMPLETED / COMING SOON).
- **Stage 1 (Viridian Forest → Pewter Gym):**
  - Fixed 10-minute run with themed spawns (Route 1/Viridian Forest: Pidgey, Rattata, Caterpie, Weedle, Pikachu, Zubat…).
  - Three mini-bosses that each guarantee a Bond (fusion): Pidgeotto Alpha at 3:00, Beedrill Swarm at 6:00 and Butterfree Alpha at 8:40.
  - At 10:00 the player is teleported to Brock's rock arena: Brock's Geodude and Onix, a closed circular arena and no common spawns.
- **Rewards:** first clear gives a badge, 250 coins and 10 tickets. Repeat clears give 75 coins and 1 ticket. Saved in `save.stages` / `save.badges`.
- **Difficulty curve per stage:** density 0.30 (Brock) → 0.65 (Giovanni), enemy cap 36 → 64, softer surges, xpMul 1.6 in Stage 1. The hardest point (Giovanni at minute 10) is capped at about endless minute 7.
- **Isolation:** no ranking submission, no Arceus Judgment and no endless records.

### #124 — "Challenges" mode v0.1 (hidden inside the "friend lookup" PR, @Tiliko2803)
- **Play** offers *Normal game* or *Challenges*.
- **Extreme Survival:** solo, survive 600 s of *active* real time (pauses and card choices don't count) with enemy damage ×1.25.
  - Fails on death, quitting, disconnecting or leaving the page.
  - Auto-win at 600 s.
- Stores `save.challenges[id] = { bestTime, completedAt }` and merges them across devices without duplicating rewards. No ranking.
- The proposed 500-coin reward was left out until a server can validate it. That could now live in `server/`.
- The PR also bundles unrelated work: gift codes, a custom "Maomao" Pokémon, save transfer, Android migration docs and Firebase rules. Only take the challenge idea.

### #70 — Try again after a run (@limcross)
- **Try again** (gold, Enter) sits next to **Back to menu** (gray, Esc) on the results screen. Input is blocked for 0.6 s so held keys don't skip the screen.
- If an update is pending, Try again goes to the menu instead, so the updater rule still holds.
- Also shown after quitting from pause.

### #72 — Co-op try again (@limcross, depends on #70)
- Each player marks themselves ready ("Ready: 1/2 · waiting for X"). When everyone is ready, the host restarts with a new seed.
- Handles edge cases: guest leaves, host leaves, only one player left.
- Also fixes guests getting stuck on the results screen when the host starts a new game.

## 2. Combat & in-run gameplay

### #14 — All moves at once (@aggarcia42) — major rework
- **Vampire-Survivors style:** every known move fires on its own cooldown. The *focused* move hits 25% harder and sets the facing direction.
- **Move slots:** 4 by default, up to 6 with a shop upgrade.
- **Passives:** up to 4, each level 1–5 (Vigor, Power, Run, Reflexes, Armor, Synthesis, Magnet, Learning). They replace the stat cards, and evolutions require holding the matching passive.
- **Fusions:** each defeated legendary grants a fusion. There are 30 recipes covering all 60 moves, and fusing needs both moves at max level.
- **Elemental reactions:**
  - Steam (water on burn).
  - Shatter (rock/steel/fighting/ground on slow, ×1.6).
  - Detonation (fire on poison).
  - Conduction (electric on soaked).
  - Freeze (ice on soaked).
  - New statuses: Soaked and Frozen.
- **World:**
  - Water types swim (faster, regen, take more damage).
  - Flying types glide over liquids.
- **Balance:**
  - Enemy HP scales with the number of moves.
  - Gacha tickets are rarer, plus a new "Luck" upgrade.
- Includes a balance model (`tools/fusion-balance.js`) and 62 Node tests. Very large: it changes core combat balance.

### #128 — Terastallization (@sennett-lau)
- **Shop:** buy a Tera Orb per Pokémon (1000 coins). Change the Tera type for 300 coins (any of the 18 types).
- **In a run:**
  - From minute 2 a Tera crystal spawns. Stand next to it for 2 s to charge the orb, then press **T**.
  - The player stays terastallized until the run ends: +20% damage with Tera-type moves, and incoming damage uses the Tera type.
  - New **Tera Blast** move (Normal type that becomes the Tera type).
- **Stellar:** from minute 5 there is a 40% chance every 3 minutes of a crystal that gives a 15 s burst: +50% damage, +20% speed, −20% cooldown, −25% damage taken.
- **Art and co-op:** new pixel art (crowns for 18 types, transformation VFX, about 490 KB). Co-op sync uses a `tera` event that older clients ignore.

### #118 — In-run level-up evolution (@GuilleFF98)
- Evolves at levels 16 and 32 (Bulbasaur line as a proof of concept).
- 5.5 s cinematic with synthesized music.
- Each evolution adds a per-type passive bonus (for example +10% Grass damage, then +20% and +0.5 regen) and teaches an exclusive move if a slot is free.
- Driven by data in `evolutions.js`.

### #57 — Stat growth, skip reward, GBA stat sheet (@olivo28)
- Every level-up gives +1..3 to HP/Atk/Def/SpA/SpD/Spe and shows a summary banner.
- **Skip (+extra stats)** button (Space/O) when none of the offered rewards fits the build.
- Pause screen shows an Emerald / Mystery Dungeon style data sheet: animated sprite, types, item, stats with active buffs and EXP bar.

### #101 — Confirm the first item (@eloy-garrido)
- Instead of auto-equipping the first item, the game asks **Equip X** or **Stay without item**, because Choice Band and Life Orb have drawbacks.
- Pauses the game, including a shared hold in co-op.

### #64 — Aim towards the cursor (PC) (@username0239409j)
- New Settings option: *Auto* or *Toward cursor*.
- Directional attacks fire toward the mouse. Chain attacks need an enemy near the cursor, and meteors land near the cursor.
- Shows a crosshair reticle.

### #36 — Auto-aim prefers nearby small chests (@Balhus)
- Target priority: chest ≤60px > enemy touching you > chest ≤100px > boss/nearest enemy > rocks/grass.

## 3. Collection, progression & gacha

### #98 — Size variants XS–XL (@sennett-lau)
- **Stats:** sizes are a trade-off, not an upgrade. Small is faster, harder to hit and has less HP. Large has more HP and slightly more damage, but is slower and easier to hit. Everything comes from one table (`sizes.js`).
- **Wild sizes:** about every 5 minutes, one of the player's Pokémon appears in a size they're missing, with a blue or red aura. Defeating it unlocks that size.
  - Never inside rift arenas, never after minute 28, and legendaries are always M.
- **Collection:** XS–XL row, a counter, a partner size selector, achievements and the titles "Mini" and "Jumbo".

### #75 — Female forms & female shinies (@sennett-lau)
- **Cosmetic only.** The gacha and wild shinies roll ♂/♀ with official species ratios (12.5% female for Eevee, the starters and a few others).
- **Sprites:** 59 female and 58 female shiny forms (about 5.8 MB). The collection gets a ♂/♀ toggle.
- **Conflict:** clashes with #98 on the co-op payload and the `Player` arguments.

### #170 — All-regions gacha banner (@jtvaldivia)
- Joint banner with all 966 Pokémon and its own pity counter.
- Prices, rates and guarantees stay unchanged.

### #157 — Skip the gacha animation (@egrossetto)
- Toggle, remembered per device, that shows the cards right away instead of the slot machine.

## 4. UI / HUD / quality of life

- **#171 Damage meter "Recount"** (@emiramirez24):
  - Panel toggled with R: total damage, DPS and a row per move (solo) or per teammate (co-op).
  - Results screen gets a damage breakdown.
  - Burn and poison damage count for whoever applied them.
  - Cheap: one addition per hit.
- **#143 Stats in pause** (@ZeroTrace): current value of every stat and how many level cards were taken (`3/8`), with values per buff stack. Level cards show the change (`+23% → +31%`), and the XP bar shows numbers.
- **#142 Buff timers** (@ZeroTrace): circular icons with a ring that empties as time runs out (Swords Dance, Agility…). Altar powers use the same circle.
- **#56 Move tooltip** (@Yoyiyoniu): hover (or long-press on mobile) a skill-bar icon to see description, real damage and cooldown, and evolution requirements.
- **#169 Collection search + searchable dropdown** (@jtvaldivia): name search across all regions (ignores accents and case). All 7 dropdowns become one accessible component with search.

## 5. Controls & input

- **Gamepad: 3 competing PRs, pick one design.**
  - **#19** (@IvanFreireDacoba):
    - Movement and menu focus navigation.
    - **Right stick aims**, and holding the mouse button aims on PC.
    - Includes an Android WebView app for handheld consoles.
  - **#141** (@ZeroTrace): small, about 270 lines.
    - Maps buttons to the existing keys.
    - Menu navigation.
    - **Button remapping** in Settings.
    - Button names adapt to Xbox, PlayStation or Nintendo pads.
  - **#147** (@SonJorell): most complete.
    - Remapping.
    - Virtual cursor on the left stick.
    - Right-stick scrolling and tab switching.
    - D-pad navigation limited to the open window.
    - Rumble.
- **#113 Joystick "follow finger" toggle** (@ElChusky): setting to keep the touch joystick base fixed.
- **#146 / #160 iOS home-screen app viewport** (same bug, two fixes):
  - #160 is minimal: re-measure 100–1000 ms after a resize.
  - #146 is broad: one coordinate space, safe areas and touch lifecycle.

## 6. Co-op

- **#45 Shared-pause fixes** (@alvaroolt):
  - Eternal "X is choosing" hold when an item and a level-up arrive together.
  - Turn-based bonds after rifts.
  - Several other races.
  - New pure module `hold.js`.
- **#72** co-op try again (see §1).

## 7. Localization

French (#67), Brazilian Portuguese (#108, depends on #67), Italian (#82), Simplified Chinese (#88) and
Traditional Chinese three times (#74, #148, #166 are duplicates). All of them are built on the old
Spanish-source dictionary. This repo is now English-primary with `lang-es.js`, so each one would need
reworking to fit.

## 8. Performance, infra & security

- **#102 Thermal/perf** (@joorgecamacho):
  - Auto DPR by screen size: 1.0 on large screens, up to 1.5 on phones.
  - 30 FPS in menus and pause, and no rendering while the tab is hidden.
  - FPS cap setting.
  - Less garbage collection.
  - Reports GPU temperature dropping from 102 °C to 56 °C on a fanless Mac.
- **#144 Data validation & co-op hardening** (@Ivankirito22):
  - The Firestore rules are obsolete.
  - Still useful for `server/live.mjs` and the client:
    - sanitize other players' data before drawing it (`rowOf`, `cleanProfile`);
    - accept `start` only from the host;
    - validate damage sent by guests;
    - accept invites only from confirmed friends.
- **#161 Fewer Firestore writes**: obsolete (Firebase removed).
- **#124 Friend lookup fix**: Firebase-based, obsolete.

## Duplicates & dependencies

- **Gamepad:** #19, #141, #147
- **Traditional Chinese:** #74, #148, #166
- **iOS viewport:** #146, #160
- **Stats in pause:** #57, #143
- **Buff timers:** #57, #142
- **Dependencies:** #72 needs #70, and #108 needs #67.
- **Conflict:** #98 and #75 both change the co-op `ne` payload and the `Player` constructor arguments.

## Recommended shortlist for new gameplay & game modes

1. **#107 Stages/Gyms** gives a structured, ranking-free mode with a clear progression of badges and
   leaders. Pair it with the **#124 Challenges** idea, using rule changes like "enemy damage ×1.25"
   with server-validated rewards.
2. **#70 / #72 Try again**: cheap, and makes repeated runs much faster.
3. **#128 Tera**, **#118 in-run evolution**, **#98 sizes**: self-contained mechanics that add goals
   within a run and things to collect.
4. **#57 stat growth / skip reward** and **#101 first-item confirm**: small changes to run choices.
5. **#14 all moves at once**: best kept as a long-term reference for a combat rework. It is very
   large and rebalances everything.
