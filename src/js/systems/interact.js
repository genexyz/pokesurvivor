/* ============ interact.js — altars, springs, locked chests and traps ============
 * The objects are placed by world.js (rare, on free ground); this is what
 * happens when you touch them. Everything is checked around YOUR Pokémon:
 *
 *   altar     grants a 25 s power (Fury, Thunderbolt, Magnet or Haste) and goes dark
 *   spring    heals while you stand on it; it runs dry and refills on its own
 *   bigchest  stay next to it for CHEST_TIME seconds (while being attacked) and it
 *             opens: coins, tickets and enough experience for one level
 *   trap      triggers when stepped on (by you or an enemy) and affects everything nearby:
 *             poison, sticky (slows) or explosive
 *
 * Co-op: altars and springs are per player (on each computer); the
 * chest and traps break like any other object and the host hands out
 * the loot and the damage to enemies (see world.destroyProp and coop.propBroken).
 */
G.Interact = (() => {
  const CHEST_TIME = 3.5;
  const POWER_TIME = 25;
  const POWERS = [
    {
      id: 'dmg',
      name: 'Fury',
      desc: 'damage ×2',
      color: '#ff5f6d',
      on: p => {
        p.atkMul *= 2;
      },
      off: p => {
        p.atkMul /= 2;
      }
    },
    {
      id: 'spd',
      name: 'Thunderbolt',
      desc: '+45% speed',
      color: '#5fd4ff',
      on: p => {
        p.spdMul *= 1.45;
      },
      off: p => {
        p.spdMul /= 1.45;
      }
    },
    {
      id: 'mag',
      name: 'Magnet',
      desc: 'you pull everything from afar',
      color: '#ff8ad8',
      on: p => {
        p.magnet *= 4;
      },
      off: p => {
        p.magnet /= 4;
      }
    },
    {
      id: 'cd',
      name: 'Haste',
      desc: '-40% cooldown',
      color: '#ffd23f',
      on: p => {
        p.cdMul *= 0.6;
      },
      off: p => {
        p.cdMul /= 0.6;
      }
    }
  ];
  const TRAP_R = 74;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  let healShown = 0,
    healAcc = 0;

  function update(dt, pl) {
    if (!pl) return;
    for (const p of G.World.specialsNear(pl.x, pl.y, 720)) {
      const d2 = G.U.dist2(pl.x, pl.y, p.x, p.type === 'spring' || p.type === 'trap' ? p.y - 8 : p.y);
      switch (p.type) {
        case 'spring':
          spring(dt, pl, p, d2);
          break;
        case 'altar':
          // Counting your Pokémon's size: a big one (Reshiram, Zekrom...) bumps into
          // the altar before getting within 30 and couldn't activate it.
          if (!p.used && !pl.dead && d2 < Math.max(30, p.r + pl.r + 14) ** 2) usePower(pl, p);
          break;
        case 'bigchest':
          if (!pl.dead && d2 < Math.max(46, p.r + pl.r + 24) ** 2) {
            if (p.open === 0) G.Audio.sfx('select');
            p.open += dt;
            if (p.open >= CHEST_TIME) {
              p.open = 0;
              G.World.breakProp(p);
            }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * 1.5);
          break;
        case 'trap':
          if (!pl.dead && d2 < 13 * 13) G.World.breakProp(p);
          else if (authority() && G.EnemyMgr.queryCircle(p.x, p.y - 8, 3).some(e => !e.flying && !e.remote)) G.World.breakProp(p);
          break;
      }
    }
  }

  function spring(dt, pl, p, d2) {
    if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / 45);
    if (pl.dead || d2 > 26 * 26 || p.charge <= 0.02 || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.14 * dt);
    healAcc += pl.hp - before;
    p.charge = Math.max(0, p.charge - dt * 0.09);
    if (Math.random() < dt * 14) G.FX.px(pl.x + G.U.rand(-pl.r, pl.r), pl.y - G.U.rand(0, pl.bodyH), '#7dffb0', { vy: -50, life: 0.5 });
    healShown -= dt;
    if (healShown <= 0 && healAcc >= 1) {
      healShown = 0.6;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(healAcc), '#5fe08a');
      healAcc = 0;
      G.Audio.sfx('xp');
    }
    if (p.charge <= 0.02) G.Spawner.say('The spring has dried up (it refills on its own)', 2.2, true);
  }

  function usePower(pl, p) {
    p.used = true;
    const pw = POWERS[p.kind];
    pl.addPower(pw, POWER_TIME);
    G.FX.ring(p.x, p.y - 20, 8, 90, pw.color, 0.6, 5);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, pw.color, 24, 200);
    G.Audio.sfx('legend');
    G.Spawner.say(`${pw.name} power! ${pw.desc} for ${POWER_TIME} s`, 3, true);
  }

  /**
   * A trap goes off (on each computer; see the header). Damage to enemies
   * is only dealt by the authority; it affects you if you are inside.
   */
  function trapEffect(p) {
    const x = p.x,
      y = p.y - 8,
      k = p.kind;
    const col = ['#c86bdc', '#8bd94a', '#ff7b3d'][k];
    const pal = ['poison', 'grass', 'fire'][k];
    G.FX.ring(x, y, 6, TRAP_R, col, 0.5, k === 2 ? 7 : 4);
    G.FX.burst(x, y - 6, col, k === 2 ? 40 : 22, k === 2 ? 260 : 140);
    for (let i = 0; i < (k === 2 ? 10 : 7); i++) {
      const a = Math.random() * 6.2832,
        r = G.U.rand(8, TRAP_R * 0.8);
      G.FX.sp(k === 2 ? 'impact' : 'blob', pal, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 6, {
        vy: k === 2 ? -30 : -45,
        life: G.U.rand(0.4, 0.8)
      });
    }
    G.Audio.sfx(k === 2 ? 'boss' : 'surge');
    if (k === 2 && G.U.dist2(x, y, G.Camera.x, G.Camera.y) < 500 * 500) G.Camera.kick(0.7);

    const pl = G.Game.player;
    const lvl = pl ? pl.level : 1;
    if (authority()) {
      for (const e of G.EnemyMgr.queryCircle(x, y, TRAP_R)) {
        if (e.remote) continue;
        if (k === 0) {
          e.applyPoison(5);
          e.hurt(14 + lvl * 3, '#d47cf0');
        } else if (k === 1) {
          e.applySlow(0.65, 4.5);
          e.hurt(4, '#8bd94a');
        } else e.hurt(90 + lvl * 18, '#ff7b3d', e.x - x, e.y - y, 220);
      }
    }
    if (pl && !pl.dead && G.U.dist2(x, y, pl.x, pl.y) < (TRAP_R * 0.7) ** 2) {
      pl.invuln = 0;
      if (k === 0) pl.hurt(pl.maxHp * 0.1);
      else if (k === 1) {
        pl.slowT = 3.5;
        G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, 'Sticky!', '#8bd94a');
      } else pl.hurt(pl.maxHp * 0.2);
    }
  }

  return { update, trapEffect, POWERS, CHEST_TIME };
})();
