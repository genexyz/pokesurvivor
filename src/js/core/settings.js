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
 *   itemConfirm 'always' | 'drawback' | 'never'  ask before equipping the first item of a run
 *                                                 (drawback: only Choice Band, Life Orb...)
 *   gachaSkip   true/false                        open the gacha without the slot machine
 *   recount     true/false                        damage meter in the run (key R)
 *   autoFast    true/false                        solo runs start at x2 speed
 *   res         'auto' | 'high' | 'low'            internal resolution (game.js computeDpr)
 *   fpsCap      'auto' | 0 | 30 | 60 | 120        frame cap (0 = the screen's rate; auto = 60 on mobile,
 *                                                 none on computers). Settings.fpsCap resolves it.
 *   pad         { bar, pause, stick } | null      where the buttons go on mobile (centre, relative
 *                                                 to the screen); set by layout-ui.js
 *
 *   Settings.get('quality')  ·  Settings.set('fps', true)  ·  Settings.on(fn)
 *   Settings.fx   effective level 0 (low) .. 2 (high), with 'auto' already resolved
 */
export const Settings = (() => {
  const KEY = 'ps.settings';
  const DEF = {
    quality: 'auto',
    dmgNumbers: true,
    calm: false,
    fps: false,
    stick: 1,
    stickMode: 'float',
    itemConfirm: 'drawback',
    gachaSkip: false,
    recount: false,
    autoFast: false,
    res: 'auto',
    fpsCap: 'auto',
    pad: null
  };
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
  // 'auto' frame cap (2026-10-17): until then every stored copy had fpsCap 0 whether the
  // player chose "No limit" or not, so a 0 moves to auto once. On a 90/120 Hz phone it was
  // drawing every frame twice as often as needed: heat, then the phone slowing itself down.
  if (!s.fpsAuto) {
    if (s.fpsCap === 0) s.fpsCap = 'auto';
    s.fpsAuto = true;
  }
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

  /**
   * Called by the game loop every frame (only during a run). `cap`: the frame cap in
   * use (0 = none); with a 30 cap, 30 FPS is not stuttering.
   */
  function sample(dt, cap = 0) {
    if (s.quality !== 'auto' || dt <= 0) return;
    acc += dt;
    frames++;
    if (acc < 1) return;
    const fps = frames / acc;
    acc = 0;
    frames = 0;
    // 3 s in a row below 45 FPS: drop a level; 8 s above 57: raise it (less with a cap).
    const lo = cap ? Math.min(45, cap * 0.75) : 45,
      hi = cap ? Math.min(57, cap * 0.95) : 57;
    if (fps < lo) {
      slowT++;
      fastT = 0;
    } else if (fps > hi) {
      fastT++;
      slowT = 0;
    } else {
      slowT = fastT = 0;
    }
    const was = autoLevel;
    if (slowT >= 3 && autoLevel > 0) {
      autoLevel--;
      slowT = 0;
    }
    if (fastT >= 8 && autoLevel < (touchy ? 1 : 2)) {
      autoLevel++;
      fastT = 0;
    }
    if (autoLevel !== was)
      fns.forEach(fn => {
        try {
          fn('autoLevel', autoLevel);
        } catch (e) {
          /* nothing */
        }
      });
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
    /** Frame cap in use (0 = none), with 'auto' resolved. */
    get fpsCap() {
      return s.fpsCap === 'auto' ? (touchy ? 60 : 0) : s.fpsCap | 0;
    },
    get touch() {
      return touchy;
    }
  };
})();
