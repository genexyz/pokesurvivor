/* ============ sync.js — co-op message registry ============
 * Loaded early (before the gameplay systems), so every module can declare
 * its own co-op messages where its logic lives. net/coop.js only dispatches:
 * adding a mechanic never needs a new case there.
 *
 *   Sync.on('wx', ev => ...)                 guest: an event the host sent
 *   Sync.onGuest('re', (ev, from, mate) => ...)  host: an event a guest sent
 *   Sync.field('ja', { send: () => state|null, apply: state => ... })
 *                                              state the host adds to every frame
 *   Sync.flag('burn', e => e.burn > 0)       enemy flag mirrored on guests' copies
 *                                              (read there with e.netFlag('burn'))
 *
 * Sending stays in Coop: broadcast(ev) on the host, toHost(ev) on a guest,
 * fx(name, ...args) to play a FX effect here and on every guest.
 * An event is an array whose first element is its code: ['wx', kind, dur].
 */
export const Sync = (() => {
  const fromHost = new Map(),
    fromGuest = new Map(),
    fields = new Map(),
    flags = [];

  function register(map, codes, fn) {
    for (const c of [].concat(codes)) {
      if (map.has(c)) console.warn('[Sync] message code registered twice:', c);
      map.set(c, fn);
    }
  }

  return {
    /** @param codes  a code or a list of codes handled by the same function */
    on(codes, fn) {
      register(fromHost, codes, fn);
    },
    onGuest(codes, fn) {
      register(fromGuest, codes, fn);
    },
    field(key, def) {
      fields.set(key, def);
    },
    flag(name, test) {
      if (flags.length >= 31) throw new Error('[Sync] too many enemy flags');
      flags.push({ name, test });
    },
    /** Bit of an enemy flag (-1 if unknown). */
    flagBit(name) {
      return flags.findIndex(f => f.name === name);
    },
    fromHost,
    fromGuest,
    fields,
    flags
  };
})();
