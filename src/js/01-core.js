'use strict';

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const sum = (a, f = x => x) => r2(a.reduce((s, x) => s + f(x), 0));

/* ---------- dates (all dates are 'YYYY-MM-DD' strings, months are 'YYYY-MM') ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map(m => m.slice(0, 3));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
const fromDayNum = n => { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => todayStr().slice(0, 7);
const ymOf = s => s.slice(0, 7);
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${pad(t % 12 + 1)}`; };
const clampDay = (ym, d) => `${ym}-${pad(Math.min(Math.max(1, d | 0 || 1), daysIn(ym)))}`;
const weekdayOf = s => new Date(dayNum(s) * 864e5).getUTCDay();
const fmtMonth = ym => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const fmtMon = ym => MON[+ym.slice(5, 7) - 1];
const fmtShort = s => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;
const fmtDate = s => `${fmtShort(s)}, ${s.slice(0, 4)}`;
const ord = n => { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); };
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;

/* ---------- money ---------- */
let _fmt = null, _fmtCur = '';
function money(n, o = {}) {
  const cur = D.settings.currency || 'USD';
  if (_fmtCur !== cur) { _fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }); _fmtCur = cur; }
  const v = Math.abs(n) < 0.005 ? 0 : n;
  return o.sign && v > 0 ? '+' + _fmt.format(v) : _fmt.format(v);
}
function moneyShort(n) {
  const cur = D.settings.currency || 'USD';
  const sym = (new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === 'currency') || { value: '$' }).value;
  const a = Math.abs(n);
  if (a >= 1e6) return sym + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1000) return sym + (n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return sym + Math.round(n);
}

/* ---------- data model ----------
   templates : recurring bills and income (the "monthly obligations")
   months[ym]: { entries: { 'tmplId@YYYY-MM-DD': {done,date,amount,note,txn,skip} }, extras: [one-off items],
                 spends: [{id,t:templateId,date,amount,note}] }   (spends are purchases entered against a spending budget)
   a template with budget:true is a monthly spending limit rather than a fixed payment
   txns      : imported statement lines {id,date,desc,amt,cat,man,src}; amt < 0 is money out
   imports   : one record per uploaded file
   rules     : merchant key -> category, learned when you recategorise a transaction                */
const DEFAULT_CATS = ['Housing', 'Utilities', 'Groceries', 'Dining', 'Fuel', 'Transport', 'Insurance', 'Health', 'Subscriptions', 'Shopping',
  'Entertainment', 'Travel', 'Education', 'Debt', 'Fees', 'Personal care', 'Pets', 'Giving', 'Income', 'Transfer', 'Other'];
const NON_SPEND = new Set(['Income', 'Transfer']);
const emptyData = () => ({ v: 1, settings: { currency: 'USD' }, templates: [], months: {}, txns: [], imports: [], rules: {}, cats: [...DEFAULT_CATS], sample: false });
let D = emptyData();

const FREQ = { monthly: 'Monthly', twice: 'Twice a month', biweekly: 'Every 2 weeks', weekly: 'Every week', quarterly: 'Every 3 months', semiannual: 'Every 6 months', yearly: 'Once a year' };
const PER_YEAR = { monthly: 12, twice: 24, biweekly: 26, weekly: 52, quarterly: 4, semiannual: 2, yearly: 1 };
const monthlyEquiv = t => t.amount * PER_YEAR[t.freq] / 12;
function freqText(t) {
  switch (t.freq) {
    case 'monthly': return `Monthly on the ${ord(t.day)}`;
    case 'twice': return `Twice a month, ${ord(t.day)} and ${ord(t.day2 || 15)}`;
    case 'biweekly': return t.anchor ? `Every other ${WEEKDAYS[weekdayOf(t.anchor)]}` : 'Every 2 weeks';
    case 'weekly': return t.anchor ? `Every ${WEEKDAYS[weekdayOf(t.anchor)]}` : 'Every week';
    case 'quarterly': return `Every 3 months on the ${ord(t.day)}`;
    case 'semiannual': return `Every 6 months on the ${ord(t.day)}`;
    case 'yearly': return `Yearly, ${MONTHS[(t.month || 1) - 1]} ${ord(t.day)}`;
  }
  return '';
}
const spendCats = () => D.cats.filter(c => !NON_SPEND.has(c));

/* ---------- change tracking: each month and each transaction-month is its own saved document ---------- */
const dirty = new Set();
const touchMeta = () => { dirty.add('meta'); Store.schedule(); };
const touchMonth = ym => { dirty.add('m_' + ym); Store.schedule(); };
const touchTxns = ym => { dirty.add('t_' + ym); Store.schedule(); };
const monthHasData = mo => mo && (Object.keys(mo.entries).length || mo.extras.length || (mo.spends || []).length);

function buildDoc(key) {
  if (key === 'meta') return { v: 1, settings: D.settings, templates: D.templates, rules: D.rules, cats: D.cats, imports: D.imports, sample: D.sample };
  if (key.startsWith('m_')) { const mo = D.months[key.slice(2)]; return monthHasData(mo) ? { entries: mo.entries, extras: mo.extras, spends: mo.spends || [] } : null; }
  if (key.startsWith('t_')) { const ym = key.slice(2); const list = D.txns.filter(t => ymOf(t.date) === ym); return list.length ? { list } : null; }
  return null;
}
function allDocKeys() {
  const keys = new Set(['meta']);
  Object.keys(D.months).forEach(ym => keys.add('m_' + ym));
  D.txns.forEach(t => keys.add('t_' + ymOf(t.date)));
  return keys;
}
function dataFromDocs(docs) {
  const d = emptyData();
  const meta = docs.meta;
  if (meta) {
    d.settings = Object.assign(d.settings, meta.settings || {});
    d.templates = meta.templates || [];
    d.rules = meta.rules || {};
    d.cats = meta.cats && meta.cats.length ? meta.cats : d.cats;
    d.imports = meta.imports || [];
    d.sample = !!meta.sample;
  }
  for (const [k, v] of Object.entries(docs)) {
    if (k.startsWith('m_')) d.months[k.slice(2)] = { entries: v.entries || {}, extras: v.extras || [], spends: v.spends || [] };
    else if (k.startsWith('t_')) d.txns.push(...(v.list || []));
  }
  d.txns.sort((a, b) => a.date.localeCompare(b.date));
  for (const c of ['Income', 'Transfer', 'Other']) if (!d.cats.includes(c)) d.cats.push(c);
  return d;
}

/* ---------- storage: private Claude storage when published, otherwise this browser ---------- */
function memBackend() {
  const m = {};
  return { mode: 'memory', async list() { return JSON.parse(JSON.stringify(m)); }, async set(k, b) { m[k] = JSON.parse(JSON.stringify(b)); }, async remove(k) { delete m[k]; } };
}
function lsBackend() {
  const P = 'billledger.v1.';
  localStorage.setItem(P + '_t', '1'); localStorage.removeItem(P + '_t'); // throws when storage is blocked
  return {
    mode: 'browser',
    async list() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(P)) { try { out[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip bad doc */ } }
      }
      return out;
    },
    async set(k, b) { localStorage.setItem(P + k, JSON.stringify(b)); },
    async remove(k) { localStorage.removeItem(P + k); }
  };
}
/* The ledger lives at a shared path so people the page is shared with can read it.
   The db rules in the publish call let only the page's owner write there. */
const SHARED_PATH = 'ledger';
function cloudBackend(db, path, canWrite) {
  const col = db.collection(path);
  const toDocs = snap => { const out = {}; snap.docs.forEach(d => { out[d.id] = JSON.parse(JSON.stringify(d.data())); }); return out; };
  return {
    mode: canWrite ? 'cloud' : 'cloud-view',
    async list() { return toDocs(await col.limit(1000).get()); },
    async set(k, b) { await col.doc(k).set(b); },
    async remove(k) { await col.doc(k).delete(); },
    watch(cb) { return col.limit(1000).onSnapshot(s => cb(toDocs(s)), () => { /* the next page load recovers */ }); }
  };
}
function lockedBackend() { return { mode: 'locked', async list() { return {}; }, async set() {}, async remove() {} }; }
/* Earlier versions kept the ledger in the owner's private space. Copy it to the shared path once, then remove the old copy. */
async function migratePrivate(db, id, shared) {
  const priv = cloudBackend(db, 'data/users/' + id, true), old = await priv.list(), keys = Object.keys(old);
  if (!keys.length) return null;
  for (const k of keys) await shared.set(k, old[k]);
  const check = await shared.list();
  if (keys.every(k => check[k])) for (const k of keys) await priv.remove(k);
  return check;
}

const Store = {
  backend: null, known: new Set(), timer: null, saving: false, state: 'saved', detail: '',
  async init() {
    let backend = null, docs = null;
    if (window.claude && window.claude.use) {
      let db = null, user = null;
      try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { /* capabilities unavailable */ }
      const owner = user ? await user.isOwner() : false;
      const id = db && user ? await user.id() : null;
      if (db && id) {
        backend = cloudBackend(db, SHARED_PATH, owner);
        docs = await backend.list();
        if (owner && !docs.meta) docs = (await migratePrivate(db, id, backend)) || docs;
      } else if (!owner) backend = lockedBackend();
    }
    if (!backend) { try { backend = lsBackend(); } catch (e) { backend = memBackend(); } }
    this.backend = backend;
    if (!docs) docs = await backend.list();
    this.known = new Set(Object.keys(docs));
    D = dataFromDocs(docs);
    if (backend.mode === 'cloud-view') {
      let first = true;
      backend.watch(next => { if (first) { first = false; return; } D = dataFromDocs(next); if (typeof render === 'function') render(); });
    }
  },
  get mode() { return this.backend ? this.backend.mode : 'memory'; },
  get readonly() { return this.mode === 'cloud-view' || this.mode === 'locked'; },
  schedule() { if (this.readonly) return; this.setState('busy'); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 450); },
  setState(s, detail = '') {
    this.state = s; this.detail = detail;
    const el = document.getElementById('saveState');
    if (el) el.replaceWith(saveChip());
  },
  async flush() {
    if (this.saving || !this.backend || this.readonly) return;
    this.saving = true;
    let failed = null;
    while (dirty.size) {
      const key = dirty.values().next().value;
      dirty.delete(key);
      const body = buildDoc(key);
      try {
        if (body) { await this.withRetry(() => this.backend.set(key, body)); this.known.add(key); }
        else if (this.known.has(key)) { await this.withRetry(() => this.backend.remove(key)); this.known.delete(key); }
      } catch (e) { dirty.add(key); failed = e; break; }
    }
    this.saving = false;
    if (failed) {
      const full = failed && (failed.code === 'quota_exceeded' || /quota/i.test(failed.name + failed.message));
      this.setState('err', full ? 'Storage is full. Export a backup and remove old statements.' : 'Could not save. Retrying.');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 6000);
    } else this.setState('saved');
  },
  async withRetry(fn) {
    try { return await fn(); } catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); return fn(); }
      throw e;
    }
  },
  /* after a restore or erase: write every document and remove the ones that no longer exist */
  async replaceAll() {
    const keys = allDocKeys();
    this.known.forEach(k => keys.add(k));
    keys.forEach(k => dirty.add(k));
    await this.flush();
  }
};
addEventListener('pagehide', () => { if (dirty.size) Store.flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty.size) Store.flush(); });

function saveChip() {
  const s = document.createElement('span');
  s.id = 'saveState';
  if (Store.readonly) { s.className = 'save ro'; s.textContent = 'View only'; s.title = 'You can look at everything here but not change it'; return s; }
  const where = Store.mode === 'cloud' ? 'Saved with this page on your Claude account' : Store.mode === 'browser' ? 'Saved in this browser' : 'Not saved. Export a backup before closing';
  s.className = 'save' + (Store.state === 'busy' ? ' busy' : Store.state === 'err' || Store.mode === 'memory' ? ' err' : '');
  s.textContent = Store.state === 'busy' ? 'Saving…' : Store.state === 'err' ? Store.detail : Store.mode === 'cloud' ? 'Saved' : where;
  s.title = where;
  return s;
}
