// =============================================================================
//  Sistema da equipe: Início, Motoristas (lista + ficha), Novo, Importar/Exportar, Configurações.
//  Todas as chamadas passam por Comum.api -> app.js (login Google) -> Apps Script.
// =============================================================================
(function () {
  'use strict';
  var C = window.Comum, esc = C.esc, api = C.api;
  var tela = document.getElementById('tela');
  var D = null;                                   // dados carregados (cadastros, atividade, tipos...)
  var FILTRO = { q: '', f: 'ativos', tipo: '' };  // filtros da lista de motoristas
  var FILA = 'tudo', FILA_MAX = 40;
  var ehAdmin = function () { return window.PERFIL_SISTEMA === 'admin'; };

  var SIT = [['CNH-DATA DE VALIDADE', 'CNH'], ['CRLV', 'CRLV'], ['ANTT', 'ANTT'], ['CVV: VIGILANCIA', 'Vigilância'], ['NADA COSTA', 'Nada Consta'], ['RESIDENCIA', 'Residência'], ['CONTRATO PAMC', 'Contrato']];
  var ROT = {}; SIT.forEach(function (s) { ROT[s[0]] = s[1]; });
  var ANTT_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx';
  var ICONE = {
    mais: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    busca: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#56607A" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    baixa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 15V3M7 10l5 5 5-5M4 21h16"/></svg>',
    sobe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M4 21h16"/></svg>'
  };

  // ---------------------------------------------------------------- utilitários
  var ehInativo = function (x) { return /inativ/i.test(x.status || ''); };
  var ehRevisao = function (x) { return /revis/i.test(x.status || ''); };
  function iniciais(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function curto(m) { m = String(m || '').replace(/^CRLV: /, ''); m = m.charAt(0).toUpperCase() + m.slice(1); return m.length > 60 ? m.slice(0, 57) + '...' : m; }
  // situação -> { cls, txt }
  function sit(s, chave) {
    if (!s) return { cls: 'neutro', txt: '—' };
    if (s.e === 'ok') return { cls: 'ok', txt: chave === 'CONTRATO PAMC' ? 'Aceito' : chave === 'ANTT' ? 'Ativa' : 'Em dia' };
    if (s.e === 'vence') return { cls: 'vence', txt: s.d === 0 ? 'Vence hoje' : 'Vence em ' + (s.t || s.d + ' dias') };
    if (s.e === 'vencido') return { cls: 'vencido', txt: chave === 'ANTT' && s.m ? curto(s.m.replace(/^ANTT /, '')) : 'Vencido' + (s.t ? ' há ' + s.t : '') };
    if (chave === 'CONTRATO PAMC') return { cls: 'falta', txt: 'Sem aceite' };
    if (s.m && /calend/i.test(s.m)) return { cls: 'neutro', txt: 'Sem calendário' };
    if (chave === 'ANTT') return { cls: 'falta', txt: 'Não consultada' };
    return { cls: 'falta', txt: s.m ? 'Faltam dados' : 'Faltando' };
  }
  function pior(x) {
    if (ehRevisao(x)) return { cls: 'rev', txt: 'Revisar' };
    if (ehInativo(x)) return { cls: 'neutro', txt: 'Inativo' };
    var d = x.docs || {}, ks = Object.keys(d);
    if (ks.some(function (k) { return d[k].e === 'vencido'; })) return { cls: 'vencido', txt: 'Vencido' };
    var v = ks.filter(function (k) { return d[k].e === 'vence'; }).map(function (k) { return d[k].d; }).sort(function (a, b) { return a - b; });
    if (v.length) return { cls: 'vence', txt: 'Vence ' + v[0] + 'd' };
    if (ks.some(function (k) { return d[k].e === 'falta'; })) return { cls: 'falta', txt: 'Pendente' };
    return { cls: 'ok', txt: 'Em dia' };
  }
  var temPendencia = function (x) { var d = x.docs || {}; return Object.keys(d).some(function (k) { return d[k].e !== 'ok'; }); };
  var quando = function (ms) { return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; };
  var porId = function (id) { return (D && D.cadastros || []).filter(function (x) { return x.id === id; })[0]; };
  function erro(e) { C.aviso(e && e.message ? e.message : String(e), 'erro'); }
  function opcoes(lista, atual, vazio) {
    var l = lista.slice(); if (atual && l.indexOf(atual) < 0) l.push(atual);
    return (vazio !== false ? '<option value="">Selecione</option>' : '') + l.map(function (o) { return '<option' + (o === atual ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
  }

  // ---------------------------------------------------------------- carga e rotas
  function carregar() {
    return api('carregarTudo', '', C.base()).then(function (d) {
      D = d;
      var rev = d.cadastros.filter(ehRevisao).length, n = document.getElementById('numRev');
      n.textContent = rev; n.classList.toggle('oculto', !rev);
      return d;
    });
  }
  function rota() {
    var p = (location.hash || '#/inicio').replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    document.querySelectorAll('.menu a.it').forEach(function (a) { a.classList.toggle('on', a.dataset.r === (p[0] === 'novo' || p[0] === 'importar' ? 'motoristas' : p[0])); });
    if (!D) { tela.innerHTML = '<div class="carregando">Carregando...</div>'; return; }
    window.scrollTo(0, 0);
    if (p[0] === 'motoristas') return telaMotoristas(p[1] || '', p[2] || 'docs');
    if (p[0] === 'novo') return telaNovo();
    if (p[0] === 'importar') return telaImportar();
    if (p[0] === 'config') return telaConfig(p[1] || 'empresa');
    return telaInicio();
  }
  window.addEventListener('hashchange', rota);
  function ir(h) { if (location.hash === h) rota(); else location.hash = h; }
  function recarregar() { return carregar().then(rota).catch(erro); }

  // ================================================================ INÍCIO
  function itensFila() {
    var out = [];
    D.cadastros.forEach(function (x) {
      var quem = x.motorista + (x.cod ? ' (' + x.cod + ')' : '');
      if (ehRevisao(x)) { out.push({ g: 'rev', ord: 2, tag: 'Novo cadastro', cls: 'rev', tit: x.motorista + ' · sem código', det: 'Recebido' + (x.cadastro ? ' em ' + x.cadastro : '') + ' pelo link de cadastro', acao: 'Revisar e aprovar', href: '#/motoristas/' + x.id + '/dados' }); return; }
      if (ehInativo(x)) return;
      SIT.forEach(function (s) {
        var st = (x.docs || {})[s[0]]; if (!st || st.e === 'ok') return;
        var g = st.e === 'vencido' ? 'venc' : st.e === 'vence' ? 'vence' : 'falta', si = sit(st, s[0]);
        if (si.txt === 'Sem calendário') return;
        out.push({ g: g, ord: g === 'venc' ? 0 : g === 'vence' ? 1 : 3, d: st.d == null ? 999 : st.d, tag: si.txt.length > 22 ? si.txt.slice(0, 20) + '…' : si.txt, cls: si.cls,
          tit: ROT[s[0]] + ' · ' + quem, det: st.m ? curto(st.m) : '', acao: s[0] === 'CONTRATO PAMC' ? 'Abrir contrato' : 'Cobrar',
          href: '#/motoristas/' + x.id + '/' + (s[0] === 'CONTRATO PAMC' ? 'contrato' : 'docs'), cobrar: s[0] !== 'CONTRATO PAMC' && s[0] !== 'ANTT' ? x.id : '',
          antt: s[0] === 'ANTT' ? String(x.cpf || '').replace(/\D/g, '') || '-' : '' });
      });
    });
    return out.sort(function (a, b) { return a.ord - b.ord || (a.d || 0) - (b.d || 0); });
  }
  function telaInicio() {
    var L = D.cadastros, ativos = L.filter(function (x) { return !ehInativo(x) && !ehRevisao(x); });
    var veic = ativos.filter(function (x) { return x.placa || x.tipo; }), carga = ativos.reduce(function (s, x) { return s + (x.carga || 0); }, 0);
    var emDia = ativos.length ? Math.round(100 * ativos.filter(function (x) { return !temPendencia(x); }).length / ativos.length) : 0;
    var rev = L.filter(ehRevisao).length, itens = itensFila();
    var cont = { tudo: itens.length, venc: 0, vence: 0, falta: 0, rev: 0 }; itens.forEach(function (i) { cont[i.g]++; });
    var tipos = {}; veic.forEach(function (x) { var t = x.tipo || 'Sem tipo'; tipos[t] = (tipos[t] || 0) + 1; });
    var tl = Object.keys(tipos).sort(function (a, b) { return tipos[b] - tipos[a]; }), max = Math.max.apply(null, tl.map(function (t) { return tipos[t]; }).concat([1]));
    var hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    tela.innerHTML =
      '<div class="topo"><div class="cresce"><h1>Início</h1><div class="suave peq">' + esc(hoje.charAt(0).toUpperCase() + hoje.slice(1)) + ' · ' + itens.length + ' ite' + (itens.length === 1 ? 'm precisa' : 'ns precisam') + ' de você</div></div>' +
      '<label class="busca">' + ICONE.busca + '<span class="oculto">Buscar</span><input id="buscaIni" placeholder="Buscar nome, placa ou código"></label>' +
      '<a class="btn" href="#/novo">' + ICONE.mais + 'Novo motorista</a></div>' +
      '<section class="kpis" aria-label="Números da frota">' +
        kpi('Motoristas ativos', ativos.length, L.filter(ehInativo).length + ' inativos', 'ativos') +
        kpi('Veículos na frota', veic.length, carga ? 'Carga total ' + (carga / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t' : '', 'ativos') +
        '<button class="kpi" data-f="pend"><span class="r">Documentação 100% em dia</span><span class="v">' + emDia + '%</span><div class="barra"><div style="width:' + emDia + '%"></div></div></button>' +
        '<button class="kpi' + (rev ? ' alerta' : '') + '" data-f="rev"><span class="r">Aguardando revisão</span><span class="v">' + rev + '</span><span class="d">Cadastros novos pelo link</span></button>' +
      '</section>' +
      '<div class="duas"><section class="cartao prin" aria-labelledby="tFila">' +
        '<div class="linha-flex" style="margin-bottom:6px"><h2 id="tFila" class="sec-tit cresce">Precisa de você</h2>' +
        [['tudo', 'Tudo'], ['venc', 'Vencidos'], ['vence', 'Vencendo'], ['falta', 'Faltando'], ['rev', 'Revisão']].map(function (f) {
          return '<button class="pill' + (FILA === f[0] ? ' on' : '') + '" data-fila="' + f[0] + '">' + f[1] + ' · ' + cont[f[0]] + '</button>'; }).join('') + '</div>' +
        '<div id="fila"></div></section>' +
        '<div class="lat"><section class="cartao" aria-labelledby="tFrota"><h2 id="tFrota" style="margin-bottom:12px">Frota por tipo</h2>' +
          (tl.length ? '<div class="barras">' + tl.map(function (t) { return '<button class="b" data-tipo="' + esc(t) + '" title="Ver ' + esc(t) + '"><span>' + Math.round(100 * tipos[t] / veic.length) + '%</span><i style="height:' + Math.max(4, Math.round(100 * tipos[t] / max)) + '%"></i></button>'; }).join('') + '</div>' +
          '<div class="rotulos">' + tl.map(function (t) { return '<div><b>' + tipos[t] + '</b><span>' + esc(t) + '</span></div>'; }).join('') + '</div>' : '<p class="suave">Nenhum veículo ainda.</p>') + '</section>' +
          '<section class="cartao" aria-labelledby="tAtiv"><h2 id="tAtiv" style="margin-bottom:6px">Atividade recente</h2>' +
          (D.atividade.length ? D.atividade.slice(0, 8).map(function (a) { return '<div class="ativ"><div>' + esc((a.usuario ? a.usuario + ': ' : '') + a.acao.charAt(0).toLowerCase() + a.acao.slice(1) + (a.motorista ? ' · ' + a.motorista : '')) + '</div><div class="q">' + esc(quando(a.quando)) + '</div></div>'; }).join('') : '<p class="suave">Nada ainda.</p>') + '</section>' +
          '<section class="cartao" style="background:var(--azul-cl);border-color:#CCD9F3"><b>Resumo semanal por e-mail</b><div class="peq" style="margin-top:4px;color:#33415E">Toda segunda, às 7h, os administradores recebem o que vence nos próximos 30 dias.</div></section>' +
        '</div></div>';
    function kpi(r, v, d, f) { return '<button class="kpi" data-f="' + f + '"><span class="r">' + r + '</span><span class="v">' + v + '</span><span class="d">' + esc(d) + '</span></button>'; }
    desenharFila(itens);
    tela.querySelectorAll('[data-fila]').forEach(function (b) { b.onclick = function () { FILA = b.dataset.fila; FILA_MAX = 40; telaInicio(); }; });
    tela.querySelectorAll('.kpi[data-f]').forEach(function (b) { b.onclick = function () { FILTRO = { q: '', f: b.dataset.f, tipo: '' }; ir('#/motoristas'); }; });
    tela.querySelectorAll('[data-tipo]').forEach(function (b) { b.onclick = function () { FILTRO = { q: '', f: 'ativos', tipo: b.dataset.tipo === 'Sem tipo' ? '' : b.dataset.tipo }; ir('#/motoristas'); }; });
    var bi = document.getElementById('buscaIni');
    bi.onkeydown = function (e) { if (e.key === 'Enter') { FILTRO = { q: bi.value, f: 'todos', tipo: '' }; ir('#/motoristas'); } };
  }
  function desenharFila(itens) {
    var l = itens.filter(function (i) { return FILA === 'tudo' || i.g === FILA; }), box = document.getElementById('fila');
    if (!l.length) { box.innerHTML = '<div class="vazio">Nada pendente aqui. 👍</div>'; return; }
    box.innerHTML = l.slice(0, FILA_MAX).map(function (i) {
      return '<div class="fila-it"><span class="chip ' + i.cls + '">' + esc(i.tag) + '</span><div class="cresce"><div class="t">' + esc(i.tit) + '</div><div class="s">' + esc(i.det) + '</div></div>' +
        (i.cobrar ? '<button class="btn sec peq" data-cob="' + esc(i.cobrar) + '">Cobrar</button>' : '') +
        (i.antt ? '<button class="btn sec peq" data-antt="' + esc(i.antt === '-' ? '' : i.antt) + '">Consultar ANTT ↗</button>' : '') +
        '<a class="btn sec peq" href="' + i.href + '">' + (i.cobrar || i.antt ? 'Abrir' : esc(i.acao)) + '</a></div>';
    }).join('') + (l.length > FILA_MAX ? '<div style="text-align:center;margin-top:12px"><button class="btn sec" id="maisFila">Mostrar mais (' + (l.length - FILA_MAX) + ')</button></div>' : '');
    box.querySelectorAll('[data-cob]').forEach(function (b) { b.onclick = function () { abrirCobranca(b.dataset.cob); }; });
    box.querySelectorAll('[data-antt]').forEach(function (b) { b.onclick = function () { consultarAntt(b.dataset.antt); }; });
    var m = document.getElementById('maisFila'); if (m) m.onclick = function () { FILA_MAX += 60; desenharFila(itens); };
  }

  // ================================================================ MOTORISTAS
  function filtrados() {
    var q = C.semAcento(FILTRO.q).trim();
    return D.cadastros.filter(function (x) {
      if (FILTRO.f === 'ativos' && (ehInativo(x) || ehRevisao(x))) return false;
      if (FILTRO.f === 'pend' && (ehInativo(x) || ehRevisao(x) || !temPendencia(x))) return false;
      if (FILTRO.f === 'rev' && !ehRevisao(x)) return false;
      if (FILTRO.f === 'inativos' && !ehInativo(x)) return false;
      if (FILTRO.tipo && x.tipo !== FILTRO.tipo) return false;
      if (q && C.semAcento([x.motorista, x.proprietario, x.placa, x.cod, x.cpf, x.tipo].join(' ')).indexOf(q) < 0 && (x.cpf || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '') || '§') < 0) return false;
      return true;
    }).sort(function (a, b) { return a.motorista.localeCompare(b.motorista, 'pt-BR'); });
  }
  function telaMotoristas(id, aba) {
    var L = D.cadastros, cont = { ativos: L.filter(function (x) { return !ehInativo(x) && !ehRevisao(x); }).length, pend: L.filter(function (x) { return !ehInativo(x) && !ehRevisao(x) && temPendencia(x); }).length,
      rev: L.filter(ehRevisao).length, inativos: L.filter(ehInativo).length, todos: L.length };
    var tiposUsados = D.tipos.concat(L.map(function (x) { return x.tipo; }).filter(function (t, i, a) { return t && D.tipos.indexOf(t) < 0 && a.indexOf(t) === i; }));
    tela.innerHTML = '<div class="mot"><section class="cartao lista" aria-labelledby="tLst"><div class="cab">' +
      '<div class="linha-flex"><h1 id="tLst" class="cresce" style="font-size:22px">Motoristas</h1>' +
      '<a class="btn sec peq" href="#/importar" title="Importar ou exportar planilha">' + ICONE.sobe + ICONE.baixa + '</a>' +
      '<a class="btn peq" href="#/novo" aria-label="Novo motorista">' + ICONE.mais + '</a></div>' +
      '<label class="busca" style="min-width:0">' + ICONE.busca + '<span class="oculto">Buscar</span><input id="bq" placeholder="Nome, placa, código, CPF ou proprietário" value="' + esc(FILTRO.q) + '"></label>' +
      '<div class="linha-flex" style="gap:6px">' + [['ativos', 'Ativos'], ['pend', 'Com pendência'], ['rev', 'Revisão'], ['inativos', 'Inativos'], ['todos', 'Todos']].map(function (f) {
        return '<button class="pill' + (FILTRO.f === f[0] ? ' on' : '') + '" data-f="' + f[0] + '" style="height:30px;font-size:12px">' + f[1] + ' ' + cont[f[0]] + '</button>'; }).join('') +
      '<select id="ftipo" aria-label="Tipo de veículo" style="height:30px;width:auto;font-size:12px;border-radius:15px"><option value="">Todos os tipos</option>' + tiposUsados.map(function (t) { return '<option' + (t === FILTRO.tipo ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
      '<div class="mini suave" id="qtd"></div></div><div class="itens" id="itens"></div></section>' +
      '<section class="cartao ficha" id="ficha" aria-live="polite"></section></div>';
    function lista() {
      var l = filtrados();
      document.getElementById('qtd').textContent = l.length + ' cadastro' + (l.length === 1 ? '' : 's');
      document.getElementById('itens').innerHTML = l.length ? l.map(function (x) {
        var p = pior(x);
        return '<a class="m' + (x.id === id ? ' on' : '') + '" href="#/motoristas/' + encodeURIComponent(x.id) + '/' + aba + '"><span class="av">' + esc(iniciais(x.motorista)) + '</span>' +
          '<span class="cresce"><span class="n" style="display:block">' + esc(x.motorista) + '</span><span class="i">' + esc([x.cod || 'sem código', x.tipo, x.placa].filter(Boolean).join(' · ')) +
          (x.proprietario && C.semAcento(x.proprietario) !== C.semAcento(x.motorista) ? '<br>Dono: ' + esc(x.proprietario) : '') + '</span></span><span class="chip ' + p.cls + '">' + esc(p.txt) + '</span></a>';
      }).join('') : '<div class="vazio">Nenhum cadastro com esse filtro.</div>';
    }
    lista();
    var bq = document.getElementById('bq'); bq.oninput = function () { FILTRO.q = bq.value; lista(); };
    tela.querySelectorAll('.lista [data-f]').forEach(function (b) { b.onclick = function () { FILTRO.f = b.dataset.f; telaMotoristas(id, aba); }; });
    document.getElementById('ftipo').onchange = function (e) { FILTRO.tipo = e.target.value; lista(); };
    var ficha = document.getElementById('ficha');
    if (!id) { ficha.innerHTML = '<div class="vazio">Escolha um motorista na lista para ver a ficha completa.</div>'; return; }
    abrirFicha(ficha, id, aba);
  }

  // ---------------------------------------------------------------- ficha
  var DOC_DEF = [
    { k: 'CNH-DATA DE VALIDADE', nome: 'CNH do motorista', tipo: 'CNH', link: 'Link CNH', campos: [['Número CNH', 'Número'], ['CNH-DATA EMISSÃO', 'Emissão', 'date'], ['CNH-DATA DE VALIDADE', 'Validade', 'date']] },
    { k: 'CRLV', nome: 'CRLV (licenciamento)', tipo: 'CRLV', link: 'Link CRLV', campos: [['Número CRLV', 'Número'], ['UF Veículo', 'UF do veículo', 'uf'], ['CRLV Exercício', 'Ano do último CRLV', 'number'], ['CRLV Débito Pendente', 'Há débito pendente (IPVA, taxas ou multas)', 'check']] },
    { k: 'ANTT', nome: 'ANTT (RNTRC)', tipo: 'ANTT', link: 'Link ANTT', campos: [['Número ANTT', 'Número'], ['Situação ANTT', 'Situação', 'antt'], ['Consulta ANTT em', 'Consultada em', 'date']], extra: '<a href="' + ANTT_URL + '" target="_blank" rel="noopener">Consultar no site da ANTT ↗</a>' },
    { k: 'CVV: VIGILANCIA', nome: 'Vigilância Sanitária', tipo: 'VIGILANCIA', link: 'Link Vigilancia', campos: [['CVV: VIGILANCIA', 'Validade', 'date']] },
    { k: 'NADA COSTA', nome: 'Nada Consta', tipo: 'NADA COSTA', link: 'Link Nada Costa', campos: [['NADA COSTA', 'Entregue', 'check'], ['Data Nada Costa', 'Emissão', 'date']] },
    { k: 'RESIDENCIA', nome: 'Comprovante de residência', tipo: 'RESIDENCIA', link: 'Link Residencia', campos: [['RESIDENCIA', 'Entregue', 'check'], ['Data Residência', 'Emissão', 'date']] },
    { k: 'CNH PROPRIETARIO', nome: 'CNH do proprietário', tipo: 'CNH PROPRIETARIO', link: 'Link CNH Proprietário', soDono: true, campos: [['Número CNH Proprietário', 'Número'], ['CNH Validade Proprietário', 'Validade', 'date']] },
    { k: 'CONTRATO PAMC', nome: 'Contrato PAMC', tipo: 'CONTRATO PAMC', link: 'Link Contrato PAMC', word: true, campos: [['CONTRATO PAMC', 'Aceito / assinado', 'check']] }
  ];
  var donoOutro = function (v) { var p = C.semAcento(v['Proprietário']).trim(); return !!p && p !== C.semAcento(v['Motorista']).trim(); };
  function valorTxt(v, c) {
    var x = v[c[0]];
    if (c[2] === 'check') return x === true ? c[1].split(' /')[0] : '';
    if (c[2] === 'date') return x ? c[1].toLowerCase() + ' ' + C.br(x) : '';
    return x ? (c[1] === 'Número' ? 'Nº ' : c[1] + ': ') + x : '';
  }
  function campoHtml(c, v, pre) {
    var n = c[0], val = v[n] == null ? '' : v[n], id = (pre || 'f') + '_' + n.replace(/[^A-Za-z0-9]/g, '');
    if (c[2] === 'check') return '<label class="chk"><input type="checkbox" name="' + esc(n) + '"' + (val === true ? ' checked' : '') + '>' + esc(c[1]) + '</label>';
    var ctl;
    if (c[2] === 'uf') ctl = '<select name="' + esc(n) + '" id="' + id + '">' + opcoes(C.UFS, String(val).toUpperCase()) + '</select>';
    else if (c[2] === 'tipo') ctl = '<select name="' + esc(n) + '" id="' + id + '">' + opcoes(D.tipos, val) + '</select>';
    else if (c[2] === 'pix') ctl = '<select name="' + esc(n) + '" id="' + id + '">' + opcoes(['CPF', 'CNPJ', 'E-mail', 'Celular', 'Chave aleatória'], val) + '</select>';
    else if (c[2] === 'antt') ctl = '<select name="' + esc(n) + '" id="' + id + '"><option value="">Não consultada</option>' + opcoes(['Ativa', 'Inativa', 'Suspensa', 'Cancelada'], val, false) + '</select>';
    else if (c[2] === 'status') ctl = '<select name="' + esc(n) + '" id="' + id + '">' + opcoes(['Ativo', 'Inativo', 'Revisão'], val, false) + '</select>';
    else if (c[2] === 'area') ctl = '<textarea name="' + esc(n) + '" id="' + id + '" rows="3">' + esc(val) + '</textarea>';
    else ctl = '<input name="' + esc(n) + '" id="' + id + '" type="' + (c[2] || 'text') + '" value="' + esc(val) + '"' + (c[3] ? ' placeholder="' + esc(c[3]) + '"' : '') + '>';
    return '<label class="campo"' + (c[2] === 'area' ? ' style="grid-column:1/-1"' : '') + ' for="' + id + '">' + esc(c[1]) + ctl + '</label>';
  }
  function lerForm(f) {
    var d = {};
    f.querySelectorAll('[name]').forEach(function (el) { if (el.type === 'file' || el.type === 'radio') return; d[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    return d;
  }
  function ligarPix(f, suf) {
    var t = f.querySelector('[name="Tipo Chave Pix' + suf + '"]'), k = f.querySelector('[name="Chave Pix' + suf + '"]'); if (!t || !k) return;
    t.addEventListener('change', function () {
      if (k.value.trim()) return;
      var fonte = { 'CPF': 'CPF' + suf, 'CNPJ': 'CPF' + suf, 'E-mail': 'E-mail' + suf, 'Celular': 'Celular' + suf }[t.value];
      var el = fonte && f.querySelector('[name="' + fonte + '"]'); if (el && el.value) k.value = el.value;
    });
  }
  var GRUPOS = [
    ['Motorista', [['COD/FLEX', 'Código Flex'], ['Status', 'Status', 'status'], ['Motorista', 'Nome completo'], ['Data de Nascimento', 'Nascimento', 'date'], ['CPF', 'CPF', 'text', '000.000.000-00'],
      ['Celular', 'Celular', 'tel', '(00) 00000-0000'], ['E-mail', 'E-mail', 'email'], ['Tipo Chave Pix', 'Tipo da chave Pix', 'pix'], ['Chave Pix', 'Chave Pix']]],
    ['Endereço', [['CEP', 'CEP', 'text', '00000-000'], ['Logradouro', 'Rua / avenida'], ['Número Endereço', 'Número'], ['Complemento', 'Complemento'], ['Bairro', 'Bairro'], ['Cidade', 'Cidade'], ['UF', 'UF', 'uf']]],
    ['Veículo', [['Placa Veículo', 'Placa'], ['Tipo de Veículo', 'Tipo de veículo', 'tipo'], ['Marca/Modelo', 'Marca / modelo'], ['Renavam', 'Renavam'], ['Chassi', 'Chassi'], ['Ano Fabricação', 'Ano de fabricação', 'number'], ['Cor', 'Cor'], ['CARGA MÁXIMA (KG)', 'Carga máxima (kg)', 'number']]]
  ];
  var DONO = [['Proprietário', 'Nome ou razão social'], ['CPF Proprietário', 'CPF / CNPJ'], ['Celular Proprietário', 'Celular', 'tel'], ['E-mail Proprietário', 'E-mail', 'email'], ['Tipo Chave Pix Proprietário', 'Tipo da chave Pix', 'pix'],
    ['Chave Pix Proprietário', 'Chave Pix'], ['CEP Proprietário', 'CEP'], ['Logradouro Proprietário', 'Rua / avenida'], ['Número Proprietário', 'Número'], ['Complemento Proprietário', 'Complemento'],
    ['Bairro Proprietário', 'Bairro'], ['Cidade Proprietário', 'Cidade'], ['UF Proprietário', 'UF', 'uf']];
  function formCadastro(v, novo) {
    var g = GRUPOS.map(function (gr) {
      var campos = gr[1].filter(function (c) { return !(novo && c[0] === 'Status'); });
      return '<div class="bloco-tit">' + gr[0] + '</div><div class="grade">' + campos.map(function (c) { return campoHtml(c, v); }).join('') + '</div>';
    }).join('<div class="sep"></div>');
    var outro = donoOutro(v);
    return g + '<div class="sep"></div><div class="linha-flex"><div class="bloco-tit cresce">Proprietário do veículo</div><label class="chk"><input type="checkbox" id="mesmoDono"' + (outro ? '' : ' checked') + '>O proprietário é o próprio motorista</label></div>' +
      '<div id="camposDono" class="' + (outro ? '' : 'oculto') + '"><div class="grade" style="margin-top:8px">' + DONO.map(function (c) { return campoHtml(c, v); }).join('') + '</div>' +
      '<p class="peq suave">O contrato sai no nome do proprietário; o motorista aceita o termo de 1 folha.</p></div>' +
      '<div class="sep"></div><div class="grade">' + campoHtml(['Observações', 'Observações', 'area'], v) + '</div>';
  }
  function ligarFormCadastro(f) {
    C.ligarMascaras(f); C.ligarCep(f, ''); C.ligarCep(f, ' Proprietário'); ligarPix(f, ''); ligarPix(f, ' Proprietário');
    var m = f.querySelector('#mesmoDono'); m.onchange = function () { f.querySelector('#camposDono').classList.toggle('oculto', m.checked); };
  }
  function dadosDoForm(f) {
    var d = lerForm(f);
    if (f.querySelector('#mesmoDono').checked) DONO.forEach(function (c) { d[c[0]] = ''; });
    return d;
  }

  function abrirFicha(box, id, aba) {
    box.innerHTML = '<div class="carregando">Abrindo ficha...</div>';
    api('obterMotorista', '', id).then(function (v) {
      var x = porId(id) || { docs: {}, status: v.Status };
      var pend = SIT.filter(function (s) { return x.docs[s[0]] && x.docs[s[0]].e !== 'ok' && s[0] !== 'CONTRATO PAMC'; }).length;
      var st = ehRevisao(x) ? ['rev', 'Aguardando revisão'] : ehInativo(x) ? ['neutro', 'Inativo'] : ['ok', 'Ativo'];
      var abas = [['docs', 'Documentos' + (pend ? ' · ' + pend + ' pendente' + (pend > 1 ? 's' : '') : '')], ['dados', 'Dados'], ['contrato', 'Contrato'], ['hist', 'Histórico']];
      box.innerHTML = '<div class="cab"><div class="linha-flex" style="align-items:flex-start;gap:16px"><span class="av g">' + esc(iniciais(v.Motorista)) + '</span><div class="cresce">' +
        '<div class="linha-flex"><h2 style="font-size:23px">' + esc(v.Motorista) + '</h2><span class="chip ' + st[0] + '">' + st[1] + '</span>' + (v['COD/FLEX'] ? '<span class="chip neutro">Código ' + esc(v['COD/FLEX']) + '</span>' : '') + '</div>' +
        '<div class="suave peq" style="margin-top:4px">' + esc([v['Tipo de Veículo'], v['Placa Veículo'], v['Marca/Modelo'], v['Ano Fabricação']].filter(Boolean).join(' · ') || 'Veículo não informado') +
        ' · Proprietário: ' + esc(donoOutro(v) ? v['Proprietário'] : 'o próprio motorista') + '</div></div></div>' +
        (ehRevisao(x) ? '<div class="revisao"><div class="cresce"><b>Cadastro recebido pelo link.</b> Confira os dados e os documentos, informe o Código Flex e aprove.</div>' +
          '<label class="campo" style="width:150px;color:inherit">Código Flex<input id="codAprov" inputmode="numeric"></label><button class="btn" id="bAprov">Aprovar</button></div>' : '') +
        '<div class="linha-flex" style="gap:8px">' +
          '<button class="btn" id="bCob">Cobrar documentos' + (pend ? ' (' + pend + ')' : '') + '</button>' +
          '<button class="btn sec" id="bFicha">Imprimir ficha</button><button class="btn sec" id="bCarta">Carta de pendências</button>' +
          '<button class="btn sec" id="bZip">' + ICONE.baixa + 'Arquivos (ZIP)</button>' +
          '<button class="btn sec" id="bPdf">Salvar ficha em PDF no Drive</button>' +
          (ehAdmin() ? '<button class="btn sec" id="bExc" style="color:var(--verm)">Excluir</button>' : '') + '</div>' +
        '<nav class="abas" aria-label="Seções da ficha">' + abas.map(function (a) { return '<a href="#/motoristas/' + encodeURIComponent(id) + '/' + a[0] + '"' + (a[0] === aba ? ' class="on" aria-current="page"' : '') + '>' + esc(a[1]) + '</a>'; }).join('') + '</nav></div>' +
        '<div class="corpo" id="corpoFicha"></div>';
      var corpo = document.getElementById('corpoFicha');
      if (aba === 'dados') abaDados(corpo, id, v);
      else if (aba === 'contrato') abaContrato(corpo, id, v);
      else if (aba === 'hist') abaHistorico(corpo, id);
      else abaDocs(corpo, id, v, x);
      document.getElementById('bCob').onclick = function () { abrirCobranca(id); };
      document.getElementById('bFicha').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true); api('gerarFicha', '', id).then(function (h) { C.imprimir(h); }).catch(erro).then(function () { C.ocupado(b, false); }); };
      document.getElementById('bCarta').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true); api('buscarMotorista', '', id).then(function (m) { C.imprimir(cartaHtml(m)); }).catch(erro).then(function () { C.ocupado(b, false); }); };
      document.getElementById('bZip').onclick = function (e) {
        var b = e.currentTarget; C.ocupado(b, true, 'Juntando...');
        api('baixarArquivos', '', id).then(function (r) {
          if (r.ok) { C.baixarBase64(r.nome, r.base64, 'application/zip'); C.aviso(r.qtd + ' arquivo(s) no ZIP.', 'ok'); }
          else { C.aviso(r.msg, 'erro'); if (r.url) window.open(r.url, '_blank', 'noopener'); }
        }).catch(erro).then(function () { C.ocupado(b, false); });
      };
      document.getElementById('bPdf').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true, 'Gerando...'); api('salvarFichaPdf', '', id).then(function () { C.aviso('Ficha salva em PDF na pasta do motorista.', 'ok'); }).catch(erro).then(function () { C.ocupado(b, false); }); };
      var be = document.getElementById('bExc');
      if (be) be.onclick = function () {
        C.confirmar('Excluir cadastro', 'Os dados de ' + v.Motorista + ' saem da planilha (o código fica reservado como Inativo). Os arquivos continuam no Drive. Não dá para desfazer.', 'Excluir').then(function (s) {
          if (!s) return; api('excluirCadastro', '', id).then(function () { C.aviso('Cadastro excluído.', 'ok'); return carregar(); }).then(function () { ir('#/motoristas'); }).catch(erro);
        });
      };
      var ba = document.getElementById('bAprov');
      if (ba) ba.onclick = function () {
        var cod = document.getElementById('codAprov').value.trim(); if (!cod) { C.aviso('Informe o Código Flex.', 'erro'); return; }
        C.ocupado(ba, true); api('aprovarCadastro', '', id, cod).then(function (r) { C.aviso('Cadastro aprovado com o código ' + cod + '.', 'ok'); return carregar().then(function () { ir('#/motoristas/' + encodeURIComponent(r.id) + '/docs'); }); })
          .catch(function (e) { C.ocupado(ba, false); erro(e); });
      };
    }).catch(function (e) { box.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }

  function abaDocs(corpo, id, v, x) {
    var defs = DOC_DEF.filter(function (d) { return !d.soDono || donoOutro(v); });
    corpo.innerHTML = defs.map(function (d, i) {
      var s = d.k === 'CNH PROPRIETARIO' ? sitValidade(v['CNH Validade Proprietário']) : sit(x.docs[d.k], d.k);
      if (s.cls === 'falta' && v[d.link] && d.k !== 'CONTRATO PAMC' && s.txt === 'Faltando') s = { cls: 'vence', txt: 'Arquivo ok, falta a data' };
      var info = d.campos.map(function (c) { return valorTxt(v, c); }).filter(Boolean).join(' · ');
      var msg = x.docs[d.k] && x.docs[d.k].m && x.docs[d.k].e !== 'ok' ? curto(x.docs[d.k].m) : '';
      return '<div class="doc"><div class="l1"><div class="cresce"><div class="nome">' + esc(d.nome) + '</div><div class="info">' + esc(info || 'Nada informado') + (msg ? '<br>' + esc(msg) : '') + '</div></div>' +
        '<span class="chip ' + s.cls + '">' + esc(s.txt) + '</span>' +
        (v[d.link] ? '<a class="btn sec peq" href="' + esc(v[d.link]) + '" target="_blank" rel="noopener">Ver arquivo</a>' : '<span class="mini suave" style="width:84px;text-align:center">sem arquivo</span>') +
        (d.k === 'ANTT' ? '<button class="btn sec peq" data-antt="' + esc(String(v['Número ANTT'] || v['CPF Proprietário'] || v['CPF'] || '').replace(/\D/g, '')) + '">Consultar na ANTT ↗</button>' : '') +
        '<button class="btn sec peq" data-ed="' + i + '" aria-expanded="false">Editar</button></div>' +
        '<form class="oculto" data-f="' + i + '"><div class="grade">' + d.campos.map(function (c) { return campoHtml(c, v, 'd' + i); }).join('') + '</div>' + (d.extra || '') +
        '<label class="campo">' + (v[d.link] ? 'Trocar arquivo' : 'Anexar arquivo') + ' (' + (d.word ? 'PDF ou Word' : 'PDF ou foto — foto vira PDF') + ')<input type="file" ' + (d.word ? 'accept=".pdf,.doc,.docx"' : 'accept="application/pdf,image/*"') + '></label>' +
        '<div class="linha-flex"><button class="btn" type="submit">Salvar</button><button class="btn sec" type="button" data-canc>Cancelar</button></div></form></div>';
    }).join('');
    corpo.querySelectorAll('[data-antt]').forEach(function (b) { b.onclick = function () { consultarAntt(b.dataset.antt); }; });
    corpo.querySelectorAll('[data-ed]').forEach(function (b) {
      b.onclick = function () { var f = corpo.querySelector('[data-f="' + b.dataset.ed + '"]'); f.classList.toggle('oculto'); b.setAttribute('aria-expanded', String(!f.classList.contains('oculto'))); };
    });
    corpo.querySelectorAll('form[data-f]').forEach(function (f) {
      var d = defs[+f.dataset.f], arq = f.querySelector('input[type=file]'), chk = d.campos[0][2] === 'check' ? f.querySelector('[name="' + d.campos[0][0] + '"]') : null;
      if (chk) arq.addEventListener('change', function () { if (arq.files[0]) chk.checked = true; });
      f.querySelector('[data-canc]').onclick = function () { f.classList.add('oculto'); };
      f.onsubmit = function (e) {
        e.preventDefault();
        var bt = f.querySelector('[type=submit]'); C.ocupado(bt, true, 'Salvando...');
        var dados = lerForm(f); dados.Motorista = v.Motorista;
        (arq.files[0] ? C.prepararArquivo(arq.files[0], d.tipo, d.word).then(function (a) { return [a]; }) : Promise.resolve([]))
          .then(function (arqs) { return api('atualizarCadastro', '', id, dados, arqs); })
          .then(function (r) { C.aviso(d.nome + ' atualizado.', 'ok'); return carregar().then(function () { ir('#/motoristas/' + encodeURIComponent(r.id) + '/docs'); }); })
          .catch(function (e2) { C.ocupado(bt, false); erro(e2); });
      };
    });
  }
  // Abre a Consulta Pública da ANTT e copia o RNTRC (ou CPF/CNPJ) para colar no campo; o "não sou um robô" é marcado por você
  function consultarAntt(numero) {
    window.open(ANTT_URL, '_blank', 'noopener');
    if (numero && navigator.clipboard) navigator.clipboard.writeText(numero).then(function () { C.aviso('Número ' + numero + ' copiado: cole no campo da ANTT. Depois, registre a situação em Editar.', 'ok'); }, function () {});
    else C.aviso('Depois de consultar, registre a situação da ANTT em Editar.');
  }
  function sitValidade(iso) {
    if (!iso) return { cls: 'falta', txt: 'Faltando' };
    var d = Math.round((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
    return d < 0 ? { cls: 'vencido', txt: 'Vencida' } : d <= 30 ? { cls: 'vence', txt: 'Vence em ' + d + ' dias' } : { cls: 'ok', txt: 'Em dia' };
  }

  function abaDados(corpo, id, v) {
    corpo.innerHTML = '<form id="fDados">' + formCadastro(v) + '<div class="acoes-dir"><button class="btn" type="submit">Salvar alterações</button></div></form>';
    var f = document.getElementById('fDados'); ligarFormCadastro(f);
    f.onsubmit = function (e) {
      e.preventDefault();
      var d = dadosDoForm(f); if (!d.Motorista) { C.aviso('Informe o nome do motorista.', 'erro'); return; }
      var bt = f.querySelector('[type=submit]'); C.ocupado(bt, true, 'Salvando...');
      api('atualizarCadastro', '', id, d, []).then(function (r) { C.aviso('Alterações salvas.', 'ok'); return carregar().then(function () { ir('#/motoristas/' + encodeURIComponent(r.id) + '/dados'); }); })
        .catch(function (e2) { C.ocupado(bt, false); erro(e2); });
    };
  }

  function abaContrato(corpo, id, v) {
    corpo.innerHTML = '<div class="carregando">Carregando contrato...</div>';
    var quais = donoOutro(v) ? ['contrato', 'termo'] : ['contrato'];
    Promise.all(quais.map(function (q) { return api('contratoAdmin', '', id, q); })).then(function (rs) {
      corpo.innerHTML = rs.map(function (r, i) {
        var nome = quais[i] === 'termo' ? 'Termo do motorista (1 folha)' : 'Contrato de transporte' + (r.outro ? ' — no nome de ' + r.proprietario : '');
        var falta = (r.faltandoMotorista || []).concat((r.faltandoEmpresa || []).map(function (f) { return 'empresa: ' + f; }));
        return '<div class="cartao" style="margin-bottom:16px"><div class="linha-flex"><h3 class="cresce" style="font-size:16px">' + esc(nome) + '</h3>' +
          '<span class="chip ' + (r.aceitou ? 'ok' : 'falta') + '">' + (r.aceitou ? 'Aceito' + (r.aceite ? ' em ' + esc(r.aceite) : '') : 'Sem aceite') + '</span></div>' +
          (falta.length ? '<p class="peq" style="color:var(--ve)">Faltam dados para gerar: ' + esc(falta.join(', ')) + '.</p>' : '') + (r.erro ? '<p class="peq" style="color:var(--ve)">' + esc(r.erro) + '</p>' : '') +
          '<div class="linha-flex" style="margin-top:12px"><button class="btn sec" data-ler="' + i + '"' + (r.html ? '' : ' disabled') + '>Ler</button>' +
          '<button class="btn" data-dl="' + quais[i] + '|docx"' + (falta.length ? ' disabled' : '') + '>Baixar DOCX (cartório)</button>' +
          '<button class="btn sec" data-dl="' + quais[i] + '|pdf"' + (falta.length ? ' disabled' : '') + '>Baixar PDF</button>' +
          '<button class="btn sec" data-pasta="' + quais[i] + '"' + (falta.length ? ' disabled' : '') + '>Salvar na pasta</button>' +
          (r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener">Arquivo salvo ↗</a>' : '') + '</div></div>';
      }).join('') + '<p class="peq suave">A data do documento é a do dia em que ele é gerado. O DOCX sai idêntico ao modelo enviado em Configurações.</p>';
      corpo.querySelectorAll('[data-ler]').forEach(function (b) { b.onclick = function () { C.janela('Leitura', '<div class="contrato-txt">' + rs[+b.dataset.ler].html + '</div>', { largura: 820 }); }; });
      corpo.querySelectorAll('[data-dl]').forEach(function (b) {
        b.onclick = function () { var p = b.dataset.dl.split('|'); C.ocupado(b, true, 'Gerando...');
          api('baixarContrato', '', id, p[1], p[0]).then(function (r) { C.baixarBase64(r.nome, r.base64, r.mime); }).catch(erro).then(function () { C.ocupado(b, false); }); };
      });
      corpo.querySelectorAll('[data-pasta]').forEach(function (b) {
        b.onclick = function () { C.ocupado(b, true, 'Salvando...');
          api('salvarContratoPasta', '', id, b.dataset.pasta).then(function () { C.aviso('Salvo na pasta do Drive.', 'ok'); abaContrato(corpo, id, v); }).catch(function (e) { C.ocupado(b, false); erro(e); }); };
      });
    }).catch(function (e) { corpo.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }

  function abaHistorico(corpo, id) {
    corpo.innerHTML = '<div class="carregando">Carregando histórico...</div>';
    api('historico', '', id).then(function (h) {
      corpo.innerHTML = h.length ? h.map(function (x) {
        return '<div class="hist"><span class="q">' + esc(quando(x.quando)) + '</span><div><b>' + esc(x.usuario) + '</b> · ' + esc(x.acao) + (x.detalhes ? '<div class="peq suave" style="margin-top:3px;word-break:break-word">' + esc(x.detalhes).replace(/ \| /g, '<br>') + '</div>' : '') + '</div></div>';
      }).join('') : '<div class="vazio">Sem registros ainda.</div>';
    }).catch(function (e) { corpo.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }

  function cartaHtml(m) {
    var itens = m.pendencias.map(function (t) { return '<div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid #ddd;font-size:13px"><span style="width:11px;height:11px;border:1px solid #444;flex:none"></span>' + esc(t) + '</div>'; });
    if (!itens.length) itens.push('<div style="padding:10px;text-align:center;color:#1F5A33">Nenhuma pendência — documentação em dia.</div>');
    var logo = '<img src="' + (D.logo || new URL('logo.png', location.href).href) + '" style="max-height:52px;max-width:200px">';
    return '<div style="font-family:Arial,sans-serif;color:#111;padding:28px 34px;max-width:720px;margin:auto">' + logo +
      '<h1 style="font-size:20px;margin:22px 0 10px">' + esc(m.nome) + '</h1>' +
      '<div style="display:flex;gap:40px;font-size:13px;margin-bottom:16px"><div><b>CPF:</b> ' + esc(m.cpf) + '<br><b>Nascimento:</b> ' + esc(m.nasc) + '</div><div><b>Placa:</b> ' + esc(String(m.placa).toUpperCase()) + '<br><b>Veículo:</b> ' + esc(String(m.veiculo).toUpperCase()) + '</div></div>' +
      '<p style="font-size:13px">Para manter nossos registros em conformidade e garantir que você possa continuar realizando suas atividades normalmente, solicitamos que envie os documentos listados abaixo atualizados:</p>' +
      '<h3 style="font-size:14px;margin:16px 0 6px">Documentos vencidos ou faltando</h3>' + itens.join('') +
      '<p style="font-size:13px;margin-top:24px">Agradecemos sua atenção e colaboração.</p>' +
      '<div style="text-align:center;font-size:13px;margin-top:34px">Atenciosamente,<br>' + esc(m.assinatura.nome) + '<br>' + esc(m.assinatura.cargo) + '<br>' + esc(m.assinatura.empresa) + '</div>' +
      '<div style="text-align:right;font-size:10px;margin-top:20px">' + new Date().toLocaleDateString('pt-BR') + '</div></div>';
  }

  // ---------------------------------------------------------------- cobrança
  var COB = [['CNH-DATA DE VALIDADE', 'CNH do motorista'], ['CRLV', 'CRLV do veículo'], ['ANTT', 'ANTT (RNTRC)'], ['CVV: VIGILANCIA', 'Vigilância Sanitária'], ['NADA COSTA', 'Nada Consta'], ['RESIDENCIA', 'Comprovante de residência'], ['CNH PROPRIETARIO', 'CNH do proprietário']];
  function abrirCobranca(id) {
    var x = porId(id) || { docs: {} };
    var j = C.janela('Cobrar documentos · ' + (x.motorista || ''), '<div class="carregando">Carregando...</div>');
    api('obterMotorista', '', id).then(function (v) {
      var lista = COB.filter(function (c) { return c[0] !== 'CNH PROPRIETARIO' || donoOutro(v); });
      j.el.innerHTML = '<p class="peq suave" style="margin-top:0">O motorista recebe um link pessoal para enviar só estes documentos, sem login.</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;margin:12px 0 16px">' + lista.map(function (c) {
          var s = x.docs[c[0]], marcado = c[0] === 'CNH PROPRIETARIO' ? !v['Link CNH Proprietário'] : (s && s.e !== 'ok');
          return '<label class="chk"><input type="checkbox" value="' + esc(c[0]) + '"' + (marcado ? ' checked' : '') + '>' + esc(c[1]) + (s && s.e !== 'ok' ? ' <span class="chip ' + sit(s, c[0]).cls + '">' + esc(sit(s, c[0]).txt) + '</span>' : '') + '</label>';
        }).join('') + '</div>' +
        (v['E-mail'] ? '<label class="chk" style="margin-bottom:6px"><input type="checkbox" id="cobEmail" checked>Enviar por e-mail para ' + esc(v['E-mail']) + '</label>' : '<p class="peq suave">Sem e-mail cadastrado: use o WhatsApp ou copie o link.</p>') +
        '<div class="acoes-dir"><button class="btn sec" data-fechar>Cancelar</button><button class="btn" id="cobGerar">Gerar link</button></div>';
      document.getElementById('cobGerar').onclick = function (e) {
        var docs = Array.prototype.map.call(j.el.querySelectorAll('input[type=checkbox][value]:checked'), function (i) { return i.value; });
        if (!docs.length) { C.aviso('Escolha pelo menos um documento.', 'erro'); return; }
        var em = document.getElementById('cobEmail'); C.ocupado(e.currentTarget, true, 'Gerando...');
        api('criarCobranca', '', id, docs, !!(em && em.checked), C.base()).then(function (r) {
          j.el.innerHTML = '<p style="margin-top:0">Link criado. Ele vale até <b>' + new Date(r.expira).toLocaleDateString('pt-BR') + '</b>.</p>' +
            (r.emailEnviado ? '<p class="chip ok">E-mail enviado para ' + esc(r.email) + '</p>' : r.erroEmail ? '<p class="chip falta">E-mail não enviado: ' + esc(r.erroEmail) + '</p>' : '') +
            '<label class="campo" style="margin:12px 0">Link do motorista<input readonly value="' + esc(r.link) + '" id="cobLink"></label>' +
            '<div class="linha-flex">' + (r.whatsapp ? '<a class="btn" style="background:#1E7E45" href="' + esc(r.whatsapp) + '" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>' : '<span class="peq suave">Sem celular cadastrado para o WhatsApp.</span>') +
            '<button class="btn sec" id="cobCopiar">Copiar mensagem</button></div>';
          document.getElementById('cobCopiar').onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(r.texto) : Promise.reject()).then(function () { C.aviso('Mensagem copiada.', 'ok'); }, function () { var i = document.getElementById('cobLink'); i.select(); document.execCommand('copy'); C.aviso('Link copiado.', 'ok'); }); };
          carregar();
        }).catch(function (e2) { erro(e2); var b = document.getElementById('cobGerar'); if (b) C.ocupado(b, false); });
      };
    }).catch(function (e) { j.el.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }

  // ================================================================ NOVO MOTORISTA
  function telaNovo() {
    tela.innerHTML = '<div class="topo"><div class="cresce"><a href="#/motoristas" class="peq">‹ Motoristas</a><h1>Novo motorista</h1></div></div>' +
      '<form class="cartao" id="fNovo">' + formCadastro({}, true) + '<p class="peq suave">Depois de salvar, a ficha abre para você anexar os documentos. Para o próprio motorista se cadastrar, envie o link de cadastro (Configurações › Backup e links).</p>' +
      '<div class="acoes-dir"><a class="btn sec" href="#/motoristas">Cancelar</a><button class="btn" type="submit">Salvar cadastro</button></div></form>';
    var f = document.getElementById('fNovo'); ligarFormCadastro(f);
    f.onsubmit = function (e) {
      e.preventDefault();
      var d = dadosDoForm(f);
      if (!d.Motorista) { C.aviso('Informe o nome do motorista.', 'erro'); return; }
      if (!d['COD/FLEX']) { C.aviso('Informe o Código Flex.', 'erro'); return; }
      var bt = f.querySelector('[type=submit]'); C.ocupado(bt, true, 'Salvando...');
      api('salvarCadastro', d, [], '').then(function (r) {
        if (r.aviso) C.aviso(r.aviso);
        C.aviso('Cadastro salvo.', 'ok');
        return carregar().then(function () { ir('#/motoristas/' + encodeURIComponent(d['COD/FLEX']) + '/docs'); });
      }).catch(function (e2) { C.ocupado(bt, false); erro(e2); });
    };
  }

  // ================================================================ IMPORTAR / EXPORTAR
  var IMP = null;
  function telaImportar() {
    tela.innerHTML = '<div class="topo"><div class="cresce"><a href="#/motoristas" class="peq">‹ Motoristas</a><h1>Importar e exportar planilha</h1></div></div>' +
      '<div class="duas"><section class="cartao prin" id="impBox"></section><section class="cartao lat" id="expBox" style="display:block"></section></div>';
    desenharExportar(document.getElementById('expBox'));
    var box = document.getElementById('impBox');
    if (!ehAdmin()) { box.innerHTML = '<h2>Importar cadastros</h2><p class="suave">Só administradores podem importar planilhas.</p>'; return; }
    IMP = null; desenharImportar(box);
  }
  function desenharImportar(box) {
    var etapa = !IMP ? 1 : IMP.conf ? 3 : 2;
    var passos = ['Escolher arquivo', 'Colunas', 'Conferir e importar'].map(function (t, i) {
      var on = i + 1 === etapa, feito = i + 1 < etapa;
      return '<li style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;font-weight:600;background:' + (on ? 'var(--azul)' : feito ? 'var(--azul-cl)' : 'var(--fundo)') + ';color:' + (on ? '#fff' : feito ? '#1B3F86' : 'var(--suave)') + '">' + (i + 1) + '. ' + t + '</li>';
    }).join('');
    var h = '<div class="linha-flex" style="margin-bottom:12px"><h2 class="cresce sec-tit">Importar cadastros</h2><button class="btn sec peq" id="bModelo">' + ICONE.baixa + 'Planilha modelo (.xlsx)</button></div>' +
      '<ol style="list-style:none;padding:0;margin:0 0 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:13px">' + passos + '</ol>';
    if (etapa === 1) {
      h += '<label class="campo" style="font-size:14px">Arquivo .xlsx ou .csv (do Excel ou do Google Planilhas: Arquivo › Fazer download)<input type="file" id="impArq" accept=".xlsx,.csv,.txt"></label>' +
        '<p class="peq suave">A primeira linha com conteúdo deve ter os títulos das colunas. O sistema reconhece os nomes sozinho e pergunta só o que não entender.</p>';
      box.innerHTML = h;
      document.getElementById('impArq').onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        box.querySelector('p').textContent = 'Lendo ' + f.name + '...';
        C.lerBase64(f).then(function (b) { return api('importarLer', '', b, f.name); }).then(function (r) { IMP = r; IMP.nome = f.name; IMP.mapa = r.sugestao.slice(); desenharImportar(box); })
          .catch(function (e2) { erro(e2); desenharImportar(box); });
      };
    } else if (etapa === 2) {
      var opc = function (atual) { return '<option value="">(ignorar esta coluna)</option>' + IMP.colunas.map(function (c) { return '<option' + (c === atual ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join(''); };
      var reconhecidas = IMP.mapa.filter(Boolean).length;
      h += '<p><b>' + esc(IMP.nome) + '</b> · ' + IMP.linhas.length + ' linhas · ' + reconhecidas + ' de ' + IMP.cabecalho.length + ' colunas reconhecidas</p>' +
        '<div class="tab-box"><table class="t"><thead><tr><th>Coluna no arquivo</th><th>Exemplo</th><th>Vai para</th></tr></thead><tbody>' +
        IMP.cabecalho.map(function (c, i) { return '<tr><td><b>' + esc(c || '(sem título)') + '</b></td><td class="suave">' + esc((IMP.linhas[0] || [])[i] || '') + '</td><td><select data-col="' + i + '" aria-label="Destino da coluna ' + esc(c) + '"' + (IMP.mapa[i] ? '' : ' style="border-color:var(--verm)"') + '>' + opc(IMP.mapa[i]) + '</select></td></tr>'; }).join('') +
        '</tbody></table></div><div class="acoes-dir"><button class="btn sec" id="impVolta">Trocar arquivo</button><button class="btn" id="impConf">Conferir</button></div>';
      box.innerHTML = h;
      box.querySelectorAll('[data-col]').forEach(function (s) { s.onchange = function () { IMP.mapa[+s.dataset.col] = s.value; }; });
      document.getElementById('impVolta').onclick = function () { IMP = null; desenharImportar(box); };
      document.getElementById('impConf').onclick = function (e) {
        var usados = IMP.mapa.filter(Boolean); if (usados.indexOf('Motorista') < 0) { C.aviso('Escolha qual coluna é o nome do motorista.', 'erro'); return; }
        var rep = usados.filter(function (c, i) { return usados.indexOf(c) !== i; }); if (rep.length) { C.aviso('A coluna "' + rep[0] + '" foi escolhida duas vezes.', 'erro'); return; }
        C.ocupado(e.currentTarget, true, 'Conferindo...');
        api('importarConferir', '', IMP.linhas, IMP.mapa).then(function (r) { IMP.conf = r; desenharImportar(box); }).catch(function (e2) { erro(e2); desenharImportar(box); });
      };
    } else {
      var c = IMP.conf, res = { novo: ['ok', 'Novo'], existe: ['rev', 'Já existe'], erro: ['falta', 'Erro'] };
      h += '<div class="linha-flex" style="margin-bottom:12px"><span class="chip ok">' + c.novos + ' novos</span><span class="chip rev">' + c.existem + ' já existem (mesmo CPF ou código)</span><span class="chip falta">' + c.erros + ' com erro</span></div>' +
        '<div class="tab-box" style="max-height:360px;overflow:auto"><table class="t"><thead><tr><th>Linha</th><th>Motorista</th><th>CPF</th><th>Placa</th><th>Proprietário</th><th>Resultado</th></tr></thead><tbody>' +
        c.linhas.map(function (l) { return '<tr><td class="suave">' + (l.n + IMP.primeiraLinha) + '</td><td><b>' + esc(l.nome || '—') + '</b></td><td>' + esc(l.cpf) + '</td><td>' + esc(l.placa) + '</td><td>' + esc(l.dono || '—') + '</td><td><span class="chip ' + res[l.res][0] + '">' + res[l.res][1] + (l.msg ? ': ' + esc(l.msg) : '') + '</span></td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<fieldset style="border:0;padding:0;margin:16px 0 0;display:flex;flex-direction:column;gap:8px"><legend style="font-weight:600;margin-bottom:8px">Quando o cadastro já existir</legend>' +
        '<label class="chk"><input type="radio" name="modo" value="completar" checked>Completar só os campos vazios (recomendado)</label>' +
        '<label class="chk"><input type="radio" name="modo" value="substituir">Substituir pelos dados da planilha</label>' +
        '<label class="chk"><input type="radio" name="modo" value="pular">Pular</label></fieldset>' +
        '<p class="peq suave">Antes de importar o sistema faz um backup automático. As linhas com erro ficam de fora.</p>' +
        '<div class="acoes-dir"><button class="btn sec" id="impVolta">Voltar às colunas</button><button class="btn" id="impOk"' + (c.novos + c.existem ? '' : ' disabled') + '>Importar ' + (c.novos + c.existem) + ' cadastro(s)</button></div>';
      box.innerHTML = h;
      document.getElementById('impVolta').onclick = function () { IMP.conf = null; desenharImportar(box); };
      document.getElementById('impOk').onclick = function (e) {
        var modo = box.querySelector('[name=modo]:checked').value; C.ocupado(e.currentTarget, true, 'Importando...');
        api('importarAplicar', '', IMP.linhas, IMP.mapa, modo).then(function (r) {
          box.innerHTML = '<h2 class="sec-tit">Importação concluída</h2><p>' + r.novos + ' novo(s), ' + r.atualizados + ' atualizado(s), ' + r.pulados + ' sem mudança, ' + r.erros.length + ' com erro.</p>' +
            (r.erros.length ? '<div class="tab-box"><table class="t"><thead><tr><th>Linha</th><th>Nome</th><th>Problema</th></tr></thead><tbody>' + r.erros.map(function (x) { return '<tr><td>' + (x.linha + IMP.primeiraLinha) + '</td><td>' + esc(x.nome || '—') + '</td><td>' + esc(x.msg) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
            '<div class="acoes-dir"><button class="btn sec" id="impNovo">Importar outro arquivo</button><a class="btn" href="#/motoristas">Ver motoristas</a></div>';
          document.getElementById('impNovo').onclick = function () { IMP = null; desenharImportar(box); };
          carregar();
        }).catch(function (e2) { erro(e2); C.ocupado(e.currentTarget, false); });
      };
    }
    var bm = document.getElementById('bModelo');
    if (bm) bm.onclick = function () { C.ocupado(bm, true); api('exportar', '', 'modelo', 'xlsx', {}).then(function (r) { C.baixarBase64(r.nome, r.base64, r.mime); }).catch(erro).then(function () { C.ocupado(bm, false); }); };
  }
  function desenharExportar(box) {
    var nFiltro = filtrados().length;
    box.innerHTML = '<h2 class="sec-tit" style="margin-bottom:12px">Exportar</h2>' +
      '<fieldset style="border:0;padding:0;margin:0 0 14px;display:flex;flex-direction:column;gap:8px"><legend class="peq suave" style="font-weight:600;margin-bottom:6px">Quais cadastros</legend>' +
      '<label class="chk"><input type="radio" name="ef" value="todos" checked>Todos (' + D.cadastros.length + ')</label>' +
      '<label class="chk"><input type="radio" name="ef" value="ativos">Só os ativos</label>' +
      '<label class="chk"><input type="radio" name="ef" value="pendencia">Só com pendência</label>' +
      '<label class="chk"><input type="radio" name="ef" value="filtro">Os da lista filtrada (' + nFiltro + ')</label></fieldset>' +
      '<fieldset style="border:0;padding:0;margin:0 0 14px;display:flex;flex-direction:column;gap:8px"><legend class="peq suave" style="font-weight:600;margin-bottom:6px">Formato</legend>' +
      '<label class="chk"><input type="radio" name="ex" value="xlsx" checked>Excel (.xlsx)</label><label class="chk"><input type="radio" name="ex" value="csv">CSV</label></fieldset>' +
      '<label class="chk" style="margin-bottom:8px"><input type="checkbox" id="exSit" checked>Incluir situação dos documentos</label>' +
      '<label class="chk" style="margin-bottom:16px"><input type="checkbox" id="exLinks">Incluir links dos arquivos no Drive</label>' +
      '<button class="btn perigo" id="exOk" style="width:100%">' + ICONE.baixa + 'Baixar planilha</button>' +
      '<p class="mini suave">A planilha usa as mesmas colunas da planilha modelo: dá para editar e importar de volta.</p>';
    document.getElementById('exOk').onclick = function (e) {
      var f = box.querySelector('[name=ef]:checked').value, filtro = f === 'filtro' ? filtrados().map(function (x) { return x.id; }) : f;
      C.ocupado(e.currentTarget, true, 'Gerando...');
      api('exportar', '', filtro, box.querySelector('[name=ex]:checked').value, { situacao: document.getElementById('exSit').checked, links: document.getElementById('exLinks').checked })
        .then(function (r) { C.baixarBase64(r.nome, r.base64, r.mime); C.aviso(r.qtd + ' cadastro(s) exportado(s).', 'ok'); }).catch(erro).then(function () { C.ocupado(e.currentTarget, false); });
    };
  }

  // ================================================================ CONFIGURAÇÕES
  var CFG = null;
  function telaConfig(aba) {
    if (!ehAdmin()) { tela.innerHTML = '<div class="vazio"><h2>Sem permissão</h2><p>As configurações são só para administradores.</p></div>'; return; }
    var abas = [['empresa', 'Empresa e assinaturas'], ['prazos', 'Prazos e documentos'], ['usuarios', 'Usuários'], ['contratos', 'Contratos'], ['backup', 'Backup, e-mail e links']];
    tela.innerHTML = '<div class="topo"><h1 class="cresce">Configurações</h1></div><nav class="linha-flex" style="gap:6px;margin-bottom:18px" aria-label="Seções">' +
      abas.map(function (a) { return '<a class="pill' + (a[0] === aba ? ' on' : '') + '"' + (a[0] === aba ? ' aria-current="page"' : '') + ' href="#/config/' + a[0] + '">' + a[1] + '</a>'; }).join('') + '</nav><div id="cfgBox"><div class="carregando">Carregando...</div></div>';
    var box = document.getElementById('cfgBox');
    api('obterConfig', '').then(function (c) {
      CFG = c;
      ({ empresa: cfgEmpresa, prazos: cfgPrazos, usuarios: cfgUsuarios, contratos: cfgContratos, backup: cfgBackup }[aba] || cfgEmpresa)(box);
    }).catch(function (e) { box.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }
  function salvarCfg(parcial, btn, msg) {
    C.ocupado(btn, true, 'Salvando...');
    return api('salvarConfig', '', parcial).then(function (r) { C.aviso(msg || 'Salvo.', 'ok'); carregar(); return r; }).catch(erro).then(function (r) { C.ocupado(btn, false); return r; });
  }
  function cfgEmpresa(box) {
    var f = CFG.funcionarios.map(function (x) { return Object.assign({}, x); }), ativo = CFG.ativo, tt = (CFG.testemunhas || [-1, -1]).slice();
    function des() {
      var opts = function (sel) { return '<option value="-1">Escolha</option>' + f.map(function (x, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(x.nome || '(sem nome)') + '</option>'; }).join(''); };
      box.innerHTML = '<div class="duas"><section class="cartao prin"><h2 style="margin-bottom:12px">Empresa e funcionários</h2>' +
        '<label class="campo" style="max-width:420px">Nome da empresa (rodapé das cartas)<input id="cEmp" value="' + esc(CFG.empresa) + '"></label>' +
        '<div class="tab-box" style="margin-top:16px"><table class="t"><thead><tr><th>Nome</th><th>Cargo</th><th>CPF</th><th>Assina as cartas</th><th></th></tr></thead><tbody>' +
        f.map(function (x, i) { return '<tr><td><input data-i="' + i + '" data-k="nome" value="' + esc(x.nome) + '" aria-label="Nome"></td><td><input data-i="' + i + '" data-k="cargo" value="' + esc(x.cargo) + '" aria-label="Cargo"></td><td><input data-i="' + i + '" data-k="cpf" name="cpf" value="' + esc(x.cpf || '') + '" aria-label="CPF"></td>' +
          '<td style="text-align:center"><input type="radio" name="ativo" value="' + i + '"' + (i === ativo ? ' checked' : '') + ' aria-label="Assina"></td><td><button class="ic-btn" data-del="' + i + '" aria-label="Remover">✕</button></td></tr>'; }).join('') +
        '</tbody></table></div><button class="btn sec peq" id="cAdd" style="margin-top:10px">' + ICONE.mais + 'Adicionar funcionário</button>' +
        '<div class="grade" style="margin-top:16px"><label class="campo">Testemunha 1 do contrato<select id="t0">' + opts(tt[0]) + '</select></label><label class="campo">Testemunha 2 do contrato<select id="t1">' + opts(tt[1]) + '</select></label></div>' +
        '<div class="acoes-dir"><button class="btn" id="cSalvar">Salvar</button></div></section>' +
        '<section class="cartao lat" style="display:block"><h2 style="margin-bottom:12px">Logo</h2>' + (CFG.logo ? '<img src="' + CFG.logo + '" alt="Logo atual" style="max-width:100%;max-height:120px;display:block;margin-bottom:12px">' : '<p class="suave">Sem logo: as cartas mostram o nome da empresa.</p>') +
        '<label class="campo">Anexar imagem (PNG, JPG, SVG...)<input type="file" id="cLogo" accept="image/*"></label>' + (CFG.logo ? '<button class="btn sec peq" id="cRemLogo" style="margin-top:10px;color:var(--verm)">Remover logo</button>' : '') + '</section></div>';
      C.ligarMascaras(box);
      box.querySelectorAll('[data-i]').forEach(function (i) { i.oninput = function () { f[+i.dataset.i][i.dataset.k] = i.value; }; });
      box.querySelectorAll('[name=ativo]').forEach(function (r) { r.onchange = function () { ativo = +r.value; }; });
      box.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { f.splice(+b.dataset.del, 1); ativo = 0; tt = [-1, -1]; des(); }; });
      document.getElementById('t0').onchange = function (e) { tt[0] = +e.target.value; };
      document.getElementById('t1').onchange = function (e) { tt[1] = +e.target.value; };
      document.getElementById('cAdd').onclick = function () { f.push({ nome: '', cargo: '', cpf: '' }); des(); };
      document.getElementById('cSalvar').onclick = function (e) {
        salvarCfg({ empresa: document.getElementById('cEmp').value, funcionarios: f, ativo: ativo, testemunhas: tt }, e.currentTarget).then(function () { return api('obterConfig', ''); }).then(function (c) { if (c) { CFG = c; } });
      };
      document.getElementById('cLogo').onchange = function (e) {
        var file = e.target.files[0]; if (!file) return;
        var img = new Image(), url = URL.createObjectURL(file);
        img.onerror = function () { C.aviso('Não consegui abrir essa imagem.', 'erro'); };
        img.onload = function () {
          var k = Math.min(1, 600 / Math.max(img.naturalWidth || 600, img.naturalHeight || 600)), cv = document.createElement('canvas');
          cv.width = Math.round((img.naturalWidth || 600) * k); cv.height = Math.round((img.naturalHeight || 300) * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
          api('salvarLogo', '', cv.toDataURL('image/png').split(',')[1]).then(function (r) { CFG.logo = r.logo; C.aviso('Logo salva.', 'ok'); carregar(); des(); }).catch(erro);
        };
        img.src = url;
      };
      var rl = document.getElementById('cRemLogo'); if (rl) rl.onclick = function () { api('removerLogo', '').then(function () { CFG.logo = ''; carregar(); des(); }).catch(erro); };
    }
    des();
  }
  function cfgPrazos(box) {
    var p = CFG.prazos || {}, tipos = CFG.tipos.slice(), cal = null;
    box.innerHTML = '<div class="duas"><section class="cartao prin" id="calBox"><div class="carregando">Carregando calendário...</div></section><div class="lat">' +
      '<section class="cartao"><h2 style="margin-bottom:12px">Validades e prazos (dias)</h2><div style="display:flex;flex-direction:column;gap:10px">' +
      [['NADA COSTA', 'Nada Consta vale'], ['RESIDENCIA', 'Comprovante de residência vale'], ['ANTT', 'Reconsultar ANTT a cada'], ['COBRANCA', 'Link de cobrança vale']].map(function (x) {
        return '<label class="linha-flex" style="justify-content:space-between;font-size:14px">' + x[1] + '<input type="number" min="0" data-p="' + x[0] + '" value="' + (p[x[0]] != null ? p[x[0]] : (x[0] === 'COBRANCA' ? 7 : 0)) + '" style="width:90px"></label>'; }).join('') +
      '</div><p class="mini suave">0 = sem prazo (Nada Consta e residência valem só por estarem entregues).</p><div class="acoes-dir"><button class="btn" id="pSalvar">Salvar prazos</button></div></section>' +
      '<section class="cartao"><h2 style="margin-bottom:12px">Tipos de veículo</h2><div id="tipos"></div><button class="btn sec peq" id="tAdd">' + ICONE.mais + 'Adicionar tipo</button><div class="acoes-dir"><button class="btn" id="tSalvar">Salvar tipos</button></div></section></div></div>';
    function desTipos() {
      document.getElementById('tipos').innerHTML = tipos.map(function (t, i) { return '<div class="linha-flex" style="margin-bottom:6px"><input value="' + esc(t) + '" data-t="' + i + '" aria-label="Tipo" class="cresce" style="width:auto;flex:1"><button class="ic-btn" data-dt="' + i + '" aria-label="Remover tipo">✕</button></div>'; }).join('');
      box.querySelectorAll('[data-t]').forEach(function (i) { i.oninput = function () { tipos[+i.dataset.t] = i.value; }; });
      box.querySelectorAll('[data-dt]').forEach(function (b) { b.onclick = function () { tipos.splice(+b.dataset.dt, 1); desTipos(); }; });
    }
    desTipos();
    document.getElementById('tAdd').onclick = function () { tipos.push(''); desTipos(); };
    document.getElementById('tSalvar').onclick = function (e) { salvarCfg({ tipos: tipos }, e.currentTarget, 'Tipos salvos.').then(function (r) { if (r && r.tipos) { tipos = r.tipos.slice(); CFG.tipos = r.tipos; desTipos(); } }); };
    document.getElementById('pSalvar').onclick = function (e) { var np = {}; box.querySelectorAll('[data-p]').forEach(function (i) { np[i.dataset.p] = i.value; }); salvarCfg({ prazos: np }, e.currentTarget, 'Prazos salvos.'); };
    var cb = document.getElementById('calBox');
    function desCal() {
      var anos = cal.map(function (l) { return +l.ano; }), maxAno = anos.length ? Math.max.apply(null, anos) : new Date().getFullYear();
      cb.innerHTML = '<div class="linha-flex" style="margin-bottom:6px"><div class="cresce"><h2>Calendário de licenciamento (CRLV)</h2><div class="peq suave">O CRLV só fica vencido depois do prazo final do final da placa. Alertas com 60, 30 e 7 dias.</div></div>' +
        '<button class="btn sec peq" id="cCopiar">Copiar ' + maxAno + ' para ' + (maxAno + 1) + '</button><button class="btn sec peq" id="cLinha">' + ICONE.mais + 'Linha</button></div>' +
        (anos.indexOf(new Date().getFullYear() + 1) < 0 ? '<p class="chip vence" style="display:block;margin:10px 0">Falta o calendário de ' + (new Date().getFullYear() + 1) + '. Sem ele, em janeiro os veículos aparecem como "sem calendário".</p>' : '') +
        '<div class="tab-box" style="margin-top:10px"><table class="t"><thead><tr><th>Ano</th><th>UF</th><th>Finais da placa</th><th>Prazo final</th><th></th></tr></thead><tbody>' +
        cal.map(function (l, i) { return '<tr><td><input type="number" data-c="' + i + '" data-k="ano" value="' + esc(l.ano) + '" style="width:90px" aria-label="Ano"></td><td><select data-c="' + i + '" data-k="uf" style="width:80px" aria-label="UF">' + opcoes(C.UFS, l.uf, false) + '</select></td>' +
          '<td><input data-c="' + i + '" data-k="finais" value="' + esc(l.finais) + '" placeholder="1, 2" aria-label="Finais"></td><td><input type="date" data-c="' + i + '" data-k="prazo" value="' + esc(l.prazo) + '" aria-label="Prazo"></td><td><button class="ic-btn" data-dc="' + i + '" aria-label="Remover linha">✕</button></td></tr>'; }).join('') +
        '</tbody></table></div><p class="mini suave">Finais aceitos: "1, 2", "3 4 5", "6-8" ou "9 e 0". Confira as datas no site do Detran de cada UF todo ano.</p><div class="acoes-dir"><button class="btn" id="cSalvarCal">Salvar calendário</button></div>';
      cb.querySelectorAll('[data-c]').forEach(function (i) { i.oninput = i.onchange = function () { cal[+i.dataset.c][i.dataset.k] = i.value; }; });
      cb.querySelectorAll('[data-dc]').forEach(function (b) { b.onclick = function () { cal.splice(+b.dataset.dc, 1); desCal(); }; });
      document.getElementById('cLinha').onclick = function () { cal.push({ ano: maxAno, uf: 'DF', finais: '', prazo: '' }); desCal(); };
      document.getElementById('cCopiar').onclick = function () {
        cal.filter(function (l) { return +l.ano === maxAno; }).forEach(function (l) { cal.push({ ano: maxAno + 1, uf: l.uf, finais: l.finais, prazo: l.prazo ? String(+l.prazo.slice(0, 4) + 1) + l.prazo.slice(4) : '' }); });
        desCal(); C.aviso('Linhas copiadas. Confira as datas de ' + (maxAno + 1) + ' antes de salvar.');
      };
      document.getElementById('cSalvarCal').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true, 'Salvando...'); api('salvarCalendario', '', cal).then(function (r) { cal = r; desCal(); C.aviso('Calendário salvo.', 'ok'); carregar(); }).catch(function (e2) { C.ocupado(b, false); erro(e2); }); };
    }
    api('listarCalendario', '').then(function (r) { cal = r; desCal(); }).catch(function (e) { cb.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }
  function cfgUsuarios(box) {
    box.innerHTML = '<section class="cartao"><div class="carregando">Carregando...</div></section>';
    api('listarUsuarios', '').then(function (r) {
      var us = r.usuarios.slice();
      function des() {
        box.innerHTML = '<section class="cartao"><h2>Quem acessa o sistema (login Google)</h2><p class="peq suave">O dono do sistema (<b>' + esc(r.dono) + '</b>) é sempre administrador. <b>Funcionário</b> vê, cadastra, edita, cobra e exporta, mas não abre as Configurações, não exclui e não importa.</p>' +
          '<div class="tab-box"><table class="t"><thead><tr><th>E-mail Google</th><th>Nome</th><th>Perfil</th><th>Ativo</th><th></th></tr></thead><tbody>' +
          (us.length ? us.map(function (u, i) { return '<tr><td><input type="email" data-u="' + i + '" data-k="email" value="' + esc(u.email) + '" placeholder="nome@gmail.com" aria-label="E-mail"></td><td><input data-u="' + i + '" data-k="nome" value="' + esc(u.nome) + '" aria-label="Nome"></td>' +
            '<td><select data-u="' + i + '" data-k="perfil" aria-label="Perfil"><option value="funcionario"' + (u.perfil !== 'admin' ? ' selected' : '') + '>Funcionário</option><option value="admin"' + (u.perfil === 'admin' ? ' selected' : '') + '>Administrador</option></select></td>' +
            '<td style="text-align:center"><input type="checkbox" data-u="' + i + '" data-k="ativo"' + (u.ativo !== false ? ' checked' : '') + ' aria-label="Ativo"></td><td><button class="ic-btn" data-du="' + i + '" aria-label="Remover">✕</button></td></tr>'; }).join('') : '<tr><td colspan="5" class="suave">Nenhum usuário além do dono.</td></tr>') +
          '</tbody></table></div><button class="btn sec peq" id="uAdd" style="margin-top:10px">' + ICONE.mais + 'Adicionar usuário</button><div class="acoes-dir"><button class="btn" id="uSalvar">Salvar usuários</button></div></section>';
        box.querySelectorAll('[data-u]').forEach(function (i) { i.oninput = i.onchange = function () { us[+i.dataset.u][i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; }; });
        box.querySelectorAll('[data-du]').forEach(function (b) { b.onclick = function () { us.splice(+b.dataset.du, 1); des(); }; });
        document.getElementById('uAdd').onclick = function () { us.push({ email: '', nome: '', perfil: 'funcionario', ativo: true }); des(); };
        document.getElementById('uSalvar').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true, 'Salvando...'); api('salvarUsuarios', '', us).then(function (x) { us = x.usuarios; des(); C.aviso('Usuários salvos.', 'ok'); }).catch(function (e2) { C.ocupado(b, false); erro(e2); }); };
      }
      des();
    }).catch(function (e) { box.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; });
  }
  function cfgContratos(box) {
    var e = CFG.endereco || {}, end = { CEP: e.cep, Logradouro: e.logradouro, 'Número Endereço': e.numero, Complemento: e.complemento, Bairro: e.bairro, Cidade: e.cidade, UF: e.uf };
    var st = function (m, nome) { return m && m.ok ? '<span class="chip ok">Enviado</span> <a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.nome) + '</a>' : '<span class="chip falta">' + nome + ' não enviado</span>'; };
    box.innerHTML = '<div class="duas"><form class="cartao prin" id="fCt"><h2 style="margin-bottom:12px">Contratante (entra no contrato)</h2><div class="grade">' +
      '<label class="campo">Razão social<input name="razao" value="' + esc(CFG.razao) + '"></label><label class="campo">CNPJ<input name="cnpj" value="' + esc(CFG.cnpj) + '"></label><label class="campo">Região de atuação<input name="regiao" value="' + esc(CFG.regiao) + '"></label></div>' +
      '<div class="bloco-tit" style="margin-top:14px">Endereço da empresa</div><div class="grade">' + GRUPOS[1][1].map(function (c) { return campoHtml(c, end, 'ct'); }).join('') + '</div>' +
      '<label class="campo" style="margin-top:12px">Texto do endereço como aparece no contrato<textarea name="enderecoTexto" rows="2">' + esc(CFG.enderecoTexto) + '</textarea></label>' +
      '<div class="acoes-dir"><button type="button" class="btn sec" id="ctMontar">Montar texto a partir dos campos</button><button class="btn" type="submit">Salvar</button></div></form>' +
      '<section class="cartao lat" style="display:block"><h2 style="margin-bottom:12px">Modelos (.docx)</h2>' +
      '<p class="peq">Contrato: ' + st(CFG.modelo, 'Contrato') + '</p><label class="campo">Enviar modelo do contrato<input type="file" accept=".docx" data-mod="contrato"></label>' +
      '<p class="peq" style="margin-top:16px">Termo do motorista: ' + st(CFG.modeloTermo, 'Termo') + '</p><label class="campo">Enviar modelo do termo<input type="file" accept=".docx" data-mod="termo"></label>' +
      '<p class="mini suave">Use os arquivos Modelo_Contrato.docx e Modelo_Termo_Motorista.docx. Não edite o texto dentro das chaves {{ }}.</p></section></div>';
    var f = document.getElementById('fCt'); C.ligarMascaras(f); C.ligarCep(f, '');
    document.getElementById('ctMontar').onclick = function () {
      var d = lerForm(f);
      f.querySelector('[name=enderecoTexto]').value = [[d.Logradouro, d['Número Endereço'], d.Complemento].filter(Boolean).join(' '), d.Bairro, d.Cidade && ('município de ' + d.Cidade + (d.UF ? '-' + d.UF : '')), d.CEP && 'CEP ' + d.CEP].filter(Boolean).join(', ');
    };
    f.onsubmit = function (ev) {
      ev.preventDefault(); var d = lerForm(f);
      salvarCfg({ razao: d.razao, cnpj: d.cnpj, regiao: d.regiao, enderecoTexto: d.enderecoTexto, endereco: { cep: d.CEP, logradouro: d.Logradouro, numero: d['Número Endereço'], complemento: d.Complemento, bairro: d.Bairro, cidade: d.Cidade, uf: d.UF } }, f.querySelector('[type=submit]'), 'Dados do contrato salvos.');
    };
    box.querySelectorAll('[data-mod]').forEach(function (i) {
      i.onchange = function () { var file = i.files[0]; if (!file) return;
        C.lerBase64(file).then(function (b) { return api('salvarModeloContrato', '', b, i.dataset.mod); }).then(function () { C.aviso('Modelo enviado.', 'ok'); telaConfig('contratos'); }).catch(erro); };
    });
  }
  function cfgBackup(box) {
    box.innerHTML = '<div class="duas"><section class="cartao prin"><h2 style="margin-bottom:12px">Backup no Google Drive</h2><p class="peq suave">Automático todo dia às 3h (guarda 30) e todo domingo às 4h (guarda 12): cópia da planilha + configurações, na pasta Backups do Drive.</p>' +
      '<div class="linha-flex"><button class="btn" id="bkAgora">Fazer backup agora</button><a id="bkPasta" class="oculto" target="_blank" rel="noopener">Abrir pasta de backups ↗</a></div><div id="bkLista" class="peq" style="margin-top:14px"></div></section>' +
      '<div class="lat"><section class="cartao"><h2 style="margin-bottom:8px">Resumo semanal por e-mail</h2><p class="peq suave">Segunda, 7h, para os administradores: documentos vencidos ou vencendo em 30 dias e cadastros em revisão.</p><button class="btn sec" id="rsTeste">Enviar um teste para mim</button></section>' +
      '<section class="cartao"><h2 style="margin-bottom:8px">Links</h2><label class="campo">Sistema (equipe, com login)<input readonly value="' + esc(C.base()) + '"></label>' +
      '<label class="campo" style="margin-top:10px">Cadastro dos motoristas (sem login)<input readonly value="' + esc(C.base() + 'cadastro.html') + '"></label></section></div></div>';
    function lista() {
      api('listarBackups', '').then(function (r) {
        var p = document.getElementById('bkPasta'); if (r.pasta) { p.href = r.pasta; p.classList.remove('oculto'); }
        document.getElementById('bkLista').innerHTML = r.itens.length ? '<b>Últimos backups</b><br>' + r.itens.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.nome) + '</a> <span class="suave">(' + (x.tipo === 'semanal' ? 'semanal' : 'diário') + ')</span>'; }).join('<br>') : 'Ainda não há backups.';
      }).catch(erro);
    }
    lista();
    document.getElementById('bkAgora').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true, 'Fazendo backup...'); api('fazerBackup', '').then(function (r) { C.aviso('Backup feito: ' + r.nome, 'ok'); lista(); }).catch(erro).then(function () { C.ocupado(b, false); }); };
    document.getElementById('rsTeste').onclick = function (e) { var b = e.currentTarget; C.ocupado(b, true, 'Enviando...'); api('enviarResumoTeste', '').then(function (r) { C.aviso('Resumo enviado para ' + r.para + '.', 'ok'); }).catch(erro).then(function () { C.ocupado(b, false); }); };
  }

  // ---------------------------------------------------------------- início
  carregar().then(rota).catch(function (e) { if (!e.login) tela.innerHTML = '<div class="vazio">Não consegui carregar: ' + esc(e.message) + '</div>'; });
})();