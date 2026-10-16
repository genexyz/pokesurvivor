/* ============ save-merge.js — merge two versions of a save ============
 * Used by the browser (SaveMerge, from db.js) and the server (server/api.mjs,
 * via import): so the save is merged exactly the same way in both places.
 * It doesn't depend on anything from the game.
 *
 * Coin and ticket LEDGER (14-10-2026). Coins and tickets used to be "those of
 * the most recent version": if a device with stale data (the phone with
 * yesterday's tab open) saved something, its number won and whatever was
 * earned on the other one was lost (a player went from 36 tickets to 3).
 * Now each device records in save.led[device] what it has earned and spent
 * of each thing ([earned, spent], they only grow) and the balance is the sum
 * of all of them: merging takes the larger of each entry and nothing is lost.
 *   led.base: the balance before the ledger existed (or at the start).
 *   led.old:  changes from an older version of the game (tabs not yet updated).
 */
export const SaveMerge = (() => {
  const CUR = {
    c: [
      s => s.coins,
      (s, v) => {
        s.coins = v;
      }
    ],
    t1: [
      s => (s.tickets || {}).t1,
      (s, v) => {
        s.tickets.t1 = v;
      }
    ],
    t10: [
      s => (s.tickets || {}).t10,
      (s, v) => {
        s.tickets.t10 = v;
      }
    ]
  };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const balOf = s => {
    const o = {};
    for (const k in CUR) o[k] = num(CUR[k][0](s));
    return o;
  };
  function ledSum(led, k) {
    let t = 0;
    for (const dev in led) {
      const e = led[dev] && led[dev][k];
      if (e) t += num(e[0]) - num(e[1]);
    }
    return t;
  }
  function addTo(led, dev, k, d) {
    if (!d) return;
    const e = (led[dev] = led[dev] || {});
    const p = (e[k] = e[k] || [0, 0]);
    if (d > 0) p[0] = num(p[0]) + d;
    else p[1] = num(p[1]) - d;
  }
  /** A save's ledger (without modifying it); any mismatch goes to `dev`. */
  function ledOf(s, dev) {
    if (!isObj(s.led)) {
      const b = balOf(s),
        base = {};
      for (const k in CUR) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)),
      b = balOf(s);
    // A negative balance (the same thing spent on two offline devices) shows as 0.
    for (const k in CUR) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }

  /**
   * Merges two versions of the same save (e.g. one played offline and the
   * cloud one). Nothing earned is ever lost:
   *   - collections (owned, shiny): union
   *   - upgrades and stats: the maximum of each
   *   - coins and tickets: each device's ledger (see above)
   *   - partner, pity...: those of the most recent version
   * It is idempotent: merging twice gives the same result.
   */
  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    // Coins and tickets: the larger of each entry per device, and the balance is the sum.
    const la = ledOf(a, 'old'),
      lb = ledOf(b, 'old'),
      led = {};
    for (const src of [la, lb])
      for (const dev in src)
        for (const k in src[dev]) {
          const p = ((led[dev] = led[dev] || {})[k] = led[dev][k] || [0, 0]),
            q = src[dev][k];
          p[0] = Math.max(p[0], num(q[0]));
          p[1] = Math.max(p[1], num(q[1]));
        }
    r.led = led;
    r.tickets = r.tickets || { t1: 0, t10: 0 };
    for (const k in CUR) CUR[k][1](r, Math.max(0, ledSum(led, k)));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = (r.pupg[d] = r.pupg[d] || {});
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    // What's been earned is never lost: union of legendaries, arenas, items, achievements...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    // Missions of the same day/week: the highest progress and whatever was already claimed.
    const mo = older.missions || {},
      mr = (r.missions = r.missions || {});
    for (const [per, list] of [
      ['day', 'daily'],
      ['week', 'weekly']
    ]) {
      if (mr[per] !== mo[per] || !mr[list] || !mo[list]) continue;
      mr[list].forEach((m, i) => {
        const o = mo[list][i];
        if (!o || o.id !== m.id) return;
        m.prog = Math.max(m.prog || 0, o.prog || 0);
        m.claimed = m.claimed || o.claimed;
        m.told = m.told || o.told;
      });
    }
    r.stats = r.stats || {};
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) {
      r.partner = older.partner;
      r.partnerShiny = older.partnerShiny;
    }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  return { CUR, isObj, num, ledOf, ledSum, merge };
})();
