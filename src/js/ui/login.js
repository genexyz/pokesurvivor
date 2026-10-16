/* ============ login.js — start: sign in with Google, or play without an account ============ */
G.LoginUI = (() => {
  const $ = G.UI.$;

  function init() {
    $('btn-guest').onclick = () => {
      G.DB.playAsGuest();
      G.Flow.afterLogin();
    };
    $('btn-local').onclick = () => {
      G.DB.playLocal();
      G.Flow.afterLogin();
    };
    // The page goes to Google and comes back signed in (G.DB.ready()).
    $('btn-google').onclick = async () => {
      $('login-err').textContent = '';
      $('btn-google').disabled = true;
      const r = await G.DB.loginWithGoogle();
      $('btn-google').disabled = false;
      if (!r.ok) $('login-err').textContent = r.error;
    };
  }

  /** Explains where the game is saved depending on the database mode. */
  function modeNote() {
    if (G.DB.mode === 'cloud') return 'Your game is saved in the cloud: sign in from any device. Guest progress is not saved.';
    const why =
      G.DB.localReason === 'dev'
        ? 'Development mode: your game is only saved in this browser.'
        : G.DB.localReason === 'file'
          ? 'Opened from a file: your game is only saved in this browser. To save in the cloud, play the online version.'
          : G.DB.localReason === 'host'
            ? 'This is not the official website: your game is only saved in this browser. The official, free game is at survivor.preciostcg.com.'
            : G.DB.localReason === 'config'
              ? 'Cloud not configured: your game is only saved in this browser.'
              : "Couldn't connect to the cloud: your game is only saved in this browser.";
    return why;
  }

  function open() {
    G.UI.chrome(false);
    G.UI.show('scr-login');
    $('login-err').textContent = G.DB.storageOk ? '' : "This browser won't let us save data: play as a guest.";
    $('btn-google').classList.toggle('hidden', G.DB.mode !== 'cloud');
    $('btn-local').classList.toggle('hidden', G.DB.mode === 'cloud');
    $('login-mode').textContent = modeNote();
  }

  return { init, open };
})();
