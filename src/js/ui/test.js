/* ============ test.js — personality quiz and partner choice ============ */
import { U } from '../core/util.js';
import { DEX_BY } from '../data/pokedex.js';
import { DB } from '../core/db.js';
import { Moves } from '../data/moves.js';
import { PERSONALITY_TEST, STARTERS, TRAIT_NAME, TRAIT_TEXT, personalityResult } from '../data/starters.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { Flow } from '../game.js';

export const TestUI = (() => {
  const $ = UI.$;
  let idx = 0,
    scores = {},
    result = null,
    picked = null;

  function init() {
    $('res-ok').onclick = () => choose(result.dex);
    $('res-other').onclick = openStarters;
    $('starter-back').onclick = () => UI.show('scr-result');
    $('starter-ok').onclick = () => {
      if (picked) choose(picked);
    };
  }

  function start() {
    idx = 0;
    scores = {};
    result = null;
    UI.chrome(false);
    UI.show('scr-test');
    render();
  }

  function render() {
    const Q = PERSONALITY_TEST;
    const q = Q[idx];
    $('test-bar').style.width = (idx / Q.length) * 100 + '%';
    $('test-count').textContent = `Question ${idx + 1} of ${Q.length}`;
    $('test-q').textContent = q.q;
    const box = $('test-a');
    box.innerHTML = '';
    q.a.forEach(a => {
      const b = document.createElement('button');
      b.className = 'answer';
      b.dataset.sfx = 'select';
      b.textContent = a.t;
      b.onclick = () => answer(a);
      box.appendChild(b);
    });
  }

  function answer(a) {
    for (const k in a.p) scores[k] = (scores[k] || 0) + a.p[k];
    idx++;
    if (idx < PERSONALITY_TEST.length) render();
    else showResult();
  }

  function showResult() {
    result = personalityResult(scores);
    const mon = DEX_BY[result.dex];
    $('res-trait').textContent = TRAIT_NAME[result.trait] || result.trait.charAt(0).toUpperCase() + result.trait.slice(1);
    $('res-text').textContent = TRAIT_TEXT[result.trait] || '';
    $('res-name').textContent = mon.name;
    UI.sprite($('res-stage'), mon.dex, { lively: true, scale: 4, hero: true });
    $('res-stage').style.setProperty('--stage-c', U.TYPE_COLOR[mon.types[0]]);
    UI.show('scr-result');
  }

  /** Opens the starter grid. `fromMenu` = change the starting partner later. */
  function openStarters() {
    picked = null;
    $('starter-ok').disabled = true;
    $('starter-info').textContent = 'Pick a Pokémon';
    const grid = $('starter-grid');
    grid.innerHTML = '';
    for (const s of STARTERS) {
      const mon = DEX_BY[s.dex];
      const cell = document.createElement('div');
      cell.className = 'cell' + (result && s.dex === result.dex ? ' on' : '');
      cell.appendChild(UI.spriteCanvas(s.dex, 92, 80, { scale: 2 }));
      cell.insertAdjacentHTML('beforeend', `<b>${mon.name}</b>`);
      cell.onclick = () => {
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        picked = s.dex;
        const mv = Moves.BY_ID[s.start];
        $('starter-info').innerHTML =
          `${UI.typeChips(mon.types)} ${Icons.html('move:' + s.start, 16)} ${mv.name} · ${s.traits.map(t => TRAIT_NAME[t] || t).join(', ')}`;
        $('starter-ok').disabled = false;
      };
      if (result && s.dex === result.dex) {
        picked = s.dex;
        $('starter-ok').disabled = false;
      }
      grid.appendChild(cell);
    }
    UI.show('scr-starters');
  }

  function choose(dex) {
    const save = DB.save;
    save.starter = dex;
    save.partner = dex;
    save.personality = result ? { trait: result.trait, scores } : null;
    DB.grant(dex, 'starter');
    DB.commit();
    UI.toast(DEX_BY[dex].name + ' joins you!');
    Flow.goMenu();
  }

  return { init, start };
})();
