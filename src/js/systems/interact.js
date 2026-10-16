/* ============ interact.js — altars, springs, locked chests and traps ============
 * The objects are placed by world.js (rare, on free ground); this is what
 * happens when you touch them. Everything is checked around YOUR Pokémon:
 *
 *   altar     grants a 25 s power (Fury, Thunderbolt, Magnet or Haste) and goes dark
 *             (times, radii, heal rates and trap damage: Balance.interact)
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
import { U } from '../core/util.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { World } from '../world/world.js';
import { FX } from '../entities/fx.js';
import { EnemyMgr } from '../entities/enemy.js';
import { Spawner } from './spawner.js';
import { Coop } from '../net/coop.js';
import { Game } from '../game.js';

export const Interact = (() => {
  const B = Balance.interact;
  const PW = B.powers;
  const num = U.num,
    pct = U.pct;
  /** An altar power multiplies a stat by PW[id] for a while (text built from the value). */
  function power(id, name, color, icon, stat, text) {
    return {
      id,
      name,
      color,
      icon, // HUD circle (ui/icons.js)
      stat, // the player stat it multiplies (ui/stats-ui.js shows stats without it)
      get desc() {
        return text(PW[id]);
      },
      // The factor applied is kept on the player: a live balance change can't leave the stat wrong.
      on: p => {
        p._powerK = PW[id];
        p[stat] *= p._powerK;
      },
      off: p => {
        p[stat] /= p._powerK || 1;
      }
    };
  }
  const POWERS = [
    power('dmg', 'Fury', '#ff5f6d', 'fist', 'atkMul', k => `damage ×${num(k)}`),
    power('spd', 'Thunderbolt', '#5fd4ff', 'boot', 'spdMul', k => `+${pct(k - 1)}% speed`),
    power('mag', 'Magnet', '#ff8ad8', 'magnet', 'magnet', () => 'you pull everything from afar'),
    power('cd', 'Haste', '#ffd23f', 'clock', 'cdMul', k => `-${pct(1 - k)}% cooldown`)
  ];
  const authority = () => !Coop.active || Coop.isHost;
  let healShown = 0,
    healAcc = 0;

  function update(dt, pl) {
    if (!pl) return;
    for (const p of World.specialsNear(pl.x, pl.y, 720)) {
      const d2 = U.dist2(pl.x, pl.y, p.x, p.type === 'spring' || p.type === 'trap' ? p.y - 8 : p.y);
      switch (p.type) {
        case 'spring':
          spring(dt, pl, p, d2);
          break;
        case 'altar':
          // Counting your Pokémon's size: a big one (Reshiram, Zekrom...) bumps into
          // the altar before getting within 30 and couldn't activate it.
          if (!p.used && !pl.dead && d2 < Math.max(B.altarR.min, p.r + pl.r + B.altarR.pad) ** 2) usePower(pl, p);
          break;
        case 'bigchest':
          if (!pl.dead && d2 < Math.max(B.chestR.min, p.r + pl.r + B.chestR.pad) ** 2) {
            if (p.open === 0) Audio.sfx('select');
            p.open += dt;
            if (p.open >= B.chestTime) {
              p.open = 0;
              World.breakProp(p);
            }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * B.chestDecay);
          break;
        case 'trap':
          if (!pl.dead && d2 < B.trap.stepR * B.trap.stepR) World.breakProp(p);
          else if (authority() && EnemyMgr.queryCircle(p.x, p.y - 8, B.trap.enemyR).some(e => !e.flying && !e.remote)) World.breakProp(p);
          break;
      }
    }
  }

  function spring(dt, pl, p, d2) {
    const S = B.spring;
    if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / S.refill);
    if (pl.dead || d2 > S.r * S.r || p.charge <= S.dryAt || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * S.heal * dt);
    healAcc += pl.hp - before;
    p.charge = Math.max(0, p.charge - dt * S.drain);
    if (Math.random() < dt * 14) FX.px(pl.x + U.rand(-pl.r, pl.r), pl.y - U.rand(0, pl.bodyH), '#7dffb0', { vy: -50, life: 0.5 });
    healShown -= dt;
    if (healShown <= 0 && healAcc >= 1) {
      healShown = 0.6;
      FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(healAcc), '#5fe08a');
      healAcc = 0;
      Audio.sfx('xp');
    }
    if (p.charge <= S.dryAt) Spawner.say('The spring has dried up (it refills on its own)', 2.2, true);
  }

  function usePower(pl, p) {
    p.used = true;
    const pw = POWERS[p.kind];
    pl.addPower(pw, B.powerTime);
    FX.ring(p.x, p.y - 20, 8, 90, pw.color, 0.6, 5);
    FX.burst(pl.x, pl.y - pl.bodyH * 0.5, pw.color, 24, 200);
    Audio.sfx('legend');
    Spawner.say(`${pw.name} power! ${pw.desc} for ${B.powerTime} s`, 3, true);
  }

  /**
   * A trap goes off (on each computer; see the header). Damage to enemies
   * is only dealt by the authority; it affects you if you are inside.
   */
  function trapEffect(p) {
    const x = p.x,
      y = p.y - 8,
      k = p.kind,
      T = B.trap,
      TRAP_R = T.r;
    const col = ['#c86bdc', '#8bd94a', '#ff7b3d'][k];
    const pal = ['poison', 'grass', 'fire'][k];
    FX.ring(x, y, 6, TRAP_R, col, 0.5, k === 2 ? 7 : 4);
    FX.burst(x, y - 6, col, k === 2 ? 40 : 22, k === 2 ? 260 : 140);
    for (let i = 0; i < (k === 2 ? 10 : 7); i++) {
      const a = Math.random() * 6.2832,
        r = U.rand(8, TRAP_R * 0.8);
      FX.sp(k === 2 ? 'impact' : 'blob', pal, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 6, {
        vy: k === 2 ? -30 : -45,
        life: U.rand(0.4, 0.8)
      });
    }
    Audio.sfx(k === 2 ? 'boss' : 'surge');
    if (k === 2 && U.dist2(x, y, Camera.x, Camera.y) < 500 * 500) Camera.kick(0.7);

    const pl = Game.player;
    const lvl = pl ? pl.level : 1;
    if (authority()) {
      for (const e of EnemyMgr.queryCircle(x, y, TRAP_R)) {
        if (e.remote) continue;
        if (k === 0) {
          e.applyPoison(T.poison.secs);
          e.hurt(T.poison.dmg + lvl * T.poison.perLevel, '#d47cf0');
        } else if (k === 1) {
          e.applySlow(T.sticky.slow, T.sticky.secs);
          e.hurt(T.sticky.dmg, '#8bd94a');
        } else e.hurt(T.blast.dmg + lvl * T.blast.perLevel, '#ff7b3d', e.x - x, e.y - y, T.blast.knock);
      }
    }
    if (pl && !pl.dead && U.dist2(x, y, pl.x, pl.y) < (TRAP_R * T.playerR) ** 2) {
      pl.invuln = 0;
      if (k === 0) pl.hurt(pl.maxHp * T.poison.self);
      else if (k === 1) {
        pl.slowT = T.sticky.selfSecs;
        FX.dmgText(pl.x, pl.y - pl.bodyH - 6, 'Sticky!', '#8bd94a');
      } else pl.hurt(pl.maxHp * T.blast.self);
    }
  }

  return {
    update,
    trapEffect,
    POWERS,
    /** Seconds to open a locked chest (Balance.interact.chestTime). */
    get CHEST_TIME() {
      return B.chestTime;
    }
  };
})();
