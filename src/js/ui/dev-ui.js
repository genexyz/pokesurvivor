/* ============ dev-ui.js — developer panel (npm run dev only) ============
 * scripts/build.js leaves every <script data-dev> out of the published game,
 * so this panel only exists when the source is served (npm run dev).
 * Toggle it with the ` key or the DEV button (bottom left).
 *
 * Run tools (time, levels, god mode, spawns, events) and a live editor for
 * G.Balance: edit a value and it applies at once. "Copy changes" puts the
 * edited values on the clipboard to paste into src/js/data/balance.js.
 * Using any run tool marks the run as tampered (it won't reach the leaderboard).
 */
G.DevUI = (() => {
  let root = null,
    open = false;
  const original = new Map(); // "spawn.cap" -> value at load time
  const changed = new Map(); // "spawn.cap" -> new value

  const CSS = `
#dev-btn { position: fixed; left: 6px; bottom: 6px; z-index: 9998; font: 11px monospace; padding: 2px 6px;
  background: #b0306a; color: #fff; border: 0; border-radius: 4px; cursor: pointer; opacity: .75 }
#dev-panel { position: fixed; left: 6px; bottom: 30px; z-index: 9999; width: 340px; max-height: 80vh; overflow: auto;
  background: rgba(10, 12, 24, .94); color: #e8ecf8; font: 12px/1.35 monospace; border: 1px solid #b0306a;
  border-radius: 6px; padding: 8px }
#dev-panel h4 { margin: 8px 0 4px; color: #ff8ad8; font-size: 12px }
#dev-panel button { font: 11px monospace; margin: 2px; padding: 2px 6px; background: #252a44; color: #e8ecf8;
  border: 1px solid #3c4470; border-radius: 3px; cursor: pointer }
#dev-panel button:hover { background: #343b62 }
#dev-panel input { font: 11px monospace; background: #151830; color: #fff; border: 1px solid #3c4470; padding: 1px 4px }
#dev-panel .row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px }
#dev-panel details { margin-left: 8px }
#dev-panel summary { cursor: pointer; color: #9fd4ff }
#dev-panel .kv { display: flex; justify-content: space-between; gap: 6px; margin: 1px 0 1px 8px }
#dev-panel .kv input { width: 76px; text-align: right }
#dev-panel .kv.mod span { color: #ffd33d }
#dev-panel .fn { color: #8a93b8 }
#dev-panel .note { color: #8a93b8; font-size: 11px }`;

  function el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'on') for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of [].concat(kids)) if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }
  const btn = (text, fn) => el('button', { type: 'button', text, on: { click: fn } });
  const row = (...kids) => el('div', { class: 'row' }, kids);

  // ---------------- run tools ----------------

  const D = () => G.Game.debug;
  const inRun = () => G.Game.player && G.Game.state !== 'ui' && G.Game.state !== 'over';
  /** Only while a run is going (otherwise there's nothing to act on). */
  const run = fn => () => {
    if (!inRun()) return G.UI.toast('Start a run first');
    fn();
    refresh();
  };

  function seedRow() {
    const input = el('input', { size: 9, placeholder: 'next seed' });
    const label = el('span', { class: 'note', id: 'dev-seed' });
    return el('div', {}, [
      row(label),
      row(
        input,
        btn('Set', () => {
          const s = G.RNG.parse(input.value);
          if (s == null) return G.UI.toast('A seed is 1-7 letters/digits');
          D().nextSeed = s;
          refresh();
        }),
        btn('Random', () => {
          D().nextSeed = null;
          input.value = '';
          refresh();
        }),
        btn('Replay this', () => {
          D().nextSeed = G.RNG.seed;
          refresh();
        })
      )
    ]);
  }

  function runTools() {
    const wx = ['sun', 'rain', 'sand', 'snow'];
    return el('div', {}, [
      el('h4', { text: 'Seed' }),
      seedRow(),
      el('h4', { text: 'Run' }),
      row(
        btn(
          '+1 min',
          run(() => D().time(G.Game.st.time + 60))
        ),
        btn(
          '+5 min',
          run(() => D().time(G.Game.st.time + 300))
        ),
        btn(
          '→ 29:50',
          run(() => D().time(29 * 60 + 50))
        )
      ),
      row(
        ...[0.5, 1, 2, 4].map(k =>
          btn(
            '×' + k,
            run(() => D().speed(k))
          )
        )
      ),
      row(
        btn(
          '+1 level',
          run(() => D().levels(1))
        ),
        btn(
          '+5 levels',
          run(() => D().levels(5))
        ),
        btn(
          'Heal',
          run(() => D().heal())
        ),
        btn(
          'God mode',
          run(() => D().god(!D().godOn))
        )
      ),
      el('h4', { text: 'Spawn' }),
      row(
        btn(
          'Boss',
          run(() => D().boss())
        ),
        btn(
          'Swarm',
          run(() => G.Spawner.burst(20))
        ),
        btn(
          'Thief',
          run(() => G.Events.debugThief())
        ),
        btn(
          'Next shiny',
          run(() => G.Spawner.debugForceShiny(1))
        ),
        btn(
          'Kill all',
          run(() => D().killAll())
        )
      ),
      el('h4', { text: 'Events' }),
      row(
        ...['horde', 'gold', 'lost'].map(id =>
          btn(
            id,
            run(() => G.Events.debugStart(id))
          )
        ),
        btn(
          'Rift',
          run(() => G.Rift.debugOpen())
        ),
        btn(
          'Judgment',
          run(() => G.Judgment.debugStart())
        )
      ),
      row(
        ...wx.map(k =>
          btn(
            k,
            run(() => G.Weather.debugStart(k, 60))
          )
        )
      )
    ]);
  }

  // ---------------- balance editor ----------------

  function snapshot(obj, path) {
    for (const k of Object.keys(obj)) {
      const v = obj[k],
        p = path ? path + '.' + k : k;
      if (typeof v === 'number') original.set(p, v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) snapshot(v, p);
      else if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'number' && original.set(p + '.' + i, x));
    }
  }

  function setAt(path, v) {
    const keys = path.split('.');
    let o = G.Balance;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = v;
    if (v === original.get(path)) changed.delete(path);
    else changed.set(path, v);
  }

  function numInput(path, v) {
    const line = el('div', { class: 'kv' + (changed.has(path) ? ' mod' : '') });
    const input = el('input', { value: String(v) });
    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (!isFinite(n)) return (input.value = String(v));
      setAt(path, n);
      v = n;
      line.classList.toggle('mod', changed.has(path));
    });
    line.append(el('span', { text: path.split('.').pop() }), input);
    return line;
  }

  function tree(obj, path) {
    const box = el('div');
    for (const k of Object.keys(obj)) {
      const v = obj[k],
        p = path ? path + '.' + k : k;
      if (typeof v === 'number') box.appendChild(numInput(p, v));
      else if (Array.isArray(v) && v.every(x => typeof x === 'number')) {
        const d = el('details', {}, [el('summary', { text: k + ' [' + v.length + ']' })]);
        v.forEach((x, i) => d.appendChild(numInput(p + '.' + i, x)));
        box.appendChild(d);
      } else if (typeof v === 'function') box.appendChild(el('div', { class: 'kv fn', text: k + '(): edit in balance.js' }));
      else if (v && typeof v === 'object') {
        const d = el('details', {}, [el('summary', { text: k })]);
        d.addEventListener('toggle', () => {
          if (d.open && d.children.length === 1) d.appendChild(tree(v, p));
        });
        box.appendChild(d);
      }
    }
    return box;
  }

  function balanceTools() {
    return el('div', {}, [
      el('h4', { text: 'Balance (live)' }),
      el('div', { class: 'note', text: 'Edits apply at once and last until you reload.' }),
      row(
        btn('Copy changes', () => {
          const out = [...changed].map(([p, v]) => `G.Balance.${p} = ${v}; // was ${original.get(p)}`).join('\n');
          if (!out) return G.UI.toast('Nothing changed');
          navigator.clipboard.writeText(out).then(
            () => G.UI.toast(changed.size + ' change(s) copied'),
            () => console.log(out)
          );
        }),
        btn('Reset all', () => {
          for (const p of [...changed.keys()]) setAt(p, original.get(p));
          build();
        })
      ),
      tree(G.Balance, '')
    ]);
  }

  // ---------------- panel ----------------

  function refresh() {
    const s = root && root.querySelector('#dev-seed');
    if (!s) return;
    const next = D().nextSeed;
    s.textContent =
      'This run: ' + G.RNG.code() + (G.RNG.custom ? ' (chosen)' : '') + ' · next: ' + (next == null ? 'random' : G.RNG.code(next));
  }

  function build() {
    if (root) root.remove();
    root = el('div', { id: 'dev-panel', translate: 'no' }, [runTools(), balanceTools()]);
    root.style.display = open ? '' : 'none';
    document.body.appendChild(root);
    refresh();
  }

  function toggle() {
    open = !open;
    if (!root) build();
    root.style.display = open ? '' : 'none';
    refresh();
  }

  function init() {
    if (!G.Balance || !G.Game || !G.Game.debug) return;
    snapshot(G.Balance, '');
    document.head.appendChild(el('style', { text: CSS }));
    document.body.appendChild(el('button', { id: 'dev-btn', type: 'button', translate: 'no', text: 'DEV', on: { click: toggle } }));
    addEventListener('keydown', e => {
      if (e.key !== '`' || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      e.preventDefault();
      toggle();
    });
  }

  addEventListener('load', init);
  return { toggle };
})();
