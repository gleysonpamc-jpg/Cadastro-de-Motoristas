// Cadastro do motorista (link público, sem login), em 4 etapas.
(function () {
  'use strict';
  var C = window.Comum, esc = C.esc, f = document.getElementById('f');
  var etapa = 1, TIPOS = ['FIORINO', 'KOMBI', 'VAN', 'CAMINHÃO 3/4', 'CARRETA'];
  var opc = function (l, v) { return '<option value="">Selecione</option>' + l.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join(''); };
  var inp = function (n, r, t, ph, extra) { return '<label class="campo">' + r + '<input name="' + esc(n) + '" type="' + (t || 'text') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '></label>'; };
  var sel = function (n, r, l) { return '<label class="campo">' + r + '<select name="' + esc(n) + '">' + opc(l) + '</select></label>'; };
  var PIX = ['CPF', 'CNPJ', 'E-mail', 'Celular', 'Chave aleatória'];
  var arqBox = function (tipo, rot) { return '<label class="arq"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>' + (rot || 'Tirar foto ou escolher arquivo') + '</span><input type="file" accept="application/pdf,image/*" data-tipo="' + tipo + '"></label>'; };

  f.innerHTML =
    '<section data-e="1"><h1>Seus dados</h1><p class="suave peq">Os campos com * são obrigatórios. O resto você pode completar depois.</p><div class="grade">' +
      inp('Motorista', 'Nome completo *', 'text', '', ' autocomplete="name"') + inp('Data de Nascimento', 'Data de nascimento', 'date') + inp('CPF', 'CPF ou CNPJ *', 'text', 'CPF ou CNPJ') +
      inp('Celular', 'Celular (WhatsApp) *', 'tel', '(00) 00000-0000') + inp('E-mail', 'E-mail', 'email', '', ' autocomplete="email"') + sel('Tipo Chave Pix', 'Tipo da chave Pix', PIX) + inp('Chave Pix', 'Chave Pix') +
    '</div><h2 class="bloco-tit" style="margin-top:14px">Endereço</h2><div class="grade">' +
      inp('CEP', 'CEP', 'text', '00000-000') + inp('Logradouro', 'Rua / avenida') + inp('Número Endereço', 'Número') + inp('Complemento', 'Complemento') + inp('Bairro', 'Bairro') + inp('Cidade', 'Cidade') + sel('UF', 'UF', C.UFS) +
    '</div></section>' +
    '<section data-e="2" class="oculto"><h1>Veículo</h1><div class="grade">' +
      inp('Placa Veículo', 'Placa *', 'text', 'ABC1D23', ' maxlength="8" style="text-transform:uppercase"') + '<label class="campo">Tipo de veículo<select name="Tipo de Veículo" id="tipoV">' + opc(TIPOS) + '</select></label>' +
      inp('Marca/Modelo', 'Marca / modelo') + inp('Ano Fabricação', 'Ano de fabricação', 'number') + inp('Cor', 'Cor') + inp('Renavam', 'Renavam', 'text', '', ' inputmode="numeric"') + inp('Chassi', 'Chassi', 'text', '', ' maxlength="17"') + inp('CARGA MÁXIMA (KG)', 'Carga máxima (kg)', 'number') +
    '</div><h2 class="bloco-tit" style="margin-top:14px">Proprietário do veículo</h2><label class="chk"><input type="checkbox" id="mesmo" checked>O veículo é meu (sou o proprietário)</label>' +
    '<div id="dono" class="oculto" style="margin-top:10px"><div class="grade">' +
      inp('Proprietário', 'Nome ou razão social *') + inp('CPF Proprietário', 'CPF ou CNPJ *') + inp('Celular Proprietário', 'Celular', 'tel') + inp('E-mail Proprietário', 'E-mail', 'email') +
      sel('Tipo Chave Pix Proprietário', 'Tipo da chave Pix', PIX) + inp('Chave Pix Proprietário', 'Chave Pix') + inp('CEP Proprietário', 'CEP *') + inp('Logradouro Proprietário', 'Rua / avenida *') +
      inp('Número Proprietário', 'Número') + inp('Complemento Proprietário', 'Complemento') + inp('Bairro Proprietário', 'Bairro *') + inp('Cidade Proprietário', 'Cidade *') + sel('UF Proprietário', 'UF *', C.UFS) +
    '</div><div class="doc-c" style="margin-top:12px"><b>CNH do proprietário</b><div class="grade">' + inp('Número CNH Proprietário', 'Número') + inp('CNH Validade Proprietário', 'Validade', 'date') + '</div>' + arqBox('CNH PROPRIETARIO') + '</div>' +
    '<p class="peq suave">O contrato fica no nome do proprietário. Você (motorista) aceita um termo de 1 folha.</p></div></section>' +
    '<section data-e="3" class="oculto"><h1>Documentos</h1><p class="suave peq">Tire uma foto ou escolha o arquivo: fotos viram PDF sozinhas. Se não tiver algum agora, pode pular.</p>' +
      '<div class="doc-c"><b>CNH</b><div class="grade">' + inp('Número CNH', 'Número', 'text', '', ' inputmode="numeric"') + inp('CNH-DATA DE VALIDADE', 'Validade', 'date') + '</div>' + arqBox('CNH') + '</div>' +
      '<div class="doc-c"><b>CRLV do veículo</b><div class="grade">' + sel('UF Veículo', 'UF onde o veículo é licenciado', C.UFS) + inp('CRLV Exercício', 'Ano do CRLV', 'number', String(new Date().getFullYear())) + '</div>' + arqBox('CRLV') + '</div>' +
      '<div class="doc-c"><b>ANTT (RNTRC)</b>' + inp('Número ANTT', 'Número', 'text', '', ' inputmode="numeric"') + arqBox('ANTT') + '</div>' +
      '<div class="doc-c"><b>Vigilância Sanitária</b>' + inp('Data Vigilância', 'Data de emissão', 'date') + arqBox('VIGILANCIA') + '</div>' +
      '<div class="doc-c"><b>Nada Consta</b>' + inp('Data Nada Costa', 'Data de emissão', 'date') + arqBox('NADA COSTA') + '</div>' +
      '<div class="doc-c"><b>Comprovante de residência</b><span class="peq suave">Conta de luz, água ou telefone</span>' + inp('Data Residência', 'Data de emissão', 'date') + arqBox('RESIDENCIA') + '</div>' +
    '</section>' +
    '<section data-e="4" class="oculto"><h1>Contrato</h1><p class="peq">Leia o contrato de transporte. Ele já vem com os dados que você preencheu.</p>' +
      '<button type="button" class="btn sec" id="lerC">Ler o contrato</button><button type="button" class="btn sec oculto" id="lerT">Ler o termo do motorista (1 folha)</button>' +
      '<label class="chk" style="margin-top:6px"><input type="checkbox" id="aceite">Li e aceito o contrato<span id="eTermo"></span></label>' +
      '<label class="campo">Observações<textarea name="Observações" rows="3"></textarea></label>' +
      '<p class="mini suave">Seus dados são usados só para o cadastro na empresa. Depois de enviar, a empresa confere e aprova.</p></section>';

  C.ligarMascaras(f); C.ligarCep(f, ''); C.ligarCep(f, ' Proprietário');
  var mesmo = document.getElementById('mesmo'), dono = document.getElementById('dono');
  mesmo.onchange = function () { dono.classList.toggle('oculto', mesmo.checked); };
  f.querySelectorAll('input[type=file]').forEach(function (i) {
    i.onchange = function () { var c = i.closest('.doc-c'), s = i.parentNode.querySelector('span'); if (i.files[0]) { s.textContent = '✓ ' + i.files[0].name; if (c) c.classList.add('feito'); } };
  });
  ['', ' Proprietário'].forEach(function (suf) {
    var t = f.querySelector('[name="Tipo Chave Pix' + suf + '"]'), k = f.querySelector('[name="Chave Pix' + suf + '"]');
    t.onchange = function () { if (k.value) return; var o = { 'CPF': 'CPF' + suf, 'CNPJ': 'CPF' + suf, 'E-mail': 'E-mail' + suf, 'Celular': 'Celular' + suf }[t.value]; var el = o && f.querySelector('[name="' + o + '"]'); if (el) k.value = el.value; };
  });
  C.api('tiposVeiculo').then(function (l) { if (l && l.length) { TIPOS = l; document.getElementById('tipoV').innerHTML = opc(l); } }).catch(function () {});

  function dados() {
    var d = {};
    f.querySelectorAll('[name]').forEach(function (el) { if (el.type !== 'file') d[el.name] = el.value.trim(); });
    if (mesmo.checked) Object.keys(d).forEach(function (k) { if (/Proprietário$/.test(k)) d[k] = ''; });
    if (d['Placa Veículo']) d['Placa Veículo'] = d['Placa Veículo'].toUpperCase();
    return d;
  }
  function faltam(e) {
    var d = dados(), l = [];
    if (e === 1) { if (!d.Motorista) l.push('nome'); if (!d.CPF) l.push('CPF ou CNPJ'); else if (!C.docValido(d.CPF)) l.push('CPF ou CNPJ válido (confira os números)'); if (d.Celular.replace(/\D/g, '').length < 10) l.push('celular'); }
    if (e === 2) {
      if (!d['Placa Veículo']) l.push('placa');
      if (!mesmo.checked) [['Proprietário', 'nome do proprietário'], ['CPF Proprietário', 'CPF/CNPJ do proprietário'], ['CEP Proprietário', 'CEP do proprietário'], ['Logradouro Proprietário', 'rua do proprietário'], ['Bairro Proprietário', 'bairro do proprietário'], ['Cidade Proprietário', 'cidade do proprietário'], ['UF Proprietário', 'UF do proprietário']]
        .forEach(function (p) { if (!d[p[0]]) l.push(p[1]); });
      if (!mesmo.checked && d['CPF Proprietário'] && !C.docValido(d['CPF Proprietário'])) l.push('CPF ou CNPJ do proprietário válido (confira os números)');
    }
    return l;
  }
  function mostrar() {
    f.querySelectorAll('section[data-e]').forEach(function (s) { s.classList.toggle('oculto', +s.dataset.e !== etapa); });
    document.querySelectorAll('.passos i').forEach(function (i, k) { i.classList.toggle('on', k < etapa); });
    document.querySelectorAll('.nomes span').forEach(function (s, k) { s.classList.toggle('on', k + 1 === etapa); });
    document.getElementById('etapaTxt').textContent = 'Etapa ' + etapa + ' de 4';
    document.getElementById('voltar').style.visibility = etapa === 1 ? 'hidden' : 'visible';
    document.getElementById('avancar').textContent = etapa === 4 ? 'Enviar cadastro' : etapa === 3 ? 'Continuar para o contrato' : 'Continuar';
    var outro = !mesmo.checked;
    document.getElementById('lerT').classList.toggle('oculto', !outro);
    document.getElementById('eTermo').textContent = outro ? ' e o termo do motorista' : '';
    window.scrollTo(0, 0);
  }
  document.getElementById('voltar').onclick = function () { if (etapa > 1) { etapa--; mostrar(); } };
  document.getElementById('avancar').onclick = function () {
    if (etapa < 4) {
      var l = faltam(etapa); if (l.length) { C.aviso('Preencha: ' + l.join(', ') + '.', 'erro'); return; }
      etapa++; mostrar(); return;
    }
    enviar();
  };
  function ler(qual) {
    var j = C.janela(qual === 'termo' ? 'Termo do motorista' : 'Contrato de transporte', '<div class="carregando">Carregando...</div>', { largura: 820 });
    C.api('previaContrato', dados(), qual).then(function (r) {
      j.el.innerHTML = (r.faltando && r.faltando.length ? '<p class="chip falta" style="display:block">Para aceitar, preencha: ' + esc(r.faltando.join(', ')) + '.</p>' : '') +
        '<div class="contrato-txt">' + r.html + '</div><div class="acoes-dir"><button type="button" class="btn sec" data-fechar>Fechar</button><button type="button" class="btn" id="jaLi">Li e aceito</button></div>';
      document.getElementById('jaLi').onclick = function () { document.getElementById('aceite').checked = true; j.fechar(); };
    }).catch(function (e) { j.el.innerHTML = '<p>' + esc(e.message) + '</p>'; });
  }
  document.getElementById('lerC').onclick = function () { ler('contrato'); };
  document.getElementById('lerT').onclick = function () { ler('termo'); };

  function enviar() {
    var bt = document.getElementById('avancar'), d = dados();
    var l = faltam(1).concat(faltam(2)); if (l.length) { C.aviso('Preencha: ' + l.join(', ') + '.', 'erro'); return; }
    if (document.getElementById('aceite').checked) d['Aceite Contrato'] = true;
    var inputs = Array.prototype.filter.call(f.querySelectorAll('input[type=file]'), function (i) { return i.files[0] && !(i.dataset.tipo === 'CNH PROPRIETARIO' && mesmo.checked); });
    ['NADA COSTA', 'RESIDENCIA'].forEach(function (t) { if (inputs.some(function (i) { return i.dataset.tipo === t; })) d[t] = true; });
    C.ocupado(bt, true, 'Enviando...');
    Promise.all(inputs.map(function (i) { return C.prepararArquivo(i.files[0], i.dataset.tipo, false); }))
      .then(function (arqs) { return C.api('salvarCadastro', d, arqs, ''); })
      .then(function (r) {
        document.getElementById('rodape').remove();
        f.innerHTML = '<div class="cartao" style="text-align:center;padding:36px 20px"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1F5A33" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7 12 3.5 3.5L17 9"/></svg>' +
          '<h1 style="margin:12px 0 8px">Cadastro enviado!</h1><p>Obrigado, ' + esc(d.Motorista.split(' ')[0]) + '. A empresa vai conferir seus dados e documentos.</p>' +
          (r && r.aviso ? '<p class="peq suave">' + esc(r.aviso) + '</p>' : '') + '<p class="peq suave">Se faltar algo, você recebe um link para enviar só o que faltar.</p></div>';
        window.scrollTo(0, 0);
      }).catch(function (e) { C.ocupado(bt, false); C.aviso(e.message, 'erro'); });
  }
  mostrar();
})();
