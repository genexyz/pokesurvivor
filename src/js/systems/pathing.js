/* ============ pathing.js — enemies walk around rocks and lakes ============
 * One "distance field" per player: every few tenths of a second a
 * breadth-first search (BFS) runs over the tiles around the player,
 * recording how many steps each tile is from them. An enemy
 * just heads to the neighbouring tile with the fewest steps, and so finds
 * its way around walls, rocks, trees and dangerous puddles.
 *
 *   - 8 neighbours, no corner cutting (it won't slip between two diagonal rocks).
 *   - Blocking: walls, solid objects and lava/poison/shock.
 *     Water can be crossed (it only slows).
 *   - Hovering ones (Sprites.hovers) don't need it: they go straight.
 *
 * Cost: R=28 tile radius → 57×57 = 3,249 tiles per player, every
 * 0.35 s. Enemies outside the field (very far away) go straight.
 */
import { U } from '../core/util.js';
import { World } from '../world/world.js';

export const Path = (() => {
  const R = 28,
    N = R * 2 + 1,
    EVERY = 0.35;
  const UNSEEN = 0x7fff;
  const fields = new Map(); // player -> { ox, oy, dist: Int16Array, t }
  const queue = new Int32Array(N * N);
  const D8 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];
  let timer = 0;

  function build(pl) {
    const TS = World.TS;
    const px = Math.floor(pl.x / TS),
      py = Math.floor(pl.y / TS);
    const ox = px - R,
      oy = py - R;
    let f = fields.get(pl);
    if (!f) {
      f = { dist: new Int16Array(N * N) };
      fields.set(pl, f);
    }
    f.ox = ox;
    f.oy = oy;
    const dist = f.dist;
    dist.fill(UNSEEN);
    // Walkable tiles in the area (queried once).
    const open = f.open || (f.open = new Uint8Array(N * N));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) open[j * N + i] = World.walkable(ox + i, oy + j) ? 1 : 0;

    const start = R * N + R;
    open[start] = 1; // the player's own tile always counts
    dist[start] = 0;
    let head = 0,
      tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const c = queue[head++];
      const cx = c % N,
        cy = (c / N) | 0,
        d = dist[c] + 1;
      for (let k = 0; k < 8; k++) {
        const nx = cx + D8[k][0],
          ny = cy + D8[k][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const n = ny * N + nx;
        if (!open[n] || dist[n] !== UNSEEN) continue;
        // Diagonal: both side tiles must be free.
        if (k >= 4 && (!open[cy * N + nx] || !open[ny * N + cx])) continue;
        dist[n] = d;
        queue[tail++] = n;
      }
    }
  }

  /** Recomputes the fields of living players (called by the host / solo). */
  function update(dt, players) {
    timer -= dt;
    if (timer > 0) return;
    timer = EVERY;
    for (const p of [...fields.keys()]) if (!players.includes(p)) fields.delete(p);
    for (const p of players) if (!p.dead) build(p);
  }

  /**
   * (Normalised) direction for `e` to reach `pl` going around
   * obstacles, or null if not needed (close, outside the field or no path).
   */
  function dirFor(e, pl) {
    const f = fields.get(pl);
    if (!f) return null;
    const TS = World.TS;
    const tx = Math.floor(e.x / TS) - f.ox,
      ty = Math.floor(e.y / TS) - f.oy;
    if (tx < 0 || ty < 0 || tx >= N || ty >= N) return null;
    const here = f.dist[ty * N + tx];
    if (here <= 1 || here === UNSEEN) return null; // right next to you, or no path: go direct
    // With a clear line of sight to the player, go straight (more natural).
    // Checked every 0.2 s per enemy (it's the most expensive part).
    const now = performance.now();
    if (!e.losAt || now - e.losAt > 200) {
      e.losAt = now;
      e.los = clearLine(f, e.x, e.y, pl.x, pl.y, e.r);
    }
    if (e.los) return null;
    // Next tile on the path (the neighbour with the fewest steps, no corner cutting).
    let bx = tx,
      by = ty,
      best = here;
    for (let k = 0; k < 8; k++) {
      const x = tx + D8[k][0],
        y = ty + D8[k][1];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const v = f.dist[y * N + x];
      if (v >= best) continue;
      if (k >= 4 && (!f.open[ty * N + x] || !f.open[y * N + tx])) continue;
      best = v;
      bx = x;
      by = y;
    }
    if (bx === tx && by === ty) return null;
    let gx = (f.ox + bx + 0.5) * TS,
      gy = (f.oy + by + 0.5) * TS;
    // If off-centre and the shortcut to that tile grazes an obstacle,
    // first go to the centre of its own tile (so it doesn't snag on corners).
    if (!clearLine(f, e.x, e.y, gx, gy, e.r)) {
      gx = (f.ox + tx + 0.5) * TS;
      gy = (f.oy + ty + 0.5) * TS;
    }
    return U.norm(gx - e.x, gy - e.y);
  }

  /** Does a body of radius r fit in a straight line from (ax,ay) to (bx,by)? */
  function clearLine(f, ax, ay, bx, by, r) {
    const TS = World.TS;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) return true;
    const ux = (bx - ax) / len,
      uy = (by - ay) / len;
    const w = Math.min(r * 0.9, TS * 0.45);
    for (let d = 0; d <= len; d += TS * 0.4) {
      const cx = ax + ux * d,
        cy = ay + uy * d;
      for (const s of [-w, 0, w]) {
        const x = Math.floor((cx - uy * s) / TS) - f.ox,
          y = Math.floor((cy + ux * s) / TS) - f.oy;
        if (x < 0 || y < 0 || x >= N || y >= N) return false;
        if (!f.open[y * N + x]) return false;
      }
    }
    return true;
  }

  function clear() {
    fields.clear();
    timer = 0;
  }

  return { update, dirFor, clear };
})();
