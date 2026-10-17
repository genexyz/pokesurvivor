/* ============ player.js — the Pokémon you control ============
 * (x, y) are the FEET. Only ONE move is active at a time: it fires
 * on its own and is switched with 1-4 / Q / E. Each shot plays the matching
 * Mystery Dungeon attack animation (Attack, Shoot or Charge).
 */
import { LIFT, U } from '../core/util.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { Moves } from '../data/moves.js';
import { Types } from '../data/types.js';
import { Items } from '../data/items.js';
import { Megas } from '../data/megas.js';
import { World } from '../world/world.js';
import { FX } from './fx.js';
import { Projectiles } from './projectile.js';
import { EnemyMgr } from './enemy.js';
import { Weather } from '../systems/weather.js';

const BUFF_COLOR = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };

export class Player {
  /**
   * @param mon   DEX entry
   * @param perks permanent upgrades, already resolved (see data/upgrades.js)
   */
  constructor(mon, perks = {}, shiny = false) {
    this.mon = mon;
    this.dex = mon.dex;
    this.shiny = shiny && Sprites.hasShiny(mon.dex);
    this.anim = new Sprites.Animator(mon.dex, 1, this.shiny);
    this.x = 0;
    this.y = 0;
    this.r = Sprites.bodyRadius(mon.dex);
    this.bodyH = Sprites.bodyHeight(mon.dex);

    this.atkMul = perks.atkMul || 1;
    this.spdMul = perks.spdMul || 1;
    this.cdMul = perks.cdMul || 1;
    this.dmgReduce = perks.dmgReduce || 0;
    this.regenFlat = perks.regen || 0;
    this.magnet = Balance.player.magnet * (perks.magnetMul || 1);
    this.xpMul = perks.xpMul || 1;
    this.coinMul = perks.coinMul || 1;

    this.maxHp = mon.hp + (perks.hp || 0);
    this.hp = this.maxHp;
    this.baseSpd = mon.spd;
    this.baseAtk = mon.atk;

    this.moves = []; // all learned moves
    this.slots = []; // slots: each one a list of moves cast together
    this.active = 0; // active slot
    this.bonds = 0; // unused bonds (legendary reward)

    // n stacks, t seconds left of dur, max stacks; src = id of the move that gave it (HUD icon).
    const buff = () => ({ n: 0, t: 0, dur: 0, max: 1, amount: 0, src: null });
    this.buffs = { atk: buff(), spd: buff(), def: buff(), regen: buff() };

    this.level = 1;
    this.xp = 0;
    this.xpNext = Player.xpFor(1);
    this.kills = 0;
    this.bosses = 0;
    this.rerolls = 0; // times the level cards were rerolled this run
    this.rerollBonus = perks.rerolls || 0; // rerolls bought in Upgrades (plus the free one)
    this.critChance = perks.crit || 0; // critical hit chance (Upgrades)
    this.banned = new Set(); // banned moves (Upgrades → Ban): never offered on cards
    this.bind = {}; // move -> fixed slot (0-3), chosen in Upgrades
    this.coins = 0; // coins collected this run
    this.t1 = 0;
    this.t10 = 0; // gacha tickets collected this run
    this.dmgDealt = 0;

    this.invuln = 0;
    this.flash = 0;
    this.aim = Math.PI / 2;
    this.moveAngle = Math.PI / 2;
    this.walking = false;
    this.inLiquid = false;
    this.lavaTick = 0;
    this.attackFace = 0; // time it keeps facing the target after attacking
    this.dead = false;
    this.power = null; // active altar power: { def, t, dur }
    this.slowT = 0; // stuck by a trap
    this.item = null; // held item (data/items.js), one per run
    this.sashCd = 0; // Focus Sash cooldown left (game seconds, so it holds at x2 speed)
    this.shinySash = this.shiny; // shiny partner: one free save per run (Balance.items.shinySash)
    this.bellHeal = 0; // pending Shell Bell healing
    this.statsTaken = {}; // stat upgrades taken (evolution condition)

    // Mega Evolution (systems/mega.js): `form` is the active Mega (data/megas.js) or null.
    this.form = null;
    this.megaT = 0; // seconds left as a Mega
    this.megaDur = 0;
    this.megaStone = false; // its Mega Stone was found this run
    this.megaCharge = 0; // meter, 0..Balance.mega.goal
    this.megaLock = 0; // seconds before the meter charges again after reverting
    this.baseBodyH = this.bodyH;

    // Trainer perks (data/perks.js, set by Perks.apply) and Playstyle achievement tracking.
    this.perks = [];
    this.cardOffer = 0; // level-up cards (0 = Balance.levelup.offer)
    this.bossBond = false; // bosses give a bond
    this.lastStand = false; // the next knockout leaves you standing (once)
    this.age = 0; // seconds alive this run
    this.firstHit = null; // `age` when you first took damage
  }

  /** Damage taken, for the "Untouchable" achievement (also weather chip damage). */
  noteHit() {
    if (this.firstHit == null) this.firstHit = this.age;
  }

  /** Seconds you must stand next to a downed teammate to revive them. */
  static get REVIVE_TIME() {
    return Balance.player.revive.time;
  }

  /** Experience needed to go from `level` to the next one (curve in Balance.player). */
  /** Colour of each buff (arcs under the feet and HUD circles). */
  static get BUFF_COLOR() {
    return BUFF_COLOR;
  }

  static xpFor(level) {
    return Balance.player.xpFor(level);
  }

  /** Move slots (a bond joins moves into one slot). */
  get maxMoves() {
    return Balance.player.moveSlots;
  }

  cy() {
    return this.y;
  }

  /** Sprite key drawn right now: the base dex, or its Mega form's ("m6x"). */
  get skin() {
    return this.form ? this.form.key : this.dex;
  }

  // ---------------- Mega Evolution ----------------
  /** Only the look (also for teammates in co-op): sprite and height. The hitbox stays the same. */
  megaVisual(def) {
    this.form = def || null;
    this.anim.setDex(this.skin, this.shiny);
    this.bodyH = def ? Sprites.bodyHeight(def.key) : this.baseBodyH;
    const col = def ? def.aura : '#ffffff';
    FX.ring(this.x, this.y, 8, def ? 150 : 70, col, def ? 0.7 : 0.4, def ? 6 : 3);
    FX.burst(this.x, this.y - this.bodyH * 0.5, col, def ? 40 : 14, def ? 260 : 140);
    if (def) FX.ring(this.x, this.y, 4, 90, '#ffffff', 0.5, 3);
  }

  /** Mega Evolves (systems/mega.js checks the meter): stats, shockwave, heal. */
  megaStart(def) {
    const B = Balance.mega;
    // The factors applied are kept on the player: a live balance change can't leave the stats wrong.
    const k = (this._megaK = B.k(def));
    this.atkMul *= k.atk;
    this.spdMul *= k.spd;
    this.cdMul *= k.cd;
    this.dmgReduce += k.def;
    this.megaVisual(def);
    this.megaT = this.megaDur = B.dur;
    this.megaCharge = 0;
    const W = B.burst;
    this.invuln = Math.max(this.invuln, W.invuln);
    this.heal(this.maxHp * W.heal);
    for (const e of EnemyMgr.queryCircle(this.x, this.y, W.radius)) {
      if (!e.dead) e.hurt(W.dmg + this.level * W.perLevel, def.aura, e.x - this.x, e.y - this.y, W.knock);
    }
    FX.dmgText(this.x, this.y - this.bodyH - 16, def.kind === 'primal' ? 'Primal Reversion!' : 'Mega Evolution!', def.aura, true);
    Camera.kick(0.7);
    Audio.sfx('legend');
  }

  /** Back to the base form (time's up or knocked out). */
  megaEnd() {
    if (!this.form) return;
    const k = this._megaK || { atk: 1, spd: 1, cd: 1, def: 0 };
    this.atkMul /= k.atk;
    this.spdMul /= k.spd;
    this.cdMul /= k.cd;
    this.dmgReduce -= k.def;
    this._megaK = null;
    this.megaT = 0;
    this.megaLock = Balance.mega.lockout;
    this.megaVisual(null);
  }

  // ---------------- effective stats ----------------
  get atk() {
    return this.baseAtk * this.atkMul * (1 + this.buffs.atk.n * this.buffs.atk.amount);
  }
  get spd() {
    const s = this.baseSpd * this.spdMul * (1 + this.buffs.spd.n * this.buffs.spd.amount) * (this.slowT > 0 ? Balance.player.trapSlow : 1);
    const w = Weather.speedFor(this.mon.types);
    const slow = this.inLiquid ? World.liquidEffect(this.mon.types).slow || 1 : 1;
    return s * slow * w;
  }
  get reduction() {
    return Math.min(Balance.player.reductionCap, this.dmgReduce + this.buffs.def.n * this.buffs.def.amount);
  }
  get regen() {
    return this.regenFlat + this.buffs.regen.n * this.buffs.regen.amount;
  }

  // ---------------- moves ----------------
  addMove(id) {
    if (this.slots.length >= this.maxMoves || this.hasMove(id)) return false;
    const m = Moves.instance(id, 1);
    this.moves.push(m);
    const group = [m];
    this.slots.push(group);
    this.arrange();
    // Switch to the new one, unless you are using a bond (it keeps your group).
    if (!(this.slots[this.active] && this.slots[this.active].length > 1)) this.setActive(this.slots.indexOf(group));
    return true;
  }

  /**
   * Fixed slots (Upgrades → Move shortcuts): each move with a chosen slot goes
   * in that number for muscle memory (Confusion always on 1...).
   * Until you have that many moves, it goes to the nearest one; the rest
   * fill the free slots in the order you learned them.
   */
  arrange() {
    const n = this.slots.length;
    if (n < 2 || !this.bind) return;
    const want = g => {
      let k = Infinity;
      for (const m of g) if (this.bind[m.id] != null) k = Math.min(k, this.bind[m.id]);
      return k;
    };
    const cur = this.slots[this.active];
    const out = new Array(n).fill(null);
    const bound = this.slots.filter(g => want(g) < Infinity).sort((a, b) => want(a) - want(b));
    for (const g of bound) {
      let p = Math.min(want(g), n - 1);
      while (p >= 0 && out[p]) p--; // taken: the previous one
      if (p < 0) {
        p = 0;
        while (out[p]) p++;
      } // or the first free one
      out[p] = g;
    }
    for (const g of this.slots) if (!out.includes(g)) out[out.indexOf(null)] = g;
    this.slots = out;
    if (cur) this.active = out.indexOf(cur);
  }

  hasMove(id) {
    return this.moves.some(m => m.id === id);
  }

  setActive(i) {
    if (i < 0 || i >= this.slots.length || i === this.active) return;
    // Choice Band: the move can't be switched.
    if (this.hasItem('choiceband') && this.slots[this.active]) {
      FX.dmgText(this.x, this.y - this.bodyH - 8, 'Choice Band', '#ff8ad8');
      return;
    }
    this.active = i;
    Projectiles.clearOrbs(this);
    Audio.sfx('select');
    for (const m of this.slots[i]) m.t = Math.min(m.t, m.cd * Balance.player.switchCdFrac);
    const m = this.slots[i][0];
    FX.ring(this.x, this.y - LIFT * 0.5, 6, this.r * 3.4, U.TYPE_COLOR[m.type], 0.3, 3);
  }

  cycle(dir) {
    if (!this.slots.length) return;
    this.setActive((this.active + dir + this.slots.length) % this.slots.length);
  }

  // ---------------- bonds (fusions) ----------------
  // Each defeated legendary grants a bond. It joins moves into a
  // single slot and they are cast together. Only one group grows (up to BOND_MAX); if
  // none is in progress, the bond joins two loose moves.
  static get BOND_MAX() {
    return Balance.player.bondMax;
  }

  /** What a bond can do now: add to a group or join two loose moves. */
  bondOptions() {
    const loose = this.slots.filter(s => s.length === 1).map(s => s[0]);
    const grow = this.slots.find(s => s.length > 1 && s.length < Player.BOND_MAX);
    if (grow) return loose.length ? { mode: 'add', group: grow, loose } : null;
    return loose.length >= 2 ? { mode: 'pair', group: null, loose } : null;
  }

  /** Joins the (loose) `moves` into `group` (or a new one) and spends a bond. */
  fuse(moves, group = null) {
    const target = group || this.slots.find(s => s[0] === moves[0]);
    const cur = this.slots[this.active];
    for (const m of moves) {
      if (target.includes(m)) continue;
      const i = this.slots.findIndex(s => s.length === 1 && s[0] === m);
      if (i < 0) continue;
      this.slots.splice(i, 1);
      target.push(m);
    }
    this.arrange();
    // Switch to the group, except with the Choice Band (you stay on your slot, if it still exists).
    const a = this.slots.indexOf(cur);
    this.active = this.hasItem('choiceband') && a >= 0 ? a : this.slots.indexOf(target);
    this.bonds = Math.max(0, this.bonds - 1);
    Projectiles.clearOrbs(this);
    return target;
  }

  /** Moves cast now (the active slot's group). */
  activeGroup() {
    return this.slots[this.active] || [];
  }

  activeMove() {
    return this.activeGroup()[0];
  }

  /**
   * How far a small chest can be and still be worth aiming at: the longest reach among
   * the active attacks that can hit it (0 = none can). Chain and meteor only pick enemies.
   */
  chestReach() {
    let r = 0;
    for (const m of this.activeGroup()) {
      if (!Moves.needsTarget(m) || m.kind === 'chain' || m.kind === 'meteor') continue;
      r = Math.max(r, Moves.reach(m));
    }
    return r;
  }

  /**
   * Called by combat.js when a move is cast. Picks the PMD animation and
   * speeds it up if the cooldown is shorter than the animation, so it chains.
   */
  cast(m) {
    // Life Orb: each attack costs a little HP (never knocks you out).
    if (this.hasItem('lifeorb') && m.kind !== 'orbit' && m.kind !== 'trail' && !this.remote) {
      const orb = Balance.items.lifeOrb;
      this.hp = Math.max(1, this.hp - Math.max(orb.min, this.maxHp * orb.cost));
    }
    const anim =
      {
        melee: 'Attack',
        beam: 'Shoot',
        projectile: 'Shoot',
        nova: 'Attack',
        aura: 'Charge',
        buff: 'Charge',
        orbit: 'Charge',
        boomerang: 'Shoot',
        chain: 'Shoot',
        mine: 'Charge',
        meteor: 'Charge',
        turret: 'Charge',
        dash: 'Attack',
        trail: 'Walk',
        cone: 'Shoot'
      }[m.kind] || 'Attack';
    // The new families sound like the closest classic one.
    const SND = {
      boomerang: 'projectile',
      chain: 'beam',
      mine: 'nova',
      meteor: 'nova',
      turret: 'buff',
      dash: 'melee',
      trail: 'aura',
      cone: 'projectile'
    };
    // The trail doesn't play a sound per puddle (it would be a constant buzz).
    if (m.kind !== 'trail') Audio.sfx('shot', { kind: SND[m.kind] || m.kind, type: m.type });
    if (m.kind === 'trail') return;
    // Don't restart an animation halfway through: it would look jerky.
    if (this.anim.busy() && this.anim.progress() < 0.65) return;
    const meta = Sprites.animMeta(this.skin, anim);
    const len = meta ? meta.d.reduce((a, b) => a + b, 0) / 60 : 0.4;
    const cd = Math.max(0.12, m.cd * this.cdMul);
    this.anim.play(anim, { speed: Math.max(1, len / (cd * 0.9)) });
    this.attackFace = 0.35;
  }

  // ---------------- damage and healing ----------------
  /**
   * @param type  attack type (type chart and weather); without a type, damage as is
   * @param pure  damage not reduced by defense or melee (Arceus)
   */
  hurt(amount, type = null, pure = false) {
    if (this.invuln > 0 || this.dead || this.god) return; // (god: dev panel)
    const B = Balance.player;
    let eff = null;
    if (type) {
      eff = Types.label(Types.mult(type, this.mon.types));
      amount *= Weather.attackMult(type, this.mon.types);
    }
    // With a melee attack active you take less (meleeGuard): you have to
    // be on top of enemies to hit (they lagged far behind).
    const close = this.activeGroup().some(m => m.kind === 'melee') ? B.meleeGuard : 1;
    const d = pure ? Math.max(1, amount) : Math.max(1, amount * (1 - this.reduction) * close);
    this.hp -= d;
    this.noteHit();
    this.invuln = B.hurtInvuln;
    this.flash = 0.14;
    Audio.sfx('hurt');
    Camera.kick(0.28);
    FX.dmgText(
      this.x,
      this.y - this.bodyH - 4,
      '-' + Math.round(d),
      eff === 'super' ? '#ff3048' : eff === 'weak' ? '#c9a0a8' : '#ff6b7a',
      eff === 'super'
    );
    FX.burst(this.x, this.y - this.bodyH * 0.5, '#ff5f6d', 6, 90);
    // Focus Sash: survive the hit with 1 HP (once every `cooldown` s).
    const sash = Balance.items.focusSash;
    if (this.hp <= 0 && this.hasItem('focussash') && this.sashCd <= 0) {
      this.sashCd = sash.cooldown;
      this.hp = 1;
      this.invuln = sash.invuln;
      FX.dmgText(this.x, this.y - this.bodyH - 16, 'Focus Sash!', '#ff9a3d', true);
      FX.ring(this.x, this.y, 6, 70, '#ff9a3d', 0.5, 4);
    }
    // Shiny partner: the first knockout of the run leaves you at 1 HP with a sparkle that pushes enemies back.
    const ss = Balance.items.shinySash;
    if (this.hp <= 0 && this.shinySash) {
      this.shinySash = false;
      this.hp = 1;
      this.invuln = ss.invuln;
      for (const e of EnemyMgr.queryCircle(this.x, this.y, ss.radius)) {
        if (!e.dead) e.hurt(ss.dmg + this.level * ss.perLevel, '#9ae6ff', e.x - this.x, e.y - this.y, ss.knock);
      }
      FX.dmgText(this.x, this.y - this.bodyH - 16, 'Shiny Sash!', '#9ae6ff', true);
      FX.ring(this.x, this.y, 8, ss.radius, '#9ae6ff', 0.6, 5);
      FX.burst(this.x, this.y - this.bodyH * 0.5, '#fff4a8', 24, 220);
      Camera.kick(0.8);
      Audio.sfx('shiny');
    }
    // Last stand perk: once per run, back up with part of your HP.
    if (this.hp <= 0 && this.lastStand) {
      const L = Balance.perks.lastStand;
      this.lastStand = false;
      this.hp = Math.max(1, this.maxHp * L.hp);
      this.invuln = L.invuln;
      FX.dmgText(this.x, this.y - this.bodyH - 16, 'Last stand!', '#ffd23f', true);
      FX.ring(this.x, this.y, 6, 110, '#ffd23f', 0.7, 5);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.megaEnd(); // faints in its base form
      this.dead = true;
      this.anim.play('Faint', { hold: true });
      Projectiles.clearOrbs(this);
      this.reviveT = 0;
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (got >= 1) FX.dmgText(this.x, this.y - this.bodyH - 6, '+' + got, '#5fe08a');
  }

  addMaxHp(amount) {
    this.maxHp += amount;
    this.hp += amount;
  }

  /** Returns how many levels were gained (can be several at once). */
  gainXp(amount) {
    this.xp += amount * this.xpMul;
    let leveled = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Player.xpFor(this.level);
      leveled++;
    }
    return leveled;
  }

  // ---------------- held item ----------------
  hasItem(id) {
    return this.item === id;
  }

  /** Equips an item (and removes the previous one). */
  equip(id) {
    if (this.item) Items.BY[this.item].off(this);
    this.item = id;
    if (id) Items.BY[id].on(this);
  }

  /** Shell Bell: a little HP for the damage you deal (capped, see Balance.items.shellBell). */
  onDealt(dmg) {
    const bell = Balance.items.shellBell;
    if (this.item === 'shellbell') this.bellHeal = Math.min(bell.cap, this.bellHeal + dmg * bell.frac);
  }

  /** Altar power (see systems/interact.js): applied and removed automatically. */
  addPower(def, dur) {
    if (this.power) this.power.def.off(this);
    def.on(this);
    this.power = { def, t: dur, dur };
  }

  addBuff(stat, amount, dur, maxStacks, src = null) {
    const b = this.buffs[stat];
    if (!b) return;
    b.amount = amount;
    b.max = Math.max(1, maxStacks);
    b.n = Math.min(maxStacks, b.n + 1);
    b.t = b.dur = dur;
    if (src) b.src = src;
  }

  // ---------------- loop ----------------
  update(dt) {
    this.anim.update(dt);
    if (this.dead) return;
    this.age += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.sashCd > 0) this.sashCd -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;

    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n > 0) {
        b.t -= dt;
        if (b.t <= 0) b.n = 0;
      }
    }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.bellHeal > 0) {
      const h = Math.min(this.bellHeal, Balance.items.shellBell.rate * dt);
      this.hp = Math.min(this.maxHp, this.hp + h);
      this.bellHeal -= h;
    }
    if (this.power && (this.power.t -= dt) <= 0) {
      this.power.def.off(this);
      this.power = null;
    }
    if (this.form && (this.megaT -= dt) <= 0) this.megaEnd();
    if (this.megaLock > 0) this.megaLock -= dt;
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // --- movement with collisions ---
    // (In co-op pausing doesn't stop the game: you just stand still.)
    const [ax, ay] = this.frozen ? [0, 0] : Input.axis();
    this.walking = ax !== 0 || ay !== 0;
    const s = this.spd;
    // Ice: you slide (velocity changes slowly).
    const B = Balance.player;
    const slide = this.inLiquid && World.liquidEffect(this.mon.types).slide;
    this.svx = slide ? U.damp(this.svx || 0, ax * s * B.ice.speedMul, B.ice.damp, dt) : ax * s;
    this.svy = slide ? U.damp(this.svy || 0, ay * s * B.ice.speedMul, B.ice.damp, dt) : ay * s;
    this.x += this.svx * dt;
    this.y += this.svy * dt;
    World.collide(this);
    if (this.walking) this.moveAngle = Math.atan2(ay, ax);

    // --- liquid terrain ---
    this.inLiquid = World.isLiquid(this.x, this.y);
    if (this.inLiquid) {
      const le = World.liquidEffect(this.mon.types);
      if (le.dmg) {
        this.lavaTick -= dt;
        if (this.lavaTick <= 0) {
          this.lavaTick = le.every;
          this.invuln = 0;
          this.hurt(Math.max(le.flat, this.maxHp * le.dmg * B.liquidDmgMul));
          FX.burst(this.x, this.y - 4, le.color, 5, 70);
        }
      } else if (this.walking && Math.random() < dt * 8) {
        FX.burst(this.x, this.y, le.slide ? '#ffffff' : '#b3defa', 2, 40);
      }
    }

    // --- aiming: nearest enemy; if none, where you are walking ---
    // Target priority by active attack:
    //   ranged (projectile, beam): the boss if in range > whatever touches you > the nearest
    //   melee and the rest:           whatever touches you > the boss > the nearest
    // With a horde on you something almost always touches you; if that always won,
    // ranged attacks would never hit the boss.
    // A small chest right next to you wins over everything (it breaks in a hit or two);
    // a little further away it still wins over the boss and the nearest enemy, but not
    // over whatever touches you. Only within the active attack's reach (or it would stall
    // waiting for a chest it can't hit) and only for attacks that can hit props.
    // Without enemies, aim at the nearest rock or chest.
    const all = EnemyMgr.all();
    const m = this.activeMove();
    const ranged = !!m && (m.kind === 'projectile' || m.kind === 'beam');
    const A = B.aim;
    const threat = Projectiles.nearest(all, this.x, this.y, this.r + A.threatPad);
    const boss = all.find(e => e.boss && !e.dead && U.dist(this.x, this.y, e.x, e.y) < A.bossRange);
    const foe = ranged ? boss || threat : threat || boss;
    let chest = null,
      chestNear = false;
    const chestReach = this.chestReach();
    if (chestReach > 0) {
      chest = World.nearestBreakable(this.x, this.y, Math.min(A.chestFar, chestReach), 'chest');
      const d = chest ? U.dist(this.x, this.y, chest.x, chest.y) : Infinity;
      // nearestBreakable counts the chest's own radius; combat checks reach from its centre.
      if (d > chestReach) chest = null;
      chestNear = !!chest && d <= A.chestNear;
    }
    const tg =
      (chestNear ? chest : threat ? foe : chest || foe) ||
      Projectiles.nearest(all, this.x, this.y, A.range) ||
      World.nearestBreakable(this.x, this.y, A.breakableRange);
    this.target = tg;
    if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
    else if (this.walking) this.aim = this.moveAngle;

    // --- animation: face the target when attacking, otherwise where it walks ---
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? s / 110 : 1);
  }

  /** Gets back up (revived by a teammate in co-op). */
  revive(frac = Balance.player.revive.hpFrac) {
    this.dead = false;
    this.hp = Math.max(1, this.maxHp * frac);
    this.invuln = Balance.player.revive.invuln;
    this.reviveT = 0;
    this.anim._start('Idle', false);
    FX.ring(this.x, this.y, 6, 70, '#5fe08a', 0.5, 4);
    FX.burst(this.x, this.y - this.bodyH * 0.5, '#9dffb8', 18, 150);
    Audio.sfx('heal');
  }

  // ---------------- teammate (co-op) ----------------

  /**
   * A teammate on another computer: its owner sends its state (position, HP,
   * active move...) and it is followed smoothly here.
   * n = { x, y, ang, walk, hp, maxHp, dead, mv, ml, mag, aim, rev }
   */
  netUpdate(dt) {
    this.anim.update(dt);
    const n = this.net;
    if (!n) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;
    if (U.dist2(this.x, this.y, n.x, n.y) > 300 * 300) {
      this.x = n.x;
      this.y = n.y;
    } else {
      this.x = U.damp(this.x, n.x, 14, dt);
      this.y = U.damp(this.y, n.y, 14, dt);
    }
    if (n.hp < this.hp - 0.5 && !n.dead) this.flash = 0.14;
    this.hp = n.hp;
    this.maxHp = n.maxHp;
    this.magnet = n.mag || this.magnet;
    this.reviveT = n.rev || 0;
    // Mega Evolution: only the look (their stats are on their screen). Before fainting: they faint in their base form.
    const mega = n.mg ? Megas.of(this.dex) : null;
    if (mega !== this.form) this.megaVisual(mega);
    if (n.dead && !this.dead) {
      this.dead = true;
      this.anim.play('Faint', { hold: true });
      Projectiles.clearOrbs(this);
    } else if (!n.dead && this.dead) this.revive(n.hp / (n.maxHp || 1));
    // Active move (for the halo, the HUD and the orbs).
    if (n.mv && (!this.moves[0] || this.moves[0].id !== n.mv || this.moves[0].lvl !== n.ml) && Moves.BY_ID[n.mv]) {
      this.moves = [Moves.instance(n.mv, n.ml || 1)];
      this.slots = [this.moves.slice()];
      this.active = 0;
      Projectiles.clearOrbs(this);
    }
    if (this.dead) return;
    this.walking = !!n.walk;
    this.moveAngle = n.ang;
    this.aim = n.aim;
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? this.baseSpd / 110 : 1);
  }

  draw(ctx) {
    // Halo in the active move's type colour, on the ground.
    const m = this.activeMove();
    if (m && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = U.TYPE_COLOR[m.type];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.5, this.r * 0.6, 0, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }
    Sprites.drawShadow(ctx, this.skin, this.x, this.y);
    // Mega Evolution: pulsing aura of its colour, under and around it.
    if (this.form && !this.dead) {
      const t = performance.now() / 1000,
        h = this.bodyH;
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(t * 5) * 0.06;
      ctx.fillStyle = this.form.aura;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y - h * 0.45, this.r * 2 + h * 0.25, h * 0.75, 0, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 0.5 + Math.sin(t * 7) * 0.2;
      ctx.strokeStyle = this.form.aura;
      ctx.lineWidth = 2;
      for (let j = 0; j < 2; j++) {
        const k = (t * 0.9 + j / 2) % 1; // rings rising from the feet
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - k * h, this.r * (1.9 - k * 0.6), this.r * (0.8 - k * 0.25), 0, 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Altar power: pulsing ring of its colour under the feet.
    if (this.power && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.15;
      ctx.strokeStyle = this.power.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 2.1, this.r * 0.85, 0, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    const alpha = this.invuln > 0 && !this.dead ? (Math.floor(this.invuln * 18) % 2 ? 0.45 : 1) : 1;
    this.anim.draw(ctx, this.x, this.y, { flash: this.flash > 0, softFlash: true, alpha, color: '#ffcb3d' });

    // Buff arcs around the feet.
    const COL = Player.BUFF_COLOR;
    let i = 0;
    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = COL[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.8 + i * 5, (this.r * 1.8 + i * 5) * 0.42, 0, 0, 6.2832 * (b.n / b.max));
      ctx.stroke();
      ctx.restore();
      i++;
    }

    // Co-op: "reviving" ring and name above.
    if (this.dead && this.reviveT > 0) {
      ctx.save();
      ctx.strokeStyle = '#5fe08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        this.x,
        this.y,
        this.r * 2.4,
        this.r * 1.0,
        0,
        -Math.PI / 2,
        -Math.PI / 2 + 6.2832 * Math.min(1, this.reviveT / Player.REVIVE_TIME)
      );
      ctx.stroke();
      ctx.restore();
    }
    if (this.tag) {
      ctx.save();
      ctx.font = '700 7px Pixelify,"Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      const y = this.y - this.bodyH - 8;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(this.tag, this.x, y);
      ctx.fillStyle = this.dead ? '#ff8a96' : this.tagColor || '#fff';
      ctx.fillText(this.tag, this.x, y);
      if (this.dead) {
        ctx.font = '700 6px Pixelify,"Segoe UI",sans-serif';
        ctx.strokeText(this.revLabel || '', this.x, y - 8);
        ctx.fillText(this.revLabel || '', this.x, y - 8);
      }
      ctx.restore();
    }
  }
}
