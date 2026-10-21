/* ---------- events ---------- */
const curYm = () => (UI.tab === 'statements' ? reconcileMonth() : UI.ym);
const findItem = (key, ym = curYm()) => itemsFor(ym).find(i => i.key === key);
const isBlank = () => !D.templates.length && !D.txns.length && !Object.keys(D.months).length;
function go(tab) {
  UI.tab = tab; UI.open = null;
  try { localStorage.setItem('billledger.tab', tab); } catch (e) { /* convenience only */ }
  render(); scrollTo(0, 0);
}

const ACTIONS = {
  tab: el => go(el.dataset.tab),
  'month-prev': () => { UI.ym = addMonths(UI.ym, -1); UI.open = null; render(); },
  'month-next': () => { UI.ym = addMonths(UI.ym, 1); UI.open = null; render(); },
  'month-today': () => { UI.ym = thisMonth(); UI.open = null; render(); },
  toggle: el => { const it = findItem(el.dataset.key); if (it) { toggleDone(UI.ym, it); render(); } },
  open: el => { UI.open = UI.open === el.dataset.key ? null : el.dataset.key; render(); },
  skip: el => {
    const it = findItem(el.dataset.key); if (!it) return;
    mutateItem(UI.ym, it, it.skip ? { skip: false } : { skip: true, done: false, date: null, txn: null });
    render();
  },
  'del-extra': el => {
    const it = findItem(el.dataset.key); if (!it || !it.extra) return;
    const mo = D.months[UI.ym]; mo.extras = mo.extras.filter(x => x !== it.extra); touchMonth(UI.ym);
    UI.open = null; render(); toast(`Deleted ${it.name}.`);
  },
  'edit-tmpl': el => openTemplateDialog(el.dataset.id),
  'add-tmpl': el => openTemplateDialog(null, { type: el.dataset.type }),
  'add-extra': el => openExtraDialog(el.dataset.type),
  'load-sample': () => { if (!isBlank()) return; loadSample(); render(); toast('Example data loaded. Clear it any time from the banner.'); },
  'clear-sample': () => askConfirm({ title: 'Clear the example data?', text: 'This removes the example bills, income, statement lines and check-offs. Anything you added yourself while the examples were showing is removed too.', ok: 'Clear example data', danger: true },
    async () => { D = emptyData(); await Store.replaceAll(); UI.open = null; render(); toast('Cleared. You are starting fresh.'); }),
  sub: el => { UI.sub = el.dataset.sub; render(); },
  'choose-files': () => $('#file').click(),
  'apply-sugg': () => {
    const ym = reconcileMonth(); let n = 0;
    for (const cb of $$('input[data-sg]:checked')) {
      const [key, id] = cb.dataset.sg.split('|'), it = findItem(key, ym), t = txnById(id);
      if (it && t) { linkItem(ym, it, t); n++; }
    }
    render(); toast(n ? `Matched ${plural(n, 'bill')} to the statement.` : 'Nothing was selected.');
  },
  unlink: el => { const it = findItem(el.dataset.key); if (it) { unlinkItem(curYm(), it); render(); } },
  'track-txn': el => {
    const t = txnById(el.dataset.id); if (!t) return;
    openTemplateDialog(null, { type: 'bill', name: titleCase(merchantKey(t.desc)), amount: Math.abs(t.amt), category: NON_SPEND.has(t.cat) ? 'Other' : t.cat, day: +t.date.slice(8, 10), match: merchantKey(t.desc), start: ymOf(t.date), linkTxn: t.id });
  },
  'show-month-txns': el => { UI.sub = 'transactions'; UI.fm = el.dataset.ym; UI.fc = 'all'; UI.q = ''; UI.fu = false; UI.txLimit = 100; render(); },
  'del-txn': el => { deleteTxn(el.dataset.id); $('#txnList').innerHTML = txnTable(); },
  'more-txns': () => { UI.txLimit += 200; $('#txnList').innerHTML = txnTable(); },
  'del-import': el => {
    const id = el.dataset.id;
    if (UI.confirm !== id) { UI.confirm = id; render(); setTimeout(() => { if (UI.confirm === id) { UI.confirm = null; if (UI.tab === 'statements') render(); } }, 4000); return; }
    UI.confirm = null;
    const ids = new Set(D.txns.filter(t => t.src === id).map(t => t.id));
    new Set(D.txns.filter(t => ids.has(t.id)).map(t => ymOf(t.date))).forEach(touchTxns);
    D.txns = D.txns.filter(t => !ids.has(t.id));
    D.imports = D.imports.filter(i => i.id !== id); touchMeta();
    for (const [ym, mo] of Object.entries(D.months)) {
      for (const e of Object.values(mo.entries)) if (ids.has(e.txn)) { delete e.txn; touchMonth(ym); }
      for (const x of mo.extras) if (ids.has(x.txn)) { delete x.txn; touchMonth(ym); }
    }
    render(); toast('File removed.');
  },
  drill: el => {
    const { from, to } = rangeFor(UI.range);
    UI.tab = 'statements'; UI.sub = 'transactions'; UI.fc = el.dataset.cat; UI.fm = from === to ? from : 'all'; UI.q = ''; UI.fu = false; UI.txLimit = 100;
    render(); scrollTo(0, 0);
  },
  'add-recurring': el => {
    const r = UI.rec[+el.dataset.idx]; if (!r) return;
    openTemplateDialog(null, { type: 'bill', name: r.name, amount: r.amount, category: NON_SPEND.has(r.cat) ? 'Other' : r.cat, day: r.day, match: r.key });
  },
  settings: () => openSettings(),
  'close-modal': () => closeModal(),
  'cat-add': () => {
    const name = $('#newcat').value.trim();
    if (!name || D.cats.some(c => c.toLowerCase() === name.toLowerCase())) return;
    const i = D.cats.indexOf('Income'); D.cats.splice(i < 0 ? D.cats.length : i, 0, name); touchMeta(); openSettings();
  },
  'cat-del': el => { D.cats = D.cats.filter(c => c !== el.dataset.cat); touchMeta(); openSettings(); },
  'export-json': () => saveFile(`bill-ledger-backup-${todayStr()}.json`, backupText(), 'application/json'),
  'export-csv': () => saveFile(`transactions-${todayStr()}.csv`, txnCSV(), 'text/csv'),
  'restore-pick': () => $('#restore').click(),
  erase: () => askConfirm({ title: 'Erase all data?', text: 'This deletes every bill, income source, check-off and statement line, and it cannot be undone. Export a backup first if you might want anything back.', ok: 'Erase everything', danger: true },
    async () => { D = emptyData(); await Store.replaceAll(); UI.open = null; render(); toast('All data erased.'); }, () => openSettings()),
  'imp-go': () => commitImport(),
  'imp-skip': () => { closeModal(true); IM = null; nextImport(); },
  'imp-cancel-all': () => { closeModal(true); IM = null; IMQ = []; finishImports(); },
  'imp-row-flip': el => { const r = IM.rows[+el.dataset.i]; if (r) { r.amt = -r.amt; $('#impPrev').innerHTML = previewTable(); } }
};
const RO_OK = new Set(['tab', 'month-prev', 'month-next', 'month-today']);
const RO_CHANGE = new Set(['hidepaid', 'range']);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (RO() && !RO_OK.has(el.dataset.act)) return;
  if (el.dataset.act !== 'del-import') UI.confirm = null;
  const h = ACTIONS[el.dataset.act];
  if (h) h(el, e);
});

const CHANGE = {
  hidepaid: el => { UI.hidePaid = el.checked; render(); },
  amount: el => {
    const it = findItem(el.dataset.key), v = parseFloat(el.value);
    if (!it || isNaN(v) || v < 0) { render(); return; }
    const a = r2(v);
    mutateItem(curYm(), it, { amount: it.rec && a === it.planned ? null : a }); render();
  },
  paiddate: el => { const it = findItem(el.dataset.key); if (it) { mutateItem(curYm(), it, { date: el.value || null }); render(); } },
  note: el => { const it = findItem(el.dataset.key); if (it) { mutateItem(curYm(), it, { note: el.value.trim() }); render(); } },
  link: el => {
    const it = findItem(el.dataset.key), t = el.value ? txnById(el.value) : null;
    if (!it) return;
    if (t) linkItem(curYm(), it, t); else unlinkItem(curYm(), it);
    render();
  },
  txncat: el => {
    const t = txnById(el.dataset.id); if (!t) return;
    const n = setCategory(t, el.value); render();
    if (n) toast(`Also moved ${plural(n, 'similar line')} to ${el.value}.`);
  },
  fm: el => { UI.fm = el.value; UI.txLimit = 100; render(); },
  fc: el => { UI.fc = el.value; UI.txLimit = 100; render(); },
  fu: el => { UI.fu = el.checked; UI.txLimit = 100; render(); },
  rm: el => { UI.rm = el.value; render(); },
  range: el => { UI.range = el.value; render(); },
  currency: el => { D.settings.currency = el.value; touchMeta(); render(); },
  'imp-map': el => { IM.map[el.dataset.k] = parseInt(el.value, 10); recomputeImport(); openImportDialog(); },
  'imp-datefmt': el => { IM.dateFmt = el.value; recomputeImport(); openImportDialog(); },
  'imp-flip': el => { IM.flip = el.checked; recomputeImport(); openImportDialog(); },
  'imp-inc': el => { const r = IM.rows[+el.dataset.i]; if (r) { r.include = el.checked; el.closest('tr').classList.toggle('off', !el.checked); refreshImportSummary(); } }
};
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el && CHANGE[el.dataset.chg] && (!RO() || RO_CHANGE.has(el.dataset.chg))) CHANGE[el.dataset.chg](el);
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { UI.q = e.target.value; UI.txLimit = 100; $('#txnList').innerHTML = txnTable(); }
  else if (e.target.id === 'imp-label' && IM) IM.label = e.target.value;
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'tf') submitTemplate();
  else if (e.target.id === 'xf') submitExtra(e.target.dataset.type);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
for (const ev of ['pointermove', 'pointerdown']) {
  document.addEventListener(ev, e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el, e); else hideTip(); });
}
document.addEventListener('scroll', hideTip, { passive: true });

/* files: picker and drag-and-drop */
$('#file').addEventListener('change', e => { if (RO()) return; const files = [...e.target.files]; e.target.value = ''; handleFiles(files); });
document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); const d = $('#drop'); if (d) d.classList.add('over'); } });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) { const d = $('#drop'); if (d) d.classList.remove('over'); } });
document.addEventListener('drop', e => {
  if (RO()) return;
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); const d = $('#drop'); if (d) d.classList.remove('over'); handleFiles(e.dataTransfer.files); }
});

let resizeT = null;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (UI.tab === 'spending' && $('#modal').hidden) render(); }, 200); });

/* ---------- start ---------- */
async function main() {
  $('#top').innerHTML = chromeHTML();
  $('#saveState').replaceWith(saveChip());
  $('#app').innerHTML = '<div class="empty"><p>Loading your ledger…</p></div>';
  await Store.init();
  $('#top').innerHTML = chromeHTML();
  $('#saveState').replaceWith(saveChip());
  const hash = location.hash.slice(1);
  let saved = null; try { saved = localStorage.getItem('billledger.tab'); } catch (e) { /* ignore */ }
  const pick = [hash, saved].find(t => visibleTabs().some(x => x[0] === t));
  if (pick) UI.tab = pick;
  render();
}
main().catch(err => {
  $('#app').innerHTML = `<div class="empty"><h3>Could not open your ledger</h3><p>${esc(err && err.message ? err.message : err)}</p><button class="btn primary" onclick="location.reload()">Try again</button></div>`;
});
