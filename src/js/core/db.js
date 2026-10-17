/* ============ db.js — database: our server (cloud) or local ============
 * ALL access to persistent data goes through here. The rest of the game only
 * uses DB.*.
 *
 * Two modes (decided in ready()):
 *
 *   CLOUD (our server: server/, with Postgres)
 *     From the official website (or localhost with the server and its database).
 *     Sign-in is Google only. The save is stored on the server and can be
 *     continued on any device. A local copy is also kept so the game can be
 *     played offline; when syncing it is MERGED (save-merge.js): collections
 *     are joined and a Pokémon or a shiny is never lost.
 *
 *   LOCAL (localStorage)
 *     No server (a copy on another website, opened by double-clicking, npm run dev
 *     without a database): one save in this browser, no account.
 *       ps.save.local    the save
 *       ps.session       'local' if it was being played
 *
 * Guest mode plays with an in-memory save that isn't stored.
 */
import { DEX_BY } from '../data/pokedex.js';
import { SaveMerge } from './save-merge.js';
import { Moves } from '../data/moves.js';
import { Upgrades } from '../data/upgrades.js';
import { UI } from '../ui/ui.js';
import { Game } from '../game.js';

export const DB = (() => {
  const K_SES = 'ps.session',
    K_SAVE = 'ps.save.',
    LOCAL = 'local';
  const K_CLOUD = 'ps.cloud.';
  const VERSION = 3;
  const START_COINS = 500;

  let mode = 'local'; // 'cloud' | 'local'
  let localReason = ''; // why there is no cloud: 'dev' | 'file' | 'host' | 'config' | 'error'
  let user = null; // display name
  let key = null; // 'local' or the account id
  let guest = false;
  let save = null;
  let storageOk = true;
  let me = null; // what the server says about the session: { user: { id, admin }, nick }

  // ---------------- safe local storage ----------------

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
      // Browser storage full (mostly from what the leaderboard caches): free what
      // can be spared and retry. The save copy used to silently stop being
      // stored and, on reload, the game went back to the cloud one.
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
      /* nothing */
    }
  }

  // ---------------- save ----------------

  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(), // last modification (for merging)
      coins: START_COINS,
      owned: {}, // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {}, // dex -> { at, from } — shiny variants obtained
      partner: null, // dex of the Pokémon you play with
      partnerShiny: false, // play with its shiny version (if you have it)
      starter: null, // dex you got in the quiz
      personality: null, // { trait, scores }
      pupg: {}, // dex -> { id -> level }: each Pokémon's upgrades
      tickets: { t1: 0, t10: 0 }, // gacha tickets (x1 and x10)
      pity: {}, // banner generation -> pulls without a ★5
      legends: {}, // dex -> date: legendaries defeated in rifts
      arenas: {}, // type -> date: rift arenas won
      story: {}, // stage id -> { at, clears, best }: story stages cleared (= badges; data/stages.js)
      itemsFound: {}, // id -> date: equippable items found
      evoMoves: {}, // id -> date: moves evolved at some point
      ach: {}, // id -> date: achievements earned
      typesMastered: {}, // type -> date: survived 10 minutes with a Pokémon of that type
      weathers: {}, // kind -> date: weathers lived through to the end
      perks: [], // equipped Trainer perks (data/perks.js)
      gifts: {}, // id -> date: one-time gifts claimed (server/api.mjs, claimGift)
      missions: {}, // daily / weekly missions (systems/progress.js)
      profile: { favs: [], title: '' }, // public profile: 3 favourites and title
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

  /** Fills in fields missing from saves of older versions. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Removes the impossible from a hand-edited save (the browser copy can be
   * tampered with): negative or odd numbers, upgrades above the maximum and
   * Pokémon that don't exist. What is possible is checked by the server
   * (server/api.mjs, saves).
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
    if (DEX_BY)
      for (const coll of ['owned', 'shiny']) {
        for (const d of Object.keys(s[coll] || {})) if (!DEX_BY[d]) delete s[coll][d];
      }
    // Shortcuts: 4 slots with an existing move (or null), no repeats.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (Moves && !Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id);
          return id;
        });
      }
    } else s.pbind = {};
    // Ban list: lists of existing moves, no repeats, 3 at most.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!Moves || Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    // Story clears: { at, clears, best } per stage, whole numbers only.
    if (isObj(s.story)) {
      for (const id of Object.keys(s.story)) {
        const r = s.story[id];
        if (!isObj(r)) delete s.story[id];
        else s.story[id] = { at: n(r.at) || Date.now(), clears: Math.max(1, n(r.clears)), best: n(r.best) };
      }
    } else s.story = {};
    if (Upgrades)
      for (const d of Object.keys(s.pupg || {})) {
        const u = s.pupg[d];
        if (!u || typeof u !== 'object') {
          delete s.pupg[d];
          continue;
        }
        for (const id of Object.keys(u)) {
          if (!Upgrades.BY[id]) delete u[id];
          else u[id] = Math.min(Upgrades.BY[id].max, n(u[id]));
        }
      }
  }

  // Merging saves and the coin and ticket ledger: js/core/save-merge.js.
  const { CUR, isObj, ledOf, merge } = SaveMerge;
  // This device (browser): a random name that stays stored.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) {
      d = 'd' + Math.random().toString(36).slice(2, 10);
      write('ps.dev', d);
    }
    return d;
  })();
  /** Records in THIS device's ledger what has changed since last time. */
  function fold(s) {
    if (!s) return s;
    s.led = ledOf(s, DEV);
    return s;
  }

  /** Replaces the contents of `save` without changing the object (other modules hold it). */
  // Copies `s` over the save WITHOUT changing the objects inside (upgrades,
  // Pokémon...): open screens keep references to them. They used to be
  // replaced, and a purchase made right after uploading the save was recorded
  // in the old copy: the coins were charged and the upgrade was lost.
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
  //                               LOCAL MODE
  // =====================================================================

  function beginLocal() {
    key = LOCAL;
    guest = false;
    const s = read(K_SAVE + LOCAL);
    save = fold(s ? migrate(s, s.name) : newSave('Trainer'));
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
  //                               CLOUD MODE
  // =====================================================================

  let uid = null;
  let pushT = 0,
    retryT = 0,
    pending = false,
    pushing = null,
    lastPush = 0;
  // Normal changes are uploaded every 2 h; when closing the tab, always; when
  // switching tabs, if it's been more than 30 min. Valuable things (pulls,
  // purchases, new Pokémon, shinies, rewards, records that enter a top) are
  // uploaded right away, and at the end of each run at most every 30 min. The
  // browser copy is always saved immediately (and merged on the next visit).
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
        /* nothing */
      }
    });
  }

  /**
   * Calls our server (/api/...). Returns the response JSON;
   * on failure it throws { code } (the HTTP status, 'unavailable' when offline).
   */
  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
      // When closing the tab, the upload continues even as the page goes away (up to 64 KB).
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
      /* no body */
    }
    if (!r.ok) throw { code: r.status, message: (j && j.error) || r.statusText };
    return j;
  }

  /*
   * The cloud only from the official website: the code is on GitHub, and a copy
   * published on another website would call OUR server. There the game runs in
   * local mode. (The server doesn't accept sessions from other origins either.)
   */
  const HOSTS = ['survivor.preciostcg.com', 'localhost', '127.0.0.1'];

  async function initCloud() {
    // npm run dev without a database: no cloud (server/index.mjs).
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
      // Offline: if there's a copy of the last account, play with it.
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
    // When leaving the tab, pending changes are uploaded, but no more than once
    // every 30 min (people switch tabs often). What isn't uploaded stays in this
    // browser's copy and is uploaded on the next visit.
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
    // When closing or reloading the page, pending changes are always uploaded.
    addEventListener('pagehide', () => {
      if (pending) pushNow(true);
    });
    return true;
  }

  /*
   * When coming back to the game after more than 30 min away (the phone with
   * yesterday's tab open), the cloud save is downloaded and merged with this one:
   * that way what was earned on the other device shows up. During a run it
   * waits until back in the menu.
   */
  const PULL_GAP = 30 * 60 * 1000;
  let lastPull = 0,
    pullT = 0;
  function pullSoon() {
    clearTimeout(pullT);
    if (mode !== 'cloud' || guest || !save || !uid || Date.now() - lastPull < PULL_GAP) return;
    if (pushing || (Game && Game.state && Game.state !== 'ui')) {
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
        if (UI && UI.refreshCoins) UI.refreshCoins();
      })
      .catch(e => console.warn('[DB] could not download the save:', e.code || e.message));
  }

  const plain = s => JSON.parse(JSON.stringify(s));

  /** Opens the cloud save of the signed-in account. */
  async function openCloud() {
    uid = me.user.id;
    const cached = read(K_CLOUD + uid);
    let remote = null,
      online = !me.offline;
    if (online) {
      try {
        remote = (await api('api/save')).save;
      } catch (e) {
        if (!cached) throw e; // offline and no copy: nothing to open
        online = false;
      }
    }
    let s = merge(cached && fold(migrate(cached)), remote && migrate(remote));
    if (!s) s = newSave(me.nick || 'Trainer');
    save = fold(migrate(s, s.name));
    if (me.nick) save.name = me.nick;
    key = uid;
    user = save.name;
    guest = false;
    write(K_CLOUD + uid, save);
    write('ps.lastuid', uid);
    lastPull = Date.now();
    // Only upload if there's something the cloud doesn't have (new account, this
    // device's progress not yet uploaded...), and WITHOUT waiting for it to show the menu.
    const same = remote && (!cached || (cached.updated || 0) <= (remote.updated || 0));
    lastPush = Date.now(); // the first purchase or ticket isn't uploaded instantly: it waits like the rest
    if (!online) {
      pending = true;
      setSync('offline');
      scheduleRetry();
    } else if (same) setSync('ok');
    else pushNow();
  }

  /*
   * Never upload twice within 65 s; meanwhile, everything is in the browser.
   */
  const K_OK = 'ps.cloudok.',
    MIN_GAP = 65000;
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /**
   * Uploads the save: the server MERGES it with the one it has (in a
   * transaction, server/api.mjs) and returns the result.
   * @param closing  the page is closing: upload now (without waiting the 65 s)
   */
  function pushNow(closing = false) {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // If an upload is already running, do another right after (for whatever changed meanwhile).
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
    // If the network drops midway, the request may hang: 12 s cap.
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000));
    let failed = false;
    pushing = Promise.race([req, timeout])
      .then(r => {
        fails = 0;
        write(K_OK + uid, Date.now());
        // MERGED with the current state (not overwritten): if you changed something
        // while it was uploading (choosing a partner, a purchase...), it isn't lost.
        if (r && r.save && save) {
          applyInPlace(merge(plain(fold(save)), migrate(r.save)));
          write(K_CLOUD + uid, save);
        }
        setSync(pending ? 'pending' : 'ok');
        if (UI && UI.refreshCoins) UI.refreshCoins();
      })
      .catch(e => {
        console.warn('[DB] could not sync:', e.code || e.message);
        pending = true;
        failed = true;
        setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
        scheduleRetry();
      })
      .finally(() => {
        pushing = null;
        // (If it failed, the retry is already scheduled with its growing delay.)
        if (!failed && pending && syncState === 'pending') schedulePush(Math.max(1500, PUSH_GAP - (Date.now() - lastPush)));
      });
    return pushing;
  }

  /**
   * Claims a one-time gift (once per account, the server decides): uploads the
   * save with it and keeps the result. → { ok } or { ok: false, claimed } or { ok: false, error }.
   */
  async function claimGift(id) {
    if (mode !== 'cloud' || guest || !save || !uid) return { ok: false, error: 'Sign in with Google to claim it.' };
    if (pushing) await pushing.catch(() => {});
    try {
      const r = await api('api/gift', { method: 'POST', body: { id, save: plain(fold(save)) } });
      if (r && r.save && save) {
        applyInPlace(merge(plain(fold(save)), migrate(r.save)));
        write(K_CLOUD + uid, save);
        write(K_OK + uid, Date.now());
      }
      if (UI && UI.refreshCoins) UI.refreshCoins();
      return { ok: !!(r && r.ok), claimed: !!(r && r.claimed) };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  }

  // If an upload was already scheduled earlier, keep it (a purchase doesn't wait for the next run).
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
  /** Retry with a growing delay: 15 s, 30 s, 1 min, 2 min... up to 10 min. */
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
    if (c === 'unavailable') return 'No internet connection.';
    if (c === 401) return 'Your session has expired: sign in with Google again.';
    return 'Error: ' + ((e && e.message) || c || 'unknown');
  }

  // =====================================================================
  //                           PUBLIC API
  // =====================================================================

  let readyP = null;

  /** Starts the database and restores the previous session. → true if there is a session. */
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      try {
        if (await initCloud()) mode = 'cloud';
      } catch (e) {
        console.warn('[DB] no cloud:', e.code || e.message);
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
        console.warn('[DB] could not open the save:', e.code || e.message);
        return false;
      }
    })();
    return readyP;
  }

  /**
   * Sign in with Google: the page goes to Google and comes back here signed in
   * (ready() restores the session). If something fails → { ok: false, error }.
   */
  async function loginWithGoogle() {
    if (mode !== 'cloud') return { ok: false, error: 'Google sign-in needs the online version of the game.' };
    try {
      const back = location.pathname + location.search;
      const r = await api('api/auth/sign-in/social', { method: 'POST', body: { provider: 'google', callbackURL: back } });
      if (!r || !r.url) throw { message: 'no Google link' };
      location.href = r.url;
      return new Promise(() => {}); // the page goes away
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  }

  /** Play without an account, saving in this browser (local mode only). */
  function playLocal() {
    beginLocal();
    return { ok: true, isNew: !save.partner };
  }

  /** Changes the name shown in the save (when choosing a nickname). */
  function setName(n) {
    if (!save || guest) return;
    save.name = n;
    user = n;
    if (me) me.nick = n;
    commit();
  }

  function playAsGuest() {
    user = 'Guest';
    key = null;
    guest = true;
    uid = null;
    save = newSave('Guest');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /**
   * Saves the current game (does nothing in guest mode). In the browser,
   * immediately; in the cloud:
   * @param urgent  true: valuable things (pulls, purchases, Pokémon, rewards): right away
   *                'run': at the end of a run (at most every 30 min) · false: every 2 h
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

  /** Functions run when logging out or deleting the account (friends, rooms...). */
  const leaveHooks = [];

  async function logout() {
    for (const fn of leaveHooks) {
      try {
        await fn('logout');
      } catch (e) {
        /* nothing */
      }
    }
    if (mode === 'cloud' && !guest && save) {
      if (pending) {
        try {
          await pushNow(true);
        } catch (e) {
          /* the local copy remains */
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

  /** Deletes the account and the save (on the server or in this browser). */
  async function deleteAccount() {
    if (guest || !key) return { ok: false, error: 'There is no account to delete.' };
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
      // The server deletes everything: save, nickname, friends, leaderboard and the account.
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

  // ---------------- save helpers ----------------

  function owns(dex) {
    return !!(save && save.owned[dex]);
  }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) {
    return !!(save && save.shiny && save.shiny[dex]);
  }

  /** Upgrades bought for a Pokémon: { id -> level }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Grants the shiny version (and the normal one, if missing). Returns true if it's new. */
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
    claimGift,
    api,
    onSync(fn) {
      listeners.add(fn);
    },
    onLeave(fn) {
      leaveHooks.push(fn);
    },
    /** Are online features available (friends, leaderboard, multiplayer)? */
    get online() {
      return mode === 'cloud' && !guest && !!uid && !!save;
    },
    /** The account id (cloud only). */
    get uid() {
      return mode === 'cloud' && !guest ? uid : null;
    },
    /** The nickname reserved on the server (or null). */
    get nick() {
      return (me && me.nick) || null;
    },
    /** Is this a moderator account? (ADMIN_EMAILS on the server) */
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
