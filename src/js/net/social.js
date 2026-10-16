/* ============ social.js — nickname, friends, online status, invites and rooms ============
 * Only works with a cloud account (DB.online). Uses our server:
 *
 *   /api/nick, /api/profile     unique nickname and public profile (server/api.mjs)
 *   Live (WebSocket /ws)      friends, online status, invites and rooms (server/live.mjs):
 *                               the server sends changes as soon as they happen
 *
 *   room = { id, host, isHost, open, members: [{ uid, name, dex, shiny }] }
 *
 * The rest of the game listens for changes with Social.on(fn).
 */
import { DB } from '../core/db.js';
import { AchDefs } from '../data/achievements.js';
import { Live } from './live.js';

export const Social = (() => {
  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
  const MAX_PLAYERS = 4;
  const INVITE_TTL = 3 * 60 * 1000;
  // The real time: the server's (corrects the device clock if it's off).
  const now = () => Live.now();

  let uid = null;
  let me = null; // { uid, name }
  let friends = new Map(); // otherUid -> { uid, name, status: 'ok'|'in'|'out', online, play, room }
  let room = null; // { id, host, isHost, members: [{ uid, name, dex, shiny }], open }
  let leftId = ''; // the room you just left (in case something arrives late)
  const invites = new Map(); // fromUid -> { from, name, room, at }
  const listeners = new Set();
  let started = false,
    playing = false,
    hooked = false;

  function emit(what) {
    listeners.forEach(fn => {
      try {
        fn(what);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  // ---------------- what the server sends ----------------

  Live.on('friends', msg => {
    if (!started) return;
    friends = new Map((msg.list || []).map(f => [f.uid, f]));
    emit('friends');
  });
  Live.on('presence', msg => {
    const f = friends.get(msg.uid);
    if (!f) return;
    Object.assign(f, { online: !!msg.online, play: !!msg.play, room: msg.room || '' });
    emit('presence');
  });
  Live.on('invites', msg => {
    if (!started) return;
    invites.clear();
    for (const v of msg.list || []) {
      const f = friends.get(v.from);
      if (f && f.status !== 'ok') continue;
      invites.set(v.from, v);
    }
    emit('invites');
  });
  Live.on('room', msg => {
    if (!started) return;
    if (!msg.room) {
      if (msg.closed) closedRoom();
      return;
    }
    if (msg.room.id === leftId) return;
    setRoom(msg.room);
  });
  // After reconnecting (mobile network, server restarted): does your room still exist?
  Live.on('open', async () => {
    if (!started) return;
    if (playing) Live.send('play', { on: true });
    if (!room) return;
    const id = room.id;
    const r = await Live.call('room.resume', { id });
    if (room && room.id === id) {
      if (r.ok) setRoom(r.room);
      else closedRoom();
    }
  });

  function setRoom(st) {
    leftId = '';
    room = {
      id: st.id,
      host: st.host,
      isHost: st.host === uid,
      open: !!st.open,
      // The host always first; the rest in order of arrival.
      members: (st.members || []).slice().sort((a, b) => (a.uid === st.host ? -1 : b.uid === st.host ? 1 : (a.at || 0) - (b.at || 0)))
    };
    emit('room');
  }

  // ---------------- startup ----------------

  /** After signing in. → 'ok' | 'need-nick' | 'off' (no cloud) */
  async function start() {
    if (!DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    uid = DB.uid;
    started = true;
    // On logout or account deletion. (Hooked here, not at load: db.js and this module import each other.)
    if (!hooked) {
      hooked = true;
      DB.onLeave(why => stop(why));
    }
    Live.start();
    const nick = DB.nick;
    if (!nick) return 'need-nick';
    me = { uid, name: nick };
    if (DB.user !== nick) DB.setName(nick);
    return 'ok';
  }

  /** Reserves a unique nickname (it can't be changed). */
  async function claimNick(name) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'The nickname must be 3-16 letters, numbers or _.' };
    let r;
    try {
      r = await DB.api('api/nick', { method: 'POST', body: { name } });
    } catch (e) {
      return { ok: false, error: (e && e.message) || "Couldn't save the nickname." };
    }
    if (!r.ok) return r;
    me = { uid, name: r.name };
    DB.setName(r.name);
    publishProfile(true);
    return { ok: true };
  }

  async function stop() {
    if (!started) return;
    await leaveRoom().catch(() => {});
    Live.stop();
    friends.clear();
    invites.clear();
    me = null;
    started = false;
    uid = null;
    playing = false;
    emit('stop');
  }

  function setPlaying(p) {
    if (playing !== !!p) {
      playing = !!p;
      Live.send('play', { on: playing });
    }
  }

  /** The "online" status comes from the server on its own; this only repaints. */
  function refreshPresence() {
    emit('presence');
    return Promise.resolve();
  }

  // ---------------- friends ----------------

  /** Sends a friend request (or accepts the one they had already sent you). */
  async function request(name) {
    name = (name || '').trim();
    if (!me) return { ok: false, error: 'Choose your nickname first.' };
    if (!VALID.test(name)) return { ok: false, error: "Type your friend's exact nickname." };
    return Live.call('friend.request', { name });
  }

  function accept(other) {
    return Live.call('friend.accept', { uid: other });
  }

  function remove(other) {
    return Live.call('friend.remove', { uid: other });
  }

  // ---------------- rooms ----------------

  function memberInfo() {
    const s = DB.save;
    return { dex: s.partner, shiny: !!s.partnerShiny && DB.ownsShiny(s.partner) };
  }

  async function createRoom() {
    if (room) return room;
    const r = await Live.call('room.create', { me: memberInfo() });
    if (r.ok) setRoom(r.room);
    return room;
  }

  async function joinRoom(id) {
    if (room && room.id === id) return { ok: true };
    if (room) await leaveRoom();
    const r = await Live.call('room.join', { id, me: memberInfo() });
    if (!r.ok) return { ok: false, error: r.error || "Couldn't join the room." };
    setRoom(r.room);
    return { ok: true };
  }

  function closedRoom() {
    if (!room) return;
    leftId = room.id;
    room = null;
    emit('room-closed');
  }

  async function leaveRoom() {
    if (!room) return;
    leftId = room.id;
    room = null;
    emit('room');
    await Live.call('room.leave');
  }

  /** The host closes the room to new players when the run starts. */
  function setOpen(open) {
    if (room && room.isHost) Live.call('room.open', { open: !!open });
  }

  /** Updates your Pokémon in the room (if you change partner). */
  function refreshMember() {
    if (room && me) Live.call('room.member', memberInfo());
  }

  // ---------------- invites ----------------

  async function invite(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'ok') return { ok: false, error: 'You can only invite your friends.' };
    if (room && room.members.length >= MAX_PLAYERS) return { ok: false, error: 'The room is full.' };
    if (room && !room.isHost) return { ok: false, error: 'Only the room host can invite.' };
    const r = await Live.call('invite', { to: other, me: memberInfo() });
    if (r.room && (!room || room.id === r.room.id)) setRoom(r.room);
    return r.ok ? { ok: true, msg: r.msg } : { ok: false, error: r.error || "Couldn't send the invite." };
  }

  async function acceptInvite(from) {
    const inv = invites.get(from);
    invites.delete(from);
    emit('invites');
    if (!inv || now() - inv.at > INVITE_TTL) {
      Live.send('invite.decline', { from });
      return { ok: false, error: 'The invite has expired.' };
    }
    if (room) await leaveRoom();
    const r = await Live.call('invite.accept', { from, me: memberInfo() });
    if (!r.ok) return { ok: false, error: r.error || "Couldn't join the room." };
    setRoom(r.room);
    return { ok: true };
  }

  function declineInvite(from) {
    invites.delete(from);
    Live.send('invite.decline', { from });
    emit('invites');
  }

  // ---------------- public profile ----------------

  /** What others see of you (also for your own preview, without uploading it). */
  function profileData() {
    const s = DB.save,
      st = s.stats,
      prof = s.profile || {};
    const unlocked = AchDefs.LIST.filter(a => s.ach && s.ach[a.id]);
    const medals = unlocked
      .slice()
      .sort((a, b) => b.tier - a.tier || s.ach[b.id] - s.ach[a.id])
      .slice(0, 8)
      .map(a => a.id);
    return {
      name: me ? me.name : DB.user,
      favs: (prof.favs || []).slice(0, 3).map(f => ({ dex: f.dex | 0, shiny: !!f.shiny })),
      title: prof.title || '',
      best: {
        solo: st.bestTime | 0,
        group: st.bestGroupTime | 0,
        level: st.bestLevel | 0,
        bosses: st.bossesTotal | 0,
        legends: Object.keys(s.legends || {}).length,
        kills: st.totalKills | 0,
        medals: unlocked.length
      },
      medals
    };
  }

  let pubT = 0,
    pubAt = 0,
    pubLast = '';
  /**
   * Uploads your profile (after a short wait, in case you change several things
   * in a row), but ONLY if something visible at first glance has changed:
   * time and level records, legendaries, medals, title or favourites.
   * Bosses and defeated counts (which change every run) go up with the rest
   * when due, not on their own. If you change favourites or title (force), immediately.
   */
  function publishProfile(force = false) {
    if (!me) return;
    if (!force && Date.now() - pubAt < 2 * 3600 * 1000) return; // at most every 2 h
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me) return;
      const d = profileData();
      // To decide whether to upload (remembered across sessions): without bosses or defeated counts.
      const key = JSON.stringify(Object.assign({}, d, { best: Object.assign({}, d.best, { kills: 0, bosses: 0 }) }));
      const lsKey = 'ps.pub.' + uid;
      if (!pubLast) {
        try {
          pubLast = localStorage.getItem(lsKey) || '';
        } catch (e) {
          /* nothing */
        }
      }
      if (key === pubLast) return;
      pubLast = key;
      pubAt = Date.now();
      try {
        localStorage.setItem(lsKey, key);
      } catch (e) {
        /* nothing */
      }
      DB.api('api/profile', { method: 'PUT', body: d }).catch(e => {
        pubLast = '';
        console.warn('[Social] profile:', e.code || e.message);
      });
    }, 800);
  }

  /** Another player's public profile. */
  const profCache = new Map();
  async function getProfile(other) {
    if (!started) return null;
    // Yours comes from your save (no fetching and always up to date).
    if (other === uid && me) return Object.assign(profileData(), { name: me.name });
    const c = profCache.get(other);
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.v; // fetched data is valid for 10 min
    const r = await DB.api('api/profile/' + encodeURIComponent(other)).catch(() => null);
    const v = r ? r.profile : null;
    profCache.set(other, { at: Date.now(), v });
    return v;
  }

  return {
    start,
    stop,
    claimNick,
    request,
    accept,
    remove,
    publishProfile,
    getProfile,
    profileData,
    createRoom,
    joinRoom,
    leaveRoom,
    setOpen,
    refreshMember,
    setPlaying,
    refreshPresence,
    invite,
    acceptInvite,
    declineInvite,
    on(fn) {
      listeners.add(fn);
    },
    off(fn) {
      listeners.delete(fn);
    },
    get me() {
      return me;
    },
    get started() {
      return started;
    },
    get friends() {
      return [...friends.values()];
    },
    get invites() {
      return [...invites.values()];
    },
    get room() {
      return room;
    },
    get uid() {
      return uid;
    },
    /** The real time (corrects the device clock if it's off). */
    now,
    VALID,
    MAX_PLAYERS
  };
})();
