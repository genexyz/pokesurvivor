/* ============ events.js — mid-run events and treasure goblins ============
 *
 * Every 4-5 minutes (never with a boss alive or in the rift) one of these happens:
 *
 *   horde   Type horde: 30 s in which everything that spawns is of a
 *           single type (if your type beats it, it's your moment)
 *   gold    Golden hour: 30 s of golden enemies that give double
 *           experience and sometimes drop coins
 *   lost    Lost Pokémon: touch it, it follows you and you lead it to the marker.
 *           Enemies damage it; if it faints (or you take over 2 min), it leaves.
 *           Reward: heals half your HP, coins, a ticket and, 1 time in
 *           5, it joins your collection.
 *
 * Treasure goblins (1-2 per run, see Enemy behavior 'thief'): a
 * Meowth loaded with coins (or, 1 in 4, a Gholdengo with a ×10 ticket)
 * that runs away and escapes after 15 s if you don't catch it.
 *
 * Co-op: the host decides and announces with 'ev' (see coop.js). Everyone sees the
 * same thing and the reward is for everyone.
 */
G.Events = (() => {
  const B = G.Balance.events;
  const R = G.RNG.stream('events');
  const authority = () => !G.Coop.active || G.Coop.isHost;

  let nextT = 0,
    cur = null,
    last = null,
    thiefT = 0,
    thieves = 0;
  let lost = null; // { dex, name, x, y, hp, maxHp, state, follow, tx, ty, t, anim, r, hitCd, netT, grant }

  function reset() {
    nextT = R.range(B.every[0], B.every[1]);
    cur = null;
    last = null;
    lost = null;
    thiefT = R.range(B.thief.first[0], B.thief.first[1]);
    thieves = 0;
  }

  // ---------------- cycle ----------------

  function update(dt, players, time) {
    if (cur) {
      cur.t += dt;
      if (cur.id !== 'lost' && cur.t >= cur.dur && authority()) end();
    }
    if (lost) lostTick(dt, players);
    if (!authority() || G.Rift.inArena || G.Judgment.active) return;

    if (thieves < B.thief.max) {
      thiefT -= dt;
      if (thiefT <= 0) {
        if (G.EnemyMgr.bossAlive()) thiefT = B.thief.bossRetry;
        else {
          spawnThief(players, time);
          thieves++;
          thiefT = R.range(B.thief.next[0], B.thief.next[1]);
        }
      }
    }

    if (cur) return;
    nextT -= dt;
    if (nextT > 0) return;
    if (G.EnemyMgr.bossAlive()) {
      nextT = B.bossRetry;
      return;
    }
    nextT = R.range(B.every[0], B.every[1]);
    const ids = B.ids.filter(id => id !== last);
    start(R.pick(ids), time, players);
  }

  function start(id, time, players) {
    last = id;
    if (id === 'horde') {
      const types = G.Enemies.hordeTypes(time);
      if (!types.length) return start('gold', time, players);
      const type = R.pick(types);
      const defs = G.Enemies.hordeDefs(type, time);
      G.Sprites.preload(defs.map(d => d.dex));
      cur = { id, t: 0, dur: B.horde.dur, type, defs };
      G.Spawner.burst(Math.round(B.horde.burst * G.Coop.scaleRate(players.length)));
    } else if (id === 'gold') {
      cur = { id, t: 0, dur: B.gold.dur };
      for (const e of G.EnemyMgr.all()) if (!e.remote) e.makeGolden();
    } else {
      if (!spawnLost(players)) return;
      cur = { id, t: 0, dur: Infinity };
    }
    announce();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 's', id, cur.type || '']);
  }

  function announce() {
    if (!cur) return;
    if (cur.id === 'horde') say(`A ${G.U.TYPE_NAME[cur.type]}-type horde!`, 3, G.U.TYPE_COLOR[cur.type]);
    else if (cur.id === 'gold') say('Golden hour! Double experience', 3, '#ffd23f');
    else if (lost) say(`A ${lost.name} is lost! Find it and take it to the marker`, 3.4, '#7dffb0');
    G.Audio.sfx(cur.id === 'gold' ? 'shiny' : 'surge');
  }

  function say(text, secs) {
    G.Spawner.say(text, secs, true);
  }

  function end() {
    if (!cur) return;
    cur = null;
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'e']);
  }

  /** What spawns during a horde (used by G.Enemies.bagAt). */
  function bag() {
    return cur && cur.id === 'horde' && cur.defs.length ? cur.defs : null;
  }

  // ---------------- treasure goblin ----------------

  function spawnThief(players, time) {
    const T = B.thief;
    const gold = R.chance(T.goldChance);
    const dex = gold ? T.goldDex : T.dex;
    const mon = G.DEX_BY[dex];
    if (!mon || !G.SPRITE_META[dex]) return;
    const pl = R.pick(players.filter(p => !p.dead).length ? players.filter(p => !p.dead) : players);
    G.Sprites.preload([dex]);
    const def = {
      dex,
      name: mon.name,
      behavior: 'thief',
      hp: Math.round(T.hp(time, gold)),
      spd: T.spd,
      dmg: 0,
      xp: T.xp,
      loot: gold ? 'ticket10' : 'coins'
    };
    for (let i = 0; i < 12; i++) {
      const a = R.angle(),
        d = R.range(T.spawnDist[0], T.spawnDist[1]);
      const x = pl.x + Math.cos(a) * d,
        y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 14)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = T.life;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 40, '#ffd23f', 0.5, 3);
      G.Spawner.say(
        gold
          ? `A ${mon.name} with a ×10 ticket! Catch it before it runs away!`
          : `A ${mon.name} loaded with coins! Catch it before it runs away!`,
        3.2
      );
      G.Audio.sfx('shiny');
      return;
    }
  }

  // ---------------- lost Pokémon ----------------

  function spawnLost(players) {
    const alive = players.filter(p => !p.dead);
    const pl = R.pick(alive.length ? alive : players);
    const pool = G.DEX.filter(p => p.rarity <= B.lost.maxRarity && !p.leg && G.SPRITE_META[p.dex] && !G.Sprites.hovers(p.dex));
    const mon = R.pick(pool);
    let at = null,
      to = null;
    for (let i = 0; i < 20 && !at; i++) {
      const a = R.angle(),
        d = R.range(B.lost.spawnDist[0], B.lost.spawnDist[1]);
      const x = pl.x + Math.cos(a) * d,
        y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 16)) at = [x, y];
    }
    for (let i = 0; i < 30 && at && !to; i++) {
      const a = R.angle(),
        d = R.range(B.lost.goalDist[0], B.lost.goalDist[1]);
      const x = at[0] + Math.cos(a) * d,
        y = at[1] + Math.sin(a) * d * 0.85;
      if (G.World.isFree(x, y, 30)) to = [x, y];
    }
    if (!at || !to) return false;
    makeLost({ dex: mon.dex, x: at[0], y: at[1], tx: to[0], ty: to[1], state: 'wait', hp: B.lost.hp, grant: R.chance(B.lost.grant) });
    G.Sprites.preload([mon.dex]);
    return true;
  }

  function makeLost(o) {
    const mon = G.DEX_BY[o.dex];
    lost = Object.assign(
      {
        name: mon ? mon.name : '',
        maxHp: B.lost.hp,
        t: 0,
        hitCd: 0,
        netT: 0,
        follow: null,
        anim: new G.Sprites.Animator(o.dex, 1),
        r: G.Sprites.bodyRadius(o.dex)
      },
      o
    );
  }

  function lostTick(dt, players) {
    const L = lost,
      C = B.lost;
    L.t += dt;
    L.anim.update(dt);
    if (!authority()) {
      L.anim.loop(L.moving ? 'Walk' : 'Idle');
      return;
    }

    if (L.state === 'wait') {
      const p = players.find(o => !o.dead && G.U.dist2(o.x, o.y, L.x, L.y) < (o.r + L.r + C.touchPad) ** 2);
      if (p) {
        L.state = 'follow';
        L.follow = p;
        say(`${L.name} is following you! Take it to the green marker`, 3, '#7dffb0');
        G.Audio.sfx('confirm');
      }
      L.moving = false;
    } else {
      const p = L.follow && !L.follow.dead ? L.follow : players.find(o => !o.dead) || L.follow;
      const d = G.U.dist(L.x, L.y, p.x, p.y),
        keep = p.r + L.r + C.keepPad;
      L.moving = d > keep;
      if (L.moving) {
        const sp = Math.min(d - keep, Math.max(C.minSpd, p.spd * C.spdMul) * dt);
        const [nx, ny] = G.U.norm(p.x - L.x, p.y - L.y);
        L.x += nx * sp;
        L.y += ny * sp;
        G.World.collide(L);
        L.anim.dir = G.Sprites.dirFromAngle(Math.atan2(ny, nx));
      }
      if (G.U.dist2(L.x, L.y, L.tx, L.ty) < C.goalR * C.goalR) return rescued();
    }
    L.anim.loop(L.moving ? 'Walk' : 'Idle');

    // Enemies touching it damage it.
    if ((L.hitCd -= dt) <= 0) {
      const hits = G.EnemyMgr.queryCircle(L.x, L.y, L.r).filter(e => !e.dead && e.behavior !== 'thief');
      if (hits.length) {
        L.hitCd = C.hitCd;
        L.hp -= Math.min(
          C.hitCap,
          hits.reduce((a, e) => a + C.hitBase + e.dmg * C.hitDmgMul, 0)
        );
        L.flash = 0.1;
        G.FX.burst(L.x, L.y - 10, '#ff5f6d', 4, 60);
        if (L.hp <= 0) return gone(`${L.name} got scared and ran away…!`);
      }
    }
    if (L.flash > 0) L.flash -= dt;
    if (L.t > C.time) return gone(`${L.name} got tired of waiting and left…`);

    if (G.Coop.isHost && (L.netT -= dt) <= 0) {
      L.netT = 0.1;
      G.Coop.broadcast([
        'ev',
        'lp',
        L.dex,
        Math.round(L.x),
        Math.round(L.y),
        Math.round(L.hp),
        L.state === 'follow' ? 1 : 0,
        Math.round(L.tx),
        Math.round(L.ty),
        L.anim.dir,
        L.moving ? 1 : 0
      ]);
    }
  }

  function rescued() {
    const L = lost;
    // (Where each coin lands is cosmetic.)
    for (let i = 0; i < B.lost.coins; i++) G.Pickups.drop('coin', L.tx + G.U.rand(-40, 40), L.ty + G.U.rand(-30, 30), B.lost.coinValue);
    G.Pickups.drop('ticket', L.tx, L.ty - 12, B.lost.tickets);
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'rw', L.dex, L.grant ? 1 : 0]);
    reward(L.dex, L.grant);
    lost = null;
    end();
  }

  /** On each computer: heal and, if it rolled so, the Pokémon joins your collection. */
  function reward(dex, grant) {
    const pl = G.Game.player;
    if (pl && !pl.dead) {
      pl.heal(pl.maxHp * B.lost.heal);
      G.FX.ring(pl.x, pl.y, 6, 70, '#5fe08a', 0.5, 3);
    }
    const name = (G.DEX_BY[dex] || {}).name || '';
    G.FX.burst(lost ? lost.tx : pl.x, lost ? lost.ty - 10 : pl.y, '#7dffb0', 24, 180);
    G.Audio.sfx('legend');
    if (grant && G.onRescue) G.onRescue(dex, name);
    else say(`You brought ${name} home! It thanks you`, 3.2, '#7dffb0');
  }

  function gone(msg) {
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'lx', msg]);
    say(msg, 3);
    lost = null;
    end();
  }

  // ---------------- network ----------------

  G.Sync.on('ev', ev => onNet(ev));
  function onNet(ev) {
    switch (ev[1]) {
      case 's':
        cur = { id: ev[2], t: 0, dur: ev[2] === 'lost' ? Infinity : B[ev[2]].dur, type: ev[3] || null };
        break;
      case 'e':
        cur = null;
        break;
      case 'lp': {
        const [, , dex, x, y, hp, follow, tx, ty, dir, moving] = ev;
        if (!lost || lost.dex !== dex) makeLost({ dex, x, y, tx, ty, hp, state: follow ? 'follow' : 'wait' });
        Object.assign(lost, { x, y, hp, tx, ty, moving: !!moving, state: follow ? 'follow' : 'wait' });
        lost.anim.dir = dir;
        break;
      }
      case 'rw':
        reward(ev[2], !!ev[3]);
        lost = null;
        break;
      case 'lx':
        say(ev[2], 3);
        lost = null;
        break;
    }
  }

  // ---------------- drawing ----------------

  /** The lost Pokémon and the marker, so they are Y-sorted with the rest. */
  function drawables() {
    if (!lost) return [];
    const L = lost;
    const now = performance.now() / 1000;
    const goal = {
      y: L.ty - 4000, // on the ground, below everything
      draw(ctx) {
        const k = 0.5 + Math.sin(now * 4) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.15;
        ctx.fillStyle = '#5fe08a';
        ctx.beginPath();
        ctx.ellipse(L.tx, L.ty, B.lost.goalR, B.lost.goalR * (40 / 56), 0, 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#7dffb0';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(L.tx, L.ty, B.lost.goalR, B.lost.goalR * (40 / 56), 0, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
        G.Icons.draw(ctx, 'heart', Math.round(L.tx - 8), Math.round(L.ty - 30 - k * 6), 16);
      }
    };
    const mon = {
      y: L.y,
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#7dffb0';
        ctx.beginPath();
        ctx.ellipse(L.x, L.y, L.r * 1.5, L.r * 0.6, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        G.Sprites.drawShadow(ctx, L.dex, L.x, L.y, 1);
        L.anim.draw(ctx, L.x, L.y, { flash: L.flash > 0 });
        const h = G.Sprites.bodyHeight(L.dex, 1);
        if (L.state === 'wait') {
          // Bouncing "!" above it: it is waiting for you to touch it.
          const by = L.y - h - 14 - Math.abs(Math.sin(now * 5)) * 6;
          ctx.save();
          ctx.font = '700 16px Pixelify, monospace';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#000';
          ctx.strokeText('!', L.x, by);
          ctx.fillStyle = '#7dffb0';
          ctx.fillText('!', L.x, by);
          ctx.restore();
        }
        const w = 30,
          y = L.y - h - 6;
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(L.x - w / 2, y, w, 3.4);
        ctx.fillStyle = '#5fe08a';
        ctx.fillRect(L.x - w / 2, y, w * Math.max(0, L.hp / L.maxHp), 3.4);
      }
    };
    return [goal, mon];
  }

  /** Edge arrow toward the lost Pokémon (or toward the marker, once it follows you). */
  function drawHud(ctx, w, h, pl, F) {
    const cam = G.Camera;
    if (lost) {
      const L = lost,
        to = L.state === 'wait' ? [L.x, L.y - 10] : [L.tx, L.ty];
      edgeArrow(
        ctx,
        w,
        h,
        cam,
        to[0],
        to[1],
        '#7dffb0',
        `${L.state === 'wait' ? L.name : 'Marker'} · ${Math.round(G.U.dist(pl.x, pl.y, to[0], to[1]) / 32)} m`
      );
    }
    for (const e of G.EnemyMgr.all()) {
      if (e.behavior === 'thief' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#ffd23f', e.name);
    }
    if (cur && cur.id !== 'lost') {
      const left = Math.max(0, Math.ceil(cur.dur - cur.t));
      const txt = cur.id === 'gold' ? `GOLDEN HOUR · ${left} s` : `${G.U.TYPE_NAME[cur.type].toUpperCase()} HORDE · ${left} s`;
      ctx.save();
      ctx.font = F(800, 12);
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(txt, w / 2, 112);
      ctx.fillStyle = cur.id === 'gold' ? '#ffd23f' : G.U.TYPE_COLOR[cur.type] || '#fff';
      ctx.fillText(txt, w / 2, 112);
      ctx.restore();
    }
  }

  function edgeArrow(ctx, w, h, cam, x, y, col, label) {
    G.HUD.edgeArrow(ctx, w, h, (x - cam.left()) * cam.scale, (y - cam.top()) * cam.scale, {
      color: col,
      label,
      outline: '#000',
      alpha: 0.65 + Math.sin(performance.now() / 160) * 0.35
    });
  }

  return {
    reset,
    update,
    bag,
    onNet,
    drawables,
    drawHud,
    get golden() {
      return !!cur && cur.id === 'gold';
    },
    get current() {
      return cur ? cur.id : null;
    },
    /** For tests. */
    debugStart(id) {
      start(id, G.Game.st.time, G.Game.everyone());
    },
    debugThief() {
      spawnThief(G.Game.everyone(), G.Game.st.time);
    },
    _dbg() {
      return lost && { x: lost.x, y: lost.y, tx: lost.tx, ty: lost.ty, state: lost.state, hp: lost.hp };
    }
  };
})();
