/* ============ db.js — base de datos: nuestro servidor (nube) o local ============
 * TODO el acceso a datos persistentes pasa por aquí. El resto del juego sólo
 * usa G.DB.*.
 *
 * Dos modos (se decide en ready()):
 *
 *   NUBE  (nuestro servidor: server/, con Postgres)
 *     Desde la web oficial (o localhost con el servidor y su base de datos).
 *     Sólo se entra con Google. La partida se guarda en el servidor y se
 *     puede seguir en cualquier aparato. Además se guarda una copia local
 *     para poder jugar sin conexión; al sincronizar se FUSIONA (save-merge.js):
 *     las colecciones se unen y nunca se pierde un Pokémon ni un shiny.
 *
 *   LOCAL (localStorage)
 *     Sin servidor (copia en otra web, abierto con doble clic, npm run dev sin
 *     base de datos): una partida en este navegador, sin cuenta.
 *       ps.save.local    la partida
 *       ps.session       'local' si se estaba jugando
 *
 * El modo invitado juega con una partida en memoria que no se guarda.
 */
G.DB = (() => {
  const K_SES = 'ps.session',
    K_SAVE = 'ps.save.',
    LOCAL = 'local';
  const K_CLOUD = 'ps.cloud.';
  const VERSION = 3;
  const START_COINS = 500;

  let mode = 'local'; // 'cloud' | 'local'
  let localReason = ''; // por qué no hay nube: 'dev' | 'file' | 'host' | 'config' | 'error'
  let user = null; // nombre visible
  let key = null; // 'local' o el id de la cuenta
  let guest = false;
  let save = null;
  let storageOk = true;
  let me = null; // lo que dice el servidor de la sesión: { user: { id, admin }, nick }

  // ---------------- almacenamiento local seguro ----------------

  function read(k) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      storageOk = false;
      return null;
    }
  }
  function write(k, v) {
    const s = JSON.stringify(v);
    try {
      localStorage.setItem(k, s);
      return true;
    } catch (e) {
      // Navegador lleno (sobre todo por lo que guarda el ranking): se libera lo
      // prescindible y se reintenta. Antes la copia de la partida dejaba de
      // guardarse sin avisar y, al recargar, se volvía a la de la nube.
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && /^ps\.rk\.c\./.test(key)) localStorage.removeItem(key);
        }
        localStorage.setItem(k, s);
        return true;
      } catch (e2) {
        storageOk = false;
        return false;
      }
    }
  }
  function remove(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* nada */
    }
  }

  // ---------------- partida ----------------

  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(), // última modificación (para fusionar)
      coins: START_COINS,
      owned: {}, // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {}, // dex -> { at, from } — variantes shiny conseguidas
      partner: null, // dex del Pokémon con el que juegas
      partnerShiny: false, // jugar con su versión shiny (si la tienes)
      starter: null, // dex que te tocó en el test
      personality: null, // { trait, scores }
      upgrades: {}, // (antiguo) mejoras de la cuenta; ahora van por Pokémon
      pupg: {}, // dex -> { id -> nivel }: mejoras de cada Pokémon
      tickets: { t1: 0, t10: 0 }, // tickets del gacha (x1 y x10)
      pity: {}, // generación del banner -> tiradas sin ★5
      legends: {}, // dex -> fecha: legendarios vencidos en grietas
      arenas: {}, // tipo -> fecha: arenas de grieta ganadas
      itemsFound: {}, // id -> fecha: objetos equipables encontrados
      evoMoves: {}, // id -> fecha: movimientos evolucionados alguna vez
      ach: {}, // id -> fecha: logros conseguidos
      missions: {}, // misiones del día / semana (systems/progress.js)
      profile: { favs: [], title: '' }, // perfil público: 3 favoritos y título
      stats: {
        runs: 0,
        bestTime: 0,
        bestLevel: 0,
        totalKills: 0,
        pulls: 0,
        coinsEarned: 0,
        shinies: 0,
        bossesTotal: 0,
        riftWins: 0,
        evolutions: 0,
        missionsDone: 0,
        groupRuns: 0,
        bestGroupTime: 0
      }
    };
  }

  /** Rellena campos que falten en partidas de versiones anteriores. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: había un único banner (Kanto) con el pity como número.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    // v2 -> v3: las mejoras eran de la cuenta; pasan al compañero de entonces.
    if (!s.pupgDone) {
      if (s.partner && Object.values(s.upgrades || {}).some(v => v > 0)) {
        s.pupg[s.partner] = Object.assign({}, s.upgrades);
      }
      s.pupgDone = true;
    }
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Quita lo imposible de una partida editada a mano (la copia del navegador
   * se puede tocar): números negativos o raros, mejoras por encima del
   * máximo y Pokémon que no existen. Lo que sí sea posible lo frena el
   * servidor (server/api.mjs, saves).
   */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    s.coins = n(s.coins);
    s.tickets.t1 = n(s.tickets.t1);
    s.tickets.t10 = n(s.tickets.t10);
    if (isObj(s.led)) {
      for (const dev of Object.keys(s.led)) {
        const e = s.led[dev];
        if (!isObj(e)) {
          delete s.led[dev];
          continue;
        }
        for (const k of Object.keys(e)) {
          if (!CUR[k] || !Array.isArray(e[k])) {
            delete e[k];
            continue;
          }
          e[k] = [n(e[k][0]), n(e[k][1])];
        }
      }
    } else delete s.led;
    if (G.DEX_BY)
      for (const coll of ['owned', 'shiny']) {
        for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
      }
    // Atajos: 4 huecos con un movimiento que exista (o null), sin repetir.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (G.Moves && !G.Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id);
          return id;
        });
      }
    } else s.pbind = {};
    // Veto: listas de movimientos que existen, sin repetir, como mucho 3.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    if (G.Upgrades)
      for (const d of Object.keys(s.pupg || {})) {
        const u = s.pupg[d];
        if (!u || typeof u !== 'object') {
          delete s.pupg[d];
          continue;
        }
        for (const id of Object.keys(u)) {
          if (!G.Upgrades.BY[id]) delete u[id];
          else u[id] = Math.min(G.Upgrades.BY[id].max, n(u[id]));
        }
      }
  }

  // Fusionar partidas y la libreta de monedas y tickets: js/core/save-merge.js.
  const { CUR, isObj, ledOf, merge } = G.SaveMerge;
  // Este aparato (navegador): un nombre al azar que se queda guardado.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) {
      d = 'd' + Math.random().toString(36).slice(2, 10);
      write('ps.dev', d);
    }
    return d;
  })();
  /** Apunta en la libreta de ESTE aparato lo que ha cambiado desde la última vez. */
  function fold(s) {
    if (!s) return s;
    s.led = ledOf(s, DEV);
    return s;
  }

  /** Sustituye el contenido de `save` sin cambiar el objeto (otros módulos lo tienen). */
  // Copia `s` sobre la partida SIN cambiar los objetos de dentro (mejoras,
  // Pokémon...): las pantallas abiertas guardan referencias a ellos. Antes se
  // sustituían y una compra hecha justo después de subir la partida se
  // apuntaba en la copia vieja: se cobraban las monedas y la mejora se perdía.
  function assignDeep(dst, src) {
    for (const k of Object.keys(dst)) if (!(k in src)) delete dst[k];
    for (const k in src) {
      if (isObj(src[k]) && isObj(dst[k])) assignDeep(dst[k], src[k]);
      else dst[k] = src[k];
    }
  }
  function applyInPlace(s) {
    assignDeep(save, s);
  }

  // =====================================================================
  //                               MODO LOCAL
  // =====================================================================

  function beginLocal() {
    key = LOCAL;
    guest = false;
    const s = read(K_SAVE + LOCAL);
    save = fold(s ? migrate(s, s.name) : newSave('Entrenador'));
    user = save.name;
    write(K_SES, LOCAL);
    write(K_SAVE + LOCAL, save);
  }

  function restoreLocal() {
    if (read(K_SES) !== LOCAL) return false;
    beginLocal();
    return true;
  }

  // =====================================================================
  //                               MODO NUBE
  // =====================================================================

  let uid = null;
  let pushT = 0,
    retryT = 0,
    pending = false,
    pushing = null,
    lastPush = 0;
  // Lo normal se sube cada 2 h; al cerrar la pestaña, siempre; al cambiar de
  // pestaña, si hace más de 30 min. Lo que vale algo (tiradas, compras,
  // Pokémon nuevos, shinies, premios, récords que entran en un top) se sube
  // enseguida, y al acabar cada partida como mucho cada 30 min. La copia del
  // navegador se guarda siempre al momento (y se fusiona al volver a entrar).
  const PUSH_GAP = 2 * 3600 * 1000,
    PUSH_GAP_URGENT = 15 * 1000,
    PUSH_GAP_RUN = 30 * 60 * 1000,
    HIDE_GAP = 30 * 60 * 1000;
  let syncState = 'local'; // 'ok' | 'syncing' | 'pending' | 'offline' | 'local'
  const listeners = new Set();

  function setSync(s) {
    syncState = s;
    listeners.forEach(fn => {
      try {
        fn(s);
      } catch (e) {
        /* nada */
      }
    });
  }

  /**
   * Llama a nuestro servidor (/api/...). Devuelve el JSON de la respuesta;
   * si falla, lanza { code } (el código HTTP, 'unavailable' sin conexión).
   */
  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
      // Al cerrar la pestaña, la subida sigue aunque la página se vaya (hasta 64 KB).
      if (opts.keepalive && init.body.length < 60000) init.keepalive = true;
    }
    let r;
    try {
      r = await fetch(path, init);
    } catch (e) {
      throw { code: 'unavailable', message: e.message };
    }
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      /* sin cuerpo */
    }
    if (!r.ok) throw { code: r.status, message: (j && j.error) || r.statusText };
    return j;
  }

  /*
   * La nube sólo desde la web oficial: el código está en GitHub, y una copia
   * publicada en otra web llamaría a NUESTRO servidor. Ahí el juego va en
   * modo local. (El servidor tampoco acepta sesiones de otros orígenes.)
   */
  const HOSTS = ['survivor.preciostcg.com', 'localhost', '127.0.0.1'];

  async function initCloud() {
    // npm run dev sin base de datos: sin nube (server/index.mjs).
    if (window.PS_DEV === 'local') {
      localReason = 'dev';
      return false;
    }
    if (!/^https?:$/.test(location.protocol)) {
      localReason = 'file';
      return false;
    }
    if (!HOSTS.includes(location.hostname)) {
      localReason = 'host';
      return false;
    }
    try {
      me = await api('api/me');
    } catch (e) {
      // Sin conexión: si hay copia de la última cuenta, se juega con ella.
      const last = read('ps.lastuid');
      if (e.code === 'unavailable' && last && read(K_CLOUD + last)) {
        me = { cloud: true, offline: true, user: { id: last }, nick: read('ps.nick.' + last) };
      } else throw e;
    }
    if (!me || !me.cloud) {
      localReason = 'config';
      return false;
    }
    addEventListener('online', () => {
      if (pending) pushNow();
    });
    // Al salir de la pestaña se sube lo pendiente, pero no más de una vez cada
    // 30 min (la gente cambia de pestaña a menudo). Lo que no se sube sigue en
    // la copia de este navegador y se sube al volver a entrar.
    const hideFlush = () => {
      if (pending && Date.now() - lastPush > HIDE_GAP) pushNow();
    };
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        hideFlush();
      } else if (hiddenAt && Date.now() - hiddenAt > PULL_GAP) pullSoon();
    });
    // Al cerrar o recargar la página, lo pendiente se sube siempre.
    addEventListener('pagehide', () => {
      if (pending) pushNow(true);
    });
    return true;
  }

  /*
   * Al volver al juego tras más de 30 min fuera (el móvil con la pestaña
   * abierta de ayer), se baja la partida de la nube y se junta con la de aquí:
   * así se ve lo conseguido en el otro aparato. En plena partida se espera a
   * volver al menú.
   */
  const PULL_GAP = 30 * 60 * 1000;
  let lastPull = 0,
    pullT = 0;
  function pullSoon() {
    clearTimeout(pullT);
    if (mode !== 'cloud' || guest || !save || !uid || Date.now() - lastPull < PULL_GAP) return;
    if (pushing || (G.Game && G.Game.state && G.Game.state !== 'ui')) {
      pullT = setTimeout(pullSoon, 20000);
      return;
    }
    lastPull = Date.now();
    const u = uid;
    api('api/save')
      .then(r => {
        if (!r || !r.save || !save || uid !== u) return;
        applyInPlace(merge(plain(fold(save)), migrate(r.save)));
        write(K_CLOUD + uid, save);
        if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
      })
      .catch(e => console.warn('[DB] no se pudo bajar la partida:', e.code || e.message));
  }

  const plain = s => JSON.parse(JSON.stringify(s));

  /** Abre la partida de la nube de la cuenta con la sesión iniciada. */
  async function openCloud() {
    uid = me.user.id;
    const cached = read(K_CLOUD + uid);
    let remote = null,
      online = !me.offline;
    if (online) {
      try {
        remote = (await api('api/save')).save;
      } catch (e) {
        if (!cached) throw e; // sin conexión y sin copia: no hay nada que abrir
        online = false;
      }
    }
    let s = merge(cached && fold(migrate(cached)), remote && migrate(remote));
    if (!s) s = newSave(me.nick || 'Entrenador');
    save = fold(migrate(s, s.name));
    if (me.nick) save.name = me.nick;
    key = uid;
    user = save.name;
    guest = false;
    write(K_CLOUD + uid, save);
    write('ps.lastuid', uid);
    lastPull = Date.now();
    // Sólo se sube si hay algo que la nube no tenga (cuenta nueva, progreso de
    // este aparato sin subir...), y SIN esperar a que acabe para enseñar el menú.
    const same = remote && (!cached || (cached.updated || 0) <= (remote.updated || 0));
    lastPush = Date.now(); // la primera compra o ticket no sube al momento: espera como las demás
    if (!online) {
      pending = true;
      setSync('offline');
      scheduleRetry();
    } else if (same) setSync('ok');
    else pushNow();
  }

  /*
   * Nunca se sube dos veces en menos de 65 s; mientras, todo está en el navegador.
   */
  const K_OK = 'ps.cloudok.',
    MIN_GAP = 65000;
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /**
   * Sube la partida: el servidor la FUSIONA con la que tiene (en una
   * transacción, server/api.mjs) y devuelve el resultado.
   * @param closing  la página se está cerrando: se sube ya (sin esperar los 65 s)
   */
  function pushNow(closing = false) {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // Si ya hay una subida en marcha, se hace otra justo después (para lo que haya cambiado mientras).
    if (pushing) {
      pending = true;
      return pushing.then(() => (pending ? pushNow() : undefined));
    }
    clearTimeout(pushT);
    pushT = 0;
    pushDue = 0;
    if (navigator.onLine === false) {
      pending = true;
      setSync('offline');
      scheduleRetry();
      return Promise.resolve();
    }
    if (!closing && sinceOk() < MIN_GAP) {
      pending = true;
      setSync('pending');
      schedulePush(MIN_GAP - sinceOk() + 500);
      return Promise.resolve();
    }
    pending = false;
    lastPush = Date.now();
    setSync('syncing');
    const req = api('api/save', { method: 'PUT', body: { save: plain(fold(save)) }, keepalive: closing });
    // Si la red se cae a medias, la petición puede quedarse esperando: tope de 12 s.
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000));
    let failed = false;
    pushing = Promise.race([req, timeout])
      .then(r => {
        fails = 0;
        write(K_OK + uid, Date.now());
        // Se FUSIONA con lo de ahora (no se sobrescribe): si has cambiado algo
        // mientras se subía (elegir compañero, una compra...), no se pierde.
        if (r && r.save && save) {
          applyInPlace(merge(plain(fold(save)), migrate(r.save)));
          write(K_CLOUD + uid, save);
        }
        setSync(pending ? 'pending' : 'ok');
        if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
      })
      .catch(e => {
        console.warn('[DB] no se pudo sincronizar:', e.code || e.message);
        pending = true;
        failed = true;
        setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
        scheduleRetry();
      })
      .finally(() => {
        pushing = null;
        // (Si ha fallado, el reintento ya está programado con su espera creciente.)
        if (!failed && pending && syncState === 'pending') schedulePush(Math.max(1500, PUSH_GAP - (Date.now() - lastPush)));
      });
    return pushing;
  }

  // Si ya había una subida programada antes, se respeta (una compra no espera a la siguiente partida).
  let pushDue = 0;
  function schedulePush(ms) {
    const due = Date.now() + ms;
    if (pushT && pushDue && pushDue <= due) return;
    clearTimeout(pushT);
    pushDue = due;
    pushT = setTimeout(() => {
      pushT = 0;
      pushDue = 0;
      pushNow();
    }, ms);
  }
  /** Reintento con espera creciente: 15 s, 30 s, 1 min, 2 min... hasta 10 min. */
  let fails = 0;
  function scheduleRetry() {
    const ms = Math.min(10 * 60e3, 15e3 * Math.pow(2, fails)) * (0.8 + Math.random() * 0.4);
    fails = Math.min(fails + 1, 8);
    clearTimeout(retryT);
    retryT = setTimeout(() => {
      if (pending) pushNow();
    }, ms);
  }

  function errorText(e) {
    const c = e && e.code;
    if (c === 'unavailable') return 'Sin conexión a internet.';
    if (c === 401) return 'Tu sesión ha caducado: vuelve a entrar con Google.';
    return 'Error: ' + ((e && e.message) || c || 'desconocido');
  }

  // =====================================================================
  //                           API PÚBLICA
  // =====================================================================

  let readyP = null;

  /** Arranca la base de datos y recupera la sesión anterior. → true si hay sesión. */
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      try {
        if (await initCloud()) mode = 'cloud';
      } catch (e) {
        console.warn('[DB] sin nube:', e.code || e.message);
        localReason = 'error';
        mode = 'local';
      }
      if (mode === 'local') {
        setSync('local');
        return restoreLocal();
      }
      if (!me.user) return false;
      try {
        await openCloud();
        return true;
      } catch (e) {
        console.warn('[DB] no se pudo abrir la partida:', e.code || e.message);
        return false;
      }
    })();
    return readyP;
  }

  /**
   * Entrar con Google: la página va a Google y vuelve aquí con la sesión
   * iniciada (ready() la recupera). Si algo falla → { ok: false, error }.
   */
  async function loginWithGoogle() {
    if (mode !== 'cloud') return { ok: false, error: 'Entrar con Google necesita la versión publicada del juego.' };
    try {
      const back = location.pathname + location.search;
      const r = await api('api/auth/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: back } });
      if (!r || !r.url) throw { message: 'sin enlace de Google' };
      location.href = r.url;
      return new Promise(() => {}); // la página se va
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  }

  /** Jugar sin cuenta guardando en este navegador (sólo en modo local). */
  function playLocal() {
    beginLocal();
    return { ok: true, isNew: !save.partner };
  }

  /** Cambia el nombre que se ve en la partida (al elegir apodo). */
  function setName(n) {
    if (!save || guest) return;
    save.name = n;
    user = n;
    if (me) me.nick = n;
    commit();
  }

  function playAsGuest() {
    user = 'Invitado';
    key = null;
    guest = true;
    uid = null;
    save = newSave('Invitado');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /**
   * Guarda la partida actual (no hace nada en modo invitado). En el navegador,
   * al momento; en la nube:
   * @param urgent  true: lo que vale algo (tiradas, compras, Pokémon, premios): enseguida
   *                'run': al acabar una partida (como mucho cada 30 min) · false: cada 2 h
   */
  function commit(urgent = false) {
    if (guest || !key || !save) return false;
    save.updated = Date.now();
    fold(save);
    if (mode === 'local') return write(K_SAVE + key, save);
    write(K_CLOUD + uid, save);
    pending = true;
    setSync('pending');
    const gap = urgent === 'run' ? PUSH_GAP_RUN : urgent ? PUSH_GAP_URGENT : PUSH_GAP;
    schedulePush(Math.max(1200, gap - (Date.now() - lastPush)));
    return true;
  }

  /** Funciones que se ejecutan al cerrar sesión o borrar la cuenta (amigos, salas...). */
  const leaveHooks = [];

  async function logout() {
    for (const fn of leaveHooks) {
      try {
        await fn('logout');
      } catch (e) {
        /* nada */
      }
    }
    if (mode === 'cloud' && !guest && save) {
      if (pending) {
        try {
          await pushNow(true);
        } catch (e) {
          /* queda la copia local */
        }
      }
      await api('api/auth/sign-out', { method: 'POST', body: {} }).catch(() => {});
      me = { cloud: true, user: null, nick: null };
    } else if (mode === 'local' && !guest) {
      commit();
      remove(K_SES);
    }
    clearTimeout(pushT);
    clearTimeout(retryT);
    user = key = save = uid = null;
    guest = false;
    pending = false;
    setSync(mode === 'cloud' ? 'ok' : 'local');
  }

  /** Borra la cuenta y la partida (en el servidor o en este navegador). */
  async function deleteAccount() {
    if (guest || !key) return { ok: false, error: 'No hay cuenta que borrar.' };
    if (mode === 'local') {
      remove(K_SAVE + key);
      remove(K_SES);
      user = key = save = null;
      return { ok: true };
    }
    try {
      clearTimeout(pushT);
      clearTimeout(retryT);
      pending = false;
      for (const fn of leaveHooks) await fn('delete');
      // El servidor lo borra todo: partida, apodo, amigos, ranking y la cuenta.
      await api('api/account', { method: 'DELETE' });
      remove(K_CLOUD + uid);
      remove('ps.lastuid');
      me = { cloud: true, user: null, nick: null };
      user = key = save = uid = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  }

  // ---------------- helpers de partida ----------------

  function owns(dex) {
    return !!(save && save.owned[dex]);
  }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) {
    return !!(save && save.shiny && save.shiny[dex]);
  }

  /** Mejoras compradas para un Pokémon: { id -> nivel }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Da la versión shiny (y la normal, si no la tenía). Devuelve true si es nueva. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }

  return {
    ready,
    loginWithGoogle,
    playLocal,
    playAsGuest,
    logout,
    commit,
    deleteAccount,
    flush: pushNow,
    owns,
    grant,
    ownsShiny,
    grantShiny,
    merge,
    setName,
    upgradesOf,
    api,
    onSync(fn) {
      listeners.add(fn);
    },
    onLeave(fn) {
      leaveHooks.push(fn);
    },
    /** ¿Está disponible lo online (amigos, ranking, multijugador)? */
    get online() {
      return mode === 'cloud' && !guest && !!uid && !!save;
    },
    /** El id de la cuenta (sólo en la nube). */
    get uid() {
      return mode === 'cloud' && !guest ? uid : null;
    },
    /** El apodo que tiene reservado en el servidor (o null). */
    get nick() {
      return (me && me.nick) || null;
    },
    /** ¿Es la cuenta de moderación? (ADMIN_EMAILS en el servidor) */
    get isAdmin() {
      return !!(me && me.user && me.user.admin);
    },
    get mode() {
      return mode;
    },
    get localReason() {
      return localReason;
    },
    get syncState() {
      return syncState;
    },
    get user() {
      return user;
    },
    get guest() {
      return guest;
    },
    get save() {
      return save;
    },
    get loggedIn() {
      return !!save;
    },
    get storageOk() {
      return storageOk;
    },
    START_COINS
  };
})();
