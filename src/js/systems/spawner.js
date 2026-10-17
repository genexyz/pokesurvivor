/* ============ spawner.js — waves, bosses and shinies ============
 * Enemies appear on a ring just outside the view, so they never
 * materialize on screen. Every ~45 s there is a "swarm": a concentrated
 * rush from one specific side, to break the rhythm.
 *
 * Each enemy has a 1/4096 chance of being shiny (as in the classic games;
 * Balance.spawn.shinyRate).
 * A run kills 1,500–4,000, so one shows up every 1–3 runs.
 *
 * Co-op (host only): they appear around a random living player, out of
 * EVERYONE's view, and there are more and stronger ones the more of you
 * are playing (see Coop.scaleRate / scaleHp).
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { Enemies } from '../data/enemies.js';
import { Perks } from '../data/perks.js';
import { World } from '../world/world.js';
import { Enemy, EnemyMgr } from '../entities/enemy.js';
import { Rift } from './rift.js';
import { Judgment } from './judgment.js';
import { Events } from './events.js';
import { Story } from './story.js';
import { Coop } from '../net/coop.js';
import { Game } from '../game.js';

export const Spawner = (() => {
  // Tuning (cap and elites, density, hp curve, spawn rate, swarms, shiny rate)
  // lives in Balance.spawn. The cap was 420 once: that many slowed it down.
  // Past the elite threshold new spawns are "elite", so the difficulty doesn't drop.
  const B = Balance.spawn;
  const R = RNG.stream('spawn');
  let acc = 0,
    bossIdx = 0,
    surgeT = B.swarm.first,
    announce = null,
    announceT = 0,
    preloadT = 0;

  /**
   * A shiny roll with a debug override (the next N rolls come out shiny).
   * Shared with gacha.js, which rolls with Math.random and its own rate.
   * @param rateOf  () => chance (read at roll time)
   * @param rand    () => number in [0, 1)
   */
  function shinyRoller(rateOf, rand) {
    let forced = 0;
    return {
      roll: () => (forced > 0 ? (forced--, true) : rand() < rateOf()),
      force(n = 1) {
        forced = n;
      }
    };
  }
  /** Shiny Charm: a shiny partner (anyone's, in co-op) multiplies the wild shiny rate. */
  const charmK = () => (players.some(p => p.shiny) ? B.shinyCharm : 1);
  const shinies = shinyRoller(
    () => B.shinyRate * charmK() * (Perks.on('shiny') ? Perks.B.shiny : 1),
    () => R.next()
  );

  function reset() {
    acc = 0;
    bossIdx = 0;
    surgeT = B.swarm.first;
    announce = null;
    announceT = 0;
    preloadT = 0;
    if (Story.active) Story.rollCast();
    else Enemies.rollRun();
    Sprites.preload(Enemies.upcomingDex(0, 80));
  }

  // Story mode: a stage second plays like endless second Story.eq(t) (Balance.story).
  const SB = Balance.story;
  const cap = () => (Story.active ? SB.cap : B.cap);

  /** Enemies per second based on the run's minute. */
  function rate(t) {
    return B.rate(t);
  }

  function ringPoint(pl, angle) {
    const d = Camera.outerRadius() + R.range(B.ring.min, B.ring.max);
    return [pl.x + Math.cos(angle) * d, pl.y + Math.sin(angle) * d * 0.9];
  }

  let players = [];

  /** Would any player see it? (so nothing pops up in front of anyone) */
  function seenByAnyone(x, y) {
    const r = Camera.outerRadius() - 30;
    return players.some(o => U.dist2(o.x, o.y, x, y) < r * r);
  }

  /** A point on the ring where it fits: not inside walls or in water. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : R.range(-B.ringJitter, B.ringJitter));
      const [x, y] = ringPoint(pl, a);
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      if (flying || World.isFree(x, y, 14)) return [x, y];
    }
    return null;
  }

  /** Player around whom the next enemy spawns. */
  function anchor() {
    const alive = players.filter(o => !o.dead);
    return alive.length ? R.pick(alive) : players[0];
  }

  function scaled(sc, k) {
    return k === 1 ? sc : Object.assign({}, sc, { hp: sc.hp * k });
  }

  function isFlyer(def) {
    return Sprites.hovers(def.dex);
  }

  function rollShiny(dex) {
    if (!Sprites.hasShiny(dex)) return false;
    return shinies.roll();
  }

  function spawnOne(pl, t, angle) {
    const def = R.pick(Enemies.bagAt(t));
    const pt = freePoint(pl, angle == null ? R.angle() : angle, isFlyer(def));
    if (!pt) return null;
    const shiny = rollShiny(def.dex);
    const et = Story.eq(t);
    const e = new Enemy(def, pt[0], pt[1], scaled(Enemies.scale(et), Coop.scaleHp(players.length) * B.hpK(et)));
    e.dmg *= B.dmgK;
    e.xp = Math.round(e.xp * B.xpK * (Story.active ? SB.xpK : 1));
    if (EnemyMgr.count >= cap() * B.eliteFrom) {
      e.maxHp = e.hp = Math.round(e.maxHp * B.elite.hp);
      e.dmg *= B.elite.dmg;
      e.xp = Math.round(e.xp * B.elite.xp);
    }
    if (shiny) e.makeShiny();
    if (Events.golden) e.makeGolden();
    EnemyMgr.add(e);
    if (shiny) {
      say(`A shiny ${e.name} is nearby!`, 3.4);
      Audio.sfx('shiny');
    }
    return e;
  }

  function spawnBoss(pl, t, b) {
    const [x, y] = ringPoint(pl, R.angle());
    const k = Coop.scaleHp(players.length) * (players.length > 1 ? Balance.coop.bossHp : 1);
    const e = new Enemy(b, x, y, scaled(Enemies.bossScale(Story.eq(t)), k), true);
    if (rollShiny(b.dex)) e.makeShiny();
    EnemyMgr.add(e);
    say(e.shiny ? `A wild shiny ${e.name} appeared!` : `A wild ${e.name} appeared!`, 3.2);
    Camera.kick(1.1);
    Audio.sfx('boss');
    return e;
  }

  /** @param who  the player or the list of players (co-op) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    if (announceT > 0) announceT -= dt;
    // Nothing else spawns in the rift arena (and the boss clock waits), nor in a story gym.
    // During Arceus's Judgment, only its legendaries (systems/judgment.js).
    if (Rift.inArena || Judgment.active || Story.inGym) return;
    const et = Story.eq(t),
      density = Story.active ? SB.density * (Story.active.density || 1) : 1;

    // Preload whatever will spawn in the next minute.
    preloadT -= dt;
    if (preloadT <= 0) {
      preloadT = 10;
      Sprites.preload(Enemies.upcomingDex(t, 60));
    }

    // --- bosses ---
    const b = Enemies.BOSSES[bossIdx];
    if (b && t >= b.at) {
      spawnBoss(anchor(), t, b);
      bossIdx++;
    }

    // Boss fight: waves drop (B.bossFightRate) and there are no swarms, so the boss
    // gets its own moment and can be targeted through the crowd.
    const bossFight = EnemyMgr.bossAlive();

    // --- normal trickle ---
    if (EnemyMgr.count < cap()) {
      acc += B.rate(et) * density * Coop.scaleRate(players.length) * (bossFight ? B.bossFightRate : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && EnemyMgr.count < cap()) spawnOne(anchor(), t);
    }

    // --- swarm ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      const S = B.swarm;
      surgeT = R.range(S.every[0], S.every[1]);
      const base = R.angle();
      const target = anchor();
      const n = Math.min(
        cap() - EnemyMgr.count,
        Math.round((S.base + Math.floor(et / S.growEvery)) * Coop.scaleRate(players.length) * S.k)
      );
      for (let i = 0; i < n; i++) spawnOne(target, t, base + R.range(-S.spread, S.spread));
      say('Pokémon swarm!', 2.2);
      Audio.sfx('surge');
    }
  }

  /** A bunch at once from one side (when a horde starts). */
  function burst(n) {
    const base = R.angle(),
      target = anchor() || Game.player,
      t = Game.st.time,
      S = B.burst;
    for (let i = 0; i < n && EnemyMgr.count < cap() + S.overCap; i++) spawnOne(target, t, base + R.range(-S.spread, S.spread));
  }

  /**
   * A straggler respawns ahead of the player (where they're running),
   * out of view. Returns false if there's no room (then it is removed).
   */
  function ahead(e, pl) {
    if (!players.length) players = [pl];
    const sp = Math.hypot(pl._vx || 0, pl._vy || 0);
    const a0 = sp > 20 ? Math.atan2(pl._vy, pl._vx) : R.angle();
    const pt = freePoint(pl, a0 + R.range(-B.ringJitter, B.ringJitter), e.flying);
    if (!pt) return false;
    e.x = pt[0];
    e.y = pt[1];
    e.kx = e.ky = 0;
    e.phase = 'walk';
    e.pt = 0;
    e.jump = null;
    e.jumpLift = 0;
    return true;
  }

  /** Big on-screen announcement (also used by biomes and shinies). */
  /** @param local  only on this computer (not sent to teammates) */
  function say(text, secs = 2.6, local = false) {
    announce = text;
    announceT = secs;
    if (Coop.isHost && !local) Coop.say(text, secs);
  }

  function banner() {
    return announceT > 0 ? { text: announce, t: announceT } : null;
  }

  /** Co-op guest: only ticks the announcement timer. */
  function tickBanner(dt) {
    if (announceT > 0) announceT -= dt;
  }

  return {
    reset,
    update,
    ahead,
    burst,
    tickBanner,
    banner,
    say,
    rate,
    shinyRoller,
    get SHINY_RATE() {
      return B.shinyRate;
    },
    /** Shiny Charm multiplier right now (1 without a shiny partner). */
    get shinyCharmK() {
      return charmK();
    },
    get CAP() {
      return cap();
    },
    debugForceShiny(n = 1) {
      shinies.force(n);
    },
    /** Dev panel: the next scheduled boss, right now (the schedule doesn't move). */
    debugBoss() {
      const list = Enemies.BOSSES;
      return spawnBoss(anchor() || Game.player, Game.st.time, list[Math.min(bossIdx, list.length - 1)]);
    }
  };
})();
