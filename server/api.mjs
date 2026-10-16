/* /api/...: save, nickname and profile, leaderboard (with anti-cheat) and moderation.
 * The live part (friends, online status, invites, rooms) is in live.mjs.
 */
import { createRequire } from 'node:module';
import { q, tx } from './db.mjs';
import { userOf } from './auth.mjs';
import * as live from './live.mjs';

const require = createRequire(import.meta.url);
// The same save merge the browser uses.
const { merge } = require('../src/js/core/save-merge.js');

export const NICK = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
const BOARD = /^[sg]_(d\d{8}|w\d{4}-\d{2}j|m\d{6}j|all2)(_p\d{1,4})?$/;
const MAX_SAVE = 768 * 1024;
const TOP = 50;

class HttpError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}
const fail = (status, msg) => {
  throw new HttpError(status, msg);
};

function readBody(req, limit = MAX_SAVE + 4096) {
  return new Promise((res, rej) => {
    let n = 0;
    const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > limit) {
        rej(new HttpError(413, 'Too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!n) return res({});
      try {
        res(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        rej(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', rej);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const int = v => (Number.isFinite(+v) ? Math.floor(+v) : NaN);

// ---------------- save ----------------

async function getSave(u) {
  const r = await q('SELECT save, ban FROM saves WHERE uid = $1', [u.id]);
  return r.rows[0] ? { save: r.rows[0].save, ban: r.rows[0].ban } : { save: null };
}

/** Uploads the save: it is MERGED with the stored one (row locked meanwhile) and the result is returned. */
async function putSave(u, body) {
  const incoming = body.save;
  if (!isObj(incoming)) fail(400, 'Missing save');
  const merged = await tx(async c => {
    const r = await c.query('SELECT save FROM saves WHERE uid = $1 FOR UPDATE', [u.id]);
    const m = r.rows[0] ? merge(incoming, r.rows[0].save) : incoming;
    // What the server doesn't allow: negative or odd balances.
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    m.coins = n(m.coins);
    m.tickets = isObj(m.tickets) ? m.tickets : {};
    m.tickets.t1 = n(m.tickets.t1);
    m.tickets.t10 = n(m.tickets.t10);
    const json = JSON.stringify(m);
    if (json.length > MAX_SAVE) fail(413, 'Save too large');
    // (ban is left alone: only moderation changes it.)
    await c.query(
      `INSERT INTO saves (uid, save, v, updated_at) VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (uid) DO UPDATE SET save = EXCLUDED.save, v = EXCLUDED.v, updated_at = now()`,
      [u.id, json, int(m.v) || 3]
    );
    return m;
  });
  return { save: merged };
}

/** Deletes the account and everything that belongs to it. */
async function deleteAccount(u) {
  await tx(async c => {
    for (const sql of [
      'DELETE FROM saves WHERE uid = $1',
      'DELETE FROM profiles WHERE uid = $1',
      'DELETE FROM friendships WHERE a = $1 OR b = $1',
      'DELETE FROM run_starts WHERE uid = $1',
      'DELETE FROM lb_entries WHERE $1 = ANY(uids)',
      'DELETE FROM reports WHERE by_uid = $1',
      'DELETE FROM "session" WHERE "userId" = $1',
      'DELETE FROM "account" WHERE "userId" = $1',
      'DELETE FROM "user" WHERE id = $1'
    ])
      await c.query(sql, [u.id]);
  });
  live.onAccountDeleted(u.id);
  return { ok: true };
}

// ---------------- nickname and profile ----------------

export async function nickOf(uid) {
  const r = await q('SELECT name FROM profiles WHERE uid = $1', [uid]);
  return r.rows[0] ? r.rows[0].name : null;
}

async function claimNick(u, body) {
  const name = String(body.name || '').trim();
  if (!NICK.test(name)) fail(400, 'The nickname must be 3-16 letters, numbers or _.');
  const mine = await nickOf(u.id);
  if (mine) return { ok: true, name: mine }; // the nickname can't be changed
  try {
    await q('INSERT INTO profiles (uid, name, lower) VALUES ($1, $2, $3)', [u.id, name, name.toLowerCase()]);
  } catch (e) {
    if (e.code === '23505') return { ok: false, error: 'That nickname is already taken.' };
    throw e;
  }
  live.onNick(u.id, name);
  return { ok: true, name };
}

/** What others see of you: favourites, title, records and medals (without the nickname). */
function cleanProfile(d) {
  d = isObj(d) ? d : {};
  const best = isObj(d.best) ? d.best : {};
  const nb = {};
  for (const k of ['solo', 'group', 'level', 'bosses', 'legends', 'kills', 'medals']) nb[k] = Math.max(0, int(best[k]) || 0);
  return {
    favs: (Array.isArray(d.favs) ? d.favs : []).slice(0, 3).map(f => ({ dex: int(f && f.dex) || 0, shiny: !!(f && f.shiny) })),
    title: String(d.title || '').slice(0, 40),
    best: nb,
    medals: (Array.isArray(d.medals) ? d.medals : []).slice(0, 8).map(m => String(m).slice(0, 40))
  };
}

async function putProfile(u, body) {
  const r = await q('UPDATE profiles SET data = $2::jsonb, at = now() WHERE uid = $1', [u.id, JSON.stringify(cleanProfile(body))]);
  if (!r.rowCount) fail(409, 'Choose your nickname first.');
  return { ok: true };
}

async function getProfile(uid) {
  const r = await q('SELECT name, data FROM profiles WHERE uid = $1', [uid]);
  if (!r.rows[0]) return { profile: null };
  return { profile: Object.assign({}, r.rows[0].data, { name: r.rows[0].name }) };
}

// ---------------- leaderboard ----------------

async function runStart(u, body) {
  const mode = body.mode === 'g' ? 'g' : 's';
  await q(
    `INSERT INTO run_starts (uid, started_at, mode) VALUES ($1, now(), $2)
     ON CONFLICT (uid) DO UPDATE SET started_at = now(), mode = EXCLUDED.mode`,
    [u.id, mode]
  );
  return { ok: true };
}

const rowOf = r => ({ id: r.id, t: r.t, uids: r.uids, names: r.names, dex: r.dex, shiny: r.shiny, lv: r.lv, kills: r.kills });

/**
 * Stores a record on the boards where it improves. What the Firestore rules
 * used to check (validEntry): a possible duration since the session started,
 * possible level and defeated count, account not banned, well-formed team.
 */
async function submit(u, body) {
  const mode = body.mode === 'g' ? 'g' : 's';
  const e = isObj(body.entry) ? body.entry : fail(400, 'Missing record');
  const t = int(e.t),
    lv = int(e.lv),
    kills = int(e.kills);
  if (!(t >= 1 && t <= 3600)) fail(400, 'Invalid time');
  if (!(lv >= 0 && lv <= 10 + t / 4) || !(kills >= 0 && kills <= 100 + t * 12)) fail(400, 'Impossible record');
  const uids = Array.isArray(e.uids) ? e.uids.map(String) : [];
  const n = uids.length;
  const dex = (Array.isArray(e.dex) ? e.dex : []).map(int);
  const shiny = (Array.isArray(e.shiny) ? e.shiny : []).map(Boolean);
  if (dex.length !== n || shiny.length !== n || dex.some(d => !(d > 0 && d < 10000))) fail(400, 'Invalid team');
  let id;
  if (mode === 's') {
    if (n !== 1 || uids[0] !== u.id) fail(400, 'Invalid team');
    id = u.id;
  } else {
    const sorted = [...uids].sort();
    if (n < 2 || n > 4 || new Set(uids).size !== n || !uids.includes(u.id) || sorted.join() !== uids.join()) fail(400, 'Invalid team');
    id = uids.join('_');
  }
  const boards = [...new Set(Array.isArray(body.boards) ? body.boards : [])];
  if (!boards.length || boards.length > 12 || boards.some(b => typeof b !== 'string' || !BOARD.test(b) || b[0] !== mode))
    fail(400, 'Invalid boards');
  const chk = await q(
    `SELECT EXTRACT(EPOCH FROM (now() - r.started_at)) AS secs, COALESCE(s.ban, false) AS ban
       FROM run_starts r LEFT JOIN saves s ON s.uid = r.uid WHERE r.uid = $1`,
    [u.id]
  );
  if (!chk.rows[0]) fail(403, 'No run started');
  if (chk.rows[0].ban) fail(403, 'Account excluded from the leaderboard');
  if (t > +chk.rows[0].secs + 30) fail(403, 'Impossible record');
  // Nicknames come from the server (not from whatever the host sends).
  const pr = await q('SELECT uid, name FROM profiles WHERE uid = ANY($1)', [uids]);
  const nameBy = new Map(pr.rows.map(r => [r.uid, r.name]));
  if (nameBy.size !== n) fail(400, 'A player has no nickname');
  const names = uids.map(x => nameBy.get(x));
  const better = [];
  for (const b of boards) {
    const r = await q(
      `INSERT INTO lb_entries (board, id, t, uids, names, dex, shiny, lv, kills, at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (board, id) DO UPDATE SET t = EXCLUDED.t, uids = EXCLUDED.uids, names = EXCLUDED.names,
         dex = EXCLUDED.dex, shiny = EXCLUDED.shiny, lv = EXCLUDED.lv, kills = EXCLUDED.kills, at = now()
       WHERE lb_entries.t < EXCLUDED.t
       RETURNING board`,
      [b, id, t, uids, names, dex, shiny, lv, kills]
    );
    if (r.rowCount) better.push(b);
  }
  return { better };
}

/** A board's top 50 (or only you and your friends) and your position. */
async function board(u, url) {
  const b = url.searchParams.get('b') || '';
  if (!BOARD.test(b)) fail(400, 'Invalid board');
  let rows;
  if (url.searchParams.get('scope') === 'friends') {
    const circle = [u.id, ...(await live.friendIds(u.id))];
    rows = (await q(`SELECT * FROM lb_entries WHERE board = $1 AND uids && $2 ORDER BY t DESC, at ASC LIMIT ${TOP}`, [b, circle])).rows.map(
      rowOf
    );
  } else rows = (await q(`SELECT * FROM lb_entries WHERE board = $1 ORDER BY t DESC, at ASC LIMIT ${TOP}`, [b])).rows.map(rowOf);
  const m = await q(`SELECT * FROM lb_entries WHERE board = $1 AND $2 = ANY(uids) ORDER BY t DESC LIMIT 1`, [b, u.id]);
  let mine = null;
  if (m.rows[0]) {
    const c = await q('SELECT COUNT(*)::int AS n FROM lb_entries WHERE board = $1 AND t > $2', [b, m.rows[0].t]);
    mine = { pos: c.rows[0].n + 1, t: m.rows[0].t, row: rowOf(m.rows[0]) };
  }
  return { rows, mine };
}

async function report(u, body) {
  const b = String(body.board || ''),
    e = String(body.e || '');
  if (!BOARD.test(b) || !/^[A-Za-z0-9_]{1,200}$/.test(e)) fail(400, 'Invalid report');
  const names = (Array.isArray(body.names) ? body.names : []).slice(0, 4).map(x => String(x).slice(0, 16));
  await q('INSERT INTO reports (board, e, by_uid, names, t) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [
    b,
    e,
    u.id,
    names,
    Math.max(0, int(body.t) || 0)
  ]);
  return { ok: true };
}

// ---------------- moderation ----------------

const admin = {
  async reports() {
    const r = await q('SELECT board, e, by_uid, names, t, at FROM reports ORDER BY at DESC LIMIT 400');
    const by = new Map();
    for (const v of r.rows) {
      const k = v.board + '__' + v.e;
      if (!by.has(k)) by.set(k, { board: v.board, e: v.e, names: v.names || [], t: v.t, n: 0, ids: [], at: +v.at });
      const g = by.get(k);
      g.n++;
      g.ids.push(k + '__' + v.by_uid);
    }
    return { groups: [...by.values()].sort((a, b) => b.n - a.n || b.at - a.at) };
  },
  async remove(body) {
    await q('DELETE FROM lb_entries WHERE board = $1 AND id = $2', [String(body.b), String(body.e)]);
    return { ok: true };
  },
  async purge(body) {
    const maxT = int(body.maxT) || 3600;
    const r = await q('DELETE FROM lb_entries WHERE t > $1 RETURNING board', [maxT]);
    return { rows: r.rowCount, boards: new Set(r.rows.map(x => x.board)).size };
  },
  async ban(body) {
    await q(
      `INSERT INTO saves (uid, save, ban) VALUES ($1, '{}'::jsonb, $2)
       ON CONFLICT (uid) DO UPDATE SET ban = EXCLUDED.ban`,
      [String(body.uid), !!body.on]
    );
    return { ok: true };
  },
  async dismiss(body) {
    for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 500)) {
      const [b, e, by] = String(id).split('__');
      await q('DELETE FROM reports WHERE board = $1 AND e = $2 AND by_uid = $3', [b, e, by]);
    }
    return { ok: true };
  },
  async banned() {
    const r = await q(`SELECT uid, save FROM saves WHERE ban LIMIT 100`);
    return {
      accounts: r.rows.map(x => {
        const v = x.save || {};
        return {
          uid: x.uid,
          name: v.name || '?',
          coins: v.coins || 0,
          t1: (v.tickets || {}).t1 || 0,
          t10: (v.tickets || {}).t10 || 0,
          owned: Object.keys(v.owned || {}).length
        };
      })
    };
  }
};

// ---------------- routes ----------------

/** Handles /api/* (except /api/auth/*, which belongs to better-auth). */
export async function handleApi(req, res, url) {
  try {
    const p = url.pathname,
      m = req.method;
    // Only requests from our own website (on top of the SameSite cookie).
    if (m !== 'GET' && req.headers.origin && req.headers.origin !== live.ORIGIN) fail(403, 'Origin not allowed');
    if (p === '/api/me' && m === 'GET') {
      const u = await userOf(req);
      return send(res, 200, {
        cloud: true,
        now: Date.now(),
        user: u ? { id: u.id, admin: u.admin } : null,
        nick: u ? await nickOf(u.id) : null
      });
    }
    const u = await userOf(req);
    if (!u) fail(401, 'Please sign in');
    const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(req);
    let out;
    if (p === '/api/save' && m === 'GET') out = await getSave(u);
    else if (p === '/api/save' && m === 'PUT') out = await putSave(u, body);
    else if (p === '/api/account' && m === 'DELETE') out = await deleteAccount(u);
    else if (p === '/api/nick' && m === 'POST') out = await claimNick(u, body);
    else if (p === '/api/profile' && m === 'PUT') out = await putProfile(u, body);
    else if (p.startsWith('/api/profile/') && m === 'GET') out = await getProfile(decodeURIComponent(p.slice(13)));
    else if (p === '/api/run-start' && m === 'POST') out = await runStart(u, body);
    else if (p === '/api/lb' && m === 'POST') out = await submit(u, body);
    else if (p === '/api/lb' && m === 'GET') out = await board(u, url);
    else if (p === '/api/report' && m === 'POST') out = await report(u, body);
    else if (p.startsWith('/api/admin/')) {
      if (!u.admin) fail(403, 'Moderators only');
      const fn = admin[p.slice(11)];
      if (!fn) fail(404, 'Not found');
      out = await fn(body);
    } else fail(404, 'Not found');
    send(res, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error('[api]', req.method, url.pathname, e);
    send(res, 500, { error: 'Server error' });
  }
}
