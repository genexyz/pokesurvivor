/* ============ player.js — the Pokémon you control ============
 * (x, y) are the FEET. Only ONE move is active at a time: it fires
 * on its own and is switched with 1-4 / Q / E. Each shot plays the matching
 * Mystery Dungeon attack animation (Attack, Shoot or Charge).
 */
G.Player = class Player {
  /**
   * @param mon   G.DEX entry
   * @param perks permanent upgrades, already resolved (see data/upgrades.js)
   */
  constructor(mon, perks = {}, shiny = false) {
    this.mon = mon;
    this.dex = mon.dex;
    this.shiny = shiny && G.Sprites.hasShiny(mon.dex);
    this.anim = new G.Sprites.Animator(mon.dex, 1, this.shiny);
    this.x = 0;
    this.y = 0;
    this.r = G.Sprites.bodyRadius(mon.dex);
    this.bodyH = G.Sprites.bodyHeight(mon.dex);

    this.atkMul = perks.atkMul || 1;
    this.spdMul = perks.spdMul || 1;
    this.cdMul = perks.cdMul || 1;
    this.dmgReduce = perks.dmgReduce || 0;
    this.regenFlat = perks.regen || 0;
    this.magnet = G.Balance.player.magnet * (perks.magnetMul || 1);
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

    this.buffs = {
      atk: { n: 0, t: 0, amount: 0 },
      spd: { n: 0, t: 0, amount: 0 },
      def: { n: 0, t: 0, amount: 0 },
      regen: { n: 0, t: 0, amount: 0 }
    };

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
    this.sashT = -999; // last time the Focus Sash saved you
    this.bellHeal = 0; // pending Shell Bell healing
    this.statsTaken = {}; // stat upgrades taken (evolution condition)
  }

  /** Seconds you must stand next to a downed teammate to revive them. */
  static get REVIVE_TIME() {
    return G.Balance.player.revive.time;
  }

  /** Experience needed to go from `level` to the next one (curve in G.Balance.player). */
  static xpFor(level) {
    return G.Balance.player.xpFor(level);
  }

  /** Move slots (a bond joins moves into one slot). */
  get maxMoves() {
    return G.Balance.player.moveSlots;
  }

  cy() {
    return this.y;
  }

  // ---------------- effective stats ----------------
  get atk() {
    return this.baseAtk * this.atkMul * (1 + this.buffs.atk.n * this.buffs.atk.amount);
  }
  get spd() {
    const s =
      this.baseSpd * this.spdMul * (1 + this.buffs.spd.n * this.buffs.spd.amount) * (this.slowT > 0 ? G.Balance.player.trapSlow : 1);
    const w = G.Weather.speedFor(this.mon.types);
    const slow = this.inLiquid ? G.World.liquidEffect(this.mon.types).slow || 1 : 1;
    return s * slow * w;
  }
  get reduction() {
    return Math.min(G.Balance.player.reductionCap, this.dmgReduce + this.buffs.def.n * this.buffs.def.amount);
  }
  get regen() {
    return this.regenFlat + this.buffs.regen.n * this.buffs.regen.amount;
  }

  // ---------------- moves ----------------
  addMove(id) {
    if (this.slots.length >= this.maxMoves || this.hasMove(id)) return false;
    const m = G.Moves.instance(id, 1);
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
      G.FX.dmgText(this.x, this.y - this.bodyH - 8, 'Choice Band', '#ff8ad8');
      return;
    }
    this.active = i;
    G.Projectiles.clearOrbs(this);
    G.Audio.sfx('select');
    for (const m of this.slots[i]) m.t = Math.min(m.t, m.cd * G.Balance.player.switchCdFrac);
    const m = this.slots[i][0];
    G.FX.ring(this.x, this.y - G.LIFT * 0.5, 6, this.r * 3.4, G.U.TYPE_COLOR[m.type], 0.3, 3);
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
    return G.Balance.player.bondMax;
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
    G.Projectiles.clearOrbs(this);
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
   * Called by combat.js when a move is cast. Picks the PMD animation and
   * speeds it up if the cooldown is shorter than the animation, so it chains.
   */
  cast(m) {
    // Life Orb: each attack costs a little HP (never knocks you out).
    if (this.hasItem('lifeorb') && m.kind !== 'orbit' && m.kind !== 'trail' && !this.remote) {
      const orb = G.Balance.items.lifeOrb;
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
    if (m.kind !== 'trail') G.Audio.sfx('shot', { kind: SND[m.kind] || m.kind, type: m.type });
    if (m.kind === 'trail') return;
    // Don't restart an animation halfway through: it would look jerky.
    if (this.anim.busy() && this.anim.progress() < 0.65) return;
    const meta = G.Sprites.animMeta(this.dex, anim);
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
    const B = G.Balance.player;
    let eff = null;
    if (type) {
      eff = G.Types.label(G.Types.mult(type, this.mon.types));
      amount *= G.Types.attackMult(type, this.mon.types);
    }
    // With a melee attack active you take less (meleeGuard): you have to
    // be on top of enemies to hit (they lagged far behind).
    const close = this.activeGroup().some(m => m.kind === 'melee') ? B.meleeGuard : 1;
    const d = pure ? Math.max(1, amount) : Math.max(1, amount * (1 - this.reduction) * close);
    this.hp -= d;
    this.invuln = B.hurtInvuln;
    this.flash = 0.14;
    G.Audio.sfx('hurt');
    G.Camera.kick(0.28);
    G.FX.dmgText(
      this.x,
      this.y - this.bodyH - 4,
      '-' + Math.round(d),
      eff === 'super' ? '#ff3048' : eff === 'weak' ? '#c9a0a8' : '#ff6b7a',
      eff === 'super'
    );
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#ff5f6d', 6, 90);
    // Focus Sash: survive the hit with 1 HP (once every `cooldown` s).
    const sash = G.Balance.items.focusSash;
    if (this.hp <= 0 && this.hasItem('focussash') && performance.now() - this.sashT > sash.cooldown * 1000) {
      this.sashT = performance.now();
      this.hp = 1;
      this.invuln = sash.invuln;
      G.FX.dmgText(this.x, this.y - this.bodyH - 16, 'Focus Sash!', '#ff9a3d', true);
      G.FX.ring(this.x, this.y, 6, 70, '#ff9a3d', 0.5, 4);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.anim.play('Faint', { hold: true });
      G.Projectiles.clearOrbs(this);
      this.reviveT = 0;
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (got >= 1) G.FX.dmgText(this.x, this.y - this.bodyH - 6, '+' + got, '#5fe08a');
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
    if (this.item) G.Items.BY[this.item].off(this);
    this.item = id;
    if (id) G.Items.BY[id].on(this);
  }

  /** Shell Bell: a little HP for the damage you deal (capped, see G.Balance.items.shellBell). */
  onDealt(dmg) {
    const bell = G.Balance.items.shellBell;
    if (this.item === 'shellbell') this.bellHeal = Math.min(bell.cap, this.bellHeal + dmg * bell.frac);
  }

  /** Altar power (see systems/interact.js): applied and removed automatically. */
  addPower(def, dur) {
    if (this.power) this.power.def.off(this);
    def.on(this);
    this.power = { def, t: dur, dur };
  }

  addBuff(stat, amount, dur, maxStacks) {
    const b = this.buffs[stat];
    if (!b) return;
    b.amount = amount;
    b.n = Math.min(maxStacks, b.n + 1);
    b.t = dur;
  }

  // ---------------- loop ----------------
  update(dt) {
    this.anim.update(dt);
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
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
      const h = Math.min(this.bellHeal, G.Balance.items.shellBell.rate * dt);
      this.hp = Math.min(this.maxHp, this.hp + h);
      this.bellHeal -= h;
    }
    if (this.power && (this.power.t -= dt) <= 0) {
      this.power.def.off(this);
      this.power = null;
    }
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // --- movement with collisions ---
    // (In co-op pausing doesn't stop the game: you just stand still.)
    const [ax, ay] = this.frozen ? [0, 0] : G.Input.axis();
    this.walking = ax !== 0 || ay !== 0;
    const s = this.spd;
    // Ice: you slide (velocity changes slowly).
    const B = G.Balance.player;
    const slide = this.inLiquid && G.World.liquidEffect(this.mon.types).slide;
    this.svx = slide ? G.U.damp(this.svx || 0, ax * s * B.ice.speedMul, B.ice.damp, dt) : ax * s;
    this.svy = slide ? G.U.damp(this.svy || 0, ay * s * B.ice.speedMul, B.ice.damp, dt) : ay * s;
    this.x += this.svx * dt;
    this.y += this.svy * dt;
    G.World.collide(this);
    if (this.walking) this.moveAngle = Math.atan2(ay, ax);

    // --- liquid terrain ---
    this.inLiquid = G.World.isLiquid(this.x, this.y);
    if (this.inLiquid) {
      const le = G.World.liquidEffect(this.mon.types);
      if (le.dmg) {
        this.lavaTick -= dt;
        if (this.lavaTick <= 0) {
          this.lavaTick = le.every;
          this.invuln = 0;
          this.hurt(Math.max(le.flat, this.maxHp * le.dmg * B.liquidDmgMul));
          G.FX.burst(this.x, this.y - 4, le.color, 5, 70);
        }
      } else if (this.walking && Math.random() < dt * 8) {
        G.FX.burst(this.x, this.y, le.slide ? '#ffffff' : '#b3defa', 2, 40);
      }
    }

    // --- aiming: nearest enemy; if none, where you are walking ---
    // Target priority by active attack:
    //   ranged (projectile, beam): the boss if in range > whatever touches you > the nearest
    //   melee and the rest:           whatever touches you > the boss > the nearest
    // With a horde on you something almost always touches you; if that always won,
    // ranged attacks would never hit the boss.
    // Without enemies, aim at the nearest rock or chest.
    const all = G.EnemyMgr.all();
    const m = this.activeMove();
    const ranged = !!m && (m.kind === 'projectile' || m.kind === 'beam');
    const A = B.aim;
    const threat = G.Projectiles.nearest(all, this.x, this.y, this.r + A.threatPad);
    const boss = all.find(e => e.boss && !e.dead && G.U.dist(this.x, this.y, e.x, e.y) < A.bossRange);
    const tg =
      (ranged ? boss || threat : threat || boss) ||
      G.Projectiles.nearest(all, this.x, this.y, A.range) ||
      G.World.nearestBreakable(this.x, this.y, A.breakableRange);
    this.target = tg;
    if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
    else if (this.walking) this.aim = this.moveAngle;

    // --- animation: face the target when attacking, otherwise where it walks ---
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? s / 110 : 1);
  }

  /** Gets back up (revived by a teammate in co-op). */
  revive(frac = G.Balance.player.revive.hpFrac) {
    this.dead = false;
    this.hp = Math.max(1, this.maxHp * frac);
    this.invuln = G.Balance.player.revive.invuln;
    this.reviveT = 0;
    this.anim._start('Idle', false);
    G.FX.ring(this.x, this.y, 6, 70, '#5fe08a', 0.5, 4);
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#9dffb8', 18, 150);
    G.Audio.sfx('heal');
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
    if (G.U.dist2(this.x, this.y, n.x, n.y) > 300 * 300) {
      this.x = n.x;
      this.y = n.y;
    } else {
      this.x = G.U.damp(this.x, n.x, 14, dt);
      this.y = G.U.damp(this.y, n.y, 14, dt);
    }
    if (n.hp < this.hp - 0.5 && !n.dead) this.flash = 0.14;
    this.hp = n.hp;
    this.maxHp = n.maxHp;
    this.magnet = n.mag || this.magnet;
    this.reviveT = n.rev || 0;
    if (n.dead && !this.dead) {
      this.dead = true;
      this.anim.play('Faint', { hold: true });
      G.Projectiles.clearOrbs(this);
    } else if (!n.dead && this.dead) this.revive(n.hp / (n.maxHp || 1));
    // Active move (for the halo, the HUD and the orbs).
    if (n.mv && (!this.moves[0] || this.moves[0].id !== n.mv || this.moves[0].lvl !== n.ml) && G.Moves.BY_ID[n.mv]) {
      this.moves = [G.Moves.instance(n.mv, n.ml || 1)];
      this.slots = [this.moves.slice()];
      this.active = 0;
      G.Projectiles.clearOrbs(this);
    }
    if (this.dead) return;
    this.walking = !!n.walk;
    this.moveAngle = n.ang;
    this.aim = n.aim;
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? this.baseSpd / 110 : 1);
  }

  draw(ctx) {
    // Halo in the active move's type colour, on the ground.
    const m = this.activeMove();
    if (m && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = G.U.TYPE_COLOR[m.type];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.5, this.r * 0.6, 0, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y);
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
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    let i = 0;
    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = COL[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.8 + i * 5, (this.r * 1.8 + i * 5) * 0.42, 0, 0, 6.2832 * (b.n / 5));
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
        -Math.PI / 2 + 6.2832 * Math.min(1, this.reviveT / G.Player.REVIVE_TIME)
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
};
