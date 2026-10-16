/* ============ coop.js — co-op run (up to 4 players) ============
 *
 * Who is in charge of what:
 *   HOST        enemies (spawning, AI, health, death), ground items,
 *               team experience and level, clock, end of the run.
 *   EACH PLAYER their own Pokémon: position, health, attacks and what hits it.
 *               Their hits on enemies are sent to the host, who applies them.
 *
 * Guests see COPIES of the host's enemies (enemy.remote) and teammates'
 * attacks as "ghosts" that deal no damage (see combat.js).
 *
 * Who is choosing (item or bond) and who has picked a level card also goes in
 * EVERY message (not just in a one-off notice): if a notice is lost because
 * the connection flickers, the next message fixes it and nobody is left
 * waiting for someone else forever (it happened in 2026-10).
 *
 * Messages (via net.js, about 15 times per second; 5 over the relay):
 *   guest -> host     { k:'f', p:[state], ev:[events] }
 *   host -> guest     { k:'f', t, lv, xp, xn, ki, bo, co, p:{uid:[state]},
 *                       e:[[id,x,y,hp,anim,dir,flags]], ev:[events],
 *                       x:{ key: state } (Sync fields, e.g. ja = Arceus) }
 *   host -> everyone  { k:'start', seed, host, members:[{uid,name,dex,shiny}] }
 *
 * What each event code does is registered with Sync (net/sync.js): the
 * core ones below, the rest next to the logic they belong to (rift.js,
 * weather.js...). Enemy flags (burn, shield...) are Sync.flag entries.
 */
import { U } from '../core/util.js';
import { Sync } from './sync.js';
import { Balance } from '../data/balance.js';
import { DEX_BY } from '../data/pokedex.js';
import { Audio } from '../core/audio.js';
import { Sprites } from '../core/sprites.js';
import { Camera } from '../core/camera.js';
import { startMoveOf } from '../data/starters.js';
import { World } from '../world/world.js';
import { VFX } from '../entities/vfx.js';
import { FX } from '../entities/fx.js';
import { Projectiles } from '../entities/projectile.js';
import { EnemyMgr } from '../entities/enemy.js';
import { Pickups } from '../entities/pickup.js';
import { Player } from '../entities/player.js';
import { Combat } from '../systems/combat.js';
import { Spawner } from '../systems/spawner.js';
import { Social } from './social.js';
import { Net } from './net.js';
import { Flow } from '../game.js';

export const Coop = (() => {
  const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];
  const COLORS = ['#ffcb3d', '#5fc8ff', '#7ee07a', '#ff8ad8'];
  // Messages per second: 15 over the direct connection and 3 over the
  // Realtime Database relay (off: $1 per GB).
  const RATE_FAST = 1 / 15,
    RATE_SLOW = 1 / 3;
  const rateFor = u => (Net.slow(u) ? RATE_SLOW : RATE_FAST);
  const NEAR = 950; // radius of enemies sent to each player

  let active = false,
    host = false,
    me = null,
    hostUid = null;
  let local = null; // your Player
  const mates = new Map(); // uid -> { uid, name, color, pl, connected, q:[], flushT, xpMul }
  let outEv = []; // guest: events for the host
  let flushT = 0;
  let hitFrom = null; // guest whose hit is being applied (don't send the number back to them)
  let api = {}; // game callbacks (game.js)
  let waiting = new Set(); // level-up: who still has to choose
  let holds = new Set(); // who is choosing a fusion (the run pauses for everyone)
  // The host moves the enemies: if they switch tabs (or their tab freezes),
  // everything pauses for everyone. Enemies used to stand still while the
  // others kept playing with a huge advantage.
  let hostAway = false,
    stalled = false,
    lastHostAt = 0;
  // Level cards: round number (host), the last one you received and the last
  // one you picked (guest). And the last "who is choosing" applied.
  let levelSeq = 0,
    levelNow = 1,
    seenSeq = 0,
    doneSeq = 0,
    lastHo = '';
  const STALL_MS = 2500;
  let members = [];

  // ---------------- difficulty scaling ----------------

  // Formulas in Balance.coop (read at call time).
  const scaleRate = n => Balance.coop.scaleRate(n);
  const scaleHp = n => Balance.coop.scaleHp(n);

  // ---------------- start / end ----------------

  /**
   * @param cfg   { seed, host, members }
   * @param pl    your Player (already created)
   * @param cb    { levelStart(lv), resume(), waiting(names), over(data), lost(msg), team(t), shiny(dex) }
   */
  function begin(cfg, pl, cb) {
    active = true;
    me = Net.uid;
    hostUid = cfg.host;
    host = me === hostUid;
    local = pl;
    api = cb;
    members = cfg.members;
    mates.clear();
    outEv = [];
    flushT = 0;
    waiting = new Set();
    holds = new Set();
    hostAway = false;
    stalled = false;
    lastHostAt = performance.now();
    levelSeq = 0;
    levelNow = 1;
    seenSeq = 0;
    doneSeq = 0;
    lastHo = '';
    cfg.members.forEach((m, i) => {
      const x = (i - (cfg.members.length - 1) / 2) * 34,
        y = 0;
      if (m.uid === me) {
        pl.x = x;
        pl.y = y;
        pl.uid = me;
        pl.coopHost = host;
        pl.tagColor = COLORS[i];
        return;
      }
      const mon = DEX_BY[m.dex] || DEX_BY[25];
      const p = new Player(mon, {}, !!m.shiny);
      p.remote = true;
      p.uid = m.uid;
      p.tag = m.name;
      p.tagColor = COLORS[i];
      p.revLabel = 'Stay by their side';
      p.x = x;
      p.y = y;
      p.net = {
        x,
        y,
        ang: Math.PI / 2,
        walk: 0,
        hp: p.maxHp,
        maxHp: p.maxHp,
        dead: 0,
        mv: startMoveOf(mon.dex),
        ml: 1,
        mag: 78,
        aim: Math.PI / 2,
        rev: 0
      };
      Sprites.preload([mon.dex], 8000, p.shiny);
      mates.set(m.uid, { uid: m.uid, name: m.name, color: COLORS[i], pl: p, connected: true, q: [], flushT: 0, xpMul: 1 });
    });
  }

  function end() {
    active = false;
    host = false;
    local = null;
    mates.clear();
    outEv = [];
    waiting = new Set();
    holds = new Set();
  }

  /** You leave the run (the others carry on). */
  function leave() {
    if (!active) return;
    if (host) {
      // If the host leaves, the run ends for everyone.
      emit(['ov', Object.assign(api.summary ? api.summary() : {}, { why: 'host' })]);
      flushAll();
    } else {
      outEv.push(['bye']);
      flushClient(true);
    }
    end();
  }

  // ---------------- player list ----------------

  function players() {
    const out = [local];
    for (const m of mates.values()) if (m.connected) out.push(m.pl);
    return out;
  }
  function puppets() {
    const out = [];
    for (const m of mates.values()) if (m.connected) out.push(m.pl);
    return out;
  }

  /**
   * Team experience multiplier: the average of everyone's bonuses, split
   * among the players (in a group it drops a lot; otherwise you'd level up
   * three times faster than solo).
   */
  function xpFactor() {
    let s = local.xpMul,
      n = 1;
    for (const m of mates.values())
      if (m.connected) {
        s += m.xpMul || 1;
        n++;
      }
    return s / n / local.xpMul / (1 + Balance.coop.xpShare * (n - 1));
  }

  // ---------------- a player's state ----------------

  const r1 = v => Math.round(v),
    r2 = v => Math.round(v * 100) / 100;

  function myState() {
    // With a bond, send the orbit if there is one (it's the only thing the others don't see via the 'c' events).
    const g = local.activeGroup();
    const m = g.find(x => x.kind === 'orbit') || g[0];
    return [
      r1(local.x),
      r1(local.y),
      r2(local.moveAngle),
      local.walking ? 1 : 0,
      r1(local.hp),
      r1(local.maxHp),
      local.dead ? 1 : 0,
      m ? m.id : '',
      m ? m.lvl : 1,
      r1(local.magnet),
      r2(local.aim),
      r2(local.xpMul),
      r2(local.reviveT || 0),
      api.choosing && api.choosing() ? 1 : 0,
      doneSeq
    ];
  }

  function readState(a) {
    return {
      x: a[0],
      y: a[1],
      ang: a[2],
      walk: a[3],
      hp: a[4],
      maxHp: a[5],
      dead: a[6],
      mv: a[7],
      ml: a[8],
      mag: a[9],
      aim: a[10],
      xpMul: a[11],
      rev: a[12],
      ch: a[13],
      ld: a[14]
    };
  }

  // ---------------- sending ----------------

  /** Host: event for all guests (except `except`). */
  function emit(ev, except) {
    if (!host) return;
    for (const m of mates.values()) if (m.connected && m.uid !== except) m.q.push(ev);
  }

  /** Host: event only for those nearby (damage numbers). */
  function emitNear(ev, x, y, except) {
    for (const m of mates.values()) {
      if (!m.connected || m.uid === except) continue;
      if (U.dist2(m.pl.x, m.pl.y, x, y) > 700 * 700) continue;
      if (m.q.length > 400) continue;
      m.q.push(ev);
    }
  }

  /** The Sync enemy flags of `e` packed into one number (bit i = flag i). */
  function flagBits(e) {
    let b = 0;
    Sync.flags.forEach((f, i) => {
      if (f.test(e)) b |= 1 << i;
    });
    return b;
  }

  function enemyList(near) {
    const out = [];
    const r2n = NEAR * NEAR;
    for (const e of EnemyMgr.all()) {
      if (e.dead || U.dist2(e.x, e.y, near.x, near.y) > r2n) continue;
      const a = ANIMS.indexOf(e.anim.cur);
      out.push([e.id, r1(e.x), r1(e.y), Math.ceil(e.hp), a < 0 ? 0 : a, e.anim.dir, flagBits(e)]);
    }
    return out;
  }

  function hostFrame(m) {
    const st = api.team();
    const p = { [me]: myState() };
    for (const o of mates.values()) {
      if (o.connected && o.uid !== m.uid && o.state) p[o.uid] = o.state;
    }
    const ev = m.q;
    m.q = [];
    const f = {
      k: 'f',
      t: r2(st.time),
      lv: st.level,
      xp: r2(st.xp),
      xn: st.xpNext,
      ki: st.kills,
      bo: st.bosses,
      co: st.coins,
      tk: [st.t1, st.t10],
      p,
      e: enemyList(m.pl),
      ev
    };
    // State registered by the modules (Sync.field), only when there is any.
    let x = null;
    for (const [key, d] of Sync.fields) {
      const v = d.send();
      if (v != null) (x = x || {})[key] = v;
    }
    if (x) f.x = x;
    // Always: who is choosing and, if there are level cards, which ones (see above).
    f.ho = holdNames();
    if (waiting.size) f.lu = [levelSeq, levelNow];
    return f;
  }

  function flushAll() {
    for (const m of mates.values()) if (m.connected) Net.send(m.uid, hostFrame(m));
  }

  function flushClient(force) {
    if (!force && !outEv.length && flushT > 0) return;
    Net.toHost({ k: 'f', p: myState(), ev: outEv });
    outEv = [];
  }

  /** Every frame (also on the level-up screen). */
  function tick(dt) {
    if (!active) return;
    if (host) {
      for (const m of mates.values()) {
        if (!m.connected) continue;
        m.flushT -= dt;
        if (m.flushT > 0) continue;
        m.flushT = rateFor(m.uid);
        Net.send(m.uid, hostFrame(m));
      }
    } else {
      if (!stalled && performance.now() - lastHostAt > STALL_MS) {
        stalled = true;
        updateAway();
      }
      flushT -= dt;
      if (flushT <= 0) {
        flushT = rateFor(hostUid);
        Net.toHost({ k: 'f', p: myState(), ev: outEv });
        outEv = [];
      }
    }
  }

  // ---------------- receiving ----------------

  Net.on((from, msg) => {
    if (!msg) return;
    if (msg.k === 'start') {
      if (Flow.startCoop) Flow.startCoop(msg);
      return;
    }
    if (!active || msg.k !== 'f') return;
    if (host) onClientFrame(from, msg);
    else if (from === hostUid) onHostFrame(msg);
  });

  Net.onPeer((u, mode) => {
    if (!active || (mode !== 'closed' && mode !== 'failed')) return;
    if (host) mateGone(u);
    else if (u === hostUid) {
      const cb = api.lost;
      end();
      if (cb) cb('Lost connection to the host.');
    }
  });

  function mateGone(u) {
    const m = mates.get(u);
    if (!m || !m.connected) return;
    m.connected = false;
    Projectiles.clearOrbs(m.pl);
    Spawner.say(m.name + ' left the game', 2.6);
    if (waiting.has(u)) picked(u);
    if (holds.has(u)) holdOff(u);
    if (api.mateLeft) api.mateLeft(m);
  }

  // --- on the host ---

  function onClientFrame(from, msg) {
    const m = mates.get(from);
    if (!m || !m.connected) return;
    if (msg.p) {
      m.state = msg.p;
      m.pl.net = readState(msg.p);
      m.xpMul = m.pl.net.xpMul || 1;
      reconcile(from, m.pl.net);
    }
    for (const ev of msg.ev || []) {
      const fn = Sync.fromGuest.get(ev[0]);
      if (fn) fn(ev, from, m);
      else unknown(ev[0]);
    }
  }

  // Core events a guest sends (the modules register theirs with Sync.onGuest).
  Sync.onGuest('h', (ev, from) => {
    const e = EnemyMgr.get(ev[1]);
    if (!e || e.dead || e.remote) return;
    hitFrom = from;
    e.hurt(ev[2], ev[3], ev[4], ev[5], ev[6]);
    hitFrom = null;
  });
  Sync.onGuest('s', ev => {
    const e = EnemyMgr.get(ev[1]);
    if (!e || e.dead) return;
    if (ev[2] === 'b') e.applyBurn(ev[3]);
    else if (ev[2] === 'p') e.applyPoison(ev[3]);
    else if (ev[2] === 's') e.applySlow(ev[3]);
  });
  Sync.onGuest('c', (ev, from, m) => {
    Combat.ghostCast(m.pl, ev[1], ev[2], ev[3], ev[4]);
    emit(['c', from, ev[1], ev[2], ev[3], ev[4]], from);
  });
  Sync.onGuest('pb', (ev, from) => {
    World.breakAt(ev[1], ev[2]);
    emit(['pb', ev[1], ev[2]], from);
  });
  Sync.onGuest('lp', (ev, from) => picked(from));
  Sync.onGuest('hs', (ev, from) => holdOn(from));
  Sync.onGuest('he', (ev, from) => holdOff(from));
  Sync.onGuest('bye', (ev, from) => mateGone(from));

  // An event nobody registered: a newer/older version of the game on the other side.
  const warned = new Set();
  function unknown(code) {
    if (warned.has(code)) return;
    warned.add(code);
    console.warn('[Coop] unknown event:', code);
  }

  /** Host: what each guest message says overrides notices that may have been lost. */
  function reconcile(from, n) {
    if (n.ch === undefined) return; // old version of the game
    if (n.ch && !holds.has(from)) holdOn(from);
    else if (!n.ch && holds.has(from)) holdOff(from);
    if (waiting.has(from) && n.ld >= levelSeq) picked(from);
  }

  // --- on the guest ---

  /** Guest: pauses (or resumes) depending on whether the host is there. */
  function updateAway() {
    if (api.away) api.away(hostAway || stalled ? nameOf(hostUid) : null);
  }

  // Host: when leaving the tab, tell everyone immediately (afterwards it won't
  // be able to send anything) and, when coming back, that it's continuing.
  document.addEventListener('visibilitychange', () => {
    if (!active || !host) return;
    emit(['ha', document.hidden ? 1 : 0]);
    flushAll();
  });

  function onHostFrame(msg) {
    lastHostAt = performance.now();
    if (stalled) {
      stalled = false;
      updateAway();
    }
    for (const ev of msg.ev || []) applyHostEvent(ev);
    for (const [key, d] of Sync.fields) if (msg.x && msg.x[key] != null) d.apply(msg.x[key]);
    // Who is choosing and the level cards, even if a notice was lost.
    if (msg.ho) {
      const k = msg.ho.join('|');
      if (k !== lastHo) {
        lastHo = k;
        api.hold && api.hold(msg.ho);
      }
      if (msg.lu && msg.lu[0] > seenSeq) {
        seenSeq = msg.lu[0];
        api.levelStart(msg.lu[1]);
      } else if (!msg.lu && api.inLevelUp && api.inLevelUp()) api.resume();
    }
    api.syncTeam({
      time: msg.t,
      level: msg.lv,
      xp: msg.xp,
      xpNext: msg.xn,
      kills: msg.ki,
      bosses: msg.bo,
      coins: msg.co,
      t1: (msg.tk || [])[0],
      t10: (msg.tk || [])[1]
    });
    for (const u in msg.p || {}) {
      const m = mates.get(u);
      if (m) m.pl.net = readState(msg.p[u]);
    }
    const now = performance.now();
    for (const a of msg.e || []) {
      const e = EnemyMgr.get(a[0]);
      if (!e || !e.remote || e.dead) continue;
      const n = e.net;
      const dts = (now - (n.last || now)) / 1000;
      if (dts > 0.02 && dts < 1) {
        n.vx = U.clamp((a[1] - n.x) / dts, -600, 600);
        n.vy = U.clamp((a[2] - n.y) / dts, -600, 600);
      } else {
        n.vx = 0;
        n.vy = 0;
      }
      n.x = a[1];
      n.y = a[2];
      n.age = 0;
      n.last = now;
      e.hp = Math.min(e.maxHp, a[3]);
      n.anim = a[4];
      n.dir = a[5];
      n.st = a[6];
    }
  }

  function applyHostEvent(ev) {
    const fn = Sync.fromHost.get(ev[0]);
    if (fn) fn(ev);
    else unknown(ev[0]);
  }

  // Core events from the host (the modules register theirs with Sync.on).
  Sync.on('ne', ev =>
    EnemyMgr.addRemote({
      id: ev[1],
      dex: ev[2],
      x: ev[3],
      y: ev[4],
      boss: !!ev[5],
      shiny: !!ev[6],
      hp: ev[7],
      dmg: ev[8],
      beh: ev[9]
    })
  );
  Sync.on('ed', ev => EnemyMgr.removeRemote(ev[1], true));
  Sync.on('eg', ev => EnemyMgr.removeRemote(ev[1], false));
  Sync.on('hn', ev => {
    const e = EnemyMgr.get(ev[1]);
    if (e && !e.dead) e.showHurt(ev[2], ev[3]);
  });
  Sync.on('es', ev =>
    Projectiles.spawn({
      x: ev[1],
      y: ev[2],
      vx: ev[3],
      vy: ev[4],
      dmg: ev[5],
      r: ev[6],
      life: ev[7],
      friendly: false,
      color: '#ff7a9e',
      vis: VFX.forType(ev[8]),
      mtype: ev[8]
    })
  );
  Sync.on('c', ev => {
    const m = mates.get(ev[1]);
    if (m) Combat.ghostCast(m.pl, ev[2], ev[3], ev[4], ev[5]);
  });
  Sync.on('item', ev => api.item(ev[1]));
  Sync.on('pk', ev => Pickups.addRemote(ev[1], ev[2], ev[3], ev[4], ev[5]));
  Sync.on('pc', ev => Pickups.removeId(ev[1]));
  Sync.on('mag', () => {
    Pickups.pullAll();
    FX.ring(local.x, local.y, 10, 420, '#ff9ed8', 0.6, 4);
  });
  Sync.on('bomb', ev => {
    FX.ring(ev[1], ev[2], 20, Camera.outerRadius(), '#ff7b3d', 0.5, 6);
    if (U.dist2(ev[1], ev[2], local.x, local.y) < 500 * 500) Camera.kick(0.8);
    Audio.sfx('break');
  });
  Sync.on('pb', ev => World.breakAt(ev[1], ev[2]));
  Sync.on('say', ev => Spawner.say(ev[1], ev[2]));
  Sync.on('heal', ev => {
    if (local.dead) return;
    local.heal(local.maxHp * ev[1]);
    FX.ring(local.x, local.y, 6, 60, '#5fe08a', 0.4, 3);
  });
  Sync.on('lu', ev => {
    if (!ev[2] || ev[2] > seenSeq) {
      seenSeq = ev[2] || seenSeq;
      api.levelStart(ev[1]);
    }
  });
  Sync.on('lw', ev => api.waiting(ev[1]));
  Sync.on('lr', () => api.resume());
  Sync.on('hp', ev => {
    lastHo = (ev[1] || []).join('|');
    api.hold && api.hold(ev[1]);
  });
  Sync.on('ha', ev => {
    hostAway = !!ev[1];
    updateAway();
  });
  Sync.on('sh', ev => api.shiny(ev[1]));
  Sync.on('ov', ev => {
    const cb = api.over;
    end();
    cb(ev[1]);
  });
  // A visual effect the host played (see fx()).
  Sync.on('fx', ev => {
    const f = FX[ev[1]];
    if (typeof f === 'function') f.apply(FX, ev.slice(2));
  });

  // ---------------- hooks called by the game modules ----------------

  /** Your attack: the others replay it as a ghost. */
  function cast(pl, m) {
    if (!active || pl !== local) return;
    if (host) emit(['c', me, m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
    else outEv.push(['c', m.id, m.lvl, r2(pl.aim), m.evolved ? 1 : 0]);
  }

  // guest
  function hit(e, d, color, dx, dy, knock) {
    outEv.push(['h', e.id, d, color, r1(dx), r1(dy), knock || 0]);
  }
  function status(e, kind, val) {
    outEv.push(['s', e.id, kind, val]);
  }

  // host
  function hurtShown(e, d, color) {
    emitNear(['hn', e.id, d, color], e.x, e.y, hitFrom);
  }
  function enemyAdded(e) {
    emit(['ne', e.id, e.dex, r1(e.x), r1(e.y), e.boss ? 1 : 0, e.shiny ? 1 : 0, Math.ceil(e.maxHp), r2(e.dmg), e.behavior]);
  }
  function enemyGone(e, died) {
    emit([died ? 'ed' : 'eg', e.id]);
  }
  function enemyShot(p, type) {
    emit(['es', r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), r2(p.dmg), p.r, p.life, type]);
  }
  function pickupAdded(o) {
    emit(['pk', o.id, o.kind, r1(o.x), r1(o.y), o.value]);
  }
  function pickupGone(id) {
    emit(['pc', id]);
  }
  function say(text, secs) {
    emit(['say', text, secs]);
  }

  function propBroken(p) {
    if (host) emit(['pb', p.tx, p.ty]);
    else outEv.push(['pb', p.tx, p.ty]);
  }

  /** Host: someone picked up an item. Returns true if it's for you. */
  function collected(p, who) {
    emit(['pc', p.id]);
    if (p.kind === 'magnet') emit(['mag']);
    if (p.kind === 'bomb') emit(['bomb', r1(who.x), r1(who.y)]);
    if ((p.kind === 'heal' || p.kind === 'item') && who !== local) {
      const m = mates.get(who.uid);
      if (m) m.q.push(p.kind === 'heal' ? ['heal', 0.3] : ['item', p.value]);
    }
  }

  function shinyCaught(e) {
    emit(['sh', e.dex]);
  }

  /**
   * A FX effect played here and, on the host, on every guest too:
   * Coop.fx('ring', x, y, r0, r1, color, life, width). Numbers are rounded
   * to 2 decimals for the trip. Purely visual: guests can't act on it.
   */
  function fx(name, ...args) {
    FX[name](...args);
    if (active && host) emit(['fx', name, ...args.map(v => (typeof v === 'number' ? r2(v) : v))]);
  }

  // ---------------- shared level-up ----------------

  function levelStart(level) {
    waiting = new Set([me]);
    for (const m of mates.values()) if (m.connected) waiting.add(m.uid);
    levelSeq++;
    levelNow = level;
    emit(['lu', level, levelSeq]);
    flushAll();
    api.levelStart(level);
    sendWaiting();
  }

  function nameOf(u) {
    return u === me ? (Social.me ? Social.me.name : 'You') : (mates.get(u) || {}).name || '?';
  }

  function sendWaiting() {
    const names = [...waiting].map(nameOf);
    emit(['lw', names]);
    api.waiting(names);
  }

  /** Someone picked a card (host). */
  function picked(u) {
    if (!waiting.delete(u)) return;
    if (waiting.size) {
      sendWaiting();
      return;
    }
    emit(['lr']);
    flushAll();
    api.resume();
  }

  // ---------------- fusions: pause for everyone ----------------
  // While someone chooses which moves to fuse (a legendary's bond),
  // the run pauses for everyone, like with level cards.

  function holdNames() {
    return [...holds].map(nameOf);
  }

  /** Host: `u` starts choosing. */
  function holdOn(u) {
    holds.add(u);
    emit(['hp', holdNames()]);
    flushAll();
    api.hold && api.hold(holdNames());
  }

  /** Host: `u` has finished (or left). */
  function holdOff(u) {
    if (!holds.delete(u)) return;
    emit(['hp', holdNames()]);
    flushAll();
    api.hold && api.hold(holdNames());
  }

  /** You start / finish choosing a fusion. */
  function holdStart() {
    if (host) holdOn(me);
    else {
      outEv.push(['hs']);
      flushClient(true);
    }
  }
  function holdEnd() {
    if (host) holdOff(me);
    else {
      outEv.push(['he']);
      flushClient(true);
    }
  }

  /** You picked your card. */
  function localPicked() {
    if (host) picked(me);
    else {
      doneSeq = seenSeq;
      outEv.push(['lp']);
      flushClient(true);
    }
  }

  /** Host: it's over for everyone. */
  function over(data) {
    emit(['ov', data]);
    flushAll();
    end();
  }

  return {
    ANIMS,
    COLORS,
    begin,
    end,
    leave,
    tick,
    players,
    puppets,
    xpFactor,
    scaleRate,
    scaleHp,
    cast,
    hit,
    status,
    hurtShown,
    enemyAdded,
    enemyGone,
    enemyShot,
    pickupAdded,
    pickupGone,
    say,
    propBroken,
    collected,
    shinyCaught,
    fx,
    levelStart,
    localPicked,
    over,
    holdStart,
    holdEnd,
    /** Host: event for everyone. Guest: event for the host. */
    broadcast(ev) {
      emit(ev);
    },
    toHost(ev) {
      if (active && !host) {
        outEv.push(ev);
        flushClient(true);
      }
    },
    mate(u) {
      return mates.get(u);
    },
    get mates() {
      return [...mates.values()];
    },
    get members() {
      return members;
    },
    get active() {
      return active;
    },
    get isHost() {
      return active && host;
    },
    get local() {
      return local;
    }
  };
})();
