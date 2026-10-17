/* ============ story.js — Story mode run: routes, mini-bosses and the gym ============
 *
 *   routes  (0 → duration) the stage's legs one after another: each one changes the
 *           biome, the music and the wild Pokémon (data/stages.js). Mini-bosses
 *           come at fixed seconds (spawner.js, from Enemies.rollStory) and each one
 *           grants a bond. No rifts, events or Arceus's Judgment.
 *   gym     at `duration`: everything left on the map is stashed and you travel to
 *           a closed arena of the leader's type. The leader sends out the team in
 *           waves (at most 2 at once); beat the last one to win.
 *   won     a few seconds to grab the drops, then the summary (game.js endRun).
 *
 * Difficulty: stage second t plays like endless second eq(t) (Balance.story).
 * Solo only for now: a co-op run always plays endless.
 */
import { Balance } from '../data/balance.js';
import { I18n } from '../core/i18n.js';
import { DEX_BY } from '../data/pokedex.js';
import { SPRITE_META } from '../data/sprites-meta.js';
import { Stages } from '../data/stages.js';
import { Enemies } from '../data/enemies.js';
import { DB } from '../core/db.js';
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
import { Hazards } from './hazards.js';
import { Weather } from './weather.js';
import { Spawner } from './spawner.js';
import { Rift } from './rift.js';
import { Game } from '../game.js';

export const Story = (() => {
  const B = Balance.story;
  let stage = null;
  let phase = null; // 'route' | 'intro' | 'gym' | 'lull' | 'won'
  let leg = -1;
  let wave = 0,
    waveIds = [],
    phaseT = 0;
  let center = null;
  let warned = false,
    pulled = false;
  let minHp = 1; // lowest health fraction during the gym fight

  // The gym leader's sprite (data/stages.js leaderArt), standing at the back of the arena,
  // and how long the camera still looks at them after arriving.
  let art = null,
    focusT = 0;

  function begin(id) {
    stage = Stages.BY_ID[id] || null;
    art = null;
    focusT = 0;
    if (stage && Stages.leaderArt(stage)) {
      art = new Image();
      art.src = Stages.leaderArt(stage);
    }
    phase = stage ? 'route' : null;
    leg = -1;
    wave = 0;
    waveIds = [];
    phaseT = 0;
    center = null;
    warned = pulled = false;
    minHp = 1;
  }
  function end() {
    begin(null);
  }

  /** Stage second -> endless second (difficulty). */
  function eq(t) {
    if (!stage) return t;
    return (stage.pace * Math.min(t, B.duration)) / B.duration;
  }

  const legAt = t => {
    let i = 0;
    stage.legs.forEach((l, j) => {
      if (t >= l.from) i = j;
    });
    return i;
  };
  /** A route's music, from its biome: caves and dark places, volcanoes, or the forest. */
  const musicOf = l =>
    l.biome === 1 || ['ghost', 'dark', 'steel', 'poison', 'psychic', 'dragon'].includes(l.biome)
      ? 'cave'
      : l.biome === 2 || l.biome === 'fire'
        ? 'volcano'
        : 'forest';
  /** Biome index of a leg (a number, or an arena type to borrow its palette). */
  const biomeOf = l => (typeof l.biome === 'number' ? l.biome : Tiles.arenaBiome(l.biome));

  /** Wild cast and mini-bosses of the stage (Spawner.reset). */
  function rollCast() {
    Enemies.rollStory(stage, eq);
  }

  // ---------------- every frame (solo; game.js update) ----------------

  function update(dt, pl, time) {
    if (!stage) return;
    if (phase === 'route') {
      const li = legAt(time);
      if (li !== leg) enterLeg(li, leg < 0);
      const left = B.duration - time;
      if (!warned && left <= B.warnAt) {
        warned = true;
        Spawner.say(`${stage.gym.name} is just ahead!`, 3, true);
      }
      if (!pulled && left <= B.pullAt) {
        pulled = true;
        Pickups.pullAll();
      }
      if (left <= 0 && !Rift.inArena) toGym(pl);
      return;
    }
    if (!center) return;
    // Lowest health during the gym fight ("Flawless" achievement).
    if (phase !== 'won' && phase !== 'done' && pl.maxHp > 0) minHp = Math.min(minHp, pl.hp / pl.maxHp);
    for (const p of Game.everyone()) Rift.keepIn(p, center.x, center.y, B.gym.arenaR);
    for (const e of EnemyMgr.all()) if (!e.remote) Rift.keepIn(e, center.x, center.y, B.gym.arenaR);
    phaseT -= dt;
    if (focusT > 0) focusT -= dt;
    if (phase === 'intro' || phase === 'lull') {
      if (phaseT <= 0) sendWave();
    } else if (phase === 'gym') {
      if (waveIds.every(id => !EnemyMgr.get(id) || EnemyMgr.get(id).dead)) {
        wave++;
        if (wave < stage.gym.waves.length) {
          phase = 'lull';
          phaseT = B.gym.lull;
          Pickups.pullAll();
        } else won();
      }
    } else if (phase === 'won' && phaseT <= 0) {
      phase = 'done';
      Game.winStory();
    }
  }

  function enterLeg(i, first) {
    leg = i;
    const l = stage.legs[i];
    World.setBiome(biomeOf(l), first);
    Sprites.preload(l.mons);
    if (first) return;
    Audio.sfx('biome');
    Spawner.say('— ' + l.name + ' —', 3, true);
    const pl = Game.player;
    if (pl) FX.ring(pl.x, pl.y, 10, Camera.outerRadius(), '#ffffff', 0.7, 6);
  }

  // ---------------- the gym ----------------

  function toGym(pl) {
    const g = stage.gym;
    const ts = World.TS;
    const tx = 9000,
      ty = 9000;
    phase = 'intro';
    phaseT = B.gym.intro;
    focusT = B.gym.intro + B.gym.focusAfter;
    wave = 0;
    waveIds = [];
    EnemyMgr.stash();
    Projectiles.clear();
    Combat.clearFields();
    Hazards.clear();
    Pickups.clear();
    Weather.clear();
    World.setArena({ tx, ty, r: B.gym.arenaR, type: g.type });
    World.setBiome(Tiles.arenaBiome(g.type), true);
    center = { x: tx * ts + ts / 2, y: ty * ts + ts / 2 };
    leader.x = center.x;
    leader.y = center.y - (B.gym.arenaR - B.gym.leaderBack) * ts;
    Rift.lineUp(center.x, center.y);
    Camera.x = pl.x;
    Camera.y = pl.y;
    Sprites.preload(
      g.waves.flat().map(m => m.dex),
      8000
    );
    Game.flash('#ffffff', 0.9);
    Audio.sfx('rift');
    Spawner.say(`${g.title} ${g.leader} wants to battle!`, B.gym.intro + 0.6, true);
  }

  /** The leader sends out the next wave (1 or 2 Pokémon). */
  function sendWave() {
    const g = stage.gym;
    const team = g.waves[wave] || [];
    const ts = World.TS;
    const G = B.gym;
    const slot = Enemies.bossAt(stage.pace);
    const sc = Enemies.bossScale(stage.pace);
    phase = 'gym';
    waveIds = [];
    team.forEach((m, i) => {
      const p = DEX_BY[m.dex];
      if (!p || !SPRITE_META[p.dex]) return;
      const k = m.k || 1;
      const def = Enemies.bossDef(p, { hp: slot.hp * G.hp * k, dmg: slot.dmg * G.dmg, xp: slot.xp }, 0);
      const x = center.x + (team.length > 1 ? (i ? 1 : -1) * G.spread * ts : 0),
        y = center.y - G.north * ts;
      const e = new Enemy(def, x, y, sc, true);
      e.flying = false; // it bumps into the arena's pillars like you
      e.gym = true;
      e.guard = G.guard;
      EnemyMgr.add(e);
      waveIds.push(e.id);
      FX.ring(x, y, 8, 120, '#ffffff', 0.6, 5);
      FX.burst(x, y - 20, '#ff5f6d', 24, 200);
    });
    const names = team.map(m => DEX_BY[m.dex].name);
    Spawner.say(`${g.leader} sent out ${names.join(' and ')}!`, 3, true);
    Camera.kick(1.1);
    Audio.sfx('boss');
  }

  function won() {
    phase = 'won';
    phaseT = B.gym.won;
    Pickups.pullAll();
    Projectiles.clear();
    Hazards.clear();
    Audio.sfx('legend');
    Game.flash('#ffd23f', 0.8);
    Spawner.say(`You defeated ${stage.gym.title} ${stage.gym.leader}!`, B.gym.won, true);
    const pl = Game.player;
    if (pl) {
      FX.ring(pl.x, pl.y, 8, 160, '#ffd23f', 0.9, 6);
      FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#fff3b0', 50, 260);
    }
  }

  /** A mini-boss fell (systems/progress.js): you get a bond. */
  function onKill(e) {
    if (!stage || !e.boss || e.gym) return;
    const pl = Game.player;
    if (!pl) return;
    pl.bonds++;
    FX.dmgText(pl.x, pl.y - pl.bodyH - 10, 'Bond!', '#ff8ad8', true);
    FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
  }

  // ---------------- end of the run ----------------

  /**
   * Called once by game.js endRun: saves the clear and returns what to show.
   * @param won   the gym was beaten
   * @param time  run seconds
   */
  function finish(won, time) {
    if (!stage) return null;
    const s = DB.save;
    const prev = Stages.record(s, stage.id);
    const r = {
      stage,
      won,
      first: won && !prev,
      reward: null,
      best: false,
      reached: won ? null : phase === 'route' ? stage.legs[Math.max(0, leg)].name : stage.gym.name,
      flawless: won && minHp >= B.flawless // never under half health in the gym
    };
    if (won) {
      r.reward = B.reward(stage.pace, r.first);
      const t = Math.floor(time);
      s.story = s.story || {};
      const rec = (s.story[stage.id] = prev ? Object.assign({}, prev) : { at: Date.now(), clears: 0, best: 0 });
      rec.clears = (rec.clears || 0) + 1;
      r.best = !rec.best || t < rec.best;
      if (r.best) rec.best = t;
    }
    return r;
  }

  // ---------------- HUD ----------------

  /** What the HUD shows instead of the endless clock (or null outside story). */
  function hud(time) {
    if (!stage) return null;
    if (phase === 'route') {
      return {
        clock: Math.max(0, B.duration - time),
        place: stage.legs[Math.max(0, leg)].name,
        progress: Math.min(1, time / B.duration),
        marks: stage.minis.map(m => m.at / B.duration),
        gym: false
      };
    }
    return {
      clock: null,
      place: I18n.t(stage.gym.name) + ' · ' + I18n.t(stage.gym.leader), // (translated in pieces: the canvas only sees the joined text)
      progress: 1,
      marks: [],
      gym: true,
      battle: stage.gym.battle
    };
  }

  /** The leader, Y-sorted with the scene while you are in the gym (game.js drawScene). */
  const leader = {
    x: 0,
    y: 0,
    draw(ctx) {
      if (!art || !art.complete || !art.naturalWidth) return;
      const P = B.gym.leaderHeight / art.naturalHeight,
        w = art.naturalWidth * P,
        h = art.naturalHeight * P;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, w * 0.32, 7, 0, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art, Math.round(this.x - w / 2), Math.round(this.y - h + 4), w, h);
      ctx.restore();
    }
  };
  function drawable() {
    return stage && center ? leader : null;
  }

  return {
    begin,
    drawable,
    /** Where the camera looks instead of your Pokémon (the leader, when you arrive at the gym), or null. */
    get focus() {
      return focusT > 0 && center ? { x: leader.x, y: leader.y - 40 } : null;
    },
    end,
    eq,
    rollCast,
    update,
    onKill,
    finish,
    hud,
    /** The stage being played (or null). */
    get active() {
      return stage;
    },
    /** In the gym arena (no wild spawns). */
    get inGym() {
      return !!stage && phase !== 'route';
    },
    /** Music for the current moment. */
    get music() {
      if (!stage) return null;
      if (phase !== 'route') return 'boss';
      return musicOf(stage.legs[Math.max(0, leg)]);
    }
  };
})();
