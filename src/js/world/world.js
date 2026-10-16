/* ============ world.js — infinite open arena with obstacles ============
 *
 * Per-tile terrain, deterministic (seeded value noise):
 *   floor   ground (with dirt patches)
 *   wall    rock formations: block walkers and projectiles
 *   liquid  water (slows) or lava in the volcano (burns)
 *
 * Scenery objects (props), drawn Y-sorted together with the entities:
 *   tree    blocks, indestructible (cover)
 *   rock    blocks, breakable; may drop experience, coins or berries
 *   chest   blocks, breakable; drops good loot
 *   grass   tall grass, doesn't block; any attack cuts it
 *   altar   power altar: touching it grants a temporary power (once)
 *   spring  spring: heals while you stand on it; runs dry and refills
 *   bigchest locked chest: opens if you stay next to it for a few seconds
 *   trap    trap (poison, sticky, explosive): springs when stepped on, also
 *           by enemies
 *   (the interactive logic lives in systems/interact.js)
 *
 * Rift: setArena() turns a far-off area of the map into a round arena
 * enclosed by walls, where you fight a legendary (systems/rift.js).
 *
 * Flying Pokémon, Ghost types and bosses ignore the terrain.
 *
 * Coordinates: an entity's (x, y) = its FEET, on the ground plane.
 * Chunks are split into DATA (cheap, always) and IMAGE (baked at
 * art resolution and only for visible ones).
 */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { Items } from '../data/items.js';
import { Tiles } from './tiles.js';
import { FX } from '../entities/fx.js';
import { Pickups } from '../entities/pickup.js';
import { Interact } from '../systems/interact.js';
import { Progress } from '../systems/progress.js';
import { Coop } from '../net/coop.js';
import { Game } from '../game.js';

export const World = (() => {
  const T = Tiles.T; // art px per tile
  const N = 16; // tiles per chunk
  const TS = T * Sprites.PX; // tile size in world units (32)
  const CW = N * TS; // chunk size in world units (512)
  const FLOOR = 0,
    WALL = 1,
    LIQUID = 2;
  const KIND = ['floor', 'wall', 'liquid'];

  let seed = 1,
    biome = 0;
  let arena = null; // { tx, ty, r } in tiles
  const data = new Map(); // "cx,cy" -> chunk data
  let images = new Map(); // "cx,cy" -> baked canvas
  // Biome change: for FADE seconds the old palette blends into the new one.
  const FADE = 2.6;
  let fade = null; // { from, images, t }
  const MAX_IMAGES = 48,
    MAX_DATA = 400;
  const broken = new Set(); // destroyed props: "tx,ty"
  let nextPropId = 1;

  // ---------------- noise ----------------

  const H = (x, y, s) => U.hash(x, y, s);

  function vnoise(x, y, s) {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const u = xf * xf * (3 - 2 * xf),
      v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s),
      b = H(xi + 1, yi, s),
      c = H(xi, yi + 1, s),
      d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;

  /** "Raw" terrain of a tile (uncached). */
  function arenaDist(tx, ty) {
    return arena ? Math.hypot(tx - arena.tx, ty - arena.ty) : Infinity;
  }

  /**
   * The arena's clear corridor: where you spawn (south) and the legendary (north).
   * With `clear` in the theme, also a clearing where Arceus lands (5 to the north).
   */
  function arenaSafe(tx, ty) {
    const lx = tx - arena.tx,
      ly = ty - arena.ty;
    return (
      (Math.abs(lx) <= 2 && ly >= -6 && ly <= 5) ||
      Math.hypot(lx, ly) < 2.5 ||
      (arena.th.clear > 0 && Math.hypot(lx, ly + 5) < arena.th.clear)
    );
  }

  function terrainRaw(tx, ty) {
    const ad = arenaDist(tx, ty);
    if (ad < arena_outer()) {
      if (ad >= arena.r) return WALL;
      if (arenaSafe(tx, ty)) return FLOOR;
      const th = arena.th;
      // 2×2 pillars (cover) and pools depending on the arena's type.
      if (th.pillars && ad < arena.r - 2 && H(tx >> 1, ty >> 1, seed + 31 + arena.tx) < th.pillars) return WALL;
      if (th.pools && ad < arena.r - 1.5 && fbm(tx / 3.2, ty / 3.2, seed + 37 + arena.tx) < th.pools) return LIQUID;
      return FLOOR;
    }
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR; // starting clearing
    const ramp = U.clamp((d - 9) / 8, 0, 1); // smooth ramp-in
    if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
    if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
    return FLOOR;
  }

  // ---------------- chunk data ----------------

  function chunkData(cx, cy) {
    const k = cx + ',' + cy;
    let c = data.get(k);
    if (c) return c;

    c = { cx, cy, terr: new Uint8Array(N * N), props: [], propAt: new Map(), liquids: [] };
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const tx = cx * N + i,
          ty = cy * N + j;
        const t = terrainRaw(tx, ty);
        c.terr[j * N + i] = t;
        if (t === LIQUID) c.liquids.push(tx, ty);
      }
    if (data.size > MAX_DATA) data.delete(data.keys().next().value);
    data.set(k, c);
    placeProps(c);
    return c;
  }

  function terrainAt(tx, ty) {
    const cx = Math.floor(tx / N),
      cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.terr[(ty - cy * N) * N + (tx - cx * N)];
  }

  const arena_outer = () => (arena ? arena.r + 7 : 0);

  function placeProps(c) {
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (c.terr[j * N + i] !== FLOOR) continue;
        const tx = c.cx * N + i,
          ty = c.cy * N + j;
        if (Math.hypot(tx, ty) < 7) continue;
        if (broken.has(tx + ',' + ty)) continue;

        // Needs ground around it so it doesn't hug walls / water.
        let open = true;
        for (let b = -1; b <= 1 && open; b++)
          for (let a = -1; a <= 1; a++)
            if (terrainRaw(tx + a, ty + b) !== FLOOR) {
              open = false;
              break;
            }

        // Inside the arena: decoration for its type (and nothing in the corridor).
        const ad = arenaDist(tx, ty);
        if (ad < arena_outer() + 2) {
          if (!arena || ad >= arena.r - 1.2 || arenaSafe(tx, ty)) continue;
          const pr = arena.th.props,
            hh = H(tx, ty, seed + 777);
          let at = null;
          if (open && hh < (pr.tree || 0)) at = 'tree';
          else if (open && hh < (pr.tree || 0) + (pr.rock || 0)) at = 'rock';
          else if (hh > 1 - (pr.grass || 0)) at = 'grass';
          if (at) {
            const p = makeProp(at, tx, ty);
            c.props.push(p);
            if (p.solid) c.propAt.set(tx + ',' + ty, p);
          }
          continue;
        }

        const h = H(tx, ty, seed + 404);
        const grove = fbm(tx / 10, ty / 10, seed + 505) > 0.6;
        let type = null,
          kind = 0;
        // Interactive objects (rare), away from the starting clearing.
        const hs = H(tx, ty, seed + 909);
        if (open && Math.hypot(tx, ty) > 12 && hs < 0.0032) {
          type = hs < 0.0004 ? 'altar' : hs < 0.0008 ? 'spring' : hs < 0.0011 ? 'bigchest' : 'trap';
          kind = Math.floor(H(tx, ty, seed + 910) * (type === 'altar' ? 4 : 3));
        }
        if (type) {
          /* already chosen */
        } else if (open && h < (grove ? 0.07 : 0.006)) type = 'tree';
        else if (open && h > 0.992) type = 'rock';
        else if (open && h > 0.985 && h <= 0.992 && H(tx, ty, seed + 606) < 0.07) type = 'chest';
        else if (fbm(tx / 5, ty / 5, seed + 707) > 0.66 && H(tx, ty, seed + 808) < 0.75) type = 'grass';
        if (!type) continue;

        const p = makeProp(type, tx, ty, kind);
        c.props.push(p);
        if (p.solid) c.propAt.set(tx + ',' + ty, p);
      }
  }

  const PROP = {
    tree: { solid: true, hp: Infinity, r: 13 },
    rock: { solid: true, hp: 34, r: 12 },
    chest: { solid: true, hp: 22, r: 12 },
    grass: { solid: false, hp: 1, r: 14 },
    altar: { solid: true, hp: Infinity, r: 9 },
    spring: { solid: false, hp: Infinity, r: 22, flat: true },
    bigchest: { solid: true, hp: Infinity, r: 14 },
    trap: { solid: false, hp: Infinity, r: 9, flat: true }
  };
  const SPECIAL = new Set(['altar', 'spring', 'bigchest', 'trap']);

  function makeProp(type, tx, ty, kind = 0) {
    const d = PROP[type];
    return {
      id: nextPropId++,
      type,
      tx,
      ty,
      kind,
      x: tx * TS + TS / 2,
      y: ty * TS + TS - 4,
      r: d.r,
      hp: d.hp,
      maxHp: d.hp,
      solid: d.solid,
      flat: !!d.flat,
      destructible: d.hp !== Infinity,
      flash: 0,
      wiggle: H(tx, ty, 9) * 6.28,
      used: false,
      charge: 1,
      open: 0 // altar / spring / locked chest
    };
  }

  // ---------------- queries ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) {
    return KIND[terrainAt(tileOf(x), tileOf(y))];
  }
  function isWall(x, y) {
    return terrainAt(tileOf(x), tileOf(y)) === WALL;
  }
  function isLiquid(x, y) {
    return terrainAt(tileOf(x), tileOf(y)) === LIQUID;
  }
  function liquidKind() {
    return Tiles.BIOMES[biome].liquid;
  }

  /**
   * Effect of the current liquid on a Pokémon of these types:
   *   { slow, dmg, every, color, slide }  (dmg as % of max HP)
   * Matching types are immune to their own (Fire in lava, Poison in poison...).
   */
  const LIQ = {
    water: { slow: 0.6, immune: ['water'] }, // Water types swim without slowing
    swamp: { slow: 0.45, immune: ['water'] },
    lava: { dmg: 0.06, flat: 5, every: 0.5, color: '#ff8a3d', immune: ['fire'] },
    poison: { dmg: 0.035, flat: 3, every: 0.5, color: '#c86bdc', immune: ['poison', 'steel'] },
    spark: { dmg: 0.045, flat: 4, every: 0.7, color: '#ffe14d', immune: ['electric', 'ground'] },
    ice: { slide: true, immune: ['ice'] }
  };
  function liquidEffect(types) {
    const e = LIQ[liquidKind()] || LIQ.water;
    if (e.immune && types && types.some(t => e.immune.includes(t))) return {};
    return e;
  }

  function propAtTile(tx, ty) {
    const cx = Math.floor(tx / N),
      cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.propAt.get(tx + ',' + ty) || null;
  }

  /** Can this tile be walked through? (pathing.js) */
  function walkable(tx, ty) {
    const t = terrainAt(tx, ty);
    if (t === WALL) return false;
    if (t === LIQUID && (LIQ[liquidKind()] || {}).dmg) return false; // lava, poison, shock
    const p = propAtTile(tx, ty);
    return !(p && p.solid);
  }

  /** Is there room here for something of radius r? */
  function isFree(x, y, r = 12, allowLiquid = false) {
    const t0x = tileOf(x - r),
      t1x = tileOf(x + r),
      t0y = tileOf(y - r),
      t1y = tileOf(y + r);
    for (let ty = t0y; ty <= t1y; ty++)
      for (let tx = t0x; tx <= t1x; tx++) {
        const t = terrainAt(tx, ty);
        if (t === WALL || (!allowLiquid && t === LIQUID)) return false;
        const p = propAtTile(tx, ty);
        if (p && U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return false;
      }
    return true;
  }

  /** Destructible objects (grass included) touching a circle. */
  function propsInCircle(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW),
      c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW),
      c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++) {
        const c = chunkData(cx, cy);
        for (const p of c.props) {
          if (!p.destructible || p.hp <= 0) continue;
          if (U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
        }
      }
    return out;
  }

  /** Nearby interactive objects (altars, springs, locked chests, traps). */
  function specialsNear(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW),
      c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW),
      c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++) {
        for (const p of chunkData(cx, cy).props) {
          if (SPECIAL.has(p.type) && U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
        }
      }
    return out;
  }

  /** Nearest rock or chest (to aim at when there are no enemies). */
  function nearestBreakable(x, y, r) {
    let best = null,
      bd = r * r;
    for (const p of propsInCircle(x, y, r)) {
      if (!p.solid) continue;
      const d = U.dist2(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /**
   * Pushes a circle out of walls and solid objects (sliding).
   * Returns true if it hit something.
   */
  function collide(e) {
    const r = e.r;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t0x = tileOf(e.x - r),
        t1x = tileOf(e.x + r),
        t0y = tileOf(e.y - r),
        t1y = tileOf(e.y + r);
      for (let ty = t0y; ty <= t1y; ty++)
        for (let tx = t0x; tx <= t1x; tx++) {
          if (terrainAt(tx, ty) === WALL) {
            // Closest point of the tile's box to the circle's centre.
            const bx0 = tx * TS,
              by0 = ty * TS,
              bx1 = bx0 + TS,
              by1 = by0 + TS;
            const qx = U.clamp(e.x, bx0, bx1),
              qy = U.clamp(e.y, by0, by1);
            let dx = e.x - qx,
              dy = e.y - qy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            hit = true;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              e.x += (dx / d) * (r - d);
              e.y += (dy / d) * (r - d);
            } else {
              // Centre inside the box: exit through the nearest side.
              const l = e.x - bx0,
                rr = bx1 - e.x,
                u = e.y - by0,
                b = by1 - e.y;
              const m = Math.min(l, rr, u, b);
              if (m === l) e.x = bx0 - r;
              else if (m === rr) e.x = bx1 + r;
              else if (m === u) e.y = by0 - r;
              else e.y = by1 + r;
            }
          }
          const p = propAtTile(tx, ty);
          if (p && p.solid) {
            const dx = e.x - p.x,
              dy = e.y - p.y;
            const min = r + p.r,
              d2 = dx * dx + dy * dy;
            if (d2 < min * min) {
              hit = true;
              const d = Math.sqrt(d2) || 0.01;
              e.x = p.x + (dx / d) * min;
              e.y = p.y + (dy / d) * min;
            }
          }
        }
    }
    return hit;
  }

  /** Does a projectile hit something here? Returns 'wall', the solid prop, or null. */
  function projectileBlock(x, y, r) {
    const tx = tileOf(x),
      ty = tileOf(y);
    if (terrainAt(tx, ty) === WALL) return 'wall';
    for (let b = -1; b <= 1; b++)
      for (let a = -1; a <= 1; a++) {
        const p = propAtTile(tx + a, ty + b);
        if (p && p.solid && U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return p;
      }
    return null;
  }

  // ---------------- prop damage ----------------

  function damageProp(p, amount, color = '#fff') {
    if (!p.destructible || p.hp <= 0) return false;
    p.hp -= amount;
    p.flash = 0.08;
    if (p.type !== 'grass') FX.spark(p.x, p.y - 10, color, 0, -1, 3);
    if (p.hp <= 0) {
      destroyProp(p);
      return true;
    }
    return false;
  }

  /** Breaks the object on that tile (arrives over the network in co-op). */
  function breakAt(tx, ty) {
    const k = tx + ',' + ty;
    if (broken.has(k)) return;
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) destroyProp(p, true);
    else broken.add(k);
  }

  // Prop loot: amounts and chances in Balance.drops; what drops is rolled on
  // the seeded 'loot' stream, where the coins scatter is cosmetic.
  const LOOT = Balance.drops;
  const lootR = RNG.stream('loot');

  function destroyProp(p, fromNet = false) {
    broken.add(p.tx + ',' + p.ty);
    if (Coop.active && !fromNet) Coop.propBroken(p);
    const cx = Math.floor(p.tx / N),
      cy = Math.floor(p.ty / N);
    const c = data.get(cx + ',' + cy);
    if (c) {
      c.props.splice(c.props.indexOf(p), 1);
      c.propAt.delete(p.tx + ',' + p.ty);
    }
    const B = Tiles.BIOMES[biome];
    Audio.sfx(p.type === 'grass' ? 'grass' : p.type === 'chest' ? 'chest' : 'break');
    if (p.type === 'grass') {
      FX.burst(p.x, p.y - 6, B.grass[1], 6, 70);
      const r = lootR.next(),
        L = LOOT.grass;
      if (r < L.heal) Pickups.drop('heal', p.x, p.y);
      else if (r < L.coin) Pickups.drop('coin', p.x, p.y, L.coinValue);
      return;
    }
    if (p.type === 'rock') {
      FX.burst(p.x, p.y - 10, B.rock[1], 14, 140);
      FX.ring(p.x, p.y - 8, 4, 26, B.rock[2], 0.3, 3);
      const r = lootR.next(),
        L = LOOT.rock;
      if (r < L.xpBelow) Pickups.dropXp(p.x, p.y, L.xp);
      if (r > L.coinAbove) Pickups.drop('coin', p.x, p.y, L.coinValue);
      if (r > L.healAbove) Pickups.drop('heal', p.x + 8, p.y);
      return;
    }
    if (p.type === 'chest') {
      FX.burst(p.x, p.y - 10, '#f2c443', 22, 180);
      FX.ring(p.x, p.y - 8, 6, 46, '#f2c443', 0.45, 4);
      Camera.kick(0.25);
      const L = LOOT.chest;
      const n = lootR.int(L.coins[0], L.coins[1]);
      for (let i = 0; i < n; i++) Pickups.drop('coin', p.x + U.rand(-14, 14), p.y + U.rand(-10, 10), L.coinValue);
      Pickups.drop(lootR.chance(L.healChance) ? 'heal' : 'magnet', p.x, p.y);
      Pickups.dropXp(p.x, p.y, L.xp);
      if (lootR.chance(L.item)) Pickups.drop('item', p.x, p.y - 12, Items.roll());
      return;
    }
    if (p.type === 'bigchest') {
      // Big loot: coins, tickets and enough experience for a level up.
      FX.burst(p.x, p.y - 12, '#f2c443', 34, 220);
      FX.ring(p.x, p.y - 8, 6, 80, '#f2c443', 0.6, 5);
      Camera.kick(0.4);
      const L = LOOT.bigchest;
      for (let i = 0; i < L.coins; i++) Pickups.drop('coin', p.x + U.rand(-22, 22), p.y + U.rand(-14, 14), L.coinValue);
      const tk = lootR.int(L.tickets[0], L.tickets[1]);
      for (let i = 0; i < tk; i++) Pickups.drop('ticket', p.x + U.rand(-16, 16), p.y + U.rand(-10, 10), 1);
      if (lootR.chance(L.t10)) Pickups.drop('ticket10', p.x, p.y - 10, 1);
      if (lootR.chance(L.item)) Pickups.drop('item', p.x + 14, p.y - 14, Items.roll());
      Pickups.dropXp(p.x, p.y, Game.levelXp());
      Progress.event('chest');
      return;
    }
    if (p.type === 'trap') Interact.trapEffect(p);
  }

  // ---------------- drawing ----------------

  function chunkImage(cx, cy, bi = biome, cache = images) {
    const k = cx + ',' + cy;
    let img = cache.get(k);
    if (img) return img;
    const at = (tx, ty) => KIND[terrainAt(tx, ty)];
    // Continuous "dirt" field; tiles.js samples it on a grid and
    // interpolates per pixel so the patches get organic edges.
    const S = 6 * Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    img = Tiles.paintChunk(cx, cy, N, at, dirtField, bi, seed);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    cache.set(k, img);
    return img;
  }

  /** 0..1 biome fade progress (smoothed), or null if none. */
  function fadeK() {
    if (!fade) return null;
    const x = Math.min(1, fade.t / FADE);
    return x * x * (3 - 2 * x);
  }

  function visibleChunks(cam, pad = 0) {
    const out = [];
    const x0 = Math.floor((cam.left() - pad) / CW),
      x1 = Math.floor((cam.left() + cam.w + pad) / CW);
    const y0 = Math.floor((cam.top() - pad) / CW),
      y1 = Math.floor((cam.top() + cam.h + pad) / CW);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  function drawGround(ctx, cam) {
    ctx.imageSmoothingEnabled = false;
    const k = fadeK();
    for (const [cx, cy] of visibleChunks(cam)) {
      // +1 overlap: avoids seams between chunks at non-integer scales.
      if (k == null) {
        ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
        continue;
      }
      // Fade: the old biome underneath and the new one appearing on top.
      ctx.drawImage(chunkImage(cx, cy, fade.from, fade.images), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = k;
      ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = 1;
    }
  }

  /** Animated glints on water / lava bubbles (and poison and electricity). */
  function drawLiquid(ctx, cam, t) {
    const B = Tiles.BIOMES[biome];
    const lava = B.liquid === 'lava' || B.liquid === 'poison' || B.liquid === 'spark';
    ctx.fillStyle = B.foam;
    const P = Sprites.PX;
    for (const [cx, cy] of visibleChunks(cam)) {
      const c = chunkData(cx, cy);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i],
          ty = c.liquids[i + 1];
        const x = tx * TS,
          y = ty * TS;
        if (!cam.sees(x + TS / 2, y + TS / 2, TS)) continue;
        const ph = H(tx, ty, 77) * 6.28;
        const k = (Math.sin(t * (lava ? 2.2 : 1.6) + ph) + 1) / 2;
        ctx.globalAlpha = lava ? 0.35 + k * 0.5 : k * 0.7;
        const sx = x + Math.floor(H(tx, ty, 78) * 12 + 2) * P;
        const sy = y + Math.floor(H(tx, ty, 79) * 12 + 2) * P;
        ctx.fillRect(sx + Math.round(k * 2) * P, sy, P * (lava ? 2 : 3), P);
        if (lava && k > 0.8) ctx.fillRect(sx, sy - P * 2, P, P);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Visible props, to merge into the Y order with the entities. */
  function visibleProps(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (cam.sees(p.x, p.y, 70)) out.push(p);
    }
    return out;
  }

  function drawProp(ctx, p, t) {
    const P = Sprites.PX;
    const variant =
      p.type === 'grass'
        ? Math.sin(t * 2.4 + p.wiggle) > 0.55
          ? 1
          : 0
        : p.type === 'rock'
          ? p.hp < p.maxHp * 0.5
            ? 1
            : 0
          : p.type === 'altar'
            ? p.kind * 2 + (p.used ? 1 : 0)
            : p.type === 'spring'
              ? p.charge < 0.15
                ? 1
                : 0
              : p.type === 'trap'
                ? p.kind
                : 0;
    const img = Tiles.propSprite(biome, p.type, variant);
    const w = img.width * P,
      h = img.height * P;
    if (p.flat) {
      // Flat ones (spring, trap): stuck to the ground, centred on their tile.
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - 8 - h / 2), w, h);
      if (p.type === 'spring' && p.charge >= 0.15 && Math.sin(t * 3 + p.wiggle) > 0.92) {
        FX.twinkle(p.x + U.rand(-20, 20), p.y - 8 + U.rand(-6, 6));
      }
      return;
    }
    if (p.type === 'altar' && !p.used) {
      // Pulsing orb halo.
      const col = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#ffd23f'][p.kind];
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 3 + p.wiggle) * 0.1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h + 11 * P, 13, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    if (p.type === 'bigchest' && p.open > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h / 2, 26, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, p.open / Interact.CHEST_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (p.type !== 'grass') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.38, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.save();
    const x = Math.round(p.x - w / 2),
      y = Math.round(p.y - h + (p.type === 'grass' ? 4 : 2));
    const k = fadeK();
    if (k != null) {
      // The old object fades out while the new one appears.
      const old = Tiles.propSprite(fade.from, p.type, variant);
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(
        old,
        Math.round(p.x - (old.width * P) / 2),
        Math.round(p.y - old.height * P + (p.type === 'grass' ? 4 : 2)),
        old.width * P,
        old.height * P
      );
      ctx.globalAlpha = k;
    }
    ctx.drawImage(img, x, y, w, h);
    if (p.flash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(Sprites.white(img), x, y, w, h);
    }
    ctx.restore();
  }

  function update(dt, cam) {
    if (fade && (fade.t += dt) >= FADE) fade = null;
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (p.flash > 0) p.flash -= dt;
    }
  }

  // ---------------- control ----------------

  function reset(s) {
    seed = s | 0 || 1;
    data.clear();
    images.clear();
    broken.clear();
    fade = null;
    arena = null;
  }

  /**
   * @param i        biome (Tiles.ARENA onwards are the rift arenas)
   * @param instant  no fade (when starting a run)
   * A run changes biome every 4 min and goes through the whole list; when it ends,
   * it starts over. (Previously, past the last one, around minute 84, it asked for
   * a biome that doesn't exist: black screen, broken game and endless levels.)
   */
  function setBiome(i, instant = false) {
    const n = Tiles.BIOMES.length;
    const b = ((i % n) + n) % n;
    if (b === biome) return;
    // The terrain stays the same: only the palette changes, blending gradually.
    fade = instant ? null : { from: biome, images, t: 0 };
    biome = b;
    images = new Map();
  }

  function biomeName() {
    return Tiles.BIOMES[biome].name;
  }

  /** Vignette in screen coordinates. */
  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    TS,
    CW,
    reset,
    setBiome,
    biomeName,
    liquidKind,
    liquidEffect,
    walkable,
    kindAt,
    isWall,
    isLiquid,
    isFree,
    collide,
    projectileBlock,
    propsInCircle,
    nearestBreakable,
    damageProp,
    breakAt,
    specialsNear,
    update,
    breakProp(p) {
      if (!broken.has(p.tx + ',' + p.ty)) destroyProp(p);
    },
    /** Rift arena: { tx, ty, r } (in tiles) or null. */
    setArena(a) {
      arena = a;
      if (!a) return;
      a.th = Tiles.ARENA_THEMES[a.type] || Tiles.ARENA_THEMES.normal;
      // Forget chunks in that area (in case they were generated earlier).
      const R = a.r + 9;
      for (const k of [...data.keys(), ...images.keys()]) {
        const [cx, cy] = k.split(',').map(Number);
        if (Math.abs(cx * N + N / 2 - a.tx) < R + N && Math.abs(cy * N + N / 2 - a.ty) < R + N) {
          data.delete(k);
          images.delete(k);
        }
      }
    },
    get arena() {
      return arena;
    },
    drawGround,
    drawLiquid,
    visibleProps,
    drawProp,
    drawVignette,
    get biome() {
      return biome;
    }
  };
})();
