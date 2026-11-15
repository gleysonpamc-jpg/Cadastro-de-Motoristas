// Link de cobrança: o motorista envia só os documentos pedidos (sem login, com token pessoal).
(function () {
  'use strict';
  var C = window.Comum, esc = C.esc, box = document.getElementById('box');
  var token = new URLSearchParams(location.search).get('t') || '';
  var INFO = null;
  function campo(c) {
    var n = esc(c.nome);
    if (c.tipo === 'uf') return '<label class="campo">' + esc(c.rot) + '<select name="' + n + '"><option value="">Selecione</option>' + C.UFS.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></label>';
    var t = c.tipo === 'data' ? 'date' : c.tipo === 'ano' ? 'number' : 'text';
    return '<label class="campo">' + esc(c.rot) + '<input name="' + n + '" type="' + t + '"' + (c.tipo === 'ano' ? ' placeholder="' + new Date().getFullYear() + '"' : '') + '></label>';
  }
  function desenhar() {
    var falta = INFO.docs.filter(function (d) { return !d.enviado; });
    document.getElementById('emp').textContent = INFO.empresa || '';
    document.getElementById('ola').textContent = 'Olá, ' + INFO.nome;
    document.getElementById('sub').textContent = falta.length ? 'Falta' + (falta.length > 1 ? 'm ' + falta.length + ' documentos' : ' 1 documento') + ' no seu cadastro. Envie por aqui, leva um minuto.' : 'Tudo enviado. Obrigado!';
    box.innerHTML = INFO.docs.map(function (d, i) {
      if (d.enviado) return '<div class="doc-c feito"><div class="linha-flex"><b class="cresce">' + esc(d.rot) + '</b><span class="chip ok">Enviado</span></div></div>';
      return '<form class="doc-c" data-i="' + i + '"><div class="linha-flex"><b class="cresce">' + esc(d.rot) + '</b>' + (d.motivo ? '<span class="chip falta">' + esc(d.motivo) + '</span>' : '') + '</div>' +
        (d.campos.length ? '<div class="grade">' + d.campos.map(campo).join('') + '</div>' : '') +
        '<label class="arq"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Tirar foto ou escolher arquivo</span><input type="file" accept="application/pdf,image/*"></label>' +
        '<button class="btn" type="submit">Enviar ' + esc(d.rot) + '</button></form>';
    }).join('') +
      '<div class="linha-flex peq suave" style="align-items:flex-start;background:#fff;border:1px solid var(--linha);border-radius:10px;padding:12px 14px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#56607A" stroke-width="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' +
      '<span class="cresce">Este link é só seu, vale até ' + new Date(INFO.expira).toLocaleDateString('pt-BR') + ' e só permite enviar estes documentos.</span></div>';
    box.querySelectorAll('form[data-i]').forEach(function (f) {
      var d = INFO.docs[+f.dataset.i], arq = f.querySelector('input[type=file]');
      arq.onchange = function () { if (arq.files[0]) f.querySelector('.arq span').textContent = '✓ ' + arq.files[0].name; };
      f.onsubmit = function (e) {
        e.preventDefault();
        if (!arq.files[0]) { C.aviso('Escolha a foto ou o arquivo do documento.', 'erro'); return; }
        var campos = {}; f.querySelectorAll('[name]').forEach(function (el) { campos[el.name] = el.value.trim(); });
        var bt = f.querySelector('[type=submit]'); C.ocupado(bt, true, 'Enviando...');
        C.prepararArquivo(arq.files[0], 'x', false).then(function (a) { return C.api('cobrancaEnviar', token, d.chave, campos, { base64: a.base64 }); })
          .then(function () { d.enviado = true; C.aviso(d.rot + ' enviado!', 'ok'); desenhar(); })
          .catch(function (e2) { C.ocupado(bt, false); C.aviso(e2.message, 'erro'); });
      };
    });
  }
  C.api('cobrancaInfo', token).then(function (r) { INFO = r; desenhar(); })
    .catch(function (e) { document.getElementById('ola').textContent = 'Link indisponível'; box.innerHTML = '<div class="cartao" style="text-align:center"><p>' + esc(e.message) + '</p></div>'; });
})();
