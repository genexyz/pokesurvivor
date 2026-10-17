/* ============ layout-ui.js — place the buttons (mobile) ============
 * Settings > Controls > Place the buttons: shows the attacks (with the
 * item), the pause button and, if fixed, the joystick, and lets you drag them
 * anywhere. The center of each one is saved relative to the screen
 * (Settings 'pad'); whatever isn't moved stays in its usual place.
 * The HUD (hud.js) and the joystick (touch.js) read those positions.
 * The sizes copy the HUD's: if they change there, change them here.
 */
import { U } from '../core/util.js';
import { Settings } from '../core/settings.js';
import { Touch } from '../core/touch.js';
import { UI } from './ui.js';

export const LayoutUI = (() => {
  const S = 54,
    GAP = 9,
    ITEM_GAP = 18,
    N = 4; // as in hud.js
  const BAR_W = S + ITEM_GAP + N * S + (N - 1) * GAP;
  let el = null,
    pos = null,
    moved = null,
    mode = 'float';

  /** Where each thing is right now (center in px), from the saved layout or the default. */
  function current(k, w, h) {
    const p = Touch.spot(k);
    if (k === 'stick') {
      const b = Touch.stickBase(w, h);
      return [b.x, b.y];
    }
    const sa = Touch.safeArea();
    if (k === 'bar') {
      if (p) return [p[0] * w, p[1] * h];
      const totalW = N * S + (N - 1) * GAP;
      const left = (w - totalW) / 2 - S - ITEM_GAP;
      return [left + BAR_W / 2, h - S - 18 - Math.min(28, sa.bottom) + S / 2];
    }
    if (p) return [p[0] * w, p[1] * h];
    return [w - 52 - Math.min(44, sa.right) + 20, 12 + Math.min(20, sa.top) + 20];
  }

  /** Same as the HUD does to keep it on screen. */
  function fit(k, x, y, w, h) {
    if (k === 'bar') return [U.clamp(x, 6 + BAR_W / 2, Math.max(6 + BAR_W / 2, w - BAR_W / 2 - 6)), U.clamp(y, 24 + S / 2, h - S / 2 - 6)];
    if (k === 'pause') return [U.clamp(x, 24, w - 24), U.clamp(y, 30, h - 24)];
    const r = Touch.R();
    return [U.clamp(x, r + 4, w - r - 4), U.clamp(y, r + 4, h - r - 4)];
  }

  function build() {
    el = document.createElement('section');
    el.id = 'scr-layout';
    el.className = 'scr hidden';
    const slots = Array.from({ length: N }, (_, i) => `<div class="lay-slot${i === 0 ? ' on' : ''}"><i>${i + 1}</i></div>`).join('');
    el.innerHTML = `
      <div class="lay-thing lay-bar" data-k="bar"><div class="lay-slot item"></div>${slots}<span class="lay-tag">Attacks</span></div>
      <div class="lay-thing lay-pause" data-k="pause"><b></b><b></b></div>
      <div class="lay-thing lay-stick" data-k="stick"><div class="knob"></div><span class="lay-tag">Joystick</span></div>
      <div class="box lay-panel">
        <h3>Drag the buttons wherever you want</h3>
        <p class="lay-turn">Turn your phone: the game is played in landscape.</p>
        <div class="chips set-chips" id="lay-mode"><b>Joystick</b>
          <button class="chip" data-m="float">Floating</button><button class="chip" data-m="fixed">Fixed</button>
        </div>
        <small class="lay-help">Floating: it appears where you put your finger. Fixed: always in the same place.</small>
        <div class="row wrap lay-btns">
          <button class="btn small ghost" id="lay-cancel">Cancel</button>
          <button class="btn small" id="lay-reset">Reset</button>
          <button class="btn small gold" id="lay-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelectorAll('.lay-thing').forEach(drag);
    el.querySelectorAll('#lay-mode .chip').forEach(b => {
      b.onclick = () => {
        mode = b.dataset.m;
        paint();
      };
    });
    el.querySelector('#lay-cancel').onclick = close;
    el.querySelector('#lay-reset').onclick = () => {
      moved = {};
      mode = 'float';
      const w = innerWidth,
        h = innerHeight,
        sa = Touch.safeArea();
      const totalW = N * S + (N - 1) * GAP;
      pos = {
        bar: [(w - totalW) / 2 - S - ITEM_GAP + BAR_W / 2, h - S - 18 - Math.min(28, sa.bottom) + S / 2],
        pause: [w - 52 - Math.min(44, sa.right) + 20, 12 + Math.min(20, sa.top) + 20],
        stick: [Touch.STICK_DEF[0] * w, Touch.STICK_DEF[1] * h]
      };
      for (const k in pos) pos[k] = fit(k, pos[k][0], pos[k][1], w, h);
      paint();
    };
    el.querySelector('#lay-save').onclick = save;
    addEventListener('resize', () => {
      if (isOpen()) {
        load();
        paint();
      }
    });
  }

  function drag(node) {
    const k = node.dataset.k;
    let off = null;
    node.addEventListener('pointerdown', e => {
      e.preventDefault();
      off = [e.clientX - pos[k][0], e.clientY - pos[k][1]];
      node.classList.add('held');
      try {
        node.setPointerCapture(e.pointerId);
      } catch (err) {
        /* nothing */
      }
    });
    node.addEventListener('pointermove', e => {
      if (!off) return;
      pos[k] = fit(k, e.clientX - off[0], e.clientY - off[1], innerWidth, innerHeight);
      moved[k] = true;
      paint();
    });
    const up = () => {
      off = null;
      node.classList.remove('held');
    };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  function load() {
    const w = innerWidth,
      h = innerHeight;
    pos = {};
    moved = {};
    for (const k of ['bar', 'pause', 'stick']) {
      const c = current(k, w, h);
      pos[k] = fit(k, c[0], c[1], w, h);
      moved[k] = !!Touch.spot(k);
    }
  }

  function paint() {
    const r = Touch.R();
    const place = (k, ww, hh) => {
      const n = el.querySelector(`[data-k="${k}"]`);
      n.style.left = pos[k][0] - ww / 2 + 'px';
      n.style.top = pos[k][1] - hh / 2 + 'px';
      n.style.width = ww + 'px';
      n.style.height = hh + 'px';
      return n;
    };
    place('bar', BAR_W, S);
    place('pause', 40, 40);
    place('stick', r * 2, r * 2).classList.toggle('hidden', mode !== 'fixed');
    el.querySelectorAll('#lay-mode .chip').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    el.querySelector('.lay-turn').classList.toggle('hidden', innerWidth >= innerHeight);
  }

  function save() {
    const w = innerWidth,
      h = innerHeight,
      pad = {};
    for (const k in pos) if (moved[k]) pad[k] = [+(pos[k][0] / w).toFixed(4), +(pos[k][1] / h).toFixed(4)];
    Settings.set('pad', Object.keys(pad).length ? pad : null);
    Settings.set('stickMode', mode);
    UI.toast('Buttons placed');
    close();
  }

  function open() {
    if (!el) build();
    mode = Settings.get('stickMode') === 'fixed' ? 'fixed' : 'float';
    load();
    el.classList.remove('hidden');
    paint();
  }
  function close() {
    if (el) el.classList.add('hidden');
  }
  const isOpen = () => !!el && !el.classList.contains('hidden');

  return {
    open,
    close,
    get isOpen() {
      return isOpen();
    }
  };
})();
