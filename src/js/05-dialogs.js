/* ---------- modal, toast, tooltip ---------- */
let modalOnClose = null;
function openModal(html, o = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="dlg${o.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false; document.body.style.overflow = 'hidden';
  modalOnClose = o.onClose || null;
  const f = m.querySelector('[autofocus]') || m.querySelector('input:not([type=checkbox]),select,textarea');
  if (f) f.focus({ preventScroll: true });
}
function closeModal(silent) {
  const m = $('#modal'), cb = modalOnClose;
  modalOnClose = null; m.hidden = true; m.innerHTML = ''; document.body.style.overflow = '';
  if (cb && !silent) cb();
}
const dlgHead = (title, sub = '') => `<div class="dlg-h"><div><h2>${title}</h2>${sub ? `<p class="muted" style="font-size:14px;margin-top:2px">${sub}</p>` : ''}</div><button type="button" class="icon-btn" data-act="close-modal" aria-label="Close">&times;</button></div>`;
let toastTimer = null;
function toast(msg, o = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button" id="toastAct">${esc(o.action)}</button>` : ''}`;
  t.hidden = false;
  if (o.action) $('#toastAct').onclick = () => { t.hidden = true; o.fn && o.fn(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, o.ms || 5000);
}
function showTip(el, e) {
  let d; try { d = JSON.parse(el.dataset.tip); } catch (err) { return; }
  const tip = $('#tip');
  tip.innerHTML = `<b>${esc(d.t)}</b>${d.rows.map(r => `<div>${r[2] ? `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:var(--${r[2]})"></i>` : ''}${esc(r[0])} <span class="num">${esc(r[1])}</span></div>`).join('')}`;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - w - 8)) + 'px';
  tip.style.top = (e.clientY + 16 + h > innerHeight ? e.clientY - h - 12 : e.clientY + 16) + 'px';
}
const hideTip = () => { $('#tip').hidden = true; };
function askConfirm({ title, text, ok, danger }, onOk, back) {
  openModal(`${dlgHead(esc(title))}<div class="dlg-b"><p>${text}</p></div><div class="dlg-f"><button type="button" class="btn" data-act="${back ? 'confirm-back' : 'close-modal'}">Cancel</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" id="confirmOk">${esc(ok)}</button></div>`);
  $('#confirmOk').onclick = () => { closeModal(true); onOk(); };
  if (back) $('#modal').querySelector('[data-act=confirm-back]').onclick = back;
}
async function saveFile(name, text, mime) {
  try {
    if (window.claude && window.claude.use) {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename: name, data: text }); toast('Saved ' + name); return; }
    }
  } catch (e) { if (e && e.code === 'declined') return; if (window.claude) return showText(name, text); }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  } catch (e) { showText(name, text); }
}
function showText(name, text) {
  openModal(`${dlgHead(esc(name))}<div class="dlg-b"><p class="muted">Your browser blocked the download. Copy this text and save it as ${esc(name)}.</p><textarea class="inp" id="copyBox" rows="10" readonly style="font-family:var(--f-data);font-size:12px">${esc(text)}</textarea></div><div class="dlg-f"><button type="button" class="btn primary" id="copyBtn">Copy</button></div>`);
  $('#copyBox').select();
  $('#copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { $('#copyBox').select(); toast('Press Ctrl+C to copy'); } };
}

/* ---------- recurring bill / income dialog ---------- */
function tmplFields(v) {
  const f = v.freq, out = [];
  const dayHint = '<small>Short months use their last day.</small>';
  if (['monthly', 'quarterly', 'semiannual', 'yearly'].includes(f)) out.push(`<label class="field">Day of the month<input id="tf-day" type="number" min="1" max="31" value="${v.day}" required>${dayHint}</label>`);
  if (f === 'twice') out.push(`<label class="field">First day<input id="tf-day" type="number" min="1" max="31" value="${v.day}" required></label><label class="field">Second day<input id="tf-day2" type="number" min="1" max="31" value="${v.day2 || 15}" required></label>`);
  if (f === 'weekly' || f === 'biweekly') out.push(`<label class="field">A date it lands on<input id="tf-anchor" type="date" value="${esc(v.anchor)}" required><small>Any past or future ${v.type === 'income' ? 'payday' : 'due date'}. The others are counted from it.</small></label>`);
  if (['quarterly', 'semiannual', 'yearly'].includes(f)) out.push(`<label class="field">${f === 'yearly' ? 'Month' : 'First month'}<select id="tf-month">${MONTHS.map((m, i) => `<option value="${i + 1}"${(v.month || 1) === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></label>`);
  return out.join('');
}
let TF = null;
function openTemplateDialog(id, preset = {}) {
  const t = id ? D.templates.find(x => x.id === id) : null;
  const type = t ? t.type : (preset.type || 'bill');
  TF = t ? { ...t } : Object.assign({ type, name: '', amount: '', category: type === 'income' ? 'Income' : 'Other', freq: 'monthly', day: 1, day2: 15, anchor: todayStr(), month: +thisMonth().slice(5), match: '', autopay: false, budget: false, start: thisMonth(), end: '' }, preset);
  TF.id = t ? t.id : null; TF.editing = !!t;
  const budget = !!TF.budget, word = type === 'income' ? 'income' : budget ? 'budget' : 'bill';
  openModal(`<form id="tf">${dlgHead(`${t ? 'Edit' : 'Add'} ${word}`, budget ? 'A monthly limit. You enter what you spend and it keeps a running total.' : t ? 'Changes apply to every month that includes it.' : '')}
    <div class="dlg-b">
      <div class="grid2"><label class="field">Name<input id="tf-name" type="text" value="${esc(TF.name)}" required placeholder="${type === 'income' ? 'Paycheck' : budget ? 'Groceries' : 'Electric'}" autocomplete="off"></label>
        <label class="field">${budget ? 'Monthly budget' : 'Amount'}<input id="tf-amount" class="num" type="number" step="0.01" min="0" value="${TF.amount}" required inputmode="decimal"></label></div>
      <div class="grid2">${budget ? '' : `<label class="field">Repeats<select id="tf-freq">${Object.entries(FREQ).map(([k, l]) => `<option value="${k}"${TF.freq === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`}
        ${type === 'bill' ? `<label class="field">Category<select id="tf-cat">${catOptions(TF.category, spendCats())}</select></label>` : ''}</div>
      ${budget ? '' : `<div class="grid2" id="tf-dyn">${tmplFields(TF)}</div>`}
      <div class="grid2"><label class="field">Starts in<input id="tf-start" type="month" value="${esc(TF.start || '')}" placeholder="YYYY-MM" pattern="\\d{4}-\\d{2}"><small>Use an earlier month to include past months you want to reconcile.</small></label>
        <label class="field">Last month (optional)<input id="tf-end" type="month" value="${esc(TF.end || '')}" placeholder="YYYY-MM" pattern="\\d{4}-\\d{2}"><small>Set this when it stops. Older months keep their history.</small></label></div>
      ${budget ? '' : `<label class="field">Text on your statement<input id="tf-match" type="text" value="${esc(TF.match || '')}" placeholder="${type === 'income' ? 'ACME PAYROLL' : 'CITY POWER'}" autocomplete="off"><small>Optional. Words from the bank's description, separated by commas. Helps match this to statement lines.</small></label>`}
      ${type === 'bill' && !budget ? `<label class="checkline"><input id="tf-auto" type="checkbox"${TF.autopay ? ' checked' : ''}> It is paid automatically (shows an Auto tag)</label>` : ''}
    </div>
    <div class="dlg-f">${t ? '<button type="button" class="btn danger sp" id="tf-del">Delete</button>' : ''}<button type="button" class="btn" data-act="close-modal">Cancel</button><button type="submit" class="btn primary">${t ? 'Save changes' : 'Add ' + word}</button></div></form>`);
  if ($('#tf-freq')) $('#tf-freq').onchange = e => { TF.freq = e.target.value; readTmplForm(true); $('#tf-dyn').innerHTML = tmplFields(TF); };
  if (t) $('#tf-del').onclick = e => {
    const b = e.currentTarget;
    if (b.dataset.sure) { D.templates = D.templates.filter(x => x.id !== t.id); touchMeta(); closeModal(true); render(); toast(`Deleted ${t.name}.`); return; }
    b.dataset.sure = '1'; b.textContent = 'Remove from every month?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = 'Delete'; } }, 4000);
  };
}
function readTmplForm(soft) {
  const g = id => { const el = $('#' + id); return el ? el.value : undefined; };
  if (g('tf-name') !== undefined) TF.name = g('tf-name').trim();
  if (g('tf-amount') !== undefined) TF.amount = g('tf-amount');
  if (g('tf-cat') !== undefined) TF.category = g('tf-cat');
  if (g('tf-day') !== undefined) TF.day = parseInt(g('tf-day'), 10) || 1;
  if (g('tf-day2') !== undefined) TF.day2 = parseInt(g('tf-day2'), 10) || 15;
  if (g('tf-anchor') !== undefined) TF.anchor = g('tf-anchor');
  if (g('tf-month') !== undefined) TF.month = parseInt(g('tf-month'), 10);
  if (g('tf-start') !== undefined) TF.start = g('tf-start');
  if (g('tf-end') !== undefined) TF.end = g('tf-end');
  if (g('tf-match') !== undefined) TF.match = g('tf-match').trim();
  if ($('#tf-auto')) TF.autopay = $('#tf-auto').checked;
  if (!soft && g('tf-freq') !== undefined) TF.freq = g('tf-freq');
}
function submitTemplate() {
  readTmplForm();
  const amount = parseFloat(TF.amount);
  if (TF.budget && !TF.name) { toast('Add a name and a monthly budget.'); return; }
  if (!TF.name || isNaN(amount) || amount < 0) { toast('Add a name and an amount.'); return; }
  if ((TF.freq === 'weekly' || TF.freq === 'biweekly') && !TF.anchor) { toast('Pick a date it lands on.'); return; }
  const ok = /^\d{4}-\d{2}$/;
  const obj = { type: TF.type, name: TF.name, amount: r2(amount), category: TF.type === 'income' ? 'Income' : (TF.category || 'Other'), freq: TF.budget ? 'monthly' : TF.freq, day: TF.budget ? 1 : Math.min(31, Math.max(1, TF.day || 1)), day2: Math.min(31, Math.max(1, TF.day2 || 15)), anchor: TF.anchor, month: TF.month || 1, match: TF.match, autopay: !!TF.autopay, start: ok.test(TF.start || '') ? TF.start : '', end: ok.test(TF.end || '') ? TF.end : '' };
  for (const k of ['anchor', 'start', 'end', 'match']) if (!obj[k]) delete obj[k];
  if (!obj.autopay) delete obj.autopay;
  if (TF.budget) obj.budget = true;
  let t;
  if (TF.editing) { t = D.templates.find(x => x.id === TF.id); for (const k of ['anchor', 'start', 'end', 'match', 'autopay', 'budget']) delete t[k]; Object.assign(t, obj); }
  else { t = { id: uid('b'), ...obj }; D.templates.push(t); }
  touchMeta();
  const link = TF.linkTxn && txnById(TF.linkTxn);
  closeModal(true);
  if (link) { const it = itemsFor(ymOf(link.date)).find(i => i.tmpl && i.tmpl.id === t.id); if (it) linkItem(ymOf(link.date), it, link); }
  render();
  toast(TF.editing ? 'Saved.' : `Added ${t.name}.`);
}

/* ---------- one-off bill or income for a single month ---------- */
function openExtraDialog(type) {
  const ym = UI.ym, cur = thisMonth();
  const date = ym === cur ? todayStr() : ym + '-01';
  openModal(`<form id="xf" data-type="${type}">${dlgHead(type === 'income' ? 'One-time income' : 'One-time bill')}
    <div class="dlg-b"><div class="grid2"><label class="field">Name<input id="xf-name" type="text" required placeholder="${type === 'income' ? 'Tax refund' : 'Car registration'}" autocomplete="off"></label>
      <label class="field">Amount<input id="xf-amount" class="num" type="number" step="0.01" min="0" required inputmode="decimal"></label></div>
      <div class="grid2"><label class="field">${type === 'income' ? 'Expected on' : 'Due on'}<input id="xf-date" type="date" value="${date}" required></label>
      ${type === 'bill' ? `<label class="field">Category<select id="xf-cat">${catOptions('Other', spendCats())}</select></label>` : ''}</div>
      <label class="checkline"><input id="xf-done" type="checkbox"> Already ${type === 'income' ? 'received' : 'paid'}</label></div>
    <div class="dlg-f"><button type="button" class="btn" data-act="close-modal">Cancel</button><button type="submit" class="btn primary">Add</button></div></form>`);
}
function submitExtra(type) {
  const name = $('#xf-name').value.trim(), amount = parseFloat($('#xf-amount').value), date = $('#xf-date').value, done = $('#xf-done').checked;
  if (!name || isNaN(amount) || amount < 0 || !date) { toast('Add a name, an amount and a date.'); return; }
  const ym = ymOf(date), x = { id: uid('x'), type, name, amount: r2(amount), date, category: type === 'income' ? 'Income' : $('#xf-cat').value };
  if (done) { x.done = true; x.doneDate = date > todayStr() ? todayStr() : date; }
  ensureMonth(ym).extras.push(x); touchMonth(ym);
  UI.ym = ym; closeModal(true); render(); toast(`Added ${name}.`);
}

/* ---------- spending budget entries ---------- */
function submitSpend(f) {
  const amount = parseFloat(f.elements.amount.value), date = f.elements.date.value || todayStr(), note = f.elements.note.value.trim();
  if (isNaN(amount) || amount <= 0) { toast('Enter the amount you spent.'); return; }
  const ym = ymOf(date);
  ensureMonth(ym).spends.push({ id: uid('s'), t: f.dataset.tid, date, amount: r2(amount), ...(note ? { note } : {}) });
  touchMonth(ym);
  const tid = f.dataset.tid;
  render();
  if (ym !== UI.ym) toast(`Added to ${fmtMonth(ym)}.`);
  if (!matchMedia('(pointer: coarse)').matches) { const next = $(`.spendf[data-tid="${tid}"] input[name=amount]`); if (next) next.focus(); }
}
function removeSpend(id) {
  const mo = D.months[UI.ym], s = mo && mo.spends.find(x => x.id === id);
  if (!s) return;
  mo.spends = mo.spends.filter(x => x.id !== id); touchMonth(UI.ym); render();
  toast(`Removed ${money(s.amount)}.`, { action: 'Undo', fn: () => { ensureMonth(UI.ym).spends.push(s); touchMonth(UI.ym); render(); } });
}

/* ---------- statement import ---------- */
let IM = null, IMQ = [], IMN = 0, IMSTAT = { added: 0, files: 0, months: {} };
async function prepareFile(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    const lines = await extractPdfLines(await f.arrayBuffer());
    const r = parsePdfLines(lines);
    if (!r.txns.length) throw new Error('no transactions found in this PDF. Download the CSV version from your bank if it offers one');
    return { name: f.name, kind: 'pdf', txns: r.txns };
  }
  const text = await f.text();
  if (ext === 'ofx' || ext === 'qfx' || /<OFX>|<STMTTRN>/i.test(text)) {
    const txns = parseOFX(text);
    if (!txns.length) throw new Error('no transactions found');
    return { name: f.name, kind: 'ofx', txns };
  }
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('the file looks empty');
  return Object.assign({ name: f.name, kind: 'csv' }, analyzeCSV(rows));
}
async function handleFiles(list) {
  const files = [...list];
  if (!files.length) return;
  toast(`Reading ${plural(files.length, 'file')}…`, { ms: 20000 });
  const prepared = [], errors = [];
  for (const f of files) { try { prepared.push(await prepareFile(f)); } catch (err) { errors.push(`${f.name}: ${err.message || err}`); } }
  if (errors.length) toast(errors.join(' · '), { ms: 10000 }); else $('#toast').hidden = true;
  IMQ = prepared; IMN = prepared.length; IMSTAT = { added: 0, files: 0, months: {} };
  nextImport();
}
function nextImport() {
  const f = IMQ.shift();
  if (!f) { finishImports(); return; }
  IM = { file: f, idx: IMN - IMQ.length, total: IMN, label: f.name.replace(/\.[^.]+$/, ''), flip: f.kind === 'csv' ? suggestFlip(f.body, f.map) : false, map: f.map ? { ...f.map } : null, dateFmt: f.dateFmt || 'mdy', rows: [], bad: 0 };
  recomputeImport();
  openImportDialog();
}
function recomputeImport() {
  const f = IM.file;
  let txns, bad = 0;
  if (f.kind === 'csv') ({ txns, bad } = rowsToTxns(f.body, IM.map, { dateFmt: IM.dateFmt, flip: IM.flip, useType: f.useType }));
  else txns = f.txns.map(t => ({ ...t, amt: IM.flip ? -t.amt : t.amt }));
  flagDuplicates(txns);
  txns.forEach(t => { t.include = !t.dup; });
  IM.rows = txns; IM.bad = bad;
}
function importSummary() {
  const inc = IM.rows.filter(r => r.include), dups = IM.rows.filter(r => r.dup).length;
  const dates = inc.map(r => r.date).sort();
  return { n: inc.length, dups, text: `${plural(inc.length, 'transaction')} to import${dates.length ? ` · ${fmtShort(dates[0])} to ${fmtDate(dates[dates.length - 1])}` : ''}${dups ? ` · ${dups} already imported` : ''}${IM.bad ? ` · ${plural(IM.bad, 'row')} skipped (no date or amount)` : ''}` };
}
function openImportDialog() {
  const f = IM.file, m = IM.map, sel = (key, label, allowNone) => `<label class="field">${label}<select data-chg="imp-map" data-k="${key}">${allowNone ? '<option value="-1">None</option>' : ''}${f.headers.map((h, i) => `<option value="${i}"${m[key] === i ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`;
  const S = importSummary();
  const mapping = f.kind === 'csv' ? `<div class="grid2">${sel('date', 'Date column')}${sel('desc', 'Description column')}${sel('amount', 'Amount column', true)}
      ${m.amount < 0 || m.debit > -1 || m.credit > -1 ? sel('debit', 'Money out column', true) + sel('credit', 'Money in column', true) : ''}
      <label class="field">Date order<select data-chg="imp-datefmt"><option value="mdy"${IM.dateFmt === 'mdy' ? ' selected' : ''}>Month / Day / Year</option><option value="dmy"${IM.dateFmt === 'dmy' ? ' selected' : ''}>Day / Month / Year</option></select></label></div>` : '';
  const note = f.kind === 'pdf' ? '<div class="banner"><span>PDF statements are read as text, so check each line. Use the arrows to flip a wrong sign. A CSV from your bank is more reliable.</span></div>' : '';
  openModal(`${dlgHead('Add statement', `${esc(f.name)}${IM.total > 1 ? ` · file ${IM.idx} of ${IM.total}` : ''}`)}
    <div class="dlg-b">${note}
      <label class="field">Account name<input id="imp-label" type="text" value="${esc(IM.label)}" placeholder="Checking" autocomplete="off"><small>Just for your own reference in the file list.</small></label>
      ${mapping}
      <label class="checkline"><input type="checkbox" data-chg="imp-flip"${IM.flip ? ' checked' : ''}><span>Flip signs: charges and purchases are positive in this file${f.kind === 'csv' && suggestFlip(f.body, f.map) ? ' (every amount is positive, which usually means a credit card export)' : ''}</span></label>
      <div><div id="impSummary" class="muted" style="font-size:14px;margin-bottom:6px">${esc(S.text)}</div>
        <div class="prev" id="impPrev">${previewTable()}</div></div>
    </div>
    <div class="dlg-f"><button type="button" class="btn sp" data-act="imp-skip">${IMQ.length ? 'Skip this file' : 'Cancel'}</button>${IMQ.length ? '<button type="button" class="btn" data-act="imp-cancel-all">Cancel all</button>' : ''}<button type="button" class="btn primary" id="impGo" data-act="imp-go"${S.n ? '' : ' disabled'}>Import ${plural(S.n, 'transaction')}</button></div>`, { wide: true, onClose: () => { IM = null; IMQ = []; finishImports(); } });
}
function previewTable() {
  if (!IM.rows.length) return '<p class="muted" style="padding:14px">No transactions could be read with these settings. Check the column choices above.</p>';
  const rows = IM.rows.slice(0, 120);
  return `<table class="tbl"><thead><tr><th></th><th>Date</th><th>Description</th><th class="r">Amount</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.include ? '' : 'off'}"><td><input type="checkbox" data-chg="imp-inc" data-i="${i}"${r.include ? ' checked' : ''} aria-label="Include this line"></td><td class="num">${fmtShort(r.date)}${r.date.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + r.date.slice(0, 4) : ''}</td><td class="desc">${esc(r.desc)}${r.dup ? ' <span class="pill">already imported</span>' : ''}</td><td class="r num ${r.amt < 0 ? 'out' : 'in'}">${money(r.amt)}</td><td><button type="button" class="btn ghost sm" data-act="imp-row-flip" data-i="${i}" title="Flip sign" aria-label="Flip sign">&#8645;</button></td></tr>`).join('')}</tbody></table>${IM.rows.length > 120 ? `<p class="muted" style="padding:8px 12px;font-size:13px">Showing the first 120 of ${IM.rows.length}. All checked lines are imported.</p>` : ''}`;
}
function refreshImportSummary() {
  const S = importSummary();
  $('#impSummary').textContent = S.text;
  const go = $('#impGo'); go.disabled = !S.n; go.textContent = `Import ${plural(S.n, 'transaction')}`;
}
function commitImport() {
  const rows = IM.rows.filter(r => r.include);
  if (!rows.length) return;
  const id = uid('i');
  let from = '9999', to = '0000';
  for (const r of rows) {
    const t = { id: uid('t'), date: r.date, desc: r.desc, amt: r2(r.amt), src: id };
    t.cat = autoCategory(t.desc, t.amt);
    D.txns.push(t); touchTxns(ymOf(t.date));
    if (r.date < from) from = r.date; if (r.date > to) to = r.date;
    const m = ymOf(r.date); IMSTAT.months[m] = (IMSTAT.months[m] || 0) + 1;
  }
  D.txns.sort((a, b) => a.date.localeCompare(b.date));
  D.imports.push({ id, name: IM.file.name, label: IM.label.trim(), at: Date.now(), count: rows.length, from, to });
  touchMeta();
  IMSTAT.added += rows.length; IMSTAT.files++;
  closeModal(true); IM = null;
  nextImport();
}
function finishImports() {
  IM = null;
  if (!IMSTAT.added) { render(); return; }
  const months = Object.entries(IMSTAT.months).sort((a, b) => b[1] - a[1]);
  UI.tab = 'statements'; UI.sub = 'reconcile'; UI.rm = months[0][0];
  render(); scrollTo(0, 0);
  toast(`Added ${plural(IMSTAT.added, 'transaction')} from ${plural(IMSTAT.files, 'file')}.`, { ms: 7000 });
}

/* ---------- settings and backup ---------- */
const PROTECTED = new Set(['Income', 'Transfer', 'Other']);
function openSettings() {
  const where = Store.mode === 'cloud' ? 'Your data is saved with this page on your Claude account, so it is the same on every device where you open it. Only you can change it.' : Store.mode === 'browser' ? 'Your data is saved in this browser only. Export a backup now and then, and before clearing browser data.' : 'Saving is unavailable in this browser. Export a backup before you close this page.';
  const cur = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'INR', 'MXN', 'CHF', 'SEK', 'ZAR'];
  const used = new Set([...D.txns.map(t => t.cat), ...D.templates.map(t => t.category)]);
  openModal(`${dlgHead('Settings and backup')}<div class="dlg-b">
    <div><h3 style="font-size:15px">Where your data lives</h3><p class="muted" style="font-size:14px;margin-top:4px">${where}</p></div>
    <div><h3 style="font-size:15px">Share a view-only copy</h3><p class="muted" style="font-size:14px;margin-top:4px">${Store.mode === 'cloud' ? 'Open the Share menu on this page in Claude and invite your spouse by email as a <b>Viewer</b>. They will see Month, Obligations and Spending, kept up to date, and cannot change anything. Invite by email rather than turning on a public link: anyone who can open a public link and sign in to Claude could read your finances.' : 'Sharing needs the published version of this page. In this copy, data stays in this browser.'}</p></div>
    <label class="field">Currency<select data-chg="currency">${cur.map(c => `<option${D.settings.currency === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
    <div><h3 style="font-size:15px">Categories</h3><div class="actions" style="margin-top:8px">${D.cats.map(c => `<span class="pill">${esc(c)}${PROTECTED.has(c) || used.has(c) ? '' : ` <button type="button" class="btn ghost sm" style="min-height:0;padding:0 2px" data-act="cat-del" data-cat="${esc(c)}" aria-label="Remove ${esc(c)}">&times;</button>`}</span>`).join('')}</div>
      <div class="actions" style="margin-top:10px"><input class="inp sm" id="newcat" type="text" placeholder="New category" style="width:180px" autocomplete="off"><button type="button" class="btn sm" data-act="cat-add">Add</button></div></div>
    <div><h3 style="font-size:15px">Backup</h3><div class="actions" style="margin-top:8px"><button type="button" class="btn" data-act="export-json">Export backup</button><button type="button" class="btn" data-act="restore-pick">Restore from backup</button><button type="button" class="btn" data-act="export-csv">Export transactions (CSV)</button></div>
      <input type="file" id="restore" accept=".json,application/json" hidden></div>
    <div><h3 style="font-size:15px">Erase everything</h3><p class="muted" style="font-size:14px;margin:4px 0 8px">Deletes all bills, income, check-offs and statements.</p><button type="button" class="btn danger" data-act="erase">Erase all data</button></div>
  </div><div class="dlg-f"><button type="button" class="btn primary" data-act="close-modal">Done</button></div>`);
  $('#restore').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); };
}
function backupText() { return JSON.stringify({ app: 'bill-ledger', v: 1, exported: new Date().toISOString(), data: D }, null, 1); }
function csvEscape(s) { s = String(s ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function txnCSV() {
  const acct = id => (D.imports.find(i => i.id === id) || {}).label || '';
  return ['Date,Description,Amount,Category,Account', ...D.txns.map(t => [t.date, t.desc, t.amt.toFixed(2), t.cat, acct(t.src)].map(csvEscape).join(','))].join('\n');
}
async function restoreBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch (e) { toast('That file is not a Bill Ledger backup.'); return; }
  if (!obj || obj.app !== 'bill-ledger' || !obj.data || !Array.isArray(obj.data.templates)) { toast('That file is not a Bill Ledger backup.'); return; }
  askConfirm({ title: 'Replace everything with this backup?', text: `Backup from ${esc(obj.exported ? new Date(obj.exported).toLocaleString() : 'unknown date')}: ${plural(obj.data.templates.length, 'recurring item')}, ${plural((obj.data.txns || []).length, 'transaction')}. What you have now will be overwritten.`, ok: 'Replace', danger: true }, async () => {
    const d = Object.assign(emptyData(), obj.data);
    d.settings = Object.assign({ currency: 'USD' }, d.settings);
    D = d; await Store.replaceAll(); render(); toast('Backup restored.');
  }, () => openSettings());
}
