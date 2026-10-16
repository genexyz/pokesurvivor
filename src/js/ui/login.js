/* ============ login.js — inicio: entrar con Google, o jugar sin cuenta ============ */
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
    // La página se va a Google y vuelve con la sesión iniciada (G.DB.ready()).
    $('btn-google').onclick = async () => {
      $('login-err').textContent = '';
      $('btn-google').disabled = true;
      const r = await G.DB.loginWithGoogle();
      $('btn-google').disabled = false;
      if (!r.ok) $('login-err').textContent = r.error;
    };
  }

  /** Explica dónde se guarda la partida según el modo de la base de datos. */
  function modeNote() {
    if (G.DB.mode === 'cloud') return 'Tu partida se guarda en la nube: entra desde cualquier aparato. Como invitado no se guarda.';
    const why =
      G.DB.localReason === 'dev'
        ? 'Modo desarrollo: la partida sólo se guarda en este navegador.'
        : G.DB.localReason === 'file'
          ? 'Abierto desde un archivo: la partida sólo se guarda en este navegador. Para guardar en la nube, juega en la versión publicada.'
          : G.DB.localReason === 'host'
            ? 'Esta no es la web oficial: la partida sólo se guarda en este navegador. El juego oficial y gratis está en survivor.preciostcg.com.'
            : G.DB.localReason === 'config'
              ? 'Nube sin configurar: la partida sólo se guarda en este navegador.'
              : 'No se pudo conectar con la nube: la partida sólo se guarda en este navegador.';
    return why;
  }

  function open() {
    G.UI.chrome(false);
    G.UI.show('scr-login');
    $('login-err').textContent = G.DB.storageOk ? '' : 'Este navegador no deja guardar datos: juega como invitado.';
    $('btn-google').classList.toggle('hidden', G.DB.mode !== 'cloud');
    $('btn-local').classList.toggle('hidden', G.DB.mode === 'cloud');
    $('login-mode').textContent = modeNote();
  }

  return { init, open };
})();
