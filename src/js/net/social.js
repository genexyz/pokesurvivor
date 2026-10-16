/* ============ social.js — apodo, amigos, en línea, invitaciones y salas ============
 * Sólo funciona con cuenta en la nube (G.DB.online). Usa nuestro servidor:
 *
 *   /api/nick, /api/profile     apodo único y perfil público (server/api.mjs)
 *   G.Live (WebSocket /ws)      amigos, en línea, invitaciones y salas (server/live.mjs):
 *                               el servidor manda los cambios en cuanto pasan
 *
 *   sala = { id, host, isHost, open, members: [{ uid, name, dex, shiny }] }
 *
 * El resto del juego escucha los cambios con G.Social.on(fn).
 */
G.Social = (() => {
  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
  const MAX_PLAYERS = 4;
  const INVITE_TTL = 3 * 60 * 1000;
  // La hora real: la del servidor (corrige el reloj del aparato si va desfasado).
  const now = () => G.Live.now();

  let uid = null;
  let me = null; // { uid, name }
  let friends = new Map(); // otherUid -> { uid, name, status: 'ok'|'in'|'out', online, play, room }
  let room = null; // { id, host, isHost, members: [{ uid, name, dex, shiny }], open }
  let leftId = ''; // la sala de la que acabas de salir (por si llega algo tarde)
  const invites = new Map(); // fromUid -> { from, name, room, at }
  const listeners = new Set();
  let started = false,
    playing = false;

  function emit(what) {
    listeners.forEach(fn => {
      try {
        fn(what);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  // ---------------- lo que manda el servidor ----------------

  G.Live.on('friends', msg => {
    if (!started) return;
    friends = new Map((msg.list || []).map(f => [f.uid, f]));
    emit('friends');
  });
  G.Live.on('presence', msg => {
    const f = friends.get(msg.uid);
    if (!f) return;
    Object.assign(f, { online: !!msg.online, play: !!msg.play, room: msg.room || '' });
    emit('presence');
  });
  G.Live.on('invites', msg => {
    if (!started) return;
    invites.clear();
    for (const v of msg.list || []) {
      const f = friends.get(v.from);
      if (f && f.status !== 'ok') continue;
      invites.set(v.from, v);
    }
    emit('invites');
  });
  G.Live.on('room', msg => {
    if (!started) return;
    if (!msg.room) {
      if (msg.closed) closedRoom();
      return;
    }
    if (msg.room.id === leftId) return;
    setRoom(msg.room);
  });
  // Tras reconectarse (red del móvil, servidor reiniciado): ¿sigue tu sala?
  G.Live.on('open', async () => {
    if (!started) return;
    if (playing) G.Live.send('play', { on: true });
    if (!room) return;
    const id = room.id;
    const r = await G.Live.call('room.resume', { id });
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
      // El anfitrión siempre primero; el resto por orden de llegada.
      members: (st.members || []).slice().sort((a, b) => (a.uid === st.host ? -1 : b.uid === st.host ? 1 : (a.at || 0) - (b.at || 0)))
    };
    emit('room');
  }

  // ---------------- arranque ----------------

  /** Tras iniciar sesión. → 'ok' | 'need-nick' | 'off' (sin nube) */
  async function start() {
    if (!G.DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    uid = G.DB.uid;
    started = true;
    G.Live.start();
    const nick = G.DB.nick;
    if (!nick) return 'need-nick';
    me = { uid, name: nick };
    if (G.DB.user !== nick) G.DB.setName(nick);
    return 'ok';
  }

  /** Reserva un apodo único (no se puede cambiar). */
  async function claimNick(name) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'El apodo debe tener 3-16 letras, números o _.' };
    let r;
    try {
      r = await G.DB.api('api/nick', { method: 'POST', body: { name } });
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'No se pudo guardar el apodo.' };
    }
    if (!r.ok) return r;
    me = { uid, name: r.name };
    G.DB.setName(r.name);
    publishProfile(true);
    return { ok: true };
  }

  async function stop() {
    if (!started) return;
    await leaveRoom().catch(() => {});
    G.Live.stop();
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
      G.Live.send('play', { on: playing });
    }
  }

  /** El "en línea" llega solo del servidor; esto sólo repinta. */
  function refreshPresence() {
    emit('presence');
    return Promise.resolve();
  }

  // ---------------- amigos ----------------

  /** Envía una solicitud de amistad (o acepta la que ya te había mandado). */
  async function request(name) {
    name = (name || '').trim();
    if (!me) return { ok: false, error: 'Primero elige tu apodo.' };
    if (!VALID.test(name)) return { ok: false, error: 'Escribe el apodo exacto de tu amigo.' };
    return G.Live.call('friend.request', { name });
  }

  function accept(other) {
    return G.Live.call('friend.accept', { uid: other });
  }

  function remove(other) {
    return G.Live.call('friend.remove', { uid: other });
  }

  // ---------------- salas ----------------

  function memberInfo() {
    const s = G.DB.save;
    return { dex: s.partner, shiny: !!s.partnerShiny && G.DB.ownsShiny(s.partner) };
  }

  async function createRoom() {
    if (room) return room;
    const r = await G.Live.call('room.create', { me: memberInfo() });
    if (r.ok) setRoom(r.room);
    return room;
  }

  async function joinRoom(id) {
    if (room && room.id === id) return { ok: true };
    if (room) await leaveRoom();
    const r = await G.Live.call('room.join', { id, me: memberInfo() });
    if (!r.ok) return { ok: false, error: r.error || 'No se pudo entrar en la sala.' };
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
    await G.Live.call('room.leave');
  }

  /** El anfitrión cierra la sala a nuevos jugadores al empezar la partida. */
  function setOpen(open) {
    if (room && room.isHost) G.Live.call('room.open', { open: !!open });
  }

  /** Actualiza tu Pokémon en la sala (si cambias de compañero). */
  function refreshMember() {
    if (room && me) G.Live.call('room.member', memberInfo());
  }

  // ---------------- invitaciones ----------------

  async function invite(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'ok') return { ok: false, error: 'Sólo puedes invitar a tus amigos.' };
    if (room && room.members.length >= MAX_PLAYERS) return { ok: false, error: 'La sala está llena.' };
    if (room && !room.isHost) return { ok: false, error: 'Sólo el anfitrión de la sala puede invitar.' };
    const r = await G.Live.call('invite', { to: other, me: memberInfo() });
    if (r.room && (!room || room.id === r.room.id)) setRoom(r.room);
    return r.ok ? { ok: true, msg: r.msg } : { ok: false, error: r.error || 'No se pudo invitar.' };
  }

  async function acceptInvite(from) {
    const inv = invites.get(from);
    invites.delete(from);
    emit('invites');
    if (!inv || now() - inv.at > INVITE_TTL) {
      G.Live.send('invite.decline', { from });
      return { ok: false, error: 'La invitación ha caducado.' };
    }
    if (room) await leaveRoom();
    const r = await G.Live.call('invite.accept', { from, me: memberInfo() });
    if (!r.ok) return { ok: false, error: r.error || 'No se pudo entrar en la sala.' };
    setRoom(r.room);
    return { ok: true };
  }

  function declineInvite(from) {
    invites.delete(from);
    G.Live.send('invite.decline', { from });
    emit('invites');
  }

  // ---------------- perfil público ----------------

  /** Lo que se enseña de ti (también para tu vista previa, sin subirlo). */
  function profileData() {
    const s = G.DB.save,
      st = s.stats,
      prof = s.profile || {};
    const unlocked = G.AchDefs.LIST.filter(a => s.ach && s.ach[a.id]);
    const medals = unlocked
      .slice()
      .sort((a, b) => b.tier - a.tier || s.ach[b.id] - s.ach[a.id])
      .slice(0, 8)
      .map(a => a.id);
    return {
      name: me ? me.name : G.DB.user,
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
   * Sube tu perfil (con un poco de espera, por si cambias varias cosas
   * seguidas), pero SÓLO si ha cambiado algo de lo que se ve a primera vista:
   * récords de tiempo y nivel, legendarios, medallas, título o favoritos.
   * Los jefes y derrotados (que cambian en cada partida) se suben con lo demás
   * cuando toca, no por sí solos. Si cambias favoritos o título (force), al momento.
   */
  function publishProfile(force = false) {
    if (!me) return;
    if (!force && Date.now() - pubAt < 2 * 3600 * 1000) return; // como mucho cada 2 h
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me) return;
      const d = profileData();
      // Para decidir si se sube (se recuerda entre sesiones): sin jefes ni derrotados.
      const key = JSON.stringify(Object.assign({}, d, { best: Object.assign({}, d.best, { kills: 0, bosses: 0 }) }));
      const lsKey = 'ps.pub.' + uid;
      if (!pubLast) {
        try {
          pubLast = localStorage.getItem(lsKey) || '';
        } catch (e) {
          /* nada */
        }
      }
      if (key === pubLast) return;
      pubLast = key;
      pubAt = Date.now();
      try {
        localStorage.setItem(lsKey, key);
      } catch (e) {
        /* nada */
      }
      G.DB.api('api/profile', { method: 'PUT', body: d }).catch(e => {
        pubLast = '';
        console.warn('[Social] perfil:', e.code || e.message);
      });
    }, 800);
  }

  /** El perfil público de otro jugador. */
  const profCache = new Map();
  async function getProfile(other) {
    if (!started) return null;
    // El tuyo sale de tu partida (sin leer nada y siempre al día).
    if (other === uid && me) return Object.assign(profileData(), { name: me.name });
    const c = profCache.get(other);
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.v; // lo leído vale 10 min
    const r = await G.DB.api('api/profile/' + encodeURIComponent(other)).catch(() => null);
    const v = r ? r.profile : null;
    profCache.set(other, { at: Date.now(), v });
    return v;
  }

  // Al cerrar sesión o borrar la cuenta.
  G.DB.onLeave(why => stop(why));

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
    /** La hora real (corrige el reloj del aparato si va desfasado). */
    now,
    VALID,
    MAX_PLAYERS
  };
})();
