/* ============ ranking.js — clasificación de tiempo aguantado ============
 * Nuestro servidor (server/api.mjs, tabla lb_entries de Postgres):
 *
 *   POST /api/lb        guarda tu marca en las tablas donde mejoras (el
 *                       servidor comprueba que sea posible: anti-trampas)
 *   GET  /api/lb?b=...  el top 50 de una tabla (o sólo tú y tus amigos) y tu puesto
 *
 *   tabla = modo + periodo:
 *     s_d20261008   solitario, hoy            g_...   en grupo
 *     s_w2026-41j   semana ISO                s_m202610j  mes
 *     s_all2        histórico
 *     s_all2_p25    histórico sólo con Pikachu (el filtro por Pokémon sólo
 *                   existe en el histórico)
 *   id = tu uid (solitario) o los uid del equipo ordenados y unidos con "_".
 *
 * Los periodos se cuentan en hora de España (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [
    ['d', 'Diario'],
    ['w', 'Semanal'],
    ['m', 'Mensual'],
    ['a', 'Histórico']
  ];
  const TOP = 50;
  // Las runs de menos de 2 minutos no se suben (nunca entran en un top que importe).
  const MIN_T = 120;
  const TTL = 60 * 1000; // lo leído vale 1 min

  const on = () => G.DB.online;
  const api = (path, opts) => G.DB.api(path, opts);

  // ---------------- periodos ----------------

  function madridDate(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
      date
    ))
      p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** Semana ISO (lunes a domingo) de una fecha y-m-d. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  const ALL = 'all2'; // histórico
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  /*
   * Nombres de las tablas: los de periodIds() salvo semana y mes, que llevan
   * una "j". periodIds() se queda igual porque también lo usan las misiones
   * (progress.js).
   */
  function boardIds(date) {
    const p = periodIds(date);
    return Object.assign({}, p, { w: p.w + 'j', m: p.m + 'j' });
  }

  /** El filtro por Pokémon sólo existe en el histórico. */
  function board(mode, period, dex) {
    return mode + '_' + boardIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  // ---------------- lo leído (1 min) ----------------

  const mem = new Map(); // tabla:alcance -> { at, p }
  function fetchBoard(b, friendsOnly) {
    const k = b + ':' + (friendsOnly ? 'f' : 'a');
    const c = mem.get(k);
    if (c && Date.now() - c.at < TTL) return c.p;
    const p = api('api/lb?b=' + encodeURIComponent(b) + (friendsOnly ? '&scope=friends' : ''));
    mem.set(k, { at: Date.now(), p });
    p.catch(() => mem.delete(k));
    return p;
  }
  function forget(b) {
    for (const k of [...mem.keys()]) if (!b || k.startsWith(b + ':')) mem.delete(k);
  }

  // ---------------- anti-trampas ----------------

  /**
   * Al empezar la PRIMERA partida de la sesión (en grupo, el anfitrión) el
   * servidor apunta la hora: ninguna marca puede durar más que el tiempo real
   * desde entonces (server/api.mjs). Antes se espera a que acabe de subirse
   * la marca de la partida anterior.
   */
  let busy = Promise.resolve(),
    runMarked = '';
  function runStarted(mode) {
    if (!on() || runMarked === G.DB.uid) return;
    runMarked = G.DB.uid;
    const go = n =>
      api('api/run-start', { method: 'POST', body: { mode } }).catch(e => {
        console.warn('[Ranking] inicio:', e.code || e.message);
        if (n < 2) setTimeout(() => go(n + 1), 15000);
        else runMarked = '';
      });
    busy.then(() => go(0));
  }
  /** La subida de una marca (para que la partida siguiente espere a que acabe). */
  function track(p) {
    busy = p.catch(() => {});
    return p;
  }

  // ---------------- guardar ----------------

  /** Guarda la entrada en cada tabla donde mejore. → periodos mejorados */
  async function store(mode, boards, entry) {
    let r;
    try {
      r = await api('api/lb', { method: 'POST', body: { mode, entry, boards: boards.map(x => x[0]) } });
    } catch (e) {
      console.warn('[Ranking] no se pudo guardar:', e.code || e.message);
      return [];
    }
    const better = [];
    for (const [b, period] of boards) {
      if (!(r.better || []).includes(b)) continue;
      forget(b);
      if (period && period !== 'p' && !better.includes(period)) better.push(period);
    }
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'de hoy', w: 'de la semana', m: 'del mes', a: 'histórico' };
    const best = PERIODS.map(p => p[0])
      .filter(p => better.includes(p))
      .pop();
    G.UI.toast('¡Nueva mejor marca ' + names[best] + ' en el ranking!', 3400);
  }

  function submitSolo(r) {
    return track(submitSoloNow(r));
  }
  async function submitSoloNow(r) {
    if (!on() || !G.Social.me || r.t < MIN_T) return [];
    const ids = boardIds();
    const entry = { t: r.t, uids: [G.DB.uid], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    const better = await store('s', boards, entry);
    announce(better);
    return better;
  }

  /** La sube el anfitrión, con todo el equipo. */
  function submitGroup(r) {
    return track(submitGroupNow(r));
  }
  async function submitGroupNow(r) {
    if (!on() || r.t < MIN_T || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const entry = {
      t: r.t,
      uids: ms.map(m => m.uid),
      dex: ms.map(m => m.dex),
      shiny: ms.map(m => !!m.shiny),
      lv: r.lv,
      kills: r.kills
    };
    const ids = boardIds();
    const boards = PERIODS.map(([p]) => ['g_' + ids[p], p]);
    for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d, 'p']);
    const better = await store('g', boards, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /**
   * Mejores marcas de una tabla.
   * @param friendsOnly  sólo tú y tus amigos
   */
  async function top(mode, period, dex, friendsOnly) {
    if (!on()) return [];
    const r = await fetchBoard(board(mode, period, dex), friendsOnly);
    return (r.rows || []).slice(0, TOP);
  }

  /** Tu puesto en la tabla (aunque no salgas en el top). → { pos, t, row } | null */
  async function myRank(mode, period, dex) {
    if (!on()) return null;
    const r = await fetchBoard(board(mode, period, dex), false);
    return r.mine || null;
  }

  /** (Al borrar la cuenta, el servidor quita tus marcas.) */
  function removeMine() {
    return Promise.resolve();
  }

  // ---------------- reportes y moderación ----------------

  /** Reporta una marca sospechosa (una vez por marca y jugador). → true si se ha enviado */
  const repKey = () => 'ps.rk.rep.' + (G.DB.uid || '');
  function reported() {
    try {
      return new Set(JSON.parse(localStorage.getItem(repKey()) || '[]'));
    } catch (e) {
      return new Set();
    }
  }
  async function report(b, row) {
    if (!on()) return false;
    const key = b + '__' + row.id;
    const done = reported();
    if (!done.has(key)) {
      // (Si ya lo habías reportado desde otro aparato, el servidor no lo repite: da igual.)
      await api('api/report', { method: 'POST', body: { board: b, e: row.id, names: row.names.slice(0, 4), t: row.t | 0 } }).catch(
        () => {}
      );
      done.add(key);
      try {
        localStorage.setItem(repKey(), JSON.stringify([...done].slice(-300)));
      } catch (e) {
        /* lleno */
      }
    }
    return true;
  }

  // Cuenta de moderación (ADMIN_EMAILS en el servidor): la pantalla oculta de js/ui/mod-ui.js.
  const isAdmin = () => on() && G.DB.isAdmin;

  /** Admin: los reportes, juntos por marca (los más reportados primero). */
  async function reports() {
    return (await api('api/admin/reports')).groups;
  }

  /** Admin: la fila de una marca en el top 50 de su tabla (o null si ya no está). */
  async function entryInfo(b, e) {
    const r = await fetchBoard(b, false);
    return (r.rows || []).find(x => x.id === e) || null;
  }

  /** Admin: quita una marca de una tabla. */
  async function removeEntry(b, e) {
    await api('api/admin/remove', { method: 'POST', body: { b, e } }).catch(err =>
      console.warn('[Ranking] quitar', b, err.code || err.message)
    );
    forget(b);
  }

  /** Admin: quita la marca de un jugador o equipo de todas las tablas de ahora (y de `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = boardIds();
    const boards = new Set(PERIODS.map(([p]) => mode + '_' + ids[p]));
    for (const d of dexes) boards.add(mode + '_' + ALL + '_p' + d);
    if (also) boards.add(also);
    await Promise.all([...boards].map(b => removeEntry(b, e)));
  }

  /** Admin: quita de TODAS las tablas las marcas de más de `maxT` segundos. → { rows, boards } */
  async function purgeAbove(maxT) {
    const r = await api('api/admin/purge', { method: 'POST', body: { maxT } });
    forget();
    return r;
  }

  /** Admin: banea o desbanea una cuenta del ranking (baneada = no puede subir marcas). */
  function setMarked(uid, on) {
    return api('api/admin/ban', { method: 'POST', body: { uid, on: !!on } });
  }
  /** Admin: borra reportes ya vistos. */
  function dismiss(ids) {
    return api('api/admin/dismiss', { method: 'POST', body: { ids } });
  }
  /** Admin: cuentas baneadas del ranking. */
  async function markedAccounts() {
    return (await api('api/admin/banned')).accounts;
  }

  // (Lo que guardaba la versión anterior en el navegador ya no sirve.)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ps.rk.c.') || k.startsWith('ps.rk.best') || k === 'ps.rk.thr')) localStorage.removeItem(k);
    }
  } catch (e) {
    /* nada */
  }

  return {
    PERIODS,
    periodIds,
    board,
    runStarted,
    submitSolo,
    submitGroup,
    top,
    myRank,
    removeMine,
    report,
    reported,
    isAdmin,
    reports,
    entryInfo,
    removeEntry,
    purgeAbove,
    removeEverywhere,
    setMarked,
    dismiss,
    markedAccounts
  };
})();
