/* ============ save-merge.js — fusionar dos versiones de una partida ============
 * Lo usan el navegador (G.SaveMerge, desde db.js) y el servidor (server/api.mjs,
 * con require): así la partida se fusiona exactamente igual en los dos sitios.
 * No depende de nada del juego.
 *
 * LIBRETA de monedas y tickets (14-10-2026). Antes las monedas y los tickets
 * eran "los de la versión más reciente": si un aparato con datos viejos (el
 * móvil con la pestaña abierta de ayer) guardaba algo, su número ganaba y se
 * perdía lo conseguido en el otro (un jugador pasó de 36 tickets a 3).
 * Ahora cada aparato apunta en save.led[aparato] lo que ha ganado y gastado
 * de cada cosa ([ganado, gastado], sólo crecen) y el saldo es la suma de
 * todos: al fusionar se toma el mayor de cada apunte y no se pierde nada.
 *   led.base: el saldo que había antes de la libreta (o al empezar).
 *   led.old:  cambios de una versión anterior del juego (pestañas sin actualizar).
 */
(() => {
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
  /** La libreta de una partida (sin tocarla); lo que no cuadre, a `dev`. */
  function ledOf(s, dev) {
    if (!isObj(s.led)) {
      const b = balOf(s),
        base = {};
      for (const k in CUR) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)),
      b = balOf(s);
    // Un saldo en negativo (lo mismo gastado en dos aparatos sin conexión) se ve como 0.
    for (const k in CUR) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas y tickets: la libreta de cada aparato (ver arriba)
   *   - compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    // Monedas y tickets: el mayor de cada apunte de cada aparato, y el saldo es la suma.
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
    r.upgrades = r.upgrades || {};
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = (r.pupg[d] = r.pupg[d] || {});
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // Lo conseguido nunca se pierde: unión de legendarios, arenas, objetos, logros...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    // Misiones del mismo día/semana: el mayor progreso y lo ya recogido.
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

  const api = { CUR, isObj, num, ledOf, ledSum, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else G.SaveMerge = api;
})();
