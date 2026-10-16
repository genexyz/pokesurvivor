/* ============ run-ui.js — level-up cards, pause and end of run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
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
    G.UI.show('scr-levelup');
  }

  /**
   * Reroll the cards: 1 free per game and 1 more per boss defeated
   * (in a group the team's bosses count; each player has their own).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 free + the ones bought in Upgrades (previously, 1 more per boss).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
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
      el.innerHTML = `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div></div>
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
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Co-op: who still has to choose. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const and = G.I18n.lang === 'es' ? ' y ' : ' and ';
    const list = a => (a.length > 1 ? a.slice(0, -1).join(', ') + and + a[a.length - 1] : a[0]);
    $('lvl-wait').textContent = !names.length
      ? ''
      : !others.length
        ? 'Choose your card'
        : names.includes(me)
          ? 'Still choosing: ' + list([...others, G.I18n.t('you')])
          : 'Waiting for ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null;
    offerCb = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  function showOver(r, onBack) {
    $('over-title').textContent = r.dead ? 'You fell…' : 'Run over';
    $('over-stats').innerHTML = `
      <div><span>Time</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Level</span><b>${r.level}</b></div>
      <div><span>Defeated</span><b>${r.kills}</b></div>
      <div><span>Bosses</span><b>${r.bosses}</b></div>
      ${r.judge ? `<div style="grid-column:1/-1"><span>Against Arceus</span><b class="gold">${G.U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendary' : 'legendaries'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>PokéCoins earned</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${
        r.t1 || r.t10
          ? `<div style="grid-column:1/-1"><span>Gacha tickets</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>`
          : ''
      }
      <div style="grid-column:1/-1"><span>Moves</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${m.name} Lv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${
        r.caught && r.caught.length
          ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies caught</span>
        <div class="caught-row" id="over-caught"></div></div>`
          : ''
      }
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">New time record!</div>' : ''}`;
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · new!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** You found an item while already holding one: which one do you keep? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    [
      [cur, 'Keep'],
      [next, 'Switch to']
    ].forEach(([id, verb], i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card' + (i === 1 ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => {
        G.UI.hide('scr-item');
        cb(id);
      };
      box.appendChild(el);
    });
    G.UI.show('scr-item');
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
    G.UI.show('scr-bond');
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
      const col = G.U.TYPE_COLOR[m.type];
      const desc =
        opt.mode === 'add'
          ? 'It will fire at the same time as ' + names(opt.group) + '.'
          : step2
            ? 'It will fire at the same time as ' + first.name + '. A slot is freed.'
            : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML = `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + m.id, 32)}</div>
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
      G.Audio.sfx('select');
      renderBond();
      return;
    }
    const picked = bond.opt.mode === 'add' ? [m] : [bond.first, m];
    const cb = bond.cb;
    bond = null;
    G.UI.hide('scr-bond');
    cb(picked);
  }

  function bondBack() {
    if (!bond) return;
    bond.first = null;
    renderBond();
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Leave the game' : 'Quit run';
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  return {
    showLevelUp,
    reroll,
    showItemChoice,
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
