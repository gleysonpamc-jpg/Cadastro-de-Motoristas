// Funções comuns do site (equipe e motoristas). Sem dados nem segredos.
(function () {
  'use strict';
  var C = window.Comum = {};

  C.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  C.api = function (acao) { var a = Array.prototype.slice.call(arguments, 1); return window.apiSistema(acao, a); };
  C.base = function () { return new URL('.', location.href).href; };
  C.semAcento = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  C.br = function (iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || ''); };
  C.UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  // ---------- máscaras (tudo fica texto: zeros à esquerda e à direita são mantidos) ----------
  C.mCpfCnpj = function (v) {
    var d = String(v).replace(/\D/g, '').slice(0, 14), o;
    if (d.length <= 11) { o = d.slice(0, 3); if (d.length > 3) o += '.' + d.slice(3, 6); if (d.length > 6) o += '.' + d.slice(6, 9); if (d.length > 9) o += '-' + d.slice(9, 11); return o; }
    o = d.slice(0, 2) + '.' + d.slice(2, 5); if (d.length > 5) o += '.' + d.slice(5, 8); if (d.length > 8) o += '/' + d.slice(8, 12); if (d.length > 12) o += '-' + d.slice(12, 14); return o;
  };
  C.mTel = function (v) {
    var d = String(v).replace(/\D/g, '').slice(0, 11); if (!d) return '';
    var o = '(' + d.slice(0, 2); if (d.length > 2) { var corte = d.length > 10 ? 7 : 6; o += ') ' + d.slice(2, corte); if (d.length > corte) o += '-' + d.slice(corte); }
    return o;
  };
  // CPF (11 dígitos) ou CNPJ (14), com os dígitos verificadores conferidos
  C.docValido = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (/^(\d)\1+$/.test(d)) return false;
    var dv = function (base, pesos) { var s = 0; for (var i = 0; i < pesos.length; i++) s += +base[i] * pesos[i]; var r = s % 11; return r < 2 ? 0 : 11 - r; };
    if (d.length === 11) {
      var p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2], p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
      var c1 = (function () { var s = 0; for (var i = 0; i < 9; i++) s += +d[i] * p1[i]; var r = (s * 10) % 11; return r === 10 ? 0 : r; })();
      var c2 = (function () { var s = 0; for (var i = 0; i < 10; i++) s += +d[i] * p2[i]; var r = (s * 10) % 11; return r === 10 ? 0 : r; })();
      return c1 === +d[9] && c2 === +d[10];
    }
    if (d.length === 14) return dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[12] && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +d[13];
    return false;
  };
  C.mCep = function (v) { var d = String(v).replace(/\D/g, '').slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  var REGRAS = { 'CPF': C.mCpfCnpj, 'CPF Proprietário': C.mCpfCnpj, 'Celular': C.mTel, 'Celular Proprietário': C.mTel, 'CEP': C.mCep, 'CEP Proprietário': C.mCep, 'Chip Empresa Número': C.mTel, 'cnpj': C.mCpfCnpj, 'cpf': C.mCpfCnpj };
  C.ligarMascaras = function (raiz) {
    raiz.querySelectorAll('[name]').forEach(function (el) {
      var f = REGRAS[el.name]; if (!f || el.dataset.masc) return;
      el.dataset.masc = '1'; el.setAttribute('inputmode', 'numeric');
      el.addEventListener('input', function () { el.value = f(el.value); });
    });
  };
  // CEP preenche rua, bairro, cidade e UF (ViaCEP). sufixo: '' (motorista) ou ' Proprietário'
  C.ligarCep = function (raiz, sufixo) {
    sufixo = sufixo || '';
    var cep = raiz.querySelector('[name="CEP' + sufixo + '"]'); if (!cep) return;
    cep.addEventListener('change', function () {
      var d = cep.value.replace(/\D/g, ''); if (d.length !== 8) return;
      fetch('https://viacep.com.br/ws/' + d + '/json/').then(function (r) { return r.json(); }).then(function (j) {
        if (j.erro) return;
        [['Logradouro', j.logradouro], ['Bairro', j.bairro], ['Cidade', j.localidade], ['UF', j.uf]].forEach(function (p) {
          var el = raiz.querySelector('[name="' + p[0] + sufixo + '"]'); if (el && p[1]) el.value = p[1];
        });
      }).catch(function () {});
    });
  };

  // ---------- arquivos: PDF segue como está; foto vira PDF (A4); contrato aceita Word ----------
  function jpegParaPdf(jpeg, w, h) {
    var enc = new TextEncoder(), pais = w > h, pw = pais ? 842 : 595, ph = pais ? 595 : 842, m = 28;
    var s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h), iw = w * s, ih = h * s, x = (pw - iw) / 2, y = (ph - ih) / 2;
    var partes = [], offs = [], tam = 0;
    function add(d) { var b = typeof d === 'string' ? enc.encode(d) : d; partes.push(b); tam += b.length; }
    function obj(n, corpo) { offs[n] = tam; add(n + ' 0 obj\n' + corpo + '\nendobj\n'); }
    add('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    offs[4] = tam;
    add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
    add(jpeg); add('\nendstream\nendobj\n');
    var cont = 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q';
    obj(5, '<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream');
    var xref = tam, t = 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i <= 5; i++) t += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(t + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    var out = new Uint8Array(tam), p = 0; partes.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }
  C.bytesB64 = function (b) { var s = ''; for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  function imagemParaPdf(file) {
    var url = URL.createObjectURL(file);
    return new Promise(function (ok, erro) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 2000 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        var bin = atob(cv.toDataURL('image/jpeg', 0.85).split(',')[1]), jpeg = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
        URL.revokeObjectURL(url); ok(C.bytesB64(jpegParaPdf(jpeg, w, h)));
      };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error('Não consegui abrir a imagem "' + file.name + '". Envie em JPG, PNG ou PDF.')); };
      img.src = url;
    });
  }
  C.lerBase64 = function (file) {
    return new Promise(function (ok, erro) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1]); }; r.onerror = function () { erro(new Error('Falha ao ler ' + file.name)); }; r.readAsDataURL(file); });
  };
  // devolve { tipo, ext, base64 } pronto para o servidor. aceitaWord = só o contrato
  C.prepararArquivo = function (file, tipo, aceitaWord) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    var ehImagem = (file.type || '').indexOf('image/') === 0 || /^(jpe?g|png|gif|webp|bmp|heic|heif)$/.test(ext);
    if (ehImagem && !aceitaWord) {
      if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('A foto passa de 25 MB.'));
      return imagemParaPdf(file).then(function (b) { return { tipo: tipo, ext: 'pdf', base64: b }; });
    }
    var ok = aceitaWord ? ['pdf', 'doc', 'docx'] : ['pdf'];
    if (ok.indexOf(ext) < 0) return Promise.reject(new Error('"' + file.name + '" precisa ser ' + (aceitaWord ? 'PDF ou Word' : 'PDF ou foto') + '.'));
    if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error('"' + file.name + '" passa de 10 MB.'));
    return C.lerBase64(file).then(function (b) { return { tipo: tipo, ext: ext, base64: b }; });
  };
  C.baixarBase64 = function (nome, b64, mime) {
    var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([u], { type: mime || 'application/octet-stream' })), a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
  };
  // imprime um HTML sem abrir janela (iframe escondido)
  C.imprimir = function (html) {
    var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>&#8203;</title><style>@page{size:A4;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body style="margin:0">' + html + '</body></html>'); d.close();
    setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 60000); }, 400);
  };

  // ---------- avisos e janelas ----------
  C.aviso = function (texto, tipo) {
    var box = document.getElementById('avisos');
    if (!box) { box = document.createElement('div'); box.id = 'avisos'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    var el = document.createElement('div'); el.className = 'aviso ' + (tipo || ''); el.textContent = texto; box.appendChild(el);
    setTimeout(function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 400); }, tipo === 'erro' ? 7000 : 3500);
  };
  C.janela = function (titulo, corpoHtml, opcoes) {
    opcoes = opcoes || {};
    var fundo = document.createElement('div'); fundo.className = 'jan-fundo';
    fundo.innerHTML = '<div class="jan" role="dialog" aria-modal="true" aria-label="' + C.esc(titulo) + '" style="max-width:' + (opcoes.largura || 560) + 'px">' +
      '<div class="jan-topo"><h2>' + C.esc(titulo) + '</h2><button type="button" class="ic-btn" aria-label="Fechar" data-fechar>' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="jan-corpo">' + corpoHtml + '</div></div>';
    function fechar() { fundo.remove(); document.removeEventListener('keydown', esc); if (opcoes.aoFechar) opcoes.aoFechar(); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    fundo.addEventListener('click', function (e) { if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(fundo);
    var foco = fundo.querySelector('input,select,textarea,button:not([data-fechar])'); if (foco) foco.focus();
    return { el: fundo.querySelector('.jan-corpo'), fechar: fechar };
  };
  C.confirmar = function (titulo, texto, botao) {
    return new Promise(function (ok) {
      var j = C.janela(titulo, '<p>' + C.esc(texto) + '</p><div class="acoes-dir"><button type="button" class="btn sec" data-n>Cancelar</button><button type="button" class="btn perigo" data-s>' + C.esc(botao || 'Confirmar') + '</button></div>', { aoFechar: function () { ok(false); } });
      j.el.querySelector('[data-n]').onclick = function () { j.fechar(); };
      j.el.querySelector('[data-s]').onclick = function () { ok(true); j.fechar(); };
    });
  };
  C.ocupado = function (btn, sim, texto) {
    if (!btn) return;
    if (sim) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; btn.textContent = texto || 'Aguarde...'; }
    else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
  };
})();
