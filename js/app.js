(function () {
  var STORAGE_KEY = 'hesap_defteri_hesaplar';
  var SHARED_KEY = 'hesap_defteri_paylasilan';

  function todayStr() {
    var d = new Date();
    var off = d.getTimezoneOffset();
    var local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }
  function formatTL(n) {
    var num = Number(n) || 0;
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' \u20BA';
  }
  function formatDateDisplay(iso) {
    var p = iso.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }
  function formatDateTimeDisplay(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
  }
  function formatAmountTyping(raw) {
    var cleaned = String(raw).replace(/[^0-9,]/g, '');
    var parts = cleaned.split(',');
    var intPart = parts[0].replace(/^0+(?=\d)/, '');
    var decPart = parts.length > 1 ? parts[1].slice(0, 2) : null;
    var grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart !== null ? grouped + ',' + decPart : grouped;
  }
  function parseAmountValue(formatted) {
    var normalized = String(formatted).replace(/\./g, '').replace(',', '.');
    var n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  function loadAccounts() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function saveAccounts(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function loadShared() {
    try { var raw = localStorage.getItem(SHARED_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function saveShared(obj) {
    try {
      if (obj === null) { localStorage.removeItem(SHARED_KEY); }
      else { localStorage.setItem(SHARED_KEY, JSON.stringify(obj)); }
      return true;
    } catch (e) { return false; }
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

  var state = {
    screen: 'main',
    accounts: loadAccounts(),
    sharedData: loadShared(),
    filterType: 'all',
    expandedId: null,
    hareketFormFor: null,
    hareketFormKind: null,
    editingHareket: null,
    error: '', info: '',
    _type: 'alacak', _party: '', _amount: '', _date: todayStr(), _note: '',
    _hAmount: '', _hDate: todayStr(), _hNote: ''
  };

  var root = document.getElementById('app-root');
  var fileInput = document.getElementById('file-input-hidden');

  function accTotals(acc) {
    var toplam = 0, alinan = 0;
    (acc.hareketler || []).forEach(function (h) {
      if (h.kind === 'is') toplam += h.amount; else alinan += h.amount;
    });
    return { toplam: toplam, alinan: alinan, kalan: toplam - alinan };
  }

  function lastActivity(acc) {
    var list = acc.hareketler || [];
    if (list.length === 0) return acc.createdAt || 0;
    return list.reduce(function (m, h) { return Math.max(m, h.createdAt || 0); }, 0);
  }

  function getFilteredAccounts() {
    var list = state.accounts.slice();
    if (state.filterType !== 'all') list = list.filter(function (a) { return a.type === state.filterType; });
    list.sort(function (a, b) { return lastActivity(b) - lastActivity(a); });
    return list;
  }

  function globalSummary(accounts) {
    var alacakKalan = 0, verecekKalan = 0;
    accounts.forEach(function (a) {
      var t = accTotals(a);
      if (a.type === 'alacak') alacakKalan += t.kalan; else verecekKalan += t.kalan;
    });
    return { alacakKalan: alacakKalan, verecekKalan: verecekKalan };
  }

  function render() {
    if (state.screen === 'shared') { renderSharedScreen(); return; }
    renderMainScreen();
  }

  function renderHareketRow(h, accId, editable) {
    var isKind = h.kind === 'is';
    var badge = isKind ? '<span class="h-badge is">İş / Borç</span>' : '<span class="h-badge odeme">Ödeme</span>';
    var sign = isKind ? '+' : '-';
    var noteHtml = h.note ? '<div class="h-note">' + escapeHtml(h.note) + '</div>' : '';
    var actions = editable ?
      '<div class="h-actions">' +
        '<button class="h-edit" data-hedit="' + h.id + '" data-hacc="' + accId + '">düzenle</button>' +
        '<button class="h-del" data-hdel="' + h.id + '" data-hacc="' + accId + '">sil</button>' +
      '</div>' : '';
    return '<div class="hareket-row">' +
      '<div class="h-left">' + badge + '<span class="h-date">' + formatDateDisplay(h.date) + '</span>' + noteHtml + actions + '</div>' +
      '<div class="h-amt ' + (isKind ? 'is' : 'odeme') + '">' + sign + formatTL(h.amount) + '</div>' +
    '</div>';
  }

  function renderAccountCard(acc, editable) {
    var t = accTotals(acc);
    var expanded = state.expandedId === acc.id;
    var kalanCls = t.kalan === 0 ? 'done' : acc.type;
    var kalanLabel = acc.type === 'alacak' ? 'Kalan Alacak' : 'Kalan Borç';

    var head =
      '<div class="acc-head" data-toggle="' + acc.id + '">' +
        '<div class="party-block">' +
          '<div class="party-name">' + escapeHtml(acc.party) + '</div>' +
          '<div class="party-badge ' + acc.type + '">' + (acc.type === 'alacak' ? 'Alacak' : 'Verecek') + '</div>' +
        '</div>' +
        '<div class="kalan-block">' +
          '<div class="kalan-label">' + (t.kalan === 0 ? 'Tamamlandı' : kalanLabel) + '</div>' +
          '<div class="kalan-value ' + kalanCls + '">' + formatTL(t.kalan) + '</div>' +
        '</div>' +
      '</div>';

    var bodyHtml = '';
    if (expanded) {
      var statLabel1 = acc.type === 'alacak' ? 'Toplam Alınacak' : 'Toplam Verilecek';
      var statLabel2 = acc.type === 'alacak' ? 'Alınan' : 'Verilen';

      var hareketler = (acc.hareketler || []).slice().sort(function (a,b) {
        return (b.date + b.createdAt) > (a.date + a.createdAt) ? 1 : -1;
      });
      var hareketHtml = hareketler.length === 0
        ? '<div class="empty" style="padding:14px 6px;">Henüz hareket yok.</div>'
        : '<div class="hareket-list">' + hareketler.map(function (h) { return renderHareketRow(h, acc.id, editable); }).join('') + '</div>';

      var miniForm = '';
      if (editable && state.hareketFormFor === acc.id) {
        var isKind = state.hareketFormKind === 'is';
        var title = state.editingHareket
          ? (isKind ? 'İş / Borç Düzenle' : 'Ödeme Düzenle')
          : (isKind ? 'Yeni İş / Borç Ekle' : 'Yeni Ödeme Ekle');
        miniForm =
          '<div class="mini-form">' +
            '<div class="mf-title">' + title + '</div>' +
            '<input id="mf-amount" type="text" inputmode="decimal" placeholder="Tutar">' +
            '<input id="mf-date" type="date">' +
            '<textarea id="mf-note" rows="2" placeholder="' + (isKind ? 'Hangi iş için? (ör: Temmuz ayı montaj işi)' : 'Not (ör: ilk ödeme, nakit)') + '"></textarea>' +
            '<div class="mf-btns">' +
              '<button class="mf-secondary" id="mf-cancel">İptal</button>' +
              '<button class="mf-primary" id="mf-save">' + (state.editingHareket ? 'Güncelle' : 'Kaydet') + '</button>' +
            '</div>' +
          '</div>';
      }

      var actionsHtml = editable ?
        '<div class="acc-actions">' +
          '<button class="btn-add-is" data-addis="' + acc.id + '">+ İş / Borç Ekle</button>' +
          '<button class="btn-add-odeme" data-addodeme="' + acc.id + '">+ Ödeme Ekle</button>' +
        '</div>' : '';

      var manageHtml = editable ?
        '<div class="acc-manage">' +
          '<span class="danger-link" data-delacc="' + acc.id + '">Hesabı Sil</span>' +
        '</div>' : '';

      bodyHtml =
        '<div class="acc-body">' +
          '<div class="acc-stats">' +
            '<div class="acc-stat"><div class="l">' + statLabel1 + '</div><div class="v">' + formatTL(t.toplam) + '</div></div>' +
            '<div class="acc-stat"><div class="l">' + statLabel2 + '</div><div class="v">' + formatTL(t.alinan) + '</div></div>' +
          '</div>' +
          actionsHtml +
          miniForm +
          hareketHtml +
          manageHtml +
        '</div>';
    }

    return '<div class="acc-card">' + head + bodyHtml + '</div>';
  }

  function renderMainScreen() {
    var displayDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    var accounts = getFilteredAccounts();
    var gs = globalSummary(state.accounts);

    var hintHtml = isStandalone() ? '' :
      '<div class="install-hint"><b>İpucu:</b> Bu sayfayı ana ekranına ekleyip uygulama gibi kullanabilirsin. ' +
      'Safari\'de paylaş ikonuna dokun &rarr; "Ana Ekrana Ekle".</div>';

    var cardsHtml = accounts.length === 0
      ? '<div class="empty">Henüz hesap yok. Yukarıdan yeni bir hesap oluştur.</div>'
      : accounts.map(function (a) { return renderAccountCard(a, true); }).join('');

    root.innerHTML =
      '<div class="shell">' +
        '<div class="header"><h1>Cari Hesap Defteri</h1><div class="date-today">' + displayDate + '</div></div>' +
        '<div class="tabs">' +
          '<button id="tab-main" class="active">Hesaplarım</button>' +
          '<button id="tab-shared">Gelen Defter</button>' +
        '</div>' +
        hintHtml +
        '<div class="summary-row">' +
          '<div class="summary-card alacak"><div class="label">Toplam Kalan Alacak</div><div class="value">' + formatTL(gs.alacakKalan) + '</div></div>' +
          '<div class="summary-card verecek"><div class="label">Toplam Kalan Borç</div><div class="value">' + formatTL(gs.verecekKalan) + '</div></div>' +
        '</div>' +
        '<div class="ticket">' +
          '<div class="ticket-title">Yeni Hesap Oluştur</div>' +
          '<div class="type-toggle">' +
            '<button id="btn-alacak" class="' + (state._type === 'alacak' ? 'active-alacak' : '') + '">Alacak (Bana Borçlu)</button>' +
            '<button id="btn-verecek" class="' + (state._type === 'verecek' ? 'active-verecek' : '') + '">Verecek (Ben Borçluyum)</button>' +
          '</div>' +
          '<div class="field"><label>Kişi / Şirket</label><input id="inp-party" type="text" placeholder="Örn: ABC İnşaat Ltd."></div>' +
          '<div class="field amount"><label>İlk Tutar</label><input id="inp-amount" type="text" inputmode="decimal" placeholder="0"></div>' +
          '<div class="field"><label>Tarih</label><input id="inp-date" type="date"></div>' +
          '<div class="field"><label>Not (hangi iş için?)</label><textarea id="inp-note" rows="2" placeholder="Örn: Temmuz ayı yapılan montaj işi"></textarea></div>' +
        '</div>' +
        (state.error ? '<div class="err-msg">' + escapeHtml(state.error) + '</div>' : '') +
        (state.info ? '<div class="ok-msg">' + escapeHtml(state.info) + '</div>' : '') +
        '<button class="add-btn" id="btn-create-acc">+ Hesap Oluştur</button>' +
        '<div class="export-row">' +
          '<button id="btn-export">&#8681; Yedek Al / Paylaş</button>' +
          '<button id="btn-toggle-restore">&#8679; Yedekten Geri Yükle</button>' +
        '</div>' +
        (state.restorePanelOpen ?
          '<div class="import-box">' +
            '<label class="lbl">Yedek dosyasını aç veya kodu yapıştır</label>' +
            '<button class="btn-primary" id="btn-pick-restore-file" style="width:100%;margin-bottom:10px;">&#128193; Dosya Seç (.json)</button>' +
            '<textarea id="txt-restore" placeholder="...veya buraya yedek metnini yapıştır"></textarea>' +
            '<div class="btn-row"><button class="btn-primary" id="btn-restore-text">Kendi Hesaplarıma Geri Yükle</button></div>' +
          '</div>' : '') +
        '<div class="section-title"><span>Hesaplar</span>' +
          '<select id="sel-filter">' +
            '<option value="all"' + (state.filterType==='all'?' selected':'') + '>Tümü</option>' +
            '<option value="alacak"' + (state.filterType==='alacak'?' selected':'') + '>Alacaklar</option>' +
            '<option value="verecek"' + (state.filterType==='verecek'?' selected':'') + '>Verecekler</option>' +
          '</select>' +
        '</div>' +
        cardsHtml +
      '</div>';

    document.getElementById('inp-party').value = state._party || '';
    document.getElementById('inp-amount').value = state._amount || '';
    document.getElementById('inp-date').value = state._date || todayStr();
    document.getElementById('inp-note').value = state._note || '';

    document.getElementById('tab-main').onclick = function () { state.screen = 'main'; render(); };
    document.getElementById('tab-shared').onclick = function () { state.screen = 'shared'; state.error=''; state.info=''; render(); };

    document.getElementById('btn-alacak').onclick = function () { state._type = 'alacak'; render(); };
    document.getElementById('btn-verecek').onclick = function () { state._type = 'verecek'; render(); };
    document.getElementById('inp-party').oninput = function (ev) { state._party = ev.target.value; };
    document.getElementById('inp-amount').oninput = function (ev) {
      state._amount = formatAmountTyping(ev.target.value);
      ev.target.value = state._amount;
    };
    document.getElementById('inp-date').onchange = function (ev) { state._date = ev.target.value; };
    document.getElementById('inp-note').oninput = function (ev) { state._note = ev.target.value; };
    document.getElementById('btn-create-acc').onclick = createAccount;
    document.getElementById('btn-export').onclick = exportData;
    document.getElementById('btn-toggle-restore').onclick = function () {
      state.restorePanelOpen = !state.restorePanelOpen;
      state.error = ''; state.info = '';
      render();
    };
    document.getElementById('sel-filter').onchange = function (ev) { state.filterType = ev.target.value; render(); };

    var pickRestoreBtn = document.getElementById('btn-pick-restore-file');
    if (pickRestoreBtn) {
      pickRestoreBtn.onclick = function () { fileInputMode = 'restore'; fileInput.click(); };
      document.getElementById('btn-restore-text').onclick = function () {
        restoreOwnData(document.getElementById('txt-restore').value);
      };
    }

    root.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.onclick = function () {
        var id = el.getAttribute('data-toggle');
        state.expandedId = state.expandedId === id ? null : id;
        state.hareketFormFor = null; state.editingHareket = null;
        render();
      };
    });
    root.querySelectorAll('[data-addis]').forEach(function (el) {
      el.onclick = function (ev) { ev.stopPropagation(); openHareketForm(el.getAttribute('data-addis'), 'is'); };
    });
    root.querySelectorAll('[data-addodeme]').forEach(function (el) {
      el.onclick = function (ev) { ev.stopPropagation(); openHareketForm(el.getAttribute('data-addodeme'), 'odeme'); };
    });
    root.querySelectorAll('[data-delacc]').forEach(function (el) {
      el.onclick = function (ev) { ev.stopPropagation(); deleteAccount(el.getAttribute('data-delacc')); };
    });
    root.querySelectorAll('[data-hdel]').forEach(function (el) {
      el.onclick = function (ev) { ev.stopPropagation(); deleteHareket(el.getAttribute('data-hacc'), el.getAttribute('data-hdel')); };
    });
    root.querySelectorAll('[data-hedit]').forEach(function (el) {
      el.onclick = function (ev) { ev.stopPropagation(); startEditHareket(el.getAttribute('data-hacc'), el.getAttribute('data-hedit')); };
    });

    var mfAmount = document.getElementById('mf-amount');
    if (mfAmount) {
      mfAmount.value = state._hAmount || '';
      document.getElementById('mf-date').value = state._hDate || todayStr();
      document.getElementById('mf-note').value = state._hNote || '';
      mfAmount.oninput = function (ev) { state._hAmount = formatAmountTyping(ev.target.value); ev.target.value = state._hAmount; };
      document.getElementById('mf-date').onchange = function (ev) { state._hDate = ev.target.value; };
      document.getElementById('mf-note').oninput = function (ev) { state._hNote = ev.target.value; };
      document.getElementById('mf-cancel').onclick = function (ev) { ev.stopPropagation(); closeHareketForm(); };
      document.getElementById('mf-save').onclick = function (ev) { ev.stopPropagation(); saveHareket(); };
    }
  }

  function renderSharedScreen() {
    var shared = state.sharedData;
    var body = '';
    if (!shared) {
      body =
        '<div class="import-box">' +
          '<label class="lbl">Bir yedek dosyası aç veya kodu yapıştır</label>' +
          '<button class="btn-primary" id="btn-pick-file" style="width:100%;margin-bottom:10px;">&#128193; Dosya Seç (.json)</button>' +
          '<textarea id="txt-import" placeholder="...veya buraya yedek metnini yapıştır"></textarea>' +
          '<div class="btn-row"><button class="btn-primary" id="btn-import-text">İçe Aktar</button></div>' +
        '</div>';
    } else {
      var gs = globalSummary(shared.accounts || []);
      var cardsHtml = (shared.accounts || []).length === 0
        ? '<div class="empty">Bu yedekte hesap yok.</div>'
        : shared.accounts.map(function (a) { return renderAccountCard(a, false); }).join('');
      body =
        '<div class="shared-meta"><span>İçe aktarıldı: ' + formatDateTimeDisplay(shared.importedAt) + '</span><span class="clear-link" id="btn-clear-shared">Temizle</span></div>' +
        '<div class="summary-row">' +
          '<div class="summary-card alacak"><div class="label">Toplam Kalan Alacak</div><div class="value">' + formatTL(gs.alacakKalan) + '</div></div>' +
          '<div class="summary-card verecek"><div class="label">Toplam Kalan Borç</div><div class="value">' + formatTL(gs.verecekKalan) + '</div></div>' +
        '</div>' +
        cardsHtml;
    }

    root.innerHTML =
      '<div class="shell">' +
        '<div class="header"><h1>Gelen Defter</h1></div>' +
        '<div class="tabs">' +
          '<button id="tab-main">Hesaplarım</button>' +
          '<button id="tab-shared" class="active">Gelen Defter</button>' +
        '</div>' +
        '<div class="install-hint">Bu ekran, başkasının gönderdiği yedek dosyasını <b>salt okunur</b> görüntülemek içindir. Buradan hesap ekleyip değiştiremezsin.</div>' +
        (state.error ? '<div class="err-msg">' + escapeHtml(state.error) + '</div>' : '') +
        (state.info ? '<div class="ok-msg">' + escapeHtml(state.info) + '</div>' : '') +
        body +
      '</div>';

    document.getElementById('tab-main').onclick = function () { state.screen = 'main'; render(); };
    document.getElementById('tab-shared').onclick = function () { state.screen = 'shared'; render(); };

    if (!shared) {
      document.getElementById('btn-pick-file').onclick = function () { fileInputMode = 'shared'; fileInput.click(); };
      document.getElementById('btn-import-text').onclick = function () {
        importFromText(document.getElementById('txt-import').value);
      };
    } else {
      document.getElementById('btn-clear-shared').onclick = function () {
        state.sharedData = null; saveShared(null); state.info = 'Gelen defter temizlendi.'; render();
      };
      root.querySelectorAll('[data-toggle]').forEach(function (el) {
        el.onclick = function () {
          var id = el.getAttribute('data-toggle');
          state.expandedId = state.expandedId === id ? null : id;
          render();
        };
      });
    }
  }

  function resetAccountForm() {
    state._type = 'alacak'; state._party = ''; state._amount = ''; state._date = todayStr(); state._note = '';
  }

  function createAccount() {
    var amt = parseAmountValue(state._amount || '');
    var party = (state._party || '').trim();
    if (!party) { state.error = 'Kişi veya şirket adını gir.'; render(); return; }
    if (!amt || amt <= 0) { state.error = 'Geçerli bir tutar gir.'; render(); return; }
    state.error = ''; state.info = '';

    var acc = {
      id: uid(), party: party, type: state._type, createdAt: Date.now(),
      hareketler: [{
        id: uid(), kind: 'is', amount: amt, date: state._date || todayStr(),
        note: (state._note || '').trim(), createdAt: Date.now()
      }]
    };
    state.accounts = [acc].concat(state.accounts);
    saveAccounts(state.accounts);
    resetAccountForm();
    state.expandedId = acc.id;
    render();
  }

  function deleteAccount(id) {
    state.accounts = state.accounts.filter(function (a) { return a.id !== id; });
    saveAccounts(state.accounts);
    if (state.expandedId === id) state.expandedId = null;
    render();
  }

  function openHareketForm(accId, kind) {
    state.hareketFormFor = accId;
    state.hareketFormKind = kind;
    state.editingHareket = null;
    state._hAmount = ''; state._hDate = todayStr(); state._hNote = '';
    state.error = ''; state.info = '';
    render();
  }

  function closeHareketForm() {
    state.hareketFormFor = null; state.editingHareket = null;
    render();
  }

  function startEditHareket(accId, hId) {
    var acc = state.accounts.find(function (a) { return a.id === accId; });
    if (!acc) return;
    var h = (acc.hareketler || []).find(function (x) { return x.id === hId; });
    if (!h) return;
    state.hareketFormFor = accId;
    state.hareketFormKind = h.kind;
    state.editingHareket = hId;
    state._hAmount = formatAmountTyping(String(h.amount).replace('.', ','));
    state._hDate = h.date;
    state._hNote = h.note || '';
    render();
  }

  function saveHareket() {
    var amt = parseAmountValue(state._hAmount || '');
    if (!amt || amt <= 0) { state.error = 'Geçerli bir tutar gir.'; render(); return; }
    state.error = '';
    var accId = state.hareketFormFor;
    var acc = state.accounts.find(function (a) { return a.id === accId; });
    if (!acc) return;

    if (state.editingHareket) {
      acc.hareketler = acc.hareketler.map(function (h) {
        if (h.id !== state.editingHareket) return h;
        return { id: h.id, kind: h.kind, amount: amt, date: state._hDate || todayStr(), note: (state._hNote || '').trim(), createdAt: h.createdAt };
      });
      state.info = 'Hareket güncellendi.';
    } else {
      acc.hareketler = (acc.hareketler || []).concat([{
        id: uid(), kind: state.hareketFormKind, amount: amt, date: state._hDate || todayStr(),
        note: (state._hNote || '').trim(), createdAt: Date.now()
      }]);
      state.info = '';
    }
    saveAccounts(state.accounts);
    state.hareketFormFor = null; state.editingHareket = null;
    render();
  }

  function deleteHareket(accId, hId) {
    var acc = state.accounts.find(function (a) { return a.id === accId; });
    if (!acc) return;
    acc.hareketler = (acc.hareketler || []).filter(function (h) { return h.id !== hId; });
    saveAccounts(state.accounts);
    render();
  }

  function toFriendlyPayload(accounts) {
    return {
      yedekTarihi: formatDateTimeDisplay(Date.now()),
      hesaplar: accounts.map(function (a) {
        var t = accTotals(a);
        return {
          kisiSirket: a.party,
          tur: a.type === 'verecek' ? 'Verecek' : 'Alacak',
          toplamTutar: t.toplam,
          alinanTutar: t.alinan,
          kalanTutar: t.kalan,
          hareketler: (a.hareketler || []).slice().sort(function (x, y) {
            return (x.date + x.createdAt) > (y.date + y.createdAt) ? 1 : -1;
          }).map(function (h) {
            return {
              tur: h.kind === 'odeme' ? 'Ödeme' : 'İş/Borç',
              tutar: h.amount,
              tarih: h.date,
              not: h.note || ''
            };
          })
        };
      })
    };
  }

  function fromFriendlyOrRawPayload(parsed) {
    var rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.accounts) ? parsed.accounts : parsed.hesaplar);
    if (!Array.isArray(rawList)) throw new Error('format');
    var baseTime = Date.now();
    return rawList.map(function (a, ai) {
      var isFriendly = a.hesaplar === undefined && (a.kisiSirket !== undefined || a.tur !== undefined && a.party === undefined);
      var party = a.party !== undefined ? String(a.party || '') : String(a.kisiSirket || '');
      var rawType = a.type !== undefined ? a.type : a.tur;
      var type = (rawType === 'verecek' || rawType === 'Verecek') ? 'verecek' : 'alacak';
      var hareketSrc = Array.isArray(a.hareketler) ? a.hareketler : [];
      var hareketler = hareketSrc.map(function (h, hi) {
        var rawKind = h.kind !== undefined ? h.kind : h.tur;
        var kind = (rawKind === 'odeme' || rawKind === 'Ödeme') ? 'odeme' : 'is';
        var amount = h.amount !== undefined ? h.amount : h.tutar;
        var date = h.date !== undefined ? h.date : h.tarih;
        var note = h.note !== undefined ? h.note : h.not;
        return {
          id: h.id || uid(),
          kind: kind,
          amount: Number(amount) || 0,
          date: date || todayStr(),
          note: note || '',
          createdAt: h.createdAt || (baseTime + ai * 1000 + hi)
        };
      });
      return {
        id: a.id || uid(),
        party: party,
        type: type,
        createdAt: a.createdAt || (baseTime + ai),
        hareketler: hareketler
      };
    });
  }

  function exportData() {
    var payload = toFriendlyPayload(state.accounts);
    var json = JSON.stringify(payload, null, 2);
    var filename = 'hesap-yedek-' + todayStr() + '.json';
    var blob = new Blob([json], { type: 'application/json' });
    var file = null;
    try { file = new File([blob], filename, { type: 'application/json' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Cari Hesap Defteri Yedeği', text: 'Hesap defteri yedek dosyası' })
        .catch(function () { downloadBlob(blob, filename); });
    } else {
      downloadBlob(blob, filename);
    }
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importFromText(txt) {
    if (!txt || !txt.trim()) { state.error = 'Önce bir dosya seç ya da yedek metnini yapıştır.'; render(); return; }
    try {
      var parsed = JSON.parse(txt);
      var cleaned = fromFriendlyOrRawPayload(parsed);
      var sharedObj = { importedAt: Date.now(), accounts: cleaned };
      state.sharedData = sharedObj;
      saveShared(sharedObj);
      state.error = ''; state.info = '';
      render();
    } catch (e) {
      state.error = 'Dosya okunamadı. Doğru yedek dosyası (.json) olduğundan emin ol.';
      render();
    }
  }

  function accountsAreSame(a, b) {
    return a.party.trim().toLowerCase() === b.party.trim().toLowerCase() && a.type === b.type;
  }
  function hareketSignature(h) {
    return h.kind + '|' + h.amount + '|' + h.date + '|' + (h.note || '');
  }

  function restoreOwnData(txt) {
    if (!txt || !txt.trim()) { state.error = 'Önce bir dosya seç ya da yedek metnini yapıştır.'; render(); return; }
    try {
      var parsed = JSON.parse(txt);
      var incoming = fromFriendlyOrRawPayload(parsed);
      var addedAccounts = 0, addedHareket = 0;

      incoming.forEach(function (incAcc) {
        var existing = state.accounts.find(function (a) { return accountsAreSame(a, incAcc); });
        if (!existing) {
          state.accounts = [incAcc].concat(state.accounts);
          addedAccounts++;
          addedHareket += incAcc.hareketler.length;
        } else {
          var existingSigs = existing.hareketler.map(hareketSignature);
          incAcc.hareketler.forEach(function (h) {
            var sig = hareketSignature(h);
            if (existingSigs.indexOf(sig) === -1) {
              existing.hareketler.push(h);
              existingSigs.push(sig);
              addedHareket++;
            }
          });
        }
      });

      saveAccounts(state.accounts);
      state.error = '';
      state.info = addedAccounts + ' yeni hesap, ' + addedHareket + ' hareket geri yüklendi.';
      state.restorePanelOpen = false;
      render();
    } catch (e) {
      state.error = 'Dosya okunamadı. Doğru yedek dosyası (.json) olduğundan emin ol.';
      render();
    }
  }

  var fileInputMode = 'shared';
  fileInput.addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      if (fileInputMode === 'restore') restoreOwnData(text); else importFromText(text);
    };
    reader.onerror = function () { state.error = 'Dosya okunamadı.'; render(); };
    reader.readAsText(f);
    fileInput.value = '';
  });

  render();
})();
