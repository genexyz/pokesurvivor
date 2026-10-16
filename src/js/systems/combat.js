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
G.Combat = (() => {
  let ghost = false;
  let fields = [];

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
    if (needsTarget(m) && !(pl.target && G.U.dist(pl.x, pl.y, pl.target.x, pl.target.y) <= reach(m))) {
      m.t = 0.05;
      return;
    }
    m.t = Math.max(0.05, m.cd * pl.cdMul);
    pl.cast(m);
    if (G.Coop.active) G.Coop.cast(pl, m);
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

  const TARGETED = ['melee', 'beam', 'projectile', 'boomerang', 'chain', 'meteor', 'dash', 'cone'];
  function needsTarget(m) {
    return TARGETED.includes(m.kind);
  }
  function reach(m) {
    if (m.kind === 'melee') return m.radius + 30;
    if (m.kind === 'beam') return m.radius + 20;
    if (m.kind === 'boomerang') return m.radius + 40;
    if (m.kind === 'chain') return 280;
    if (m.kind === 'meteor') return 340;
    if (m.kind === 'dash') return m.radius + 60;
    if (m.kind === 'cone') return m.speed * m.life + 30;
    return 520;
  }

  function payload(m) {
    return { burn: m.burn || 0, poison: m.poison || 0, slow: m.slow || 0, knock: m.knock || 0, mtype: m.type };
  }

  /** Type chart × weather for an attack of type `type` against `e`. */
  function typeK(type, e) {
    return G.Types.mult(type, e.types) * G.Weather.mult(type);
  }

  function fireProjectiles(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    const spread = m.spread || 0;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * n;
      const a = pl.aim + off + G.U.rand(-0.03, 0.03);
      G.Projectiles.spawn(
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
    G.FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - G.LIFT + Math.sin(pl.aim) * pl.r, col, Math.cos(pl.aim), Math.sin(pl.aim), 3);
  }

  function nova(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const vis = G.VFX.forMove(m);
    const n = Math.max(3, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + G.U.rand(-0.06, 0.06);
      G.Projectiles.spawn(
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
    G.FX.ring(pl.x, pl.y, pl.r, pl.r * 4, col, 0.3, 3);
  }

  function inArc(px, py, x, y, aim, half) {
    const a = Math.atan2(y - py, x - px);
    return Math.abs(((a - aim + Math.PI * 3) % 6.2832) - Math.PI) <= half;
  }

  function melee(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const half = Math.min(m.arc, 6.2832) / 2;
    G.FX.slash(pl.x, pl.y - G.LIFT * 0.5, pl.aim, m.radius, m.arc, col, G.VFX.forMove(m));
    if (ghost) return;

    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      if (!inArc(pl.x, pl.y, e.x, e.y, pl.aim, half)) continue;
      hit(pl, e, m.dmg * pl.atk, col, e.x - pl.x, e.y - pl.y, m.knock || 0, m);
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) {
      if (inArc(pl.x, pl.y, p.x, p.y, pl.aim, half)) G.World.damageProp(p, m.dmg * pl.atk, col);
    }
  }

  function beam(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const w = m.width;
    const ca = Math.cos(pl.aim),
      sa = Math.sin(pl.aim);

    // The beam stops at the first wall.
    let len = m.radius;
    for (let d = 8; d < m.radius; d += 8) {
      if (G.World.isWall(pl.x + ca * d, pl.y + sa * d)) {
        len = d;
        break;
      }
    }
    G.FX.beam(pl.x, pl.y - G.LIFT, pl.aim, len, w, col, G.VFX.forMove(m));
    if (ghost) return;
    G.Camera.kick(0.08);

    const mx = pl.x + (ca * len) / 2,
      my = pl.y + (sa * len) / 2;
    const onBeam = (x, y, r) => {
      const px = x - pl.x,
        py = y - pl.y;
      const along = px * ca + py * sa;
      if (along < -r || along > len + r) return false;
      return Math.abs(-px * sa + py * ca) <= w / 2 + r;
    };
    for (const e of G.EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (onBeam(e.x, e.y, e.r)) hit(pl, e, m.dmg * pl.atk, col, ca, sa, 0, m);
    }
    for (const p of G.World.propsInCircle(mx, my, len / 2 + w)) {
      if (onBeam(p.x, p.y, p.r)) G.World.damageProp(p, m.dmg * pl.atk, col);
    }
  }

  function aura(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    G.FX.ring(pl.x, pl.y, m.radius * 0.5, m.radius, col, 0.28, 2);
    const vis = G.VFX.forMove(m);
    if (vis.aura) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * 6.2832,
          r = m.radius * G.U.rand(0.45, 1);
        const x = pl.x + Math.cos(a) * r,
          y = pl.y + Math.sin(a) * r * 0.8 - G.LIFT * 0.5;
        // Grass Knot pulls toward you; poison and shadows rise; the rest spin.
        const v = vis.inward
          ? [-Math.cos(a) * r * 2.2, -Math.sin(a) * r * 1.8]
          : vis.rise
            ? [G.U.rand(-10, 10), -55]
            : [-Math.sin(a) * 70, Math.cos(a) * 55];
        G.FX.sp(vis.aura, vis.pal, x, y, { vx: v[0], vy: v[1], life: 0.42, spin: G.VFX.spins(vis.aura) ? G.U.rand(-6, 6) : 0 });
      }
    }
    if (ghost) return;
    let healed = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      hit(pl, e, m.dmg * pl.atk, col, e.x - pl.x, e.y - pl.y, 0, m);
      if (m.drain) healed += m.drain;
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) G.World.damageProp(p, m.dmg * pl.atk, col);
    if (healed > 0) pl.heal(Math.min(healed, 6));
  }

  function buff(pl, m) {
    pl.addBuff(m.stat, m.amount, m.dur, m.stacks | 0);
    const col = G.U.TYPE_COLOR[m.type];
    G.FX.ring(pl.x, pl.y, pl.r * 2.4, pl.r * 1.1, col, 0.35, 2.5);
    const vis = G.VFX.forMove(m);
    for (let i = 0; i < 3; i++) {
      G.FX.sp(vis.buff || 'arrow', vis.pal, pl.x + G.U.rand(-pl.r * 1.4, pl.r * 1.4), pl.y - G.U.rand(0, pl.bodyH * 0.8), {
        vy: -70,
        life: 0.6
      });
    }
  }

  // ---------------- new families (2026-10-10) ----------------

  /** Boomerang: flies at the enemy, stops and comes back to you, hitting on the way out and back. */
  function boomerang(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0),
      spread = m.spread || 0.5;
    const out = m.radius / m.speed; // outbound seconds
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * Math.min(n, 3));
      G.Projectiles.spawn(
        Object.assign(
          {
            x: pl.x,
            y: pl.y,
            vx: Math.cos(a) * m.speed,
            vy: Math.sin(a) * m.speed,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: out * 4 + 1.5,
            pierce: 999,
            color: col,
            hits: new Set(),
            vis,
            ghost,
            owner: pl,
            boom: out,
            bsp: m.speed * 1.1
          },
          payload(m)
        )
      );
    }
  }

  /** Chain: hits an enemy and jumps to the next closest ones (each jump a bit weaker). */
  function chain(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    let cur = pl.target && !pl.target.dead && pl.target.hurt ? pl.target : G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, reach(m));
    if (!cur) return;
    let fx = pl.x,
      fy = pl.y - G.LIFT,
      k = 1;
    const done = new Set();
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n && cur; i++) {
      done.add(cur.id);
      const tx = cur.x,
        ty = cur.y - cur.bodyH * 0.5;
      G.FX.beam(fx, fy, Math.atan2(ty - fy, tx - fx), Math.hypot(tx - fx, ty - fy), 10, col, vis);
      if (!ghost) {
        // Hex: more damage to targets already suffering a status.
        const hex = m.hex && (cur.burn > 0 || cur.poison > 0 || cur.slow > 0) ? m.hex : 1;
        hit(pl, cur, m.dmg * pl.atk * k * hex, col, tx - fx, ty - fy, 0, m);
      }
      k *= 0.85;
      fx = tx;
      fy = ty;
      let best = null,
        bd = m.radius * m.radius;
      for (const e of G.EnemyMgr.queryCircle(cur.x, cur.y, m.radius)) {
        if (done.has(e.id)) continue;
        const d = G.U.dist2(cur.x, cur.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      cur = best;
    }
    if (!ghost) G.Camera.kick(0.05);
  }

  /** Mines: stay on the ground and blow up when an enemy steps on them. */
  function mines(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832,
        d = n === 1 ? 0 : G.U.rand(18, 46);
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
        arm: 0.35,
        life: m.dur || 7,
        r: m.radius,
        dmg: m.dmg * pl.atk
      });
    }
    // Only a few per player at most: the oldest ones go.
    const mine = fields.filter(f => f.kind === 'mine' && f.owner === pl);
    for (const f of mine.slice(0, Math.max(0, mine.length - (4 + n * 2)))) f.gone = true;
  }

  /** Meteors: fall from the sky onto nearby enemies (the shadow warns where). */
  function meteors(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    const near = G.EnemyMgr.queryCircle(pl.x, pl.y, reach(m)).filter(e => !e.dead);
    G.U.shuffle ? G.U.shuffle(near) : near.sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      const e = near[i];
      const x = e ? e.x + G.U.rand(-8, 8) : pl.x + G.U.rand(-140, 140);
      const y = e ? e.y + G.U.rand(-6, 6) : pl.y + G.U.rand(-110, 110);
      fields.push({ kind: 'meteor', owner: pl, ghost, m, col, vis, x, y, t: -i * 0.09, fall: 0.5, r: m.radius, dmg: m.dmg * pl.atk });
    }
  }

  /** Turret: leaves something on the ground that fires on its own for a while. */
  function turret(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const a = pl.aim + Math.PI + G.U.rand(-0.6, 0.6);
    fields.push({
      kind: 'turret',
      owner: pl,
      ghost,
      m,
      col,
      vis,
      x: pl.x + Math.cos(a) * 26,
      y: pl.y + Math.sin(a) * 20,
      t: 0,
      life: m.dur || 6,
      shotT: 0.3,
      dmg: m.dmg * pl.atk
    });
    const mine = fields.filter(f => f.kind === 'turret' && f.owner === pl && !f.gone);
    for (const f of mine.slice(0, Math.max(0, mine.length - Math.max(1, m.count | 0)))) f.gone = true;
    G.FX.ring(pl.x, pl.y, 4, 30, col, 0.3, 2);
  }

  /** Dash: you streak toward the enemy and hit everything along the way. */
  function dash(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const ca = Math.cos(pl.aim),
      sa = Math.sin(pl.aim);
    const sx = pl.x,
      sy = pl.y;
    let len = 0;
    for (let d = 8; d <= m.radius; d += 8) {
      if (!G.World.isFree(sx + ca * d, sy + sa * d, pl.r * 0.8, true)) break;
      len = d;
    }
    // Afterimage: several copies of the strike along the path.
    for (let d = 0; d <= len; d += 22)
      G.FX.sp(vis.proj || 'streak', vis.pal, sx + ca * d, sy + sa * d - G.LIFT * 0.6, { life: 0.22, angle: pl.aim });
    G.FX.slash(sx + ca * len, sy + sa * len - G.LIFT * 0.5, pl.aim, 34, 2.2, col, vis);
    if (ghost) return;
    pl.x = sx + ca * len;
    pl.y = sy + sa * len;
    G.World.collide(pl);
    pl.invuln = Math.max(pl.invuln || 0, 0.3);
    const w = m.width || 34;
    const mx = sx + (ca * len) / 2,
      my = sy + (sa * len) / 2;
    for (const e of G.EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, e.x, e.y) <= (w / 2 + e.r) ** 2) hit(pl, e, m.dmg * pl.atk, col, ca, sa, m.knock || 0, m);
    }
    for (const p of G.World.propsInCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, p.x, p.y) <= (w / 2 + p.r) ** 2) G.World.damageProp(p, m.dmg * pl.atk, col);
    }
    G.Camera.kick(0.12);
  }

  /** Trail: you leave puddles that damage whatever walks over them. */
  function trailPatch(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    // Standing still doesn't drop a new one on top of the last (only now and then).
    const last = pl.lastPatch;
    if (last && G.U.dist2(last.x, last.y, pl.x, pl.y) < (m.radius * 0.9) ** 2 && last.t < 1) return;
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
      life: m.dur || 3,
      r: m.radius,
      tick: 0,
      dmg: m.dmg * pl.atk
    };
    fields.push(f);
    pl.lastPatch = f;
    const mine = fields.filter(o => o.kind === 'patch' && o.owner === pl && !o.gone);
    for (const o of mine.slice(0, Math.max(0, mine.length - 18))) o.gone = true;
  }

  /** Short cone: many fast shots that don't travel far (breath, spray...). */
  function cone(pl, m) {
    const col = G.U.TYPE_COLOR[m.type],
      vis = G.VFX.forMove(m);
    const n = Math.max(2, m.count | 0),
      arc = m.arc || 0.9;
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (i / (n - 1) - 0.5) * arc + G.U.rand(-0.05, 0.05);
      const sp = m.speed * G.U.rand(0.85, 1.1);
      G.Projectiles.spawn(
        Object.assign(
          {
            x: pl.x + Math.cos(a) * 4,
            y: pl.y + Math.sin(a) * 4,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            dmg: m.dmg * pl.atk,
            r: m.size,
            life: m.life * G.U.rand(0.85, 1.05),
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
    G.FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - G.LIFT + Math.sin(pl.aim) * pl.r, col, Math.cos(pl.aim), Math.sin(pl.aim), 5);
  }

  /** Damage from a field (mine, meteor, puddle) to everything in its circle. */
  function blast(f, r, k = 1) {
    if (f.ghost) return;
    const pl = f.owner,
      m = f.m;
    for (const e of G.EnemyMgr.queryCircle(f.x, f.y, r)) hit(pl, e, f.dmg * k, f.col, e.x - f.x, e.y - f.y, m.knock || 0, m);
    for (const p of G.World.propsInCircle(f.x, f.y, r)) G.World.damageProp(p, f.dmg * k, f.col);
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
        const trig = armed && G.EnemyMgr.queryCircle(f.x, f.y, 14).length > 0;
        if (trig || f.t >= f.life) {
          G.FX.ring(f.x, f.y, 4, f.r, f.col, 0.3, 4);
          G.FX.burst(f.x, f.y - 6, f.col, 10, 150);
          if (G.Camera.sees(f.x, f.y, 40)) G.Audio.sfx('break');
          blast(f, f.r, trig ? 1 : 0.5);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'meteor') {
        if (f.t >= f.fall) {
          G.FX.ring(f.x, f.y, 4, f.r, f.col, 0.35, 4);
          G.FX.burst(f.x, f.y - 6, f.col, 12, 170);
          if (G.Camera.sees(f.x, f.y, 40)) {
            G.Audio.sfx('break');
            G.Camera.kick(0.12);
          }
          blast(f, f.r);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'turret') {
        f.shotT -= dt;
        if (f.shotT <= 0) {
          const m = f.m;
          const tg = G.Projectiles.nearest(G.EnemyMgr.all(), f.x, f.y, m.range || 300);
          f.shotT = tg ? m.rate || 0.6 : 0.15;
          if (tg) {
            const a = Math.atan2(tg.y - f.y, tg.x - f.x);
            G.Projectiles.spawn(
              Object.assign(
                {
                  x: f.x,
                  y: f.y,
                  vx: Math.cos(a) * (m.speed || 300),
                  vy: Math.sin(a) * (m.speed || 300),
                  dmg: f.dmg,
                  r: m.size || 6,
                  life: 1.4,
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
          f.tick = 0.5;
          blast(f, f.r);
        }
        if (f.vis.aura && Math.random() < dt * 3 && G.Camera.sees(f.x, f.y, 20)) {
          G.FX.sp(f.vis.aura, f.vis.pal, f.x + G.U.rand(-f.r, f.r) * 0.6, f.y - 4, { vy: -40, life: 0.4 });
        }
      }
    }
  }

  /** Field parts drawn on the ground (beneath the Pokémon). */
  function drawGroundFields(ctx) {
    const now = performance.now() / 1000;
    for (const f of fields) {
      if (!G.Camera.sees(f.x, f.y, 60)) continue;
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
        G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 4, { scale: 1, alpha: blink ? 1 : 0.75, frame: 0 });
      } else if (f.kind === 'meteor') {
        const k = G.U.clamp(f.t / f.fall, 0, 1);
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
      if (!G.Camera.sees(f.x, f.y, 200)) continue;
      if (f.kind === 'meteor' && f.t > 0) {
        const k = G.U.clamp(f.t / f.fall, 0, 1);
        G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x + (1 - k) * 40, f.y - (1 - k) * 170 - 6, {
          scale: 1.5,
          angle: Math.atan2(170, -40),
          frame: Math.floor(now * 12)
        });
      } else if (f.kind === 'turret') {
        const fade = Math.min(1, (f.life - f.t) * 2, f.t * 5);
        const bob = Math.sin(now * 4 + f.x) * 2 - (f.kick > 0 ? 2 : 0);
        G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 16 + bob, { scale: 1.5, alpha: fade, frame: Math.floor(now * 8) });
      }
    }
  }

  function clearFields(owner) {
    fields = owner ? fields.filter(f => f.owner !== owner) : [];
  }

  function orbit(pl, m, dt, now, isGhost = false) {
    const col = G.U.TYPE_COLOR[m.type];
    const want = Math.max(1, m.count | 0);
    // Each orbit move has its own orbs (a link can have two).
    const mine = p => p.orb && p.owner === pl && p.mid === m.id;
    const orbs = G.Projectiles.all().filter(mine);
    // If the orb count changes (when the move is upgraded), they are all spread
    // evenly from where the first one is, without jumps.
    const relayout = orbs.length !== want;
    const base = orbs.length ? orbs[0].oa : now * m.speed;
    if (orbs.length > want) for (const p of orbs.slice(want)) G.Projectiles.remove(p);

    for (let i = orbs.length; i < want; i++) {
      G.Projectiles.spawnOrb({
        owner: pl,
        ghost: isGhost,
        mid: m.id,
        x: pl.x,
        y: pl.y,
        r: m.size,
        color: col,
        vis: G.VFX.forMove(m),
        dmg: m.dmg * pl.atk,
        oa: (i / want) * 6.2832,
        orad: m.radius,
        ospeed: m.speed,
        rehit: Math.max(0.12, m.cd),
        knock: m.knock || 0,
        burn: m.burn || 0,
        poison: m.poison || 0,
        slow: m.slow || 0,
        mtype: m.type
      });
    }
    const live = G.Projectiles.all().filter(mine);
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
    const def = G.Moves.BY_ID[id];
    if (!def || def.kind === 'orbit') return;
    const m = G.Moves.instance(id, lvl);
    if (evolved) G.Moves.evolve(m);
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
    else if (G.Projectiles.all().some(p => p.orb && p.owner === pl)) G.Projectiles.clearOrbs(pl);
  }

  // Critical hit (Upgrades → Critical Hit): x1.5 damage, big orange number.
  const CRIT_MUL = 1.5;
  const isCrit = pl => !ghost && pl.critChance > 0 && Math.random() < pl.critChance;

  function hit(pl, e, dmg, col, dx, dy, knock, m) {
    const k = typeK(m.type, e);
    const crit = isCrit(pl);
    dmg *= k * (crit ? CRIT_MUL : 1);
    e.hurt(dmg, col, dx, dy, knock, crit ? 'crit' : G.Types.label(G.Types.mult(m.type, e.types)));
    if (!ghost) pl.onDealt(dmg);
    pl.dmgDealt += dmg;
    if (m.burn) e.applyBurn(m.burn);
    if (m.poison) e.applyPoison(m.poison);
    if (m.slow) e.applySlow(m.slow);
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
    const projectiles = G.Projectiles.all();

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // --- enemy shots: walls and solid objects give cover ---
      if (!p.friendly) {
        if (G.World.projectileBlock(p.x, p.y, p.r)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 70);
          projectiles.splice(i, 1);
          continue;
        }
        if (G.U.dist2(p.x, p.y, pl.x, pl.y) < (p.r + pl.r) * (p.r + pl.r)) {
          pl.hurt(p.dmg, p.mtype);
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 7, 110);
          projectiles.splice(i, 1);
        }
        continue;
      }

      // --- player shots ---
      // A teammate's orbs: visual only.
      if (p.orb && p.ghost) continue;
      if (!p.orb) {
        const block = G.World.projectileBlock(p.x, p.y, p.r);
        if (block === 'wall' || (block && !block.destructible)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          continue;
        }
      }

      // Scenery objects (rocks, chests, grass).
      let consumed = false;
      for (const prop of G.World.propsInCircle(p.x, p.y, p.r)) {
        if (p.orb) {
          const k = 'p' + prop.id,
            last = p.hitLog.get(k) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(k, now);
          G.World.damageProp(prop, p.dmg, p.color);
          continue;
        }
        if (p.phits.has(prop.id)) continue;
        p.phits.add(prop.id);
        if (!p.ghost) G.World.damageProp(prop, p.dmg, p.color);
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
        G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
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
      for (const e of G.EnemyMgr.queryCircle((sx + p.x) / 2, (sy + p.y) / 2, half + p.r)) {
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
          G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
          if (p.pierce > 0) {
            p.pierce--;
            continue;
          }
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          break;
        }

        const crit = isCrit(pl);
        const k = (p.mtype ? typeK(p.mtype, e) : 1) * (crit ? CRIT_MUL : 1);
        e.hurt(
          p.dmg * k,
          p.color,
          p.vx || e.x - pl.x,
          p.vy || e.y - pl.y,
          p.knock,
          crit ? 'crit' : p.mtype ? G.Types.label(G.Types.mult(p.mtype, e.types)) : null
        );
        if (Math.random() < 0.5) G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
        pl.dmgDealt += p.dmg * k;
        pl.onDealt(p.dmg * k);
        if (p.burn) e.applyBurn(p.burn);
        if (p.poison) e.applyPoison(p.poison);
        if (p.slow) e.applySlow(p.slow);

        if (!p.orb) {
          if (p.pierce > 0) {
            p.pierce--;
          } else {
            G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
            projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // --- enemy <-> player contact ---
    if (pl.dead) return;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, pl.r + 40)) {
      if (G.U.dist2(e.x, e.y, pl.x, pl.y) > (e.r + pl.r) * (e.r + pl.r)) continue;
      if (e.touchCd > 0 || e.behavior === 'thief') continue;
      e.touchCd = 0.55;
      e.strike(pl);
      pl.hurt(e.dmg, e.atkType);
      if (pl.hasItem('rockyhelmet')) e.hurt(15 + pl.level * 4, '#9aa6b5', e.x - pl.x, e.y - pl.y, 80);
      const [nx, ny] = G.U.norm(e.x - pl.x, e.y - pl.y);
      e.kx += nx * 150;
      e.ky += ny * 150;
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
