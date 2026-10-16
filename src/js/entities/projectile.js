/* ============ projectile.js — projectiles and orbs ============
 * A single list for everything that flies: player shots, enemy
 * shots and the orbs circling the Pokémon (orbs are
 * projectiles with `orb`, anchored to the player, that hit again every
 * `rehit` seconds).
 *
 * They live on the GROUND plane (like entities' feet) and are drawn
 * raised G.LIFT units with their shadow below. Walls and solid
 * objects stop them (see combat.js).
 */
G.Projectiles = (() => {
  const B = G.Balance.combat;
  let list = [];
  let nextId = 1;

  function clear() {
    list = [];
  }
  function all() {
    return list;
  }

  /** Player projectile. */
  function spawn(o) {
    const D = B.projectile;
    const p = Object.assign(
      {
        id: nextId++,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        dmg: D.dmg,
        r: D.r,
        life: D.life,
        t: 0,
        pierce: 0,
        hits: null,
        friendly: true,
        color: '#fff',
        homing: 0,
        slow: 0,
        burn: 0,
        poison: 0,
        knock: 0,
        orb: false,
        rehit: D.rehit,
        hitLog: null,
        phits: null
      },
      o
    );
    if (p.friendly && !p.orb && !p.phits) p.phits = new Set();
    list.push(p);
    return p;
  }

  /** Orb anchored to a player (`owner`): lives while the move is active. */
  function spawnOrb(o) {
    return spawn(
      Object.assign(
        {
          orb: true,
          life: Infinity,
          pierce: Infinity,
          hitLog: new Map()
        },
        o
      )
    );
  }

  /** Removes a player's orbs (or all) when the active move changes. */
  function clearOrbs(owner) {
    list = list.filter(p => !p.orb || (owner && p.owner !== owner));
  }

  function update(dt, player, enemies) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;

      if (p.orb) {
        // Circles its player.
        const o = p.owner || player;
        p.oa += p.ospeed * dt;
        p.x = o.x + Math.cos(p.oa) * p.orad;
        p.y = o.y + Math.sin(p.oa) * p.orad * 0.7;
        continue;
      }

      if (p.t >= p.life) {
        list.splice(i, 1);
        continue;
      }

      // Boomerang: after `boom` seconds it turns around (and can hit the
      // same ones again) and returns to its owner; on arrival it disappears.
      if (p.boom) {
        const o = p.owner || player;
        if (!p.back && p.t >= p.boom) {
          p.back = true;
          p.hits = new Set();
        }
        if (p.back) {
          const [dx, dy] = G.U.norm(o.x - p.x, o.y - p.y);
          const bm = B.boomerang;
          p.vx = G.U.damp(p.vx, dx * p.bsp, bm.returnDamp, dt);
          p.vy = G.U.damp(p.vy, dy * p.bsp, bm.returnDamp, dt);
          if (G.U.dist2(p.x, p.y, o.x, o.y) < (o.r + bm.catchPad) ** 2) {
            list.splice(i, 1);
            continue;
          }
        }
      }

      // Homing: bends velocity towards the nearest enemy.
      if (p.homing > 0 && p.friendly) {
        const tg = nearest(enemies, p.x, p.y, B.projectile.homingRange);
        if (tg) {
          const [dx, dy] = G.U.norm(tg.x - p.x, tg.cy() - p.y);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = G.U.damp(p.vx, dx * sp, p.homing, dt);
          p.vy = G.U.damp(p.vy, dy * sp, p.homing, dt);
        }
      }

      p.px = p.x;
      p.py = p.y; // for swept collision (see combat.js)
      if (p.vis && p.vis.trail && G.Camera.sees(p.x, p.y, 20)) {
        p.trailT = (p.trailT || 0) - dt;
        if (p.trailT <= 0) {
          p.trailT = 0.04;
          G.FX.trail(p.vis.trail, p.vis.pal, p.x, p.y - G.LIFT, p.vx, p.vy);
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Out of view with a generous margin -> discarded.
      if (!G.Camera.sees(p.x, p.y, B.projectile.despawnMargin)) {
        list.splice(i, 1);
        continue;
      }
    }
  }

  function nearest(enemies, x, y, maxDist) {
    let best = null,
      bd = maxDist * maxDist;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = G.U.dist2(x, y, e.x, e.cy());
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function remove(p) {
    const i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1);
  }

  function draw(ctx) {
    const L = G.LIFT;
    // Shadows first, all together.
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (const p of list) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 0.9, p.r * 0.38, 0, 0, 6.2832);
      ctx.fill();
    }
    // Enemy shots carry a red ring on the ground: "this hurts you".
    ctx.fillStyle = 'rgba(255,60,80,.35)';
    for (const p of list) {
      if (p.friendly) continue;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.6, 0, 0, 6.2832);
      ctx.fill();
    }
    for (const p of list) {
      const v = p.vis || G.VFX.forType('normal');
      const shape = v.proj;
      const a = p.orb ? 1 : Math.min(1, (p.life - p.t) * 4);
      let angle = 0;
      if (G.VFX.isDir(shape)) angle = p.orb ? p.oa + Math.PI / 2 : Math.atan2(p.vy, p.vx);
      else if (G.VFX.spins(shape)) angle = p.t * 9;
      G.VFX.draw(ctx, shape, v.pal, p.x, p.y - L, {
        angle,
        alpha: a,
        scale: p.r >= 8 ? 1.5 : 1,
        frame: Math.floor(p.t * 12)
      });
    }
  }

  return {
    clear,
    all,
    spawn,
    spawnOrb,
    clearOrbs,
    update,
    remove,
    draw,
    nearest,
    get count() {
      return list.length;
    }
  };
})();
