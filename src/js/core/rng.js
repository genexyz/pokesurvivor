/* ============ rng.js — seeded random numbers for runs ============
 * Every run has a seed (RNG.seed). Gameplay randomness goes through named
 * streams, each seeded from the run seed and its own name, so the same seed
 * gives the same map, enemy cast, bosses, events, loot and level-up offers.
 * One stream per system: an extra roll in one system never shifts another.
 *
 *   const R = RNG.stream('spawn');   // once, at module level
 *   R.next()  R.range(a, b)  R.int(a, b)  R.chance(p)  R.pick(arr)  R.pickN(arr, n)  R.angle()
 *
 * Streams in use: cast (enemy roster and bosses), spawn, enemy (AI choices),
 * loot, scatter (where drops land), levelup, events, rift, judgment, hazards,
 * weather, combat.
 *
 * Purely visual randomness (particles, sparkles, sounds) keeps using
 * Math.random / U.rand: it must not consume gameplay rolls.
 *
 * The frame time is variable, so two runs with the same seed only stay
 * identical as far as the rolls go: what you do in them still changes the run.
 *
 * Co-op: the host simulates the run, so only the host's streams matter; the
 * seed travels in the 'start' message (net/coop.js).
 */
export const RNG = (() => {
  /** FNV-1a: stream name -> 32-bit number. */
  function hashName(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  class Stream {
    constructor(name) {
      this.name = name;
      this.s = 1;
    }
    reseed(base) {
      this.s = (base ^ hashName(this.name)) >>> 0 || 1;
    }
    /** mulberry32 -> [0, 1). */
    next() {
      let t = (this.s = (this.s + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
      return a + this.next() * (b - a);
    }
    /** Integer in [a, b], both included. */
    int(a, b) {
      return Math.floor(a + this.next() * (b - a + 1));
    }
    chance(p) {
      return this.next() < p;
    }
    angle() {
      return this.next() * Math.PI * 2;
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    /** n distinct elements. */
    pickN(arr, n) {
      const c = arr.slice(),
        out = [];
      while (out.length < n && c.length) out.push(c.splice(Math.floor(this.next() * c.length), 1)[0]);
      return out;
    }
    /** Index into `weights` with probability proportional to each weight. */
    weighted(weights) {
      let total = 0;
      for (const w of weights) total += w;
      let x = this.next() * total;
      for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) < 0) return i;
      return weights.length - 1;
    }
  }

  const streams = new Map();
  let seed = randomSeed(),
    custom = false;

  function randomSeed() {
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }

  /** The stream of a system (the same object for the whole session: start() reseeds it). */
  function stream(name) {
    let s = streams.get(name);
    if (!s) {
      s = new Stream(name);
      s.reseed(seed);
      streams.set(name, s);
    }
    return s;
  }

  /**
   * Starts a run's randomness.
   * @param s       the seed (random if omitted)
   * @param chosen  the player picked it (shared seed, dev panel): see `custom`
   */
  function start(s = randomSeed(), chosen = false) {
    seed = s >>> 0;
    custom = !!chosen;
    for (const st of streams.values()) st.reseed(seed);
    return seed;
  }

  /** Seed <-> short code that can be shared ("1K9ZQ3"). */
  function code(s = seed) {
    return (s >>> 0).toString(36).toUpperCase();
  }
  function parse(str) {
    const t = String(str || '')
      .trim()
      .toLowerCase();
    if (!/^[0-9a-z]{1,7}$/.test(t)) return null;
    const n = parseInt(t, 36);
    return n >= 0 && n < 4294967296 ? n >>> 0 : null;
  }

  return {
    stream,
    start,
    randomSeed,
    code,
    parse,
    Stream,
    get seed() {
      return seed;
    },
    /** The run uses a seed the player chose (it doesn't count for the leaderboard). */
    get custom() {
      return custom;
    }
  };
})();
