/* ============ menu.js — main menu, collection and upgrades ============ */
import { U } from '../core/util.js';
import { I18n } from '../core/i18n.js';
import { DEX, DEX_BY } from '../data/pokedex.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Moves } from '../data/moves.js';
import { Megas } from '../data/megas.js';
import { startMoveOf } from '../data/starters.js';
import { Balance } from '../data/balance.js';
import { Upgrades } from '../data/upgrades.js';
import { Gacha } from '../systems/gacha.js';
import { Progress } from '../systems/progress.js';
import { Social } from '../net/social.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { GachaUI } from './gacha-ui.js';
import { FriendsUI, InvitePop, LobbyUI, NickUI } from './social-ui.js';
import { RankingUI } from './ranking-ui.js';
import { SearchSelect } from './search-select.js';
import { GoalsUI } from './goals-ui.js';
import { SettingsUI } from './settings-ui.js';
import { PlayUI } from './play-ui.js';
import { Flow } from '../game.js';

export const MenuUI = (() => {
  const $ = UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all',
    dexGen = 1, // 0 = all regions
    dexSel = null,
    dexQuery = '', // the collection search box (name, number or type)
    dexGenBefore = 0; // region shown before a search jumped to "All regions"

  function init() {
    $('dex-search').oninput = onDexSearch;
    const ICON = {
      play: 'ball',
      dex: 'book',
      upgrades: 'up',
      gacha: 'ball4',
      goals: 'medal3',
      friends: 'friends',
      rank: 'trophy',
      settings: 'gear'
    };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') {
          if (Social.room) LobbyUI.open();
          else PlayUI.open();
        } else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'gacha') GachaUI.open();
        else if (go === 'goals') GoalsUI.open();
        else if (go === 'friends') FriendsUI.open();
        else if (go === 'rank') RankingUI.open();
        else if (go === 'settings') SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = open;
    });
    Social.on(() => {
      if (UI.isOpen('scr-menu')) socialLine();
    });
    $('menu-gift').insertAdjacentHTML('afterbegin', `<span class="mi-ico">${Icons.html('ticket10', 26)}</span>`);
    $('menu-gift').onclick = claimGift;
    $('btn-logout').onclick = () => {
      if (DB.guest && !confirm("You're a guest: all your progress will be lost. Log out?")) return;
      Audio.music(null);
      DB.logout().then(() => Flow.toLogin());
    };
  }

  // ---------------- main menu ----------------

  function open() {
    const s = DB.save;
    const mon = DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && DB.ownsShiny(mon.dex);
    UI.chrome(true);
    UI.show('scr-menu');
    UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = UI.typeChips(mon.types) + ' ' + UI.stars(mon.rarity);
    // Normal / shiny toggle right here (on mobile it was hard to find in the detail panel).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = Icons.html('shiny', 12) + ' Shiny';
    $('menu-shiny-tip').innerHTML = shinyTip();
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        if (s.partnerShiny) shinyNotice();
        DB.commit();
        Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Best time <b style="color:#fff">${U.mmss(st.bestTime)}</b><br>` +
      `Best level <b style="color:#fff">${st.bestLevel}</b> · Defeated <b style="color:#fff">${st.totalKills.toLocaleString(I18n.locale)}</b>` +
      (DB.guest ? '<br><span style="color:#ffb0b8">Guest mode: not saved</span>' : '');

    socialLine();
    giftLine();
    // Mission rewards waiting to be claimed.
    Progress.checkAch();
    const pend = Progress.pending();
    $('menu-goals-sub').textContent = pend
      ? pend + (pend === 1 ? ' reward to claim' : ' rewards to claim')
      : 'Missions, achievements and profile';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // With a cloud account: online friends, invitations and (once) the nickname.
    if (DB.online && !Social.started) {
      Social.start().then(r => {
        if (r === 'need-nick' && !NickUI.skipped && UI.isOpen('scr-menu')) NickUI.open();
        socialLine();
      });
    }
    InvitePop.refresh();
  }

  // ---------------- welcome gift ----------------

  // For players coming from the original game's website: once per account (server/api.mjs, GIFTS).
  const GIFT = 'migrate';

  function giftLine() {
    $('menu-gift').classList.toggle('hidden', !DB.online || !!(DB.save.gifts || {})[GIFT]);
  }

  async function claimGift() {
    const b = $('menu-gift');
    if (b.disabled) return;
    b.disabled = true;
    const r = await DB.claimGift(GIFT);
    b.disabled = false;
    if (r.ok) {
      Audio.sfx('confirm');
      UI.toast('Welcome back! +300 tickets and +50,000 coins', 3500);
    } else UI.toast(r.claimed ? 'This account already claimed the welcome gift' : r.error, 3500);
    if (UI.isOpen('scr-menu')) giftLine();
  }

  /** Text under "Friends" and "Play": who is online, requests, room. */
  function socialLine() {
    const room = Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Back to your room (' + room.members.length + '/' + Social.MAX_PLAYERS + ')' : 'Endless · Story';
    const fr = Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' online');
    if (req) parts.push(req + (req === 1 ? ' request' : ' requests'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Play in a group, up to 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- collection ----------------

  function openDex() {
    UI.show('scr-dex', true);
    const s = DB.save;
    if (dexSel == null) {
      dexSel = s.partner;
      dexGen = DEX_BY[s.partner].gen;
    }
    const owned = Object.keys(s.owned).filter(d => DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${DEX.length}`;

    renderGens();

    const F = [
      ['all', 'All'],
      ['own', 'Owned'],
      ['miss', 'Missing'],
      ['shiny', 'Shiny'],
      ['mega', 'Mega'],
      ['5', 5],
      ['4', 4],
      ['3', 3],
      ['2', 2],
      ['1', 1]
    ];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML =
        k === 'shiny'
          ? Icons.html('shiny', 12) + ' Shiny'
          : k === 'mega'
            ? Icons.html('mega:6', 12) + ' Mega'
            : typeof label === 'number'
            ? Icons.rarity(label, 12) + ' ' + Gacha.RARITY_NAME[label]
            : label;
      c.onclick = () => {
        dexFilter = k;
        openDex();
      };
      fb.appendChild(c);
    }
    renderGrid();
    showDetail(dexSel);
  }

  /** Generation tabs ("All regions" first), with how many you own from each. */
  function renderGens() {
    const s = DB.save;
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    ['All regions', ...GEN_NAMES].forEach((name, g) => {
      const total = DEX.filter(p => !g || p.gen === g).length;
      const have = DEX.filter(p => (!g || p.gen === g) && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => {
        dexGen = g;
        dexGenBefore = 0;
        renderGens();
        renderGrid();
      };
      tabs.appendChild(b);
    });
  }

  /*
   * Collection search: by name, by number (25, #025) or by type (fire, fuego). Names
   * and types only find Pokémon you own: the rest are still a surprise. Typing jumps
   * to "All regions"; clearing it goes back to the region you were on.
   */
  let searchT = 0;
  function onDexSearch() {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      const q = $('dex-search').value.trim();
      if (!dexQuery && q && dexGen) {
        dexGenBefore = dexGen;
        dexGen = 0;
        renderGens();
      } else if (dexQuery && !q && dexGenBefore) {
        dexGen = dexGenBefore;
        dexGenBefore = 0;
        renderGens();
      }
      dexQuery = q;
      renderGrid();
    }, 100);
  }
  let TYPES = null; // [type, English, Spanish], folded (built on first use: the dictionary loads later)
  function dexMatch(p, own) {
    if (!dexQuery) return true;
    const n = dexQuery.replace(/^#/, '');
    if (/^\d+$/.test(n)) return p.dex === +n;
    if (!own) return false;
    const f = U.fold(dexQuery);
    if (!f) return true;
    if (U.fold(p.name).includes(f)) return true;
    TYPES = TYPES || Object.keys(U.TYPE_NAME).map(t => [t, U.fold(U.TYPE_NAME[t]), U.fold(I18n.t(U.TYPE_NAME[t]))]);
    return f.length >= 3 && TYPES.some(([t, en, es]) => (en.startsWith(f) || es.startsWith(f)) && p.types.includes(t));
  }

  function renderGrid() {
    const s = DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    for (const p of DEX) {
      if (dexGen && p.gen !== dexGen) continue;
      const own = !!s.owned[p.dex],
        sh = !!(s.shiny && s.shiny[p.dex]);
      if (!dexMatch(p, own)) continue;
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      if (dexFilter === 'mega' && !Megas.of(p.dex)) continue;
      if (/^\d$/.test(dexFilter) && p.rarity !== +dexFilter) continue;

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (p.dex === s.partner)
        cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Partner">${Icons.html('crown', 14)}</span>`);
      else if (sh)
        cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="You own its shiny">${Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">None with this filter.</p>';
  }

  // Variant shown in the detail panel (normal or shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = DB.save;
    const p = DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spd: 137 };
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, (v / m) * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${
        hasSh
          ? `<div class="shiny-pick"><div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${Icons.html('shiny', 12)} Shiny</button></div>
          <div class="tip-box">${shinyTip()}</div></div>`
          : ''
      }
      <div class="center">
        <div style="color:var(--muted);font-size:13px">No. ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${Gacha.RARITY_COLOR[p.rarity]}">${UI.stars(p.rarity, 24)} ${Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? UI.typeChips(p.types) : ''}</div>
      </div>
      ${
        own
          ? `
        ${bar('HP', p.hp, max.hp, p.hp)}
        ${bar('Attack', p.atk, max.atk, '×' + p.atk.toFixed(2))}
        ${bar('Speed', p.spd, max.spd, p.spd)}
        ${
          viewShiny
            ? `<p style="font-size:13px;margin:8px 0 0;color:#9ae6ff">${Icons.html('shiny', 12)} Shiny bonus: wild shinies are ×${Balance.spawn.shinyCharm} more common, and once per run a knockout leaves you at 1 HP.</p>`
            : ''
        }
        <p style="font-size:14px;margin:10px 0 4px">Starts with <b class="gold">${Moves.BY_ID[startMoveOf(dex)].name}</b></p>
        <p class="move-icons" title="Moves it can learn">
          ${Moves.poolFor(p)
            .map(id => `<span title="${Moves.BY_ID[id].name}">${Icons.html('move:' + id, 16)}</span>`)
            .join('')}</p>
        ${
          usingThis
            ? '<button class="btn grow" disabled style="width:100%">It\'s your partner</button>'
            : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Choose as partner${viewShiny ? ' (shiny)' : ''}</button>`
        }
      `
          : `<p class="center" style="color:var(--muted)">You don't have it yet.<br>Get it from the banner of <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            or by defeating it when it shows up shiny.</p>`
      }
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => {
        viewShiny = b.dataset.v === '1';
        if (viewShiny) shinyNotice();
        showDetail(dex);
      };
    });
    const pick = $('dex-pick');
    if (pick)
      pick.onclick = () => {
        s.partner = dex;
        s.partnerShiny = hasSh && viewShiny;
        DB.commit();
        UI.toast((s.partnerShiny ? 'Shiny ' : '') + p.name + ' is now your partner');
        renderGrid();
        showDetail(dex);
      };
  }

  // ---------------- shiny bonuses ----------------

  /** What a shiny partner gives (hover box over the Normal / Shiny toggles). */
  function shinyTip() {
    return `<b>${Icons.html('shiny', 12)} Shiny bonuses</b>
      <small><b>Shiny Charm:</b> <span>wild shinies (and shiny rift legendaries) are ×${Balance.spawn.shinyCharm} more common. In co-op, the whole team gets it.</span></small>
      <small><b>Shiny Sash:</b> <span>once per run, a knockout leaves you at 1 HP and pushes nearby enemies back.</span></small>`;
  }
  /** On touch there is no hover: the bonus comes as a notice when you pick the shiny. */
  function shinyNotice() {
    if (matchMedia('(hover: none)').matches)
      UI.toast(`Shiny bonus: wild shinies are ×${Balance.spawn.shinyCharm} more common, and once per run a knockout leaves you at 1 HP.`);
  }

  // ---------------- upgrades ----------------

  let upgDex = null;

  function openUpgrades() {
    UI.show('scr-upgrades', true);
    const s = DB.save;
    if (!upgDex || !s.owned[upgDex]) upgDex = s.partner;
    // Picker with your Pokémon: the partner first, then the ones that already have upgrades.
    const sel = $('upg-mon');
    const mons = Object.keys(s.owned)
      .map(Number)
      .filter(d => DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || upgLevels(b) - upgLevels(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${upgLabel(d)}</option>`).join('');
    sel.value = upgDex;
    sel.onchange = () => {
      upgDex = +sel.value;
      Audio.sfx('select');
      renderUpgrades();
    };
    renderUpgrades();
  }

  const upgLevels = d => Object.values((DB.save.pupg || {})[d] || {}).reduce((a, b) => a + b, 0);
  /** The picker's text for a Pokémon: name, partner, levels bought. */
  function upgLabel(d) {
    const n = upgLevels(d);
    return `${DEX_BY[d].name}${d === DB.save.partner ? ' (partner)' : ''}${n ? ' · ' + n + ' levels' : ''}`;
  }

  function renderUpgrades() {
    const s = DB.save;
    const levels = DB.upgradesOf(upgDex);
    const mon = DEX_BY[upgDex];
    // The picker's level count, kept up to date after each purchase.
    const sel = $('upg-mon'),
      opt = sel.querySelector(`option[value="${upgDex}"]`);
    if (opt) opt.textContent = upgLabel(upgDex);
    SearchSelect.enhance(sel, { placeholder: 'Search Pokémon' });
    const shiny = upgDex === s.partner && !!s.partnerShiny && DB.ownsShiny(upgDex);
    UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
    $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : U.TYPE_COLOR[mon.types[0]]);
    allButton(mon);
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of Upgrades.LIST) {
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : Upgrades.cost(u.id, lvl);
      const el = document.createElement('div');
      el.className = 'panel upg-item' + (u.id === 'ban' ? ' full' : '');
      el.innerHTML = `
        <div class="ic">${Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Choose (${banList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Max.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0)
        el.querySelector('[data-ban]').onclick = () => {
          banOpen = !banOpen;
          renderUpgrades();
        };
      el.querySelector('[data-buy]').onclick = () => {
        // Re-read everything on click (the save may have changed since it was drawn).
        const sv = DB.save,
          lv = DB.upgradesOf(upgDex),
          now = lv[u.id] || 0;
        if (now >= u.max) {
          renderUpgrades();
          return;
        }
        const price = Upgrades.cost(u.id, now);
        if (sv.coins < price) {
          renderUpgrades();
          return;
        }
        sv.coins -= price;
        lv[u.id] = now + 1;
        DB.commit(true);
        Audio.sfx('buy');
        UI.refreshCoins();
        UI.toast(`${mon.name} · ${u.name}: level ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
    }
    box.appendChild(bindPanel());
  }

  /**
   * What "Upgrade all" buys with `coins`: the cheapest next level each time, while
   * it can be paid. { buys: { id: levels }, n, cost, total (cost of maxing everything), left }
   */
  function allPlan(levels, coins) {
    const lv = {},
      buys = {};
    let n = 0,
      cost = 0,
      total = 0,
      left = 0;
    for (const u of Upgrades.LIST) {
      lv[u.id] = levels[u.id] || 0;
      for (let l = lv[u.id]; l < u.max; l++) {
        total += Upgrades.cost(u.id, l);
        left++;
      }
    }
    for (;;) {
      let best = null,
        price = Infinity;
      for (const u of Upgrades.LIST) {
        if (lv[u.id] >= u.max) continue;
        const c = Upgrades.cost(u.id, lv[u.id]);
        if (c < price) (best = u), (price = c);
      }
      if (!best || cost + price > coins) break;
      cost += price;
      lv[best.id]++;
      buys[best.id] = (buys[best.id] || 0) + 1;
      n++;
    }
    return { buys, n, cost, total, left };
  }

  // Buys every level it can for this Pokémon at once. Shows what it will cost:
  // everything if the coins are enough, otherwise the levels that can be paid.
  function allButton(mon) {
    const btn = $('upg-all');
    const p = allPlan(DB.upgradesOf(upgDex), DB.save.coins);
    btn.classList.toggle('hidden', !p.left);
    if (!p.left) return;
    const full = p.n === p.left;
    btn.disabled = !p.n;
    btn.innerHTML = `<span>${full || !p.n ? 'Upgrade all' : `Upgrade ${p.n} levels`}</span> · <span class="coin"></span> ${p.n ? p.cost : p.total}`;
    btn.onclick = () => {
      // Re-planned on click (the save may have changed since it was drawn).
      const sv = DB.save,
        lv = DB.upgradesOf(upgDex),
        plan = allPlan(lv, sv.coins);
      if (!plan.n) {
        renderUpgrades();
        return;
      }
      sv.coins -= plan.cost;
      for (const id in plan.buys) lv[id] = (lv[id] || 0) + plan.buys[id];
      DB.commit(true);
      Audio.sfx('buy');
      UI.refreshCoins();
      UI.toast(`${mon.name}: ${plan.n} levels bought`);
      renderUpgrades();
    };
  }

  // ---------------- shortcuts: a fixed slot for each move ----------------
  // save.pbind[dex] = [move in slot 1, slot 2, slot 3, slot 4] (or null).
  function bindPanel() {
    const s = DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = DEX_BY[upgDex];
    const ids = Moves.poolFor(mon)
      .concat([startMoveOf(upgDex)])
      .filter((v, i, a) => a.indexOf(v) === i)
      // In the player's language order (the names are translated on screen).
      .sort((a, b) => I18n.t(Moves.BY_ID[a].name).localeCompare(I18n.t(Moves.BY_ID[b].name), I18n.locale));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Move shortcuts</b>
      <p class="sub" style="margin:2px 0 8px">Choose which move always goes in each slot (keys 1-4 or the icons at the bottom), for muscle memory. If you do not have that many moves yet, it goes to the closest slot.</p>
      <div class="bind-slots">${[0, 1, 2, 3]
        .map(
          i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Free</option>${ids
          .map(id => `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${Moves.BY_ID[id].name}</option>`)
          .join('')}</select></label>`
        )
        .join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      SearchSelect.enhance(sel, { placeholder: 'Search moves' });
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot,
          id = sel.value || null;
        // A move can only be in one slot.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        DB.commit();
        Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: banned moves ----------------
  // Per-Pokémon list in save.pban[dex]; N levels of Veto allow N moves.
  let banOpen = false;
  function banList() {
    const s = DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = DEX_BY[upgDex];
    const start = startMoveOf(upgDex);
    const ids = Moves.poolFor(mon)
      .filter(id => id !== start)
      // In the player's language order (the names are translated on screen).
      .sort((a, b) => I18n.t(Moves.BY_ID[a].name).localeCompare(I18n.t(Moves.BY_ID[b].name), I18n.locale));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Tap the moves you do not want in your cards (${list.length}/${max}). The starting move cannot be banned.</p>
      <div class="ban-moves">${ids
        .map(id => {
          const d = Moves.BY_ID[id];
          const on = list.includes(id);
          return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + Icons.html('ban', 14) : ''}</button>`;
        })
        .join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(),
          id = b.dataset.id,
          i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) {
          UI.toast('You already have ' + max + ' banned: remove one first');
          return;
        } else l.push(id);
        DB.commit();
        Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, GEN_NAMES };
})();
