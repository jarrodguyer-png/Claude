/* ---------- views ---------- */
const UI = { tab: 'month', ym: thisMonth(), open: null, hidePaid: false, sub: 'reconcile', rm: null, range: '6', q: '', fm: 'all', fc: 'all', fu: false, txLimit: 100, confirm: null, rec: [] };
const txnById = id => D.txns.find(t => t.id === id);
const RO = () => Store.readonly;
const ICON = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.6l3.1 3L12.8 4.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevL: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3.5L5.5 9l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3.5L12.5 9 7 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 6.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zm7 3.2l-1.6-.9a5.8 5.8 0 000-2.2l1.5-1-1.6-2.7-1.7.8a6 6 0 00-1.9-1.1L11 1.3H8l-.5 1.8a6 6 0 00-1.9 1.1l-1.7-.8-1.6 2.7 1.5 1a5.8 5.8 0 000 2.2L2.9 10l1.6 2.8 1.7-.8c.6.5 1.2.8 1.9 1.1l.4 1.8h3l.5-1.8c.7-.3 1.3-.6 1.9-1.1l1.7.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  mark: '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="27" rx="8" fill="var(--accent)"/><path d="M8 11h14M8 15h14M8 19h7" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round" opacity=".55"/><path d="M17.5 20.2l2.6 2.4 4.6-5.4" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.4 2.3 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const TABS = [['month', 'Month'], ['obligations', 'Obligations'], ['statements', 'Statements'], ['spending', 'Spending']];

function chromeHTML() {
  return `<div class="brand">${ICON.mark}<span>Bill Ledger</span></div>
    <div class="top-r"><span id="saveState"></span>${RO() ? '' : `<button class="icon-btn" data-act="settings" aria-label="Settings and backup">${ICON.gear}</button>`}</div>`;
}
function emptyState(title, text, buttons = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${text}</p><div class="actions" style="justify-content:center">${buttons}</div></div>`;
}
function sampleBanner() {
  return D.sample && !RO() ? `<div class="banner info"><span>You are looking at example data. Try everything, then clear it to start with your own.</span><button class="btn sm" data-act="clear-sample">Clear example data</button></div>` : '';
}
const catOptions = (sel, cats = D.cats) => cats.map(c => `<option${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');

/* ----- Month ----- */
function viewMonth() {
  const ym = UI.ym, cur = thisMonth(), items = itemsFor(ym), S = summarize(items);
  const nav = `<div class="monthbar">
    <button class="icon-btn" data-act="month-prev" aria-label="Previous month">${ICON.chevL}</button>
    <h1 class="mtitle">${fmtMonth(ym)}</h1>
    <button class="icon-btn" data-act="month-next" aria-label="Next month">${ICON.chevR}</button>
    <span class="grow"></span>
    ${ym !== cur ? `<button class="btn sm" data-act="month-today">Back to ${fmtMonth(cur)}</button>` : ''}
  </div>`;
  if (!D.templates.length && !items.length) {
    return nav + `<section class="card">${RO() ? emptyState('Nothing here yet', 'Bills and income will appear here once they have been added.') : emptyState('Start with your monthly bills', 'List the bills that repeat and the income you expect. Each month then gets its own checklist, and you tick things off as they are paid.',
      `<button class="btn primary" data-act="add-tmpl" data-type="bill">Add a bill</button><button class="btn" data-act="add-tmpl" data-type="income">Add income</button>${isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''}`)}</section>`;
  }
  const pct = S.billsTotal ? Math.round(S.billsPaid / S.billsTotal * 100) : 0;
  const late = S.bills.filter(i => itemStatus(i) === 'late').length;
  const summary = `<section class="card" aria-label="Month summary">
    <div class="stats">
      <div class="stat lead"><div class="lbl">Still to pay</div><div class="val">${money(S.billsLeft)}</div><div class="sub">${plural(S.bills.length - S.billsDone, 'bill')} left</div></div>
      <div class="stat"><div class="lbl">Paid so far</div><div class="val">${money(S.billsPaid)}</div><div class="sub">${S.billsDone} of ${S.bills.length} bills</div></div>
      <div class="stat"><div class="lbl">Income received</div><div class="val">${money(S.incomeGot)}</div><div class="sub">of ${money(S.incomeTotal)} expected</div></div>
      <div class="stat"><div class="lbl">Left after bills</div><div class="val${S.leftover < 0 ? ' neg' : ''}">${money(S.leftover)}</div><div class="sub">expected income minus all bills</div></div>
    </div>
    <div class="progress"><div class="track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Bills paid"><i style="width:${pct}%"></i></div>
      <div class="cap"><span>${pct}% of this month's bills paid</span>${late ? `<span class="pill bad">${plural(late, 'bill')} overdue</span>` : ''}</div></div>
  </section>`;
  const bills = items.filter(i => i.type === 'bill'), inc = items.filter(i => i.type === 'income');
  const shown = UI.hidePaid ? bills.filter(i => !i.done) : bills;
  const billsCard = `<section class="card">
    <div class="card-h"><h2>Bills</h2><label class="checkline"><input type="checkbox" id="hidepaid" data-chg="hidepaid"${UI.hidePaid ? ' checked' : ''}> Hide paid</label></div>
    ${shown.length ? `<ul class="list">${shown.map(rowHTML).join('')}</ul>` : `<p class="muted" style="padding:6px 18px 16px">${bills.length ? 'Everything is paid. Nice.' : (RO() ? 'No bills this month.' : 'No bills this month. Recurring bills live under Obligations; add a one-time bill below.')}</p>`}
    <div class="card-f"><span class="total num">Total ${money(S.billsTotal)}</span>${RO() ? '' : '<button class="btn sm" data-act="add-extra" data-type="bill">+ One-time bill</button>'}</div>
  </section>`;
  const incCard = `<section class="card">
    <div class="card-h"><h2>Income</h2></div>
    ${inc.length ? `<ul class="list">${inc.map(rowHTML).join('')}</ul>` : `<p class="muted" style="padding:6px 18px 16px">No income listed for this month.</p>`}
    <div class="card-f"><span class="total num">Expected ${money(S.incomeTotal)}</span>${RO() ? '' : '<button class="btn sm" data-act="add-extra" data-type="income">+ One-time income</button>'}</div>
  </section>
  ${RO() ? '' : '<p class="muted" style="font-size:14px">Recurring bills and paychecks are managed under <button class="btn ghost sm" data-act="tab" data-tab="obligations">Obligations</button></p>'}`;
  return nav + summary + `<div class="cols"><div class="stack">${billsCard}</div><div class="stack">${incCard}</div></div>`;
}
function rowHTML(it) {
  const ro = RO(), st = itemStatus(it), open = UI.open === it.key && !ro, verb = it.type === 'income' ? 'received' : 'paid';
  const link = it.txn ? txnById(it.txn) : null, dis = ro || it.skip, tag = ro ? 'div' : 'button';
  return `<li class="row ${st}">
    <button class="chk" role="checkbox" aria-checked="${it.done}"${dis ? ' disabled' : ` data-act="toggle" data-key="${esc(it.key)}"`} aria-label="${esc(it.name)} ${it.done ? verb : 'not ' + verb}">${ICON.check}</button>
    <${tag} class="rmain"${ro ? '' : ` data-act="open" data-key="${esc(it.key)}" aria-expanded="${open}"`}>
      <span class="rname">${esc(it.name)}${it.autopay ? '<span class="tag">Auto</span>' : ''}</span>
      <span class="rmeta"><span class="due">${esc(dueText(it))}</span>${it.type === 'bill' && it.category ? `<span aria-hidden="true">·</span><span>${esc(it.category)}</span>` : ''}${link ? `<span class="pill good">${ICON.link} on statement</span>` : ''}${ro && it.note ? `<span aria-hidden="true">·</span><span>${esc(it.note)}</span>` : ''}</span>
    </${tag}>
    <span class="ramt">${money(it.amount)}</span>
    ${open ? detailHTML(it, link) : ''}
  </li>`;
}
function detailHTML(it, link) {
  const k = esc(it.key), verb = it.type === 'income' ? 'Received' : 'Paid';
  let linkBlock = '';
  if (D.txns.length) {
    const cands = candidatePool(UI.ym).map(t => ({ t, s: scoreMatch(it, t).s })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 25).map(x => x.t);
    if (link && !cands.includes(link)) cands.unshift(link);
    linkBlock = `<label class="field">Statement line<select data-chg="link" data-key="${k}"><option value="">${link ? 'Unlink' : 'Not linked'}</option>${cands.map(t => `<option value="${t.id}"${link && link.id === t.id ? ' selected' : ''}>${fmtShort(t.date)} · ${esc(t.desc.slice(0, 40))} · ${money(Math.abs(t.amt))}</option>`).join('')}</select><small>Linking marks it ${verb.toLowerCase()} using the real date and amount.</small></label>`;
  }
  return `<div class="detail">
    <div class="fgrid">
      <label class="field">Amount this month<input class="num" type="number" step="0.01" min="0" value="${it.amount}" data-chg="amount" data-key="${k}"></label>
      ${it.done ? `<label class="field">${verb} on<input type="date" value="${esc(it.doneDate || it.due)}" data-chg="paiddate" data-key="${k}"></label>` : ''}
      <label class="field">Note<input type="text" value="${esc(it.note)}" placeholder="Confirmation number, who to call…" data-chg="note" data-key="${k}"></label>
    </div>
    ${linkBlock}
    <div class="actions">
      ${it.rec ? `<button class="btn sm" data-act="edit-tmpl" data-id="${it.tmpl.id}">Edit recurring ${it.type}…</button><button class="btn sm" data-act="skip" data-key="${k}">${it.skip ? 'Restore this month' : 'Skip this month'}</button>` : `<button class="btn sm danger" data-act="del-extra" data-key="${k}">Delete this item</button>`}
    </div>
  </div>`;
}

/* ----- Obligations ----- */
function viewObligations() {
  const cur = thisMonth();
  const live = D.templates.filter(t => !t.end || t.end >= cur);
  const bills = live.filter(t => t.type === 'bill'), inc = live.filter(t => t.type === 'income');
  const billsMo = sum(bills, monthlyEquiv), incMo = sum(inc, monthlyEquiv);
  const head = `<div class="pagehead"><div><h1>Monthly obligations</h1><p class="lede">${RO() ? 'Everything that repeats each month.' : 'Everything that repeats. Each month\'s checklist is built from this list, so add a bill once and it shows up every time it is due.'}</p></div>
    ${RO() ? '' : '<div class="actions"><button class="btn primary" data-act="add-tmpl" data-type="bill">Add bill</button><button class="btn" data-act="add-tmpl" data-type="income">Add income</button></div>'}</div>`;
  if (!D.templates.length) return sampleBanner() + head + `<section class="card">${emptyState('Nothing here yet', RO() ? 'Nothing has been added yet.' : 'Add rent, utilities, subscriptions, loan payments and paychecks. You can set how often each one repeats and which day it is due.', RO() ? '' : `<button class="btn primary" data-act="add-tmpl" data-type="bill">Add your first bill</button>${isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''}`)}</section>`;
  const sortDay = t => (t.freq === 'weekly' || t.freq === 'biweekly') && t.anchor ? +t.anchor.slice(8, 10) : (t.day || 1);
  const rows = list => list.slice().sort((a, b) => sortDay(a) - sortDay(b) || a.name.localeCompare(b.name)).map(tmplRow).join('');
  const byCat = {};
  bills.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + monthlyEquiv(t); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), maxC = cats.length ? cats[0][1] : 1;
  const diff = r2(incMo - billsMo);
  const ended = D.templates.filter(t => t.end && t.end < cur);
  return sampleBanner() + head + `<div class="stack">
    <section class="card"><div class="stats">
      <div class="stat lead"><div class="lbl">Bills per month</div><div class="val">${money(billsMo)}</div><div class="sub">${plural(bills.length, 'recurring bill')}</div></div>
      <div class="stat"><div class="lbl">Income per month</div><div class="val">${money(incMo)}</div><div class="sub">${plural(inc.length, 'source')}</div></div>
      <div class="stat"><div class="lbl">Difference</div><div class="val${diff < 0 ? ' neg' : ''}">${money(diff)}</div><div class="sub">${diff < 0 ? 'bills exceed income' : 'income after bills'}</div></div>
    </div><p class="muted" style="padding:0 18px 14px;font-size:13px">Weekly, twice-a-month and yearly items are averaged into a monthly figure.</p></section>
    <div class="cols" style="margin-top:0">
      <section class="card"><div class="card-h"><h2>Bills</h2></div>${bills.length ? rows(bills) : '<p class="muted" style="padding:6px 18px 16px">No recurring bills.</p>'}</section>
      <div class="stack">
        <section class="card"><div class="card-h"><h2>Income</h2></div>${inc.length ? rows(inc) : '<p class="muted" style="padding:6px 18px 16px">No recurring income.</p>'}</section>
        ${cats.length ? `<section class="card"><div class="card-h"><h2>Where bills go</h2></div><div class="card-b">${cats.map(([c, v]) => `<div class="cbar"><span class="nm">${esc(c)}</span><span class="bar"><i style="width:${Math.max(2, v / maxC * 100)}%"></i></span><span class="amt">${money(v)}</span></div>`).join('')}</div></section>` : ''}
        ${ended.length ? `<section class="card"><div class="card-h"><h2>Ended</h2></div>${rows(ended)}</section>` : ''}
      </div>
    </div></div>`;
}
function tmplRow(t) {
  const eq = t.freq !== 'monthly' ? `about ${money(monthlyEquiv(t))} / month` : '';
  const tag = RO() ? 'div' : 'button';
  return `<${tag} class="orow"${RO() ? '' : ` data-act="edit-tmpl" data-id="${t.id}"`}>
    <span><span class="rname">${esc(t.name)}${t.autopay ? '<span class="tag">Auto</span>' : ''}</span>
    <span class="rmeta"><span>${esc(freqText(t))}</span>${t.type === 'bill' && t.category ? `<span aria-hidden="true">·</span><span>${esc(t.category)}</span>` : ''}${t.end ? `<span aria-hidden="true">·</span><span>last month ${fmtMonth(t.end)}</span>` : ''}</span></span>
    <span><span class="ramt">${money(t.amount)}</span>${eq ? `<span class="eq" style="display:block">${eq}</span>` : ''}</span>
  </${tag}>`;
}

/* ----- Statements ----- */
function viewStatements() {
  const sub = (id, label) => `<button data-act="sub" data-sub="${id}" aria-pressed="${UI.sub === id}">${label}</button>`;
  const head = `<div class="pagehead"><div><h1>Bank statements</h1><p class="lede">Add statements to check what was really paid and to see where the rest of the money went.</p></div></div>
    <div class="drop" id="drop"><h3>Add statements</h3>
      <p>Drop CSV, OFX/QFX or PDF files here. Most banks offer a CSV under Activity, Statements or Export. Files are read inside this page, and only the date, description and amount of each line are saved.</p>
      <button class="btn primary" data-act="choose-files">Choose files</button></div>`;
  if (!D.txns.length) return sampleBanner() + head + `<section class="card" style="margin-top:16px">${emptyState('No transactions yet', 'Once you add a statement, bills are matched against it automatically and everything else is sorted into categories.', (isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''))}</section>`;
  const seg = `<div class="actions" style="margin:16px 0"><div class="seg" role="group" aria-label="Statement views">${sub('reconcile', 'Reconcile')}${sub('transactions', 'Transactions')}${sub('files', 'Files')}</div></div>`;
  return sampleBanner() + head + seg + (UI.sub === 'transactions' ? viewTxns() : UI.sub === 'files' ? viewFiles() : viewReconcile());
}
function reconcileMonth() {
  const ms = txnMonths(), cur = thisMonth();
  if (UI.rm && ms.includes(UI.rm)) return UI.rm;
  const past = ms.filter(m => m <= cur);
  UI.rm = past.length ? past[past.length - 1] : ms[ms.length - 1];
  return UI.rm;
}
function viewReconcile() {
  const ym = reconcileMonth(), ms = txnMonths();
  const items = itemsFor(ym).filter(i => !i.skip);
  const sugg = suggestMatches(ym);
  const suggKeys = new Set(sugg.map(p => p.it.key)), suggTx = new Set(sugg.map(p => p.tx.id));
  const mtx = D.txns.filter(t => ymOf(t.date) === ym);
  const linked = linkedMap();
  const matched = items.filter(i => i.txn && txnById(i.txn));
  const billItems = items.filter(i => i.type === 'bill');
  const out = sum(mtx.filter(t => t.amt < 0 && t.cat !== 'Transfer'), t => -t.amt), inn = sum(mtx.filter(t => t.amt > 0 && t.cat === 'Income'), t => t.amt);
  const unplanned = mtx.filter(t => !linked.has(t.id) && !suggTx.has(t.id));
  const unplannedOut = sum(unplanned.filter(t => t.amt < 0 && t.cat !== 'Transfer'), t => -t.amt);
  const picker = `<div class="monthbar" style="margin-bottom:12px"><label class="field" style="grid-auto-flow:column;align-items:center;gap:10px">Month<select class="inp sm" data-chg="rm" style="min-width:160px">${ms.slice().reverse().map(m => `<option value="${m}"${m === ym ? ' selected' : ''}>${fmtMonth(m)}</option>`).join('')}</select></label></div>`;
  const stats = `<section class="card"><div class="stats">
    <div class="stat lead"><div class="lbl">Bills matched</div><div class="val">${billItems.filter(i => i.txn).length} of ${billItems.length}</div><div class="sub">${sugg.length ? plural(sugg.length, 'suggestion') + ' waiting' : 'found on the statement'}</div></div>
    <div class="stat"><div class="lbl">Left the account</div><div class="val">${money(out)}</div><div class="sub">excluding transfers</div></div>
    <div class="stat"><div class="lbl">Came in</div><div class="val">${money(inn)}</div><div class="sub">income lines</div></div>
    <div class="stat"><div class="lbl">Not on your list</div><div class="val">${money(unplannedOut)}</div><div class="sub">${plural(unplanned.filter(t => t.amt < 0).length, 'purchase')}</div></div></div></section>`;
  const suggCard = sugg.length ? `<section class="card"><div class="card-h"><h2>Suggested matches</h2><button class="btn primary sm" data-act="apply-sugg">Apply selected</button></div>
    <p class="muted" style="padding:0 18px 10px;font-size:14px">Checked rows are strong matches. Review them, untick anything wrong, then apply. Applying marks the bill paid with the real date and amount.</p>
    ${sugg.map(p => `<label class="sugg"><input type="checkbox" data-sg="${esc(p.it.key)}|${p.tx.id}"${p.s >= 4 ? ' checked' : ''}>
      <span class="pair"><span class="a">${esc(p.it.name)} <span class="muted num" style="font-weight:400;margin-left:8px">${fmtShort(p.it.due)} · ${money(p.it.amount)}</span></span><span class="b">${esc(p.tx.desc)} <span class="num" style="margin-left:8px">${fmtShort(p.tx.date)} · ${money(Math.abs(p.tx.amt))}</span></span></span>
      <span class="pill ${p.s >= 5 ? 'good' : p.s >= 4 ? 'accent' : 'warn'}">${p.s >= 5 ? 'Strong' : p.s >= 4 ? 'Likely' : 'Possible'}${p.why && p.why.length ? ' · ' + esc(p.why.join(', ')) : ''}</span></label>`).join('')}</section>` : '';
  const rest = items;
  const itemsCard = `<section class="card"><div class="card-h"><h2>Bills and income in ${fmtMonth(ym)}</h2></div>
    ${rest.length ? rest.map(i => {
      const t = i.txn ? txnById(i.txn) : null;
      let mid, act;
      if (t) { mid = `<span class="pill good">${ICON.link} matched</span> ${esc(t.desc)} <span class="num">${fmtShort(t.date)} · ${money(Math.abs(t.amt))}</span>`; act = `<button class="btn sm" data-act="unlink" data-key="${esc(i.key)}">Unlink</button>`; }
      else {
        mid = suggKeys.has(i.key) ? '<span class="muted">Suggested match above</span>' : i.done ? 'Marked done, no statement line linked' : '<span class="muted">Not found on this statement</span>';
        const c = candidatePool(ym).map(x => ({ x, s: scoreMatch(i, x).s })).filter(y => y.s >= 0).sort((a, b) => b.s - a.s).slice(0, 20);
        act = c.length ? `<select class="inp sm" data-chg="link" data-key="${esc(i.key)}" aria-label="Link a statement line to ${esc(i.name)}" style="max-width:150px"><option value="">Link a line…</option>${c.map(y => `<option value="${y.x.id}">${fmtShort(y.x.date)} · ${esc(y.x.desc.slice(0, 30))} · ${money(Math.abs(y.x.amt))}</option>`).join('')}</select>` : '';
      }
      return `<div class="mrow"><div><div class="nm">${esc(i.name)}</div><div class="muted num" style="font-size:13px">${i.type === 'income' ? 'Expected' : 'Due'} ${fmtShort(i.due)} · ${money(i.planned)}</div></div><div class="mid">${mid}</div><div>${act}</div></div>`;
    }).join('') : `<p class="muted" style="padding:6px 18px 16px">No bills or income are scheduled for ${fmtMonth(ym)}. Add them under Obligations, or give a bill an earlier start month so it shows up here.</p>`}</section>`;
  const shownU = unplanned.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 30);
  const unCard = `<section class="card"><div class="card-h"><h2>Everything else in ${fmtMonth(ym)}</h2><button class="btn sm" data-act="show-month-txns" data-ym="${ym}">See all ${plural(mtx.length, 'line')}</button></div>
    ${shownU.length ? `<div class="tbl-wrap"><table class="tbl stk"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th><th></th></tr></thead><tbody>${shownU.map(t => `<tr><td class="num c-date">${fmtShort(t.date)}</td><td class="desc c-desc">${esc(t.desc)}</td>
      <td class="c-cat"><select class="inp sm" data-chg="txncat" data-id="${t.id}" aria-label="Category for ${esc(t.desc)}">${catOptions(t.cat)}</select></td>
      <td class="r num c-amt ${t.amt < 0 ? 'out' : 'in'}">${money(t.amt)}</td><td class="r c-act">${t.amt < 0 && !NON_SPEND.has(t.cat) ? `<button class="btn ghost sm" data-act="track-txn" data-id="${t.id}">Track as bill</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${unplanned.length > shownU.length ? `<p class="muted" style="padding:10px 18px 14px;font-size:13.5px">Showing ${shownU.length} of ${unplanned.length}.</p>` : ''}` : `<p class="muted" style="padding:6px 18px 16px">Every line this month is matched to something on your list.</p>`}</section>`;
  return picker + `<div class="stack">${stats}${suggCard}${itemsCard}${unCard}</div>`;
}
function filteredTxns() {
  const q = UI.q.trim().toLowerCase();
  return D.txns.filter(t => (UI.fm === 'all' || ymOf(t.date) === UI.fm) && (UI.fc === 'all' || t.cat === UI.fc) && (!q || t.desc.toLowerCase().includes(q)) && (!UI.fu || !linkedMap().has(t.id)))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function txnTable() {
  const list = filteredTxns(), shown = list.slice(0, UI.txLimit), linked = linkedMap();
  if (!list.length) return '<p class="muted" style="padding:6px 18px 18px">No transactions match these filters.</p>';
  const net = sum(list.filter(t => t.cat !== 'Transfer'), t => t.amt);
  return `<div class="tbl-wrap"><table class="tbl stk"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th><th></th></tr></thead><tbody>
    ${shown.map(t => {
      const l = linked.get(t.id);
      return `<tr><td class="num c-date">${fmtShort(t.date)}</td><td class="desc c-desc">${esc(t.desc)}${l ? ` <span class="pill good">${ICON.link} bill</span>` : ''}</td>
        <td class="c-cat"><select class="inp sm" data-chg="txncat" data-id="${t.id}" aria-label="Category for ${esc(t.desc)}">${catOptions(t.cat)}</select></td>
        <td class="r num c-amt ${t.amt < 0 ? 'out' : 'in'}">${money(t.amt)}</td><td class="r c-act"><button class="btn ghost sm" data-act="del-txn" data-id="${t.id}" aria-label="Remove this transaction" title="Remove">&times;</button></td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="card-f"><span class="muted">${shown.length < list.length ? `Showing ${shown.length} of ${list.length}` : plural(list.length, 'transaction')} · net ${money(net, { sign: true })}</span>${shown.length < list.length ? '<button class="btn sm" data-act="more-txns">Show more</button>' : ''}</div>`;
}
function viewTxns() {
  const ms = txnMonths().reverse(), used = [...new Set(D.txns.map(t => t.cat))].sort();
  return `<section class="card"><div class="card-h"><h2>All transactions</h2></div>
    <div class="filters">
      <input class="inp grow" id="q" type="search" placeholder="Search descriptions" value="${esc(UI.q)}" aria-label="Search descriptions">
      <select class="inp" data-chg="fm" aria-label="Month"><option value="all">All months</option>${ms.map(m => `<option value="${m}"${UI.fm === m ? ' selected' : ''}>${fmtMonth(m)}</option>`).join('')}</select>
      <select class="inp" data-chg="fc" aria-label="Category"><option value="all">All categories</option>${used.map(c => `<option${UI.fc === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label class="checkline"><input type="checkbox" data-chg="fu"${UI.fu ? ' checked' : ''}> Not matched to a bill</label>
    </div><div id="txnList">${txnTable()}</div></section>`;
}
function viewFiles() {
  return `<section class="card"><div class="card-h"><h2>Imported files</h2></div>
    ${D.imports.length ? D.imports.slice().reverse().map(f => `<div class="mrow"><div><div class="nm">${esc(f.name)}</div><div class="muted" style="font-size:13px">${f.label ? esc(f.label) + ' · ' : ''}${plural(D.txns.filter(t => t.src === f.id).length, 'transaction')}${f.from ? ` · ${fmtShort(f.from)} to ${fmtDate(f.to)}` : ''}</div></div>
      <div class="mid muted" style="font-size:13px">Added ${new Date(f.at).toLocaleDateString()}</div>
      <div>${UI.confirm === f.id ? `<button class="btn sm danger" data-act="del-import" data-id="${f.id}">Yes, remove these lines</button>` : `<button class="btn sm" data-act="del-import" data-id="${f.id}">Remove</button>`}</div></div>`).join('') : '<p class="muted" style="padding:6px 18px 16px">No files imported.</p>'}
    <p class="muted" style="padding:12px 18px 16px;font-size:13.5px">Removing a file deletes the transactions that came from it. Bills you marked paid stay paid.</p></section>`;
}

/* ----- Spending ----- */
const RANGES = [['this', 'This month'], ['last', 'Last month'], ['3', 'Last 3 months'], ['6', 'Last 6 months'], ['12', 'Last 12 months'], ['all', 'All time']];
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function roundTop(x, y, w, h, r) { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function monthChart(by, W) {
  const ms = Object.keys(by), H = 230, L = 46, R = 4, T = 10, B = 26, pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...ms.flatMap(m => [by[m].in, by[m].out])), step = niceStep(max / 4), top = Math.ceil(max / step) * step;
  const y = v => T + ph - v / top * ph, gw = pw / ms.length, bw = Math.min(28, gw * .34);
  let g = '';
  for (let v = 0; v <= top + 1e-6; v += step) g += `<line class="${v === 0 ? 'axis' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  ms.forEach((m, i) => {
    const cx = L + gw * i + gw / 2, d = by[m];
    const tip = esc(JSON.stringify({ t: fmtMonth(m), rows: [['Money in', money(d.in), 's1'], ['Spent', money(d.out), 's2'], ['Net', money(d.in - d.out, { sign: true }), '']] }));
    if (d.in > 0) g += `<path d="${roundTop(cx - bw - 1, y(d.in), bw, y(0) - y(d.in), 4)}" fill="var(--s1)"/>`;
    if (d.out > 0) g += `<path d="${roundTop(cx + 1, y(d.out), bw, y(0) - y(d.out), 4)}" fill="var(--s2)"/>`;
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${fmtMon(m)}</text><rect class="hit" x="${cx - gw / 2}" y="${T}" width="${gw}" height="${ph + B}" data-tip="${tip}"/>`;
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Money in and money spent by month">${g}</svg>`;
}
function viewSpending() {
  const head = `<div class="pagehead"><div><h1>Where the money goes</h1><p class="lede">Built from the statements you have added. Transfers are left out, and refunds reduce the category they belong to.</p></div>
    <label class="field" style="grid-auto-flow:column;align-items:center;gap:10px">Period<select class="inp sm" data-chg="range" style="min-width:150px">${RANGES.map(([v, l]) => `<option value="${v}"${UI.range === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  if (!D.txns.length) return sampleBanner() + head + `<section class="card">${emptyState('Nothing to show yet', RO() ? 'Spending shows up here once statements have been added.' : 'Add a bank statement and every line is sorted into a category, so you can see what the month really cost.', RO() ? '' : '<button class="btn primary" data-act="tab" data-tab="statements">Add a statement</button>' + (isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''))}</section>`;
  const { from, to } = rangeFor(UI.range), st = spendStats(from, to), months = Object.keys(st.byMonth);
  let act = months.filter(m => st.byMonth[m].in || st.byMonth[m].out);
  if (!act.length) act = months;
  const first = act[0], last = act[act.length - 1];
  const label = first === last ? fmtMonth(first) : `${fmtMonth(first)} to ${fmtMonth(last)}`;
  const chartBy = {};
  months.slice(months.indexOf(first), months.indexOf(last) + 1).forEach(m => { chartBy[m] = st.byMonth[m]; });
  if (!st.count) return sampleBanner() + head + `<section class="card">${emptyState('No transactions in ' + label, 'Pick a different period, or add the statement for this month.', RO() ? '' : '<button class="btn" data-act="tab" data-tab="statements">Go to statements</button>')}</section>`;
  const net = r2(st.income - st.spent), active = act.length || 1;
  const cats = Object.entries(st.byCat).filter(([, v]) => Math.abs(v) >= .005).sort((a, b) => b[1] - a[1]);
  const pos = cats.filter(([, v]) => v > 0), maxC = pos.length ? pos[0][1] : 1;
  const shownCats = pos.slice(0, 14), rest = pos.slice(14);
  const W = Math.max(280, Math.floor($('#app').getBoundingClientRect().width) - 36);
  const kpis = `<section class="card"><div class="stats">
    <div class="stat lead"><div class="lbl">Spent</div><div class="val">${money(st.spent)}</div><div class="sub">${money(st.spent / active)} a month · ${esc(label)}</div></div>
    <div class="stat"><div class="lbl">Money in</div><div class="val">${money(st.income)}</div><div class="sub">income lines</div></div>
    <div class="stat"><div class="lbl">${net >= 0 ? 'Kept' : 'Overspent'}</div><div class="val${net < 0 ? ' neg' : ''}">${money(Math.abs(net))}</div><div class="sub">${st.income ? Math.round(net / st.income * 100) + '% of income' : 'no income lines'}</div></div>
    <div class="stat"><div class="lbl">Tracked bills</div><div class="val">${st.spent ? Math.round(st.tracked / st.spent * 100) : 0}%</div><div class="sub">${money(st.tracked)} matched to your list</div></div></div></section>`;
  const catCard = `<section class="card"><div class="card-h"><h2>By category</h2></div><div class="card-b">
    ${shownCats.map(([c, v]) => `<${RO() ? 'div' : 'button'} class="cbar"${RO() ? '' : ` data-act="drill" data-cat="${esc(c)}" title="See ${esc(c)} transactions"`}><span class="nm">${esc(c)}</span><span class="bar"><i style="width:${Math.max(1.5, v / maxC * 100)}%"></i></span><span class="amt">${money(v)}<small>${Math.round(v / st.spent * 100)}%</small></span></${RO() ? 'div' : 'button'}>`).join('')}
    ${rest.length ? `<div class="cbar"><span class="nm muted">${rest.length} smaller categories</span><span></span><span class="amt">${money(sum(rest, x => x[1]))}</span></div>` : ''}</div></section>`;
  const chartCard = act.length > 1 ? `<section class="card"><div class="card-h"><h2>Month by month</h2></div>
    <div class="legend"><span><i style="background:var(--s1)"></i>Money in</span><span><i style="background:var(--s2)"></i>Spent</span></div>
    <div class="chart" id="chart">${monthChart(chartBy, W)}</div>
    <details class="tv"><summary>View as table</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">Money in</th><th class="r">Spent</th><th class="r">Net</th></tr></thead><tbody>${Object.keys(chartBy).map(m => `<tr><td>${fmtMonth(m)}</td><td class="r num">${money(st.byMonth[m].in)}</td><td class="r num">${money(st.byMonth[m].out)}</td><td class="r num">${money(st.byMonth[m].in - st.byMonth[m].out, { sign: true })}</td></tr>`).join('')}</tbody></table></div></details></section>` : '';
  const merch = st.merchants.filter(m => m.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
  const merchCard = merch.length ? `<section class="card"><div class="card-h"><h2>Biggest merchants</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Merchant</th><th class="r">Visits</th><th class="r">Total</th></tr></thead><tbody>${merch.map(m => `<tr><td class="desc">${esc(titleCase(m.key))}</td><td class="r num">${m.n}</td><td class="r num">${money(m.total)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  UI.rec = RO() ? [] : detectRecurring();
  const recCard = UI.rec.length ? `<section class="card"><div class="card-h"><h2>Looks like a recurring bill</h2></div>
    <p class="muted" style="padding:0 18px 8px;font-size:14px">These charge about the same amount every month and are not on your obligations list yet.</p>
    ${UI.rec.map((r, i) => `<div class="rec"><div><div class="rname">${esc(r.name)}</div><div class="rmeta"><span class="num">about ${money(r.amount)}</span><span aria-hidden="true">·</span><span>seen in ${r.months} months</span><span aria-hidden="true">·</span><span>${esc(r.cat)}</span></div></div><button class="btn sm" data-act="add-recurring" data-idx="${i}">Add as bill</button></div>`).join('')}</section>` : '';
  return sampleBanner() + head + `<div class="stack">${kpis}${catCard}${chartCard}<div class="cols" style="margin-top:0"><div class="stack">${merchCard}</div><div class="stack">${recCard}</div></div></div>`;
}

/* ----- shell ----- */
const VIEWS = { month: () => sampleBanner() + viewMonth(), obligations: viewObligations, statements: viewStatements, spending: viewSpending };
const visibleTabs = () => TABS.filter(([id]) => !(RO() && id === 'statements'));
function render() {
  const tabs = $('#tabs');
  if (Store.mode === 'locked') {
    tabs.innerHTML = '';
    $('#app').innerHTML = `<section class="card">${emptyState('Sign in to view this ledger', 'This page was shared with you. It loads once you are signed in to Claude with the account it was shared with.')}</section>`;
    return;
  }
  if (!visibleTabs().some(([id]) => id === UI.tab)) UI.tab = 'month';
  $('#top').innerHTML = chromeHTML();
  tabs.innerHTML = visibleTabs().map(([id, label]) => `<button class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}>${label}</button>`).join('');
  $('#app').innerHTML = VIEWS[UI.tab]();
  const chip = $('#saveState');
  if (chip) chip.replaceWith(saveChip());
}
