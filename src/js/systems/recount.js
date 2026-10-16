/* ============ recount.js — damage meter ============
 * How much damage each of your moves deals this run and, in co-op, each teammate.
 *
 *   counting   every hit adds to its move instance (m.dealt, combat.js damage());
 *              burn and poison ticks go to whoever applied them (enemy.js: burnBy/
 *              burnMid), through dot(). Rocky Helmet and bombs go to "Other".
 *   co-op      each player sends their own total in their state (coop.js myState);
 *              burns and poisons from a guest tick on the host, which collects them
 *              per guest (takePending) and sends them back in its frame (f.dd).
 *
 * Damage is counted when dealt, before shields and including overkill.
 *
 *   Recount.reset(pl) at run start · rows() · team() · rate() · snapshot(time)
 */
import { I18n } from '../core/i18n.js';
import { Coop } from '../net/coop.js';

export const Recount = (() => {
  const RATE_WINDOW = 10; // s, the "now" damage per second on the HUD
  let pl = null,
    otherDmg = 0,
    pending = new Map(), // host: uid -> { moveId: damage } of guest burns/poisons
    samples = [], // [time s, total] for the rolling rate
    frozen = null; // co-op table at the moment the run ended

  function reset(p) {
    pl = p;
    otherDmg = 0;
    pending = new Map();
    samples = [];
    frozen = null;
  }

  function myTotal() {
    if (!pl) return 0;
    let t = otherDmg;
    for (const m of pl.moves) t += m.dealt || 0;
    return t;
  }

  /** Damage not from a move (Rocky Helmet, bombs), only for the local player. */
  function other(who, d) {
    if (who === pl && d > 0) otherDmg += d;
  }

  function credit(mid, d) {
    const m = pl && pl.moves.find(x => x.id === mid);
    if (m) m.dealt += d;
    else otherDmg += d;
  }

  /**
   * A burn/poison tick of `d` on an enemy, applied by move `mid` of player `by`
   * (null = this device's player). Without a move (a trap's poison) nobody gets it.
   */
  function dot(by, mid, d) {
    if (!mid || !(d > 0)) return;
    if (!by || (pl && by === pl.uid)) {
      credit(mid, d);
      return;
    }
    let p = pending.get(by);
    if (!p) pending.set(by, (p = {}));
    p[mid] = (p[mid] || 0) + d;
  }

  /** Host: what a guest's burns and poisons did since the last frame (null if nothing). */
  function takePending(uid) {
    const p = pending.get(uid);
    if (!p) return null;
    pending.delete(uid);
    for (const k in p) p[k] = Math.round(p[k]);
    return p;
  }

  /** Guest: the host's report of my burns and poisons. */
  function applyPending(p) {
    if (!p || !pl) return;
    for (const mid in p) if (p[mid] > 0) credit(mid, +p[mid]);
  }

  /** Your moves by damage (plus "Other"), with their share of your total. */
  function rows() {
    if (!pl) return [];
    const total = myTotal() || 1;
    const out = pl.moves.filter(m => m.dealt > 0).map(m => ({ id: m.id, name: m.name, type: m.type, dmg: m.dealt, pct: m.dealt / total }));
    if (otherDmg > 0) out.push({ id: null, name: 'Other', type: null, dmg: otherDmg, pct: otherDmg / total });
    return out.sort((a, b) => b.dmg - a.dmg);
  }

  /** Co-op: one row per player (you included), with their share of the group's damage. */
  function team() {
    if (frozen) return frozen;
    if (!Coop.active || !pl) return null;
    const names = new Map((Coop.members || []).map(m => [m.uid, m.name]));
    const out = [{ name: names.get(pl.uid) || pl.mon.name, color: pl.tagColor || '#ffd23f', dmg: myTotal(), me: true }];
    for (const m of Coop.mates) {
      const n = m.pl.net;
      out.push({ name: m.name, color: m.color, dmg: (n && n.dm) || 0, me: false, gone: !m.connected });
    }
    const total = out.reduce((a, r) => a + r.dmg, 0) || 1;
    for (const r of out) r.pct = r.dmg / total;
    return out.sort((a, b) => b.dmg - a.dmg);
  }

  /** Damage per second over the last few seconds (call it every so often with the run time). */
  function rate(time) {
    const t = myTotal();
    samples.push([time, t]);
    while (samples.length > 1 && time - samples[0][0] > RATE_WINDOW) samples.shift();
    const [t0, d0] = samples[0];
    return time - t0 > 0.5 ? (t - d0) / (time - t0) : 0;
  }

  /** Co-op: keep the group table as it was when the run ended (before the teammates go). */
  function freeze() {
    frozen = null;
    frozen = team();
  }

  /** Everything for the results screen. */
  function snapshot(time) {
    const total = myTotal();
    return { total, dps: time > 0 ? total / time : 0, rows: rows(), team: team() };
  }

  /** 950 · 12.3k · 1.2M (decimal comma in Spanish). */
  function fmt(n) {
    n = Math.round(n || 0);
    const k = (v, s) => (v < 100 ? v.toFixed(1) : Math.round(v)).toString().replace('.', I18n.lang === 'es' ? ',' : '.') + s;
    if (n >= 1e6) return k(n / 1e6, 'M');
    if (n >= 1e4) return k(n / 1e3, 'k');
    return String(n);
  }

  return { reset, myTotal, other, dot, takePending, applyPending, rows, team, rate, freeze, snapshot, fmt };
})();
