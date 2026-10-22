/* ---------- views ---------- */
const UI = { tab: 'month', ym: thisMonth(), open: null, gAll: null, sub: 'reconcile', rm: null, range: '6', q: '', fm: 'all', fc: 'all', fu: false, txLimit: 100, confirm: null, rec: [] };
const txnById = id => D.txns.find(t => t.id === id);
const RO = () => Store.readonly;
/* a label tied to the hidden file input, so a tap opens the picker natively instead of through script */
const fileBtn = (cls, text) => `<label class="btn ${cls}" for="file" tabindex="0" role="button">${text}</label>`;
/* the date a quick entry defaults to: today in the current month, otherwise the month's last (past) or first (future) day */
const entryDate = ym => { const cur = thisMonth(); return ym === cur ? todayStr() : ym < cur ? `${ym}-${pad(daysIn(ym))}` : `${ym}-01`; };
const ICON = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.6l3.1 3L12.8 4.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevL: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3.5L5.5 9l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3.5L12.5 9 7 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 6.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4zm7 3.2l-1.6-.9a5.8 5.8 0 000-2.2l1.5-1-1.6-2.7-1.7.8a6 6 0 00-1.9-1.1L11 1.3H8l-.5 1.8a6 6 0 00-1.9 1.1l-1.7-.8-1.6 2.7 1.5 1a5.8 5.8 0 000 2.2L2.9 10l1.6 2.8 1.7-.8c.6.5 1.2.8 1.9 1.1l.4 1.8h3l.5-1.8c.7-.3 1.3-.6 1.9-1.1l1.7.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  pencil: '<svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12l.6-2.9L9.4 2.3a1.3 1.3 0 011.8 0l.5.5a1.3 1.3 0 010 1.8L4.9 11.4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  mark: '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="27" rx="8" fill="var(--accent)"/><path d="M8 11h14M8 15h14M8 19h7" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round" opacity=".55"/><path d="M17.5 20.2l2.6 2.4 4.6-5.4" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.4 2.3 4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const TABS = [['month', 'Month'], ['income', 'Income'], ['bank', 'Reconcile']];
/* viewers only get the spending summary on that tab, so it says so */
const tabLabel = (id, label) => (id === 'bank' && RO() ? 'Spending' : label);

function chromeHTML() {
  return `<div class="brand">${ICON.mark}<span>Jarrod's CFO</span></div>
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
function monthNav(ym) {
  const cur = thisMonth();
  return `<div class="monthbar">
    <button class="icon-btn" data-act="month-prev" aria-label="Previous month">${ICON.chevL}</button>
    <h1 class="mtitle">${fmtMonth(ym)}</h1>
    <button class="icon-btn" data-act="month-next" aria-label="Next month">${ICON.chevR}</button>
    <span class="grow"></span>
    ${ym !== cur ? `<button class="btn sm" data-act="month-today">Back to ${fmtMonth(cur)}</button>` : ''}
  </div>`;
}
function viewMonth() {
  const ym = UI.ym, cur = thisMonth(), items = itemsFor(ym), S = summarize(items), ro = RO();
  const nav = monthNav(ym);
  if (!D.templates.length && !items.length) {
    return nav + `<section class="card">${ro ? emptyState('Nothing here yet', 'Bills and income will appear here once they have been added.') : emptyState('Start with your monthly bills', 'Add the bills that repeat and the income you expect. Each month then gets its own checklist, and you tick things off as they are paid.',
      `<button class="btn primary" data-act="add-tmpl" data-type="bill">Add a bill</button><button class="btn" data-act="add-tmpl" data-type="income">Add income</button>${isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''}`)}</section>`;
  }
  const pct = S.billsTotal ? Math.round(S.billsPaid / S.billsTotal * 100) : 0;
  const late = S.bills.filter(i => itemStatus(i) === 'late').length;
  const over = S.budgets.filter(i => i.amount > 0 && i.spent > i.amount + 0.005);
  const openBills = S.bills.length - S.billsDone;
  const summary = `<section class="card" aria-label="Month summary">
    <div class="stats">
      <div class="stat lead"><div class="lbl">Still to pay</div><div class="val">${money(S.billsLeft)}</div><div class="sub">${plural(openBills, 'bill')} left${S.budgetLeft > 0 ? ` + ${money(S.budgetLeft)} to spend` : ''}</div></div>
      <div class="stat"><div class="lbl">Income</div><div class="val">${money(S.incomeGot)}</div><div class="sub">of ${money(S.incomeTotal)} expected</div></div>
    </div>
    <div class="progress"><div class="track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Bills paid and budgets spent"><i style="width:${Math.min(100, pct)}%"></i></div>
      <div class="cap"><span>${S.billsDone} of ${S.bills.length} bills paid</span><span class="actions">${late ? `<span class="pill bad">${plural(late, 'bill')} overdue</span>` : ''}${over.map(b => `<span class="pill bad">${esc(b.name)} over budget</span>`).join('')}</span></div></div>
    ${ro ? '' : `<div class="gnote"><span>Savings <b class="num">${moneyWhole(growthFor('savings').total)}</b></span><span>Investments <b class="num">${moneyWhole(growthFor('investing').total)}</b></span></div>`}
    <div class="card-f"><span class="muted">One page to share: income received and bills paid</span><button class="btn sm" data-act="share-pdf">Monthly update PDF</button></div>
  </section>`;
  const bills = items.filter(i => i.type === 'bill' && !i.budget), buds = items.filter(i => i.budget);
  // paid bills leave the list; a quiet line at the bottom brings them back (view-only copies show them, since seeing what is paid is the point)
  const showPaid = UI.showPaid ?? ro;
  const billList = list => {
    const open = list.filter(i => !i.done && !i.skip), paid = list.filter(i => i.done || i.skip);
    return open.map(rowHTML).join('') + (!open.length && paid.length ? '<li class="alldone">Everything is paid. Nice.</li>' : '')
      + (showPaid ? paid.map(rowHTML).join('') : '')
      + (paid.length ? `<li class="paidbar"><button type="button" class="btn ghost sm" data-act="toggle-paid" aria-expanded="${showPaid}">${showPaid ? 'Hide' : 'Show'} ${paid.some(i => i.skip) ? 'paid and skipped bills' : 'paid bills'} · ${paid.length}</button></li>` : '');
  };
  const addExp = ro ? '' : '<button class="btn sm" data-act="add-tmpl" data-type="bill" data-budget="1">+ Add expense</button>';
  const budgetCard = (buds.length || !ro) ? `<section class="card"><div class="card-h"><h2>Variable expenses</h2></div>
    ${buds.length ? `<ul class="list">${buds.map(b => budgetHTML(b, ym)).join('')}</ul>` : '<p class="muted" style="padding:2px 18px 14px">Things that change each month, like groceries or dining out, with a running total of what you spend.</p>'}
    <div class="card-f"><span class="total num">${buds.length ? `Spent ${money(sum(buds, x => x.spent))}` : ''}</span>${addExp}</div></section>` : '';
  const billsCard = `<section class="card">
    <div class="card-h"><div><h2>Bills</h2>${ro ? '' : '<p class="muted" style="font-size:13.5px;margin-top:2px">Tap a bill to change it.</p>'}</div>${ro ? '' : '<button class="btn primary sm" data-act="add-bill">+ Add bill</button>'}</div>
    ${bills.length ? `<ul class="list">${billList(bills)}</ul>` : `<p class="muted" style="padding:6px 18px 16px">No bills this month.</p>`}
    <div class="card-f"><span class="total num">Total ${money(S.fixedTotal)}</span></div>
  </section>`;
  // bills, then the variable expenses (beside them on a wide screen, under them on a phone)
  return nav + summary + `<div class="cols"><div class="stack">${billsCard}</div><div class="stack">${budgetCard}</div></div>`;
}
/* ----- Income: the month's income list with a one-line entry form ----- */
function incomeCard(ym, items) {
  const ro = RO(), inc = items.filter(i => i.type === 'income'), S = summarize(items);
  const open = inc.filter(i => !i.done && !i.skip), done = inc.filter(i => i.done || i.skip);
  const list = open.map(rowHTML).join('') + (done.length ? `<li class="grp">Done · ${done.length}</li>${done.map(rowHTML).join('')}` : '');
  const incNames = [...new Set([...D.templates.filter(t => t.type === 'income').map(t => t.name), ...Object.values(D.months).flatMap(m => m.extras.filter(x => x.type === 'income').map(x => x.name))])].slice(0, 30);
  const incForm = ro ? '' : `<form class="incf" autocomplete="off">
      <input name="source" class="inp" list="incsrc" placeholder="Source, e.g. Salary" aria-label="Income source" required>
      <input name="amount" class="inp num" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount" aria-label="Amount received" required>
      <input name="date" class="inp" type="date" value="${entryDate(ym)}" aria-label="Date received">
      <button class="btn primary sm" type="submit">Add income</button>
      <datalist id="incsrc">${incNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist></form>`;
  return `<section class="card">
    <div class="card-h"><div><h2>Income</h2>${ro ? '' : '<p class="muted" style="font-size:13.5px;margin-top:2px">Log money as it arrives.</p>'}</div>${ro ? '' : '<button class="btn sm" data-act="add-tmpl" data-type="income">+ Repeating income</button>'}</div>
    ${incForm}
    ${inc.length ? `<ul class="list">${list}</ul>` : `<p class="muted" style="padding:6px 18px 16px">No income listed for this month.</p>`}
    <div class="card-f"><span class="total num">Received ${money(S.incomeGot)}</span><span class="muted num" style="font-size:13px">of ${money(S.incomeTotal)} expected</span></div>
  </section>`;
}
/* a variable expense, laid out like a bill: + opens a small entry panel, the amount is what has been spent so far,
   and the line turns red when it goes over. An amount of 0 means no limit set, so it just tracks. */
function budgetHTML(b, ym) {
  const ro = RO(), tid = b.tmpl.id, k = esc(b.key), nolimit = !(b.amount > 0);
  const over = !nolimit && b.spent > b.amount + 0.005, left = r2(b.amount - b.spent);
  const state = nolimit ? 'none' : over ? 'over' : b.spent >= b.amount * 0.85 ? 'near' : 'ok';
  const meta = nolimit ? 'No limit set' : `of ${money(b.amount)} · ${over ? money(-left) + ' over' : money(left) + ' left'}`;
  const open = UI.open === b.key;
  const ents = spendsFor(ym, tid).slice().sort((x, y) => y.date.localeCompare(x.date));
  const form = ro ? '' : `<form class="spendf" autocomplete="off"><input type="hidden" name="exp" value="${tid}">
      <input name="amount" class="inp num" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount" aria-label="Amount" required>
      <input name="note" class="inp" type="text" placeholder="What for? (optional)" aria-label="Note">
      <input name="date" class="inp" type="date" value="${entryDate(ym)}" aria-label="Date">
      <button class="btn primary sm" type="submit">Add</button></form>`;
  const list = ents.length ? `<ul class="entries">${(ro ? ents.slice(0, 12) : ents).map(s => `<li><span class="num muted">${fmtShort(s.date)}</span><span class="enote">${esc(s.note || '')}</span><span class="num">${money(s.amount)}</span>${ro ? '<span></span>' : `<button class="btn ghost sm" data-act="del-spend" data-id="${s.id}" aria-label="Remove ${money(s.amount)} on ${fmtShort(s.date)}" title="Remove">&times;</button>`}</li>`).join('')}</ul>` : '<p class="muted" style="font-size:14px">Nothing entered yet.</p>';
  return `<li class="row vrow ${state}">
    ${ro ? '<span class="chk-sp"></span>' : `<button class="chk add" data-act="open" data-key="${k}" aria-expanded="${open}" aria-label="Add spending to ${esc(b.name)}">${ICON.plus}</button>`}
    <button class="rmain" data-act="open" data-key="${k}" aria-expanded="${open}">
      <span class="rtext"><span class="rname">${esc(b.name)}</span><span class="rmeta"><span class="vm">${meta}</span></span></span>
      <span class="ramt">${money(b.spent)}</span>
    </button>
    ${open ? `<div class="vpanel">${form}${list}${ro ? '' : `<div><button class="btn ghost sm" data-act="edit-tmpl" data-id="${tid}">Change name or limit</button></div>`}</div>` : ''}
  </li>`;
}
/* a bill or income row: tick it off with the box, tap the rest to change it */
function rowHTML(it) {
  const ro = RO(), st = itemStatus(it), verb = it.type === 'income' ? 'received' : 'paid';
  const link = it.txn ? txnById(it.txn) : null, dis = ro || it.skip, tag = ro ? 'div' : 'button';
  return `<li class="row ${st}">
    <button class="chk" role="checkbox" aria-checked="${it.done}"${dis ? ' disabled' : ` data-act="toggle" data-key="${esc(it.key)}"`} aria-label="${esc(it.name)} ${it.done ? verb : 'not ' + verb}">${ICON.check}</button>
    <${tag} class="rmain"${ro ? '' : ` data-act="edit-item" data-key="${esc(it.key)}"`}>
      <span class="rtext"><span class="rname">${esc(it.name)}</span>
        <span class="rmeta"><span class="due">${esc(dueText(it))}</span>${link ? `<span class="pill good">${ICON.link} on statement</span>` : ''}${it.note ? `<span aria-hidden="true">·</span><span>${esc(it.note)}</span>` : ''}</span></span>
      <span class="ramt">${money(it.amount)}</span>
    </${tag}>
  </li>`;
}

/* ----- Savings and investments: overall totals, shown on the Income tab ----- */
function growthCard(kind, label) {
  const g = growthFor(kind), all = UI.gAll === kind, rows = all ? g.rows : g.rows.slice(0, 6);
  return `<section class="card"><div class="card-h"><h2>${label}</h2></div>
    <form class="growf" data-kind="${kind}" autocomplete="off">
      <input name="amount" class="inp num" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount" aria-label="Amount" required>
      <input name="note" class="inp" type="text" placeholder="Note (optional)" aria-label="Note">
      <input name="date" class="inp" type="date" value="${todayStr()}" aria-label="Date">
      <button class="btn primary sm" type="submit" value="add">Add</button><button class="btn sm" type="submit" value="out">Take out</button></form>
    <details class="more" style="margin:0 18px 14px"><summary>Set to a new total</summary><form class="growset" data-kind="${kind}" autocomplete="off" style="padding:0 0 12px">
      <input name="total" class="inp num" type="number" step="0.01" inputmode="decimal" placeholder="${money(g.total)}" aria-label="New total" required><button class="btn sm" type="submit">Update total</button>
      <small class="muted" style="flex:1 1 100%">Use this for a starting balance, or for investments that go up and down. The difference is recorded as an entry, so the list below still adds up.</small></form></details>
    ${rows.length ? `<ul class="entries gentries">${rows.map(e => `<li><span class="num muted">${fmtShort(e.date)}</span><span class="enote">${esc(e.note || '')}</span><span class="num${e.amount < 0 ? ' out-n' : ''}">${money(e.amount, { sign: true })}</span><button class="btn ghost sm" data-act="del-growth" data-id="${e.id}" aria-label="Remove this entry" title="Remove">&times;</button></li>`).join('')}</ul>
      ${g.rows.length > 6 ? `<div class="card-f"><span class="muted">${all ? 'All' : 'Latest 6 of'} ${plural(g.rows.length, 'entry', 'entries')}</span><button class="btn ghost sm" data-act="growth-more" data-kind="${kind}">${all ? 'Show fewer' : 'Show all'}</button></div>` : ''}`
      : '<p class="muted" style="padding:2px 18px 18px">Nothing yet. Use "Set to a new total" to enter what you have now.</p>'}
  </section>`;
}
function viewIncome() {
  const ym = UI.ym, items = itemsFor(ym), nav = sampleBanner() + monthNav(ym);
  if (RO()) return nav + `<div class="stack">${incomeCard(ym, items)}</div>`; // viewers see the income list, not savings
  const gs = GROWTH.map(([k, l]) => ({ k, l, g: growthFor(k) })), total = sum(gs, x => x.g.total);
  return nav + `<div class="cols"><div class="stack">${incomeCard(ym, items)}</div>
    <div class="stack"><section class="card"><div class="card-h"><h2>Savings and investments</h2></div><div class="stats three">
      <div class="stat lead"><div class="lbl">Together</div><div class="val${total < 0 ? ' neg' : ''}">${moneyWhole(total)}</div><div class="sub">saved and invested</div></div>
      ${gs.map(x => `<div class="stat"><div class="lbl">${x.l}</div><div class="val${x.g.total < 0 ? ' neg' : ''}">${moneyWhole(x.g.total)}</div><div class="sub">${plural(x.g.rows.length, 'entry', 'entries')}</div></div>`).join('')}</div></section>
      ${gs.map(x => growthCard(x.k, x.l)).join('')}</div></div>`;
}

/* ----- one repeating item, as listed in Settings ----- */
function tmplRow(t) {
  const eq = t.freq !== 'monthly' ? `about ${money(monthlyEquiv(t))} / month` : '';
  const tag = RO() ? 'div' : 'button';
  return `<${tag} class="orow"${RO() ? '' : ` data-act="edit-tmpl" data-id="${t.id}"`}>
    <span><span class="rname">${esc(t.name)}</span>
    <span class="rmeta"><span>${t.budget ? 'Monthly variable expense' : esc(freqText(t))}</span>${t.end ? `<span aria-hidden="true">·</span><span>last month ${fmtMonth(t.end)}</span>` : ''}</span></span>
    <span><span class="ramt">${money(amountFor(t, thisMonth()))}</span>${eq ? `<span class="eq" style="display:block">${eq}</span>` : ''}</span>
  </${tag}>`;
}

/* ----- Bank (statements and spending in one place) ----- */
const BANK_SUBS = [['reconcile', 'Match bills'], ['spending', 'Spending'], ['transactions', 'Transactions']];
function viewBank() {
  if (RO()) return viewSpending();
  if (!D.txns.length) return sampleBanner() + `<div class="pagehead"><div><h1>Reconcile</h1><p class="lede">Add a bank statement to check what was really paid and to see where the rest of the money went.</p></div></div>
    <div class="drop" id="drop"><h3>Add a statement</h3>
      <p>Drop a CSV, OFX/QFX or PDF file here. Most banks offer a CSV under Activity, Statements or Export. Files are read inside this page, and only the date, description and amount of each line are saved.</p>
      <div class="actions" style="justify-content:center">${fileBtn('primary', 'Choose files')}${isBlank() ? '<button class="btn ghost" data-act="load-sample">Load example data</button>' : ''}</div>
      <details class="more pastebox"><summary>Or paste the statement text</summary>
        <form class="pastef" autocomplete="off"><textarea id="pastetext" class="inp" rows="5" placeholder="Paste the contents of a CSV or OFX file here" aria-label="Statement text" required></textarea><button class="btn primary sm" type="submit">Read it</button></form></details></div>`;
  const bar = `<div class="bankbar"><div class="seg" role="group" aria-label="Bank views">${BANK_SUBS.map(([id, l]) => `<button data-act="sub" data-sub="${id}" aria-pressed="${UI.sub === id}">${l}</button>`).join('')}</div>${fileBtn('primary sm', '+ Add statement')}</div>`;
  const body = UI.sub === 'reconcile' ? viewReconcile() : UI.sub === 'transactions' ? `<div class="stack">${viewTxns()}${viewFiles()}</div>` : viewSpending();
  return sampleBanner() + bar + body;
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
  const items = itemsFor(ym).filter(i => !i.skip && !i.budget);
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
    }).join('') : `<p class="muted" style="padding:6px 18px 16px">No bills or income are scheduled for ${fmtMonth(ym)}. Add them on the Month tab, or give a bill an earlier start month so it shows up here.</p>`}</section>`;
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
  if (!D.txns.length) return head + `<section class="card">${emptyState('Nothing to show yet', RO() ? 'Spending shows up here once statements have been added.' : 'Add a bank statement and every line is sorted into a category, so you can see what the month really cost.', RO() ? '' : fileBtn('primary', 'Add a statement'))}</section>`;
  const { from, to } = rangeFor(UI.range), st = spendStats(from, to), months = Object.keys(st.byMonth);
  let act = months.filter(m => st.byMonth[m].in || st.byMonth[m].out);
  if (!act.length) act = months;
  const first = act[0], last = act[act.length - 1];
  const label = first === last ? fmtMonth(first) : `${fmtMonth(first)} to ${fmtMonth(last)}`;
  const chartBy = {};
  months.slice(months.indexOf(first), months.indexOf(last) + 1).forEach(m => { chartBy[m] = st.byMonth[m]; });
  if (!st.count) return head + `<section class="card">${emptyState('No transactions in ' + label, 'Pick a different period, or add the statement for this month.', RO() ? '' : fileBtn('', 'Add a statement'))}</section>`;
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
    <p class="muted" style="padding:0 18px 8px;font-size:14px">These charge about the same amount every month and are not in your bills yet.</p>
    ${UI.rec.map((r, i) => `<div class="rec"><div><div class="rname">${esc(r.name)}</div><div class="rmeta"><span class="num">about ${money(r.amount)}</span><span aria-hidden="true">·</span><span>seen in ${r.months} months</span><span aria-hidden="true">·</span><span>${esc(r.cat)}</span></div></div><button class="btn sm" data-act="add-recurring" data-idx="${i}">Add as bill</button></div>`).join('')}</section>` : '';
  return head + `<div class="stack">${kpis}${catCard}${chartCard}<div class="cols" style="margin-top:0"><div class="stack">${merchCard}</div><div class="stack">${recCard}</div></div></div>`;
}

/* ----- shell ----- */
const VIEWS = { month: () => sampleBanner() + viewMonth(), income: viewIncome, bank: viewBank };
const visibleTabs = () => TABS;
function render() {
  const tabs = $('#tabs');
  if (Store.mode === 'locked') {
    tabs.innerHTML = '';
    $('#app').innerHTML = `<section class="card">${emptyState('Sign in to view this ledger', 'This page was shared with you. It loads once you are signed in to Claude with the account it was shared with.')}</section>`;
    return;
  }
  if (!visibleTabs().some(([id]) => id === UI.tab)) UI.tab = 'month';
  $('#top').innerHTML = chromeHTML();
  tabs.innerHTML = visibleTabs().map(([id, label]) => `<button class="tab" data-act="tab" data-tab="${id}"${UI.tab === id ? ' aria-current="page"' : ''}>${tabLabel(id, label)}</button>`).join('');
  $('#app').innerHTML = VIEWS[UI.tab]();
  const chip = $('#saveState');
  if (chip) chip.replaceWith(saveChip());
}
