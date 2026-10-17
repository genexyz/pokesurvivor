/* ============ enemies.js — wild Pokémon from every generation ============
 *
 * Tiers are no longer fixed lists: each tier gathers every Pokémon (from any
 * generation) whose base stat total falls in its range, and when a run starts
 * a CAST is picked at random from each tier. That way every run brings
 * different Pokémon without loading hundreds of sprites at once.
 *
 * Combat stats come from the tier template, adjusted with each Pokémon's
 * own HP and speed.
 *
 * behavior:
 *   chase    comes straight at you
 *   charger  stops, aims and rams
 *   ranged   keeps its distance and shoots
 *   tank     slow, lots of HP
 *   ---- with personality ----
 *   healer   heals those around it (Chansey, Blissey, Audino...)
 *   shielder shields its companions (Shuckle, Bronzong, Mr. Mime...)
 *   summoner calls its pack (Nidoqueen brings Nidoran, Vespiquen Combee...)
 *   bomber   comes close and explodes (Voltorb, Electrode, Koffing, Geodude...)
 *   beamer   beam that warns on the ground before firing
 *   zoner    damage zones under your feet that burst shortly after
 *   fan      shoots in a fan
 *   jumper   jumps and lands on you (the landing shows on the ground first)
 *   runner   very fast and fragile, heads to where you will be (cuts off
 *            those who only flee). One per tier: the fastest of the cast.
 * Telegraphed attacks are in systems/hazards.js.
 *
 * Bosses: strong NON-legendary Pokémon (pseudo-legendaries, Slaking...),
 * random by power bands. Legendaries only appear in rifts
 * (systems/rift.js).
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from './balance.js';
import { DEX, DEX_BY } from './pokedex.js';
import { SPRITE_META } from './sprites-meta.js';
import { Events } from '../systems/events.js';

export const Enemies = (() => {
  const B = Balance.enemies;
  const RC = RNG.stream('cast');
  const RE = RNG.stream('events');
  const TIERS = [
    { from: 0, bst: [180, 330], hp: 17, spd: 56, dmg: 6, xp: 3.5, cast: 7 },
    { from: 70, bst: [300, 405], hp: 32, spd: 62, dmg: 8.5, xp: 5, cast: 7 },
    { from: 160, bst: [385, 465], hp: 52, spd: 60, dmg: 11, xp: 8, cast: 7 },
    { from: 260, bst: [445, 515], hp: 88, spd: 70, dmg: 14, xp: 13, cast: 7 },
    { from: 380, bst: [495, 560], hp: 150, spd: 66, dmg: 22, xp: 24, cast: 7 },
    { from: 500, bst: [530, 620], hp: 250, spd: 72, dmg: 28, xp: 38, cast: 7 }
  ];

  // Boss bands: minute they appear, base HP and BST band.
  const BOSS_SLOTS = [
    { at: 180, hp: 1400, dmg: 34, xp: 220, bst: [490, 545] },
    { at: 360, hp: 3200, dmg: 42, xp: 420, bst: [520, 580] },
    { at: 540, hp: 5600, dmg: 48, xp: 680, bst: [540, 600] },
    { at: 720, hp: 9000, dmg: 56, xp: 1000, bst: [580, 700] },
    { at: 900, hp: 16000, dmg: 68, xp: 1800, bst: [600, 700] }
  ];

  // Approximate base stats from the game ones (inverse of fetch_pokedex).
  const baseHp = p => (p.hp - 70) / 0.45;
  const baseSpd = p => (p.spd - 78) / 0.42;

  const H = (d, s) => U.hash(d, 7, s);

  // Fixed personalities of some Pokémon.
  const HEAL = new Set([35, 36, 113, 173, 183, 184, 242, 301, 440, 531, 594, 700, 764, 858]);
  const SHIELD = new Set([95, 122, 208, 213, 227, 306, 375, 410, 411, 436, 437, 439, 476, 703]);
  const BOMB = new Set([74, 75, 76, 100, 101, 102, 109, 110, 337, 338, 343, 344]);
  // Summoner -> Pokémon of its pack.
  const SUMMON = {
    15: 13,
    18: 16,
    24: 23,
    28: 27,
    31: 29,
    34: 32,
    42: 41,
    51: 50,
    53: 52,
    57: 56,
    59: 58,
    62: 60,
    68: 66,
    73: 72,
    78: 77,
    82: 81,
    85: 84,
    91: 90,
    117: 116,
    130: 129,
    168: 167,
    169: 41,
    199: 79,
    230: 116,
    262: 261,
    334: 333,
    405: 403,
    416: 415,
    462: 81,
    466: 239,
    553: 551,
    637: 636
  };

  function behaviorOf(p) {
    const t = p.types,
      h = H(p.dex, 11);
    const has = (...xs) => xs.some(x => t.includes(x));
    if (HEAL.has(p.dex)) return 'healer';
    if (SHIELD.has(p.dex)) return 'shielder';
    if (BOMB.has(p.dex)) return 'bomber';
    if (SUMMON[p.dex] && SPRITE_META[SUMMON[p.dex]]) return 'summoner';
    // Swarms: some Bug types call more of their own (from the start).
    if (has('bug') && h >= 0.6 && h < 0.78) return 'summoner';
    if (has('electric', 'psychic', 'dragon', 'ice') && h < 0.18) return 'beamer';
    if (has('fire', 'ground', 'poison') && h < 0.18) return 'zoner';
    if (has('water', 'grass', 'bug', 'fairy') && h >= 0.18 && h < 0.32) return 'fan';
    if (has('fighting', 'ground', 'normal', 'rock') && h >= 0.42 && h < 0.56) return 'jumper';
    if (has('psychic', 'electric', 'ghost', 'fairy') && h < 0.4) return 'ranged';
    if (has('fire', 'water', 'poison', 'ice') && h < 0.22) return 'ranged';
    if (has('fighting', 'normal', 'ground', 'rock', 'dragon', 'steel', 'dark') && h < 0.4) return 'charger';
    if (baseHp(p) > 95 && baseSpd(p) < 50) return 'tank';
    return 'chase';
  }

  /** Builds the enemy definition of a Pokémon for a tier. */
  function defFor(p, tier, ti) {
    const D = B.def;
    const hpK = U.clamp(baseHp(p) / D.hpK.div, D.hpK.min, D.hpK.max);
    const spdK = U.clamp(D.spdK.base + baseSpd(p) / D.spdK.div, D.spdK.min, D.spdK.max);
    const behavior = behaviorOf(p);
    const tank = behavior === 'tank';
    const d = {
      dex: p.dex,
      name: p.name,
      behavior,
      hp: Math.round(tier.hp * hpK * (tank ? D.tank.hp : 1)),
      spd: Math.round(tier.spd * spdK * (tank ? D.tank.spd : 1)),
      dmg: Math.round(tier.dmg * (tank ? D.tank.dmg : 1)),
      xp: Math.max(D.minXp, Math.round(tier.xp * (tank ? D.tank.xp : 1)))
    };
    // Ranged fighters: shot damage, cooldown and distance.
    const CD = D.shotCd(ti);
    if (CD[behavior]) {
      d.shotDmg = Math.round(tier.dmg * (behavior === 'fan' ? D.shotDmg.fan : D.shotDmg.other));
      d.shotCd = +CD[behavior].toFixed(2);
      d.range =
        (behavior === 'beamer' ? D.range.beamer : behavior === 'healer' || behavior === 'summoner' ? D.range.support : D.range.other) +
        ti * D.range.perTier;
    }
    if (behavior === 'summoner') d.minion = SUMMON[p.dex];
    if (behavior === 'fan') d.fanN = D.fanN(ti); // wider fan later on
    if (behavior === 'zoner') d.zones = D.zones(ti); // more zones later on
    if (behavior === 'bomber') {
      d.spd = Math.round(d.spd * D.bomber.spd);
      d.hp = Math.round(d.hp * D.bomber.hp);
    }
    return d;
  }

  /** Every candidate of a tier (no legendaries or mythicals). */
  function candidates(tier) {
    return DEX.filter(p => p.rarity < 5 && p.bst >= tier.bst[0] && p.bst <= tier.bst[1] && SPRITE_META[p.dex]);
  }

  // ---------------- run cast ----------------

  const PLAIN = ['chase', 'charger', 'ranged', 'tank'];
  const SUPPORT = ['healer', 'shielder', 'summoner'];

  /**
   * Cast of a tier: always one "support" (healer, shielder or summoner)
   * and, from the second tier on, also one with telegraphed attacks.
   * The first tier has no other personalities (to learn gradually).
   */
  function castFor(tier) {
    const all = candidates(tier);
    const kind = p => behaviorOf(p);
    // First the support kind (equal odds) and then the Pokémon.
    const kinds = SUPPORT.filter(k => all.some(p => kind(p) === k));
    const sk = kinds.length ? RC.pick(kinds) : null;
    const pick = sk
      ? RC.pickN(
          all.filter(p => kind(p) === sk),
          1
        )
      : [];
    if (tier.from > 0)
      pick.push(
        ...RC.pickN(
          all.filter(p => !PLAIN.includes(kind(p)) && !SUPPORT.includes(kind(p))),
          1
        )
      );
    if (tier.from === 0)
      return pick.concat(
        RC.pickN(
          all.filter(p => !pick.includes(p) && PLAIN.includes(kind(p))),
          tier.cast - pick.length
        )
      );
    return pick.concat(
      RC.pickN(
        all.filter(p => !pick.includes(p)),
        tier.cast - pick.length
      )
    );
  }

  let cast = null; // [{ from, list: [def] }]
  let bosses = null; // [boss def]
  let exclusive = false; // story: only the current leg spawns (not the earlier ones too)

  /** The fastest plain Pokémon of each tier becomes its runner. */
  function markRunners() {
    for (const tier of cast) {
      const plain = tier.list.filter(d => d.behavior === 'chase' || d.behavior === 'charger' || d.behavior === 'tank');
      const r = plain.sort((a, b) => b.spd - a.spd)[0];
      if (r) {
        r.behavior = 'runner';
        r.spd = Math.round(r.spd * B.def.runner.spd);
        r.hp = Math.round(r.hp * B.def.runner.hp);
      }
    }
  }

  /** Boss definition of a Pokémon from a boss slot ({ hp, dmg, xp }). */
  function bossDef(p, slot, at) {
    const BB = B.boss;
    return {
      at,
      dex: p.dex,
      name: p.name,
      hp: Math.round(slot.hp * BB.hp),
      spd: Math.round(U.clamp(BB.spd.base + baseSpd(p) * BB.spd.k, BB.spd.min, BB.spd.max)),
      dmg: Math.round(slot.dmg * BB.dmg),
      xp: slot.xp,
      behavior: behaviorOf(p) === 'ranged' ? 'ranged' : baseSpd(p) > BB.chargerSpd ? 'charger' : 'chase',
      shotDmg: Math.round(slot.dmg * BB.shotDmg),
      shotCd: BB.shotCd,
      range: BB.range
    };
  }

  // Before the first boss slot (story stages put bosses there): a gentler starting point.
  const BOSS_ZERO = { at: 0, hp: 700, dmg: 26, xp: 120 };
  /** A boss slot at endless second `t`, interpolated between BOSS_SLOTS (story mode). */
  function bossAt(t) {
    const pts = [BOSS_ZERO, ...BOSS_SLOTS];
    let i = 0;
    while (i < pts.length - 2 && t > pts[i + 1].at) i++;
    const a = pts[i],
      b = pts[i + 1],
      k = U.clamp((t - a.at) / (b.at - a.at), 0, 1);
    const mix = key => a[key] + (b[key] - a[key]) * k;
    return { hp: mix('hp'), dmg: mix('dmg'), xp: Math.round(mix('xp')) };
  }

  /** Rolls the cast of a new run. */
  function rollRun() {
    exclusive = false;
    cast = TIERS.map((tier, ti) => ({
      from: tier.from,
      list: castFor(tier).map(p => defFor(p, tier, ti))
    }));
    markRunners();
    const used = new Set();
    const BB = B.boss;
    bosses = BOSS_SLOTS.map(slot => {
      const ok = p => !p.leg && SPRITE_META[p.dex] && !used.has(p.dex);
      let pool = DEX.filter(p => ok(p) && p.bst >= slot.bst[0] && p.bst <= slot.bst[1]);
      if (!pool.length) pool = DEX.filter(p => ok(p) && p.bst >= BB.fallbackBst);
      const p = RC.pick(pool);
      used.add(p.dex);
      return bossDef(p, slot, slot.at);
    });
    return { cast, bosses };
  }

  /**
   * The cast of a story stage (data/stages.js): each leg's Pokémon with the tier
   * template of its endless-equivalent second, and its mini-bosses.
   * @param eq  stage second -> endless second (systems/story.js)
   */
  function rollStory(stage, eq) {
    exclusive = true;
    cast = stage.legs.map(leg => {
      const ti = tierAt(eq(leg.from));
      const list = leg.mons
        .map(d => DEX_BY[d])
        .filter(p => p && SPRITE_META[p.dex])
        .map(p => defFor(p, TIERS[ti], ti));
      return { from: leg.from, list };
    });
    markRunners();
    const M = Balance.story.mini;
    bosses = (stage.minis || [])
      .filter(m => DEX_BY[m.dex] && SPRITE_META[m.dex])
      .map(m => {
        const slot = bossAt(eq(m.at));
        return Object.assign(bossDef(DEX_BY[m.dex], { hp: slot.hp * M.hp, dmg: slot.dmg * M.dmg, xp: slot.xp }, m.at), { mini: true });
      });
    return { cast, bosses };
  }

  /** Difficulty multipliers at second `t` (curve in Balance.enemies.scale). */
  function scale(t) {
    return B.scale(t);
  }

  /** Boss multipliers at second `t` (much gentler: bosses already have increasing base HP). */
  function bossScale(t) {
    return B.bossScale(t);
  }

  /** Tier active at second `t`. */
  function tierAt(t) {
    let ti = 0;
    TIERS.forEach((tr, i) => {
      if (t >= tr.from) ti = i;
    });
    return ti;
  }

  const NO_HORDE = new Set(['bomber', 'healer', 'shielder', 'summoner']);
  /** Types with enough Pokémon in the current tier for a horde (events.js). */
  function hordeTypes(t) {
    const all = candidates(TIERS[tierAt(t)]).filter(p => !NO_HORDE.has(behaviorOf(p)));
    return Object.keys(U.TYPE_COLOR).filter(ty => all.filter(p => p.types.includes(ty)).length >= B.horde.minPerType);
  }
  /** Up to B.horde.size Pokémon of a type, with the current tier's stats. */
  function hordeDefs(type, t) {
    const ti = tierAt(t);
    const pool = candidates(TIERS[ti]).filter(p => p.types.includes(type) && !NO_HORDE.has(behaviorOf(p)));
    return RE.pickN(pool, B.horde.size).map(p => defFor(p, TIERS[ti], ti));
  }

  /** Bag of enemies available at second `t`. */
  function bagAt(t) {
    // During a single-type horde only that type appears (systems/events.js).
    const horde = Events && Events.bag();
    if (horde) return horde;
    if (!cast) rollRun();
    const bag = [];
    const cur = exclusive ? cast.filter(tier => t >= tier.from).pop() : null;
    for (const tier of cast) {
      if (t < tier.from || (cur && tier !== cur)) continue;
      const w = t - tier.from > B.bag.oldAfter ? B.bag.oldWeight : B.bag.weight; // old tiers lose weight
      for (const e of tier.list) for (let i = 0; i < w; i++) bag.push(e);
    }
    return bag.length ? bag : cast[0].list;
  }

  /** dex numbers of the cast that will appear soon (to preload sprites). */
  function upcomingDex(t, ahead = 60) {
    if (!cast) rollRun();
    const out = [];
    for (const tier of cast) if (tier.from <= t + ahead) for (const e of tier.list) out.push(e.dex);
    for (const b of bosses) if (b.at <= t + ahead) out.push(b.dex);
    return out;
  }

  return {
    TIERS,
    BOSS_SLOTS,
    rollRun,
    rollStory,
    bossAt,
    bossDef,
    scale,
    bossScale,
    bagAt,
    upcomingDex,
    candidates,
    hordeTypes,
    hordeDefs,
    get BOSSES() {
      if (!bosses) rollRun();
      return bosses;
    },
    get cast() {
      if (!cast) rollRun();
      return cast;
    }
  };
})();
