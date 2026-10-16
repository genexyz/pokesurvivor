/* ============ live.js — conexión en directo con nuestro servidor (WebSocket /ws) ============
 * Amigos, "en línea", invitaciones, salas y la señalización del cooperativo
 * (server/live.mjs). Sólo con cuenta en la nube; se reconecta sola.
 *
 * API:  start() · stop() · call(m, a) -> Promise<respuesta> · send(m, a)
 *       on(t, fn) (t: 'open' | 'close' | 'hello' | 'friends' | 'presence' | 'invites' | 'room' | 'sig')
 *       connected · now() (la hora del servidor)
 */
G.Live = (() => {
  let ws = null,
    want = false,
    tries = 0,
    retryT = 0,
    seq = 0,
    skew = 0;
  const waiting = new Map(); // i -> { res, timer }
  const handlers = new Map(); // t -> Set(fn)

  function emit(t, msg) {
    for (const fn of handlers.get(t) || []) {
      try {
        fn(msg);
      } catch (e) {
        console.warn('[Live]', t, e);
      }
    }
  }

  function url() {
    const u = new URL('ws', document.baseURI);
    u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.href;
  }

  function connect() {
    if (!want || ws) return;
    let s;
    try {
      s = ws = new WebSocket(url());
    } catch (e) {
      ws = null;
      return retry();
    }
    s.onopen = () => {
      tries = 0;
    };
    s.onmessage = e => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      if (msg.t === 'res') {
        const w = waiting.get(msg.i);
        if (w) {
          waiting.delete(msg.i);
          clearTimeout(w.timer);
          w.res(msg);
        }
        return;
      }
      if (msg.t === 'hello') {
        skew = msg.now - Date.now();
        // Si el reloj del aparato va bien (menos de 1 min de diferencia), se usa tal cual.
        if (Math.abs(skew) < 60000) skew = 0;
        emit('hello', msg);
        emit('open', msg);
        return;
      }
      emit(msg.t, msg);
    };
    s.onclose = e => {
      if (ws !== s) return;
      ws = null;
      for (const [i, w] of waiting) {
        clearTimeout(w.timer);
        w.res({ ok: false, error: 'Sin conexión con el servidor.' });
        waiting.delete(i);
      }
      emit('close', e);
      // Cuenta borrada: no se reconecta.
      if (e.code !== 4001) retry();
    };
  }

  /** Reintento con espera creciente: 1 s, 2 s, 4 s... hasta 30 s. */
  function retry() {
    if (!want) return;
    clearTimeout(retryT);
    const ms = Math.min(30000, 1000 * Math.pow(2, tries++)) * (0.8 + Math.random() * 0.4);
    retryT = setTimeout(connect, ms);
  }

  function start() {
    want = true;
    connect();
  }

  function stop() {
    want = false;
    clearTimeout(retryT);
    if (ws) {
      const s = ws;
      ws = null;
      s.close();
    }
  }

  /** Pide algo al servidor y espera la respuesta ({ ok, error?, ... }). */
  function call(m, a) {
    return new Promise(res => {
      if (!ws || ws.readyState !== 1) return res({ ok: false, error: 'Sin conexión con el servidor.' });
      const i = ++seq;
      const timer = setTimeout(() => {
        waiting.delete(i);
        res({ ok: false, error: 'El servidor no contesta.' });
      }, 10000);
      waiting.set(i, { res, timer });
      ws.send(JSON.stringify({ i, m, a: a || {} }));
    });
  }

  /** Manda algo sin esperar respuesta (la señalización). */
  function send(m, a) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ m, a: a || {} }));
  }

  // Al volver la conexión del aparato, se reintenta enseguida.
  addEventListener('online', () => {
    if (want && !ws) {
      tries = 0;
      clearTimeout(retryT);
      connect();
    }
  });

  return {
    start,
    stop,
    call,
    send,
    on(t, fn) {
      if (!handlers.has(t)) handlers.set(t, new Set());
      handlers.get(t).add(fn);
    },
    off(t, fn) {
      if (handlers.has(t)) handlers.get(t).delete(fn);
    },
    get connected() {
      return !!ws && ws.readyState === 1;
    },
    now: () => Date.now() + skew
  };
})();
