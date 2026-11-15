// =============================================================================
//  Ponte do site (GitHub Pages) com o Apps Script + login com a conta Google.
//  As telas continuam chamando google.script.run...; aqui isso vira um pedido à API (doPost).
//  Não há dados nem senhas neste arquivo.
// =============================================================================
(function () {
  'use strict';
  var C = window.CONFIG_SITE || {};
  var PUBLICA = document.documentElement.getAttribute('data-publica') === '1';
  var SO_ADMIN = document.documentElement.getAttribute('data-admin') === '1';
  var CHAVE = 'cadastro_sessao_v1';
  var sessao = null, recarregar = false, liberar, pronto = new Promise(function (r) { liberar = r; });

  function lerSessao() {
    try { var s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return s && s.ate > Date.now() ? s : null; } catch (e) { return null; }
  }
  function gravarSessao(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} }
  function limparSessao() { sessao = null; try { localStorage.removeItem(CHAVE); } catch (e) {} }

  function postar(acao, args, comSessao) {
    if (!C.API_URL || /COLE_AQUI/.test(C.API_URL)) return Promise.reject(new Error('Configure API_URL no arquivo config.js.'));
    return fetch(C.API_URL, {                      // texto simples: o Google aceita sem "preflight" de CORS
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ acao: acao, args: args || [], sessao: comSessao && sessao ? sessao.sessao : '' })
    }).then(function (r) {
      if (!r.ok) throw new Error('Falha de comunicação (' + r.status + ').');
      return r.json();
    }).then(function (j) {
      if (!j.ok) { var e = new Error(j.erro || 'Erro'); e.login = !!j.login; throw e; }
      return j.r;
    });
  }

  function api(acao, args) {
    if (PUBLICA) return postar(acao, args, false);
    return pronto.then(function () { return postar(acao, args, true); }).catch(function (e) {
      if (e.login) { limparSessao(); recarregar = true; mostrarLogin('Sua sessão terminou. Entre de novo.'); }
      throw e;
    });
  }
  window.apiSistema = api;

  // ---- google.script.run (mesmo jeito de chamar que as telas já usam) ----
  function runner(ok, falha, obj) {
    return new Proxy({}, {
      get: function (_, nome) {
        if (nome === 'withSuccessHandler') return function (f) { return runner(f, falha, obj); };
        if (nome === 'withFailureHandler') return function (f) { return runner(ok, f, obj); };
        if (nome === 'withUserObject') return function (o) { return runner(ok, falha, o); };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          api(String(nome), args).then(function (r) { if (ok) ok(r, obj); })
            .catch(function (e) { if (falha) falha(e, obj); else console.error(e); });
        };
      }
    });
  }
  function instalarPonte() {
    window.google = window.google || {};
    window.google.script = { run: runner(), host: { close: function () {} } };
  }
  instalarPonte();

  if (PUBLICA) return;                              // cadastro dos motoristas: sem login

  // ---------- tela de login ----------
  var css = '#lgOv{position:fixed;inset:0;background:#f3f4f6;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}' +
    '#lgBox{background:#fff;padding:28px 30px;border-radius:12px;box-shadow:0 2px 14px #0002;max-width:360px;width:90%;text-align:center}' +
    '#lgBox h2{color:#1f7a3f;margin:0 0 6px}#lgBox p{color:#555;font-size:14px}#lgMsg{color:#c62828;font-size:13px;min-height:18px;margin-top:10px}' +
    '#lgBtn{display:flex;justify-content:center;margin-top:14px}' +
    '#lgUser{position:fixed;top:6px;right:10px;z-index:50;font:12px Arial,sans-serif;background:#fff;border-radius:16px;padding:4px 10px;box-shadow:0 1px 4px #0003}' +
    '#lgUser a{color:#c62828;margin-left:8px;cursor:pointer;text-decoration:underline}' +
    'body.perfil-funcionario a[href^="painel.html"]{display:none!important}' +
    'body.perfil-funcionario .ic.ex{display:none!important}' +
    '@media print{#lgUser{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function quandoPronto(f) { if (document.body) f(); else document.addEventListener('DOMContentLoaded', f); }

  function carregarGis(cb) {
    if (window.google && window.google.accounts && window.google.accounts.id) return cb();
    var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = function () { instalarPonte(); cb(); };
    s.onerror = function () { msgLogin('Não consegui carregar o login do Google. Verifique a internet.'); };
    document.head.appendChild(s);
  }
  function msgLogin(t) { var m = document.getElementById('lgMsg'); if (m) m.textContent = t || ''; }

  function mostrarLogin(aviso) {
    quandoPronto(function () {
      var ov = document.getElementById('lgOv');
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'lgOv';
        ov.innerHTML = '<div id="lgBox"><h2>' + (C.TITULO || 'Cadastro de Motoristas') + '</h2><p>Entre com a sua conta Google para acessar o sistema.</p>' +
          '<div id="lgBtn"></div><div id="lgMsg"></div></div>';
        document.body.appendChild(ov);
      }
      ov.style.display = 'flex'; msgLogin(aviso);
      if (!C.CLIENT_ID || /COLE_AQUI/.test(C.CLIENT_ID)) { msgLogin('Configure CLIENT_ID no arquivo config.js.'); return; }
      carregarGis(function () {
        window.google.accounts.id.initialize({ client_id: C.CLIENT_ID, callback: aoEntrar, auto_select: true, cancel_on_tap_outside: false });
        var alvo = document.getElementById('lgBtn'); alvo.innerHTML = '';
        window.google.accounts.id.renderButton(alvo, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-BR' });
        window.google.accounts.id.prompt();
      });
    });
  }

  function aoEntrar(resp) {
    msgLogin('Conferindo seu acesso...');
    sessao = null;
    postar('entrar', [resp.credential], false).then(function (r) {
      r.ate = Date.now() + (r.horas || 6) * 3600 * 1000 - 60000;
      gravarSessao(r);
      if (recarregar) { location.reload(); return; }     // a sessão caiu no meio do uso: recarrega a tela para refazer o que falhou
      sessao = r; fecharLogin(); if (aplicarPerfil()) liberar();
    }).catch(function (e) { msgLogin(e.message); });
  }
  function fecharLogin() { var ov = document.getElementById('lgOv'); if (ov) ov.style.display = 'none'; }

  // devolve false quando a tela não é permitida para o perfil (aí nenhum pedido é enviado)
  function aplicarPerfil() {
    var permitido = !(SO_ADMIN && sessao.perfil !== 'admin');
    quandoPronto(function () {
      document.body.classList.remove('perfil-admin', 'perfil-funcionario');
      document.body.classList.add('perfil-' + sessao.perfil);
      if (SO_ADMIN && sessao.perfil !== 'admin') {
        document.body.innerHTML = '<div style="font-family:Arial;text-align:center;margin-top:20vh"><h2>Sem permissão</h2><p>O Painel é só para administradores.</p><p><a href="index.html">Voltar</a></p></div>';
      }
      var u = document.getElementById('lgUser');
      if (!u) { u = document.createElement('div'); u.id = 'lgUser'; document.body.appendChild(u); }
      u.innerHTML = '';
      u.appendChild(document.createTextNode((sessao.nome || sessao.email) + ' · ' + (sessao.perfil === 'admin' ? 'Administrador' : 'Funcionário')));
      var sair = document.createElement('a'); sair.textContent = 'Sair'; sair.onclick = sairDoSistema; u.appendChild(sair);
    });
    return permitido;
  }
  function sairDoSistema() {
    var s = sessao; limparSessao();
    try { window.google.accounts.id.disableAutoSelect(); } catch (e) {}
    (s ? postar('sair', [], false).catch(function () {}) : Promise.resolve()).then(function () { location.reload(); });
  }
  window.sairDoSistema = sairDoSistema;

  // ---------- início: sessão guardada? confere no servidor antes de liberar a tela ----------
  var guardada = lerSessao();
  if (guardada) {
    sessao = guardada;
    postar('quemSou', [], true).then(function (u) {
      if (!u) throw Object.assign(new Error('Sessão encerrada.'), { login: true });
      sessao.perfil = u.perfil; sessao.nome = u.nome; gravarSessao(sessao);
      if (aplicarPerfil()) liberar();
    }).catch(function (e) { limparSessao(); mostrarLogin(e.login ? '' : e.message); });
  } else {
    mostrarLogin('');
  }
})();
