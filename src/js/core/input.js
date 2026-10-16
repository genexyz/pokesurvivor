/* ============ input.js — keyboard and mouse (touch is in touch.js) ============ */
import { U } from './util.js';
import { Touch } from './touch.js';

export const Input = (() => {
  const down = new Set();
  const pressed = new Set(); // cleared every frame
  let mx = 0,
    my = 0,
    mdown = false;

  const MOVE_KEYS = {
    up: ['keyw', 'arrowup'],
    down: ['keys', 'arrowdown'],
    left: ['keya', 'arrowleft'],
    right: ['keyd', 'arrowright']
  };

  function code(e) {
    return (e.code || e.key).toLowerCase();
  }

  /** Typing in a text field is not a game key (Esc still goes through, to close the screen). */
  function editable(t) {
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  addEventListener('keydown', e => {
    const c = code(e);
    if (c !== 'escape' && editable(e.target)) return;
    if (!down.has(c)) pressed.add(c);
    down.add(c);
    // Keep the browser from scrolling with arrows/space during the game.
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space', 'tab'].includes(c)) e.preventDefault();
  });
  addEventListener('keyup', e => down.delete(code(e)));
  addEventListener('blur', () => {
    down.clear();
  });
  addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
  });
  addEventListener('mousedown', () => (mdown = true));
  addEventListener('mouseup', () => (mdown = false));

  return {
    /** Player movement vector (keyboard or touch joystick). */
    axis() {
      const t = Touch && Touch.vector();
      if (t && (t[0] || t[1])) return t;
      let x = 0,
        y = 0;
      if (MOVE_KEYS.left.some(k => down.has(k))) x -= 1;
      if (MOVE_KEYS.right.some(k => down.has(k))) x += 1;
      if (MOVE_KEYS.up.some(k => down.has(k))) y -= 1;
      if (MOVE_KEYS.down.some(k => down.has(k))) y += 1;
      return U.norm(x, y);
    },
    held(c) {
      return down.has(c);
    },
    /** true only on the frame it was pressed. */
    tap(c) {
      return pressed.has(c);
    },
    mouse() {
      return { x: mx, y: my, down: mdown };
    },
    endFrame() {
      pressed.clear();
    }
  };
})();
