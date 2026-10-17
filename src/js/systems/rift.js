/* ============ rift.js — rifts and the legendary arena ============
 *
 * Every now and then (a few times per run) a RIFT opens near a
 * player. It lasts Balance.rift.ttl seconds; if you enter, it takes you (with the whole group)
 * to a closed arena in the Distortion World, against a LEGENDARY Pokémon.
 *
 *   win      the legendary drops tickets (the ×10 one, half of the time) and coins, and everyone gets a
 *            BOND (fuses moves, see Player.fuse); a few
 *            seconds later you're back on the map where you were and pick the fusion
 *   lose     (everyone falls or time runs out) you go back with no reward, with some
 *            HP; the run goes on
 *
 * While the arena lasts, the map's enemies are stashed (EnemyMgr.stash) and
 * no new ones spawn; on return everything is as it was.
 *
 * Co-op: the host decides. Messages (see coop.js):
 *   'rift' x y ttl · 'riftx' · 'arena' cfg · 'aw' (won) · 'al' (lost)
 *   and from guest to host 're' (I entered the rift).
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Sync } from '../net/sync.js';
import { Balance } from '../data/balance.js';
import { DEX, DEX_BY } from '../data/pokedex.js';
import { SPRITE_META } from '../data/sprites-meta.js';
import { DB } from '../core/db.js';
import { Perks } from '../data/perks.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { Tiles } from '../world/tiles.js';
import { World } from '../world/world.js';
import { FX } from '../entities/fx.js';
import { Projectiles } from '../entities/projectile.js';
import { Enemy, EnemyMgr } from '../entities/enemy.js';
import { Pickups } from '../entities/pickup.js';
import { Combat } from './combat.js';
import { Spawner } from './spawner.js';
import { Judgment } from './judgment.js';
import { Weather } from './weather.js';
import { Progress } from './progress.js';
import { Hazards } from './hazards.js';
import { Coop } from '../net/coop.js';
import { Game } from '../game.js';

export const Rift = (() => {
  // Tuning in Balance.rift. Each failed attempt makes the next one more
  // likely (20%, 40%, 60%, 80%, 100%): at most 2.5 min without a rift.
  // From 2 min before Arceus's Judgment (minute 30) they no longer open.
  const B = Balance.rift;
  const R = RNG.stream('rift');
  let rift = null; // { x, y, ttl, t }
  let arena = null; // { tx, ty, r, dex, shiny, x, y, back, biome, t, phase, endT, bossId }
  let checkT = B.check,
    asked = false,
    downT = 0,
    misses = 0;
  const authority = () => !Coop.active || Coop.isHost;

  function reset() {
    rift = null;
    arena = null;
    checkT = B.check;
    asked = false;
    downT = 0;
    misses = 0;
  }

  // ---------------- rift on the map ----------------

  function update(dt, pl, time) {
    if (rift) {
      rift.t += dt;
      rift.ttl -= dt;
      if (rift.ttl <= 0) {
        rift = null;
        return;
      }
      if (!arena && !pl.dead && U.dist2(pl.x, pl.y, rift.x, rift.y - 10) < B.enterR * B.enterR) enter();
    } else if (!arena && authority() && time > B.from && time < Judgment.AT - B.stopBeforeJudgment) {
      checkT -= dt;
      if (checkT <= 0) {
        checkT = B.check;
        if (EnemyMgr.bossAlive()) return; // with a boss alive it doesn't count as an attempt
        if (R.chance(B.chance * (1 + misses))) {
          misses = 0;
          open();
        } else misses++;
      }
    }
    if (arena) arenaTick(dt, pl);
  }

  function open() {
    const alive = Game.everyone().filter(p => !p.dead);
    const near = R.pick(alive.length ? alive : [Game.player]);
    for (let i = 0; i < 24; i++) {
      const a = R.angle(),
        d = R.range(B.openDist[0], B.openDist[1]);
      const x = near.x + Math.cos(a) * d,
        y = near.y + Math.sin(a) * d * 0.85;
      if (!World.isFree(x, y, 22)) continue;
      const ttl = B.ttl + (Perks.on('rift') ? Perks.B.riftTtl : 0); // Rift sense perk
      show(x, y, ttl);
      if (Coop.isHost) Coop.broadcast(['rift', Math.round(x), Math.round(y), ttl]);
      return;
    }
  }

  /** The rift appears (also the one sent by the host). */
  function show(x, y, ttl) {
    rift = { x, y, ttl, t: 0 };
    asked = false;
    // (The big warning is drawn by hud.js while rift.t < 4.5 s.)
    Audio.sfx('rift');
    FX.ring(x, y, 6, 80, '#b48aff', 0.7, 5);
  }

  function enter() {
    if (asked) return;
    asked = true;
    if (authority()) start();
    else Coop.toHost(['re']);
  }

  // ---------------- arena ----------------

  /** Authority: picks the legendary and place, and tells everyone. */
  let nextType = null; // tests/videos: type of the next arena

  function start(forceType) {
    if (arena) return;
    forceType = forceType || nextType;
    nextType = null;
    let pool = DEX.filter(p => p.leg && SPRITE_META[p.dex]);
    if (forceType && pool.some(p => p.types.includes(forceType))) pool = pool.filter(p => p.types.includes(forceType));
    // Legendaries you haven't beaten yet show up more often (fewer repeats).
    const beaten = (DB.save && DB.save.legends) || {};
    const mon = pool[R.weighted(pool.map(p => (beaten[p.dex] ? 1 : B.unbeatenWeight)))];
    const cfg = {
      tx: 5000 + Math.floor(R.next() * 3000),
      ty: 5000 + Math.floor(R.next() * 3000),
      r: B.arenaR,
      dex: mon.dex,
      shiny: Sprites.hasShiny(mon.dex) && R.chance(B.shinyChance * Spawner.shinyCharmK),
      // The arena matches one of its types, at random.
      type: forceType || R.pick(mon.types)
    };
    if (Coop.isHost) Coop.broadcast(['arena', cfg]);
    begin(cfg);
    spawnLegend();
  }

  /** On each computer: travel to the arena. */
  function begin(cfg) {
    const pl = Game.player;
    const ts = World.TS;
    arena = Object.assign({}, cfg, {
      x: cfg.tx * ts + ts / 2,
      y: cfg.ty * ts + ts / 2,
      back: { x: pl.x, y: pl.y },
      biome: World.biome,
      t: 0,
      phase: 'fight',
      endT: 0,
      bossId: 0
    });
    rift = null;
    asked = false;
    downT = 0;
    if (authority()) EnemyMgr.stash();
    else EnemyMgr.clearRemote();
    Projectiles.clear();
    Combat.clearFields();
    Hazards.clear();
    World.setArena({ tx: cfg.tx, ty: cfg.ty, r: cfg.r, type: cfg.type });
    World.setBiome(Tiles.arenaBiome(cfg.type), true);
    // Each arena brings its weather (volcano: sun; glacier: snow...).
    const th = Tiles.ARENA_THEMES[cfg.type];
    if (th && th.weather) Weather.force(th.weather, B.arenaTime + B.weatherExtra);
    // Everyone lined up at the south of the arena; the legendary appears at the north.
    lineUp(arena.x, arena.y);
    Camera.x = pl.x;
    Camera.y = pl.y;
    Game.flash('#c9a6ff', 0.9);
    Audio.sfx('rift');
    Spawner.say('You entered the rift…', 2.4, true);
  }

  function spawnLegend() {
    const mon = DEX_BY[arena.dex];
    const t = Game.st.time;
    const n = Game.everyone().length;
    const def = legendDef(mon, t, B.legend.hp(t) * Coop.scaleHp(n) * (n > 1 ? Balance.coop.bossHp : 1), 1);
    const e = new Enemy(def, arena.x, arena.y - World.TS * B.legendNorth, { hp: 1, spd: 1, dmg: 1 }, true);
    e.legend = true;
    // It collides with walls and pillars like you: if it flew over the
    // rocks, your shots couldn't reach it (Celebi bug).
    e.flying = false;
    if (arena.shiny) e.makeShiny();
    EnemyMgr.add(e);
    arena.bossId = e.id;
    Spawner.say(e.shiny ? `A shiny ${e.name} was waiting in the rift!` : `${e.name} was waiting in the rift!`, 3.2);
    Camera.kick(1.1);
    Audio.sfx('boss');
  }

  /**
   * A legendary's enemy definition (the rift's; the Judgment's with `k` > 1).
   * @param hp  its HP (already scaled)
   * @param k   multiplier for its damage
   */
  function legendDef(mon, t, hp, k) {
    const L = B.legend;
    return {
      dex: mon.dex,
      name: mon.name,
      hp: Math.round(hp),
      spd: Math.round(L.spd(mon)),
      dmg: Math.round(L.dmg(t) * k),
      xp: Math.round(L.xp(t)),
      behavior: mon.types.some(x => L.rangedTypes.includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round(L.shotDmg(t) * k),
      shotCd: L.shotCd,
      range: L.range
    };
  }

  /** Every player lined up south of an arena center (the rift's and the Judgment's). */
  function lineUp(cx, cy) {
    const ps = Game.everyone();
    ps.forEach((p, i) => {
      p.x = cx + (i - (ps.length - 1) / 2) * B.lineupGap;
      p.y = cy + World.TS * B.lineupSouth;
    });
  }

  /** Keeps `o` inside an arena circle of radius `r` tiles (the rift's and the Judgment's). */
  function keepIn(o, cx, cy, r) {
    const max = (r - B.wallMargin) * World.TS;
    const dx = o.x - cx,
      dy = o.y - cy,
      d = Math.hypot(dx, dy);
    if (d > max) {
      o.x = cx + (dx / d) * max;
      o.y = cy + (dy / d) * max;
    }
  }

  /** Nobody leaves the arena circle (in case something pushes too hard). */
  function keepInside() {
    for (const e of EnemyMgr.all()) if (!e.remote) keepIn(e, arena.x, arena.y, arena.r);
  }

  function arenaTick(dt, pl) {
    arena.t += dt;
    if (arena.phase === 'fight') {
      if (!authority()) return;
      keepInside();
      const boss = EnemyMgr.get(arena.bossId);
      if (!boss || boss.dead) {
        Coop.isHost && Coop.broadcast(['aw']);
        won();
        return;
      }
      const allDown = Game.everyone().every(p => p.dead);
      downT = allDown ? downT + dt : 0;
      if (downT > B.allDownGrace || arena.t > B.arenaTime) {
        Coop.isHost && Coop.broadcast(['al']);
        lost();
      }
      return;
    }
    arena.endT -= dt;
    if (arena.endT <= 0) finish();
  }

  function won() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'won';
    arena.endT = B.wonDelay;
    Progress.event('rift', { type: arena.type });
    Pickups.pullAll();
    Spawner.say(`You defeated ${DEX_BY[arena.dex].name}! Grab your reward…`, 3.4, true);
    Audio.sfx('legend');
    const pl = Game.player;
    if (pl) {
      pl.bonds++;
      FX.dmgText(pl.x, pl.y - pl.bodyH - 10, 'Bond!', '#ff8ad8', true);
      FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
    }
  }

  function lost() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'lost';
    arena.endT = B.lostDelay;
    Spawner.say('The rift threw you out…', 2.6, true);
    Audio.sfx('back');
  }

  /** On each computer: back to the map. */
  function finish() {
    const pl = Game.player;
    const a = arena;
    arena = null;
    World.setBiome(a.biome, true);
    Weather.clear();
    // Guest: nothing is deleted. The host reports the arena ones that
    // leave and the map ones that return; if the guest finished its countdown
    // a little later (almost always), it deleted the ones that had just
    // returned and they were invisible until they died (only their attacks showed).
    if (authority()) EnemyMgr.restore();
    Projectiles.clear();
    Combat.clearFields();
    Hazards.clear();
    for (const p of Game.everyone()) {
      p.x = a.back.x;
      p.y = a.back.y;
    }
    pl.x = a.back.x;
    pl.y = a.back.y;
    if (pl.dead) pl.revive(B.revive);
    Camera.x = pl.x;
    Camera.y = pl.y;
    Game.flash('#c9a6ff', 0.8);
    if (pl.bonds > 0) Game.offerBond();
  }

  // ---------------- drawing ----------------

  /** The rift, so it is Y-sorted with the rest of the scene. */
  function drawable() {
    if (!rift) return null;
    return {
      y: rift.y,
      draw(ctx) {
        const P = Sprites.PX;
        const img = Tiles.propSprite(0, 'rift', Math.floor(rift.t * 8) % 4);
        const w = img.width * P,
          h = img.height * P;
        const fadeIn = Math.min(1, rift.t * 2),
          fadeOut = Math.min(1, rift.ttl / 1.5);
        ctx.save();
        ctx.globalAlpha = 0.25 * fadeIn * fadeOut;
        ctx.fillStyle = '#7b3cff';
        ctx.beginPath();
        ctx.ellipse(rift.x, rift.y, 34, 12, 0, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.drawImage(img, Math.round(rift.x - w / 2), Math.round(rift.y - h + 4), w, h);
        ctx.restore();
        if (Math.random() < 0.3) FX.px(rift.x + U.rand(-14, 14), rift.y - U.rand(10, 80), '#d9c2ff', { vy: -40, life: 0.6 });
      }
    };
  }

  // ---------------- network ----------------

  Sync.on(['rift', 'riftx', 'arena', 'aw', 'al'], ev => onEvent(ev));
  // A guest walked into the rift: everyone travels.
  Sync.onGuest('re', () => Rift.enterRequest());
  function onEvent(ev) {
    switch (ev[0]) {
      case 'rift':
        show(ev[1], ev[2], ev[3]);
        break;
      case 'riftx':
        rift = null;
        break;
      case 'arena':
        begin(ev[1]);
        break;
      case 'aw':
        won();
        break;
      case 'al':
        lost();
        break;
    }
  }

  return {
    reset,
    update,
    drawable,
    onEvent,
    legendDef,
    lineUp,
    keepIn,
    enterRequest() {
      if (!arena) start();
    },
    get rift() {
      return rift;
    },
    get arena() {
      return arena;
    },
    get inArena() {
      return !!arena;
    },
    get timeLeft() {
      return arena ? Math.max(0, B.arenaTime - arena.t) : 0;
    },
    debugOpen() {
      open();
    },
    /** For tests: an arena of a given type right now. */
    debugArena(type) {
      start(type);
    },
    /** For videos: the next rift you enter will be of this type. */
    debugNextType(type) {
      nextType = type;
    }
  };
})();
