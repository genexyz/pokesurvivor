/* ============ run-ui.js — level-up cards, pause and end of run ============ */
import { U } from '../core/util.js';
import { RNG } from '../core/rng.js';
import { Balance } from '../data/balance.js';
import { I18n } from '../core/i18n.js';
import { DEX_BY } from '../data/pokedex.js';
import { Audio } from '../core/audio.js';
import { Items } from '../data/items.js';
import { Stages } from '../data/stages.js';
import { DB } from '../core/db.js';
import { LevelUp } from '../systems/levelup.js';
import { Social } from '../net/social.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { StatsUI } from './stats-ui.js';
import { Recount } from '../systems/recount.js';
import { Game } from '../game.js';

export const RunUI = (() => {
  const $ = UI.$;
  let offers = null,
    offerCb = null,
    coopMode = false;

  /** @param coop  group game: after choosing, wait for the others */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb;
    coopMode = coop;
    $('lvl-num').textContent = level;
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    UI.show('scr-levelup');
  }

  /**
   * Reroll the cards: 1 free per game and 1 more per boss defeated
   * (in a group the team's bosses count; each player has their own).
   */
  function rerollsLeft() {
    const p = Game.player;
    // The free ones + the ones bought in Upgrades (previously, 1 more per boss).
    return p ? Math.max(0, Balance.levelup.freeRerolls + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    Audio.sfx('select');
    renderCards(LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list;
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag =
        c.type === 'new'
          ? `<span class="tag-chip" style="background:${c.color}">New · ${c.tag}</span>`
          : c.type === 'up' || c.type === 'evo'
            ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
            : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      // A stat card says what it does to your number: "+23% → +31% · 3/8".
      const pv = c.type === 'stat' && Game.player ? StatsUI.preview(Game.player, c.key.slice(5)) : null;
      el.innerHTML = `<div class="ico" style="background:${c.color}33">${Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div>${pv ? `<div class="st-pv">${pv}</div>` : ''}</div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none'; // the game plays its own sound on pick
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  function pick(i) {
    if (!offers || !offers[i]) return;
    const c = offers[i],
      cb = offerCb;
    offers = null;
    offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    if (coopMode) {
      // The chosen card stays visible while the others choose.
      $('cards')
        .querySelectorAll('.card')
        .forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else UI.hide('scr-levelup');
    cb(c);
  }

  /** Co-op: who still has to choose. */
  function setWaiting(names) {
    const me = Social.me ? Social.me.name : '';
    const others = names.filter(n => n !== me);
    const and = I18n.lang === 'es' ? ' y ' : ' and ';
    const list = a => (a.length > 1 ? a.slice(0, -1).join(', ') + and + a[a.length - 1] : a[0]);
    $('lvl-wait').textContent = !names.length
      ? ''
      : !others.length
        ? 'Choose your card'
        : names.includes(me)
          ? 'Still choosing: ' + list([...others, I18n.t('you')])
          : 'Waiting for ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null;
    offerCb = null;
    $('cards').classList.remove('done');
    UI.hide('scr-levelup');
  }

  /**
   * @param onReplay  story only: (stage id) => play it right away (again, or the next one)
   */
  function showOver(r, onBack, onReplay = null) {
    const sr = r.story;
    $('over-title').textContent = sr && sr.won ? 'Gym cleared!' : r.dead ? 'You fell…' : 'Run over';
    $('over-stats').innerHTML = `
      ${sr ? storyResult(sr) : ''}
      <div><span>Time</span><b>${U.mmss(r.time)}</b></div>
      <div><span>Level</span><b>${r.level}</b></div>
      <div><span>Defeated</span><b>${r.kills}</b></div>
      <div><span>Bosses</span><b>${r.bosses}</b></div>
      ${r.judge ? `<div style="grid-column:1/-1"><span>Against Arceus</span><b class="gold">${U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendary' : 'legendaries'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>PokéCoins earned</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${
        r.t1 || r.t10
          ? `<div style="grid-column:1/-1"><span>Gacha tickets</span><b>
        ${r.t1 ? Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>`
          : ''
      }
      <div style="grid-column:1/-1"><span>Moves</span><b style="font-size:15px">
        ${r.moves.map(m => `${Icons.html('move:' + m.id, 16)} ${m.name} Lv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${
        r.caught && r.caught.length
          ? `<div style="grid-column:1/-1" class="caught"><span>${Icons.html('shiny', 12)} Shinies caught</span>
        <div class="caught-row" id="over-caught"></div></div>`
          : ''
      }
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">New time record!</div>' : ''}
      ${sr && sr.best && !sr.first ? '<div style="grid-column:1/-1;text-align:center" class="gold">New best clear time!</div>' : ''}
      <div style="grid-column:1/-1"><span>Seed</span><b translate="no">${RNG.code()}</b></div>
      ${r.damage && r.damage.total ? `<details class="over-more" style="grid-column:1/-1"><summary>Damage</summary>${StatsUI.damageHtml(r.damage)}</details>` : ''}
      ${r.player ? `<details class="over-more" style="grid-column:1/-1"><summary>Stats</summary>${StatsUI.statsHtml(r.player)}</details>` : ''}`;
    $('btn-again').onclick = onBack;
    // Story: the next stage after a win (if there is one), otherwise the same one again.
    const rp = $('btn-replay');
    const next = sr && sr.won && sr.stage.next && Stages.unlocked(DB.save, sr.stage.next) ? sr.stage.next : null;
    rp.classList.toggle('hidden', !onReplay);
    $('btn-again').classList.toggle('gold', !onReplay);
    $('btn-again').classList.toggle('ghost', !!onReplay);
    if (onReplay) {
      rp.textContent = next ? 'Next: ' + Stages.BY_ID[next].name : 'Try again';
      rp.onclick = () => onReplay(next || sr.stage.id);
    }
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${DEX_BY[c.dex].name}${c.isNew ? ' · new!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    UI.show('scr-over');
  }

  /** The story banner on the summary: the badge won (and the reward), or how far you got. */
  function storyResult(sr) {
    const g = sr.stage.gym;
    const badge =
      Icons.html('badge:' + sr.stage.id, 48) +
      (Stages.leaderArt(sr.stage) ? `<img class="leader-art" src="${Stages.leaderArt(sr.stage)}" alt="" draggable="false">` : '');
    if (!sr.won)
      return `<div class="over-story lost" style="grid-column:1/-1">${badge}<div>
        <b><span>${g.name}</span> · <span>${g.leader}</span></b><div class="sub">Reached: ${sr.reached}</div></div></div>`;
    const rw = sr.reward;
    return `<div class="over-story" style="grid-column:1/-1">${badge}<div>
      <b class="gold">${sr.first ? g.badge + ' obtained!' : 'You beat ' + g.leader + ' again'}</b>
      <div class="sub"><span>${g.name}</span> · <span class="coin"></span> +${rw.coins} · ${Icons.html('ticket', 12)} +${rw.t1}</div></div></div>`;
  }

  /*
   * You found an item: keep the one you hold or switch; or, holding none, equip it or
   * go on without it. The first card is always the safe one (it is what Esc picks), and
   * for a moment after it opens nothing can be picked: the 1-4 keys also switch moves and
   * a key or tap that was already on its way would choose a card without reading it.
   */
  const ITEM_GRACE = 300; // ms
  let itemOpenAt = 0;
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    const nx = Items.BY[next];
    const cards = cur
      ? [
          { id: cur, nm: `Keep ${Items.BY[cur].name}`, ds: Items.BY[cur].desc, ico: Icons.html(cur, 36) },
          { id: next, nm: `Switch to ${nx.name}`, ds: nx.desc, ico: Icons.html(next, 36), gold: true }
        ]
      : [
          { id: null, nm: 'Stay without item', ds: 'Keep going without holding anything.', ico: Icons.html('ban', 36) },
          { id: next, nm: `Equip ${nx.name}`, ds: nx.desc, ico: Icons.html(next, 36), gold: true }
        ];
    cards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card' + (c.gold ? ' evo' : '');
      el.innerHTML = `<div class="ico">${c.ico}</div>
        <div class="txt"><div class="nm">${c.nm}</div><div class="ds">${c.ds}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => {
        if (performance.now() - itemOpenAt < ITEM_GRACE) return;
        UI.hide('scr-item');
        cb(c.id);
      };
      box.appendChild(el);
    });
    $('item-sub').textContent = cur ? 'You can only hold one' : nx.drawback ? 'It has a downside: equip it?' : 'Equip it now?';
    itemOpenAt = performance.now();
    UI.show('scr-item');
  }
  /** Keys 1/2 (i = 0/1) or Esc (the safe card). */
  function pickItem(i) {
    const el = document.querySelectorAll('#item-cards .card')[i];
    if (el) el.click();
  }

  // ---------------- bond: which moves get merged ----------------

  let bond = null; // { opt, cb, first, list }

  /**
   * @param opt  pl.bondOptions(): 'add' (one loose move into the group) or 'pair' (two loose ones, in two steps)
   * @param cb   receives the list of moves being bonded
   */
  function showBond(opt, cb) {
    bond = { opt, cb, first: null, list: [] };
    $('bond-back').onclick = bondBack;
    renderBond();
    UI.show('scr-bond');
  }

  function renderBond() {
    const { opt, first } = bond;
    const names = ms => ms.map(m => m.name).join(' + ');
    const step2 = opt.mode === 'pair' && first;
    $('bond-sub').textContent =
      opt.mode === 'add'
        ? 'Choose which move joins ' + names(opt.group)
        : step2
          ? 'Which move do you bond ' + first.name + ' with?'
          : 'Choose the first move to bond';
    $('bond-back').classList.toggle('hidden', !step2);
    bond.list = step2 ? opt.loose.filter(m => m !== first) : opt.loose;
    const box = $('bond-cards');
    box.innerHTML = '';
    bond.list.forEach((m, i) => {
      const col = U.TYPE_COLOR[m.type];
      const desc =
        opt.mode === 'add'
          ? 'It will fire at the same time as ' + names(opt.group) + '.'
          : step2
            ? 'It will fire at the same time as ' + first.name + '. A slot is freed.'
            : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML = `<div class="ico" style="background:${col}33">${Icons.html('move:' + m.id, 32)}</div>
         <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">Lv.${m.lvl}</span></div><div class="ds">${desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickBond(i);
      box.appendChild(el);
    });
  }

  function pickBond(i) {
    if (!bond || !bond.list[i]) return;
    const m = bond.list[i];
    if (bond.opt.mode === 'pair' && !bond.first) {
      bond.first = m;
      Audio.sfx('select');
      renderBond();
      return;
    }
    const picked = bond.opt.mode === 'add' ? [m] : [bond.first, m];
    const cb = bond.cb;
    bond = null;
    UI.hide('scr-bond');
    cb(picked);
  }

  function bondBack() {
    if (!bond) return;
    bond.first = null;
    renderBond();
  }

  // Pause tabs: Run (the buttons) · Stats · Damage. The last one chosen stays for next time.
  let pauseTab = 'run';
  function pauseShowTab(t) {
    pauseTab = t;
    document.querySelectorAll('#pause-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    for (const k of ['run', 'stats', 'dmg']) $('pause-' + k).classList.toggle('hidden', k !== t);
    const p = Game.player;
    if (p && t === 'stats') $('pause-stats').innerHTML = StatsUI.statsHtml(p);
    if (p && t === 'dmg') $('pause-dmg').innerHTML = StatsUI.damageHtml(Recount.snapshot(Game.time));
  }

  function showPause(coop = false) {
    pauseShowTab(pauseTab);
    UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Leave the game' : 'Quit run';
    $('pause-seed').textContent = RNG.custom
      ? `Chosen seed ${RNG.code()}: this run doesn't count for the leaderboard`
      : `Seed ${RNG.code()}`;
    UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
    document.querySelectorAll('#pause-tabs .gen-tab').forEach(b => (b.onclick = () => pauseShowTab(b.dataset.t)));
  }

  return {
    showLevelUp,
    reroll,
    showItemChoice,
    pickItem,
    showBond,
    pickBond,
    bondBack,
    pick,
    setWaiting,
    closeLevelUp,
    showOver,
    wirePause,
    showPause
  };
})();
