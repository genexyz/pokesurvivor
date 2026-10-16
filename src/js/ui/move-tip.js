/* ============ move-tip.js — what a move does, over the skill bar ============
 * Mouse: hover a move (or the held item) on the HUD bar. Touch: keep the finger on it
 * for a moment; it closes when that finger lets go or leaves the icon. Information
 * only: tapping still switches moves as before.
 *
 * The HUD reports where its slots are every frame (frame()); the tip is a DOM card
 * (#move-tip), rebuilt only when what it shows changes. It is hidden whenever the run
 * isn't being played or a screen is open over it (pause, level up...), and UI.show/
 * hideAll hide it too.
 */
import { Items } from '../data/items.js';
import { Input } from '../core/input.js';
import { Icons } from './icons.js';
import { StatsUI } from './stats-ui.js';
import { Game } from '../game.js';

export const MoveTip = (() => {
  const HOLD_MS = 350;
  let el = null,
    shownKey = '',
    lastRect = '',
    rects = [],
    mouse = false, // the last pointer was a mouse (on touch laptops both happen)
    hold = null; // { id, x, y, timer, on } long press in progress

  const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const at = (x, y) => rects.find(r => inside(r, x, y));

  function init() {
    el = document.getElementById('move-tip');
    addEventListener('pointermove', e => {
      mouse = e.pointerType === 'mouse';
      if (hold && e.pointerId === hold.id && !hold.on) {
        const r = at(e.clientX, e.clientY);
        if (!r || r !== at(hold.x, hold.y)) cancelHold();
      } else if (hold && e.pointerId === hold.id && hold.on && !at(e.clientX, e.clientY)) {
        cancelHold();
        hide();
      }
    });
    addEventListener('pointerdown', e => {
      mouse = e.pointerType === 'mouse';
      if (mouse || hold || Game.state !== 'playing') return;
      const r = at(e.clientX, e.clientY);
      if (!r) return;
      hold = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
      hold.timer = setTimeout(() => {
        if (!hold) return;
        hold.on = true;
        const t = at(hold.x, hold.y);
        if (t && Game.player) show(t, Game.player);
      }, HOLD_MS);
    });
    const up = e => {
      if (!hold || e.pointerId !== hold.id) return;
      const was = hold.on;
      cancelHold();
      if (was) hide();
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('blur', () => {
      cancelHold();
      hide();
    });
  }

  function cancelHold() {
    if (hold) clearTimeout(hold.timer);
    hold = null;
  }

  /** Nothing over the run: playing, no screen open. */
  function clear() {
    return Game.state === 'playing' && !document.querySelector('.scr:not(.hidden)');
  }

  /**
   * Called by the HUD every frame with the bar's slots:
   * [{ x, y, w, h, group: [moves] | item: id, key }]
   */
  function frame(list, pl) {
    rects = list;
    if (!el) return;
    if (hold && hold.on) {
      if (!clear()) hide();
      return;
    }
    if (!mouse) {
      hide();
      return;
    }
    const m = Input.mouse();
    const r = at(m.x, m.y);
    if (!r || !clear()) hide();
    else show(r, pl);
  }

  function keyOf(r, pl) {
    if (r.item) return 'i:' + r.item;
    // Rebuilt when a level, an evolution, the build or a stat card changes the numbers.
    return (
      r.key +
      '|' +
      r.group.map(m => `${m.id}:${m.lvl}:${m.evolved ? 1 : 0}:${Math.round(m.dealt / 100)}`).join(',') +
      '|' +
      Math.round(pl.atkMul * 100) +
      ':' +
      Math.round(pl.cdMul * 100) +
      ':' +
      Object.values(pl.statsTaken).join('.')
    );
  }

  function show(r, pl) {
    if (el.classList.contains('hidden')) shownKey = ''; // hidden from outside (UI.show)
    const key = keyOf(r, pl);
    if (key !== shownKey) {
      shownKey = key;
      lastRect = '';
      if (r.item) {
        const it = Items.BY[r.item];
        el.className = 'box move-tip';
        el.innerHTML = `<div class="cards"><div class="card"><div class="ico">${Icons.html(r.item, 32)}</div>
          <div class="txt"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div></div></div>`;
      } else {
        el.className = 'box move-tip' + (r.group.length > 1 ? ' multi' : '');
        el.innerHTML = `<div class="cards">${r.group.map((m, j) => StatsUI.moveCard(pl, m, j ? '' : r.key)).join('')}</div>`;
      }
    }
    // Above the slot (below if it doesn't fit), inside the screen.
    const rk = `${r.x}|${r.y}|${innerWidth}|${innerHeight}`;
    if (rk === lastRect) return;
    lastRect = rk;
    const tw = el.offsetWidth,
      th = el.offsetHeight;
    const x = Math.max(6, Math.min(innerWidth - tw - 6, r.x + r.w / 2 - tw / 2));
    let y = r.y - th - 10;
    if (y < 6) y = Math.min(innerHeight - th - 6, r.y + r.h + 10);
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(Math.max(6, y)) + 'px';
  }

  function hide() {
    if (!el || !shownKey) return;
    el.className = 'box move-tip hidden';
    shownKey = '';
    lastRect = '';
  }

  return { init, frame, hide };
})();
