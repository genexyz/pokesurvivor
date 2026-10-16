/* ============ pickup.js — experience orbs and items ============
 * Orbs stay still until you enter the magnet radius; then
 * they speed towards you. To avoid piling up thousands, past MAX the oldest
 * ones get merged.
 *
 * Co-op: the host creates the pickups (each with its own id) and the
 * others get a copy. They all fly towards the nearest player; the host
 * decides who picked them up.
 */
G.Pickups = (() => {
  let list = [];
  const MAX = 420;
  let nextId = 1;

  const KIND = {
    xp: { color: '#7fe0ff', glow: '#2a8fd0', r: 4.5 },
    xpBig: { color: '#ffd95e', glow: '#c08a10', r: 7 },
    heal: { color: '#5fe08a', glow: '#1f8f4d', r: 6.5 },
    magnet: { color: '#ff9ed8', glow: '#b03d84', r: 6.5 },
    bomb: { color: '#ff7b3d', glow: '#b03d10', r: 6.5 },
    coin: { color: '#ffd23f', glow: '#b8860b', r: 5.5 },
    ticket: { color: '#ffd23f', glow: '#c08a10', r: 7 },
    ticket10: { color: '#c47bff', glow: '#8a3fd0', r: 8 },
    item: { color: '#ffd23f', glow: '#c08a10', r: 9 } // value = item id
  };
  // Drop chances, ticket rates and magnet pull: G.Balance.drops.
  // Whether something drops is rolled on the seeded 'loot' stream.
  const B = G.Balance.drops;
  const R = G.RNG.stream('loot');
  // Where drops land changes when you can grab them, so it's seeded too (its own
  // stream: the scatter never shifts what drops).
  const S = G.RNG.stream('scatter');

  function clear() {
    list = [];
  }
  function all() {
    return list;
  }

  function push(o) {
    // In co-op only the host creates pickups (copies arrive over the network).
    if (G.Coop.active && !G.Coop.isHost) return;
    o.id = nextId++;
    list.push(o);
    if (G.Coop.isHost) G.Coop.pickupAdded(o);
    if (list.length > MAX) {
      // Merge the two oldest XP orbs so the list doesn't grow unbounded.
      const i = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
      if (i >= 0) {
        const a = list.splice(i, 1)[0];
        const j = list.findIndex(p => p.kind === 'xp' || p.kind === 'xpBig');
        if (j >= 0) {
          list[j].value += a.value;
          list[j].kind = 'xpBig';
        }
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      } else {
        const a = list.shift();
        if (G.Coop.isHost) G.Coop.pickupGone(a.id);
      }
    }
  }

  /** Copy of a host pickup. */
  function addRemote(id, kind, x, y, value) {
    if (list.some(p => p.id === id)) return;
    const o = orb(kind, x, y, value);
    o.id = id;
    list.push(o);
  }

  function removeId(id) {
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return null;
    return list.splice(i, 1)[0];
  }

  /** Magnet: everything flies to the nearest player. */
  function pullAll() {
    for (const o of list) o.pulled = true;
  }

  /** @param plain  experience only (the Judgment of Arceus legendaries) */
  function dropXp(x, y, value, boss = false, legend = false, plain = false) {
    if (boss) {
      // Bosses burst into a pile of big orbs + rewards.
      const n = B.boss.orbs;
      for (let i = 0; i < n; i++) {
        const a = S.angle(),
          d = S.range(10, 70);
        push(orb('xpBig', x + Math.cos(a) * d, y + Math.sin(a) * d, Math.ceil(value / n)));
      }
      if (plain) return;
      push(orb('heal', x + 24, y, 0));
      push(orb('magnet', x - 24, y, 0));
      // ×10 ticket: B.boss.legendT10 from the rift legendary, B.boss.t10 from a normal boss.
      // (Until 12-10-2026 the rift legendary always gave 2: too many came out.)
      if (R.chance(legend ? B.boss.legendT10 : B.boss.t10)) push(orb('ticket10', x, y - 20, 1));
      return;
    }
    push(orb(value >= B.xpBigFrom ? 'xpBig' : 'xp', x, y, value));
    if (R.chance(B.ticketRate)) push(orb('ticket', x + S.range(-6, 6), y, 1));

    // Occasional drops.
    const r = R.next(),
      O = B.occasional;
    if (r < O.heal) push(orb('heal', x + S.range(-8, 8), y, 0));
    else if (r < O.magnet) push(orb('magnet', x, y, 0));
    else if (r < O.bomb) push(orb('bomb', x, y, 0));
  }

  /** Drops a single pickup: 'heal' | 'magnet' | 'bomb' | 'coin'. */
  function drop(kind, x, y, value = 0) {
    push(orb(kind, x, y, value));
  }

  function orb(kind, x, y, value) {
    const a = S.angle();
    return {
      kind,
      x,
      y,
      value,
      vx: Math.cos(a) * S.range(10, 46),
      vy: Math.sin(a) * S.range(10, 46),
      t: Math.random() * 6.28,
      pulled: false
    };
  }

  /**
   * @param players  a player or the list of players (downed ones don't collect)
   * @param onCollect(pickup, player)
   */
  function update(dt, players, onCollect) {
    if (!Array.isArray(players)) players = [players];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt * 4;

      // The nearest living player (solo: always you).
      let pl = null,
        d2 = Infinity;
      for (const o of players) {
        if (o.dead && players.length > 1) continue;
        const dd = G.U.dist2(o.x, o.y, p.x, p.y);
        if (dd < d2) {
          d2 = dd;
          pl = o;
        }
      }
      if (!pl) continue;
      const dx = pl.x - p.x,
        dy = pl.y - p.y;
      const mag2 = pl.magnet * pl.magnet;

      if (p.pulled || d2 < mag2) {
        p.pulled = true;
        const d = Math.sqrt(d2) || 1;
        const P = B.pull;
        const pull = P.base + P.near / d;
        p.vx = G.U.damp(p.vx, (dx / d) * pull, P.damp, dt);
        p.vy = G.U.damp(p.vy, (dy / d) * pull, P.damp, dt);
      } else {
        p.vx *= Math.pow(B.pull.friction, dt);
        p.vy *= Math.pow(B.pull.friction, dt);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (d2 < B.collectR * B.collectR) {
        list.splice(i, 1);
        onCollect(p, pl);
      }
    }
  }

  function draw(ctx) {
    for (const p of list) {
      if (!G.Camera.sees(p.x, p.y, 30)) continue;
      const k = KIND[p.kind];
      const bounce = Math.abs(Math.sin(p.t * 0.8)) * 3;
      const r = k.r;
      const y = p.y - 6 - bounce;

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.9, r * 0.35, 0, 0, 6.2832);
      ctx.fill();

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = k.glow;
      ctx.beginPath();
      ctx.arc(p.x, y, r * 2, 0, 6.2832);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = k.color;
      if (p.kind === 'xp' || p.kind === 'xpBig') {
        ctx.beginPath();
        ctx.moveTo(p.x, y - r);
        ctx.lineTo(p.x + r * 0.78, y);
        ctx.lineTo(p.x, y + r);
        ctx.lineTo(p.x - r * 0.78, y);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'coin') {
        // Spinning coin: a narrowing ellipse.
        const sx = Math.max(0.25, Math.abs(Math.cos(p.t * 0.9)));
        ctx.beginPath();
        ctx.ellipse(p.x, y, r * sx, r, 0, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#b8860b';
        ctx.beginPath();
        ctx.ellipse(p.x, y, r * sx * 0.5, r * 0.5, 0, 0, 6.2832);
        ctx.fill();
      } else {
        // Berry, magnet and bomb: their pixel art icon.
        const ICON = { heal: 'berry', magnet: 'magnet', bomb: 'bomb', ticket: 'ticket', ticket10: 'ticket10' };
        const sz = p.kind === 'ticket10' || p.kind === 'item' ? 24 : 18;
        if (p.kind === 'item') {
          // Item: pulsing golden glow, so it can be seen from afar.
          ctx.globalAlpha = 0.35 + Math.sin(p.t * 1.5) * 0.15;
          ctx.fillStyle = '#ffe14d';
          ctx.beginPath();
          ctx.arc(p.x, y, 18, 0, 6.2832);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        G.Icons.draw(ctx, p.kind === 'item' ? p.value : ICON[p.kind], p.x - sz / 2, y - sz / 2 - 1, sz);
        continue;
      }
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.25, y - r * 0.3, r * 0.28, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  return {
    clear,
    all,
    dropXp,
    drop,
    update,
    draw,
    addRemote,
    removeId,
    pullAll,
    KIND,
    get count() {
      return list.length;
    }
  };
})();
