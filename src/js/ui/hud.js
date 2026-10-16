/* ============ hud.js — interface inside the canvas ============
 * Drawn in SCREEN coordinates (without the camera transform).
 */
import { U } from '../core/util.js';
import { Audio } from '../core/audio.js';
import { Touch } from '../core/touch.js';
import { Camera } from '../core/camera.js';
import { Items } from '../data/items.js';
import { World } from '../world/world.js';
import { EnemyMgr } from '../entities/enemy.js';
import { Player } from '../entities/player.js';
import { Spawner } from '../systems/spawner.js';
import { Rift } from '../systems/rift.js';
import { Events } from '../systems/events.js';
import { Weather } from '../systems/weather.js';
import { Coop } from '../net/coop.js';
import { Icons } from './icons.js';
import { Game } from '../game.js';

export const HUD = (() => {
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bar(ctx, x, y, w, h, frac, col, bg = 'rgba(0,0,0,.55)') {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * U.clamp(frac, 0, 1), h);
      ctx.restore();
    }
  }

  /**
   * Arrow on the screen edge toward a spot that is off screen (sx, sy in screen
   * pixels). Draws nothing and returns false while the spot is visible.
   * Used for the rift, teammates, Arceus, the lost Pokémon and treasure goblins.
   * o: { color, label, labelColor, font, margin, tip, base, spread, alpha,
   *      outline (stroke color), shadow (darker copy behind), halo: { color, r, a },
   *      disc: { color, r }, labelAt: [x, y], labelStroke, inner(ctx) }
   */
  function edgeArrow(ctx, w, h, sx, sy, o) {
    if (sx > 0 && sx < w && sy > 0 && sy < h) return false;
    const M = o.margin || 44,
      ex = U.clamp(sx, M, w - M),
      ey = U.clamp(sy, M + 70, h - M - 80);
    const a = Math.atan2(sy - ey, sx - ex),
      ca = Math.cos(a),
      sa = Math.sin(a);
    const tip = o.tip || 30,
      base = o.base || 15,
      sp = o.spread || 2.45;
    const tri = k => {
      ctx.beginPath();
      ctx.moveTo(ca * tip * k, sa * tip * k);
      ctx.lineTo(Math.cos(a + sp) * base * k, Math.sin(a + sp) * base * k);
      ctx.lineTo(Math.cos(a - sp) * base * k, Math.sin(a - sp) * base * k);
      ctx.closePath();
    };
    const circle = (r, color, alpha) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    ctx.save();
    ctx.translate(ex, ey);
    if (o.halo) circle(o.halo.r, o.halo.color, o.halo.a);
    if (o.disc) circle(o.disc.r, o.disc.color, 1);
    if (o.shadow) {
      tri(1.12);
      ctx.fillStyle = o.shadow;
      ctx.fill();
    }
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    tri(1);
    if (o.outline) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = o.outline;
      ctx.stroke();
    }
    ctx.fillStyle = o.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (o.inner) o.inner(ctx);
    if (o.label) {
      const [lx, ly] = o.labelAt || [26, 24];
      ctx.font = F(800, o.font || 11);
      ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
      ctx.lineWidth = o.labelStroke || 4;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(o.label, -ca * lx, -sa * ly + 4);
      ctx.fillStyle = o.labelColor || o.color;
      ctx.fillText(o.label, -ca * lx, -sa * ly + 4);
    }
    ctx.restore();
    return true;
  }

  function draw(ctx, w, h, pl, st) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    Touch.clearButtons();
    const touch = Touch.active;

    // ---------- experience bar (top edge) ----------
    const xpF = pl.xp / pl.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, w, 7);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#4fd1ff');
    g.addColorStop(1, '#a98bff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * U.clamp(xpF, 0, 1), 7);

    // ---------- health + level ----------
    const px = 16,
      py = 20;
    ctx.font = F(800, 13);
    ctx.fillStyle = '#eaf2ff';
    ctx.textAlign = 'left';
    ctx.fillText(pl.mon.name, px, py + 10);

    ctx.font = F(700, 11);
    ctx.fillStyle = '#ffcb3d';
    ctx.fillText('Lv. ' + pl.level, px, py + 26);

    bar(ctx, px + 48, py + 17, 168, 11, pl.hp / pl.maxHp, '#ff5f6d');
    ctx.font = F(700, 10);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(pl.hp) + ' / ' + Math.round(pl.maxHp), px + 48 + 84, py + 26);

    // active buffs
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    const LBL = { atk: 'ATK', spd: 'SPD', def: 'DEF', regen: 'REG' };
    let bx = px;
    ctx.textAlign = 'left';
    for (const k in pl.buffs) {
      const b = pl.buffs[k];
      if (b.n <= 0) continue;
      ctx.font = F(800, 9);
      const txt = LBL[k] + ' ×' + b.n;
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, py + 34, tw, 15, 7);
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fill();
      ctx.fillStyle = COL[k];
      ctx.fillText(txt, bx + 6, py + 45);
      bx += tw + 5;
    }

    // ---------- clock / biome / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(U.mmss(st.time), w / 2, 42);
    ctx.font = F(600, 10);
    ctx.fillStyle = '#8fa3c4';
    ctx.fillText(World.biomeName().toUpperCase() + '  ·  ' + pl.kills + ' DEFEATED  ·  ' + pl.coins + ' COINS', w / 2, 58);

    // ---------- weather (top right) ----------
    const wx = Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - (touch ? 56 : 0),
        y0 = 14;
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fill();
      Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- boss bar ----------
    const boss = EnemyMgr.all().find(e => e.boss && !e.dead);
    if (boss) {
      const bw = Math.min(420, w - 80);
      bar(ctx, (w - bw) / 2, 70, bw, 12, boss.hp / boss.maxHp, '#ffcb3d');
      ctx.font = F(800, 10);
      ctx.fillStyle = '#20160a';
      ctx.fillText(boss.name.toUpperCase(), w / 2, 80);
    }

    // ---------- notice ----------
    // ---------- off-screen shinies: sparkle on the edge ----------
    const cam = Camera,
      pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;
    for (const e of EnemyMgr.shinies()) {
      const sx = (e.x - cam.left()) * cam.scale,
        sy = (e.y - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 34;
      const ex = U.clamp(sx, M, w - M),
        ey = U.clamp(sy, M + 60, h - M - 70);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.translate(ex, ey);
      ctx.fillStyle = '#9ae6ff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 2.5) * 12, Math.sin(a + 2.5) * 12);
      ctx.lineTo(Math.cos(a - 2.5) * 12, Math.sin(a - 2.5) * 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      Icons.draw(ctx, 'shiny', -12, -12, 24);
      ctx.restore();
    }

    // Active altar power.
    if (pl.power) {
      const pw = pl.power,
        txt = pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's';
      ctx.font = F(800, 9);
      ctx.textAlign = 'left';
      const tw = ctx.measureText(txt).width + 12;
      roundRect(ctx, bx, py + 34, tw, 15, 7);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fill();
      ctx.fillStyle = pw.def.color;
      ctx.fillText(txt, bx + 6, py + 45);
      bx += tw + 5;
    }

    if (Coop.active) drawCoop(ctx, w, h, pl, px, py + (bx > px ? 56 : 40));

    // Rift: big pulsing arrow on the edge when off-screen; when visible, a
    // bouncing arrow above it; inside the arena, a countdown.
    const rift = Rift.rift;
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale,
        sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000,
        beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = 'RIFT · ' + Math.round(U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off)
        edgeArrow(ctx, w, h, sx, sy, {
          margin: 52,
          tip: 40,
          base: 20,
          halo: { color: '#b48aff', r: 30 + beat * 8, a: 0.18 + beat * 0.22 },
          shadow: '#1a0b33',
          color: beat > 0.5 ? '#e2d0ff' : '#a06bff',
          font: 12,
          label,
          labelColor: '#e2d0ff',
          labelAt: [34, 30]
        });
      else {
        // Above the rift: bouncing down arrow.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath();
        ctx.moveTo(-15, -12);
        ctx.lineTo(15, -12);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1a0b33';
        ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff';
        ctx.fill();
        ctx.font = F(800, 11);
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = 'RIFT · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18);
        ctx.fillStyle = '#e2d0ff';
        ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = '#d9c2ff';
      ctx.fillText('RIFT · ' + U.mmss(Rift.timeLeft), w / 2, boss ? 98 : 76);
    }

    // Events: countdown, arrow to the lost Pokémon / the marker and the goblins.
    Events.drawHud(ctx, w, h, pl, F);

    // Dedicated notice when a rift opens (other notices don't cover it).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2),
        pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0);
      ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = 'A RIFT HAS OPENED!',
        t2 = 'Follow the purple arrow: a legendary awaits inside';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, ((ctx.font = F(700, 11)), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = 'rgba(26,11,51,.88)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#b48aff';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.fillStyle = '#e2d0ff';
      ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11);
      ctx.fillStyle = '#c9b0ff';
      ctx.fillText(t2, 0, 16);
      ctx.restore();
    }

    const ban = Spawner.banner();
    if (ban) {
      const a = Math.min(1, ban.t * 1.6);
      ctx.save();
      ctx.globalAlpha = a;
      // Always centered (it used to inherit the alignment of whatever was drawn
      // last, e.g. a treasure goblin's arrow, and ended up misplaced).
      ctx.textAlign = 'center';
      ctx.font = F(800, 22);
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(ban.text, w / 2, h * 0.3);
      ctx.fillText(ban.text, w / 2, h * 0.3);
      ctx.restore();
    }

    // ---------- move slots ----------
    const S = 54,
      GAP = 9;
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Above the iPhone home bar (taps there sometimes don't register).
    let sy = h - S - 18 - (touch ? Math.min(28, Touch.safeArea().bottom) : 0);
    // On mobile, wherever the player put it: the item + all slots block (even
    // if not filled yet), by its center, as in the editor (layout-ui.js); new
    // moves appear towards the right.
    const pb = touch && Touch.spot('bar');
    if (pb) {
      const nAll = Math.max(n, pl.maxMoves),
        bw = S + 18 + nAll * S + (nAll - 1) * GAP;
      sx = U.clamp(pb[0] * w - bw / 2, 6, Math.max(6, w - bw - 6)) + S + 18;
      sy = U.clamp(pb[1] * h - S / 2, 24, h - S - 6);
    }
    const BOND = '#ff8ad8';
    const cdOf = m => (m.kind === 'orbit' ? 0 : U.clamp(m.t / (m.cd * pl.cdMul), 0, 1));

    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tapping (or clicking) an icon activates that move.
      if (m)
        Touch.addButton(
          x,
          y,
          S,
          S,
          () => {
            if (Game.state === 'playing' && pl.active !== i) {
              pl.setActive(i);
              Audio.sfx('click');
            }
          },
          GAP / 2 + 3
        );
      const col = m ? U.TYPE_COLOR[m.type] : '#4a5468';

      // background
      roundRect(ctx, x, y, S, S, 12);
      ctx.fillStyle = on ? 'rgba(20,30,50,.95)' : 'rgba(10,16,28,.8)';
      ctx.fill();
      ctx.lineWidth = on ? 2.5 : fused || (m && m.evolved) ? 2 : 1.2;
      // Bond: pink border. Evolved: gold.
      ctx.strokeStyle = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? col : 'rgba(140,170,210,.22)';
      ctx.stroke();

      if (!m) continue;

      if (fused) {
        // Bond: the moves in a 2×2 grid, each with its own cooldown.
        const C = 22,
          P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P),
            cy = y + P + Math.floor(k / 2) * (C + P);
          Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) {
            ctx.fillStyle = 'rgba(0,0,0,.55)';
            ctx.fillRect(cx, cy, C, C * f);
          }
          if (gm.evolved) {
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1);
          }
          // Flash when cast.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')';
            ctx.fillRect(cx, cy, C, C);
          }
        });
      } else {
        // cooldown: drains from bottom to top
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12);
          ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, S * cdFrac);
          ctx.restore();
        }

        // type emblem + family badge
        Icons.draw(ctx, 'move:' + m.id, x + (S - 32) / 2, y + (S - 32) / 2 - 2, 32);

        // move level (dots)
        const dots = m.def.maxLvl;
        const dw = 4,
          dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(x + (S - tw) / 2 + d * (dw + dgap), y + S - 9, dw, 3);
        }
      }

      // key
      ctx.font = F(800, 9);
      ctx.fillStyle = fused ? BOND : on ? col : 'rgba(180,200,230,.6)';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 3, y + 10);

      // name above the active one (with a bond: "Ember +2")
      if (on) {
        ctx.font = F(700, 10);
        ctx.textAlign = 'center';
        ctx.fillStyle = fused ? BOND : col;
        ctx.fillText(fused ? m.name + ' +' + (g.length - 1) : m.name, x + S / 2, y - 7);
      }
    }

    // ---------- stored bond (not two free moves yet) ----------
    if (pl.bonds > 0) {
      const bx = sx + totalW + 12,
        by = sy + S / 2 - 12;
      Icons.draw(ctx, 'bond', bx, by, 24);
      if (pl.bonds > 1) {
        ctx.font = F(800, 10);
        ctx.textAlign = 'left';
        ctx.fillStyle = BOND;
        ctx.fillText('×' + pl.bonds, bx + 25, by + 20);
      }
    }

    // ---------- held item (left of the moves) ----------
    {
      const ix = sx - S - 18,
        iy = sy;
      roundRect(ctx, ix, iy, S, S, 12);
      ctx.fillStyle = pl.item ? 'rgba(40,30,10,.9)' : 'rgba(10,16,28,.55)';
      ctx.fill();
      ctx.lineWidth = pl.item ? 2 : 1;
      ctx.strokeStyle = pl.item ? '#ffd23f' : 'rgba(140,170,210,.18)';
      ctx.stroke();
      if (pl.item) {
        Icons.draw(ctx, pl.item, ix + (S - 36) / 2, iy + (S - 36) / 2, 36);
        ctx.font = F(700, 9);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(Items.BY[pl.item].name, ix + S / 2, iy - 6);
      }
    }

    // ---------- pause button (touch) ----------
    if (touch) {
      const sa = Touch.safeArea();
      const pp = Touch.spot('pause');
      const bx = pp ? U.clamp(pp[0] * w - 20, 4, w - 44) : w - 52 - Math.min(44, sa.right);
      const by = pp ? U.clamp(pp[1] * h - 20, 10, h - 44) : 12 + Math.min(20, sa.top),
        bs = 40;
      roundRect(ctx, bx, by, bs, bs, 10);
      ctx.fillStyle = 'rgba(10,16,28,.7)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(244,248,255,.8)';
      ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(bx + 13, by + 11, 5, 18);
      ctx.fillRect(bx + 22, by + 11, 5, 18);
      Touch.addButton(bx, by, bs, bs, () => Game.togglePause(), 8);
    }

    // controls hint
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,230,.55)';
      ctx.fillText(
        touch ? 'Drag your finger to move  ·  tap a move to switch' : 'WASD move  ·  1-4 / Q / E or click a move to switch  ·  Esc pause',
        w / 2,
        h - 4
      );
    }

    ctx.restore();
  }

  // ---------------- co-op ----------------

  /**
   * - Each teammate's health below yours.
   * - Arrow on the screen edge towards those off-screen, with their name and
   *   distance in metres (red and blinking if they are down).
   * - If you are down: notice and a "being revived" bar.
   */
  function drawCoop(ctx, w, h, pl, px, top) {
    const cam = Camera;
    const t = performance.now() / 1000;
    let y = top;
    ctx.textAlign = 'left';
    for (const m of Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      ctx.font = F(800, 10);
      ctx.fillStyle = m.color;
      ctx.fillText(m.name, px, y + 9);
      const lx = px + 78;
      bar(ctx, lx, y + 1, 110, 8, o.dead ? 0 : o.hp / o.maxHp, o.dead ? '#ff5f6d' : '#5fe08a');
      if (o.dead) {
        ctx.font = F(800, 9);
        ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff8a96' : '#ffd0d5';
        ctx.fillText('DOWN', lx + 116, y + 9);
      }
      y += 15;
    }

    // Arrows towards teammates out of view.
    for (const m of Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale,
        sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      const metres = Math.round(U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const col = o.dead ? (Math.sin(t * 8) > 0 ? '#ff5f6d' : '#ffd0d5') : m.color;
      edgeArrow(ctx, w, h, sx, sy, {
        margin: 42,
        tip: 28,
        base: 14,
        spread: 2.4,
        disc: { color: 'rgba(0,0,0,.55)', r: 17 },
        color: col,
        font: 12,
        labelStroke: 3,
        labelAt: [30, 26],
        label: (o.dead ? m.name + ' needs help! ' : m.name + ' ') + '· ' + metres + ' m',
        // Teammate's initial inside the circle
        inner(c) {
          c.font = F(800, 14);
          c.textAlign = 'center';
          c.fillStyle = '#fff';
          c.fillText(m.name.charAt(0).toUpperCase(), 0, 5);
        }
      });
    }

    // You, down.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = Coop.players().every(p => p.dead) ? 'Everyone is down…' : "You're down: a teammate can revive you";
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      ctx.restore();
    }
  }

  return { draw, roundRect, bar, edgeArrow };
})();
