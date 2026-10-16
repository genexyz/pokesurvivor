# GDD — PokéSurvivor · Mystery Dungeon

> Living design document. It reflects the **current** state of the game; at the end
> there is a dated decision log.

## 1. Concept

- **Platform:** browser. Opens with a double click on `index.html`, no server needed.
- **Genre:** bullet-heaven / horde survival + **roguelike** + **character gacha**.
- **References:** Survivor.io, Megabonk, Vampire Survivors.
- **Look and feel:** **Pokémon Mystery Dungeon** (PMD sprites, blue dialogue
  boxes, pixel-art icons, village music).
- **The player is a Pokémon.** There are **966 Pokémon** from all 9 generations.
- **Everything is local:** sprites, data, font, music and saves. The game makes no
  requests to the internet.
- **Language:** the game starts in the browser's language (Spanish for Spanish
  browsers, English otherwise) and can be switched in Settings.

## 2. Screen flow

```
Login / Create account / Guest
        │
        ├─ (first time) Personality quiz ─> Assigned partner
        │                                     ├─ Let's go together!
        │                                     └─ Choose another (29 starters)
        ▼
Main menu  (the world in the background, with wild Pokémon wandering around)
   ├─ Play       → run → summary (+ Pokécoins, shinies obtained) → menu
   ├─ Pokémon    → collection by region, choose partner (normal or shiny)
   ├─ Upgrades   → permanent upgrades
   ├─ Gacha      → 9 banners, one per region
   ├─ Friends    → add by nickname, online, invite → Lobby (up to 4) → group run
   └─ Leaderboard → time survived: Solo / Group × day, week, month, year, all-time
```

### 2.3 Co-op multiplayer (up to 4)

- **Friends by nickname.** Username-and-password accounts use their username;
  Google accounts pick a unique nickname (their real name is never shown).
- **Lobby:** whoever invites is the host; online friends get the
  invitation in the menu. The host starts the run for everyone.
- **Connection:** direct between browsers (WebRTC, star topology around the host);
  if the network does not allow it, through the Realtime Database (slower, but it works).
- **Who is in charge:** the host runs enemies, items, experience and the clock;
  each player runs their own Pokémon (position, HP, attacks). Hits on enemies are
  sent to the host; teammates' attacks are shown as "ghosts".
- **Shared experience**; on level-up each player picks their card and the
  game **does not resume until everyone has picked**.
- **Going down:** you stay on the ground; a teammate standing next to you for 3 s
  revives you with half HP. The run ends when all of you are down.
- **Arrows** at the edge of the screen point to teammates who are off-screen
  (name and meters; red if they are down).
- Difficulty: ×(1 + 0.75·(n−1)) enemies and ×(1 + 0.3·(n−1)) HP; the
  team's experience is divided by (1 + 0.6·(n−1)).
- Pausing does not stop the game; if the host leaves, the run ends for everyone.

### 2.4 Leaderboard

- Time survived. **Solo / Group** tabs; **daily, weekly, monthly, yearly and
  all-time** periods (Spain time); **everyone or friends only**;
  **filter by Pokémon**; your rank shown at the bottom even if you are not in the top 50.
- One entry per player (or team) and table, only if it improves. In group mode the
  whole team appears in the same row (the host submits it).
- Basic anti-cheat: at the start the server time is recorded and the rules
  do not accept a time longer than the real elapsed time.

### 2.1 Accounts

- Sign in, create an account or **play as a guest** (nothing is saved).
- Provisional, in `localStorage` behind `js/core/db.js`. Passwords salted +
  SHA-256, but it is local: not real security.
- The session is remembered when the game is reopened.

### 2.2 Personality quiz

- 8 Mystery Dungeon-style questions; each answer adds trait points.
- The dominant trait picks the partner among the **29 starters**: starters from
  the 9 generations + Psyduck + Slowpoke. It can be declined to choose another.

## 3. Combat

- The Pokémon **attacks on its own** with the **active move** (1 of up to 4).
- Switch the active move with `1`–`4` or `Q`/`E`. Move: `WASD` / arrows. Pause: `Esc`.
- Each attack plays the matching **PMD animation**: `Attack`, `Shoot` or `Charge`.
- **Targeting:** whatever is touching you > the boss if in range > the nearest
  enemy > (no enemies) the nearest rock or chest.
- **52 moves** in 7 families (projectile, melee, beam, orbs,
  nova, aura, booster), 5 levels each. They cover the **18 types**.
- Each Pokémon's pool comes from its types + the common normal pool.
- Boosters deal no damage: you switch to one, stack it, and switch back to an attack.
  No more than 2 are ever offered.
- On level-up: **1 of 3 cards**.

## 4. World

An open, infinite arena, generated with deterministic noise and painted in pixel art
from code (16 px per tile, ×2).

| Element              | Effect                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rock formations      | Block walkers and projectiles                                                                                       |
| Water                | Slows down (×0.6 player, ×0.55 enemies)                                                                             |
| Lava (volcano biome) | Burns whoever steps on it — enemies can be lured onto it                                                            |
| Trees / crystals     | Block; give cover from enemy shots                                                                                  |
| Rocks                | Breakable; drop XP, coins or berries                                                                                |
| Chests               | Breakable; good coin loot                                                                                           |
| Tall grass           | Cut by any attack; sometimes drops something                                                                        |
| **Power altar**      | On touch, 25 s of Fury (damage ×2), Lightning (+45% speed), Magnet (×4) or Haste (−40% cooldown); then it goes dark |
| **Spring**           | Heals while you stand on it; runs dry and refills on its own in ~45 s                                               |
| **Locked chest**     | Stay next to it for 3.5 s (even while attacked): coins, 1-3 tickets (15% a ×10) and enough XP for one level         |
| **Traps**            | Poison, sticky (slows you) or explosive; triggered when stepped on, enemies included                                |
| **Rift**             | Rare (every 30 s, 14% from minute 1:15; lasts 45 s). Takes you to a legendary's arena                               |

- **Flyers, ghosts and bosses** ignore terrain.
- **3 biomes** that rotate every 4 minutes, each with its own music:
  Shady Forest, Crystal Cave, Ash Volcano. The change is a 2.6 s **crossfade**
  between the old and new palette (ground and objects).
- **Rift → arena:** a closed round area in the _Distortion Rift_ biome,
  against a **legendary** (2 min). Win: extra ×10 ticket, 3 tickets and
  coins, and you return where you were. Lose (everyone down or time runs out):
  you return with no reward and 30% HP. Meanwhile, the enemies on the map wait.

### 4.0 Rift arenas (one per type)

The legendary waits for you in the arena of **one of its two types, at random**. Each
arena has its own palette, decoration, terrain and weather, and plays its own
theme ("rift"). The legendary collides with walls and columns like you and cannot
leave the circle.

| Type     | Arena            | Terrain                    | Weather   |
| -------- | ---------------- | -------------------------- | --------- |
| Normal   | Eternal Meadow   | columns                    | —         |
| Fire     | Igneous Volcano  | lava rivers (burn)         | sun       |
| Water    | Sea Grotto       | puddles (slow)             | rain      |
| Grass    | Emerald Jungle   | swamp (slows a lot), trees | —         |
| Electric | Volt Plant       | electrified puddles        | rain      |
| Ice      | Eternal Glacier  | ice sheets (you slide)     | snow      |
| Fighting | Ancient Dojo     | many columns               | —         |
| Poison   | Toxic Swamp      | poison puddles             | —         |
| Ground   | Red Desert       | quicksand                  | sandstorm |
| Flying   | Sky Peak         | cloud trees                | —         |
| Psychic  | Mind Temple      | pink crystals, columns     | —         |
| Bug      | Hive Forest      | swamp, lots of grass       | —         |
| Rock     | Ancient Quarry   | many columns and rocks     | sandstorm |
| Ghost    | Gloomy Graveyard | dead trees                 | fog       |
| Dragon   | Dragon Sanctuary | draconic flames (burn)     | —         |
| Dark     | Dark Alley       | columns                    | —         |
| Steel    | Steel Fortress   | many columns               | —         |
| Fairy    | Enchanted Forest | pink trees, fountains      | —         |

Terrain immunities: Fire to lava, Poison/Steel to poison,
Electric/Ground to electrified puddles, Ice to ice. The legendary is not affected by its own arena.

### 4.1 Weather (rare event)

From minute 2, each minute there is an 18% chance of weather arriving (~1 minute):

| Weather        | Effect                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| Harsh sunlight | Fire ×1.5 · Water ×0.5                                                    |
| Rain           | Water ×1.5 · Electric ×1.2 · Fire ×0.5                                    |
| Sandstorm      | Rock, Ground and Steel ×1.3; the rest lose 1.2% HP every 2 s (never a KO) |
| Snowfall       | Ice ×1.5; the rest lose HP the same way and are 10% slower                |
| Fog            | Ghost, Fairy and Psychic ×1.3; the vignette closes in a bit               |

It affects everyone (you and the enemies). Each biome favors certain weathers. The visuals
are subtle: a light tint and few pixel particles. In group mode the host decides it.

### 4.2 Type chart (softened)

The one from the games, but ×1.6 / ×0.6 / ×0.3 instead of ×2 / ×0.5 / ×0 (with a
single active attack, a full immunity would make some enemies impossible). Two
types multiply, capped at ×0.3–×2.4. Your attacks use the move's type;
enemies use their main type (or their shot's type). Yellow number when it is super
effective; grey when not very effective (no text, to keep the screen clean).

## 5. Enemies

- **From every generation.** 6 tiers by base stat total; each run
  draws a cast of 7 Pokémon per tier, so every run is different.
- AI by type: chase, telegraphed charge (`Charge` → `Attack`),
  ranged shooting or tank.
- **5 bosses** (min. 3, 6, 9, 12, 15): strong **non-legendary** Pokémon
  (pseudo-legendaries, Slaking...) at random, each stronger than the last; each one drops
  a **×10 ticket**. Legendaries only appear in rifts. During a boss fight waves drop to 25%,
  there are no swarms and the boss theme plays.
- Swarms every ~45 s. Cap of **280** enemies at once; once the cap is reached, those
  that keep spawning are elites (×1.6 HP and experience, ×1.25 damage).
- **Pathfinding:** a distance field (BFS) around each player; walkers go around
  rocks, walls and dangerous puddles. Only those that **float in their sprite**
  fly over (`hv` in sprites-meta, scripts/hover_flags.py):
  Rowlet or Pidgey walk even though they are Flying; Gastly or Zubat float.

### 5.1 Personalities

In each run, each enemy tier brings at least 2 with a personality (1 in the
first, to ease you in). "Telegraphed" attacks are shown on the ground beforehand.

| Personality | Who                                       | What it does                             |
| ----------- | ----------------------------------------- | ---------------------------------------- |
| Healer      | Chansey, Blissey, Audino, Clefairy...     | Heals those around it 15% every 3.5 s    |
| Shield      | Shuckle, Bronzong, Mr. Mime, Bastiodon... | Shield worth 35% HP on 6 allies          |
| Summoner    | Nidoqueen, Vespiquen, Golbat, Gyarados... | Calls 2 of its pack (Nidoran, Combee...) |
| Kamikaze    | Voltorb, Electrode, Koffing, Geodude...   | Closes in and explodes (1 s warning)     |
| Beam        | Electric, Psychic, Dragon, Ice (some)     | Beam with a warning strip                |
| Zones       | Fire, Ground, Poison (some)               | Circles under your feet that explode     |
| Fan         | Water, Grass, Bug, Fairy (some)           | 3 shots in a fan (5 later on)            |
| Jumper      | Fighting, Ground, Normal, Rock (some)     | Jumps and lands where you were           |

## 6. Shinies

- **Wild:** every enemy has a **1/4096** chance of being shiny (bosses too).
  It sparkles, has double HP, gives ×5 experience, does not despawn when you move
  away, and an arrow at the edge of the screen shows you where it is.
  **If you defeat it, you keep it** (and the normal version if you did not have it). If you
  already had that shiny, +300 coins.
- **Gacha:** 1 in 100 pulls is shiny. Duplicate shiny = triple coins.
- **Collection:** on the page of a Pokémon whose shiny you own there is a
  **Normal / Shiny** selector; you pick your partner in the version you want.
- 958 of the 966 Pokémon have a genuine shiny sprite from SpriteCollab.

## 7. Progression

### 7.1 Pokécoins

At the end of a run: `time/5 + defeated/4 + 80 per boss + coins collected`,
multiplied by the Fortune upgrade. New account: 500 as a gift.

Coins are for **upgrades**; the gacha uses tickets.

### 7.2 Permanent upgrades — per Pokémon

Vitality, Strength, Stride, Reflexes, Armor, Synthesis, Magnet, Wisdom, Fortune
and **Repertoire (start with 2 moves)**. Each Pokémon has its own and they
only count when you play with it (the Upgrades screen lets you pick which one).
Those bought back when they belonged to the account went to the partner at that time.

### 7.2a Held items (one per run)

Leftovers, Choice Band, Quick Claw, Focus Sash, Shell Bell, Amulet Coin, Lucky Egg,
Life Orb, Choice Scarf, Rocky Helmet and Assault Vest. **Every boss** drops one,
locked chests 50% of the time and sometimes normal chests (8%). If you already
hold one, you choose (in solo the game pauses).

### 7.2c Move evolution

A move at max level evolves if during that run you took its condition upgrade
(Ember + Power → Fire Blast, Bubble + Sprint → Surf...): a **golden card**
appears (always, once it is ready). All 47 attack moves evolve.

### 7.2d Missions, achievements and profile

- **3 daily + 2 weekly** (rewards in tickets and coins); one daily can be
  rerolled per day. Same missions on any computer (seed per account).
- **Achievements** with a medal (bronze, silver, gold), a reward and sometimes a **title**;
  one for each **legendary** defeated in a rift.
- **Public profile** (from the leaderboard or the friends list): 3 favorites,
  title, best records and the 8 best medals.

### 7.2b Gacha tickets

- **Ticket** (×1): each defeated Pokémon has a 1/400 chance to drop one; locked
  chests give 1-3.
- **×10 ticket**: bosses, the rift legendary (2) and, sometimes, locked
  chests.
- In group mode tickets belong to the team: everyone gets the ones that are picked up.

### 7.3 Gacha — one banner per region

Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar and Paldea, each with
**its own Pokémon, its 3 featured ones and its own pity**.

| Rarity    | Chance            | Duplicate refund |
| --------- | ----------------- | ---------------- |
| Common    | 45%               | 15               |
| Uncommon  | 30%               | 30               |
| Rare      | 17%               | 60               |
| Epic      | 6.5%              | 120              |
| Legendary | 1.5%              | 300              |
| _Shiny_   | _1% (any rarity)_ | _×3_             |

- ×1 pull: 1 ticket · ×10: **10 normal tickets or 1 ×10 ticket** (two buttons,
  you choose how to pay), with **at least one Epic** guaranteed. Duplicates still give coins.
- **Animation: pixel-art slot machine** (lever, 3 reels, light bulbs). The
  symbols are the rarity: Poké, Great, Ultra, Luxury and Master Ball
  (Legendary) and the red star (shiny); with Epic or better the last reel keeps
  you waiting. The ×10 is 10 quick pulls that drop into the tray. Click = speed up.
- **Pity:** after 70 pulls without a Legendary on a banner, the next one is.
- Some regions have almost empty rarities (Galar only has 4 Uncommons);
  if a rarity has no Pokémon on that banner, the nearest one is used.

## 8. Music and sound

Composed for the game and played by a Web Audio synthesizer (flute, marimba,
plucked guitar, bass, pad, lead and drums, with reverb). Zero audio files.

| Theme   | Where         | Style                                          |
| ------- | ------------- | ---------------------------------------------- |
| Village | Menus         | F major, 100 bpm with swing, flute and marimba |
| Forest  | Run (forest)  | Adventurous D minor, 122 bpm                   |
| Cave    | Run (cave)    | Mysterious A minor, 92 bpm, little bells       |
| Volcano | Run (volcano) | Tense E Phrygian, 132 bpm                      |
| Boss    | Boss fight    | Intense E minor, 150 bpm                       |

- Effects for buttons, each attack family (pitched by type),
  hits, falls, experience (pitch rises on a streak), coins, level-up, boss,
  shiny, breaking objects, gacha (drop, shakes, burst by rarity).
- Music and effects volume and a mute button in the top bar and in the
  pause menu; remembered in the browser.
- Measured: all 5 themes at the same level (RMS 0.075–0.09), no clipping even with boss + combat.

## 9. Interface

- **No emojis.** Pixel-art icons drawn in code (`js/ui/icons.js`):
  each move carries its **type emblem** (18) + a **family
  badge**; plus heart, glove, boot, clock, shield, sprout, magnet, book,
  coin, cards, berry, bomb, star, shiny sparkle, crown, Poké Ball…
- Always at integer multiples of their resolution, so pixels stay crisp.

## 10. Technical

- Vanilla HTML + CSS + JavaScript (ES modules) on Canvas 2D, no framework. Vite serves it in dev and bundles it for publishing.
- **Sprites:** [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), 966
  Pokémon × 7 animations × 8 directions, normal and shiny, in `assets/pokemon/`
  (76 MB, lossless palette PNG). **CC BY-NC 4.0: non-commercial use and
  attribution** (114 artists in `CREDITS.md`).
- **Data:** stats and Spanish names downloaded **once** from PokeAPI.
- **Font:** Pixelify Sans (OFL).
- Generated files are rebuilt with the scripts in `scripts/` (`npm run data:*`).
- **Language:** the code is in English; Spanish is a UI translation
  (`js/data/lang-es.js`) picked from the browser language or in Settings.

## 11. To do

- [ ] Type effectiveness in damage
- [ ] Custom graphics for projectiles (currently colored orbs)
- [ ] Per-Pokémon moves (currently they come from their types)
- [ ] Touch controls / gamepad
- [ ] 59 Pokémon without a sprite in SpriteCollab (mostly gens 5, 8 and 9)

---

## Decision log

**2026-10-07 · first version**

- Vanilla stack + Canvas. 1 active move, switched with 1–4. Combat first.

**2026-10-07 · second version**

- Everything local: no runtime API.
- Mystery Dungeon sprites (SpriteCollab) with attack animations.
- Tiles painted in code (PMD's only exist by ripping the ROM).
- Map: **open arena with obstacles** (not PMD's strict rooms and corridors).
- Saves: `localStorage` behind a single data layer.

**2026-10-07 · third version**

- **All generations** (966 with sprites). Gacha: **one banner per region**.
- **Shinies:** 1/4096 in the wild, 1/100 in the gacha; the partner is chosen in its
  normal or shiny version from the collection.
- **Music composed in code** (Nintendo's cannot be used) + effects.
- **No more emojis**: custom pixel-art icons.

**2026-10-07 · combat fix**

- Bug: projectiles spawned at the Pokémon's edge and moved up to 8 units
  per frame, so **enemies hugging the player were immune** to every
  projectile move (in a survivor game, there is almost always one hugging you).
  Now they spawn at the center and collision is swept (the whole segment of the frame).
  In the 10-min simulation it went from 0 to 1 boss defeated per run.
- Demo videos in `videos/` (boss, wild shiny, shiny in the gacha).

**2026-10-07 · effects and visual touches**

- **Pixel-art sprite attacks** (`js/entities/vfx.js`): 23 shapes (flame,
  drop, bubble, leaf, bolt, crystal, rock, mud, stinger, star, wind,
  web, wave, crescent, sound, impact, slash, jaws, arrow,
  sphere, shadow ball, heart...) painted with each type's palette and with
  an outline like the PMD sprites. Beams as jets (flames, water, electric
  zigzag, crystals), strikes as a pixelated crescent with extras (jaws,
  slash, impact, leaves/feathers), auras and boosters with type
  particles, trails (embers, drops, poison bubbles, dust...). Enemy
  shots use the enemy's type and have a red ring on the ground.
- **Same pixel size across the whole interface** (×2): large legendaries
  looked like a different style because they were drawn at ×1. Bosses, in multiples of 0.5.
- **Shiny:** a pixel-art gem as the mark and animated pixel sparkles.
- **Menu partner:** dark frame with a border in its type's color.
- **Targeting:** ranged attacks prioritize the boss; melee ones,
  whatever is hugging you.

**2026-10-07 · database and publishing**

- **Cloud saves** on our own server (`server/`: Node + Postgres) with Google-only
  accounts (better-auth). Local copy for playing offline and a **merge** on
  sync (collections combined, maximums for upgrades/stats, coins and partner
  from the most recent version; the same merge runs on the server).
- With no configuration, or opened with a double click, it stays in local mode.
- **Legal notice and privacy** with a button to delete the account.
- Measures NOT applied unless requested: renaming without "Pokémon" and removing
  the sprites ripped from the games (the CHUNSOFT ones).

**2026-10-08 · new name**

- The game is renamed **PokéSurvivor** (no "Pokémon" in the name, like
  PokéRogue or Showdown). Repository: `pokesurvivor`.

**2026-10-09 · mobile and settings**

- **Playable on phone and tablet, in landscape** (in portrait a "Turn your
  phone" message appears and the run pauses). **Floating joystick**: it appears where you put
  your finger. Attack icons are tapped to switch (on PC also by clicking) and
  there is a pause button. When switching apps, the run pauses on its own.
- The camera guarantees a minimum world height on very wide screens.
- Compact interface on short screens (two-column menu, small top bar,
  the credits line moves to Settings → About).
- **Settings** (PC and mobile): sound; graphics (quality Auto/High/Medium/Low,
  damage numbers, less shake and flashing, FPS, fullscreen);
  controls (joystick size, keys); account (fixed nickname, cloud, sign
  out, delete); about (version, credits, legal notice).
- **Automatic quality**: lowers effects if the game runs under 45 FPS.
- **Installable as an app** (PWA: icon, fullscreen, opens offline).
- Fixes: the extra orb of orbit moves when upgrading them; sound
  that would not start on mobile; summoners respect the enemy cap;
  a clear notice if a game file fails to load.

**2026-10-09 · fewer but stronger enemies**

- Fewer Pokémon on screen but stronger (×0.45 count, ×2.1 HP,
  ×1.35 damage, ×2.6 experience) and no "Super effective!" texts.

**2026-10-08 · multiplayer, friends and leaderboard**

- **Co-op up to 4** with a **friends list** (no lobby codes or public
  lobbies). Shared experience and **cards that wait for everyone**; a downed player
  is **revived** by standing next to them.
- **Direct WebRTC** connection between browsers (Google's free STUN); lobbies,
  invitations, online friends and signaling go through our server's `/ws`
  WebSocket (`server/live.mjs`). No paid TURN.
- **Unique nickname** for friends and leaderboard; Google accounts pick it when
  signing in (privacy: their real name is not shown).
- **Time-survived leaderboard**: Solo / Group, daily to all-time, friends,
  per Pokémon, your rank. The group appears in full in one row.
- Privacy notice: in group mode browsers connect directly and
  can see each other's IP (like in a video call).

**2026-10-08 · per-Pokémon upgrades, tickets, rifts and interactables**

- **Upgrades per Pokémon** (not per account); those already bought go to the
  current partner. Coins are now only for upgrades.
- **Gacha with tickets** earned by playing (no starting gift or coin
  conversion): ×1 from normal Pokémon (1/260), ×10 from legendaries (always) and bosses (1 in 3).
- **Casual non-legendary bosses**; legendaries, only in **rifts**
  (separate arena; losing sends you back with no reward). In group mode you all travel.
- **Altars, springs, locked chests and traps**, in custom pixel art.
- **Crossfade** between biomes instead of the abrupt switch.
- Pokédex: `leg` field (legendary or mythical) from PokeAPI.

**2026-10-08 · weather, type chart and slot machine**

- **Weather** as a rare event (sun, rain, sandstorm, snow, fog), subtle visuals.
- **Softened type chart** in both directions.
- Gacha with a **pixel-art slot machine** instead of the Poké Ball.

**2026-10-08 · arenas per type**

- Bug: legendaries (bosses = flyers) went through the arena's rocks and
  could not be shot (Celebi). Now they collide and do not leave the circle.
- 18 rift arenas, one per type, with terrain that has effects and their own weather;
  new music theme for the rift.

**2026-10-08 · more Pokémon-like icons**

- Shiny: **red star** with a sparkle (like the shiny mark in the games),
  instead of the gem.
- Rarity: no more stars; each rarity is its own **Poké Ball** — Poké (Common),
  Great (Uncommon), Ultra (Rare), Luxury (Epic) and **Master (Legendary)**.

**2026-10-08 · camera, performance and AI**

- Camera 20% further out (768 world width instead of 640).
- Performance: the hit flash used `ctx.filter` (×95 more expensive than a
  precomputed white silhouette, which is what is used now); cap of 70 damage
  numbers; internal resolution ×1.5 at most; less off-screen work;
  cap of 280 enemies with elites once the cap is reached.
- Enemies go around obstacles; only those that float in their sprite fly.

**2026-10-08 · missions, achievements, items, evolutions and enemies with personality**

- 3+2 missions, achievements with reward and title, public profile (visible to all).
- Held items, single use per run (chests and bosses).
- Move evolution: max level + condition, golden card.
- Enemies with personality: healers, shields, summoners and telegraphed
  attacks (beams, zones, kamikazes, fan, jumps). Tuned with an
  autopilot: average survival is similar to before (89 s vs 60 s).

**2026-10-10 · last details before the website**

- Water-type Pokémon are not slowed in water or swamp.
- Leveling up is half as fast (experience per level ×2).
- Fewer enemies at once (cap 64) but much tougher. Those left
  behind while you run fade out and respawn ahead, so no
  tail forms behind you and you cannot simply run away. One "runner" per tier
  (fast and fragile, heads to where you are going to be).
- Bosses and legendaries with 4 telegraphed attacks (stomp, charge or jump, and two
  ranged ones by type: rain of zones, beams in a fan, ring or fan
  of shots). They alternate between coming at you and fighting from range, and below
  half HP they enrage. More HP (×1.35) and damage (×1.2).
- Rifts: a big pulsing arrow, with distance and time, and its own notice when
  opening.
- "Press to start" screen (the browser does not allow sound before any interaction) and
  music also on the sign-in screen and the personality questions.
- 8 new attack patterns using the same graphics: boomerang, chain, mines,
  meteors, turret, charge, trail and short fan. 7 moves switch to
  them (same id) and there are 12 new ones (64 in total).
- Anti-cheat: the server rejects level and defeated counts that are impossible for the
  time; the game watches clock, HP, speed, attack, level, coins and the
  testing tools. If something does not add up, the run does not count for the
  leaderboard or records.
- Mid-run events every 4-5 min (systems/events.js): single-type horde
  (30 s), golden hour (30 s, double experience and coins) and lost Pokémon
  (you escort it to the marker; healing, coins, a ticket, and 1 in 5 joins you).
  Treasure goblins 1-2 per run: Meowth (coins) or Gholdengo (×10 ticket;
  Gimmighoul has no sprite). They flee and escape after 15 s. In group mode, everything
  is shared.
- Later (10-10): leveling up half as fast again (experience
  per level ×4 compared to the original) and rarer ×1 tickets (1/400 instead of 1/260).
  Level missions at 8/12/15 and level achievements at 15 and 30 (previously 12/16/20, 20 and 40).
