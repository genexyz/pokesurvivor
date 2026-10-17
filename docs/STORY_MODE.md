# Story mode

Story mode is a run of fixed length through themed routes, ending in a gym battle. It is a port and
redesign of upstream PR #107 ("Kanto Stages & Gyms", see `COMMUNITY_SUGGESTIONS.md`). All nine
regions are playable: 72 stages, 8 per region, each ending against that region's gym leader (Alola:
its island trials, against Captains and Kahunas, for Z-Crystals).

## How a stage plays

| Stage time         | What happens                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 → 10:00       | Three **legs** (routes). Each leg has its own biome palette, music and wild Pokémon. Only the current leg's Pokémon spawn.                                                                                  |
| 2:30 · 5:30 · 8:30 | **Mini-bosses** (e.g. Pidgeotto, Beedrill, Butterfree). Each one drops a held item and grants a **bond**, so you can fuse moves before the gym.                                                             |
| 9:30               | "Pewter Gym is just ahead!"                                                                                                                                                                                 |
| 9:57               | Every pickup on the map flies to you, so no XP is left behind.                                                                                                                                              |
| 10:00              | You travel to a closed **gym arena** of the leader's type. The camera shows the leader at the back of the arena, who sends out the team in **waves**, at most 2 at a time, with a short lull between waves. |
| Win                | A few seconds to grab drops, then the summary. You get the badge, coins and tickets, and **Next stage** / **Try again** buttons.                                                                            |

There are no rifts, events or Arceus's Judgment in Story mode. The HUD clock counts down to the gym
and shows a progress line with a tick for each mini-boss. In the gym, the HUD shows the leader and up
to two boss bars.

## Difficulty: one number per stage

Each stage has a `pace`. At stage second `t`, enemies, spawn rate, swarms and bosses are those of
**endless second `pace × t / 600`**, so the gym is fought at endless second `pace`. Inside a region
the pace goes 180 → 600 (+60 per stage), and each region after Kanto adds 30: Johto 210 → 630 …
Paldea 420 → 840. Every region's first stage is open, so you can start wherever you like; later
regions are simply a bit harder and pay a bit more.

Kanto, for example:

| Stage | Route                                                | Leader    | Badge   | pace |
| ----- | ---------------------------------------------------- | --------- | ------- | ---- |
| 1     | Route 1 · Viridian Forest · Route 2                  | Brock     | Boulder | 180  |
| 2     | Route 3 · Mt. Moon · Nugget Bridge                   | Misty     | Cascade | 240  |
| 3     | Route 6 · Diglett's Cave · S.S. Anne                 | Lt. Surge | Thunder | 300  |
| 4     | Route 9 · Rock Tunnel · Route 7                      | Erika     | Rainbow | 360  |
| 5     | Cycling Road · Safari Zone · Fuchsia City            | Koga      | Soul    | 420  |
| 6     | Pokémon Tower · Silph Co. · Saffron City             | Sabrina   | Marsh   | 480  |
| 7     | Seafoam Islands · Pokémon Mansion · Cinnabar Volcano | Blaine    | Volcano | 540  |
| 8     | Route 23 · Victory Road · Viridian City              | Giovanni  | Earth   | 600  |

A slow pace (Brock) gives you 10 minutes to level up against enemies that only reach endless
minute 3. Giovanni is exactly endless minute 10. Mini-boss and gym stats come from endless's boss
curve at the same equivalent second (`Enemies.bossAt`). No combat numbers are written in the stage
data. All tuning is in `Balance.story`, which you can edit live from the `?dev` panel.

Reward per clear also comes from the pace (`Balance.story.reward`):

- first clear: 450 coins and 6 tickets (Brock) up to 1,500 coins and 20 tickets (Giovanni); Paldea's
  last gym gives 2,100 coins and 28 tickets
- each repeat: about a quarter of that

## Rules

- Stages unlock in order inside a region: stage N needs stage N-1 cleared. Every region is open.
- Solo only for now. Co-op runs always play Endless.
- Story runs are not ranked and don't change endless records (`bestTime`). Kills, levels, missions
  and achievements still count.
- New achievements in a "Story" category: First badge, Halfway there (4 Kanto badges), a champion
  title for each region (all 8 of its badges), and Pokémon Master (all 72).

## Code map

| File                                 | Role                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/js/data/stages.js`              | `Stages`: 9 regions × 8 stages, written by Pokémon name (`S(...)`, legs, minis, gym waves), pace, unlock and badge helpers               |
| `scripts/check_stages.js`            | Checks every name, route, wave and leader sprite (`npm run check:stages`; `npm run build` runs it first)                                 |
| `src/js/systems/story.js`            | `Story`: the run. Leg changes, mini-boss bonds, gym travel and waves, win, `finish()` (save + reward), HUD info                          |
| `src/js/data/balance.js`             | `Balance.story`: duration, cap, gym HP, timings, rewards                                                                                 |
| `src/js/data/enemies.js`             | `rollStory` (leg casts + minis), `bossAt` (boss curve at any second), `bossDef`                                                          |
| `src/js/systems/spawner.js`          | Scales everything by `Story.eq(t)` and pauses spawns during the gym                                                                      |
| `src/js/game.js`                     | `startRun(coop, stageId)`, `winStory()`, story-aware `endRun`, `Flow.play(id)` and `Flow.replay(id)`                                     |
| `src/js/ui/play-ui.js`               | The **Play screen**: one tab per game mode (`MODES`) and the Story region tabs                                                           |
| `src/js/ui/hud.js`                   | Countdown, route name, progress line, two boss bars                                                                                      |
| `src/js/ui/run-ui.js`                | Summary banner (badge and reward, or how far you got), Next / Try again                                                                  |
| `src/js/ui/icons.js`                 | Badges `'badge:<stage id>'`: Kanto's 8 hand-drawn, the rest generated from a pixel shape per type in the type's colors                   |
| `public/assets/trainers/<region>/`   | Official leader sprites for Kanto, Johto, Hoenn, Sinnoh and Unova, named after the leader in lowercase letters only (`Stages.leaderArt`) |
| `src/js/core/db.js`, `save-merge.js` | `save.story[id] = { at, clears, best }`. A merge keeps the first date, the most clears and the best time from each device                |

## Differences from PR #107

- **Play menu:** a Play screen with **a tab per game mode** (Endless, Story; new modes are one entry
  in `MODES`), and region tabs inside Story. The PR used a single modal with an accordion.
- **Stages:** all 8 Kanto stages are playable and unlock in order. The PR had only stage 1, and the
  others were "coming soon" with no ordering.
- **Engine:** a data-driven stage engine (any number of waves, any region) replaces Brock-specific
  code (fixed offsets, fixed 2-boss check).
- **Difficulty:** one `pace` per stage, mapped onto the existing endless curves. The PR used separate
  hand-made formulas spread across 5 files (`hpMul`, `dmgMul`, `xpMul`, `densityMul`, `surgeMul`,
  `cap`, and special cases in the spawner).
- **Legs:** routes swap biome, music and roster, with an on-screen notice. In the PR, earlier tiers
  kept spawning and the biome never changed.
- **Mini-boss bonds:** go through the normal bond flow (`pl.bonds`). The PR used `setTimeout` and a
  forced `offerBond()`.
- **Pickups before the gym:** they are pulled to you before you travel. In the PR they were lost in
  the stash.
- **Saves:** clears are merged across devices (the cloud and ledger rules). In the PR, `save.stages`
  and `save.badges` would have been overwritten by the newer device.
- **Art:** badges are drawn in the game's own pixel-icon system. Leaders use the FireRed/LeafGreen
  trainer sprites from Smogon's sprite repository (`public/assets/trainers/<region>/`, credited in
  `CREDITS.md`), shown next to their ace on the stage cards, standing in the gym arena and on the
  summary. The PR shipped badge and "VS" leader PNGs from a fan wiki.
- **New:** best clear time per stage, Next stage and Try again on the summary (back to the menu
  instead if an update is waiting, which keeps the updater rule), Story achievements, and Spanish
  translations.

## Next steps

1. **Playtest balance.** `pace`, `Balance.story.gym.hp` and the reward curve are first guesses. Tune
   them live with `?dev` (Balance panel), then edit `balance.js`.
2. **Leader art for Kalos, Alola, Galar and Paldea.** No official sprites in Smogon's repository:
   its Kalos/Alola ones are fan-made ("noncanonical"), and PokeRogue's asset repository has every
   Galar/Paldea leader but as unlicensed community art. Ask those artists for permission (and credit
   them), or commission originals, then drop them in `public/assets/trainers/<region>/` and set
   `art: true` on the region.
3. **Elite Four and Champion** stage per region (5 waves), unlocked by the 8 badges.
4. **Co-op Story:** the gym is local-only today. It would need host-driven `story` sync messages
   like `rift.js` (`'gym'` cfg, `'gw'` wave, `'gwin'`).
5. **More modes on the Play screen:** for example the "Challenges" idea from #124 (rule modifiers
   such as enemy damage ×1.25, rewards validated by `server/`). Each is one `MODES` entry.
