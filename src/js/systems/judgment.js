/* ============ judgment.js — Arceus's Judgment (minute 30) ============
 *
 * At minute 30 the "normal" run ends (like Death in
 * Vampire Survivors):
 *
 *   1. Cutscene: the screen darkens, "THE JUDGMENT OF ARCEUS" appears
 *      with its golden wheel, a flash and a trip to a huge, ravaged arena
 *      (Ruins of Judgment). Arceus descends from the sky through a pillar of light and lands
 *      with a shockwave. The first time it plays in full; afterwards it can be
 *      skipped (in co-op only by the host).
 *   2. Fight: Arceus is INVINCIBLE (it is not an enemy: attacks don't
 *      target it). It chases you ever faster; touching it takes 40% of your
 *      max HP, and it casts Judgment (pillars of light), cross beams and waves, all
 *      telegraphed on the ground. That damage ignores types and defense.
 *   3. Every 5 s a random legendary shows up, each with DOUBLE the HP and
 *      damage of the previous one. The first one is based on the damage you dealt before the
 *      Judgment to ONE enemy (about 3 s), so it doesn't fall instantly.
 *      They give experience, but nothing else (no coins, tickets or items).
 *   4. No time limit: however strong you are (uncapped healing,
 *      defense...), the legendaries piling up, each twice as
 *      strong, will finish you (the 8th already hits 128 times harder than the 1st).
 *
 * While it lasts nothing else spawns (no waves, events or rifts; from
 * 28:00 rifts no longer open). If at 30:00 you are in a rift or
 * picking a card, it starts when that ends.
 *
 * Co-op: the host decides. Messages (see coop.js):
 *   'jd' cfg (start) · 'jk' (skip the cutscene)
 *   and in every host update, ja: Arceus's [x, y, animation, direction].
 */
G.Judgment = (() => {
  const B = G.Balance.judgment;
  const R = G.RNG.stream('judgment');
  const ARCEUS = 493;
  // Cutscene timeline (seconds).
  const T_TITLE = 1.3,
    T_FLASH = 4.7,
    T_PORT = 5.1,
    T_DESC = 5.7,
    T_LAND = 7.9,
    T_BACK = 9.1,
    T_END = 10.1;
  const GOLD = '#ffd25e';
  const authority = () => !G.Coop.active || G.Coop.isHost;

  let phase = null; // null | 'cine' | 'fight'
  let ct = 0; // cutscene clock
  let cfg = null; // { tx, ty, q: [legendaries' dex] }
  let ported = false,
    landed = false,
    canSkip = false;
  let A = null; // Arceus
  let center = null; // arena center (world)
  let arenaT = 0,
    bossT = 0,
    bossN = 0,
    base = 0,
    downs = 0;
  // Damage to a single enemy per second (the one taking the most each second; with
  // area attacks, summing everything would give huge HP). The last
  // B.dpsWindow s are kept and the average of the best B.dpsTop is used.
  let hits = new Map(),
    hitT = 0,
    samples = [];
  let embers = [];
  let cineAnim = null;

  function reset() {
    phase = null;
    ct = 0;
    cfg = null;
    ported = landed = canSkip = false;
    A = null;
    center = null;
    arenaT = bossT = 0;
    bossN = 0;
    base = 0;
    downs = 0;
    hits = new Map();
    hitT = 0;
    samples = [];
    embers = [];
    cam = null;
  }

  /** Damage dealt to an enemy (called by Enemy.hurt on the authority). */
  function noteDmg(d, e) {
    if (!phase) hits.set(e.id, (hits.get(e.id) || 0) + d);
  }

  function sampleDps(dt) {
    hitT += dt;
    if (hitT < 1) return;
    let best = 0;
    for (const v of hits.values()) if (v > best) best = v;
    samples.push(best / hitT);
    if (samples.length > B.dpsWindow) samples.shift();
    hits.clear();
    hitT = 0;
  }
  function singleDps() {
    const top = samples
      .slice()
      .sort((a, b) => b - a)
      .slice(0, B.dpsTop);
    return top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0;
  }

  // ---------------- start ----------------

  /** Authority: picks the arena and the legendaries, and tells everyone. */
  function start() {
    const pool = G.DEX.filter(p => p.leg && p.dex !== ARCEUS && G.SPRITE_META[p.dex]);
    const q = [];
    for (let i = 0; i < B.queue; i++) q.push(R.pick(pool).dex);
    const c = { tx: -6000 - Math.floor(R.next() * 2000), ty: -6000 - Math.floor(R.next() * 2000), q };
    if (G.Coop.isHost) G.Coop.broadcast(['jd', c]);
    begin(c);
  }

  /** On each computer: start the cutscene. */
  function begin(c) {
    if (phase) return;
    cfg = c;
    phase = 'cine';
    ct = 0;
    const s = G.DB.save;
    // The first time it plays in full; in a group the host skips it.
    canSkip = !!(s && s.stats && s.stats.judged > 0) && authority();
    G.Sprites.preload([ARCEUS, ...new Set(c.q.slice(0, 12))], 12000);
    cineAnim = new G.Sprites.Animator(ARCEUS, 1);
    G.Touch.reset();
    G.Audio.music(null);
  }

  /** Skip the cutscene (key or tap; in a group, the host). */
  function skip() {
    if (phase !== 'cine' || !canSkip || ct >= T_BACK) return;
    if (G.Coop.isHost) G.Coop.broadcast(['jk']);
    doSkip();
  }
  function doSkip() {
    if (phase !== 'cine') return;
    if (!ported) port();
    land(true);
    ct = T_BACK;
  }

  /** Trip to the arena (mid-cutscene, hidden by the flash). */
  function port() {
    ported = true;
    const pl = G.Game.player,
      ts = G.World.TS;
    G.Rift.reset();
    if (authority()) G.EnemyMgr.stash();
    else G.EnemyMgr.clearRemote();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.Pickups.clear();
    G.Events.reset();
    G.Weather.clear();
    G.World.setArena({ tx: cfg.tx, ty: cfg.ty, r: B.arenaR, type: 'judgment' });
    G.World.setBiome(G.Tiles.arenaBiome('judgment'), true);
    center = { x: cfg.tx * ts + ts / 2, y: cfg.ty * ts + ts / 2 };
    G.Rift.lineUp(center.x, center.y);
    G.Camera.x = pl.x;
    G.Camera.y = pl.y;
    const scale = B.arceus.scale;
    const anim = new G.Sprites.Animator(ARCEUS, scale);
    A = {
      x: center.x,
      y: center.y - ts * B.arceus.startNorth,
      lift: 900,
      anim,
      r: G.Sprites.bodyRadius(ARCEUS, scale) * 0.9,
      bodyH: G.Sprites.bodyHeight(ARCEUS, scale),
      cd: B.arceus.firstCd,
      cast: null,
      touchCd: 0,
      spin: 0,
      net: null,
      glow: 0
    };
    anim.dir = 0;
  }

  /** Arceus touches the ground. */
  function land(quiet = false) {
    if (landed || !A) return;
    landed = true;
    A.lift = 0;
    A.anim.play('Attack', { speed: 0.8 });
    if (quiet) return;
    G.Camera.kick(1.2);
    G.Game.flash('#fff3c8', 0.7);
    G.Audio.sfx('land');
    for (let i = 0; i < 4; i++) G.FX.ring(A.x, A.y, 10 + i * 20, 260 + i * 140, i % 2 ? '#fff3c8' : GOLD, 0.5 + i * 0.25, 8 - i);
    G.FX.burst(A.x, A.y - 20, GOLD, 60, 360);
    G.FX.burst(A.x, A.y - 10, '#ffffff', 30, 240);
  }

  /** End of the cutscene: the fight begins. */
  function fight() {
    phase = 'fight';
    if (!ported) port();
    land(true);
    arenaT = 0;
    bossT = B.firstBoss;
    bossN = 0;
    downs = 0;
    G.Progress.event('judge');
    // First legendary's HP: a few seconds of your damage to one enemy (with a minimum).
    const n = G.Game.everyone().length,
      t = G.Game.st.time;
    const floor = G.Balance.rift.legend.hp(t) * B.floorFrac * G.Coop.scaleHp(n);
    base = Math.max(floor, singleDps() * B.firstSecs);
    G.Spawner.say('Run from Arceus! It is invincible', 3, true);
  }

  // ---------------- every frame ----------------

  /** During the cutscene (the rest of the game is paused). */
  function cineTick(dt) {
    const prev = ct;
    ct += dt;
    const at = x => prev < x && ct >= x;
    const pl = G.Game.player;
    if (cineAnim) cineAnim.update(dt);
    if (at(0.01)) {
      G.Audio.sfx('quake');
      G.Camera.kick(0.9);
    }
    if (ct < T_FLASH && Math.random() < dt * 3) G.Camera.kick(0.15);
    if (at(T_TITLE)) G.Audio.sfx('toll');
    if (at(T_TITLE + 1.7)) G.Audio.sfx('toll');
    if (at(T_FLASH)) G.Game.flash('#ffffff', 0.9);
    if (at(T_PORT) && !ported) port();
    if (at(T_DESC)) G.Audio.sfx('descend');
    if (A && !landed) {
      // Descent: slow at first and braking at the end (as if settling down).
      const k = G.U.clamp((ct - T_DESC) / (T_LAND - T_DESC), 0, 1);
      A.lift = 900 * Math.pow(1 - k, 2.2);
      A.anim.loop('Idle');
      if (ct > T_DESC && Math.random() < dt * 30)
        G.FX.px(A.x + G.U.rand(-60, 60), A.y - A.lift - G.U.rand(0, 200), Math.random() < 0.5 ? GOLD : '#fff3c8', {
          vy: G.U.rand(60, 160),
          life: 0.9
        });
      if (at(T_LAND)) land();
    }
    if (A) {
      A.anim.update(dt);
      A.spin += dt;
    }
    // Camera: your Pokémon; slowly pans up to Arceus while it descends, then back.
    let tx = pl.x,
      ty = pl.y;
    if (ported && A && ct < T_BACK) {
      tx = A.x;
      ty = A.y - 60;
    }
    if (!cam || at(T_PORT) || (ported && !cam.ported)) cam = { x: G.Camera.x, y: G.Camera.y, ported };
    cam.x = G.U.damp(cam.x, tx, 2.2, dt);
    cam.y = G.U.damp(cam.y, ty, 2.2, dt);
    G.Camera.follow(cam.x, cam.y, dt);
    if (ct >= T_END) {
      cam = null;
      fight();
    }
  }
  let cam = null;

  /** During the fight (called by game.js every game frame). */
  function update(dt, pl, time) {
    if (!phase) {
      sampleDps(dt); // (for the first legendary's HP)
      if (authority() && time >= B.at && !G.Rift.inArena) start();
      return;
    }
    if (phase !== 'fight') return;
    arenaT += dt;
    A.touchCd -= dt;
    A.spin += dt;
    if (authority()) {
      arceusTick(dt);
      keepInside();
      bossT -= dt;
      if (bossT <= 0) {
        bossT = B.bossEvery;
        spawnBoss();
      }
    } else netTick(dt);
    A.anim.update(dt);
    touch(pl);
    ember(dt);
  }

  // ---------------- Arceus ----------------

  function target() {
    let best = null,
      bd = Infinity;
    for (const p of G.Game.everyone()) {
      if (p.dead) continue;
      const d = G.U.dist2(p.x, p.y, A.x, A.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  function arceusTick(dt) {
    const tg = target();
    if (A.cast) {
      castTick(dt, tg);
      return;
    }
    if (!tg) {
      A.anim.loop('Idle');
      return;
    }
    // Slower than you at first; after ~35 s it catches up.
    const k = B.arceus.spd(arenaT);
    const spd = Math.max(B.arceus.minSpd, (tg.spd || 100) * k);
    const [dx, dy] = G.U.norm(tg.x - A.x, tg.y - A.y);
    A.x += dx * spd * dt;
    A.y += dy * spd * dt;
    A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
    A.anim.loop('Walk', Math.max(0.8, spd / 90));
    if (Math.random() < dt * 14) G.FX.px(A.x + G.U.rand(-20, 20), A.y - G.U.rand(0, A.bodyH), GOLD, { vy: -30, life: 0.6 });
    A.cd -= dt;
    if (A.cd <= 0) {
      const d = G.U.dist(A.x, A.y, tg.x, tg.y);
      const id = d < B.nova.near && R.chance(B.nova.chance) ? 'nova' : A.last === 'rain' ? 'cross' : 'rain';
      cast(id, tg);
    }
  }

  /** Arceus's attacks: all are telegraphed on the ground and take a % of max HP. */
  function cast(id, tg) {
    A.last = id;
    const c = (A.cast = { id, t: 0, wind: B[id].wind });
    const H = o => G.Hazards.add(Object.assign({ type: null, pure: true, dmg: 1, color: GOLD }, o));
    if (id === 'rain') {
      // Judgment: pillars of light on everyone (more the longer it lasts).
      const S = B.rain;
      const n = S.n(arenaT);
      for (const p of G.Game.everyone()) {
        if (p.dead) continue;
        for (let i = 0; i < n; i++) {
          const a = R.angle(),
            d = i ? R.range(S.spread[0], S.spread[1]) : 0;
          H({
            kind: 'zone',
            x: p.x + Math.cos(a) * d,
            y: p.y + Math.sin(a) * d * 0.8,
            r: S.r,
            delay: S.delay + i * S.stagger,
            pct: S.pct,
            vis: 'pillar'
          });
        }
      }
      A.anim.play('Shoot', { speed: 0.9 });
    } else if (id === 'cross') {
      // Cross beams sweeping the arena.
      const S = B.cross;
      const a0 = Math.atan2(tg.y - A.y, tg.x - A.x) + (R.chance(S.tilt) ? Math.PI / 4 : 0);
      const n = S.n(arenaT);
      for (let i = 0; i < n; i++)
        H({ kind: 'beam', x: A.x, y: A.y, angle: a0 + (i * 6.2832) / n, len: S.len, w: S.w, delay: S.delay, pct: S.pct, color: '#fff3b0' });
      A.anim.play('Charge', { speed: 0.9 });
    } else {
      // Wave around it (if you're too close).
      const S = B.nova;
      H({ kind: 'zone', x: A.x, y: A.y, r: S.r, delay: S.delay, pct: S.pct });
      A.anim.play('Charge', { speed: 1.2 });
    }
    G.FX.ring(A.x, A.y, A.r, A.r * 3, GOLD, c.wind, 3);
  }

  function castTick(dt, tg) {
    const c = A.cast;
    c.t += dt;
    if (tg) A.anim.dir = G.Sprites.dirFromAngle(Math.atan2(tg.y - A.y, tg.x - A.x));
    if (c.t >= c.wind && !c.done) {
      c.done = true;
      A.anim.play(c.id === 'nova' ? 'Attack' : 'Shoot', { speed: 1.2 });
    }
    if (c.t >= c.wind + B.arceus.recover) {
      A.cast = null;
      A.cd = B.arceus.cd(arenaT);
    }
  }

  /** Guest: Arceus goes where the host says. */
  function netTick(dt) {
    const n = A.net;
    if (!n) return;
    const ox = A.x,
      oy = A.y;
    if (G.U.dist2(A.x, A.y, n.x, n.y) > 300 * 300) {
      A.x = n.x;
      A.y = n.y;
    } else {
      A.x = G.U.damp(A.x, n.x, 10, dt);
      A.y = G.U.damp(A.y, n.y, 10, dt);
    }
    A.anim.dir = n.dir;
    if (n.anim !== A.lastNetAnim) {
      A.lastNetAnim = n.anim;
      const a = G.Coop.ANIMS[n.anim];
      if (a === 'Charge' || a === 'Shoot' || a === 'Attack') A.anim.play(a);
    }
    A.anim.loop(Math.abs(A.x - ox) + Math.abs(A.y - oy) > 0.5 ? 'Walk' : 'Idle');
  }

  /** Touching Arceus (each player checks their own). */
  function touch(pl) {
    if (!pl || pl.dead || A.touchCd > 0) return;
    const rr = A.r + pl.r;
    if (G.U.dist2(A.x, A.y, pl.x, pl.y) > rr * rr) return;
    A.touchCd = B.arceus.touchCd;
    pl.invuln = 0;
    pl.hurt(pl.maxHp * B.arceus.touch, null, true);
    G.Camera.kick(0.6);
    G.FX.ring(pl.x, pl.y, 6, 70, GOLD, 0.4, 4);
    if (authority()) A.anim.play('Attack', { speed: 1.4 });
  }

  /** Nobody leaves the arena (Arceus, the legendaries and you). */
  function keepInside() {
    G.Rift.keepIn(A, center.x, center.y, B.arenaR);
    for (const e of G.EnemyMgr.all()) if (!e.remote) G.Rift.keepIn(e, center.x, center.y, B.arenaR);
  }

  // ---------------- legendaries ----------------

  function spawnBoss() {
    const dex = cfg.q[bossN % cfg.q.length];
    const mon = G.DEX_BY[dex];
    if (!mon) return;
    const t = G.Game.st.time,
      ts = G.World.TS;
    // Far from everyone (at the edge of the arena).
    let x = center.x,
      y = center.y;
    for (let i = 0; i < 16; i++) {
      const a = R.angle(),
        d = (B.arenaR - R.range(B.bossEdge[0], B.bossEdge[1])) * ts;
      x = center.x + Math.cos(a) * d;
      y = center.y + Math.sin(a) * d;
      if (G.Game.everyone().every(p => G.U.dist2(p.x, p.y, x, y) > B.bossSafeDist * B.bossSafeDist)) break;
    }
    const k = Math.pow(B.growth, bossN); // each one stronger than the previous
    const def = G.Rift.legendDef(mon, t, base * k, k);
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 }, true);
    e.judge = true;
    e.flying = false;
    G.EnemyMgr.add(e);
    bossN++;
    G.Sprites.preload([cfg.q[(bossN + 4) % cfg.q.length]], 8000);
    G.FX.ring(x, y, 8, 120, GOLD, 0.6, 5);
    G.FX.burst(x, y - 30, '#fff3c8', 24, 200);
    G.Spawner.say(`${e.name} answers the Judgment!`, 1.8);
    G.Audio.sfx('rift');
  }

  /** An arena legendary has fallen (on each computer). */
  function bossDown() {
    if (phase === 'fight') downs++;
  }

  // ---------------- drawing ----------------

  /** Arceus, Y-sorted with the rest of the scene. */
  function drawable() {
    if (!A || !ported) return null;
    return { y: A.y, draw: drawArceus };
  }

  function drawArceus(ctx) {
    const lift = A.lift;
    const now = performance.now() / 1000;
    // Shadow that grows as it descends.
    const near = G.U.clamp(1 - lift / 900, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.15 + near * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(A.x, A.y, 44 * (0.4 + near * 0.6), 16 * (0.4 + near * 0.6), 0, 0, 6.2832);
    ctx.fill();
    // Golden aura on the ground.
    if (lift < 40) {
      ctx.globalAlpha = 0.22 + Math.sin(now * 3) * 0.06;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.ellipse(A.x, A.y, A.r * 2.2, A.r * 0.8, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
    // The golden wheel behind it.
    wheel(ctx, A.x, A.y - lift - A.bodyH * 0.55, A.bodyH * 0.62, A.spin * 0.6, 0.55);
    A.anim.draw(ctx, A.x, A.y - lift);
  }

  /** Arceus's wheel: a spinning golden ring with 12 jewels. */
  function wheel(ctx, x, y, R, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, R * 0.07);
    ctx.shadowColor = '#ffcf4a';
    ctx.shadowBlur = R * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, 6.2832);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, R * 0.025);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.82, 0, 6.2832);
    ctx.stroke();
    const GEMS = ['#ff6b4d', '#4fa8ff', '#5fe08a', '#ffe14d', '#b37bff', '#c9d2de'];
    for (let i = 0; i < 12; i++) {
      const a = (i * 6.2832) / 12;
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = GEMS[i % GEMS.length];
      ctx.beginPath();
      ctx.moveTo(R * 1.02, 0);
      ctx.lineTo(R * 0.91, -R * 0.07);
      ctx.lineTo(R * 0.8, 0);
      ctx.lineTo(R * 0.91, R * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Above everything (in the world): the pillar of light it descends through. */
  function drawAir(ctx) {
    if (!A || !ported) return;
    const cam = G.Camera;
    let a = 0;
    if (phase === 'cine') a = G.U.clamp((ct - T_PORT) / 0.6, 0, 1) * G.U.clamp((T_LAND + 0.6 - ct) / 0.6, 0, 1);
    if (a <= 0) return;
    const top = cam.top() - 40,
      bot = A.y + 6;
    const near = G.U.clamp(1 - A.lift / 900, 0, 1);
    const w = 40 + near * 40 + Math.sin(ct * 9) * 6;
    ctx.save();
    const g = ctx.createLinearGradient(A.x - w, 0, A.x + w, 0);
    g.addColorStop(0, 'rgba(255,210,94,0)');
    g.addColorStop(0.5, 'rgba(255,248,220,0.7)');
    g.addColorStop(1, 'rgba(255,210,94,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(A.x - w, top, w * 2, Math.max(0, bot - top));
    // Glow on the ground where it will land.
    ctx.globalAlpha = a * (0.35 + near * 0.55);
    ctx.translate(A.x, A.y);
    ctx.scale(1, 0.36);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.5);
    rg.addColorStop(0, 'rgba(255,243,200,0.9)');
    rg.addColorStop(0.5, 'rgba(255,210,94,0.35)');
    rg.addColorStop(1, 'rgba(255,210,94,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, w * 1.5, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  const F = (wt, s) => `${wt} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  /** On screen: the cutscene, or the fight overlay. */
  function drawOverlay(ctx, w, h) {
    if (phase === 'cine') drawCine(ctx, w, h);
    else if (phase === 'fight') drawFight(ctx, w, h);
  }

  function drawCine(ctx, w, h) {
    const t = ct;
    G.Touch.clearButtons(); // (the HUD isn't drawn during the cutscene)
    ctx.save();
    // Everything darkens (until the trip).
    if (t < T_PORT + 0.1) {
      ctx.fillStyle = `rgba(10,6,2,${(G.U.clamp(t / 1.1, 0, 1) * 0.86).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    // "THE JUDGMENT OF ARCEUS"
    const a = G.U.clamp((t - T_TITLE + 0.3) / 0.5, 0, 1) * G.U.clamp((T_FLASH + 0.2 - t) / 0.35, 0, 1);
    if (a > 0) {
      const cx = w / 2,
        cy = h * 0.34,
        R = Math.min(w, h) * 0.24;
      // Spinning rays of light.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.18);
      ctx.globalAlpha = a * 0.35;
      for (let i = 0; i < 16; i++) {
        ctx.rotate(6.2832 / 16);
        const g = ctx.createLinearGradient(0, 0, Math.max(w, h), 0);
        g.addColorStop(0, 'rgba(255,214,110,0.9)');
        g.addColorStop(1, 'rgba(255,214,110,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(w, h), -R * 0.16);
        ctx.lineTo(Math.max(w, h), R * 0.16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // Arceus as a silhouette of light, behind its wheel.
      wheel(ctx, cx, cy - R * 0.05, R, t * 0.35, a * 0.9);
      const idle = G.Sprites.sheet(ARCEUS, 'Idle');
      if (cineAnim && idle && idle.ready) {
        // Light silhouette filling the wheel (in multiples of 0.5: whole pixels).
        const body = (G.Sprites.animMeta(ARCEUS, 'Idle').ay || 47) * G.Sprites.PX;
        cineAnim.scale = Math.max(1, Math.round(((R * 1.7) / body) * 2) / 2);
        const rise = (1 - G.U.clamp((t - T_TITLE + 0.3) / 0.8, 0, 1)) * R * 0.3;
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.shadowColor = '#ffcf4a';
        ctx.shadowBlur = 40;
        cineAnim.draw(ctx, cx, cy + body * cineAnim.scale * 0.5 + rise, { flash: true });
        ctx.restore();
      }
      // The title, letter by letter, below the wheel.
      const size = Math.round(G.U.clamp(Math.min(w / 13, h / 9), 24, 64));
      const ty = cy + R + size * 1.15;
      title(ctx, 'THE JUDGMENT', cx, ty, size, T_TITLE, a);
      title(ctx, 'OF ARCEUS', cx, ty + size * 0.95, Math.round(size * 0.8), T_TITLE + 0.75, a);
      ctx.globalAlpha = a * G.U.clamp((t - T_TITLE - 1.6) / 0.6, 0, 1);
      ctx.font = F(700, Math.round(size * 0.32));
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f3e2b0';
      ctx.fillText('Time has run out…', cx, ty + size * 1.7);
    }
    // Black cinema bars during the descent.
    if (t > T_PORT) {
      const k = G.U.clamp((t - T_PORT) / 0.5, 0, 1) * G.U.clamp((T_END - t) / 0.6, 0, 1);
      const bh = Math.round(h * 0.11 * k);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, bh);
      ctx.fillRect(0, h - bh, w, bh);
    }
    // It has descended!
    const b = G.U.clamp((t - T_LAND - 0.15) / 0.3, 0, 1) * G.U.clamp((T_END - t) / 0.5, 0, 1);
    if (b > 0) {
      const size = Math.round(G.U.clamp(w / 20, 20, 40));
      const pop = 1 + (1 - G.U.clamp((t - T_LAND - 0.15) / 0.25, 0, 1)) * 0.6;
      ctx.save();
      ctx.globalAlpha = b;
      ctx.translate(w / 2, h * 0.24);
      ctx.scale(pop, pop);
      goldText(ctx, 'ARCEUS HAS DESCENDED!', 0, 0, size);
      ctx.restore();
      ctx.globalAlpha = b;
      ctx.font = F(700, Math.round(size * 0.45));
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const sub = 'It is invincible: run and survive as long as you can';
      ctx.strokeText(sub, w / 2, h * 0.24 + size * 1.1);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(sub, w / 2, h * 0.24 + size * 1.1);
    }
    if (canSkip && t < T_BACK) {
      ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.2;
      ctx.font = F(700, 11);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f3e2b0';
      ctx.fillText(G.Touch.active ? 'Tap the screen to skip' : 'Press Space to skip', w - 16, h - 14);
      // The whole screen is a button (mobile and mouse).
      G.Touch.addButton(0, 0, w, h, skip, 0);
    }
    ctx.restore();
  }

  /** Golden text with outline and glow. */
  function goldText(ctx, s, x, y, size) {
    ctx.font = F(800, size);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.16);
    ctx.strokeStyle = '#2a1500';
    ctx.strokeText(s, x, y);
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
    g.addColorStop(0, '#fff8d8');
    g.addColorStop(0.5, '#ffd25e');
    g.addColorStop(1, '#c7771a');
    ctx.shadowColor = '#ffcf4a';
    ctx.shadowBlur = size * 0.4;
    ctx.fillStyle = g;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = 0;
  }

  /** Title that appears letter by letter (each one drops and settles). */
  function title(ctx, raw, cx, y, size, t0, alpha) {
    const s = G.I18n ? G.I18n.t(raw) : raw;
    ctx.save();
    ctx.font = F(800, size);
    const total = ctx.measureText(s).width;
    let x = cx - total / 2;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const cw = ctx.measureText(ch).width;
      const p = G.U.clamp((ct - t0 - i * 0.055) / 0.28, 0, 1);
      if (p > 0 && ch !== ' ') {
        const k = 1 + (1 - p) * 1.8;
        ctx.save();
        ctx.globalAlpha = alpha * p;
        ctx.translate(x + cw / 2, y);
        ctx.scale(k, k);
        goldText(ctx, ch, 0, 0, size);
        ctx.restore();
      }
      ctx.font = F(800, size);
      x += cw;
    }
    ctx.restore();
  }

  /** Fight: reddish sky, ash, arrow to Arceus and the counter. */
  function drawFight(ctx, w, h) {
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(120,40,10,0)');
    g.addColorStop(1, 'rgba(120,40,10,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (const e of embers) {
      ctx.globalAlpha = Math.min(1, e.life) * e.a;
      ctx.fillStyle = e.c;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.s, e.s);
    }
    ctx.globalAlpha = 1;
    // Counter below the clock.
    const boss = G.EnemyMgr.all().some(e => e.boss && !e.dead);
    ctx.textAlign = 'center';
    ctx.font = F(800, 12);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const txt = `JUDGMENT · ${G.U.mmss(arenaT)} · BOSSES ${downs}`;
    ctx.strokeText(txt, w / 2, boss ? 98 : 76);
    ctx.fillStyle = GOLD;
    ctx.fillText(txt, w / 2, boss ? 98 : 76);
    // Arrow toward Arceus if it's off screen.
    const cam = G.Camera,
      pl = G.Game.player;
    const beat = 0.5 + Math.sin(performance.now() / 120) * 0.5;
    G.HUD.edgeArrow(ctx, w, h, (A.x - cam.left()) * cam.scale, (A.y - A.bodyH * 0.5 - cam.top()) * cam.scale, {
      margin: 46,
      tip: 34,
      base: 17,
      halo: { color: '#ff6a3d', r: 26 + beat * 6, a: 0.2 + beat * 0.25 },
      color: beat > 0.5 ? '#fff3c8' : GOLD,
      label: `ARCEUS · ${Math.round(G.U.dist(pl.x, pl.y, A.x, A.y) / 32)} m`,
      labelColor: GOLD,
      labelAt: [30, 26]
    });
    ctx.restore();
  }

  /** Falling ash and sparks (screen space). */
  function ember(dt) {
    const cv = document.getElementById('game');
    const w = cv ? cv.clientWidth : 800,
      h = cv ? cv.clientHeight : 600;
    if (embers.length < 70 && Math.random() < dt * 40) {
      const spark = Math.random() < 0.3;
      embers.push({
        x: Math.random() * w,
        y: -6,
        vx: G.U.rand(-25, 10),
        vy: G.U.rand(20, 55),
        life: G.U.rand(5, 10),
        s: spark ? 2 : 3,
        a: spark ? 0.9 : 0.45,
        c: spark ? '#ffb347' : '#8a8078'
      });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.life <= 0 || e.y > h + 10) embers.splice(i, 1);
    }
  }

  // ---------------- network ----------------

  G.Sync.on(['jd', 'jk'], ev => onEvent(ev));
  // Arceus' position and animation, in every host frame during the fight.
  G.Sync.field('ja', { send: () => netState(), apply: a => netApply(a) });
  function onEvent(ev) {
    if (ev[0] === 'jd') begin(ev[1]);
    else if (ev[0] === 'jk') doSkip();
  }

  /** Host: where Arceus is (sent in every update). */
  function netState() {
    if (phase !== 'fight' || !A) return null;
    const a = G.Coop.ANIMS.indexOf(A.anim.cur);
    return [Math.round(A.x), Math.round(A.y), a < 0 ? 0 : a, A.anim.dir];
  }
  function netApply(a) {
    if (!A || phase !== 'fight') return;
    A.net = { x: a[0], y: a[1], anim: a[2], dir: a[3] };
  }

  return {
    /** Run time when it starts (s). */
    get AT() {
      return B.at;
    },
    reset,
    noteDmg,
    update,
    cineTick,
    skip,
    bossDown,
    drawable,
    drawAir,
    drawOverlay,
    onEvent,
    netState,
    netApply,
    get active() {
      return !!phase;
    },
    get cinematic() {
      return phase === 'cine';
    },
    /** What plays: nothing in the cutscene until it lands. */
    get music() {
      return phase === 'cine' && ct < T_LAND ? null : 'judgment';
    },
    /** For the run summary: { time, bosses } or null. */
    summary() {
      return phase === 'fight' ? { time: arenaT, bosses: downs } : null;
    },
    /** For tests: first legendary's HP and measured damage. */
    get debug() {
      return { base, single: singleDps(), samples: samples.length };
    },
    /** For tests: Judgment right now. */
    debugStart() {
      if (!phase && authority()) start();
    }
  };
})();
