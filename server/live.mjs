/* /ws: the live part (WebSocket).
 *   - online: you're online if you have the game open (a connected socket)
 *   - friends: the list is sent on connect and every time it changes
 *   - room invites (last 3 min, friends only)
 *   - co-op rooms (up to 4) and WebRTC SIGNALLING: the offers, answers and
 *     candidates browsers need to connect directly. The game itself does NOT
 *     go through here (net.js).
 * Rooms, invites and "online" live in memory (a single process): if the
 * server restarts the rooms are lost, but running games carry on (they go
 * directly between browsers) and clients reconnect on their own.
 *
 * Client messages:  { i?, m, a }  (with i, the reply is { t: 'res', i, ok, ... })
 * Server messages: { t: 'hello' | 'friends' | 'presence' | 'invites' | 'room' | 'sig' | 'res', ... }
 */
import { WebSocketServer } from 'ws';
import { q } from './db.mjs';
import { BASE_URL, userOf } from './auth.mjs';
import { NICK, nickOf } from './api.mjs';

export const ORIGIN = new URL(BASE_URL).origin;
const MAX_PLAYERS = 4;
const INVITE_TTL = 3 * 60 * 1000;
const GRACE = 15 * 1000; // if the connection drops, the room seat is kept for this long

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const socks = new Map(); // uid -> Set<ws>
const playing = new Map(); // uid -> bool
const rooms = new Map(); // id -> { id, host, open, members: Map(uid -> { name, dex, shiny, at, ws }) }
const roomOf = new Map(); // uid -> roomId
const invites = new Map(); // toUid -> Map(fromUid -> { from, name, room, at })
const grace = new Map(); // uid -> timeout
const friendCache = new Map(); // uid -> Set of confirmed friends (only for connected users)

// ---------------- sending ----------------

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function sendUser(uid, msg) {
  for (const ws of socks.get(uid) || []) sendTo(ws, msg);
}
const online = uid => socks.has(uid);

// ---------------- friends ----------------

/** Someone's confirmed friends. */
export async function friendIds(uid) {
  if (friendCache.has(uid)) return [...friendCache.get(uid)];
  const r = await q(`SELECT CASE WHEN a = $1 THEN b ELSE a END AS o FROM friendships WHERE (a = $1 OR b = $1) AND status = 'ok'`, [uid]);
  const ids = r.rows.map(x => x.o);
  if (online(uid)) friendCache.set(uid, new Set(ids));
  return ids;
}

function presenceOf(uid) {
  const on = online(uid);
  return { online: on, play: on && !!playing.get(uid), room: (on && roomOf.get(uid)) || '' };
}

async function friendList(uid) {
  const r = await q(
    `SELECT f.a, f.b, f.from_uid, f.status, p.name
       FROM friendships f
       LEFT JOIN profiles p ON p.uid = CASE WHEN f.a = $1 THEN f.b ELSE f.a END
      WHERE f.a = $1 OR f.b = $1`,
    [uid]
  );
  return r.rows.map(f => {
    const other = f.a === uid ? f.b : f.a;
    const status = f.status === 'ok' ? 'ok' : f.from_uid === uid ? 'out' : 'in';
    const base = { uid: other, name: f.name || '???', status, online: false, play: false, room: '' };
    return status === 'ok' ? Object.assign(base, presenceOf(other)) : base;
  });
}

async function pushFriends(uid) {
  friendCache.delete(uid);
  if (!online(uid)) return;
  await friendIds(uid);
  sendUser(uid, { t: 'friends', list: await friendList(uid) });
}

/** Tells connected friends that your "online" status (or your room) changed. */
async function pushPresence(uid) {
  try {
    const p = Object.assign({ t: 'presence', uid }, presenceOf(uid));
    for (const f of await friendIds(uid)) if (online(f)) sendUser(f, p);
  } catch (e) {
    console.error('[live] presence:', e.message);
  }
}

const pairOf = (x, y) => (x < y ? [x, y] : [y, x]);

async function friendRequest(uid, a) {
  const me = await nickOf(uid);
  if (!me) return { ok: false, error: 'Choose your nickname first.' };
  const name = String((a && a.name) || '').trim();
  if (!NICK.test(name)) return { ok: false, error: "Type your friend's exact nickname." };
  const r = await q('SELECT uid, name FROM profiles WHERE lower = $1', [name.toLowerCase()]);
  if (!r.rows[0]) return { ok: false, error: "There's no player with that nickname." };
  const other = r.rows[0].uid;
  if (other === uid) return { ok: false, error: "That's you." };
  const [x, y] = pairOf(uid, other);
  const f = (await q('SELECT from_uid, status FROM friendships WHERE a = $1 AND b = $2', [x, y])).rows[0];
  if (f && f.status === 'ok') return { ok: false, error: "You're already friends." };
  if (f && f.from_uid === uid) return { ok: false, error: 'You already sent them a request.' };
  if (f) return friendAccept(uid, { uid: other });
  await q('INSERT INTO friendships (a, b, from_uid) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [x, y, uid]);
  await Promise.all([pushFriends(uid), pushFriends(other)]);
  return { ok: true, msg: 'Request sent to ' + r.rows[0].name };
}

async function friendAccept(uid, a) {
  const other = String((a && a.uid) || '');
  const [x, y] = pairOf(uid, other);
  const r = await q(
    `UPDATE friendships SET status = 'ok', at = now() WHERE a = $1 AND b = $2 AND status = 'pending' AND from_uid <> $3 RETURNING 1`,
    [x, y, uid]
  );
  if (!r.rowCount) return { ok: false, error: "There's no request." };
  await Promise.all([pushFriends(uid), pushFriends(other)]);
  return { ok: true, msg: "You're now friends with " + ((await nickOf(other)) || '???') };
}

async function friendRemove(uid, a) {
  const other = String((a && a.uid) || '');
  const [x, y] = pairOf(uid, other);
  await q('DELETE FROM friendships WHERE a = $1 AND b = $2', [x, y]);
  dropInvite(uid, other);
  dropInvite(other, uid);
  await Promise.all([pushFriends(uid), pushFriends(other)]);
  return { ok: true };
}

// ---------------- invites ----------------

function invitesOf(uid) {
  const m = invites.get(uid);
  if (!m) return [];
  const t = Date.now();
  for (const [k, v] of m) if (t - v.at > INVITE_TTL) m.delete(k);
  return [...m.values()];
}
function pushInvites(uid) {
  sendUser(uid, { t: 'invites', list: invitesOf(uid) });
}
function dropInvite(to, from) {
  const m = invites.get(to);
  if (m && m.delete(from)) pushInvites(to);
}
/** When a room closes, its invites are withdrawn. */
function dropRoomInvites(roomId) {
  for (const [to, m] of invites)
    for (const [from, v] of m)
      if (v.room === roomId) {
        m.delete(from);
        pushInvites(to);
      }
}

async function invite(uid, ws, a) {
  const to = String((a && a.to) || '');
  if (!(await friendIds(uid)).includes(to)) return { ok: false, error: 'You can only invite your friends.' };
  let room = rooms.get(roomOf.get(uid));
  if (room && room.host !== uid) return { ok: false, error: 'Only the room host can invite.' };
  if (room && room.members.size >= MAX_PLAYERS) return { ok: false, error: 'The room is full.' };
  if (!room) room = await createRoom(uid, ws, a && a.me);
  if (!invites.has(to)) invites.set(to, new Map());
  const name = (await nickOf(uid)) || '???';
  invites.get(to).set(uid, { from: uid, name, room: room.id, at: Date.now() });
  pushInvites(to);
  setTimeout(() => pushInvites(to), INVITE_TTL + 1000); // expired: drop it from the list
  return { ok: true, msg: 'Invite sent to ' + ((await nickOf(to)) || '???'), room: roomState(room) };
}

// ---------------- rooms ----------------

function newId() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = '';
    for (let i = 0; i < 6; i++) id += A[Math.floor(Math.random() * A.length)];
  } while (rooms.has(id));
  return id;
}

function roomState(room) {
  return {
    id: room.id,
    host: room.host,
    open: room.open,
    members: [...room.members].map(([uid, m]) => ({ uid, name: m.name, dex: m.dex, shiny: m.shiny, at: m.at }))
  };
}
function pushRoom(room) {
  const st = roomState(room);
  for (const m of room.members.values()) sendTo(m.ws, { t: 'room', room: st });
}

async function memberOf(uid, ws, info) {
  info = info || {};
  return {
    name: (await nickOf(uid)) || '???',
    dex: Number.isInteger(info.dex) ? info.dex : null,
    shiny: !!info.shiny,
    at: Date.now(),
    ws
  };
}

async function createRoom(uid, ws, info) {
  if (roomOf.has(uid)) leaveRoom(uid);
  const room = { id: newId(), host: uid, open: true, members: new Map() };
  room.members.set(uid, await memberOf(uid, ws, info));
  rooms.set(room.id, room);
  roomOf.set(uid, room.id);
  pushRoom(room);
  pushPresence(uid);
  return room;
}

async function joinRoom(uid, ws, id, info) {
  const room = rooms.get(id);
  if (room && room.members.has(uid)) {
    room.members.get(uid).ws = ws;
    return { ok: true, room: roomState(room) };
  }
  if (!room) return { ok: false, error: 'That room no longer exists.' };
  if (!room.open) return { ok: false, error: "That room's game has already started." };
  if (room.members.size >= MAX_PLAYERS) return { ok: false, error: 'The room is full (max ' + MAX_PLAYERS + ').' };
  if (roomOf.has(uid)) leaveRoom(uid);
  room.members.set(uid, await memberOf(uid, ws, info));
  roomOf.set(uid, id);
  pushRoom(room);
  pushPresence(uid);
  return { ok: true, room: roomState(room) };
}

/** You leave the room; if you were the host, the room closes for everyone. */
function leaveRoom(uid) {
  clearTimeout(grace.get(uid));
  grace.delete(uid);
  const room = rooms.get(roomOf.get(uid));
  roomOf.delete(uid);
  if (!room) return;
  if (room.host === uid) {
    rooms.delete(room.id);
    dropRoomInvites(room.id);
    for (const [m, info] of room.members) {
      if (m === uid) continue;
      roomOf.delete(m);
      sendTo(info.ws, { t: 'room', room: null, closed: true });
      pushPresence(m);
    }
  } else {
    room.members.delete(uid);
    pushRoom(room);
  }
  pushPresence(uid);
}

// ---------------- connection ----------------

const METHODS = {
  'friend.request': (uid, ws, a) => friendRequest(uid, a),
  'friend.accept': (uid, ws, a) => friendAccept(uid, a),
  'friend.remove': (uid, ws, a) => friendRemove(uid, a),
  async play(uid, ws, a) {
    playing.set(uid, !!(a && a.on));
    pushPresence(uid);
    return { ok: true };
  },
  async 'room.create'(uid, ws, a) {
    return { ok: true, room: roomState(await createRoom(uid, ws, a && a.me)) };
  },
  'room.join': (uid, ws, a) => joinRoom(uid, ws, String((a && a.id) || ''), a && a.me),
  /** After reconnecting: does the room still exist? (if not, the client treats it as closed) */
  async 'room.resume'(uid, ws, a) {
    const room = rooms.get(String((a && a.id) || ''));
    if (!room || !room.members.has(uid)) return { ok: false };
    clearTimeout(grace.get(uid));
    grace.delete(uid);
    room.members.get(uid).ws = ws;
    roomOf.set(uid, room.id);
    return { ok: true, room: roomState(room) };
  },
  async 'room.leave'(uid) {
    leaveRoom(uid);
    return { ok: true };
  },
  async 'room.open'(uid, ws, a) {
    const room = rooms.get(roomOf.get(uid));
    if (!room || room.host !== uid) return { ok: false };
    room.open = !!(a && a.open);
    if (!room.open) dropRoomInvites(room.id);
    pushRoom(room);
    return { ok: true };
  },
  async 'room.member'(uid, ws, a) {
    const room = rooms.get(roomOf.get(uid));
    const m = room && room.members.get(uid);
    if (!m) return { ok: false };
    if (Number.isInteger(a && a.dex)) m.dex = a.dex;
    m.shiny = !!(a && a.shiny);
    pushRoom(room);
    return { ok: true };
  },
  invite: (uid, ws, a) => invite(uid, ws, a),
  async 'invite.accept'(uid, ws, a) {
    const from = String((a && a.from) || '');
    const inv = invitesOf(uid).find(v => v.from === from);
    dropInvite(uid, from);
    if (!inv) return { ok: false, error: 'The invite has expired.' };
    return joinRoom(uid, ws, inv.room, a && a.me);
  },
  async 'invite.decline'(uid, ws, a) {
    dropInvite(uid, String((a && a.from) || ''));
    return { ok: true };
  },
  /** WebRTC signalling: only between members of the same room. */
  async sig(uid, ws, a) {
    const room = rooms.get(roomOf.get(uid));
    const to = room && room.members.get(String((a && a.to) || ''));
    if (to && room.members.get(uid).ws === ws) sendTo(to.ws, { t: 'sig', room: room.id, f: uid, env: a.env });
  }
};

async function onMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    return;
  }
  const fn = msg && METHODS[msg.m];
  if (!fn) return;
  try {
    const r = await fn(ws.uid, ws, msg.a || {});
    if (msg.i != null) sendTo(ws, Object.assign({ t: 'res', i: msg.i }, r || { ok: true }));
  } catch (e) {
    console.error('[live]', msg.m, e);
    if (msg.i != null) sendTo(ws, { t: 'res', i: msg.i, ok: false, error: 'Server error' });
  }
}

async function onConnect(ws) {
  const uid = ws.uid;
  const first = !socks.has(uid);
  if (first) socks.set(uid, new Set());
  socks.get(uid).add(ws);
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', d => onMessage(ws, d.toString()));
  ws.on('close', () => onClose(ws));
  sendTo(ws, { t: 'hello', now: Date.now(), uid });
  try {
    await friendIds(uid);
    sendTo(ws, { t: 'friends', list: await friendList(uid) });
    sendTo(ws, { t: 'invites', list: invitesOf(uid) });
    if (first) pushPresence(uid);
  } catch (e) {
    console.error('[live] on connect:', e.message);
  }
}

function onClose(ws) {
  const uid = ws.uid;
  const set = socks.get(uid);
  if (set) {
    set.delete(ws);
    if (!set.size) {
      socks.delete(uid);
      playing.delete(uid);
      friendCache.delete(uid);
    }
  }
  // If this was the tab in a room, its seat is kept for a while.
  const room = rooms.get(roomOf.get(uid));
  const m = room && room.members.get(uid);
  if (m && m.ws === ws) {
    clearTimeout(grace.get(uid));
    grace.set(
      uid,
      setTimeout(() => {
        grace.delete(uid);
        const r = rooms.get(roomOf.get(uid));
        if (r && r.members.get(uid) && r.members.get(uid).ws === ws) leaveRoom(uid);
      }, GRACE)
    );
  }
  if (!online(uid)) pushPresence(uid);
}

/** Account deleted: out of rooms, invites and its friends' lists. */
export function onAccountDeleted(uid) {
  const friends = friendCache.get(uid) || new Set();
  leaveRoom(uid);
  invites.delete(uid);
  for (const m of invites.values()) m.delete(uid);
  for (const ws of socks.get(uid) || []) ws.close(4001, 'deleted');
  for (const f of friends) pushFriends(f).catch(() => {});
}

/** Nickname just chosen: their friends (if there were requests already) see the name. */
export function onNick(uid) {
  q(`SELECT CASE WHEN a = $1 THEN b ELSE a END AS o FROM friendships WHERE a = $1 OR b = $1`, [uid])
    .then(r => r.rows.forEach(x => pushFriends(x.o).catch(() => {})))
    .catch(() => {});
}

/** The HTTP server hands WebSocket upgrade requests over here. */
export async function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || (req.headers.origin && req.headers.origin !== ORIGIN)) {
    socket.destroy();
    return;
  }
  const u = await userOf(req);
  if (!u) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    ws.uid = u.id;
    onConnect(ws);
  });
}

// Dead connections (phone without signal...): ping every 30 s.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30000).unref();
