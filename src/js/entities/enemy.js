/* ============ enemy.js — wild Pokémon and their manager ============
 * (x, y) are the FEET. Mystery Dungeon animations:
 *   Walk when moving · Idle when still · Charge when aiming a charge ·
 *   Attack when charging or hitting you · Shoot when shooting · Hurt when hit ·
 *   Faint when knocked out (stays on the ground and fades away).
 *
 * Flyers, ghosts and bosses ignore terrain. The rest collide
 * with walls and objects, move slower in water and burn in lava.
 *
 * The manager keeps a spatial grid (rebuilt every frame) for
 * enemy separation and projectile collisions.
 */
import { LIFT, U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Sync } from '../net/sync.js';
import { Balance } from '../data/balance.js';
import { DEX_BY } from '../data/pokedex.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { Items } from '../data/items.js';
import { World } from '../world/world.js';
import { VFX } from './vfx.js';
import { FX } from './fx.js';
import { Projectiles } from './projectile.js';
import { Pickups } from './pickup.js';
import { Spawner } from '../systems/spawner.js';
import { Rift } from '../systems/rift.js';
import { Judgment } from '../systems/judgment.js';
import { Events } from '../systems/events.js';
import { Weather } from '../systems/weather.js';
import { Path } from '../systems/pathing.js';
import { Progress } from '../systems/progress.js';
import { Mega } from '../systems/mega.js';
import { Hazards } from '../systems/hazards.js';
import { Coop } from '../net/coop.js';
import { Recount } from '../systems/recount.js';
import { Icons } from '../ui/icons.js';
import { Game } from '../game.js';

const B = Balance.enemies;
const RE = RNG.stream('enemy'); // AI choices, cooldown jitter, where attacks land
const RL = RNG.stream('loot'); // drops
let nextId = 1;
/** Bosses are scaled up to ~110 tall, depending on how big their sprite already is. */
function bossScale(dex) {
  const m = Sprites.animMeta(dex, 'Idle');
  const h = (m ? m.ay : 30) * Sprites.PX;
  // In multiples of 0.5: with the camera at ×2 each art pixel takes a
  // whole number of screen pixels (scales like 1.37 distort it).
  return U.clamp(Math.round((110 / h) * 2) / 2, 1, 2);
}

// Enemy flags guests see on their copies (status rings, shield bubble).
Sync.flag('burn', e => e.burn > 0);
Sync.flag('poison', e => e.poison > 0);
Sync.flag('shield', e => e.shield > 0);

class Enemy {
  constructor(def, x, y, sc, boss = false) {
    this.id = nextId++;
    this.def = def;
    this.dex = def.dex;
    this.name = (DEX_BY[def.dex] && DEX_BY[def.dex].name) || def.name;
    this.x = x;
    this.y = y;
    this.boss = boss;
    this.scale = boss ? bossScale(def.dex) : 1;
    this.anim = new Sprites.Animator(def.dex, this.scale);
    this.r = Sprites.bodyRadius(def.dex, this.scale);
    this.bodyH = Sprites.bodyHeight(def.dex, this.scale);

    this.maxHp = Math.round(def.hp * sc.hp);
    this.hp = this.maxHp;
    this.spd = def.spd * sc.spd;
    this.dmg = def.dmg * sc.dmg;
    this.xp = def.xp;
    this.behavior = def.behavior;

    const types = (DEX_BY[def.dex] && DEX_BY[def.dex].types) || [];
    this.types = types.length ? types : ['normal'];
    this.atkType = this.types[0]; // type of its hits (type chart)
    // Only those that FLOAT in their sprite fly over rocks and water (a
    // Rowlet walks even though it's Flying). Bosses too, due to their size.
    this.flying = boss || Sprites.hovers(def.dex);

    this.flash = 0;
    this.guard = 0; // seconds it can't be hurt, move or attack (a gym leader's Pokémon just sent out)
    this.slow = 0;
    this.slowT = 0;
    this.burn = 0;
    this.burnT = 0;
    this.burnTick = 0;
    this.poison = 0;
    this.poisonT = 0;
    this.poisonTick = 0;
    this.burnBy = this.burnMid = this.poisonBy = this.poisonMid = null; // damage meter
    this.lavaTick = 0;
    this.kx = 0;
    this.ky = 0;
    this.touchCd = 0;
    this.dead = false;
    this.fade = 0; // fade-out time after fainting

    // charge
    this.phase = 'walk';
    this.pt = 0;
    this.dx = 0;
    this.dy = 0;
    // ranged
    this.shotCd = def.shotCd ? RE.range(B.start.shotCdMin, def.shotCd) : 0;
    // unsticking
    this.stuckT = 0;
    this.sideT = 0;
    this.side = 1;
    this.bob = Math.random() * 6.28;
    this.shiny = false;
    this.sparkT = 0;
    // personalities
    this.sc = sc; // run scaling (for its summons)
    this.shield = 0;
    this.shieldT = 0; // shield that absorbs damage
    this.skillCd = RE.range(B.start.skillCd[0], B.start.skillCd[1]); // shields / jumps
    this.minions = [];
    this.jump = null; // { sx, sy, tx, ty, t, dur }
    // Stragglers: if they fall behind, out of view, while you run away,
    // they reappear ahead of you (see EnemyMgr.update).
    this.lagT = 0;
  }

  cy() {
    return this.y;
  }

  /** Co-op copy: is this Sync flag set on the host's enemy? */
  netFlag(name) {
    const b = Sync.flagBit(name);
    return b >= 0 && !!this.net && ((this.net.st >> b) & 1) === 1;
  }

  /** Makes it shiny: different sprite, more HP and much more XP. */
  makeShiny() {
    this.shiny = true;
    this.anim = new Sprites.Animator(this.dex, this.scale, true);
    this.maxHp *= B.shiny.hp;
    this.hp = this.maxHp;
    this.xp *= B.shiny.xp;
    Sprites.preload([this.dex], 4000, true);
  }

  /** Golden hour (events.js): double experience and sometimes coins. */
  makeGolden() {
    if (this.golden || this.boss || this.behavior === 'thief') return;
    this.golden = true;
    this.xp *= B.golden.xp;
  }

  /** @param eff  'super' | 'weak' | null (type chart, only for display) */
  hurt(amount, color = '#fff', dirX = 0, dirY = 0, knock = 0, eff = null) {
    if (this.dead || this.guard > 0) return;
    const d = Math.max(1, Math.round(amount));
    // Copy of a host enemy: the hit is sent to the host, who
    // decides whether it faints. Here it's only shown (number, flash and animation).
    if (this.remote) {
      Coop.hit(this, d, color, dirX, dirY, knock);
      this.hp = Math.max(1, this.hp - d);
      this.showHurt(d, color, dirX, dirY, eff);
      return;
    }
    // Shield: absorbs first.
    if (this.shield > 0) {
      const a = Math.min(this.shield, d);
      this.shield -= a;
      if (a >= d) {
        FX.dmgText(this.x, this.y - this.bodyH - 4, d, '#9fd8ff');
        this.flash = 0.05;
        return;
      }
      amount = d - a;
    }
    this.hp -= Math.max(1, Math.round(amount));
    Judgment.noteDmg(amount, this);
    this.showHurt(d, color, dirX, dirY, eff);
    if (knock > 0 && !this.boss) {
      const [nx, ny] = U.norm(dirX, dirY);
      this.kx += nx * knock;
      this.ky += ny * knock;
    }
    if (Coop.isHost) Coop.hurtShown(this, d, color);
    if (this.hp <= 0) this.die();
  }

  /** What is SHOWN when hit. */
  showHurt(d, color, dirX = 0, dirY = 0, eff = null) {
    this.flash = 0.09;
    // Super effective: big yellow number. Not very effective: grey. Critical: big orange.
    FX.dmgText(
      this.x,
      this.y - this.bodyH - 4,
      d,
      eff === 'crit' ? '#ff9a3c' : eff === 'super' ? '#ffe14d' : eff === 'weak' ? '#a3abb8' : color,
      this.boss || eff === 'super' || eff === 'crit'
    );
    FX.spark(this.x, this.y - this.bodyH * 0.5, color, dirX, dirY, 3);
    if (!this.anim.busy() && this.phase !== 'dash') this.anim.play('Hurt');
    Audio.sfx('hit');
  }

  applySlow(factor, dur = B.status.slow.dur) {
    if (this.remote) {
      Coop.status(this, 's', factor);
      return;
    }
    this.slow = Math.max(this.slow, factor);
    this.slowT = Math.max(this.slowT, dur);
  }
  /*
   * Burn and poison remember who applied them last (move `mid` of player `by`, null =
   * this device's) so the damage meter can credit the ticks. Without a move (a trap)
   * the previous owner is kept.
   */
  applyBurn(stacks = 1, mid = null, by = null) {
    if (this.remote) {
      Coop.status(this, 'b', stacks, mid);
      return;
    }
    this.burn = Math.min(B.status.burn.cap, this.burn + stacks);
    this.burnT = B.status.burn.dur;
    if (mid) {
      this.burnMid = mid;
      this.burnBy = by;
    }
  }
  applyPoison(stacks = 1, mid = null, by = null) {
    if (this.remote) {
      Coop.status(this, 'p', stacks, mid);
      return;
    }
    this.poison = Math.min(B.status.poison.cap, this.poison + stacks);
    this.poisonT = B.status.poison.dur;
    if (mid) {
      this.poisonMid = mid;
      this.poisonBy = by;
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.fade = 0.9;
    this.anim.play('Faint', { hold: true });
    const col = this.boss ? '#ffd95e' : '#ffffff';
    const cy = this.y - this.bodyH * 0.5;
    FX.burst(this.x, cy, col, this.boss ? 34 : 9, this.boss ? 260 : 120);
    FX.ring(this.x, this.y, this.r, this.r * (this.boss ? 6 : 2.6), col, this.boss ? 0.6 : 0.3, this.boss ? 6 : 3);
    // On a copy, the host hands out loot and shinies.
    if (this.remote) {
      if (this.boss) Camera.kick(0.9);
      Audio.sfx(this.boss ? 'bossDown' : 'faint');
      if (this.shiny) {
        FX.burst(this.x, cy, '#ffe9a0', 30, 220);
        FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5);
      }
      return;
    }
    const L = B.drops;
    // (The Judgment of Arceus legendaries only give experience.)
    if (this.boss && !this.judge) {
      Camera.kick(0.9);
      for (let i = 0; i < L.boss.coins; i++) Pickups.drop('coin', this.x + RL.range(-40, 40), this.y + RL.range(-30, 30), L.boss.coinValue);
      // Bosses always drop a holdable item.
      Pickups.drop('item', this.x - 26, this.y - 10, Items.roll());
    }
    Pickups.dropXp(this.x, this.y, this.xp, this.boss, !!this.legend, !!this.judge);
    if (this.golden && RL.chance(B.golden.coinChance)) Pickups.drop('coin', this.x + 6, this.y - 4, B.golden.coinValue);
    // Treasure goblin: Meowth drops coins; Gholdengo, a ×10 ticket.
    if (this.behavior === 'thief') {
      const n = this.def.loot === 'ticket10' ? L.thief.ticketCoins : L.thief.coins;
      for (let i = 0; i < n; i++) Pickups.drop('coin', this.x + RL.range(-36, 36), this.y + RL.range(-26, 26), L.thief.coinValue);
      if (this.def.loot === 'ticket10') Pickups.drop('ticket10', this.x, this.y - 12, L.thief.tickets10);
      FX.ring(this.x, this.y, this.r, this.r * 5, '#ffd23f', 0.6, 4);
    }
    if (this.legend) {
      // The rift legendary: single tickets and coins (the ×10 one, about
      // half the time; it used to always give 2).
      for (let i = 0; i < L.legend.tickets; i++) Pickups.drop('ticket', this.x + RL.range(-30, 30), this.y + RL.range(-20, 20), 1);
      for (let i = 0; i < L.legend.coins; i++)
        Pickups.drop('coin', this.x + RL.range(-50, 50), this.y + RL.range(-35, 35), L.legend.coinValue);
    }
    Audio.sfx(this.boss ? 'bossDown' : 'faint');
    if (this.shiny) {
      FX.burst(this.x, cy, '#ffe9a0', 30, 220);
      FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5);
      Game.onShinyCaught(this);
    }
  }

  /**
   * Copy of a host enemy: moves towards the last received position
   * (plus the estimated velocity, so it doesn't move in jumps) and animates
   * by its movement or by the animation it has on the host.
   */
  netUpdate(dt) {
    this.anim.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) {
      this.fade -= dt;
      return;
    }
    if (this.touchCd > 0) this.touchCd -= dt;
    this.bob += dt * 6;
    if (this.shiny) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.22;
        FX.twinkle(this.x + U.rand(-this.r, this.r) * 1.2, this.y - U.rand(4, this.bodyH * 1.1));
      }
    }
    const n = this.net;
    if (!n) return;
    // Extrapolates up to 0.3 s (in case few positions arrive per second).
    const lead = Math.min(0.3, n.age);
    n.age += dt;
    const tx = n.x + n.vx * lead,
      ty = n.y + n.vy * lead;
    const ox = this.x,
      oy = this.y;
    if (U.dist2(this.x, this.y, tx, ty) > 160 * 160) {
      this.x = tx;
      this.y = ty;
    } else {
      this.x = U.damp(this.x, tx, 12, dt);
      this.y = U.damp(this.y, ty, 12, dt);
    }
    const vx = (this.x - ox) / (dt || 1),
      vy = (this.y - oy) / (dt || 1);
    const moving = Math.abs(vx) + Math.abs(vy) > 8;
    this.anim.dir = n.dir;
    // One-shot animations (charge, shot...) started by the host.
    if (n.anim !== this.lastNetAnim) {
      this.lastNetAnim = n.anim;
      const a = Coop.ANIMS[n.anim];
      if (a && a !== 'Idle' && a !== 'Walk' && a !== 'Faint') this.anim.play(a, { speed: 1.4 });
    }
    this.anim.loop(moving ? 'Walk' : 'Idle');
  }

  update(dt, pl) {
    // Off screen there's no need to animate (but it still moves and thinks).
    const seen = Camera.sees(this.x, this.y, 120);
    if (seen || this.dead) this.anim.update(dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) {
      this.fade -= dt;
      return;
    }
    // Just sent out by a gym leader: it stands still for a moment so you can see it.
    if (this.guard > 0) {
      this.guard -= dt;
      this.anim.loop('Idle');
      return;
    }
    if (this.shiny && seen) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.22;
        FX.twinkle(this.x + U.rand(-this.r, this.r) * 1.2, this.y - U.rand(4, this.bodyH * 1.1));
      }
    }
    if (this.touchCd > 0) this.touchCd -= dt;
    this.bob += dt * 6;

    // --- status effects ---
    const ST = B.status;
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slow = 0;
    }
    if (this.burn > 0) {
      this.burnT -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = ST.burn.tick;
        const d = ST.burn.dmg * this.burn * (1 + pl.level * ST.burn.perLevel);
        this.hurt(d, '#ff9a4d');
        Recount.dot(this.burnBy, this.burnMid, d);
      }
      if (this.burnT <= 0) this.burn = 0;
    }
    if (this.poison > 0) {
      this.poisonT -= dt;
      this.poisonTick -= dt;
      if (this.poisonTick <= 0) {
        this.poisonTick = ST.poison.tick;
        const d = this.maxHp * ST.poison.maxHpPct * this.poison + ST.poison.flat;
        this.hurt(d, '#d47cf0');
        Recount.dot(this.poisonBy, this.poisonMid, d);
      }
      if (this.poisonT <= 0) this.poison = 0;
    }
    if (this.dead) return;

    // --- terrain ---
    let terrainMul = 1;
    // (The legendary is at home: its arena doesn't affect it. Nor do Arceus' ones.)
    if (!this.flying && !this.legend && !this.judge && World.isLiquid(this.x, this.y)) {
      const le = World.liquidEffect(this.types);
      if (le.dmg) {
        this.lavaTick -= dt;
        if (this.lavaTick <= 0) {
          this.lavaTick = le.every;
          this.hurt(B.terrain.lavaFlat + this.maxHp * B.terrain.lavaMaxHpPct, le.color);
        }
        if (this.dead) return;
      } else if (le.slow) terrainMul = le.slow < B.terrain.deepBelow ? B.terrain.deep : B.terrain.shallow;
    }

    const spd = this.spd * (1 - this.slow) * terrainMul * Weather.speedFor(this.types);
    let [dx, dy] = U.norm(pl.x - this.x, pl.y - this.y);
    const dist = U.dist(this.x, this.y, pl.x, pl.y);
    const BH = B.behaviors;
    // Treasure goblin: runs away from you (zigzagging) as soon as you get close.
    if (this.behavior === 'thief') {
      const T = BH.thief;
      this.zig = (this.zig || 0) + dt;
      const near = dist < T.fleeRange,
        a = Math.atan2(-dy, -dx) + Math.sin(this.zig * T.zigFreq) * T.zigAmp;
      const k = near ? 1 : T.idleSpd;
      const vx0 = Math.cos(a) * spd * k,
        vy0 = Math.sin(a) * spd * k;
      const ox = this.x,
        oy = this.y;
      this.x += (vx0 + this.kx) * dt;
      this.y += (vy0 + this.ky) * dt;
      this.kx *= Math.pow(B.knockDecay, dt);
      this.ky *= Math.pow(B.knockDecay, dt);
      if (World.collide(this) && Math.hypot(this.x - ox, this.y - oy) < spd * k * dt * 0.3) this.zig += T.bumpZig;
      if (Math.random() < dt * 6 && Camera.sees(this.x, this.y, 0))
        FX.twinkle(this.x + U.rand(-this.r, this.r), this.y - U.rand(4, this.bodyH));
      this.anim.dir = Sprites.dirFromAngle(a);
      this.anim.loop('Walk', 1.4);
      return;
    }
    // Runner: heads to where you WILL be (cuts you off if you just run).
    if (this.behavior === 'runner' && pl._vx != null) {
      const lead = U.clamp(dist / Math.max(BH.runner.minSpd, spd), 0, BH.runner.maxLead);
      [dx, dy] = U.norm(pl.x + pl._vx * lead - this.x, pl.y + pl._vy * lead - this.y);
      if (Camera.sees(this.x, this.y, 0) && Math.random() < dt * 10)
        FX.px(this.x - dx * 8 + U.rand(-4, 4), this.y, '#e8dcc0', { vy: -12, life: 0.35 });
    }

    // --- personality (shields, jumps, explosion) ---
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
    if (this.jump) {
      this.updateJump(dt);
      return;
    }
    if (this.behavior === 'bomber' && this.phase === 'fuse') {
      this.pt -= dt;
      this.flash = Math.floor(this.pt * 10) % 2 ? 0.05 : 0;
      if (this.pt <= 0) {
        this.hp = 0;
        this.die();
      }
      this.anim.loop('Idle');
      return;
    }
    if (this.behavior === 'bomber' && dist < this.r + pl.r + BH.bomber.gap) {
      this.startFuse();
      return;
    }
    if (this.behavior === 'shielder' || this.behavior === 'jumper') {
      this.skillCd -= dt;
      if (this.skillCd <= 0) {
        if (this.behavior === 'shielder') {
          this.skillCd = BH.shielder.cd;
          this.castShields();
        } else if (dist < BH.jumper.range) {
          this.skillCd = RE.range(BH.jumper.cd[0], BH.jumper.cd[1]);
          this.startJump(pl);
          return;
        } else this.skillCd = BH.jumper.retry;
      }
    }

    // If it has been stuck against something for a while, go around one side.
    if (this.sideT > 0) {
      this.sideT -= dt;
      const a = Math.atan2(dy, dx) + this.side * 1.25;
      dx = Math.cos(a);
      dy = Math.sin(a);
    }

    // Path around obstacles (non-flyers).
    if (!this.flying && this.phase !== 'dash' && this.sideT <= 0) {
      const pd = Path.dirFor(this, pl);
      if (pd && !(this.keepsDistance() && dist < this.keepDist())) {
        dx = pd[0];
        dy = pd[1];
      }
    }

    let vx = dx * spd,
      vy = dy * spd;
    let animBase = 'Walk';

    if (this.boss) {
      [vx, vy, animBase] = this.bossMove(dt, pl, dist, dx, dy, spd);
    } else if (this.behavior === 'charger') {
      const C = BH.charger;
      this.pt -= dt;
      if (this.phase === 'walk') {
        if (dist < C.aggro && this.pt <= 0) {
          this.phase = 'aim';
          this.pt = C.aim;
          this.anim.play('Charge', { speed: 1.6 });
        }
      } else if (this.phase === 'aim') {
        vx = vy = 0;
        animBase = 'Idle';
        if (this.pt <= 0) {
          this.phase = 'dash';
          this.pt = C.dash;
          this.dx = dx;
          this.dy = dy;
          this.anim.play('Attack', { speed: 1.4 });
          FX.ring(this.x, this.y, this.r, this.r * 2.4, '#ff6b6b', 0.25, 2);
        }
      } else if (this.phase === 'dash') {
        vx = this.dx * spd * C.dashSpd;
        vy = this.dy * spd * C.dashSpd;
        if (this.pt <= 0) {
          this.phase = 'walk';
          this.pt = C.rest;
        }
      }
    } else if (this.keepsDistance()) {
      const RG = BH.ranged;
      const range = this.def.range || RG.range;
      const keep = this.keepDist();
      // Straight line to you (not the path) to back away.
      const [ddx, ddy] = U.norm(pl.x - this.x, pl.y - this.y);
      if (dist < keep * RG.backOff) {
        vx = -ddx * spd * RG.backSpd;
        vy = -ddy * spd * RG.backSpd;
      } else if (dist < keep) {
        vx *= RG.holdSpd;
        vy *= RG.holdSpd;
        animBase = 'Idle';
      }
      this.shotCd -= dt;
      if (this.shotCd <= 0 && dist < range) {
        this.shotCd = this.def.shotCd || RG.cd;
        this.special(pl, ddx, ddy);
      }
    }

    // --- integration ---
    const ox = this.x,
      oy = this.y;
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= Math.pow(B.knockDecay, dt);
    this.ky *= Math.pow(B.knockDecay, dt);
    this.x += vx * dt;
    this.y += vy * dt;

    if (!this.flying && World.collide(this)) {
      // Did it move much less than it wanted to?
      const want = Math.hypot(vx, vy) * dt;
      const got = Math.hypot(this.x - ox, this.y - oy);
      if (want > 0.5 && got < want * 0.35) {
        this.stuckT += dt;
        if (this.stuckT > 0.35 && this.sideT <= 0) {
          this.sideT = 0.7;
          this.stuckT = 0;
          this.side = RE.chance(0.5) ? -1 : 1;
        }
      } else this.stuckT = 0;
    }

    // --- animation ---
    const moving = Math.abs(vx) + Math.abs(vy) > 2;
    const faceA =
      this.phase === 'dash' ? Math.atan2(this.dy, this.dx) : moving ? Math.atan2(vy, vx) : Math.atan2(pl.y - this.y, pl.x - this.x);
    this.anim.dir = Sprites.dirFromAngle(faceA);
    this.anim.loop(moving ? animBase : 'Idle', moving ? Math.max(0.6, spd / 70) : 1);
  }

  // ---------------- bosses ----------------
  // Each boss (and each rift legendary) has 4 attacks: 2 close
  // (Stomp always + Charge or Leap) and 2 ranged depending on its type.
  // It alternates between coming for you and fighting at range, so the
  // shooter also rushes you and the melee one also
  // shoots. Everything is telegraphed on the ground. Below half HP it
  // becomes enraged: faster, less wind-up, and sometimes chains two attacks.

  bossInit() {
    const T = this.types,
      has = (...xs) => xs.some(x => T.includes(x));
    const melee = ['slam', U.hash(this.dex, 3, 7) < 0.5 ? 'dash' : 'leap'];
    const pref = has('fire', 'ground', 'poison', 'rock', 'grass')
      ? 'rain'
      : has('electric', 'psychic', 'dragon', 'ice', 'steel')
        ? 'beam'
        : has('fairy', 'ghost', 'water', 'flying')
          ? 'nova'
          : 'volley';
    const others = ['rain', 'beam', 'nova', 'volley'].filter(x => x !== pref);
    const ranged = [pref, others[Math.floor(U.hash(this.dex, 5, 9) * 3) % 3]];
    const far = this.behavior === 'ranged',
      A = B.bossAi;
    this.ai = {
      melee,
      ranged,
      farLike: far ? A.farLike.far : A.farLike.close,
      mode: far ? 'far' : 'close',
      modeT: RE.range(A.modeT[0], A.modeT[1]),
      cd: A.cd,
      cast: null,
      fury: false,
      side: RE.chance(0.5) ? -1 : 1
    };
  }

  bossMove(dt, pl, dist, dx, dy, spd) {
    if (!this.ai) this.bossInit();
    const ai = this.ai,
      A = B.bossAi;
    if (!ai.fury && this.hp < this.maxHp * A.furyAt) this.enrage();
    const k = ai.fury ? A.furyRate : 1;
    if (ai.cast) return this.bossCast(dt, pl);
    ai.modeT -= dt;
    ai.cd -= dt * k;
    // Always alternates: it stays longer at its favourite range (7-9 s) than at the other (4-5 s).
    if (ai.modeT <= 0) {
      ai.mode = ai.mode === 'far' ? 'close' : 'far';
      ai.modeT =
        (ai.mode === 'far') === ai.farLike > 0.5 ? RE.range(A.modeLong[0], A.modeLong[1]) : RE.range(A.modeShort[0], A.modeShort[1]);
      ai.side = -ai.side;
    }
    let vx = dx * spd * k * A.chaseSpd,
      vy = dy * spd * k * A.chaseSpd;
    const [ddx, ddy] = U.norm(pl.x - this.x, pl.y - this.y);
    if (ai.mode === 'far') {
      if (dist < A.far.flee) {
        vx = -ddx * spd;
        vy = -ddy * spd;
      } else if (dist < A.far.circle) {
        vx = -ddy * spd * A.far.circleSpd * ai.side;
        vy = ddx * spd * A.far.circleSpd * ai.side;
      } // circles you
    }
    if (ai.cd <= 0) {
      let id = null;
      const C = A.close;
      if (ai.mode === 'close') {
        const ok = ai.melee.filter(m => (m === 'slam' ? dist < C.slam : dist < C.melee));
        // Every now and then it shoots even when close.
        id = ok.length && RE.chance(C.meleeChance) ? RE.pick(ok) : dist < C.shoot ? RE.pick(ai.ranged) : null;
      } else {
        id = dist < A.farSlam ? 'slam' : dist < A.farShoot ? RE.pick(ai.ranged) : null;
      }
      if (id) this.bossStart(id, pl);
    }
    return [vx, vy, 'Walk'];
  }

  enrage() {
    this.ai.fury = true;
    this.spd *= B.bossAi.furySpd;
    if (!this.judge) Spawner.say(`${this.name} is enraged!`, 2.4);
    FX.ring(this.x, this.y, this.r, this.r * 5, '#ff4a4a', 0.6, 5);
    Camera.kick(0.5);
    Audio.sfx('boss');
  }

  bossStart(id, pl) {
    const A = B.bossAi,
      K = A.attacks,
      ai = this.ai,
      f = ai.fury ? A.furyWind : 1,
      type = this.atkType;
    const col = U.TYPE_COLOR[type] || '#ff7a9e';
    const ang = Math.atan2(pl.y - this.y, pl.x - this.x);
    const c = (ai.cast = { id, t: 0, wind: A.wind * f, after: A.after, ang });
    switch (id) {
      case 'slam': // stomp: shockwave around it
        c.wind = K.slam.wind * f;
        Hazards.add({
          kind: 'zone',
          x: this.x,
          y: this.y,
          r: K.slam.r + this.r,
          delay: c.wind,
          dmg: this.dmg * K.slam.dmg,
          type,
          color: col
        });
        this.anim.play('Charge', { speed: 1.2 });
        break;
      case 'dash': // charge in a straight line
        c.wind = K.dash.wind * f;
        c.len = K.dash.len;
        c.dur = K.dash.dur;
        Hazards.add({
          kind: 'beam',
          x: this.x,
          y: this.y,
          angle: ang,
          len: c.len + this.r,
          w: this.r * 2 + K.dash.wPad,
          delay: c.wind + c.dur,
          dmg: this.dmg * K.dash.dmg,
          type,
          color: col
        });
        this.anim.play('Charge', { speed: 1.3 });
        break;
      case 'leap': {
        // leap and land on you
        const L = K.leap;
        this.jump = { sx: this.x, sy: this.y, tx: pl.x, ty: pl.y, t: -L.crouch * f, dur: L.dur };
        Hazards.add({ kind: 'zone', x: pl.x, y: pl.y, r: L.r, delay: L.crouch * f + L.dur, dmg: this.dmg * L.dmg, type, color: col });
        this.anim.play('Charge', { speed: 1.4 });
        ai.cast = null;
        ai.cd = RE.range(L.cd[0], L.cd[1]) + L.cdPad;
        break;
      }
      case 'rain': {
        // zones falling around you
        const R = K.rain;
        const n = ai.fury ? R.furyN : R.n;
        for (let i = 0; i < n; i++) {
          const a = i ? RE.angle() : 0,
            d = i ? RE.range(R.dist[0], R.dist[1]) : 0;
          Hazards.add({
            kind: 'zone',
            x: pl.x + Math.cos(a) * d,
            y: pl.y + Math.sin(a) * d * R.yK,
            r: R.r,
            delay: R.delay + i * R.stagger,
            dmg: this.shotDmg() * R.dmg,
            type,
            color: col
          });
        }
        c.wind = R.wind;
        this.anim.play('Shoot');
        break;
      }
      case 'beam': {
        // fan of beams
        const BM = K.beam;
        const n = ai.fury ? BM.furyN : BM.n,
          sp = ai.fury ? BM.furySp : BM.sp;
        for (let i = 0; i < n; i++) {
          Hazards.add({
            kind: 'beam',
            x: this.x,
            y: this.y,
            angle: ang + (i - (n - 1) / 2) * sp,
            len: BM.len,
            w: BM.w,
            delay: BM.delay,
            dmg: this.shotDmg() * BM.dmg,
            type,
            color: col
          });
        }
        c.wind = BM.wind;
        c.after = BM.after;
        this.anim.play('Charge', { speed: 1.1 });
        break;
      }
      case 'volley': // fan of shots
      case 'nova': // ring of shots
        c.wind = K[id].wind * f;
        this.anim.play('Charge', { speed: 1.4 });
        FX.ring(this.x, this.y, this.r, this.r * 2.4, col, c.wind, 2);
        break;
    }
  }

  bossCast(dt, pl) {
    const ai = this.ai,
      c = ai.cast;
    c.t += dt;
    if (c.id === 'dash' && c.t >= c.wind) {
      if (!c.go) {
        c.go = true;
        this.anim.play('Attack', { speed: 1.6 });
      }
      if (c.t >= c.wind + c.dur) return this.bossEnd();
      const sp = c.len / c.dur;
      return [Math.cos(c.ang) * sp, Math.sin(c.ang) * sp, 'Walk'];
    }
    if (c.t >= c.wind && !c.fired) {
      c.fired = true;
      const [ax, ay] = U.norm(pl.x - this.x, pl.y - this.y);
      const K = B.bossAi.attacks;
      if (c.id === 'volley') this.shoot(ax, ay, K.volley.spread, ai.fury ? K.volley.furyN : K.volley.n, K.volley.dmg);
      else if (c.id === 'nova') {
        const n = ai.fury ? K.nova.furyN : K.nova.n;
        this.shoot(ax, ay, (6.2832 * (n - 1)) / n, n, K.nova.dmg);
      } else if (c.id === 'slam') this.anim.play('Attack', { speed: 1.4 });
    }
    if (c.t >= c.wind + c.after) return this.bossEnd();
    return [0, 0, 'Idle'];
  }

  bossEnd() {
    const ai = this.ai,
      A = B.bossAi;
    ai.cast = null;
    ai.cd = RE.range(A.cdAfter[0], A.cdAfter[1]);
    if (ai.fury && RE.chance(A.chainChance)) ai.cd = A.chainCd; // chain another one
    return [0, 0, 'Idle'];
  }

  keepsDistance() {
    return ['ranged', 'fan', 'beamer', 'zoner', 'healer', 'summoner'].includes(this.behavior);
  }

  /** Distance a ranged fighter tries to keep from you. */
  keepDist() {
    return (this.def.range || B.behaviors.ranged.range) * B.behaviors.ranged.keep;
  }

  shotDmg() {
    return (this.def.shotDmg || B.shot.dmg) * (this.dmg / this.def.dmg);
  }

  /** Normal enemy shot (one, or several in a fan). */
  shoot(ax, ay, spread = 0, n = 1, k = 1) {
    const S = B.shot,
      sp = S.speed,
      type = this.atkType;
    const base = Math.atan2(ay, ax);
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      const shot = Projectiles.spawn({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        dmg: this.shotDmg() * k,
        r: S.r,
        life: S.life,
        friendly: false,
        color: '#ff7a9e',
        mtype: type,
        vis: VFX.forType(type)
      });
      if (Coop.isHost) Coop.enemyShot(shot, type);
    }
    this.anim.play('Shoot');
    FX.ring(this.x, this.y - LIFT, 4, 14, '#ff7a9e', 0.2, 2);
  }

  /** What each personality does on its turn (host / solo). */
  special(pl, dx, dy) {
    const col = U.TYPE_COLOR[this.atkType] || '#ff7a9e',
      BH = B.behaviors;
    switch (this.behavior) {
      case 'fan': {
        const F = BH.fan;
        const n = this.def.fanN || F.n;
        this.shoot(dx, dy, n === 3 ? F.spread3 : F.spread, n, F.dmg);
        break;
      }
      case 'beamer':
        // Telegraphed beam: first the strip shows on the ground.
        Hazards.add({
          kind: 'beam',
          x: this.x,
          y: this.y,
          angle: Math.atan2(dy, dx),
          len: BH.beamer.len,
          w: BH.beamer.w,
          delay: BH.beamer.delay,
          dmg: this.shotDmg() * BH.beamer.dmg,
          type: this.atkType,
          color: col
        });
        this.anim.play('Charge', { speed: 1.2 });
        break;
      case 'zoner': {
        const Z = BH.zoner;
        const n = RE.int(1, this.def.zones || Z.zones);
        for (let i = 0; i < n; i++) {
          Hazards.add({
            kind: 'zone',
            x: pl.x + (i ? RE.range(-Z.dx, Z.dx) : 0),
            y: pl.y + (i ? RE.range(-Z.dy, Z.dy) : 0),
            r: Z.r,
            delay: Z.delay,
            dmg: this.shotDmg() * Z.dmg,
            type: this.atkType,
            color: col
          });
        }
        this.anim.play('Shoot');
        break;
      }
      case 'healer':
        this.healAround();
        break;
      case 'summoner':
        this.summon();
        break;
      default:
        this.shoot(dx, dy);
    }
  }

  healAround() {
    // 7% of HP (was 15%: with several healers they healed more than
    // you dealt), and more the harder you hit, but with diminishing returns: with
    // double attack it heals 27% more, with 10 times more 124%, and at
    // most ×2.5. (Like enemies having more HP if you deal more damage.)
    const pow = Math.max(1, ...Game.everyone().map(p => (p.atk > 0 && p.baseAtk > 0 ? p.atk / p.baseAtk : 1)));
    const H = B.behaviors.healer;
    const k = H.pct * Math.min(H.powCap, Math.pow(pow, H.powExp));
    let n = 0;
    for (const e of EnemyMgr.queryCircle(this.x, this.y, H.radius)) {
      if (e.dead || e.hp >= e.maxHp) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * k);
      FX.burst(e.x, e.y - e.bodyH * 0.6, '#7dffb0', 5, 60);
      n++;
    }
    this.anim.play('Charge');
    Coop.fx('ring', this.x, this.y, 8, H.radius, '#5fe08a', 0.5, 3);
    if (n && Camera.sees(this.x, this.y, 0)) Audio.sfx('heal');
  }

  castShields() {
    const S = B.behaviors.shielder;
    const near = EnemyMgr.queryCircle(this.x, this.y, S.radius)
      .filter(e => !e.dead)
      .sort((a, b) => U.dist2(a.x, a.y, this.x, this.y) - U.dist2(b.x, b.y, this.x, this.y))
      .slice(0, S.max);
    for (const e of near) {
      e.shield = Math.max(e.shield, e.maxHp * S.hpPct);
      e.shieldT = S.dur;
    }
    this.anim.play('Charge');
    Coop.fx('ring', this.x, this.y, 8, S.radius, '#7fc8ff', 0.5, 3);
  }

  summon() {
    this.minions = this.minions.filter(m => !m.dead && EnemyMgr.get(m.id));
    // With the global enemy cap (fewer Pokémon on screen), plus a small margin.
    const S = B.behaviors.summoner,
      M = S.minion;
    if (this.minions.length >= S.maxMinions || EnemyMgr.count > Spawner.CAP + S.capMargin) return;
    const dex = this.def.minion || this.dex;
    const mon = DEX_BY[dex];
    const def = {
      dex,
      name: mon ? mon.name : '',
      hp: Math.round(this.def.hp * M.hp),
      spd: Math.round(this.def.spd * M.spd),
      dmg: Math.round(this.def.dmg * M.dmg),
      xp: Math.max(M.minXp, Math.round(this.def.xp * M.xp)),
      behavior: 'chase'
    };
    for (let i = 0; i < S.perCast; i++) {
      const a = RE.angle();
      const m = new Enemy(def, this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 22, this.sc || { hp: 1, spd: 1, dmg: 1 });
      EnemyMgr.add(m);
      this.minions.push(m);
      FX.burst(m.x, m.y - 8, '#c47bff', 8, 90);
    }
    this.anim.play('Charge');
    FX.ring(this.x, this.y, 8, 50, '#c47bff', 0.4, 3);
  }

  startFuse() {
    const F = B.behaviors.bomber;
    this.phase = 'fuse';
    this.pt = F.fuse;
    Hazards.add({
      kind: 'zone',
      x: this.x,
      y: this.y,
      r: F.r,
      delay: F.fuse,
      dmg: this.dmg * F.dmg,
      type: this.atkType,
      color: '#ff7b3d'
    });
  }

  startJump(pl) {
    const J = B.behaviors.jumper,
      tx = pl.x,
      ty = pl.y;
    this.jump = { sx: this.x, sy: this.y, tx, ty, t: -J.crouch, dur: J.dur };
    this.anim.play('Charge', { speed: 1.4 });
    Hazards.add({
      kind: 'zone',
      x: tx,
      y: ty,
      r: J.r,
      delay: J.crouch + J.dur, // lands when the jump does
      dmg: this.dmg * J.dmg,
      type: this.atkType,
      color: U.TYPE_COLOR[this.atkType] || '#ff7a9e'
    });
  }

  /** Jump: crouches, flies in an arc and lands where you were. */
  updateJump(dt) {
    const j = this.jump;
    j.t += dt;
    if (j.t < 0) {
      this.anim.loop('Idle');
      return;
    }
    const k = Math.min(1, j.t / j.dur);
    this.x = j.sx + (j.tx - j.sx) * k;
    this.y = j.sy + (j.ty - j.sy) * k;
    this.jumpLift = Math.sin(k * Math.PI) * 46;
    this.anim.dir = Sprites.dirFromAngle(Math.atan2(j.ty - j.sy, j.tx - j.sx));
    if (k >= 1) {
      this.jump = null;
      this.jumpLift = 0;
      if (!this.flying) World.collide(this);
      this.anim.play('Attack', { speed: 1.4 });
    }
  }

  /** Called by combat.js when it touches you: animates the hit. */
  strike(pl) {
    if (!this.anim.busy()) {
      this.anim.dir = Sprites.dirFromAngle(Math.atan2(pl.y - this.y, pl.x - this.x));
      this.anim.play('Attack', { speed: 1.5 });
    }
  }

  draw(ctx) {
    const alpha = this.dead ? U.clamp(this.fade / 0.5, 0, 1) : 1;
    if (alpha <= 0) return;

    const gold = this.golden || this.behavior === 'thief' || (this.remote && !this.boss && Events.golden);
    if ((this.boss || this.shiny || gold) && !this.dead) {
      ctx.save();
      ctx.globalAlpha = (gold && !this.boss ? 0.32 : 0.22) + Math.sin(this.bob * 0.5) * 0.06;
      ctx.fillStyle = this.ai && this.ai.fury ? '#ff4a4a' : this.shiny ? '#9ae6ff' : gold ? '#ffd23f' : '#ffd95e';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.6, this.r * 0.6, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
    // Floaters are already in the air in their sprite: they just bob a little.
    // (And jumpers, in an arc.)
    const lift = (this.flying && !this.boss ? 1 + Math.sin(this.bob) * 1.5 : 0) + (this.jumpLift || 0);
    this.anim.draw(ctx, this.x, this.y - lift, { flash: this.flash > 0, alpha });
    ctx.restore();

    if (this.dead) return;

    // Shield (or just sent out by a gym leader): blue bubble.
    if (this.shield > 0 || this.guard > 0 || this.netFlag('shield')) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.bob) * 0.08;
      ctx.strokeStyle = '#9fd8ff';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(127,200,255,.14)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - this.bodyH * 0.45, this.r * 1.5, this.bodyH * 0.65, 0, 0, 6.2832);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.burn > 0 || this.poison > 0 || this.netFlag('burn') || this.netFlag('poison')) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = this.burn > 0 || this.netFlag('burn') ? '#ff8a3d' : '#c86bdc';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.2, this.r * 0.5, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    // Supports: icon above, so you know whom to go for first.
    const SUP = { healer: 'heart', shielder: 'shield', summoner: 'friends' };
    if (SUP[this.behavior])
      Icons.draw(ctx, SUP[this.behavior], Math.round(this.x - 6), Math.round(this.y - this.bodyH - (this.hp < this.maxHp ? 26 : 18)), 12);

    if (this.boss || this.hp < this.maxHp) {
      const w = this.boss ? 90 : Math.max(22, this.r * 2);
      const y = this.y - this.bodyH - 10;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(this.x - w / 2, y, w, 3.4);
      ctx.fillStyle = this.boss ? '#ffcb3d' : '#ff5f6d';
      ctx.fillRect(this.x - w / 2, y, w * Math.max(0, this.hp / this.maxHp), 3.4);
    }
  }
}

// ---------------- manager ----------------

export { Enemy };

export const EnemyMgr = (() => {
  let list = []; // alive
  let corpses = []; // fainting / fading out
  const CELL = 52;
  const grid = new Map();

  const byId = new Map();
  function clear() {
    list = [];
    corpses = [];
    grid.clear();
    byId.clear();
  }
  function all() {
    return list;
  }
  function add(e) {
    list.push(e);
    byId.set(e.id, e);
    if (Coop.isHost) Coop.enemyAdded(e);
    return e;
  }
  function get(id) {
    return byId.get(id);
  }

  /** Local copy of a host enemy (co-op). */
  function addRemote(o) {
    if (byId.has(o.id)) return byId.get(o.id);
    const def = { dex: o.dex, hp: o.hp, spd: 0, dmg: o.dmg, xp: 0, behavior: o.beh || 'remote' };
    const e = new Enemy(def, o.x, o.y, { hp: 1, spd: 1, dmg: 1 }, o.boss);
    e.id = o.id;
    e.remote = true;
    if (o.shiny) e.makeShiny();
    e.maxHp = o.hp;
    e.hp = o.hp;
    e.net = { x: o.x, y: o.y, vx: 0, vy: 0, age: 0, dir: 0, anim: 0, st: 0 };
    list.push(e);
    byId.set(e.id, e);
    return e;
  }

  // --- rift arena ---
  let stashed = null;

  /** Stores the map enemies while the arena lasts. */
  function stash() {
    stashed = list.filter(e => !e.dead);
    for (const e of stashed) byId.delete(e.id);
    list = [];
    corpses = [];
  }

  /** On return: removes the arena ones and restores the map ones (notifying the others). */
  function restore() {
    for (const e of list) {
      byId.delete(e.id);
      if (Coop.isHost) Coop.enemyGone(e, false);
    }
    list = [];
    corpses = [];
    for (const e of stashed || []) add(e);
    stashed = null;
  }

  /** Guest: deletes the copies (they will arrive again from the host). */
  function clearRemote() {
    for (const e of list) if (e.remote) byId.delete(e.id);
    list = list.filter(e => !e.remote);
    corpses = corpses.filter(e => !e.remote);
  }

  /** Removes a copy (the host says it fainted or moved away). */
  function removeRemote(id, died) {
    const e = byId.get(id);
    if (!e) return;
    byId.delete(id);
    if (died) {
      e.die();
      Progress.kill(e);
      Mega.onKill(e);
    }
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
    if (died) corpses.push(e);
  }

  function key(cx, cy) {
    return (cx * 73856093) ^ (cy * 19349663);
  }

  // The cell lists are emptied and reused (not thrown away) every frame; with
  // too many cells (the horde spread out) it starts over so it doesn't grow forever.
  function rebuildGrid() {
    if (grid.size > 250) grid.clear();
    else for (const b of grid.values()) b.length = 0;
    for (const e of list) {
      if (e.dead) continue;
      const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(e);
    }
  }

  /** Living enemies whose circle touches this circle. */
  function queryCircle(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CELL) - 1,
      c1x = Math.floor((x + r) / CELL) + 1;
    const c0y = Math.floor((y - r) / CELL) - 1,
      c1y = Math.floor((y + r) / CELL) + 1;
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const b = grid.get(key(cx, cy));
        if (!b) continue;
        for (const e of b) {
          if (e.dead) continue;
          const rr = r + e.r;
          if (U.dist2(x, y, e.x, e.y) <= rr * rr) out.push(e);
        }
      }
    }
    return out;
  }

  function separate(dt) {
    const SEP = B.separation;
    for (const e of list) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / CELL),
        cy = Math.floor(e.y / CELL);
      let px = 0,
        py = 0,
        n = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const b = grid.get(key(cx + i, cy + j));
          if (!b) continue;
          for (const o of b) {
            if (o === e || o.dead) continue;
            const min = (e.r + o.r) * SEP.overlap;
            const dx = e.x - o.x,
              dy = e.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > min * min || d2 < 1e-4) continue;
            const d = Math.sqrt(d2);
            const f = (min - d) / min;
            px += (dx / d) * f;
            py += (dy / d) * f;
            if (++n > SEP.maxNear) break;
          }
        }
      }
      if (n) {
        e.x += px * SEP.push * dt;
        e.y += py * SEP.push * dt;
        if (!e.flying) World.collide(e);
      }
    }
  }

  /** The nearest living player (downed players attract no one). */
  function nearestPlayer(players, x, y) {
    let best = null,
      bd = Infinity;
    for (const p of players) {
      if (p.dead) continue;
      const d = U.dist2(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * @param players  [local player, ...teammates]. The run stats
   *                 (defeated, bosses) are recorded on the first one.
   */
  function update(dt, players) {
    if (!Array.isArray(players)) players = [players];
    const pl = players[0];
    // Smoothed velocity of each player (also works for teammates).
    for (const p of players) {
      if (p._px != null && dt > 0) {
        const k = Math.min(1, dt * 5);
        p._vx += ((p.x - p._px) / dt - p._vx) * k;
        p._vy += ((p.y - p._py) / dt - p._vy) * k;
        if (Math.abs(p.x - p._px) > 200 || Math.abs(p.y - p._py) > 200) p._vx = p._vy = 0; // teleport
      } else {
        p._vx = 0;
        p._vy = 0;
      }
      p._px = p.x;
      p._py = p.y;
    }
    rebuildGrid();
    for (const e of list) {
      if (e.remote) e.netUpdate(dt);
      else e.update(dt, nearestPlayer(players, e.x, e.y) || pl);
    }
    if (!Coop.active || Coop.isHost) separate(dt);
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.remote) continue;
      if (e.dead) {
        pl.kills++;
        if (e.boss && !e.judge) pl.bosses++;
        Progress.kill(e);
        Mega.onKill(e);
        corpses.push(e);
        list.splice(i, 1);
        byId.delete(e.id);
        if (Coop.isHost) Coop.enemyGone(e, true);
        continue;
      }
      const near = nearestPlayer(players, e.x, e.y) || pl;
      // The treasure goblin escapes if you don't catch it in time.
      if (e.behavior === 'thief' && (e.life -= dt) <= 0) {
        FX.burst(e.x, e.y - 10, '#ffd23f', 16, 140);
        Spawner.say(`${e.name} got away!`, 2.4);
        list.splice(i, 1);
        byId.delete(e.id);
        if (Coop.isHost) Coop.enemyGone(e, false);
        continue;
      }
      if (e.boss || e.shiny || Rift.inArena) continue;
      // Stragglers: those that fall behind while you run and have been
      // OUT OF VIEW (of everyone) for a while reappear ahead of you. That way
      // you can't just run away, and one you can see never disappears.
      const S = B.straggler;
      const d2 = U.dist2(e.x, e.y, near.x, near.y);
      const R = Camera.outerRadius() + S.margin;
      const unseen = d2 > R * R && !Camera.sees(e.x, e.y, S.pad);
      const sp = Math.hypot(near._vx || 0, near._vy || 0);
      const behind = sp > S.minSpd && (e.x - near.x) * near._vx + (e.y - near.y) * near._vy < -S.behind * Math.sqrt(d2) * sp;
      if (unseen && behind) e.lagT += dt;
      else if (!unseen) e.lagT = 0;
      if ((unseen && e.lagT > S.lagT) || d2 > S.farDist * S.farDist) {
        e.lagT = 0;
        if (!Spawner.ahead(e, near)) {
          list.splice(i, 1);
          byId.delete(e.id);
          if (Coop.isHost) Coop.enemyGone(e, false);
        }
      }
    }
    for (let i = corpses.length - 1; i >= 0; i--) {
      if (corpses[i].remote) corpses[i].netUpdate(dt);
      else corpses[i].update(dt, pl);
      if (corpses[i].fade <= 0) corpses.splice(i, 1);
    }
    if (corpses.length > 120) corpses.splice(0, corpses.length - 120);
  }

  /** What to draw, Y-sorted along with the rest of the scene. */
  /** Enemies and corpses on screen. The same array every call (read it right away). */
  const drawOut = [];
  function drawables(cam) {
    const out = drawOut;
    out.length = 0;
    for (const e of corpses) if (cam.sees(e.x, e.y, 80)) out.push(e);
    for (const e of list) if (cam.sees(e.x, e.y, 80)) out.push(e);
    return out;
  }

  function bossAlive() {
    return list.some(e => e.boss && !e.dead);
  }
  function shinies() {
    return list.filter(e => e.shiny && !e.dead);
  }

  return {
    clear,
    all,
    add,
    get,
    addRemote,
    removeRemote,
    stash,
    restore,
    clearRemote,
    update,
    drawables,
    queryCircle,
    rebuildGrid,
    bossAlive,
    shinies,
    nearestPlayer,
    get count() {
      return list.length;
    }
  };
})();
