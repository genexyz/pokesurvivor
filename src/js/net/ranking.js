/* ============ ranking.js — survival time leaderboard ============
 * Our server (server/api.mjs, Postgres table lb_entries):
 *
 *   POST /api/lb        stores your record on the boards where you improve (the
 *                       server checks that it's possible: anti-cheat)
 *   GET  /api/lb?b=...  a board's top 50 (or only you and your friends) and your position
 *
 *   board = mode + period:
 *     s_d20261008   solo, today               g_...   group
 *     s_w2026-41j   ISO week                  s_m202610j  month
 *     s_all2        all-time
 *     s_all2_p25    all-time with Pikachu only (the per-Pokémon filter only
 *                   exists for all-time)
 *   id = your uid (solo) or the team's uids sorted and joined with "_".
 *
 * Periods are counted in Spanish time (Europe/Madrid).
 */
import { DB } from '../core/db.js';
import { Social } from './social.js';
import { UI } from '../ui/ui.js';

export const Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [
    ['d', 'Daily'],
    ['w', 'Weekly'],
    ['m', 'Monthly'],
    ['a', 'All-time']
  ];
  const TOP = 50;
  // Runs shorter than 2 minutes aren't uploaded (they never make a top that matters).
  const MIN_T = 120;
  const TTL = 60 * 1000; // fetched data is valid for 1 min

  const on = () => DB.online;
  const api = (path, opts) => DB.api(path, opts);

  // ---------------- periods ----------------

  // Built once: a new Intl.DateTimeFormat with a time zone is slow (far more the first time
  // on a phone), and missions ask for the date on every kill (progress.js).
  let dayFmt = null;
  function madridDate(date) {
    dayFmt = dayFmt || new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = {};
    for (const x of dayFmt.formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** ISO week (Monday to Sunday) of a y-m-d date. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  const ALL = 'all2'; // all-time
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  // Madrid's offset from UTC (ms) at a given instant: +1 h in winter, +2 h in summer.
  let clockFmt = null;
  function madridOffset(t) {
    clockFmt =
      clockFmt ||
      new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    const p = {};
    for (const x of clockFmt.formatToParts(new Date(t))) p[x.type] = +x.value;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  }

  /** When the current day ('d') or ISO week ('w') ends: the next Madrid midnight (a Monday for 'w'). */
  function nextReset(kind, date = new Date()) {
    const { y, m, d } = madridDate(date);
    const days = kind === 'w' ? 8 - (new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7) : 1;
    const wall = Date.UTC(y, m - 1, d + days); // that midnight as if Madrid were UTC
    return wall - madridOffset(wall - madridOffset(wall));
  }

  /*
   * Board names: those from periodIds() except week and month, which carry
   * a "j". periodIds() stays the same because missions use it too
   * (progress.js).
   */
  function boardIds(date) {
    const p = periodIds(date);
    return Object.assign({}, p, { w: p.w + 'j', m: p.m + 'j' });
  }

  /** The per-Pokémon filter only exists for all-time. */
  function board(mode, period, dex) {
    return mode + '_' + boardIds()[period] + (dex && period === 'a' ? '_p' + dex : '');
  }

  // ---------------- fetched data (1 min) ----------------

  const mem = new Map(); // board:scope -> { at, p }
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

  // ---------------- anti-cheat ----------------

  /**
   * When the session's FIRST run starts (in a group, the host's) the server
   * records the time: no record can last longer than the real time since then
   * (server/api.mjs). It first waits for the previous run's record to finish
   * uploading.
   */
  let busy = Promise.resolve(),
    runMarked = '';
  function runStarted(mode) {
    if (!on() || runMarked === DB.uid) return;
    runMarked = DB.uid;
    const go = n =>
      api('api/run-start', { method: 'POST', body: { mode } }).catch(e => {
        console.warn('[Ranking] start:', e.code || e.message);
        if (n < 2) setTimeout(() => go(n + 1), 15000);
        else runMarked = '';
      });
    busy.then(() => go(0));
  }
  /** A record's upload (so the next run waits for it to finish). */
  function track(p) {
    busy = p.catch(() => {});
    return p;
  }

  // ---------------- storing ----------------

  /** Stores the entry on each board where it improves. → improved periods */
  async function store(mode, boards, entry) {
    let r;
    try {
      r = await api('api/lb', { method: 'POST', body: { mode, entry, boards: boards.map(x => x[0]) } });
    } catch (e) {
      console.warn('[Ranking] could not store:', e.code || e.message);
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
    const names = { d: 'today', w: 'of the week', m: 'of the month', a: 'all-time' };
    const best = PERIODS.map(p => p[0])
      .filter(p => better.includes(p))
      .pop();
    UI.toast(`New best record ${names[best]} on the leaderboard!`, 3400);
  }

  function submitSolo(r) {
    return track(submitSoloNow(r));
  }
  async function submitSoloNow(r) {
    if (!on() || !Social.me || r.t < MIN_T) return [];
    const ids = boardIds();
    const entry = { t: r.t, uids: [DB.uid], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    const better = await store('s', boards, entry);
    announce(better);
    return better;
  }

  /** Uploaded by the host, with the whole team. */
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

  // ---------------- reading ----------------

  /**
   * A board's best records.
   * @param friendsOnly  only you and your friends
   */
  async function top(mode, period, dex, friendsOnly) {
    if (!on()) return [];
    const r = await fetchBoard(board(mode, period, dex), friendsOnly);
    return (r.rows || []).slice(0, TOP);
  }

  /** Your position on the board (even if you're not in the top). → { pos, t, row } | null */
  async function myRank(mode, period, dex) {
    if (!on()) return null;
    const r = await fetchBoard(board(mode, period, dex), false);
    return r.mine || null;
  }

  /** (When the account is deleted, the server removes your records.) */
  function removeMine() {
    return Promise.resolve();
  }

  // ---------------- reports and moderation ----------------

  /** Reports a suspicious record (once per record and player). → true if it was sent */
  const repKey = () => 'ps.rk.rep.' + (DB.uid || '');
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
      // (If you already reported it from another device, the server doesn't repeat it: no harm.)
      await api('api/report', { method: 'POST', body: { board: b, e: row.id, names: row.names.slice(0, 4), t: row.t | 0 } }).catch(
        () => {}
      );
      done.add(key);
      try {
        localStorage.setItem(repKey(), JSON.stringify([...done].slice(-300)));
      } catch (e) {
        /* full */
      }
    }
    return true;
  }

  // Moderator account (ADMIN_EMAILS on the server): the hidden screen in js/ui/mod-ui.js.
  const isAdmin = () => on() && DB.isAdmin;

  /** Admin: the reports, grouped by record (most reported first). */
  async function reports() {
    return (await api('api/admin/reports')).groups;
  }

  /** Admin: a record's row in its board's top 50 (or null if it's no longer there). */
  async function entryInfo(b, e) {
    const r = await fetchBoard(b, false);
    return (r.rows || []).find(x => x.id === e) || null;
  }

  /** Admin: removes a record from a board. */
  async function removeEntry(b, e) {
    await api('api/admin/remove', { method: 'POST', body: { b, e } }).catch(err =>
      console.warn('[Ranking] remove', b, err.code || err.message)
    );
    forget(b);
  }

  /** Admin: removes a player's or team's record from all current boards (and from `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = boardIds();
    const boards = new Set(PERIODS.map(([p]) => mode + '_' + ids[p]));
    for (const d of dexes) boards.add(mode + '_' + ALL + '_p' + d);
    if (also) boards.add(also);
    await Promise.all([...boards].map(b => removeEntry(b, e)));
  }

  /** Admin: removes records longer than `maxT` seconds from ALL boards. → { rows, boards } */
  async function purgeAbove(maxT) {
    const r = await api('api/admin/purge', { method: 'POST', body: { maxT } });
    forget();
    return r;
  }

  /** Admin: bans or unbans an account from the leaderboard (banned = can't upload records). */
  function setMarked(uid, on) {
    return api('api/admin/ban', { method: 'POST', body: { uid, on: !!on } });
  }
  /** Admin: deletes reports already reviewed. */
  function dismiss(ids) {
    return api('api/admin/dismiss', { method: 'POST', body: { ids } });
  }
  /** Admin: accounts banned from the leaderboard. */
  async function markedAccounts() {
    return (await api('api/admin/banned')).accounts;
  }

  // (What the previous version stored in the browser is no longer useful.)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ps.rk.c.') || k.startsWith('ps.rk.best') || k === 'ps.rk.thr')) localStorage.removeItem(k);
    }
  } catch (e) {
    /* nothing */
  }

  return {
    PERIODS,
    periodIds,
    nextReset,
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
