/* ============ weather.js — weather (rare event) ============
 * Every now and then (from minute 2, ~1 in every 6 minutes) a weather arrives
 * that lasts about a minute. It changes damage by the attack's type,
 * for you and for the enemies (numbers in Balance.weather):
 *
 *   sun      Fire ×1.5 · Water ×0.5
 *   rain     Water ×1.5 · Electric ×1.2 · Fire ×0.5
 *   sand     Rock, Ground and Steel ×1.3; everyone else loses a little HP
 *   snow     Ice ×1.5; everyone else loses a little HP and is a bit slower
 *   fog      Ghost, Fairy and Psychic ×1.3
 *
 * Each biome has its more likely weathers (the volcano: sun and sand...).
 * The visuals are subtle on purpose: a light tint and few particles.
 *
 * Co-op: the host decides it and sends it with 'wx'.
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Sync } from '../net/sync.js';
import { Balance } from '../data/balance.js';
import { Types } from '../data/types.js';
import { Audio } from '../core/audio.js';
import { World } from '../world/world.js';
import { FX } from '../entities/fx.js';
import { EnemyMgr } from '../entities/enemy.js';
import { Spawner } from './spawner.js';
import { Rift } from './rift.js';
import { Judgment } from './judgment.js';
import { Coop } from '../net/coop.js';
import { Progress } from './progress.js';

export const Weather = (() => {
  const KINDS = {
    sun: {
      name: 'Harsh sunlight',
      icon: 'wsun',
      color: '#ffcb3d',
      tint: [255, 190, 90, 0.07],
      hint: 'Fire is boosted and Water is weakened'
    },
    rain: {
      name: 'Rain',
      icon: 'wrain',
      color: '#7fb8ff',
      tint: [50, 90, 170, 0.09],
      hint: 'Water is boosted and Fire is weakened'
    },
    sand: {
      name: 'Sandstorm',
      icon: 'wsand',
      color: '#e0bf73',
      tint: [200, 160, 90, 0.09],
      hint: 'Rock, Ground and Steel are boosted; the rest suffer'
    },
    snow: {
      name: 'Snowfall',
      icon: 'wsnow',
      color: '#d8f1ff',
      tint: [210, 230, 255, 0.08],
      hint: 'Ice is boosted; the rest suffer and slow down'
    },
    fog: {
      name: 'Fog',
      icon: 'wfog',
      color: '#c9cfdc',
      tint: [190, 195, 210, 0.12],
      hint: 'Ghost, Fairy and Psychic are boosted'
    }
  };
  // (Display only: what each weather does is in Balance.weather.kinds.)
  const B = Balance.weather;
  const R = RNG.stream('weather');

  let cur = null; // { kind, t, dur }
  let checkT = B.check,
    chipT = 0;
  let parts = [];
  const authority = () => !Coop.active || Coop.isHost;

  function reset() {
    cur = null;
    checkT = B.check;
    chipT = 0;
    parts = [];
  }

  function def() {
    return cur ? KINDS[cur.kind] : null;
  }
  /** The current weather's effects (Balance.weather.kinds). */
  function rules() {
    return cur ? B.kinds[cur.kind] : null;
  }

  /** Damage multiplier for an attack of this type under the current weather. */
  function mult(type) {
    const d = rules();
    return d && d.mult && d.mult[type] ? 1 + (d.mult[type] - 1) * level() : 1;
  }

  /** Full damage multiplier of an attack: type chart × weather (used for every hit, both ways). */
  function attackMult(atk, def) {
    return Types.mult(atk, def) * mult(atk);
  }

  /** Intensity 0..1 (fades in and out over B.fade s). */
  function level() {
    if (!cur) return 0;
    return Math.min(1, cur.t / B.fade, (cur.dur - cur.t) / B.fade);
  }

  /** Is a Pokémon with these types immune to this weather's chip damage and slowdown? */
  function safe(d, types) {
    return !!(d.safe && types.some(t => d.safe.includes(t)));
  }

  /** Does sand/snow chip damage affect a Pokémon with these types? */
  function hurts(types) {
    const d = rules();
    return !!(d && d.safe && !safe(d, types));
  }

  /** Speed factor (snow) for a Pokémon with these types. */
  function speedFor(types) {
    const d = rules();
    return d && d.slow && !safe(d, types) ? 1 - d.slow * level() : 1;
  }

  function start(kind, dur) {
    cur = { kind, t: 0, dur };
    const d = KINDS[kind];
    Spawner.say(`${d.name}: ${d.hint}`, 3.4, true);
    Audio.sfx('biome');
  }

  function stop() {
    if (!cur) return;
    // Let it fade out.
    cur.dur = Math.min(cur.dur, cur.t + B.fade);
  }

  function pick(biome) {
    const w = B.biome[biome % B.biome.length];
    let r = R.next() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const k in w) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'rain';
  }

  function update(dt, time, pl) {
    if (cur) {
      cur.t += dt;
      if (cur.t >= cur.dur) {
        // Lived through it to the end: counts for "Storm chaser" (data/achievements.js).
        if (pl && !pl.dead) Progress.weatherSeen(cur.kind);
        cur = null;
      }
    } else if (authority() && time > B.from && !Rift.inArena && !Judgment.active) {
      checkT -= dt;
      if (checkT <= 0) {
        checkT = B.check;
        if (R.chance(B.chance)) {
          const kind = pick(World.biome),
            dur = Math.round(R.range(B.dur[0], B.dur[1]));
          start(kind, dur);
          if (Coop.isHost) Coop.broadcast(['wx', kind, dur]);
        }
      }
    }
    // Sand and snow: they chip a little HP off you (never down to KO).
    chipT -= dt;
    if (chipT <= 0) {
      chipT = B.chipEvery;
      if (pl && !pl.dead && hurts(pl.mon.types) && level() > B.chipLevel) {
        const d = Math.max(1, pl.maxHp * B.chipPlayer);
        if (pl.hp > d + 1) {
          pl.hp -= d;
          pl.noteHit();
          FX.dmgText(pl.x, pl.y - pl.bodyH - 4, '-' + Math.round(d), def().color);
        }
      }
      if (authority() && cur && rules().safe && level() > B.chipLevel) {
        for (const e of EnemyMgr.all()) {
          if (e.dead || e.remote || e.boss) continue;
          if (!hurts(e.types || [])) continue;
          e.hp -= e.maxHp * B.chipEnemy + 1;
          e.flash = 0.05;
          if (e.hp <= 0) e.die();
        }
      }
    }
  }

  /** Co-op: the host sends the weather. */
  function onEvent(ev) {
    if (ev[1]) start(ev[1], ev[2]);
    else stop();
  }
  Sync.on('wx', onEvent);

  // ---------------- drawing (screen space) ----------------

  /** Soft particles and a light tint. Called after the world is drawn. */
  function draw(ctx, w, h, dt) {
    const d = def();
    const k = level();
    if (!d || k <= 0) {
      parts.length = 0;
      return;
    }
    const [r, g, b, a] = d.tint;
    ctx.fillStyle = `rgba(${r},${g},${b},${a * k})`;
    ctx.fillRect(0, 0, w, h);

    const want = { rain: 70, snow: 45, sand: 40, sun: 14, fog: 0 }[cur.kind] * k * (w / 1280);
    while (parts.length < want) parts.push(spawn(w, h, true));
    if (parts.length > want + 4) parts.length = Math.ceil(want);
    const s = Math.max(2, Math.round(w / 640)); // one game "pixel"
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.t += dt;
      if (p.y > h + 20 || p.x < -40 || p.x > w + 40 || p.t > p.life) {
        parts[i] = spawn(w, h, false);
        continue;
      }
      ctx.globalAlpha = p.a * k;
      ctx.fillStyle = p.c;
      if (cur.kind === 'rain') {
        for (let j = 0; j < 4; j++) ctx.fillRect(Math.round(p.x - j * s * 0.5), Math.round(p.y - j * s * 1.5), s * 0.5, s * 1.5);
      } else if (cur.kind === 'sand') ctx.fillRect(Math.round(p.x), Math.round(p.y), s * 3, s * 0.5);
      else ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  function spawn(w, h, anywhere) {
    const kind = cur.kind;
    const y = anywhere ? Math.random() * h : -10;
    if (kind === 'rain') return { x: Math.random() * (w + 200), y, vx: -120, vy: 720, a: 0.5, c: '#cfe2ff', t: 0, life: 9 };
    if (kind === 'snow') return { x: Math.random() * w, y, vx: U.rand(-20, 20), vy: U.rand(40, 80), a: 0.7, c: '#ffffff', t: 0, life: 20 };
    if (kind === 'sand')
      return {
        x: anywhere ? Math.random() * w : w + 20,
        y: Math.random() * h,
        vx: U.rand(-520, -380),
        vy: U.rand(20, 60),
        a: 0.4,
        c: '#e8cf8f',
        t: 0,
        life: 9
      };
    // sun: specks of light slowly rising
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 5,
      vx: U.rand(-8, 8),
      vy: -U.rand(15, 30),
      a: 0.45,
      c: '#fff1b0',
      t: 0,
      life: 12
    };
  }

  return {
    KINDS,
    attackMult,
    reset,
    update,
    draw,
    mult,
    speedFor,
    hurts,
    onEvent,
    get current() {
      return cur && level() > 0 ? Object.assign({ left: Math.max(0, cur.dur - cur.t) }, cur, KINDS[cur.kind]) : null;
    },
    get vignette() {
      return cur && cur.kind === 'fog' ? level() : 0;
    },
    /** Sets a weather right away (the rift arena; not broadcast: each player sets it). */
    force(kind, dur) {
      start(kind, dur);
    },
    /** Clears the weather at once (when leaving the arena). */
    clear() {
      cur = null;
      parts.length = 0;
    },
    debugStart(kind = 'rain', dur = 60) {
      start(kind, dur);
      if (Coop.isHost) Coop.broadcast(['wx', kind, dur]);
    }
  };
})();
