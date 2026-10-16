/* ============ social-ui.js — nickname, friends, room and invites ============ */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Can online features be used? If not, explains why. */
  function needOnline() {
    if (G.DB.online) return true;
    G.UI.toast(
      G.DB.guest
        ? 'Create an account to play with friends and appear on the leaderboard.'
        : 'This needs the online version of the game (with the cloud).',
      3200
    );
    return false;
  }

  // ======================= NICKNAME =======================

  G.NickUI = (() => {
    let then = null,
      skipped = false;

    function init() {
      $('nick-form').onsubmit = async e => {
        e.preventDefault();
        $('nick-err').textContent = '';
        $('nick-ok').disabled = true;
        const r = await G.Social.claimNick($('nick-in').value);
        $('nick-ok').disabled = false;
        if (!r.ok) {
          $('nick-err').textContent = r.error;
          G.Audio.sfx('error');
          return;
        }
        G.Audio.sfx('confirm');
        G.UI.toast('Your nickname is ' + G.Social.me.name);
        const cb = then;
        then = null;
        if (cb) cb();
        else G.MenuUI.open();
      };
      $('nick-later').onclick = () => {
        skipped = true;
        then = null;
        G.MenuUI.open();
      };
    }

    /** @param next  what to open after choosing it */
    function open(next) {
      then = next || null;
      G.UI.show('scr-nick');
      $('nick-err').textContent = '';
      $('nick-in').value = '';
      setTimeout(() => $('nick-in').focus(), 50);
    }

    return {
      init,
      open,
      get skipped() {
        return skipped;
      }
    };
  })();

  /** Opens `fn` if you have a nickname; otherwise asks for one first. */
  function withNick(fn) {
    if (!needOnline()) return;
    if (G.Social.me) {
      fn();
      return;
    }
    G.Social.start().then(r => {
      if (r === 'ok') fn();
      else G.NickUI.open(fn);
    });
  }

  // ======================= FRIENDS =======================

  G.FriendsUI = (() => {
    function init() {
      $('fr-add').onsubmit = async e => {
        e.preventDefault();
        const name = $('fr-name').value;
        msg('');
        const r = await G.Social.request(name);
        msg(r.ok ? r.msg : r.error, !r.ok);
        if (r.ok) $('fr-name').value = '';
      };
      $('fr-room').onclick = () => G.LobbyUI.open();
      G.Social.on(() => {
        if (G.UI.isOpen('scr-friends')) render();
      });
    }

    function msg(t, bad) {
      $('fr-msg').textContent = t || '';
      $('fr-msg').style.color = bad ? '#ffb0b8' : '';
      if (t) G.Audio.sfx(bad ? 'error' : 'confirm');
    }

    function open() {
      withNick(() => {
        G.UI.show('scr-friends', true);
        msg('');
        render();
        G.Social.refreshPresence();
      });
    }

    /** "5 min ago", "2 h ago", "3 days ago". */
    function ago(t) {
      const m = Math.max(1, Math.round((G.Social.now() - t) / 60000));
      if (m < 60) return m + ' min ago';
      const h = Math.round(m / 60);
      if (h < 48) return h + ' h ago';
      return Math.round(h / 24) + ' days ago';
    }

    function stateText(f) {
      if (f.status === 'in') return 'Wants to be your friend';
      if (f.status === 'out') return 'Request sent';
      if (!f.online) return f.seen ? 'Seen ' + ago(f.seen) : 'Offline';
      return f.play ? 'Playing' : 'Online';
    }

    function render() {
      const room = G.Social.room;
      $('fr-me').innerHTML =
        'Your nickname: <b class="gold" translate="no">' +
        esc(G.Social.me ? G.Social.me.name : '') +
        '</b> · give it to your friends so they can add you.';
      $('fr-room').classList.toggle('hidden', !room);
      const list = G.Social.friends.sort((a, b) => {
        const rank = f => (f.status === 'in' ? 0 : f.status === 'ok' ? (f.online ? (f.play ? 2 : 1) : 3) : 4);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
      const box = $('fr-list');
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<p class="sub">You haven\'t added any friends yet. Type a friend\'s nickname above.</p>';
        return;
      }
      for (const f of list) {
        const el = document.createElement('div');
        el.className = 'fr-row';
        const dot = f.status !== 'ok' ? 'pend' : !f.online ? 'off' : f.play ? 'play' : 'on';
        const inRoom = room && room.members.some(m => m.uid === f.uid);
        el.innerHTML = `<i class="dot ${dot}"></i><b translate="no"><a href="#" class="plink" title="View their profile">${esc(f.name)}</a></b><span class="st">${inRoom ? 'In your room' : stateText(f)}</span><span class="grow"></span>`;
        if (f.status === 'ok')
          el.querySelector('.plink').onclick = e => {
            e.preventDefault();
            G.ProfileUI.show(f.uid);
          };
        else el.querySelector('.plink').onclick = e => e.preventDefault();
        const btn = (txt, cls, fn) => {
          const b = document.createElement('button');
          b.className = 'btn small ' + cls;
          b.textContent = txt;
          b.onclick = fn;
          el.appendChild(b);
          return b;
        };
        if (f.status === 'in') {
          btn('Accept', 'gold', async () => {
            const r = await G.Social.accept(f.uid);
            msg(r.ok ? r.msg : r.error, !r.ok);
          });
          btn('Decline', 'ghost', () => G.Social.remove(f.uid));
        } else if (f.status === 'out') {
          btn('Cancel', 'ghost', () => G.Social.remove(f.uid));
        } else {
          if (f.online && !f.play && !inRoom && (!room || room.isHost)) {
            btn('Invite', 'gold', async () => {
              const r = await G.Social.invite(f.uid);
              msg(r.ok ? r.msg : r.error, !r.ok);
              if (r.ok) G.LobbyUI.open();
            });
          }
          btn('Remove', 'ghost', () => {
            if (confirm('Remove ' + f.name + ' from your friends?')) G.Social.remove(f.uid);
          });
        }
        box.appendChild(el);
      }
    }

    return { init, open, render };
  })();

  // ======================= ROOM =======================

  G.LobbyUI = (() => {
    let membersKey = '';

    function init() {
      $('lobby-leave').onclick = async () => {
        await G.Social.leaveRoom();
        G.Net.close();
        G.MenuUI.open();
      };
      $('lobby-menu').onclick = () => G.MenuUI.open();
      $('lobby-start').onclick = start;
      $('lobby-start').dataset.sfx = 'confirm';
      // Connects / disconnects the network when joining or leaving a room.
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) {
          G.Net.open(room.id, room.isHost, room.host);
          G.Net.syncMembers(room.members.map(m => m.uid));
        } else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') {
          G.UI.toast('The room has been closed', 2600);
          if (G.UI.isOpen('scr-lobby')) G.MenuUI.open();
        }
        if (G.UI.isOpen('scr-lobby')) render();
      });
      G.Net.onPeer(() => {
        if (G.UI.isOpen('scr-lobby')) render();
      });
    }

    function open() {
      if (!G.Social.room) {
        G.MenuUI.open();
        return;
      }
      G.Social.refreshMember();
      G.Social.refreshPresence();
      G.UI.show('scr-lobby', true);
      membersKey = '';
      render();
    }

    function close() {
      G.UI.hide('scr-lobby');
    }

    function connText(m, room) {
      if (m.uid === room.host) return 'Host';
      if (!room.isHost) return m.uid === G.Social.uid ? 'You' : 'In the room';
      const mode = G.Net.mode(m.uid);
      return mode === 'direct'
        ? 'Connected'
        : mode === 'relay'
          ? 'Connected (via server)'
          : mode === 'failed'
            ? 'Could not connect (retrying…)'
            : 'Connecting…';
    }

    function render() {
      const room = G.Social.room;
      if (!room) return;
      const ms = room.members;
      $('lobby-sub').textContent = room.isHost
        ? "You're the host. Invite your friends (up to " + G.Social.MAX_PLAYERS + ") and start when you're ready."
        : "You're in " + ((ms.find(m => m.uid === room.host) || {}).name || '…') + "'s room. The host will start the game.";

      // Cards are only rebuilt when the members change (so the sprites don't flicker).
      const key = ms.map(m => m.uid + ':' + m.dex + ':' + (m.shiny ? 1 : 0)).join('|');
      const box = $('lobby-members');
      if (key !== membersKey) {
        membersKey = key;
        box.innerHTML = '';
        for (let i = 0; i < G.Social.MAX_PLAYERS; i++) {
          const m = ms[i];
          const c = document.createElement('div');
          c.className = 'lob-card' + (m ? '' : ' empty');
          if (m) {
            c.style.setProperty('--pc', G.Coop.COLORS[i]);
            c.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
            c.insertAdjacentHTML(
              'beforeend',
              `<b translate="no">${esc(m.name)}</b><small>${esc((G.DEX_BY[m.dex] || {}).name || '')}</small><span class="conn" data-u="${m.uid}"></span>`
            );
          } else c.innerHTML = '<span>Free</span>';
          box.appendChild(c);
        }
      }
      box.querySelectorAll('.conn').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m) return;
        const t = connText(m, room);
        el.textContent = t;
        el.className = 'conn' + (t === 'Connecting…' ? ' wait' : '');
      });

      // Invite (host only, and only if there is room).
      const canInvite = room.isHost && ms.length < G.Social.MAX_PLAYERS;
      $('lobby-inv-title').classList.toggle('hidden', !canInvite);
      const inv = $('lobby-invite');
      inv.classList.toggle('hidden', !canInvite);
      if (canInvite) {
        inv.innerHTML = '';
        const free = G.Social.friends.filter(f => f.status === 'ok' && f.online && !ms.some(m => m.uid === f.uid));
        if (!free.length) inv.innerHTML = '<p class="sub" style="margin:0">No friends online right now.</p>';
        for (const f of free) {
          const el = document.createElement('div');
          el.className = 'fr-row';
          el.innerHTML = `<i class="dot ${f.play ? 'play' : 'on'}"></i><b translate="no">${esc(f.name)}</b><span class="st">${f.play ? 'Playing' : 'Online'}</span><span class="grow"></span>`;
          const b = document.createElement('button');
          b.className = 'btn small gold';
          b.textContent = 'Invite';
          b.onclick = async () => {
            const r = await G.Social.invite(f.uid);
            G.UI.toast(r.ok ? r.msg : r.error);
          };
          el.appendChild(b);
          inv.appendChild(el);
        }
      }

      const btn = $('lobby-start');
      btn.classList.toggle('hidden', !room.isHost);
      const connecting = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'connecting');
      const failed = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'failed');
      btn.disabled = !room.isHost || ms.length < 2 || connecting || failed;
      btn.textContent = 'Start game (' + ms.length + '/' + G.Social.MAX_PLAYERS + ')';
      $('lobby-note').textContent = !room.isHost
        ? "When the host starts, you'll all join at the same time."
        : ms.length < 2
          ? 'You need at least one friend in the room.'
          : failed
            ? "Can't connect to one of your friends: their network (or yours) doesn't allow group play. Try another Wi-Fi or mobile data; it retries automatically."
            : connecting
              ? 'Connecting to your friends…'
              : 'The game starts for everyone at once.';
    }

    function start() {
      const room = G.Social.room;
      if (!room || !room.isHost || room.members.length < 2) return;
      const cfg = {
        k: 'start',
        seed: G.RNG.randomSeed(),
        host: room.host,
        members: room.members.map(m => ({ uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny }))
      };
      G.Social.setOpen(false);
      G.Net.broadcast(cfg);
      G.Flow.startCoop(cfg);
    }

    return { init, open, close, render };
  })();

  // ======================= INVITES =======================

  G.InvitePop = (() => {
    let cur = null;

    function init() {
      $('inv-yes').onclick = async () => {
        if (!cur) return;
        const from = cur.from;
        hide();
        const r = await G.Social.acceptInvite(from);
        if (!r.ok) {
          G.UI.toast(r.error, 3000);
          return;
        }
        G.LobbyUI.open();
      };
      $('inv-no').onclick = () => {
        if (cur) G.Social.declineInvite(cur.from);
        hide();
      };
      G.Social.on(what => {
        if (what === 'invites' || what === 'room') refresh();
      });
    }

    function hide() {
      cur = null;
      $('invite-pop').classList.add('hidden');
    }

    /** Shows the oldest invite if you are in the menus (not mid-game). */
    function refresh() {
      const room = G.Social.room;
      const list = G.Social.invites.filter(i => !room || i.room !== room.id).sort((a, b) => a.at - b.at);
      if (!list.length || G.Game.state !== 'ui' || !G.DB.loggedIn) {
        hide();
        return;
      }
      if (cur && cur.from === list[0].from) return;
      cur = list[0];
      $('inv-text').innerHTML =
        `${G.Icons.html('friends', 22)} <b class="gold" translate="no">${esc(cur.name)}</b> invites you to play in their room`;
      $('invite-pop').classList.remove('hidden');
      G.Audio.sfx('shiny');
    }

    return { init, refresh };
  })();

  G.SocialUI = {
    init() {
      G.NickUI.init();
      G.FriendsUI.init();
      G.LobbyUI.init();
      G.InvitePop.init();
    },
    withNick,
    needOnline
  };
})();
