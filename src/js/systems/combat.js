/* ============ combat.js — move execution and collisions ============
 * Only the player's ACTIVE move runs. Each `kind` has its implementation
 * here. Every attack also damages the destructible scenery objects
 * (rocks, chests, tall grass).
 *
 * Everything happens on the ground plane: (x, y) are feet / shadow.
 *
 * Co-op: each computer runs ITS OWN player's attacks. Teammates' attacks
 * arrive over the network and are replayed as a "ghost" (ghostCast): they
 * look the same but deal no damage here (their owner already did).
 *
 * Things that stay on the map for a while (mines, falling meteors, turrets,
 * trail puddles) live in `fields` and are updated/drawn here.
 */
import { LIFT, U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { Moves } from '../data/moves.js';
import { Types } from '../data/types.js';
import { Weather } from './weather.js';
import { World } from '../world/world.js';
import { VFX } from '../entities/vfx.js';
import { FX } from '../entities/fx.js';
import { Projectiles } from '../entities/projectile.js';
import { EnemyMgr } from '../entities/enemy.js';
import { Coop } from '../net/coop.js';
import { Recount } from './recount.js';

export const Combat = (() => {
  const B = Balance.combat;
  const R = RNG.stream('combat');
  let ghost = false;
  let fields = [];

  // Gameplay rolls use the seeded 'combat' stream. A teammate's ghost cast is
  // only for show: it rolls with Math.random so it doesn't consume our rolls.
  const roll = (a, b) => (ghost ? U.rand(a, b) : R.range(a, b));
  const rollAngle = () => (ghost ? Math.random() * 6.2832 : R.angle());

  // ---------------- run the active move ----------------

  function tick(dt, pl, now) {
    if (pl.dead) return;
    // Links: every move in the active slot, each with its own cooldown.
    for (const m of pl.activeGroup()) tickMove(dt, pl, m, now);
  }

  function tickMove(dt, pl, m, now) {
    if (m.kind === 'orbit') {
      orbit(pl, m, dt, now);
      return;
    }

    m.t -= dt;
    if (m.t > 0) return;
    // Attacks that need a target wait for one (don't waste the animation on thin air).
    if (needsTarget(m) && !(pl.target && U.dist(pl.x, pl.y, pl.target.x, pl.target.y) <= reach(m))) {
      m.t = B.retry;
      return;
    }
    m.t = Math.max(B.minCd, m.cd * pl.cdMul);
    pl.cast(m);
    if (Coop.active) Coop.cast(pl, m);
    // Link: its icon flashes on the HUD when cast (one that explodes right on the
    // enemy, like Ember after Quick Attack, is barely visible).
    m.castAt = performance.now();

    run(pl, m);
  }

  function run(pl, m) {
    switch (m.kind) {
      case 'projectile':
        fireProjectiles(pl, m);
        break;
      case 'melee':
        melee(pl, m);
        break;
      case 'beam':
        beam(pl, m);
        break;
      case 'nova':
        nova(pl, m);
        break;
      case 'aura':
        aura(pl, m);
        break;
      case 'buff':
        buff(pl, m);
        break;
      case 'boomerang':
        boomerang(pl, m);
        break;
      case 'chain':
        chain(pl, m);
        break;
      case 'mine':
        mines(pl, m);
        break;
      case 'meteor':
        meteors(pl, m);
        break;
      case 'turret':
        turret(pl, m);
        break;
      case 'dash':
        dash(pl, m);
        break;
      case 'trail':
        trailPatch(pl, m);
        break;
      case 'cone':
        cone(pl, m);
        break;
    }
  }

  const needsTarget = Moves.needsTarget;
  const reach = Moves.reach;

  // src: the move that fired it (damage meter, see systems/recount.js).
  function payload(m) {
    return { burn: m.burn || 0, poison: m.poison || 0, slow: m.slow || 0, knock: m.knock || 0, mtype: m.type, src: m };
  }

  function fireProjectiles(pl, m) {
    const col = U.TYPE_COLOR[m.type];
    const vis = VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    const spread = m.spread || 0;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * n;
      const j = B.projectile.aimJitter;
      const a = pl.aim + off + roll(-j, j);
      Projectiles.spawn(
        Object.assign(
          {
            x: pl.x + Math.cos(a) * 3,
            y: pl.y + Math.sin(a) * 3,
            vx: Math.cos(a) * m.speed,
            vy: Math.sin(a) * m.speed,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: m.life,
            pierce: m.pierce | 0,
            color: col,
            homing: m.homing || 0,
            hits: new Set(),
            vis,
            ghost,
            owner: pl
          },
          payload(m)
        )
      );
    }
    FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - LIFT + Math.sin(pl.aim) * pl.r, col, Math.cos(pl.aim), Math.sin(pl.aim), 3);
  }

  function nova(pl, m) {
    const col = U.TYPE_COLOR[m.type];
    const vis = VFX.forMove(m);
    const n = Math.max(B.nova.minCount, m.count | 0);
    const j = B.nova.jitter;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + roll(-j, j);
      Projectiles.spawn(
        Object.assign(
          {
            x: pl.x + Math.cos(a) * 3,
            y: pl.y + Math.sin(a) * 3,
            vx: Math.cos(a) * m.speed,
            vy: Math.sin(a) * m.speed,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: m.life,
            pierce: m.pierce | 0,
            color: col,
            homing: m.homing || 0,
            hits: new Set(),
            vis,
            ghost,
            owner: pl
          },
          payload(m)
        )
      );
    }
    FX.ring(pl.x, pl.y, pl.r, pl.r * 4, col, 0.3, 3);
  }

  function inArc(px, py, x, y, aim, half) {
    const a = Math.atan2(y - py, x - px);
    return Math.abs(((a - aim + Math.PI * 3) % 6.2832) - Math.PI) <= half;
  }

  function melee(pl, m) {
    const col = U.TYPE_COLOR[m.type];
    const half = Math.min(m.arc, 6.2832) / 2;
    FX.slash(pl.x, pl.y - LIFT * 0.5, pl.aim, m.radius, m.arc, col, VFX.forMove(m));
    if (ghost) return;

    for (const e of EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      if (!inArc(pl.x, pl.y, e.x, e.y, pl.aim, half)) continue;
      hit(pl, e, m.dmg * pl.atk, col, e.x - pl.x, e.y - pl.y, m.knock || 0, m);
    }
    for (const p of World.propsInCircle(pl.x, pl.y, m.radius)) {
      if (inArc(pl.x, pl.y, p.x, p.y, pl.aim, half)) World.damageProp(p, m.dmg * pl.atk, col);
    }
  }

  function beam(pl, m) {
    const col = U.TYPE_COLOR[m.type];
    const w = m.width;
    const ca = Math.cos(pl.aim),
      sa = Math.sin(pl.aim);

    // The beam stops at the first wall.
    let len = m.radius;
    for (let d = 8; d < m.radius; d += 8) {
      if (World.isWall(pl.x + ca * d, pl.y + sa * d)) {
        len = d;
        break;
      }
    }
    FX.beam(pl.x, pl.y - LIFT, pl.aim, len, w, col, VFX.forMove(m));
    if (ghost) return;
    Camera.kick(0.08);

    const mx = pl.x + (ca * len) / 2,
      my = pl.y + (sa * len) / 2;
    const onBeam = (x, y, r) => {
      const px = x - pl.x,
        py = y - pl.y;
      const along = px * ca + py * sa;
      if (along < -r || along > len + r) return false;
      return Math.abs(-px * sa + py * ca) <= w / 2 + r;
    };
    for (const e of EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (onBeam(e.x, e.y, e.r)) hit(pl, e, m.dmg * pl.atk, col, ca, sa, 0, m);
    }
    for (const p of World.propsInCircle(mx, my, len / 2 + w)) {
      if (onBeam(p.x, p.y, p.r)) World.damageProp(p, m.dmg * pl.atk, col);
    }
  }

  function aura(pl, m) {
    const col = U.TYPE_COLOR[m.type];
    FX.ring(pl.x, pl.y, m.radius * 0.5, m.radius, col, 0.28, 2);
    const vis = VFX.forMove(m);
    if (vis.aura) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * 6.2832,
          r = m.radius * U.rand(0.45, 1);
        const x = pl.x + Math.cos(a) * r,
          y = pl.y + Math.sin(a) * r * 0.8 - LIFT * 0.5;
        // Grass Knot pulls toward you; poison and shadows rise; the rest spin.
        const v = vis.inward
          ? [-Math.cos(a) * r * 2.2, -Math.sin(a) * r * 1.8]
          : vis.rise
            ? [U.rand(-10, 10), -55]
            : [-Math.sin(a) * 70, Math.cos(a) * 55];
        FX.sp(vis.aura, vis.pal, x, y, { vx: v[0], vy: v[1], life: 0.42, spin: VFX.spins(vis.aura) ? U.rand(-6, 6) : 0 });
      }
    }
    if (ghost) return;
    let healed = 0;
    for (const e of EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      hit(pl, e, m.dmg * pl.atk, col, e.x - pl.x, e.y - pl.y, 0, m);
      if (m.drain) healed += m.drain;
    }
    for (const p of World.propsInCircle(pl.x, pl.y, m.radius)) World.damageProp(p, m.dmg * pl.atk, col);
    if (healed > 0) pl.heal(Math.min(healed, B.aura.drainCap));
  }

  function buff(pl, m) {
    pl.addBuff(m.stat, m.amount, m.dur, m.stacks | 0, m.id);
    const col = U.TYPE_COLOR[m.type];
    FX.ring(pl.x, pl.y, pl.r * 2.4, pl.r * 1.1, col, 0.35, 2.5);
    const vis = VFX.forMove(m);
    for (let i = 0; i < 3; i++) {
      FX.sp(vis.buff || 'arrow', vis.pal, pl.x + U.rand(-pl.r * 1.4, pl.r * 1.4), pl.y - U.rand(0, pl.bodyH * 0.8), {
        vy: -70,
        life: 0.6
      });
    }
  }

  // ---------------- new families (2026-10-10) ----------------

  /** Boomerang: flies at the enemy, stops and comes back to you, hitting on the way out and back. */
  function boomerang(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const b = B.boomerang;
    const n = Math.max(1, m.count | 0),
      spread = m.spread || b.spread;
    const out = m.radius / m.speed; // outbound seconds
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * Math.min(n, b.spreadCountCap));
      Projectiles.spawn(
        Object.assign(
          {
            x: pl.x,
            y: pl.y,
            vx: Math.cos(a) * m.speed,
            vy: Math.sin(a) * m.speed,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: out * b.lifeMul + b.lifePad,
            pierce: b.pierce,
            color: col,
            hits: new Set(),
            vis,
            ghost,
            owner: pl,
            boom: out,
            bsp: m.speed * b.returnSpeed
          },
          payload(m)
        )
      );
    }
  }

  /** Chain: hits an enemy and jumps to the next closest ones (each jump a bit weaker). */
  function chain(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    let cur = pl.target && !pl.target.dead && pl.target.hurt ? pl.target : Projectiles.nearest(EnemyMgr.all(), pl.x, pl.y, reach(m));
    if (!cur) return;
    let fx = pl.x,
      fy = pl.y - LIFT,
      k = 1;
    const done = new Set();
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n && cur; i++) {
      done.add(cur.id);
      const tx = cur.x,
        ty = cur.y - cur.bodyH * 0.5;
      FX.beam(fx, fy, Math.atan2(ty - fy, tx - fx), Math.hypot(tx - fx, ty - fy), 10, col, vis);
      if (!ghost) {
        // Hex: more damage to targets already suffering a status.
        const hex = m.hex && (cur.burn > 0 || cur.poison > 0 || cur.slow > 0) ? m.hex : 1;
        hit(pl, cur, m.dmg * pl.atk * k * hex, col, tx - fx, ty - fy, 0, m);
      }
      k *= B.chain.falloff;
      fx = tx;
      fy = ty;
      let best = null,
        bd = m.radius * m.radius;
      for (const e of EnemyMgr.queryCircle(cur.x, cur.y, m.radius)) {
        if (done.has(e.id)) continue;
        const d = U.dist2(cur.x, cur.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      cur = best;
    }
    if (!ghost) Camera.kick(0.05);
  }

  /** Mines: stay on the ground and blow up when an enemy steps on them. */
  function mines(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const M = B.mine;
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = rollAngle(),
        d = n === 1 ? 0 : roll(M.scatter[0], M.scatter[1]);
      fields.push({
        kind: 'mine',
        owner: pl,
        ghost,
        m,
        col,
        vis,
        x: pl.x + Math.cos(a) * d,
        y: pl.y + Math.sin(a) * d * 0.8,
        t: 0,
        arm: M.arm,
        life: m.dur || M.life,
        r: m.radius,
        dmg: m.dmg * pl.atk
      });
    }
    // Only a few per player at most: the oldest ones go.
    const mine = fields.filter(f => f.kind === 'mine' && f.owner === pl);
    for (const f of mine.slice(0, Math.max(0, mine.length - (M.keepBase + n * M.keepPerCount)))) f.gone = true;
  }

  /** Meteors: fall from the sky onto nearby enemies (the shadow warns where). */
  function meteors(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const M = B.meteor;
    const n = Math.max(1, m.count | 0);
    const all = EnemyMgr.queryCircle(pl.x, pl.y, reach(m)).filter(e => !e.dead);
    // n distinct random targets (fewer if there aren't enough: the rest land at random).
    const near = ghost ? U.pickN(all, n) : R.pickN(all, n);
    const [jx, jy] = M.jitter,
      [fx, fy] = M.fallback;
    for (let i = 0; i < n; i++) {
      const e = near[i];
      const x = e ? e.x + roll(-jx, jx) : pl.x + roll(-fx, fx);
      const y = e ? e.y + roll(-jy, jy) : pl.y + roll(-fy, fy);
      fields.push({
        kind: 'meteor',
        owner: pl,
        ghost,
        m,
        col,
        vis,
        x,
        y,
        t: -i * M.stagger,
        fall: M.fall,
        r: m.radius,
        dmg: m.dmg * pl.atk
      });
    }
  }

  /** Turret: leaves something on the ground that fires on its own for a while. */
  function turret(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const T = B.turret;
    const a = pl.aim + Math.PI + roll(-T.angleJitter, T.angleJitter);
    fields.push({
      kind: 'turret',
      owner: pl,
      ghost,
      m,
      col,
      vis,
      x: pl.x + Math.cos(a) * T.offset[0],
      y: pl.y + Math.sin(a) * T.offset[1],
      t: 0,
      life: m.dur || T.life,
      shotT: T.firstShot,
      dmg: m.dmg * pl.atk
    });
    const mine = fields.filter(f => f.kind === 'turret' && f.owner === pl && !f.gone);
    for (const f of mine.slice(0, Math.max(0, mine.length - Math.max(1, m.count | 0)))) f.gone = true;
    FX.ring(pl.x, pl.y, 4, 30, col, 0.3, 2);
  }

  /** Dash: you streak toward the enemy and hit everything along the way. */
  function dash(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const ca = Math.cos(pl.aim),
      sa = Math.sin(pl.aim);
    const sx = pl.x,
      sy = pl.y;
    let len = 0;
    for (let d = 8; d <= m.radius; d += 8) {
      if (!World.isFree(sx + ca * d, sy + sa * d, pl.r * 0.8, true)) break;
      len = d;
    }
    // Afterimage: several copies of the strike along the path.
    for (let d = 0; d <= len; d += 22)
      FX.sp(vis.proj || 'streak', vis.pal, sx + ca * d, sy + sa * d - LIFT * 0.6, { life: 0.22, angle: pl.aim });
    FX.slash(sx + ca * len, sy + sa * len - LIFT * 0.5, pl.aim, 34, 2.2, col, vis);
    if (ghost) return;
    pl.x = sx + ca * len;
    pl.y = sy + sa * len;
    World.collide(pl);
    pl.invuln = Math.max(pl.invuln || 0, B.dash.invuln);
    const w = m.width || B.dash.width;
    const mx = sx + (ca * len) / 2,
      my = sy + (sa * len) / 2;
    for (const e of EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, e.x, e.y) <= (w / 2 + e.r) ** 2) hit(pl, e, m.dmg * pl.atk, col, ca, sa, m.knock || 0, m);
    }
    for (const p of World.propsInCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, p.x, p.y) <= (w / 2 + p.r) ** 2) World.damageProp(p, m.dmg * pl.atk, col);
    }
    Camera.kick(0.12);
  }

  /** Trail: you leave puddles that damage whatever walks over them. */
  function trailPatch(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    // Standing still doesn't drop a new one on top of the last (only now and then).
    const T = B.trail;
    const last = pl.lastPatch;
    if (last && U.dist2(last.x, last.y, pl.x, pl.y) < (m.radius * T.spacing) ** 2 && last.t < T.refresh) return;
    const f = {
      kind: 'patch',
      owner: pl,
      ghost,
      m,
      col,
      vis,
      x: pl.x,
      y: pl.y,
      t: 0,
      life: m.dur || T.life,
      r: m.radius,
      tick: 0,
      dmg: m.dmg * pl.atk
    };
    fields.push(f);
    pl.lastPatch = f;
    const mine = fields.filter(o => o.kind === 'patch' && o.owner === pl && !o.gone);
    for (const o of mine.slice(0, Math.max(0, mine.length - T.max))) o.gone = true;
  }

  /** Short cone: many fast shots that don't travel far (breath, spray...). */
  function cone(pl, m) {
    const col = U.TYPE_COLOR[m.type],
      vis = VFX.forMove(m);
    const C = B.cone;
    const n = Math.max(C.minCount, m.count | 0),
      arc = m.arc || C.arc;
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (i / (n - 1) - 0.5) * arc + roll(-C.jitter, C.jitter);
      const sp = m.speed * roll(C.speed[0], C.speed[1]);
      Projectiles.spawn(
        Object.assign(
          {
            x: pl.x + Math.cos(a) * 4,
            y: pl.y + Math.sin(a) * 4,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: m.life * roll(C.life[0], C.life[1]),
            pierce: m.pierce | 0,
            color: col,
            hits: new Set(),
            vis,
            ghost,
            owner: pl
          },
          payload(m)
        )
      );
    }
    FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - LIFT + Math.sin(pl.aim) * pl.r, col, Math.cos(pl.aim), Math.sin(pl.aim), 5);
  }

  /** Damage from a field (mine, meteor, puddle) to everything in its circle. */
  function blast(f, r, k = 1) {
    if (f.ghost) return;
    const pl = f.owner,
      m = f.m;
    for (const e of EnemyMgr.queryCircle(f.x, f.y, r)) hit(pl, e, f.dmg * k, f.col, e.x - f.x, e.y - f.y, m.knock || 0, m);
    for (const p of World.propsInCircle(f.x, f.y, r)) World.damageProp(p, f.dmg * k, f.col);
  }

  function updateFields(dt) {
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i];
      f.t += dt;
      if (f.gone || !f.owner || (f.life && f.t >= f.life && f.kind !== 'mine')) {
        fields.splice(i, 1);
        continue;
      }
      if (f.kind === 'mine') {
        const armed = f.t >= f.arm;
        const trig = armed && EnemyMgr.queryCircle(f.x, f.y, B.mine.trigger).length > 0;
        if (trig || f.t >= f.life) {
          FX.ring(f.x, f.y, 4, f.r, f.col, 0.3, 4);
          FX.burst(f.x, f.y - 6, f.col, 10, 150);
          if (Camera.sees(f.x, f.y, 40)) Audio.sfx('break');
          blast(f, f.r, trig ? 1 : B.mine.expireDmg);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'meteor') {
        if (f.t >= f.fall) {
          FX.ring(f.x, f.y, 4, f.r, f.col, 0.35, 4);
          FX.burst(f.x, f.y - 6, f.col, 12, 170);
          if (Camera.sees(f.x, f.y, 40)) {
            Audio.sfx('break');
            Camera.kick(0.12);
          }
          blast(f, f.r);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'turret') {
        f.shotT -= dt;
        if (f.shotT <= 0) {
          const m = f.m,
            T = B.turret;
          const tg = Projectiles.nearest(EnemyMgr.all(), f.x, f.y, m.range || T.range);
          f.shotT = tg ? m.rate || T.rate : T.idle;
          if (tg) {
            const a = Math.atan2(tg.y - f.y, tg.x - f.x);
            Projectiles.spawn(
              Object.assign(
                {
                  x: f.x,
                  y: f.y,
                  vx: Math.cos(a) * (m.speed || T.speed),
                  vy: Math.sin(a) * (m.speed || T.speed),
                  dmg: f.dmg,
                  r: m.size || T.size,
                  life: T.shotLife,
                  pierce: m.pierce | 0,
                  color: f.col,
                  hits: new Set(),
                  vis: f.vis,
                  ghost: f.ghost,
                  owner: f.owner
                },
                payload(m)
              )
            );
            f.kick = 0.12;
          }
        }
        if (f.kick > 0) f.kick -= dt;
      } else if (f.kind === 'patch') {
        f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = B.trail.tick;
          blast(f, f.r);
        }
        if (f.vis.aura && Math.random() < dt * 3 && Camera.sees(f.x, f.y, 20)) {
          FX.sp(f.vis.aura, f.vis.pal, f.x + U.rand(-f.r, f.r) * 0.6, f.y - 4, { vy: -40, life: 0.4 });
        }
      }
    }
  }

  /** Field parts drawn on the ground (beneath the Pokémon). */
  function drawGroundFields(ctx) {
    const now = performance.now() / 1000;
    for (const f of fields) {
      if (!Camera.sees(f.x, f.y, 60)) continue;
      ctx.save();
      if (f.kind === 'patch') {
        const a = Math.min(1, (f.life - f.t) * 2, f.t * 6);
        ctx.globalAlpha = 0.32 * a;
        ctx.fillStyle = f.col;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 0.5 * a;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.5, 0, 0, 6.2832);
        ctx.stroke();
      } else if (f.kind === 'mine') {
        const armed = f.t >= f.arm,
          blink = armed && Math.sin(now * 8 + f.x) > 0.3;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = f.col;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * 0.45, f.r * 0.28, 0, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 1;
        VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 4, { scale: 1, alpha: blink ? 1 : 0.75, frame: 0 });
      } else if (f.kind === 'meteor') {
        const k = U.clamp(f.t / f.fall, 0, 1);
        ctx.globalAlpha = 0.2 + k * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (0.3 + k * 0.7), f.r * 0.6 * (0.3 + k * 0.7), 0, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, 6.2832);
        ctx.stroke();
      } else if (f.kind === 'turret') {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, 11, 4.5, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Field parts drawn on top (falling meteors, turrets). */
  function drawAirFields(ctx) {
    const now = performance.now() / 1000;
    for (const f of fields) {
      if (!Camera.sees(f.x, f.y, 200)) continue;
      if (f.kind === 'meteor' && f.t > 0) {
        const k = U.clamp(f.t / f.fall, 0, 1);
        VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x + (1 - k) * 40, f.y - (1 - k) * 170 - 6, {
          scale: 1.5,
          angle: Math.atan2(170, -40),
          frame: Math.floor(now * 12)
        });
      } else if (f.kind === 'turret') {
        const fade = Math.min(1, (f.life - f.t) * 2, f.t * 5);
        const bob = Math.sin(now * 4 + f.x) * 2 - (f.kick > 0 ? 2 : 0);
        VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 16 + bob, { scale: 1.5, alpha: fade, frame: Math.floor(now * 8) });
      }
    }
  }

  function clearFields(owner) {
    fields = owner ? fields.filter(f => f.owner !== owner) : [];
  }

  function orbit(pl, m, dt, now, isGhost = false) {
    const col = U.TYPE_COLOR[m.type];
    const want = Math.max(1, m.count | 0);
    // Each orbit move has its own orbs (a link can have two).
    const mine = p => p.orb && p.owner === pl && p.mid === m.id;
    const orbs = Projectiles.all().filter(mine);
    // If the orb count changes (when the move is upgraded), they are all spread
    // evenly from where the first one is, without jumps.
    const relayout = orbs.length !== want;
    const base = orbs.length ? orbs[0].oa : now * m.speed;
    if (orbs.length > want) for (const p of orbs.slice(want)) Projectiles.remove(p);

    for (let i = orbs.length; i < want; i++) {
      Projectiles.spawnOrb(
        Object.assign(
          {
            owner: pl,
            ghost: isGhost,
            mid: m.id,
            x: pl.x,
            y: pl.y,
            r: m.size,
            color: col,
            vis: VFX.forMove(m),
            dmg: m.dmg * pl.atk,
            oa: (i / want) * 6.2832,
            orad: m.radius,
            ospeed: m.speed,
            rehit: Math.max(B.orbit.minRehit, m.cd)
          },
          payload(m)
        )
      );
    }
    const live = Projectiles.all().filter(mine);
    live.forEach((p, i) => {
      p.dmg = m.dmg * pl.atk;
      p.orad = m.radius;
      p.ospeed = m.speed;
      p.r = m.size;
      if (relayout) p.oa = base + (i / live.length) * 6.2832;
    });

    // Focus animation now and then, so it feels alive.
    pl.orbCastT = (pl.orbCastT || 0) - dt;
    if (pl.orbCastT <= 0) {
      pl.orbCastT = 1.6;
      pl.cast({ kind: 'orbit', cd: 1.6 });
    }
  }

  /** Replays a teammate's attack just for show (no damage). */
  function ghostCast(pl, id, lvl, aim, evolved) {
    const def = Moves.BY_ID[id];
    if (!def || def.kind === 'orbit') return;
    const m = Moves.instance(id, lvl);
    if (evolved) Moves.evolve(m);
    pl.aim = aim;
    ghost = true;
    try {
      pl.cast(m);
      run(pl, m);
    } finally {
      ghost = false;
    }
  }

  /** Orbs of a teammate whose active move is an orbit (visual only). */
  function ghostOrbit(pl, dt, now) {
    const m = pl.activeMove();
    if (m && m.kind === 'orbit' && !pl.dead) orbit(pl, m, dt, now, true);
    else if (Projectiles.all().some(p => p.orb && p.owner === pl)) Projectiles.clearOrbs(pl);
  }

  // Critical hit (Upgrades → Critical Hit): ×B.crit.mul damage, big orange number.
  const isCrit = pl => !ghost && pl.critChance > 0 && R.chance(pl.critChance);

  /**
   * The one damage rule for every player hit on an enemy: crit roll, type
   * chart × weather, damage number, damage dealt (Shell Bell) and statuses.
   * @param type  attack type (none: no type multiplier and no hint)
   * @param st    { burn, poison, slow } to apply (a move or a projectile)
   */
  function damage(pl, e, dmg, col, dx, dy, knock, type, st) {
    const crit = isCrit(pl);
    dmg *= (type ? Weather.attackMult(type, e.types) : 1) * (crit ? B.crit.mul : 1);
    e.hurt(dmg, col, dx, dy, knock, crit ? 'crit' : type ? Types.label(Types.mult(type, e.types)) : null);
    pl.dmgDealt += dmg;
    // The move it came from (a projectile carries it in src): damage meter and who gets
    // the burn/poison ticks. Counted before shields and overkill, like any damage meter.
    const mv = st.src || st,
      mid = mv.dealt !== undefined ? mv.id : null;
    if (!ghost) {
      pl.onDealt(dmg);
      if (mid) mv.dealt += dmg;
    }
    if (st.burn) e.applyBurn(st.burn, mid);
    if (st.poison) e.applyPoison(st.poison, mid);
    if (st.slow) e.applySlow(st.slow);
  }

  function hit(pl, e, dmg, col, dx, dy, knock, m) {
    damage(pl, e, dmg, col, dx, dy, knock, m.type, m);
  }

  // ---------------- collisions ----------------

  /** Distance² from point (cx, cy) to segment (ax, ay)-(bx, by). */
  function segDist2(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy;
    let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - cx,
      qy = ay + dy * t - cy;
    return qx * qx + qy * qy;
  }

  function resolve(dt, pl, now) {
    const projectiles = Projectiles.all();

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // --- enemy shots: walls and solid objects give cover ---
      if (!p.friendly) {
        if (World.projectileBlock(p.x, p.y, p.r)) {
          FX.burst(p.x, p.y - LIFT, p.color, 5, 70);
          projectiles.splice(i, 1);
          continue;
        }
        if (U.dist2(p.x, p.y, pl.x, pl.y) < (p.r + pl.r) * (p.r + pl.r)) {
          pl.hurt(p.dmg, p.mtype);
          FX.burst(p.x, p.y - LIFT, p.color, 7, 110);
          projectiles.splice(i, 1);
        }
        continue;
      }

      // --- player shots ---
      // A teammate's orbs: visual only.
      if (p.orb && p.ghost) continue;
      if (!p.orb) {
        const block = World.projectileBlock(p.x, p.y, p.r);
        if (block === 'wall' || (block && !block.destructible)) {
          FX.burst(p.x, p.y - LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          continue;
        }
      }

      // Scenery objects (rocks, chests, grass).
      let consumed = false;
      for (const prop of World.propsInCircle(p.x, p.y, p.r)) {
        if (p.orb) {
          const k = 'p' + prop.id,
            last = p.hitLog.get(k) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(k, now);
          World.damageProp(prop, p.dmg, p.color);
          continue;
        }
        if (p.phits.has(prop.id)) continue;
        p.phits.add(prop.id);
        if (!p.ghost) World.damageProp(prop, p.dmg, p.color);
        // Grass doesn't stop shots; solid things use up pierce.
        if (prop.solid) {
          if (p.pierce > 0) p.pierce--;
          else {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        FX.burst(p.x, p.y - LIFT, p.color, 5, 80);
        projectiles.splice(i, 1);
        continue;
      }

      // Enemies. SWEPT collision: the whole stretch travelled this frame is checked,
      // not just the end point. A Thunder Shock moves 8 units per
      // frame: without this it passed through enemies hugging the player, who
      // were immune to every projectile move.
      const sx = p.orb || p.px == null ? p.x : p.px,
        sy = p.orb || p.py == null ? p.y : p.py;
      const half = Math.hypot(p.x - sx, p.y - sy) / 2;
      for (const e of EnemyMgr.queryCircle((sx + p.x) / 2, (sy + p.y) / 2, half + p.r)) {
        if (segDist2(sx, sy, p.x, p.y, e.x, e.y) > (p.r + e.r) * (p.r + e.r)) continue;
        if (p.orb) {
          const last = p.hitLog.get(e.id) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(e.id, now);
          // Orbits last the whole run: old hits are forgotten.
          if (p.hitLog.size > 300) for (const [k, t] of p.hitLog) if (now - t > p.rehit) p.hitLog.delete(k);
        } else {
          if (p.hits.has(e.id)) continue;
          p.hits.add(e.id);
        }

        // A teammate's ghost shot: it collides and shows, but deals no damage.
        if (p.ghost) {
          FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
          if (p.pierce > 0) {
            p.pierce--;
            continue;
          }
          FX.burst(p.x, p.y - LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          break;
        }

        damage(pl, e, p.dmg, p.color, p.vx || e.x - pl.x, p.vy || e.y - pl.y, p.knock, p.mtype, p);
        if (Math.random() < 0.5) FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });

        if (!p.orb) {
          if (p.pierce > 0) {
            p.pierce--;
          } else {
            FX.burst(p.x, p.y - LIFT, p.color, 5, 80);
            projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // --- enemy <-> player contact ---
    if (pl.dead) return;
    for (const e of EnemyMgr.queryCircle(pl.x, pl.y, pl.r + 40)) {
      if (U.dist2(e.x, e.y, pl.x, pl.y) > (e.r + pl.r) * (e.r + pl.r)) continue;
      if (e.touchCd > 0 || e.guard > 0 || e.behavior === 'thief') continue;
      e.touchCd = B.contact.touchCd;
      e.strike(pl);
      pl.hurt(e.dmg, e.atkType);
      const helmet = Balance.items.rockyHelmet;
      if (pl.hasItem('rockyhelmet')) {
        const d = helmet.dmg + pl.level * helmet.perLevel;
        e.hurt(d, '#9aa6b5', e.x - pl.x, e.y - pl.y, helmet.knock);
        Recount.other(pl, d);
      }
      const [nx, ny] = U.norm(e.x - pl.x, e.y - pl.y);
      e.kx += nx * B.contact.push;
      e.ky += ny * B.contact.push;
    }
  }

  return {
    tick,
    resolve,
    ghostCast,
    ghostOrbit,
    updateFields,
    drawGroundFields,
    drawAirFields,
    clearFields,
    get fieldCount() {
      return fields.length;
    }
  };
})();
