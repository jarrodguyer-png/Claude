/* ---------- recurring schedule -> this month's checklist ---------- */
function occurrences(t, ym) {
  if (t.start && ym < t.start) return [];
  if (t.end && ym > t.end) return [];
  const m = +ym.slice(5, 7);
  switch (t.freq) {
    case 'twice': { const a = clampDay(ym, t.day), b = clampDay(ym, t.day2 || 15); return a === b ? [a] : [a, b].sort(); }
    case 'quarterly': case 'semiannual': case 'yearly': {
      const step = t.freq === 'quarterly' ? 3 : t.freq === 'semiannual' ? 6 : 12;
      return (((m - (t.month || 1)) % step) + step) % step === 0 ? [clampDay(ym, t.day)] : [];
    }
    case 'biweekly': case 'weekly': {
      if (!t.anchor) return [];
      const step = t.freq === 'weekly' ? 7 : 14, a = dayNum(t.anchor), first = dayNum(ym + '-01'), last = first + daysIn(ym) - 1;
      const out = [];
      for (let d = a + Math.ceil((first - a) / step) * step; d <= last; d += step) out.push(fromDayNum(d));
      return out;
    }
    default: return [clampDay(ym, t.day)];
  }
}
function spendsFor(ym, tid) { const mo = D.months[ym]; return ((mo && mo.spends) || []).filter(s => s.t === tid); }
function itemsFor(ym) {
  const mo = D.months[ym];
  const items = [];
  for (const t of D.templates) {
    for (const due of occurrences(t, ym)) {
      const key = t.id + '@' + due, e = (mo && mo.entries[key]) || {};
      items.push({ key, rec: true, type: t.type, budget: !!t.budget, spent: t.budget ? sum(spendsFor(ym, t.id), s => s.amount) : 0, name: t.name, category: t.category, due, planned: t.amount, amount: e.amount ?? t.amount, done: !!e.done, doneDate: e.date || null, skip: !!e.skip, note: e.note || '', txn: e.txn || null, tmpl: t, autopay: !!t.autopay });
    }
  }
  for (const x of (mo && mo.extras) || []) {
    items.push({ key: 'x:' + x.id, rec: false, type: x.type, name: x.name, category: x.category || 'Other', due: x.date, planned: x.amount, amount: x.amount, done: !!x.done, doneDate: x.doneDate || null, skip: false, note: x.note || '', txn: x.txn || null, extra: x });
  }
  items.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  return items;
}
function ensureMonth(ym) { const mo = D.months[ym] || (D.months[ym] = { entries: {}, extras: [], spends: [] }); if (!mo.spends) mo.spends = []; return mo; }
/* patch uses entry field names: done, date (paid date), amount, note, txn, skip */
function mutateItem(ym, item, patch) {
  if (item.rec) {
    const e = ensureMonth(ym).entries[item.key] || (ensureMonth(ym).entries[item.key] = {});
    Object.assign(e, patch);
    for (const k of Object.keys(e)) if (e[k] === null || e[k] === undefined || e[k] === false || e[k] === '') delete e[k];
    if (!Object.keys(e).length) delete D.months[ym].entries[item.key];
  } else {
    const x = item.extra;
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'date') x.doneDate = v || null;
      else if (k === 'amount') { if (v != null) x.amount = v; }
      else if (k === 'skip') continue;
      else x[k] = v;
    }
    for (const k of ['doneDate', 'txn', 'note']) if (!x[k]) delete x[k];
    if (!x.done) delete x.done;
  }
  touchMonth(ym);
}
function toggleDone(ym, item) {
  if (item.done) mutateItem(ym, item, { done: false, date: null, txn: null });
  else mutateItem(ym, item, { done: true, date: ym < thisMonth() ? item.due : todayStr() });
}
function itemStatus(item) {
  if (item.skip) return 'skip';
  if (item.done) return 'paid';
  const t = todayStr();
  if (item.due < t) return 'late';
  return dayNum(item.due) - dayNum(t) <= 7 ? 'soon' : 'upcoming';
}
function summarize(items) {
  const live = items.filter(i => i.type === 'bill' && !i.skip);
  const bills = live.filter(i => !i.budget), budgets = live.filter(i => i.budget), inc = items.filter(i => i.type === 'income' && !i.skip);
  const fixedTotal = sum(bills, i => i.amount), fixedPaid = sum(bills.filter(i => i.done), i => i.amount);
  // a budget counts at its limit, or at what was really spent when that is higher
  const budgetPlan = sum(budgets, i => Math.max(i.amount, i.spent)), budgetSpent = sum(budgets, i => i.spent), budgetLeft = sum(budgets, i => Math.max(0, i.amount - i.spent));
  const billsTotal = r2(fixedTotal + budgetPlan), billsPaid = r2(fixedPaid + budgetSpent);
  const incomeTotal = sum(inc, i => i.amount), incomeGot = sum(inc.filter(i => i.done), i => i.amount);
  return { bills, budgets, inc, fixedTotal, billsTotal, billsPaid, billsLeft: r2(billsTotal - billsPaid), billsDone: bills.filter(i => i.done).length, budgetSpent, budgetLeft, incomeTotal, incomeGot, leftover: r2(incomeTotal - billsTotal) };
}
function dueText(item) {
  const diff = dayNum(item.due) - dayNum(todayStr());
  if (item.done) return item.doneDate ? `${item.type === 'income' ? 'Received' : 'Paid'} ${fmtShort(item.doneDate)}` : (item.type === 'income' ? 'Received' : 'Paid');
  if (item.skip) return 'Skipped this month';
  if (diff < 0) return item.type === 'income' ? `Not received yet, was due ${fmtShort(item.due)}` : `${plural(-diff, 'day')} late`;
  if (diff === 0) return item.type === 'income' ? 'Expected today' : 'Due today';
  if (diff === 1) return item.type === 'income' ? 'Expected tomorrow' : 'Due tomorrow';
  if (diff <= 7) return `${item.type === 'income' ? 'Expected' : 'Due'} ${WEEKDAYS[weekdayOf(item.due)]}, ${fmtShort(item.due)}`;
  return `${item.type === 'income' ? 'Expected' : 'Due'} ${fmtShort(item.due)}`;
}

/* ---------- statement lines ---------- */
const normText = s => String(s).toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
function merchantKey(desc) {
  let s = String(desc).toLowerCase().replace(/[*#]/g, ' ').replace(/\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, ' ');
  s = s.split(/\s+/).filter(t => !/\d/.test(t)).join(' ');
  s = s.replace(/\b(pos|debit|credit|purchase|card|checkcard|visa|mastercard|recurring|payment|pmt|ach|web|online|authorized|auth|pending|withdrawal|deposit|ref|tst|sq|paypal|pp|payroll|dda)\b/g, ' ');
  const toks = s.split(/[^a-z&.'-]+/).filter(t => t.length > 1);
  return toks.slice(0, 3).join(' ') || normText(desc).slice(0, 14) || 'unknown';
}
const titleCase = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());

const CAT_KEYWORDS = [
  ['Income', ['payroll', 'direct dep', 'salary', 'paycheck', 'dividend', 'interest paid', 'cashout', 'deposit']],
  ['Transfer', ['transfer', 'xfer', 'internal']],
  ['Housing', ['rent', 'mortgage', 'hoa', 'property tax', 'apartment', 'landlord']],
  ['Groceries', ['grocery', 'supermarket', 'kroger', 'safeway', 'whole foods', 'trader joe', 'aldi', 'publix', 'costco', 'wegmans', 'heb', 'h-e-b', 'meijer', 'food lion', 'stop & shop', 'sprouts', 'winco', 'instacart', 'market']],
  ['Dining', ['restaurant', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald', 'chipotle', 'taco bell', 'pizza', 'burger', 'doordash', 'uber eats', 'ubereats', 'grubhub', 'subway', 'chick-fil', 'panera', 'wendy', 'domino', 'grill', 'brewing', 'bakery', 'diner', 'bar &', 'kitchen', 'bistro', 'sushi', 'taqueria']],
  ['Fuel', ['shell', 'chevron', 'exxon', 'mobil', 'bp', 'speedway', 'sunoco', 'valero', 'circle k', 'wawa', 'sheetz', 'racetrac', 'gas station', 'fuel']],
  ['Transport', ['uber', 'lyft', 'parking', 'transit', 'metro', 'toll', 'ez pass', 'e-zpass', 'amtrak', 'car wash']],
  ['Utilities', ['electric', 'power', 'water', 'energy', 'utility', 'utilities', 'sewer', 'waste', 'trash', 'comcast', 'xfinity', 'spectrum', 'at&t', 'verizon', 'tmobile', 't-mobile', 'internet', 'fiber', 'cox', 'centurylink', 'frontier', 'mobile', 'wireless', 'pg&e', 'con ed', 'coned', 'natural gas']],
  ['Insurance', ['insurance', 'geico', 'state farm', 'allstate', 'progressive', 'usaa', 'liberty mutual', 'farmers', 'mutual']],
  ['Health', ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'dental', 'dentist', 'doctor', 'medical', 'clinic', 'hospital', 'health', 'urgent care', 'vision', 'optical', 'labcorp', 'quest diag']],
  ['Subscriptions', ['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'max.com', 'apple.com/bill', 'itunes', 'youtube', 'prime video', 'paramount', 'peacock', 'audible', 'patreon', 'icloud', 'dropbox', 'adobe', 'microsoft 365', 'openai', 'chatgpt', 'github', 'nytimes', 'substack', 'sirius', 'crunchyroll', 'playstation', 'xbox', 'nintendo', 'google one', 'subscription']],
  ['Personal care', ['salon', 'barber', 'haircut', 'spa', 'nails', 'gym', 'fitness', 'ymca', 'peloton']],
  ['Pets', ['petco', 'petsmart', 'chewy', 'vet', 'veterinar']],
  ['Entertainment', ['cinema', 'theater', 'theatre', 'amc', 'regal', 'ticketmaster', 'stubhub', 'concert', 'bowling', 'golf', 'steam', 'museum', 'zoo', 'amusement']],
  ['Travel', ['airline', 'airlines', 'delta', 'united air', 'american air', 'southwest', 'jetblue', 'hotel', 'marriott', 'hilton', 'airbnb', 'expedia', 'booking.com', 'vrbo', 'hertz', 'avis']],
  ['Education', ['tuition', 'university', 'college', 'school', 'udemy', 'coursera']],
  ['Debt', ['loan', 'navient', 'nelnet', 'sallie mae', 'affirm', 'klarna', 'student']],
  ['Giving', ['donation', 'charity', 'gofundme', 'church', 'tithe', 'red cross']],
  ['Fees', ['overdraft', 'atm', 'interest charge', 'finance charge', 'service charge', 'monthly fee', 'maintenance fee']],
  ['Shopping', ['amazon', 'amzn', 'target', 'walmart', 'best buy', 'ebay', 'etsy', 'home depot', 'lowe', 'ikea', 'tj maxx', 'marshalls', 'nordstrom', 'macy', 'old navy', 'zara', 'nike', 'kohl', 'wayfair', 'temu', 'shein', 'apple store']]
];
const kwRegex = kw => {
  const e = kw.trim().replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  return new RegExp(kw.length <= 4 || kw.endsWith(' ') ? `(^|[^a-z0-9])${e}([^a-z0-9]|$)` : `(^|[^a-z0-9])${e}`);
};
const CAT_RE = CAT_KEYWORDS.map(([c, kws]) => [c, kws.map(kwRegex)]);
function autoCategory(desc, amt) {
  const rule = D.rules[merchantKey(desc)];
  if (rule && D.cats.includes(rule)) return rule;
  const s = String(desc).toLowerCase();
  for (const [cat, res] of CAT_RE) {
    if (cat === 'Income' && amt < 0) continue;
    if (res.some(re => re.test(s))) return cat;
  }
  return amt > 0 ? 'Income' : 'Other';
}
function setCategory(txn, cat) {
  txn.cat = cat; txn.man = 1;
  touchTxns(ymOf(txn.date));
  const key = merchantKey(txn.desc);
  D.rules[key] = cat; touchMeta();
  let n = 0;
  for (const t of D.txns) if (t !== txn && !t.man && merchantKey(t.desc) === key && t.cat !== cat) { t.cat = cat; touchTxns(ymOf(t.date)); n++; }
  return n;
}
const dupKey = r => `${r.date}|${r.amt}|${normText(r.desc).slice(0, 40)}`;
function flagDuplicates(rows) {
  const have = {};
  for (const t of D.txns) { const k = dupKey(t); have[k] = (have[k] || 0) + 1; }
  const seen = {};
  for (const r of rows) { const k = dupKey(r); seen[k] = (seen[k] || 0) + 1; r.dup = seen[k] <= (have[k] || 0); }
  return rows;
}
function deleteTxn(id) {
  const i = D.txns.findIndex(t => t.id === id);
  if (i < 0) return;
  const t = D.txns[i];
  D.txns.splice(i, 1); touchTxns(ymOf(t.date));
  for (const [ym, mo] of Object.entries(D.months)) {
    for (const e of Object.values(mo.entries)) if (e.txn === id) { delete e.txn; touchMonth(ym); }
    for (const x of mo.extras) if (x.txn === id) { delete x.txn; touchMonth(ym); }
  }
}

/* ---------- reconcile: link checklist items to statement lines ---------- */
function linkedMap() {
  const m = new Map();
  for (const [ym, mo] of Object.entries(D.months)) {
    for (const [k, e] of Object.entries(mo.entries)) if (e.txn) m.set(e.txn, { ym, key: k });
    for (const x of mo.extras) if (x.txn) m.set(x.txn, { ym, key: 'x:' + x.id });
  }
  return m;
}
const STOP = new Set(['payment', 'bill', 'the', 'and', 'inc', 'llc', 'monthly', 'autopay', 'online', 'pay', 'for', 'one', 'time']);
const nameTokens = name => normText(name).split(' ').filter(t => t.length >= 3 && !STOP.has(t));
function keywordScore(item, desc) {
  const d = ' ' + normText(desc) + ' ';
  const phrases = ((item.tmpl && item.tmpl.match) || '').split(',').map(normText).filter(Boolean);
  if (phrases.some(p => d.includes(p))) return 3;
  const toks = nameTokens(item.name);
  if (!toks.length) return 0;
  const hit = toks.filter(tk => d.includes(tk)).length;
  if (hit && hit / toks.length >= 0.5) return 3;
  return hit ? 1.5 : 0;
}
function scoreMatch(item, txn) {
  if (item.type === 'bill' ? txn.amt >= 0 : txn.amt <= 0) return { s: -1 };
  const kw = keywordScore(item, txn.desc);
  const diff = Math.abs(Math.abs(txn.amt) - item.amount), rel = item.amount ? diff / item.amount : 1;
  const am = diff <= 0.01 ? 3 : rel <= 0.05 ? 2 : rel <= 0.15 ? 1 : 0;
  const dd = Math.abs(dayNum(txn.date) - dayNum(item.due));
  if (dd > 15) return { s: -1 };
  const dt = dd <= 5 ? 1 : dd <= 12 ? 0 : -1;
  const why = [];
  if (kw >= 3) why.push('name'); if (am >= 2) why.push(am === 3 ? 'exact amount' : 'amount'); if (dt > 0) why.push('date');
  return { s: kw + am + dt, why };
}
function candidatePool(ym) {
  const linked = linkedMap();
  const lo = dayNum(ym + '-01') - 10, hi = dayNum(ym + '-01') + daysIn(ym) + 10;
  return D.txns.filter(t => !linked.has(t.id) && dayNum(t.date) >= lo && dayNum(t.date) <= hi);
}
function suggestMatches(ym) {
  const items = itemsFor(ym).filter(i => !i.skip && !i.txn && !i.budget);
  const pool = candidatePool(ym);
  const pairs = [];
  for (const it of items) for (const tx of pool) { const sc = scoreMatch(it, tx); if (sc.s >= 3) pairs.push({ it, tx, s: sc.s, why: sc.why }); }
  pairs.sort((a, b) => b.s - a.s || a.it.due.localeCompare(b.it.due));
  const usedI = new Set(), usedT = new Set(), out = [];
  for (const p of pairs) {
    if (usedI.has(p.it.key) || usedT.has(p.tx.id)) continue;
    usedI.add(p.it.key); usedT.add(p.tx.id); out.push(p);
  }
  return out.sort((a, b) => a.it.due.localeCompare(b.it.due));
}
function linkItem(ym, item, txn) {
  const actual = r2(Math.abs(txn.amt));
  mutateItem(ym, item, { done: true, date: txn.date, amount: actual === item.planned ? null : actual, txn: txn.id });
  const want = item.type === 'income' ? 'Income' : item.category;
  if (want && txn.cat !== want) { txn.cat = want; txn.man = 1; touchTxns(ymOf(txn.date)); }
}
function unlinkItem(ym, item) { mutateItem(ym, item, { txn: null }); }

/* ---------- spending analysis ---------- */
function txnMonths() { return [...new Set(D.txns.map(t => ymOf(t.date)))].sort(); }
function rangeFor(sel) {
  const cur = thisMonth(), ms = txnMonths(), latest = ms.length ? ms[ms.length - 1] : cur;
  switch (sel) {
    case 'this': return { from: cur, to: cur };
    case 'last': return { from: addMonths(cur, -1), to: addMonths(cur, -1) };
    case '3': return { from: addMonths(latest, -2), to: latest };
    case '6': return { from: addMonths(latest, -5), to: latest };
    case '12': return { from: addMonths(latest, -11), to: latest };
    default: return { from: ms[0] || cur, to: latest };
  }
}
function monthsBetween(from, to) { const out = []; for (let m = from; m <= to && out.length < 36; m = addMonths(m, 1)) out.push(m); return out; }
function spendStats(from, to) {
  const linked = linkedMap();
  const byCat = {}, byMonth = {}, merchants = {};
  monthsBetween(from, to).forEach(m => { byMonth[m] = { in: 0, out: 0 }; });
  let income = 0, spent = 0, tracked = 0, count = 0;
  for (const t of D.txns) {
    const m = ymOf(t.date);
    if (m < from || m > to) continue;
    count++;
    if (t.cat === 'Income') { income += t.amt; byMonth[m].in += t.amt; continue; }
    if (t.cat === 'Transfer') continue;
    const out = -t.amt;
    spent += out; byMonth[m].out += out;
    byCat[t.cat] = (byCat[t.cat] || 0) + out;
    if (linked.has(t.id)) tracked += out;
    const k = merchantKey(t.desc), mm = merchants[k] || (merchants[k] = { key: k, total: 0, n: 0, names: {} });
    mm.total += out; mm.n++; mm.names[t.desc] = (mm.names[t.desc] || 0) + 1;
  }
  return { income: r2(income), spent: r2(spent), tracked: r2(tracked), count, byCat, byMonth, merchants: Object.values(merchants) };
}
function detectRecurring() {
  const linked = linkedMap(), groups = {};
  const ms = txnMonths(); if (!ms.length) return [];
  const latest = ms[ms.length - 1];
  for (const t of D.txns) {
    if (t.amt >= 0 || NON_SPEND.has(t.cat) || linked.has(t.id)) continue;
    (groups[merchantKey(t.desc)] ||= []).push(t);
  }
  const out = [];
  for (const [k, list] of Object.entries(groups)) {
    const months = new Set(list.map(t => ymOf(t.date)));
    if (months.size < 3 || list.length > months.size * 1.4) continue;
    const amts = list.map(t => -t.amt).sort((a, b) => a - b), med = amts[Math.floor(amts.length / 2)];
    if (amts.filter(a => Math.abs(a - med) / med <= 0.12).length / amts.length < 0.7) continue;
    if ([...months].sort().pop() < addMonths(latest, -1)) continue;
    const tracked = D.templates.some(tp => tp.type === 'bill' && (merchantKey(tp.name) === k || String(tp.match || '').split(',').some(p => p.trim() && k.includes(normText(p))) || nameTokens(tp.name).some(tk => tk.length > 3 && k.includes(tk))));
    if (tracked) continue;
    const days = list.map(t => +t.date.slice(8, 10)).sort((a, b) => a - b), cats = {};
    list.forEach(t => { cats[t.cat] = (cats[t.cat] || 0) + 1; });
    out.push({ key: k, name: titleCase(k), amount: med, months: months.size, day: days[Math.floor(days.length / 2)], cat: Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0] });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 8);
}

/* ---------- example data (so every screen has something to show; clearly marked and removable) ---------- */
function loadSample() {
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const d = emptyData();
  d.sample = true;
  const cur = thisMonth(), start = addMonths(cur, -2), today = todayStr();
  const T = (type, name, amount, category, day, match, extra = {}) => ({ id: uid('b'), type, name, amount, category, freq: 'monthly', day, match, start, ...extra });
  d.templates = [
    T('bill', 'Rent', 1450, 'Housing', 1, 'greenview'),
    T('bill', 'Gym membership', 29, 'Personal care', 3, 'peak fitness'),
    T('bill', 'Netflix', 15.49, 'Subscriptions', 8, 'netflix'),
    T('bill', 'Electric', 96, 'Utilities', 12, 'city power', { autopay: true }),
    T('bill', 'Internet', 65, 'Utilities', 15, 'fibernet'),
    T('bill', 'Phone', 48, 'Utilities', 18, 'mobilecom'),
    T('bill', 'Spotify', 11.99, 'Subscriptions', 20, 'spotify'),
    T('bill', 'Car insurance', 132, 'Insurance', 22, 'shieldmutual'),
    T('bill', 'Student loan', 210, 'Debt', 25, 'loanserv'),
    T('bill', 'Groceries', 600, 'Groceries', 1, '', { budget: true }),
    T('income', 'Paycheck', 2150, 'Income', 5, 'acme payroll', { freq: 'twice', day2: 20 })
  ];
  const txns = [];
  const add = (date, desc, amt, cat) => { if (date <= today) txns.push({ id: uid('t'), date, desc, amt: r2(amt), src: 'sample', ...(cat ? { cat } : {}) }); };
  for (let k = 0; k < 3; k++) {
    const ym = addMonths(start, k);
    const day = n => clampDay(ym, n);
    for (const t of d.templates) {
      if (t.budget) continue; // budgets are spent through the grocery lines below
      for (const due of occurrences(t, ym)) {
        const dd = fromDayNum(dayNum(due) + (t.type === 'bill' ? Math.floor(rnd() * 3) : 0));
        let amt = t.amount; if (t.name === 'Electric') amt = 78 + Math.round(rnd() * 5200) / 100;
        const desc = { Rent: 'GREENVIEW PROPERTIES ACH', 'Gym membership': 'PEAK FITNESS #2231', Netflix: 'NETFLIX.COM', Electric: 'CITY POWER & LIGHT', Internet: 'FIBERNET SERVICES', Phone: 'MOBILECOM WIRELESS', Spotify: 'SPOTIFY USA', 'Car insurance': 'SHIELDMUTUAL INS PREM', 'Student loan': 'LOANSERV PAYMENT', Paycheck: 'ACME CORP PAYROLL DIRECT DEP' }[t.name];
        add(dd, desc, t.type === 'bill' ? -amt : amt, t.category);
      }
    }
    [3, 10, 17, 24].forEach((n, i) => add(day(n + Math.floor(rnd() * 3)), ['GREENFIELD MARKET #112', "TRADER JOE'S #551", 'GREENFIELD MARKET #112', 'COSTCO WHSE #0442'][i], -(48 + rnd() * 90)));
    [4, 13, 26].forEach(n => add(day(n), 'SHELL OIL 5744', -(34 + rnd() * 22)));
    [6, 9, 14, 19, 23, 28].forEach((n, i) => add(day(n), ['CHIPOTLE 2210', 'STARBUCKS STORE 8842', 'LUIGIS PIZZERIA', 'DOORDASH*THAI GARDEN', 'STARBUCKS STORE 8842', 'TACO BELL #3321'][i], -(7 + rnd() * 28)));
    [7, 16, 27].forEach(n => add(day(n), 'AMAZON.COM*2K4RT12', -(14 + rnd() * 70)));
    add(day(11), 'CVS PHARMACY #4411', -(9 + rnd() * 24));
    add(day(21), 'AMC THEATRES 0231', -(22 + rnd() * 30));
    add(day(9), 'HULU 877-8244858 CA', -7.99);
    if (k === 1) add(day(14), 'TRANSFER TO SAVINGS', -300);
  }
  for (const t of txns) { t.cat = t.cat || autoCategoryFor(d, t.desc, t.amt); }
  txns.sort((a, b) => a.date.localeCompare(b.date));
  d.txns = txns;
  d.imports = [{ id: 'sample', name: 'Example statement.csv', label: 'Example checking', at: Date.now(), count: txns.length, from: txns[0].date, to: txns[txns.length - 1].date }];
  const gid = d.templates.find(t => t.budget).id;
  [[start, [[4, 61.2, 'Weekly shop'], [12, 88.45, 'Market'], [20, 54.1, ''], [27, 97.8, 'Costco']]], [addMonths(start, 1), [[5, 70.3, ''], [13, 82, 'Weekly shop'], [21, 95.6, 'Market'], [28, 133.4, 'Party food']]], [cur, [[3, 64.9, 'Weekly shop'], [9, 112.35, 'Market'], [15, 148.2, 'Costco'], [18, 91.0, '']]]].forEach(([ym, list]) => {
    d.months[ym] = d.months[ym] || { entries: {}, extras: [], spends: [] };
    list.forEach(([day, amount, note]) => { const date = clampDay(ym, day); if (date <= today) d.months[ym].spends.push({ id: uid('s'), t: gid, date, amount, ...(note ? { note } : {}) }); });
  });
  D = d;
  // oldest month: everything checked off and matched; last month: left for you to try Auto-match; this month: partly done
  const old = suggestMatches(start);
  old.forEach(p => linkItem(start, p.it, p.tx));
  for (const it of itemsFor(cur)) if (!it.budget && it.due < addMonths(cur, 0) + '-' + pad(Math.max(1, +today.slice(8, 10) - 3))) mutateItem(cur, it, { done: true, date: it.due });
  allDocKeys().forEach(k => dirty.add(k));
  Store.schedule();
}
function autoCategoryFor(d, desc, amt) { const keep = D; D = d; const c = autoCategory(desc, amt); D = keep; return c; }
