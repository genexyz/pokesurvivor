/* ============ search-select.js — dropdowns you can type into ============
 * Turns a native <select> into a button that opens a searchable list in the game's
 * style. The <select> stays (hidden) as the source of truth: picking an option sets
 * its value and fires its 'change', so the code that fills and listens to it doesn't
 * change. After filling a select (or changing its value from code), call enhance()
 * again to refresh the button.
 *
 * On touch screens short lists keep the native select (the phone's own picker is
 * better than a keyboard popping up for 5 options), and the search field is not
 * focused when the list opens.
 *
 *   SearchSelect.enhance(sel, { placeholder })   SearchSelect.close()
 */
import { U } from '../core/util.js';

export const SearchSelect = (() => {
  const SHORT = 15, // fewer options than this keep the native select on touch
    MAX = 100; // options listed at once (keep typing to narrow it down)
  let pop = null,
    input = null,
    list = null,
    status = null,
    cur = null; // { sel, trig, opts, shown, active }

  const touch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;

  function build() {
    pop = document.createElement('div');
    pop.className = 'panel ss-pop hidden';
    pop.innerHTML = `<input class="field ss-input" type="search" autocomplete="off" spellcheck="false" role="combobox"
        aria-autocomplete="list" aria-controls="ss-list" aria-expanded="true">
      <div class="ss-list" id="ss-list" role="listbox"></div>
      <p class="ss-status note" role="status" aria-live="polite"></p>`;
    document.body.appendChild(pop);
    input = pop.querySelector('.ss-input');
    list = pop.querySelector('.ss-list');
    status = pop.querySelector('.ss-status');
    input.oninput = () => render(true);
    input.onkeydown = onKey;
    list.onpointerdown = e => e.preventDefault(); // keep the focus in the search field
    list.onclick = e => {
      const o = e.target.closest('[data-i]');
      if (o) choose(cur.shown[+o.dataset.i]);
    };
    document.addEventListener(
      'pointerdown',
      e => {
        if (cur && !pop.contains(e.target) && e.target !== cur.trig) close();
      },
      true
    );
    addEventListener('resize', () => close());
    document.addEventListener(
      'scroll',
      e => {
        if (cur && !pop.contains(e.target)) close();
      },
      true
    );
  }

  /** Makes `sel` searchable (or refreshes its button after its options or value changed). */
  function enhance(sel, opts = {}) {
    let trig = sel._ss;
    if (touch() && sel.options.length < SHORT) {
      if (trig) {
        trig.remove();
        sel._ss = null;
        sel.classList.remove('ss-hidden');
      }
      return;
    }
    if (!trig) {
      trig = document.createElement('button');
      trig.type = 'button';
      trig.className = 'field ss-trigger';
      trig.setAttribute('aria-haspopup', 'listbox');
      trig.onclick = () => (cur && cur.sel === sel ? close() : open(sel));
      trig.onkeydown = e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          open(sel);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
          // Type-ahead: start searching with that letter.
          e.preventDefault();
          open(sel, e.key);
        }
      };
      sel.classList.add('ss-hidden');
      sel.after(trig);
      sel._ss = trig;
      if (sel.style.width) trig.style.width = sel.style.width;
      if (sel.style.minWidth) trig.style.minWidth = sel.style.minWidth;
      if (sel.style.maxWidth) trig.style.maxWidth = sel.style.maxWidth;
    }
    sel._ssPh = opts.placeholder || sel._ssPh || 'Search…';
    const label = sel.getAttribute('aria-label') || (sel.id && document.querySelector(`label[for="${sel.id}"]`)?.textContent) || '';
    if (label) trig.setAttribute('aria-label', label);
    const o = sel.options[sel.selectedIndex];
    trig.innerHTML = `<span class="ss-val"></span><span class="ss-arrow" aria-hidden="true">▾</span>`;
    trig.firstChild.textContent = o ? o.text : '';
  }

  function open(sel, typed = '') {
    if (!pop) build();
    const trig = sel._ss;
    cur = {
      sel,
      trig,
      opts: [...sel.options].map((o, i) => ({ i, value: o.value, label: o.text, f: U.fold(o.text) })),
      shown: [],
      active: 0
    };
    trig.setAttribute('aria-expanded', 'true');
    input.value = typed;
    input.placeholder = sel._ssPh;
    pop.classList.remove('hidden');
    render(false);
    place();
    if (!touch() || typed) input.focus();
    watch();
  }

  /** Closes the list when its select leaves the screen (a screen change rebuilt it). */
  function watch() {
    if (!cur) return;
    if (!cur.trig.isConnected || !cur.trig.offsetParent) {
      close();
      return;
    }
    requestAnimationFrame(watch);
  }

  function close() {
    if (!cur) return;
    cur.trig.setAttribute('aria-expanded', 'false');
    cur = null;
    if (pop) pop.classList.add('hidden');
  }

  function render(typing) {
    const q = U.fold(input.value);
    const sel = cur.sel.selectedIndex;
    let shown = q ? cur.opts.filter(o => o.f.includes(q)) : cur.opts;
    // What starts with the search comes first ("pi" → Pikachu before Caterpie).
    if (q) shown = shown.filter(o => o.f.startsWith(q)).concat(shown.filter(o => !o.f.startsWith(q)));
    const more = shown.length - MAX;
    cur.shown = shown.slice(0, MAX);
    const at = cur.shown.findIndex(o => o.i === sel);
    cur.active = typing || at < 0 ? 0 : at;
    list.innerHTML = '';
    cur.shown.forEach((o, k) => {
      const d = document.createElement('div');
      d.className = 'ss-opt' + (o.i === sel ? ' sel' : '');
      d.id = 'ss-opt-' + k;
      d.dataset.i = k;
      d.setAttribute('role', 'option');
      d.setAttribute('aria-selected', o.i === sel);
      d.textContent = o.label;
      list.appendChild(d);
    });
    status.textContent = !cur.shown.length ? 'No results.' : more > 0 ? `Keep typing to narrow it down (${more} more)` : '';
    status.classList.toggle('hidden', !status.textContent);
    mark();
  }

  function mark() {
    list.querySelectorAll('.ss-opt.on').forEach(d => d.classList.remove('on'));
    const d = list.children[cur.active];
    if (d) {
      d.classList.add('on');
      d.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', d.id);
    } else input.removeAttribute('aria-activedescendant');
  }

  function onKey(e) {
    e.stopPropagation(); // the game must not see these keys (Esc would leave the screen)
    if (!cur) return;
    const n = cur.shown.length;
    const go = i => {
      e.preventDefault();
      if (!n) return;
      cur.active = (i + n) % n;
      mark();
    };
    if (e.key === 'ArrowDown') go(cur.active + 1);
    else if (e.key === 'ArrowUp') go(cur.active - 1);
    else if (e.key === 'PageDown') go(Math.min(n - 1, cur.active + 10));
    else if (e.key === 'PageUp') go(Math.max(0, cur.active - 10));
    else if (e.key === 'Home' && !input.value) go(0);
    else if (e.key === 'End' && !input.value) go(n - 1);
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (cur.shown[cur.active]) choose(cur.shown[cur.active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const t = cur.trig;
      close();
      t.focus();
    } else if (e.key === 'Tab') close();
  }

  function choose(o) {
    const { sel, trig } = cur;
    close();
    if (sel.value !== o.value) {
      sel.value = o.value;
      enhance(sel);
      sel.dispatchEvent(new Event('change'));
    }
    if (trig.isConnected) trig.focus();
  }

  /** Under the button, or above it if there is more room there; inside the screen. */
  function place() {
    const r = cur.trig.getBoundingClientRect();
    const vh = innerHeight,
      w = Math.max(r.width, 240);
    const below = vh - r.bottom - 8,
      above = r.top - 8;
    const up = below < 220 && above > below;
    const room = Math.max(120, up ? above : below);
    pop.style.width = Math.min(w, innerWidth - 12) + 'px';
    pop.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left)) + 'px';
    list.style.maxHeight = Math.min(260, room - 70) + 'px';
    if (up) {
      pop.style.top = '';
      pop.style.bottom = vh - r.top + 4 + 'px';
    } else {
      pop.style.bottom = '';
      pop.style.top = r.bottom + 4 + 'px';
    }
  }

  return { enhance, close };
})();
