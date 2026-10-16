/* ============ settings.js — this device's settings ============
 * Stored in the browser (not in the account): each PC or phone has its
 * own. The volume is stored separately by audio.js.
 *
 *   quality     'auto' | 'high' | 'mid' | 'low'   effects and particles
 *   dmgNumbers  true/false                        damage numbers
 *   calm        true/false                        less shaking and flashing
 *   fps         true/false                        FPS counter
 *   stick       0.8 | 1 | 1.25                    touch joystick size
 *   stickMode   'float' | 'fixed'                 joystick where you put your finger, or always in place
 *   pad         { bar, pause, stick } | null      where the buttons go on mobile (centre, relative
 *                                                 to the screen); set by layout-ui.js
 *
 *   Settings.get('quality')  ·  Settings.set('fps', true)  ·  Settings.on(fn)
 *   Settings.fx   effective level 0 (low) .. 2 (high), with 'auto' already resolved
 */
export const Settings = (() => {
  const KEY = 'ps.settings';
  const DEF = { quality: 'auto', dmgNumbers: true, calm: false, fps: false, stick: 1, stickMode: 'float', pad: null };
  let s = Object.assign({}, DEF);
  try {
    Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    /* nothing */
  }
  const fns = new Set();

  // Automatic quality: starts high (medium on mobile) and drops if it stutters.
  const touchy = matchMedia('(pointer: coarse)').matches;
  let autoLevel = touchy ? 1 : 2;
  let acc = 0,
    frames = 0,
    slowT = 0,
    fastT = 0;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      /* nothing */
    }
  }
  function get(k) {
    return s[k];
  }
  function set(k, v) {
    s[k] = v;
    save();
    fns.forEach(fn => {
      try {
        fn(k, v);
      } catch (e) {
        /* nothing */
      }
    });
  }

  /** Called by the game loop every frame (only during a run). */
  function sample(dt) {
    if (s.quality !== 'auto' || dt <= 0) return;
    acc += dt;
    frames++;
    if (acc < 1) return;
    const fps = frames / acc;
    acc = 0;
    frames = 0;
    // 3 s in a row below 45 FPS: drop a level; 8 s above 57: raise it.
    if (fps < 45) {
      slowT++;
      fastT = 0;
    } else if (fps > 57) {
      fastT++;
      slowT = 0;
    } else {
      slowT = fastT = 0;
    }
    if (slowT >= 3 && autoLevel > 0) {
      autoLevel--;
      slowT = 0;
    }
    if (fastT >= 8 && autoLevel < (touchy ? 1 : 2)) {
      autoLevel++;
      fastT = 0;
    }
  }

  return {
    get,
    set,
    sample,
    DEF,
    on(fn) {
      fns.add(fn);
    },
    get all() {
      return Object.assign({}, s);
    },
    get fx() {
      return s.quality === 'auto' ? autoLevel : s.quality === 'high' ? 2 : s.quality === 'mid' ? 1 : 0;
    },
    get autoLevel() {
      return autoLevel;
    },
    get touch() {
      return touchy;
    }
  };
})();
