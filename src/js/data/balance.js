/* ============ balance.js — every gameplay number in one place ============
 * Tuning lives here and only here: logic files read Balance.<section>.<key>
 * at the moment they use it (through a section alias like
 * `const B = Balance.spawn`), never a copy taken at load time, so changing a
 * value here (or live, from the ?dev panel) changes it everywhere.
 *
 * Content tables stay in their own data files (moves.js, items.js,
 * upgrades.js, enemies.js tiers and boss slots, levelup.js cards): those are
 * the single source for their entries. This file holds the global rules:
 * rates, multipliers, chances, timings and curves.
 *
 * Units: seconds, pixels (world), per-second rates; chances in [0, 1].
 *
 * Sections (in this order):
 *   run, story, spawn, drops, interact, coop, gacha · enemies · player, combat,
 *   levelup, items · events, rift, judgment, hazards, weather
 */
import { U } from '../core/util.js';

export const Balance = {};

// ================= Run flow, spawning, loot, interactables, co-op and gacha =================

/** Enemy waves, swarms and wild shinies (systems/spawner.js). */
Balance.spawn = {
  // Cap on simultaneous enemies. Past eliteFrom × cap, new spawns are elite.
  cap: 64,
  eliteFrom: 0.85, // fraction of the cap
  elite: { hp: 1.6, dmg: 1.25, xp: 1.6 }, // multipliers on an elite spawn
  // Fewer but stronger Pokémon: density scales the spawn rate, the rest each enemy.
  density: 0.24,
  dmgK: 2.4, // contact damage multiplier
  xpK: 5.6, // experience multiplier (rounded)
  /** Extra toughness over the run: ×3.3 at first, up to ×5 around minute 6. */
  hpK: t => 3.3 + Math.min(1.7, t / 210),
  /** Enemies per second at run time t (seconds). */
  rate: t => (1.6 + t * 0.028 + Math.pow(t / 60, 1.6) * 0.5) * Balance.spawn.density,
  bossFightRate: 0.25, // trickle multiplier while a boss is alive (and no swarms)
  shinyRate: 1 / 4096, // chance that a wild enemy or boss is shiny
  ring: { min: 10, max: 70 }, // spawn distance beyond the view's outer radius (px)
  ringJitter: 0.9, // angle jitter (radians, ±) when looking for a free spot / spawning ahead
  swarm: {
    first: 32, // seconds until the first swarm
    every: [38, 56], // seconds between swarms (random in range)
    base: 14, // enemies in a swarm at t = 0...
    growEvery: 22, // ...plus one every this many seconds
    k: 0.4, // overall swarm size multiplier
    spread: 0.55 // angle spread (radians, ±) of the side they come from
  },
  burst: { spread: 0.6, overCap: 10 } // horde bursts (events.js): angle spread, how far past the cap they may go
};

/** Pickups dropped by enemies and broken props, and what pickups do. */
Balance.drops = {
  xpBigFrom: 20, // an XP orb worth at least this is a big orb
  ticketRate: 1 / 400, // a normal enemy drops a gacha ticket (was 1/260 until 2026-10-10)
  // One roll per normal kill, cumulative thresholds: < heal → berry, < magnet → magnet, < bomb → bomb.
  occasional: { heal: 0.012, magnet: 0.02, bomb: 0.026 },
  boss: {
    orbs: 14, // big XP orbs a boss bursts into (the XP is split among them)
    t10: 1 / 3, // ×10 ticket chance from a normal boss
    legendT10: 1 / 2 // ×10 ticket chance from the rift legendary
  },
  // Pickup effects (game.js onCollect).
  berryHeal: 0.3, // fraction of max HP
  bomb: { base: 60, perLevel: 14, knock: 160 }, // damage = base + perLevel × your level; knockback
  // Magnet pull (entities/pickup.js): speed = pullBase + pullNear / distance.
  pull: { base: 240, near: 1400, damp: 7, friction: 0.02 }, // friction: speed kept per second while idle
  collectR: 15, // pickup radius (px)
  // Broken props (world.js destroyProp). Thresholds are on one roll per prop.
  grass: { heal: 0.05, coin: 0.11, coinValue: 1 }, // < heal → berry, < coin → coin
  rock: { xpBelow: 0.4, xp: 6, coinAbove: 0.75, coinValue: 2, healAbove: 0.94 },
  chest: { coins: [4, 7], coinValue: 3, healChance: 0.5, xp: 20, item: 0.08 }, // healChance: else a magnet
  bigchest: { coins: 9, coinValue: 4, tickets: [1, 3], t10: 0.15, item: 0.5 } // + XP for one level
};

/** Altars, springs, locked chests and traps (systems/interact.js). */
Balance.interact = {
  chestTime: 3.5, // seconds next to a locked chest to open it
  chestR: { min: 46, pad: 24 }, // reach: max(min, chest r + your r + pad)
  chestDecay: 1.5, // progress lost per second while away (× dt)
  altarR: { min: 30, pad: 14 }, // reach: max(min, altar r + your r + pad)
  powerTime: 25, // seconds an altar power lasts
  powers: { dmg: 2, spd: 1.45, mag: 4, cd: 0.6 }, // Fury damage ×, Thunderbolt speed ×, Magnet radius ×, Haste cooldown ×
  spring: {
    r: 26, // stand within this radius (px)
    heal: 0.14, // fraction of max HP per second
    drain: 0.09, // charge used per second of healing
    refill: 45, // seconds to refill from empty
    dryAt: 0.02 // charge at which it counts as dry
  },
  trap: {
    r: 74, // effect radius (px)
    stepR: 13, // a player within this radius triggers it
    enemyR: 3, // an enemy within this radius triggers it
    playerR: 0.7, // you are hit within this fraction of r
    // 0 poison · 1 sticky · 2 explosive
    poison: { secs: 5, dmg: 14, perLevel: 3, self: 0.1 }, // self: fraction of your max HP
    sticky: { slow: 0.65, secs: 4.5, dmg: 4, selfSecs: 3.5 },
    blast: { dmg: 90, perLevel: 18, knock: 220, self: 0.2 }
  }
};

/** Run flow and end-of-run rewards (game.js, systems/progress.js). */
Balance.run = {
  biomeLength: 240, // seconds per biome
  levelXpFallback: 20, // XP a locked chest gives when there is no player
  deathDelay: { solo: 1.3, group: 1.6 }, // seconds of faint animation before the summary
  // Pokécoins at the end: time/perSeconds + kills×perKill + bosses×perBoss + collected, × Fortune.
  coins: { perSeconds: 5, perKill: 0.25, perBoss: 80 },
  rescueDupCoins: 150, // rescuing a Pokémon you already own
  shinyDupCoins: 300, // catching a wild shiny you already own
  missions: { daily: 3, weekly: 2 } // missions drawn per day / per week
};

/**
 * Story mode (systems/story.js; stages and their `pace` in data/stages.js).
 * A stage plays like endless squeezed or stretched: at stage second t, enemies,
 * spawn rate, swarms and bosses are those of endless second eq = pace × t / duration
 * (so the gym fights at eq = pace). A slow pace (Brock: 180) gives you far more time
 * to level up than the enemies grow; pace 600 (Giovanni) is endless minute 10.
 */
Balance.story = {
  duration: 600, // seconds of routes before the gym
  cap: 48, // simultaneous enemies (endless: Balance.spawn.cap)
  density: 1, // × endless spawn rate (a stage can add its own `density`)
  xpK: 1, // × experience of every enemy
  warnAt: 30, // seconds before the gym: "the gym is ahead" notice
  pullAt: 3, // seconds before the gym: every pickup on the map flies to you
  // Bosses use endless's boss curve at their eq second (Enemies.bossAt), then:
  mini: { hp: 1, dmg: 1 }, // mini-bosses on the routes (each grants a bond)
  gym: {
    hp: 0.75, // × boss HP at the pace, per team member (× its own k)
    dmg: 1, // × boss damage
    arenaR: 12, // arena radius (tiles)
    intro: 2.4, // seconds from arriving to the first wave (the camera shows the leader meanwhile)
    focusAfter: 1, // ...and keeps showing them this long after the first wave comes out
    lull: 2.5, // seconds between waves
    north: 5, // the leader's Pokémon appear this far north of the center (tiles)
    leaderBack: 3, // the leader stands this far inside the north wall (tiles)
    leaderHeight: 100, // leader sprite height in the arena (px; sprites are 54-80 px tall depending on the game)
    spread: 2.6, // ...and this far apart when two come out (tiles)
    won: 3.5 // seconds to grab what's left before the summary
  },
  /** Reward for clearing a stage (first time and repeats), from its pace. */
  reward: (pace, first) =>
    first
      ? { coins: Math.round((pace * 2.5) / 50) * 50, t1: Math.round(pace / 30) }
      : { coins: Math.round((pace * 0.6) / 10) * 10, t1: Math.max(1, Math.round(pace / 200)) }
};

/** Co-op difficulty scaling (net/coop.js). n = number of players. */
Balance.coop = {
  /** Spawn-rate multiplier. */
  scaleRate: n => 1 + 0.75 * Math.max(0, n - 1),
  /** Enemy HP multiplier. */
  scaleHp: n => 1 + 0.3 * Math.max(0, n - 1),
  bossHp: 1.4, // extra HP multiplier for bosses and rift legendaries when playing in a group
  xpShare: 0.6 // team XP is divided by 1 + xpShare × (players - 1)
};

/** Gacha banners (systems/gacha.js). Meta-progression: rolls stay on Math.random. */
Balance.gacha = {
  rates: [
    // [rarity, weight %]
    [1, 45],
    [2, 30],
    [3, 17],
    [4, 6.5],
    [5, 1.5]
  ],
  pity5: 70, // after this many pulls without a 5★ on a banner, a guaranteed 5★
  tenMin: 4, // the ×10 pull guarantees at least one of this rarity or higher
  shinyRate: 1 / 100, // chance a pull is shiny
  refund: { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 }, // Pokécoins for a duplicate, by rarity
  shinyRefundK: 3 // a duplicate shiny refunds this many times more
};

// ================= Wild Pokémon: definitions, scaling, statuses, behaviors, bosses, drops =================

Balance.enemies = {
  // ---------------- definitions (data/enemies.js) ----------------
  def: {
    // Per-Pokémon HP factor: base HP / div, clamped.
    hpK: { div: 65, min: 0.7, max: 1.6 },
    // Per-Pokémon speed factor: base + base speed / div, clamped.
    spdK: { base: 0.75, div: 260, min: 0.75, max: 1.3 },
    // Tanks: × HP, × speed, × contact damage, × XP.
    tank: { hp: 1.5, spd: 0.7, dmg: 1.2, xp: 1.3 },
    // Minimum XP of a normal enemy.
    minXp: 3,
    // Bombers: faster and more fragile.
    bomber: { spd: 1.25, hp: 0.8 },
    // Runner (the fastest plain one of each tier): × speed, × HP.
    runner: { spd: 1.6, hp: 0.7 },
    // Shot damage as a fraction of the tier damage.
    shotDmg: { fan: 0.7, other: 0.8 },
    // Special-attack cooldown (s) by behavior, for tier index ti.
    shotCd: ti => ({
      ranged: 2.2 - ti * 0.15,
      fan: 3.2 - ti * 0.15,
      beamer: 4.4 - ti * 0.2,
      zoner: 4.6 - ti * 0.2,
      healer: 3.5,
      summoner: 7
    }),
    // Attack range (px): base by behavior, + perTier per tier index.
    range: { beamer: 260, support: 230, other: 190, perTier: 6 },
    // Shots per fan (wider later on).
    fanN: ti => (ti < 2 ? 3 : 5),
    // Max zones per zoner attack (more later on).
    zones: ti => (ti < 2 ? 1 : ti < 4 ? 2 : 3)
  },

  // Spawn bag weights: each tier's Pokémon get `weight` entries, `oldWeight` once the tier is older than `oldAfter` s.
  bag: { weight: 10, oldWeight: 3, oldAfter: 260 },

  // Hordes (systems/events.js): Pokémon per type needed for a horde, and Pokémon drawn per horde.
  horde: { minPerType: 3, size: 4 },

  // Run bosses (rolled per run from BOSS_SLOTS).
  boss: {
    hp: 1.35, // × slot HP (tougher since 2026-10-10)
    dmg: 1.2, // × slot damage
    spd: { base: 40, k: 0.5, min: 40, max: 100 }, // speed = base + base speed × k, clamped
    chargerSpd: 90, // base speed above which a non-ranged boss is a charger
    shotDmg: 0.55, // shot damage as a fraction of slot damage
    shotCd: 1.1, // s
    range: 260, // px
    fallbackBst: 580 // if the band is empty, any non-legendary with at least this BST
  },

  // Difficulty over time t (s): multipliers of HP, damage and speed.
  // (The minute-60 "overtime" was removed when Arceus's Judgment arrived.)
  scale: t => ({ hp: 1 + t / 95, dmg: 1 + t / 420, spd: 1 + Math.min(0.35, t / 1400) }),
  // Bosses already have increasing base HP, so they scale much more gently.
  bossScale: t => ({ hp: 1 + t / 600, dmg: 1 + t / 600, spd: 1 }),

  // ---------------- entities/enemy.js ----------------
  // Spawn-time jitter: first special attack within [shotCdMin, def.shotCd] s; first skill (shield/jump) within skillCd s.
  start: { shotCdMin: 0.3, skillCd: [1, 4] },

  // Shiny: × HP and × XP. Golden hour: × XP and a chance of a coin of `coinValue`.
  shiny: { hp: 2, xp: 5 },
  golden: { xp: 2, coinChance: 0.35, coinValue: 3 },

  status: {
    slow: { dur: 1.2 }, // default duration (s)
    // Burn: stacks up to cap, lasts dur s, ticks every tick s for dmg × stacks × (1 + player level × perLevel).
    burn: { cap: 8, dur: 3, tick: 0.5, dmg: 1.6, perLevel: 0.06 },
    // Poison: stacks up to cap, lasts dur s, ticks every tick s for max HP × maxHpPct × stacks + flat.
    poison: { cap: 8, dur: 4, tick: 0.6, maxHpPct: 0.012, flat: 1 }
  },

  // Terrain: lava hit = flat + max HP × maxHpPct (every liquid's `every` s); water speed multiplier (deep if its slow < deepBelow).
  terrain: { lavaFlat: 6, lavaMaxHpPct: 0.04, deepBelow: 0.5, deep: 0.45, shallow: 0.55 },

  // Knockback left after 1 s (exponential decay factor).
  knockDecay: 0.0015,

  behaviors: {
    // Treasure goblin: flees when you're within fleeRange (at full speed, else × idleSpd), zigzagging.
    thief: { fleeRange: 300, zigFreq: 2.2, zigAmp: 0.7, idleSpd: 0.35, bumpZig: 1.4 },
    // Runner: aims where you will be in dist / max(minSpd, speed) s, at most maxLead s.
    runner: { minSpd: 60, maxLead: 1.4 },
    // Bomber: lights the fuse within `gap` px of contact; blast after fuse s, radius r, × damage.
    bomber: { gap: 26, fuse: 1.0, r: 62, dmg: 1.4 },
    // Shielder: every cd s shields up to `max` allies within radius: max HP × hpPct for dur s.
    shielder: { cd: 6, radius: 160, max: 6, hpPct: 0.35, dur: 8 },
    // Jumper: jumps if within range (every cd s, else retries after retry s); crouch then flight (s); landing zone r, × damage.
    jumper: { range: 250, cd: [5, 7], retry: 0.5, crouch: 0.45, dur: 0.6, r: 50, dmg: 1.2 },
    // Charger: starts aiming within aggro px; aim, dash and rest times (s); dash speed ×.
    charger: { aggro: 200, aim: 0.55, dash: 0.42, dashSpd: 3.4, rest: 1.1 },
    // Ranged fighters: keep range × keep away; back off below × backOff of that at × backSpd; hold still at × holdSpd.
    ranged: { range: 200, cd: 2, keep: 0.82, backOff: 0.75, backSpd: 0.8, holdSpd: 0.1 },
    // Fan: spread (rad) for 3 shots / more; × shot damage; default shot count.
    fan: { spread3: 0.6, spread: 0.9, dmg: 0.65, n: 5 },
    // Beamer: telegraphed beam length, width, delay (s) and × shot damage.
    beamer: { len: 360, w: 22, delay: 1.0, dmg: 1.05 },
    // Zoner: extra zones land within ±dx/±dy of you; radius, delay (s), × shot damage, default max zones.
    zoner: { dx: 70, dy: 55, r: 44, delay: 1.2, dmg: 0.95, zones: 3 },
    // Healer: heals pct of max HP to allies within radius, × min(powCap, (your atk / base atk) ^ powExp).
    healer: { pct: 0.07, powExp: 0.35, powCap: 2.5, radius: 150 },
    // Summoner: up to maxMinions alive, not above spawner CAP + capMargin; perCast per call; minion stats vs. the summoner.
    summoner: { maxMinions: 4, capMargin: 15, perCast: 2, minion: { hp: 0.35, spd: 1.1, dmg: 0.6, xp: 0.25, minXp: 1 } }
  },

  // Enemy shots: speed (px/s), hit radius, lifetime (s), default damage.
  shot: { speed: 190, r: 7, life: 2.4, dmg: 10 },

  // Boss (and rift legendary) AI.
  bossAi: {
    furyAt: 0.5, // enrages below this fraction of HP
    furySpd: 1.15, // × speed when enraged
    furyRate: 1.25, // × cooldown recovery and movement when enraged
    furyWind: 0.8, // × wind-up when enraged
    farLike: { far: 0.65, close: 0.35 }, // preference for range (ranged bosses / the rest)
    modeT: [6, 8], // first mode duration (s)
    modeLong: [7, 9], // time at its favourite range (s)
    modeShort: [4, 5], // time at the other one (s)
    cd: 1.6, // first attack (s)
    chaseSpd: 1.1, // × speed while approaching
    far: { flee: 170, circle: 300, circleSpd: 0.55 }, // backs off below flee px, circles you below circle px
    close: { slam: 125, melee: 320, meleeChance: 0.8, shoot: 480 }, // ranges (px) and chance of melee over shooting
    farSlam: 115, // in far mode it still stomps below this distance
    farShoot: 430, // and shoots below this one
    cdAfter: [1.3, 2.0], // cooldown after an attack (s)
    chainChance: 0.35, // enraged: chance to chain another attack
    chainCd: 0.3, // s
    wind: 0.6, // default wind-up (s)
    after: 0.35, // default recovery after firing (s)
    attacks: {
      slam: { wind: 0.85, r: 96, dmg: 1.3 }, // r is added to the body radius
      dash: { wind: 0.75, len: 330, dur: 0.32, wPad: 16, dmg: 1.2 }, // beam width = body diameter + wPad
      leap: { crouch: 0.5, dur: 0.65, r: 82, dmg: 1.25, cd: [1.4, 2], cdPad: 0.6 },
      rain: { n: 4, furyN: 6, dist: [40, 120], yK: 0.8, r: 50, delay: 1.05, stagger: 0.12, dmg: 1.15, wind: 0.5 },
      beam: { n: 3, furyN: 5, sp: 0.5, furySp: 0.42, len: 400, w: 26, delay: 1.0, dmg: 1.2, wind: 1.0, after: 0.25 },
      volley: { wind: 0.5, spread: 1.1, n: 7, furyN: 9, dmg: 0.8 },
      nova: { wind: 0.7, n: 14, furyN: 18, dmg: 0.7 }
    }
  },

  // Drops: coin counts (n) and values, tickets.
  drops: {
    boss: { coins: 10, coinValue: 5 }, // plus one held item
    thief: { coins: 20, ticketCoins: 6, coinValue: 5, tickets10: 1 }, // ticketCoins: Gholdengo (gives a ×10 ticket)
    legend: { tickets: 3, coins: 10, coinValue: 8 }
  },

  // Separation between enemies: overlap fraction of the radii sum, push strength, max neighbours considered.
  separation: { overlap: 0.82, push: 42, maxNear: 6 },

  // Stragglers: reappear ahead after lagT s out of view (beyond view radius + margin, unseen with pad)
  // while behind a player moving faster than minSpd; always beyond farDist px.
  straggler: { lagT: 2.5, margin: 40, pad: 60, minSpd: 40, behind: 0.2, farDist: 1400 }
};

// ================= Player, combat, level-up and items =================

Balance.player = {
  magnet: 78, // base pickup (magnet) radius, px; multiplied by the Magnet upgrade
  moveSlots: 4, // move slots (a bond joins moves into one slot)
  bondMax: 4, // most moves a single bond group can hold
  // Experience needed to go from `level` to the next one.
  // (×2 and then ×4 on 2026-10-10: levelling up was too fast.)
  xpFor: level => Math.floor((8 + level * 6 + Math.pow(level, 1.75) * 1.6) * 4),
  reductionCap: 0.8, // max damage reduction (upgrades + Armor card + buffs)
  trapSlow: 0.5, // speed multiplier while stuck by a trap (slowT)
  meleeGuard: 0.75, // damage taken multiplier while a melee move is in the active slot
  hurtInvuln: 0.45, // i-frames after being hit, s
  switchCdFrac: 0.35, // switching slots caps the new moves' remaining cooldown to this fraction of their cd
  liquidDmgMul: 0.5, // multiplier on a damaging liquid's (lava...) % of max HP per tick
  ice: { speedMul: 1.15, damp: 1.6 }, // ice sliding: target speed multiplier and velocity damping rate
  revive: {
    time: 3, // seconds standing next to a downed teammate to revive them
    radius: 56, // a teammate within this radius revives you (px)
    decay: 0.5, // revive progress lost per second with nobody near
    hpFrac: 0.5, // fraction of max HP a revived player gets back
    invuln: 2 // i-frames after getting back up, s
  },
  // Auto-aim (see Player.update).
  aim: {
    threatPad: 24, // "touching you" = within body radius + this, px
    bossRange: 330, // a boss closer than this gets priority, px
    range: 520, // farthest enemy auto-aim picks, px (also the default attack reach)
    breakableRange: 200, // with no enemy, aim at a rock/chest this close, px
    chestNear: 60, // a small chest this close beats even the enemy touching you, px
    chestFar: 100 // a small chest this close beats the boss and the nearest enemy, px
  }
};

Balance.combat = {
  retry: 0.05, // a targeted move with no target in reach checks again after this, s
  minCd: 0.05, // shortest possible move cooldown, s
  crit: { mul: 1.5 }, // critical hit damage multiplier (chance comes from Upgrades)
  // How close the target must be before a targeted move fires (px; `pad` is added to the move's radius).
  reach: {
    meleePad: 30,
    beamPad: 20,
    boomerangPad: 40,
    chain: 280,
    meteor: 340,
    dashPad: 60,
    conePad: 30 // added to the cone's travel distance (speed × life)
  },
  // Type chart softening (data/types.js): game multiplier -> multiplier used here, and the clamp for dual types.
  types: { soft: { 2: 1.6, 0.5: 0.6, 0: 0.3 }, min: 0.3, max: 2.4 },
  // Melee moves get this at load time (2026-10-12) on top of their table values (data/moves.js).
  meleeBoost: { dmg: 1.2, radius: 1.25, arc: 1.25, arcMax: 3 },
  projectile: {
    aimJitter: 0.03, // random aim error, ± rad
    // Defaults for anything spawned without these fields (enemy shots...).
    dmg: 10,
    r: 6,
    life: 1.4, // s
    rehit: 0.34, // orb re-hit interval, s
    homingRange: 340, // homing shots look for enemies this close, px
    despawnMargin: 260 // discarded this far out of view, px
  },
  nova: { minCount: 3, jitter: 0.06 }, // min projectiles; angle jitter ± rad
  aura: { drainCap: 6 }, // most HP a draining aura heals per pulse
  boomerang: {
    spread: 0.5, // default spread between boomerangs, rad
    spreadCountCap: 3, // spread grows with count up to this many
    lifeMul: 4, // life = outbound time × lifeMul + lifePad
    lifePad: 1.5, // s
    pierce: 999,
    returnSpeed: 1.1, // return speed × move speed
    returnDamp: 7, // how fast it turns back towards its owner
    catchPad: 8 // caught when within owner radius + this, px
  },
  chain: { falloff: 0.85 }, // damage multiplier per jump
  mine: {
    scatter: [18, 46], // distance from you when several are dropped, px
    arm: 0.35, // s before it can trigger
    life: 7, // default lifetime, s (it blows up on its own at the end)
    keepBase: 4, // max mines per player = keepBase + keepPerCount × count
    keepPerCount: 2,
    trigger: 14, // an enemy this close sets it off, px
    expireDmg: 0.5 // damage multiplier when it expires untriggered
  },
  meteor: {
    jitter: [8, 6], // landing offset around the target, ± px (x, y)
    fallback: [140, 110], // with no target: random spot around you, ± px (x, y)
    stagger: 0.09, // delay between meteors, s
    fall: 0.5 // fall time, s
  },
  turret: {
    angleJitter: 0.6, // placed behind you, ± rad
    offset: [26, 20], // distance behind you, px (x, y)
    life: 6, // default lifetime, s
    firstShot: 0.3, // s
    range: 300, // default range, px
    rate: 0.6, // default fire interval, s
    idle: 0.15, // with no target: look again after, s
    speed: 300, // default shot speed
    size: 6, // default shot radius
    shotLife: 1.4 // s
  },
  dash: { invuln: 0.3, width: 34 }, // i-frames, s; default hit width, px
  trail: {
    spacing: 0.9, // a new puddle needs this × radius from the last one...
    refresh: 1, // ...or the last one must be older than this, s
    life: 3, // default lifetime, s
    max: 18, // most puddles per player
    tick: 0.5 // damage interval, s
  },
  cone: { minCount: 2, arc: 0.9, jitter: 0.05, speed: [0.85, 1.1], life: [0.85, 1.05] }, // arc rad; jitter ± rad; random multipliers
  orbit: { minRehit: 0.12 }, // shortest orb re-hit interval, s
  contact: {
    touchCd: 0.55, // an enemy can hit you by touch once every, s
    push: 150 // knockback on the enemy after touching you
  }
};

Balance.levelup = {
  offer: 3, // cards per level-up
  freeRerolls: 1, // rerolls per run before Upgrades (read in ui/run-ui.js)
  newSample: 6, // new-move candidates drawn from the pool
  buffCap: 2, // no more buff moves are offered once you have this many
  statSample: 5, // stat candidates drawn (plus any an evolution waits for)
  // Card weights (higher = more likely).
  weight: { new: 10, evo: 40, up: 8, statEvo: 14, statFreeSlots: 4, stat: 7 },
  armorCap: 0.7 // the Armor card never takes damage reduction above this
};

Balance.items = {
  lifeOrb: { cost: 0.01, min: 1 }, // HP lost per attack: fraction of max HP, at least `min`
  focusSash: { cooldown: 60, invuln: 1.2 }, // s between saves; i-frames after a save, s
  shellBell: { frac: 0.04, cap: 4, rate: 4 }, // heal = damage × frac, pending heal capped at `cap`, paid at `rate` HP/s
  rockyHelmet: { dmg: 15, perLevel: 4, knock: 80 } // damage to an enemy touching you = dmg + perLevel × level
};

// ================= Mid-run events, rift, Judgment of Arceus, hazards and weather =================

/** Mid-run events (systems/events.js). */
Balance.events = {
  every: [240, 300], // seconds between events (random in range)
  bossRetry: 10, // a boss is alive when an event is due: try again after (s)
  ids: ['horde', 'gold', 'lost'], // event pool (never the same one twice in a row)
  horde: {
    dur: 30, // seconds of single-type spawns
    burst: 6 // enemies spawned at once when it starts (scaled by co-op spawn rate)
  },
  gold: {
    dur: 30 // seconds of golden enemies (double XP)
  },
  lost: {
    maxRarity: 3, // highest rarity a lost Pokémon can be (never legendaries)
    hp: 100, // its HP
    time: 120, // seconds before it gives up and leaves
    spawnDist: [220, 300], // distance from a player where it appears (px)
    goalDist: [700, 850], // distance from it to the marker (px)
    goalR: 56, // marker radius: reach it to rescue (px)
    touchPad: 18, // extra reach to pick it up (px, added to both radii)
    keepPad: 14, // distance it keeps while following (px, added to both radii)
    minSpd: 120, // its minimum follow speed (px/s)
    spdMul: 1.15, // follow speed relative to the leader's speed
    hitCd: 0.5, // seconds between enemy hits on it
    hitBase: 4, // damage per touching enemy, plus...
    hitDmgMul: 0.12, // ...this fraction of that enemy's damage
    hitCap: 30, // max damage per hit tick
    heal: 0.5, // fraction of max HP healed on rescue
    coins: 12, // coin pickups dropped on rescue...
    coinValue: 5, // ...each worth this much
    tickets: 1, // tickets dropped on rescue
    grant: 0.2 // chance it joins your collection
  },
  thief: {
    max: 2, // treasure goblins per run
    first: [120, 240], // seconds until the first one
    next: [240, 360], // seconds between the next ones
    bossRetry: 8, // a boss is alive: try again after (s)
    life: 15, // seconds before it escapes
    goldChance: 0.25, // chance it's the ticket carrier instead of the coin one
    dex: 52, // coin carrier (Meowth)
    goldDex: 1000, // ×10 ticket carrier (Gholdengo)
    hp: (time, gold) => 60 * (1 + time / 95) * (gold ? 1.5 : 1), // its HP at run time `time` (s)
    spd: 92, // px/s
    xp: 10,
    spawnDist: [230, 300] // distance from a player where it appears (px)
  }
};

/** Rifts and the legendary arena (systems/rift.js). The legendary stats are also used by the Judgment. */
Balance.rift = {
  from: 75, // no rifts before this run time (s)
  stopBeforeJudgment: 120, // no rifts in the last seconds before the Judgment
  check: 30, // seconds between open attempts
  chance: 0.2, // chance per attempt, times (1 + failed attempts in a row)
  ttl: 45, // seconds a rift stays open
  openDist: [380, 560], // distance from a player where it opens (px)
  enterR: 30, // touch radius to enter (px)
  unbeatenWeight: 4, // pick weight of a legendary you haven't beaten (beaten: 1)
  shinyChance: 1 / 512, // chance the legendary is shiny
  arenaR: 11, // arena radius (tiles)
  wallMargin: 1.4, // nobody gets closer than this to the arena wall (tiles; also the Judgment arena)
  arenaTime: 120, // seconds to beat the legendary
  weatherExtra: 15, // the arena's weather lasts arenaTime + this (s)
  lineupGap: 34, // spacing between players when they arrive (px; also the Judgment)
  lineupSouth: 3, // players arrive this far south of the center (tiles; also the Judgment)
  legendNorth: 3.5, // the legendary appears this far north of the center (tiles)
  allDownGrace: 1.4, // seconds with everyone down before the fight is lost
  wonDelay: 5, // seconds to grab the reward before going back
  lostDelay: 1.2, // seconds before being thrown out after losing
  revive: 0.3, // HP fraction you come back with if you were down
  legend: {
    hp: t => 3200 + t * 9, // base HP at run time t (s)
    spd: mon => U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105), // px/s from the species' Speed stat
    dmg: t => 36 + t / 20, // touch damage
    xp: t => 500 + t * 1.2,
    shotDmg: t => 18 + t / 40, // ranged attack damage
    shotCd: 0.9, // seconds between shots
    range: 300, // ranged attack range (px)
    rangedTypes: ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'] // these shoot; the rest charge
  }
};

/** Arceus's Judgment (systems/judgment.js). */
Balance.judgment = {
  at: 30 * 60, // run time when it starts (s)
  arenaR: 24, // arena radius (tiles)
  queue: 40, // legendaries rolled for the queue (it loops)
  bossEvery: 5, // seconds between legendaries (no cap)
  firstBoss: 1.2, // seconds until the first legendary
  growth: 2, // each legendary has this times the HP and damage of the previous one
  bossEdge: [3, 6], // legendaries appear this far inside the arena wall (tiles)
  bossSafeDist: 280, // ...and at least this far from every player (px, if possible)
  // First legendary's HP: about `firstSecs` of your best damage to one enemy, at least
  // `floorFrac` of a rift legendary's HP (scaled by co-op HP).
  firstSecs: 3,
  floorFrac: 0.35,
  dpsWindow: 30, // seconds of damage samples kept...
  dpsTop: 6, // ...and how many of the best ones are averaged
  arceus: {
    scale: 1.5, // sprite (and body) scale
    startNorth: 5, // appears this far north of the center (tiles)
    touch: 0.4, // fraction of max HP lost when touching it
    touchCd: 0.9, // seconds between touch hits
    spd: arenaT => Math.min(1.22, 0.74 + arenaT * 0.013), // speed relative to its target's (catches up after ~35 s)
    minSpd: 70, // px/s
    firstCd: 2.2, // seconds before its first attack
    cd: arenaT => Math.max(1.4, 3.2 - arenaT * 0.025), // seconds between attacks
    recover: 0.35 // seconds after an attack lands before the next one starts counting
  },
  // Its attacks (hazards: telegraphed, take pct of max HP, ignore types and defense).
  rain: {
    wind: 0.7, // cast time (s)
    n: arenaT => 4 + Math.min(6, Math.floor(arenaT / 10)), // pillars per player
    spread: [40, 150], // distance from the player of the extra pillars (px; the first is on them)
    r: 44, // pillar radius (px)
    delay: 1.25, // telegraph time of the first pillar (s)...
    stagger: 0.09, // ...plus this per pillar
    pct: 0.3
  },
  cross: {
    wind: 1.1,
    n: arenaT => (arenaT > 30 ? 8 : 4), // beams
    tilt: 0.5, // chance the cross is rotated 45°
    len: 1700, // px
    w: 34, // px
    delay: 1.1,
    pct: 0.35
  },
  nova: {
    near: 210, // it may use it if its target is this close (px)...
    chance: 0.6, // ...with this chance
    wind: 0.85,
    r: 170,
    delay: 0.85,
    pct: 0.4
  }
};

/** Telegraphed attacks (systems/hazards.js). Their damage and timing come from whoever creates them. */
Balance.hazards = {
  linger: 0.3, // seconds a hazard stays after hitting (default `end`)
  bodyFrac: 0.6 // fraction of a Pokémon's radius that counts as inside a hazard
};

/** Weather (systems/weather.js). */
Balance.weather = {
  from: 120, // no weather before this run time (s)
  check: 60, // seconds between attempts
  chance: 0.18, // chance per attempt
  dur: [55, 75], // seconds it lasts (rounded)
  fade: 3, // seconds to fade in and out (effects scale with intensity)
  chipEvery: 2, // seconds between sand/snow chip damage ticks
  chipLevel: 0.5, // minimum intensity for chip damage
  chipPlayer: 0.012, // fraction of max HP chipped off you (at least 1; never KOs)
  chipEnemy: 0.02, // fraction of max HP chipped off enemies, plus 1 (not bosses)
  // Per weather: damage multipliers by attack type, types immune to chip damage
  // (and to the slowdown), and speed lost (fraction) at full intensity.
  kinds: {
    sun: { mult: { fire: 1.5, water: 0.5 } },
    rain: { mult: { water: 1.5, electric: 1.2, fire: 0.5 } },
    sand: { mult: { rock: 1.3, ground: 1.3, steel: 1.3 }, safe: ['rock', 'ground', 'steel'] },
    snow: { mult: { ice: 1.5 }, safe: ['ice'], slow: 0.1 },
    fog: { mult: { ghost: 1.3, fairy: 1.3, psychic: 1.3 } }
  },
  // Chance weight of each weather by biome (forest, cave, volcano).
  biome: [
    { rain: 3, fog: 2, sun: 1.5, snow: 0.5, sand: 0.5 },
    { fog: 3, snow: 2.5, rain: 1, sand: 1 },
    { sun: 3, sand: 3, fog: 1 }
  ]
};
