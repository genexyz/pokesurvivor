/* ============ net.js — connection between the players in a room ============
 * Star topology: the HOST talks to each guest; guests only talk to the host
 * (who forwards whatever is needed).
 *
 * Two paths, at the same time:
 *   direct   WebRTC (data channel between browsers, without going through any
 *            server). The negotiation (signalling) goes through our server
 *            (Live, WebSocket; server/live.mjs).
 *            Only with Google's free STUN: if the network doesn't allow a direct
 *            connection (some routers and mobile data), that pair can't play
 *            together. (Our own TURN, coturn, could be added to ICE.)
 *   relay    (OFF) messages would go through the server.
 *
 * Messages go through the direct channel if it's open; otherwise through the
 * relay. The receiver listens to both, so no agreement is needed.
 *
 * API:  open(roomId, isHost, hostUid) · close() · send(to, msg) · toHost(msg)
 *       broadcast(msg) · on(fn(from, msg)) · onPeer(fn(uid, state))
 *       peers() · mode(uid) -> 'connecting' | 'direct' | 'relay' | 'closed'
 */
import { DB } from '../core/db.js';
import { Live } from './live.js';

export const Net = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const DIRECT_TIMEOUT = 9000; // ms to get a direct channel before using the relay
  // Relay OFF: without a direct connection, that pair can't play together
  // ('failed') and the host retries every RETRY_MS. Only signalling goes
  // through the server (a few small messages to connect).
  const ALLOW_RELAY = false,
    RETRY_MS = 15000;

  let uid = null,
    roomId = null,
    isHost = false,
    hostUid = null;
  const peers = new Map(); // uid -> { pc, dc, mode, timer }
  const handlers = new Set(),
    peerHandlers = new Set();
  let stats = { sent: 0, recv: 0, relaySent: 0 };

  function emitPeer(u) {
    const p = peers.get(u);
    peerHandlers.forEach(fn => {
      try {
        fn(u, p ? p.mode : 'closed');
      } catch (e) {
        console.warn(e);
      }
    });
  }

  // ---------------- opening ----------------

  function open(id, host, hostId) {
    if (roomId === id) return;
    close();
    uid = DB.uid;
    roomId = id;
    isHost = host;
    hostUid = hostId;
    // Guest: a slot for the host right away (replaced when its offer arrives).
    // That way, if it never arrives, we carry on via the relay and know when it leaves.
    if (!isHost) {
      const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
      p.timer = setTimeout(() => {
        if (p.mode === 'connecting') {
          p.mode = ALLOW_RELAY ? 'relay' : 'failed';
          emitPeer(hostId);
        }
      }, DIRECT_TIMEOUT + 3000);
      peers.set(hostId, p);
    }
  }

  function close() {
    for (const u of [...peers.keys()]) drop(u);
    roomId = null;
    isHost = false;
    hostUid = null;
  }

  /** The host calls this when the room members change. */
  function syncMembers(uids) {
    if (!roomId) return;
    if (isHost) {
      for (const u of uids) if (u !== uid && !peers.has(u)) connect(u);
      for (const u of [...peers.keys()]) if (!uids.includes(u)) drop(u);
    } else if (!uids.includes(hostUid)) {
      drop(hostUid);
    }
  }

  // ---------------- WebRTC ----------------

  function newPeer(u) {
    const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
    peers.set(u, p);
    // No WebRTC (old or blocked browser): straight to the relay.
    let pc;
    try {
      pc = p.pc = new RTCPeerConnection({ iceServers: ICE });
    } catch (e) {
      p.mode = 'relay';
      emitPeer(u);
      return p;
    }
    pc.onicecandidate = e => {
      if (e.candidate) signal(u, { c: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && p.mode !== 'closed') useRelay(u);
    };
    // If there's no direct channel within a few seconds, carry on via the relay.
    p.timer = setTimeout(() => {
      if (p.mode === 'connecting') useRelay(u);
    }, DIRECT_TIMEOUT);
    emitPeer(u);
    return p;
  }

  function wireChannel(u, p, dc) {
    p.dc = dc;
    dc.onopen = () => {
      clearTimeout(p.timer);
      p.mode = 'direct';
      emitPeer(u);
    };
    dc.onclose = () => {
      if (p.mode === 'direct') {
        p.mode = 'connecting';
        useRelay(u);
      }
    };
    dc.onmessage = e => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      deliver(u, m);
    };
  }

  function useRelay(u) {
    const p = peers.get(u);
    if (!p || p.mode === 'direct' || p.mode === 'closed' || p.mode === 'failed') return;
    if (ALLOW_RELAY) {
      p.mode = 'relay';
      emitPeer(u);
      return;
    }
    // No relay: you can't play with that person for now. The host retries.
    clearTimeout(p.timer);
    p.mode = 'failed';
    try {
      if (p.pc) p.pc.close();
    } catch (e) {
      /* nothing */
    }
    emitPeer(u);
    if (isHost)
      p.timer = setTimeout(() => {
        if (peers.get(u) === p && p.mode === 'failed' && roomId) {
          drop(u, true);
          connect(u);
        }
      }, RETRY_MS);
  }

  /** Host: opens a connection with a guest. */
  async function connect(u) {
    if (!roomId || peers.has(u)) return;
    const p = newPeer(u);
    if (!p.pc) return;
    wireChannel(u, p, p.pc.createDataChannel('g', { ordered: true }));
    try {
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      signal(u, { sdp: p.pc.localDescription.toJSON() });
    } catch (e) {
      useRelay(u);
    }
  }

  const pendingIce = new Map(); // candidates that arrive before the offer

  async function onSignal(from, sig) {
    let p = peers.get(from);
    try {
      if (sig.sdp && sig.sdp.type === 'offer') {
        if (isHost) return;
        if (p) drop(from, true);
        p = newPeer(from);
        if (!p.pc) return;
        p.pc.ondatachannel = e => wireChannel(from, p, e.channel);
        await p.pc.setRemoteDescription(sig.sdp);
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        signal(from, { sdp: p.pc.localDescription.toJSON() });
        for (const c of pendingIce.get(from) || []) await p.pc.addIceCandidate(c).catch(() => {});
        pendingIce.delete(from);
      } else if (sig.sdp && sig.sdp.type === 'answer') {
        if (p && p.pc) await p.pc.setRemoteDescription(sig.sdp);
      } else if (sig.c) {
        if (p && p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(sig.c).catch(() => {});
        else {
          if (!pendingIce.has(from)) pendingIce.set(from, []);
          pendingIce.get(from).push(sig.c);
        }
      }
    } catch (e) {
      console.warn('[Net] signalling:', e.message);
      useRelay(from);
    }
  }

  function signal(to, sig) {
    relayPush(to, { f: uid, sig });
  }

  function drop(u, silent) {
    const p = peers.get(u);
    if (!p) return;
    clearTimeout(p.timer);
    p.mode = 'closed';
    try {
      if (p.dc) p.dc.close();
    } catch (e) {
      /* nothing */
    }
    try {
      if (p.pc) p.pc.close();
    } catch (e) {
      /* nothing */
    }
    peers.delete(u);
    if (!silent) emitPeer(u);
  }

  // ---------------- send / receive ----------------

  function relayPush(to, env) {
    if (roomId) Live.send('sig', { to, env });
  }
  // What arrives via the server: signalling (or the start notice).
  Live.on('sig', msg => {
    const m = msg.env;
    if (!roomId || msg.room !== roomId || !m || !msg.f) return;
    if (m.sig) onSignal(msg.f, m.sig);
    else deliver(msg.f, m.d);
  });

  function send(to, msg) {
    if (!roomId) return;
    const p = peers.get(to);
    stats.sent++;
    if (p && p.dc && p.dc.readyState === 'open') {
      try {
        p.dc.send(JSON.stringify(msg));
        return;
      } catch (e) {
        /* fall back to the relay */
      }
    }
    // Without a relay, game data doesn't go through the server (it's dropped: that
    // pair isn't connected). Only the start notice goes through.
    if (!ALLOW_RELAY && !(msg && msg.k === 'start')) return;
    stats.relaySent++;
    relayPush(to, { f: uid, d: msg });
  }

  function toHost(msg) {
    if (!isHost && hostUid) send(hostUid, msg);
  }
  function broadcast(msg, except) {
    for (const u of peers.keys()) if (u !== except) send(u, msg);
  }

  function deliver(from, msg) {
    stats.recv++;
    handlers.forEach(fn => {
      try {
        fn(from, msg);
      } catch (e) {
        console.error('[Net] message:', e);
      }
    });
  }

  return {
    open,
    close,
    syncMembers,
    send,
    toHost,
    broadcast,
    on(fn) {
      handlers.add(fn);
    },
    off(fn) {
      handlers.delete(fn);
    },
    onPeer(fn) {
      peerHandlers.add(fn);
    },
    mode(u) {
      const p = peers.get(u);
      return p ? p.mode : 'closed';
    },
    /** Is it going via the relay (or not connected)? Then send less often. */
    slow(u) {
      const p = peers.get(u);
      return !p || p.mode !== 'direct';
    },
    peers() {
      return [...peers.keys()];
    },
    get open_() {
      return !!roomId;
    },
    get isHost() {
      return isHost;
    },
    get uid() {
      return uid;
    },
    get hostUid() {
      return hostUid;
    },
    stats
  };
})();
