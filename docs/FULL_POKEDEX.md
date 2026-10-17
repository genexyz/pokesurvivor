# Completing the Pokédex (966 → 1025)

The game has 966 of the 1025 Pokémon. The other 59 are left out on purpose: the data scripts only take
a species that has a Mystery Dungeon sprite in [SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
with at least the **Idle**, **Walk** and **Attack** animations. That keeps one art style across the game.
Completing the Pokédex is mostly art work, plus a small script change.

Status checked against SpriteCollab's `tracker.json` on 2026-10-17.

## Why they're missing

- `scripts/fetch_pokedex.py` → `dexes_with_sprites()` keeps a dex number only if the tracker lists
  `Idle`, `Walk` and `Attack` in its `sprite_files`. It then downloads names, types and stats from
  PokeAPI for those, into `src/js/data/pokedex.js`.
- `scripts/fetch_sprites.py` downloads the sheets into `public/assets/pokemon/<dex>/` and writes
  `src/js/data/sprites-meta.js`. It already has a `FALLBACK` table (Attack → Strike / Swing / Shoot /
  Idle, and so on), but `main()` skips every species whose base sprite lacks one of the three
  `REQUIRED` animations before any fallback is tried. It also ignores alternate forms.

## The 59, by what they need

### A. Usable now with a script change (4)

They have Idle, Walk and an attack-like animation (`Swing` or `Shoot`) instead of `Attack`.

| Dex  | Pokémon    | Animations in SpriteCollab                                   |
| ---- | ---------- | ------------------------------------------------------------ |
| 593  | Jellicent  | Idle, Walk, Swing, Rotate, Sleep                             |
| 865  | Sirfetch'd | Idle, Walk, Swing, Double, Rotate                            |
| 948  | Toedscool  | Idle, Walk, Swing, Double, Rotate, Sleep                     |
| 1025 | Pecharunt  | Idle, Walk, Swing, Shoot, Charge, Hurt, Twirl, Rotate, Sleep |

### B. Usable but stiff (2)

They'd reuse the Idle pose for the missing animation. Decide whether that's acceptable.

| Dex  | Pokémon     | Missing                     |
| ---- | ----------- | --------------------------- |
| 879  | Copperajah  | any attack (has Idle, Walk) |
| 1021 | Raging Bolt | Walk (has Idle, Swing)      |

### C. Only an alternate form is drawn (2 good, 2 doubtful)

All four forms have the full Idle, Walk and Attack set.

| Dex  | Pokémon    | Form (tracker subgroup)       | Notes                                                            |
| ---- | ---------- | ----------------------------- | ---------------------------------------------------------------- |
| 999  | Gimmighoul | `0001` Roaming                | A real form. Fine to use as Gimmighoul.                          |
| 1008 | Miraidon   | `0001` Low Power              | Its walking (Drive) mode. Fine to use.                           |
| 1003 | Ting-Lu    | `0001` Temp                   | Labelled "Temp" (placeholder?). Check how it looks first.        |
| 870  | Falinks    | `0002` Brass / `0003` Trooper | Single troopers of the formation, not the whole line. Debatable. |

### D. Only a still pose (8)

Walk and an attack still need drawing.

618 Stunfisk · 683 Aromatisse · 733 Toucannon · 929 Dolliv · 945 Grafaiai · 990 Iron Treads ·
1003 Ting-Lu (base form) · 1020 Gouging Fire

### E. Nothing drawn yet (41)

514 Simisear · 516 Simipour · 520 Tranquill · 522 Blitzle · 523 Zebstrika · 538 Throh · 558 Crustle ·
564 Tirtouga · 565 Carracosta · 591 Amoonguss · 592 Frillish · 616 Shelmet · 626 Bouffalant · 668 Pyroar ·
732 Trumbeak · 735 Gumshoos · 756 Shiinotic · 765 Oranguru · 837 Rolycoly · 838 Carkol · 839 Coalossal ·
866 Mr. Rime · 878 Cufant · 893 Zarude · 931 Squawkabilly · 942 Maschiff · 943 Mabosstiff · 944 Shroodle ·
947 Brambleghast · 949 Toedscruel · 950 Klawf · 954 Rabsca · 956 Espathra · 962 Bombirdier · 973 Flamigo ·
986 Brute Bonnet · 993 Iron Jugulis · 1001 Wo-Chien · 1002 Chien-Pao · 1014 Okidogi · 1022 Iron Boulder ·
1023 Iron Crown

Total: 4 + 2 + 4 + 8 + 41 = 59. Ting-Lu appears in both C and D: its form is in C, its base sprite in D.

## Step 1 — Script change (about an hour, +6 to +8 Pokémon)

Do this first. It's cheap, and it makes every later sprite arrive automatically.

1. **Relax the requirement in both scripts.** The new rule is Idle and Walk, plus at least one of
   Attack, Strike, Swing or Shoot.
   - `fetch_pokedex.py` → `dexes_with_sprites()`.
   - `fetch_sprites.py` → the filter in `main()` and the check after `download_set()` in `do_dex()`.
   - Keep one helper per script with the same rule, so the two scripts never disagree.
   - Group B (Copperajah, Raging Bolt) would need an even looser rule where Idle can stand in for the
     missing animation. Make that an explicit allow-list, not the general rule.
2. **Allow forms.** Add a small map in `fetch_sprites.py`, e.g. `FORM = {999: '0001', 1008: '0001'}`
   (+ `1003`, `870` if accepted).
   - Read the tracker entry from `tracker[dex]['subgroups'][form]`, and download from
     `sprite/<dex>/<form>/` instead of `sprite/<dex>/`.
   - The shiny of a form lives at `sprite/<dex>/<form>/0001/`.
   - `fetch_pokedex.py` must accept these dex numbers too: use the same map, or read the list of dex
     numbers from `sprites-meta.js`.
3. **Credits.** `scripts/fetch_credits.py` reads the base species' credits. For a form, read
   `subgroups[form].sprite_credit` instead.
4. **Regenerate**, on a machine that can reach PokeAPI:
   ```
   npm run data:sprites     # new sheets + sprites-meta.js (resumable, uses .cache/)
   npm run data:pokedex     # pokedex.js with the new species
   npm run data:credits     # CREDITS.md
   npm run check:stages     # Story data still valid
   npm run build
   ```
   `pokeapi.co` is blocked in the Claude Code cloud environment, so run `data:pokedex` locally, or
   allow that host in the environment's network settings. `raw.githubusercontent.com`, where
   SpriteCollab is served from, works there.
5. **Fix the hardcoded 966.**
   - `src/js/data/achievements.js`, the "own all" achievement (`goal: 966`). It's overwritten with
     `DEX.length` at load, but keep it in sync.
   - `src/index.html`: the `description` and `og:description` meta tags and the intro paragraph
     ("…with 966 Pokémon…").
   - `src/js/data/lang-es.js`: the Spanish version of that paragraph (its key must match the new
     English text exactly).
   - Then `grep -rn 966 src scripts public` to catch anything else (the one in `enemy.js` is a hash
     constant: leave it).
6. **Check in the game.**
   - The new Pokémon appear in their region's gacha banner and in the collection.
   - They animate correctly in all 8 directions, as an enemy and as your partner.
   - Their shiny works if the shiny sheet exists. Otherwise the game falls back to the normal one
     (`sm` / `sh` in `sprites-meta.js`).

## Step 2 — Art for the remaining ~51 (the real work)

### What a Pokémon needs

PMD-style sprite sheets, in SpriteCollab's format:

- **Required:** Idle, Walk and Attack. Each is a sheet with one row per direction (8 rows: Down,
  DownRight, Right, UpRight, Up, UpLeft, Left, DownLeft) and one column per frame.
- **Nice to have** (the game uses them when present): Shoot, Charge, Hurt, Faint. Without them it
  falls back to Attack, Idle and so on.
- **Per animation:** `-Anim.png`, `-Offsets.png`, `-Shadow.png`, plus `AnimData.xml` with frame sizes
  and durations.
- **Shiny:** a recolor of the same sheets (`0000/0001/` in SpriteCollab).

Reference: any existing species, e.g. `sprite/0025/` in the SpriteCollab repository, and its
contributor guide.

### Option 1 (recommended): through SpriteCollab

- Request or commission sprites on SpriteCollab. Its community works from its Discord, and the
  tracker shows who's working on what (`sprite_pending`, `sprite_bounty`). Four of these already have
  small bounties: Aromatisse (5), Sirfetch'd (9), Toedscool (3), Pecharunt (2).
- Adding bounties on the rest is the most direct lever.
- Once a sprite lands there, rerun step 1.4: the scripts pick it up automatically, with its credit,
  under the same CC BY-NC 4.0 license as the rest.
- It also benefits every other PMD fan project.

### Option 2: local sprites

Draw or commission sheets yourself and keep them in the repo:

1. Add a folder such as `assets-src/pokemon-local/<dex>/` with the same files as SpriteCollab
   (`AnimData.xml`, `Idle-Anim.png` …).
2. In `fetch_sprites.py`, check that folder before downloading, and process it exactly like a
   download (`download_set()` already takes a base path; make it accept a local one).
3. Make `dexes_with_sprites()` in `fetch_pokedex.py` also count local dex numbers.
4. Add the artists to `CREDITS.md`, and to `fetch_credits.py` so they survive regeneration.

It's faster, but you keep these sprites up to date and replace them if SpriteCollab gets official
ones later.

### Not recommended: other art styles

Official game sprites, HOME renders and the like would fill the Pokédex at once, but they clash
visibly with the Mystery Dungeon style of everything else.

## Step 3 — After new Pokémon arrive

- **Story mode substitutes.** Some routes use stand-ins because the original species was missing.
  Swap them back in `src/js/data/stages.js` once they exist, then run `npm run check:stages`.

  | Original (missing)                                                                                                | Stand-in used                                                                                                           | Where                        |
  | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
  | Blitzle, Zebstrika                                                                                                | Lillipup, Eelektross, Eelektrik, Simisage                                                                               | Unova 2, 4 (Elesa's ace), 7  |
  | Tranquill                                                                                                         | Pidove, Unfezant                                                                                                        | Unova 2, 6, 7, 8             |
  | Throh, Shelmet, Stunfisk                                                                                          | (removed from the route)                                                                                                | Unova 3, 6, 7, 8; Kalos 3, 6 |
  | Amoonguss                                                                                                         | Escavalier, Foongus                                                                                                     | Unova 6, Kalos 8             |
  | Pyroar, Aromatisse                                                                                                | Talonflame, Doublade, Slurpuff, Florges                                                                                 | Kalos 1, 5, 6                |
  | Trumbeak, Gumshoos (Ilima's ace), Oranguru, Shiinotic                                                             | Pikipek, Smeargle, Passimian, Kommo-o                                                                                   | Alola 1, 4, 5, 7             |
  | Rolycoly, Carkol, Coalossal (Gordie's ace), Falinks                                                               | Roggenrola, Boldore, Gigalith, Hawlucha, Grapploct, Barbaracle                                                          | Galar 1, 2, 3, 5, 6          |
  | Shroodle, Grafaiai, Dolliv, Klawf, Bombirdier, Toedscool/Toedscruel, Cufant, Gimmighoul, Rabsca, Espathra (Tulip) | Tarountula, Dachsbun, Arboliva, Crabrawler, Naclstack, Rookidee, Fomantis, Lurantis, Phanpy, Rellor, Hattrem, Gothorita | Paldea 2, 3, 4, 5, 6, 7, 8   |

- **Gacha and collection** need no code changes: banners, rarity and the "own them all" goal all read
  `pokedex.js`.
- **Changelog.** Add an entry to `src/js/data/changelog.js`, e.g. "N new Pokémon join the game", in
  English and Spanish.

## Checklist

- [ ] Step 1: relax the sprite rule in both scripts (same helper)
- [ ] Step 1: support forms (Gimmighoul Roaming, Miraidon Low Power; decide on Ting-Lu, Falinks)
- [ ] Step 1: decide on Copperajah and Raging Bolt (Idle stand-in)
- [ ] Step 1: credits for forms
- [ ] Step 1: regenerate sprites, Pokédex and credits (PokeAPI access needed), then build and test
- [ ] Step 1: replace the hardcoded 966
- [ ] Step 2: bounties or commissions on SpriteCollab for the 49–51 still missing after step 1
- [ ] Step 2 (optional): local-sprites folder support
- [ ] Step 3: swap the Story mode stand-ins back as species arrive
- [ ] Step 3: changelog entry
