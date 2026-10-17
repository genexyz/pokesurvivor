/* ============ play-ui.js — the Play screen: one tab per game mode ============
 *
 *   Endless   the classic run (also the only co-op mode)
 *   Story     regions (Kanto first) with their gym stages, played in order
 *
 * A new game mode is a new entry in MODES (id, tab name, icon and what its tab shows).
 * The last tab you opened is remembered on this device.
 */
import { U } from '../core/util.js';
import { Balance } from '../data/balance.js';
import { DEX_BY } from '../data/pokedex.js';
import { Stages } from '../data/stages.js';
import { DB } from '../core/db.js';
import { Audio } from '../core/audio.js';
import { Social } from '../net/social.js';
import { Icons } from './icons.js';
import { UI } from './ui.js';
import { LobbyUI } from './social-ui.js';
import { Flow } from '../game.js';

export const PlayUI = (() => {
  const $ = UI.$;
  const KEY = 'ps.playTab';
  const MODES = [
    { id: 'endless', name: 'Endless', icon: 'ball', render: endless },
    { id: 'story', name: 'Story', icon: 'medal3', render: story }
  ];
  let tab = 'endless',
    region = 'kanto';
  try {
    const t = localStorage.getItem(KEY);
    if (MODES.some(m => m.id === t)) tab = t;
  } catch (e) {
    /* private window: always starts on Endless */
  }

  function init() {
    $('play-tabs').innerHTML = MODES.map(
      m => `<div class="tab" data-tab="${m.id}">${Icons.html(m.icon, 24)} <span>${m.name}</span></div>`
    ).join('');
    $('play-tabs')
      .querySelectorAll('.tab')
      .forEach(el => {
        el.onclick = () => {
          if (tab === el.dataset.tab) return;
          tab = el.dataset.tab;
          try {
            localStorage.setItem(KEY, tab);
          } catch (e) {
            /* not remembered */
          }
          Audio.sfx('select');
          render();
        };
      });
  }

  function open() {
    UI.show('scr-play', true);
    render();
  }

  function render() {
    $('play-tabs')
      .querySelectorAll('.tab')
      .forEach(el => el.classList.toggle('on', el.dataset.tab === tab));
    const body = $('play-body');
    body.innerHTML = '';
    MODES.find(m => m.id === tab).render(body);
  }

  // ---------------- Endless ----------------

  function endless(body) {
    const st = DB.save.stats;
    const room = Social.room;
    body.innerHTML = `
      <div class="panel play-hero">
        <div class="play-ico">${Icons.html('ball', 48)}</div>
        <div>
          <b class="gold">Endless</b>
          <p>Survive as long as you can. Wild Pokémon from every region, bosses, rifts with legendaries and, at minute 30, Arceus's Judgment.</p>
          <p class="sub">Runs <b>${st.runs}</b> · Best time <b>${U.mmss(st.bestTime)}</b> · Best level <b>${st.bestLevel}</b></p>
        </div>
      </div>
      <div class="row play-go">
        <button class="btn gold" id="play-endless" data-sfx="confirm">${room ? 'Back to your room' : 'Start run'}</button>
        <span class="sub">${room ? 'Your group plays Endless together' : 'Counts for the leaderboard · Play with friends from Friends'}</span>
      </div>`;
    $('play-endless').onclick = () => {
      if (Social.room) LobbyUI.open();
      else Flow.play();
    };
  }

  // ---------------- Story ----------------

  function story(body) {
    const s = DB.save;
    const tabs = document.createElement('div');
    tabs.className = 'gen-tabs';
    for (const r of Stages.REGIONS) {
      const b = document.createElement('button');
      b.className = 'gen-tab' + (r.id === region ? ' on' : '') + (r.stages.length ? '' : ' soon');
      b.innerHTML = `<b>${r.name}</b><small>${r.stages.length ? Stages.badges(s, r.id) + '/' + r.stages.length : 'Soon'}</small>`;
      b.onclick = () => {
        if (region === r.id) return;
        region = r.id;
        Audio.sfx('select');
        render();
      };
      tabs.appendChild(b);
    }
    body.appendChild(tabs);

    const reg = Stages.REGIONS.find(r => r.id === region);
    if (!reg.stages.length) {
      body.insertAdjacentHTML(
        'beforeend',
        `<div class="panel play-soon"><b>${reg.name}</b><p>Coming soon: this region's gyms are on their way.</p></div>`
      );
      return;
    }

    const got = Stages.badges(s, reg.id);
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="badge-case">
        <div class="badge-row">${reg.stages
          .map(
            st => `<span class="${Stages.cleared(s, st.id) ? 'on' : ''}" title="${st.gym.badge}">${Icons.html('badge:' + st.id, 24)}</span>`
          )
          .join('')}</div>
        <span class="sub"><b class="gold">${got} / ${reg.stages.length}</b> badges · solo · not ranked</span>
      </div>
      ${Social.room ? '<p class="play-note">Story mode is solo for now: leave your room to play it.</p>' : ''}`
    );

    const list = document.createElement('div');
    list.className = 'stage-list';
    for (const st of reg.stages) list.appendChild(stageCard(st));
    body.appendChild(list);
  }

  function stageCard(st) {
    const s = DB.save;
    const rec = Stages.record(s, st.id);
    const open = Stages.unlocked(s, st.id);
    const g = st.gym;
    const ace = Stages.ace(st);
    const rw = Balance.story.reward(st.pace, !rec);
    const prev = st.prev && Stages.BY_ID[st.prev];
    const el = document.createElement('div');
    el.className = 'panel stage-card' + (rec ? ' cleared' : '') + (open ? '' : ' locked');
    el.innerHTML = `
      <div class="stage-badge">${Icons.html('badge:' + st.id, 36)}</div>
      <div class="stage-info">
        <div class="stage-head"><small>Stage ${st.n}</small> <b>${st.name}</b>
          ${rec ? `<span class="pill-done">Cleared ×${rec.clears}</span>` : ''}</div>
        <div class="stage-route">${st.legs.map(l => l.name).join(' · ')} → <b>${g.name}</b></div>
        <div class="stage-rwd">${
          !open
            ? `Beat ${prev.gym.leader} first`
            : rec
              ? `Best ${U.mmss(rec.best)} · Again: <span class="coin"></span> ${rw.coins} · ${Icons.html('ticket', 12)} ${rw.t1}`
              : `First clear: ${g.badge} · <span class="coin"></span> ${rw.coins} · ${Icons.html('ticket', 12)} ${rw.t1}`
        }</div>
      </div>
      <div class="stage-leader">
        <div class="stage-duo"><img class="leader-art" src="${Stages.leaderArt(st)}" alt="" draggable="false"></div>
        <small>Leader</small><b>${g.leader}</b>
      </div>
      <button class="btn ${open ? 'gold' : ''}" data-sfx="confirm" ${open && !Social.room ? '' : 'disabled'}>${open ? 'Play' : 'Locked'}</button>`;
    // The leader and their ace (both silhouettes until the stage opens).
    const cv = UI.spriteCanvas(ace, 84, 70, { scale: 2, lively: open, silhouette: !open, shadow: open });
    cv.className = 'stage-ace';
    cv.title = DEX_BY[ace].name;
    el.querySelector('.stage-duo').appendChild(cv);
    el.querySelector('button').onclick = () => {
      if (!Stages.unlocked(DB.save, st.id) || Social.room) return;
      Flow.play(st.id);
    };
    return el;
  }

  return { init, open, MODES };
})();
