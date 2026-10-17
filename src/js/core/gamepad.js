/* ============ gamepad.js — controllers (Xbox, PlayStation, Switch Pro...) ============
 * The browser's Gamepad API, standard layout. Polled once per frame from game.js.
 *
 * Buttons become real key events (keydown/keyup) for the key they stand for, so
 * Input, the game's key handling and the menus' own listeners need nothing new:
 *   A Space (in a run: Mega Evolve) · B Escape · X R · Y F (×2 speed) · LB/RB Q/E · Start/Select P
 * The left stick moves (analog, Pad.axis(), read by Input.axis()); so does the D-pad.
 *
 * Menus (any screen open, or outside a run): the stick and D-pad move a gold
 * highlight between the open screen's buttons and cards, A clicks it, LB/RB switch
 * tabs, the right stick scrolls. Fixed layout: no remapping yet.
 */
import { UI } from '../ui/ui.js';

export const Pad = (() => {
  const DEAD = 0.2;
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  // Button -> key it sends: [code, key]. A depends on the moment (see poll).
  const KEYS = {
    [B.B]: ['Escape', 'Escape'],
    [B.X]: ['KeyR', 'r'],
    [B.Y]: ['KeyF', 'f'],
    [B.LB]: ['KeyQ', 'q'],
    [B.RB]: ['KeyE', 'e'],
    [B.SELECT]: ['KeyP', 'p'],
    [B.START]: ['KeyP', 'p']
  };
  const REPEAT_FIRST = 0.35,
    REPEAT_NEXT = 0.12;

  let prev = [],
    stick = [0, 0],
    dpad = [0, 0],
    active = false,
    focus = null,
    navDir = null,
    navT = 0;

  addEventListener('gamepadconnected', () => UI.toast('Controller connected'));
  addEventListener('gamepaddisconnected', () => {
    UI.toast('Controller disconnected');
    stick = [0, 0];
    dpad = [0, 0];
    prev = [];
  });
  // Back to mouse or touch: the controller hints and the highlight go away.
  const off = () => {
    if (!active) return;
    active = false;
    document.body.classList.remove('pad');
    setFocus(null);
  };
  addEventListener('pointerdown', off);
  addEventListener('mousemove', e => (e.movementX || e.movementY) && off());

  function pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }

  function key(type, [code, k]) {
    const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
    t.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true, cancelable: true }));
  }

  /** Radial dead zone, rescaled so the stick still goes from 0 to 1. */
  function dead(x, y) {
    const m = Math.hypot(x, y);
    if (m < DEAD) return [0, 0];
    const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
    return [x * k, y * k];
  }

  // ---------------- menu navigation ----------------

  const PICK =
    'button:not([disabled]), a[href], select, input:not([type=hidden]), .card, .cell, .fav-slot, .tab, .ss-opt, [data-pad]';
  const hidden = el => !el || el.classList.contains('hidden');
  const $ = id => document.getElementById(id);

  /** The topmost open layer: what the highlight can move in. */
  function scope() {
    const pop = document.querySelector('.ss-pop:not(.hidden)');
    if (pop) return [pop];
    if (!hidden($('pull-fx'))) return [$('pull-fx')];
    for (const id of ['scr-profile', 'scr-settings', 'scr-legal', 'scr-news']) if (!hidden($(id))) return [$(id)];
    const open = [...document.querySelectorAll('section.scr:not(.hidden)')].filter(s => s.id !== 'scr-menu');
    if (open.length) return [open[open.length - 1]];
    return [$('scr-menu'), $('topbar')].filter(e => !hidden(e));
  }

  const visible = el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.closest('.hidden');
  function candidates(sc) {
    const out = [];
    for (const s of sc) for (const el of s.querySelectorAll(PICK)) if (visible(el) && !el.closest('.ss-hidden')) out.push(el);
    return out;
  }
  const centre = el => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };

  function setFocus(el) {
    if (focus) focus.classList.remove('pad-focus');
    focus = el;
    if (!el) return;
    el.classList.add('pad-focus');
    if (el.matches('button, a[href], select, input')) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** The highlight is still there and in the open layer. */
  function focusOk(sc) {
    return focus && focus.isConnected && visible(focus) && sc.some(s => s.contains(focus));
  }

  function move(dx, dy) {
    const sc = scope();
    const list = candidates(sc);
    if (!list.length) return setFocus(null);
    if (!focusOk(sc)) {
      setFocus(list.find(el => el.matches('.btn.gold')) || list[0]);
      return;
    }
    // A highlighted slider takes left/right.
    if (dx && focus.matches('input[type=range]')) {
      const step = +focus.step || 1;
      focus.value = +focus.value + dx * step;
      focus.dispatchEvent(new Event('input', { bubbles: true }));
      focus.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const [fx, fy] = centre(focus);
    let best = null,
      bs = Infinity;
    for (const el of list) {
      if (el === focus || focus.contains(el) || el.contains(focus)) continue;
      const [x, y] = centre(el);
      const along = (x - fx) * dx + (y - fy) * dy;
      if (along <= 1) continue;
      const across = Math.abs((x - fx) * dy - (y - fy) * dx);
      const s = along + across * 2;
      if (s < bs) {
        bs = s;
        best = el;
      }
    }
    if (best) setFocus(best);
  }

  /** LB/RB in menus: the neighbouring tab of the open screen. */
  function tab(d) {
    const tabs = candidates(scope()).filter(el => el.matches('.gen-tab, .tab'));
    if (tabs.length < 2) return false;
    const i = tabs.findIndex(t => t.classList.contains('on'));
    const t = tabs[(i + d + tabs.length) % tabs.length];
    t.click();
    return true;
  }

  function scroll(dy) {
    const sc = scope();
    let el = focusOk(sc) ? focus : sc[0];
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) break;
      el = el.parentElement;
    }
    if (el && el !== document.body) el.scrollTop += dy;
  }

  // ---------------- every frame ----------------

  /**
   * @param dt   real seconds since the last frame
   * @param navFn  menus are on screen (the highlight moves instead of the player): a
   *               function, asked only when a controller is connected
   */
  function poll(dt, navFn) {
    const p = pad();
    if (!p) return;
    const nav = navFn();
    const btn = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const now = p.buttons.map((_, i) => btn(i));
    const hit = i => now[i] && !prev[i];

    stick = dead(p.axes[0] || 0, p.axes[1] || 0);
    dpad = [(btn(B.RIGHT) ? 1 : 0) - (btn(B.LEFT) ? 1 : 0), (btn(B.DOWN) ? 1 : 0) - (btn(B.UP) ? 1 : 0)];
    const used = now.some(Boolean) || Math.hypot(...stick) > 0 || Math.abs(p.axes[3] || 0) > DEAD;
    if (used && !active) {
      active = true;
      document.body.classList.add('pad');
    }

    // Keys (press/release edges).
    for (const i in KEYS) {
      if (nav && (+i === B.LB || +i === B.RB)) {
        if (hit(+i) && tab(+i === B.LB ? -1 : 1)) continue;
      }
      if (hit(+i)) key('keydown', KEYS[i]);
      else if (!now[i] && prev[i]) key('keyup', KEYS[i]);
    }

    if (nav) {
      // A: press the highlighted thing (Enter when nothing is highlighted).
      if (hit(B.A)) {
        const sc = scope();
        if (focusOk(sc)) focus.matches('input:not([type=range]), select') ? focus.focus() : focus.click();
        else {
          key('keydown', ['Enter', 'Enter']);
          key('keyup', ['Enter', 'Enter']);
        }
      }
      // Stick or D-pad: one step, then repeats while held.
      const [sx, sy] = stick;
      const d =
        dpad[0] || dpad[1]
          ? dpad
          : Math.max(Math.abs(sx), Math.abs(sy)) > 0.5
            ? Math.abs(sx) > Math.abs(sy)
              ? [Math.sign(sx), 0]
              : [0, Math.sign(sy)]
            : null;
      const k = d ? d.join(',') : null;
      if (k !== navDir) {
        navDir = k;
        navT = REPEAT_FIRST;
        if (d) move(d[0], d[1]);
      } else if (d && (navT -= dt) <= 0) {
        navT = REPEAT_NEXT;
        move(d[0], d[1]);
      }
      const ry = (p.axes[3] || 0) * (Math.abs(p.axes[3] || 0) > DEAD ? 1 : 0);
      if (ry) scroll(ry * 900 * dt);
    } else {
      navDir = null;
      if (focus) setFocus(null);
      if (hit(B.A)) key('keydown', ['Space', ' ']);
      else if (!now[B.A] && prev[B.A]) key('keyup', ['Space', ' ']);
    }
    prev = now;
  }

  return {
    poll,
    /** Movement from the left stick (analog) or the D-pad; [0, 0] without a controller. */
    axis() {
      if (stick[0] || stick[1]) return stick;
      if (dpad[0] || dpad[1]) {
        const m = Math.hypot(dpad[0], dpad[1]);
        return [dpad[0] / m, dpad[1] / m];
      }
      return [0, 0];
    },
    /** A controller was the last thing used. */
    get active() {
      return active;
    }
  };
})();
