/* ---------- statement parsing: CSV, OFX/QFX and (best effort) PDF ---------- */
const MONTH_IDX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const clean = s => String(s ?? '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function mkDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}
function parseDate(str, fmt = 'mdy') {
  if (!str) return null;
  const s = String(str).trim();
  let m;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return mkDate(+m[1], +m[2], +m[3]);
  if (/^\d{8}/.test(s) && (m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return mkDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    const a = +m[1], b = +m[2];
    return fmt === 'dmy' ? mkDate(y, b, a) : mkDate(y, a, b);
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MONTH_IDX[m[1].slice(0, 3).toLowerCase()]) {
    return mkDate(+m[3], MONTH_IDX[m[1].slice(0, 3).toLowerCase()], +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})\.?[\s\-,]+(\d{2,4})/)) && MONTH_IDX[m[2].slice(0, 3).toLowerCase()]) {
    let y = +m[3]; if (y < 100) y += 2000;
    return mkDate(y, MONTH_IDX[m[2].slice(0, 3).toLowerCase()], +m[1]);
  }
  return null;
}
function detectDateFmt(values) {
  let dmy = 0, mdy = 0;
  for (const v of values) {
    const m = String(v).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return dmy > mdy ? 'dmy' : 'mdy';
}
function parseAmount(str) {
  if (str == null) return null;
  let s = String(str).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  if (/\bDR\b/i.test(s)) { neg = true; s = s.replace(/\bDR\b/i, ''); }
  s = s.replace(/\bCR\b/i, '');
  if (/^\s*[-−]/.test(s)) { neg = true; s = s.replace(/^\s*[-−]/, ''); }
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = (/,\d{2}$/.test(s) && s.indexOf(',') === lc) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return r2(neg ? -n : n);
}

/* ----- CSV ----- */
function detectDelimiter(text) {
  const first = text.split(/\r?\n/).slice(0, 6).join('\n');
  const c = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inq = false;
  for (const ch of first) { if (ch === '"') inq = !inq; else if (!inq && Object.prototype.hasOwnProperty.call(c, ch)) c[ch]++; }
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [], cell = '', inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += ch;
    } else if (ch === '"') inq = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}
const HDR_WORDS = /date|descr|amount|debit|credit|memo|payee|details|posted|transaction|merchant|balance|withdraw|deposit|narrative|reference|type|category/i;
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const hits = rows[i].filter(c => c && HDR_WORDS.test(c) && !/\d{3,}/.test(c)).length;
    if (hits >= 2) return i;
  }
  return -1;
}
function analyzeCSV(rows) {
  const hi = findHeaderRow(rows);
  const width = Math.max(...rows.slice(0, 50).map(r => r.length));
  const headers = hi >= 0 ? rows[hi].concat(Array(Math.max(0, width - rows[hi].length)).fill('')).map((h, i) => h || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const body = rows.slice(hi + 1);
  const find = (...res) => { for (const re of res) { const i = headers.findIndex(h => re.test(h)); if (i > -1) return i; } return -1; };
  const map = {
    date: find(/^(post(ing|ed)?[ _-]?date|date posted)$/i, /^(trans(action)?[ _-]?date|booking date|value date)$/i, /^date$/i, /date/i),
    desc: find(/^(description|desc|payee|merchant|narrative|name|particulars|transaction description)$/i, /descr|payee|merchant|name/i, /memo|details|reference|note/i),
    amount: find(/^(amount|transaction amount|value)$/i, /amount/i),
    debit: find(/debit|withdraw|paid out|money out|outflow|charge/i),
    credit: find(/credit|deposit|paid in|money in|inflow/i),
    type: find(/^(transaction )?type$/i, /^dr\/?cr$/i, /^details$/i)
  };
  if (map.amount > -1 && (map.amount === map.debit || map.amount === map.credit)) map.amount = -1;
  if (map.debit > -1 && map.debit === map.credit) map.credit = -1;
  const col = i => body.slice(0, 200).map(r => r[i] ?? '');
  if (map.date < 0) {
    let best = -1, bestR = 0.6;
    for (let i = 0; i < width; i++) { const v = col(i).filter(Boolean); if (!v.length) continue; const r = v.filter(x => parseDate(x)).length / v.length; if (r > bestR) { best = i; bestR = r; } }
    map.date = best;
  }
  if (map.amount < 0 && map.debit < 0 && map.credit < 0) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < width; i++) {
      if (i === map.date) continue;
      const v = col(i).filter(Boolean); if (!v.length) continue;
      const nums = v.filter(x => /\d/.test(x) && parseAmount(x) != null && !parseDate(x) && /^[\s$€£()+\-−\d.,CRDcrd]+$/.test(x));
      const r = nums.length / v.length;
      const score = r + (nums.some(x => /\./.test(x)) ? 0.2 : 0);
      if (r > 0.7 && score > bestScore) { best = i; bestScore = score; }
    }
    map.amount = best;
  }
  if (map.desc < 0 || map.desc === map.date || map.desc === map.amount) {
    let best = -1, bestLen = 0;
    for (let i = 0; i < width; i++) {
      if ([map.date, map.amount, map.debit, map.credit].includes(i)) continue;
      const avg = col(i).reduce((s, x) => s + (/[A-Za-z]/.test(x) ? x.length : 0), 0) / Math.max(1, col(i).length);
      if (avg > bestLen) { best = i; bestLen = avg; }
    }
    map.desc = best;
  }
  const dateFmt = detectDateFmt(col(map.date));
  // Unsigned amounts plus a Debit/Credit-style column: use the column for the sign.
  let useType = false;
  if (map.amount > -1 && map.type > -1 && map.type !== map.amount) {
    const amts = col(map.amount).map(parseAmount).filter(a => a != null);
    const types = new Set(col(map.type).map(t => t.toLowerCase()));
    if (amts.length && amts.every(a => a >= 0) && [...types].some(t => /debit|credit|^dr$|^cr$|withdraw|deposit/.test(t))) useType = true;
  }
  return { hi, headers, body, map, dateFmt, useType };
}
function rowsToTxns(body, map, o) {
  const out = []; let bad = 0;
  const g = (r, i) => (i > -1 ? (r[i] ?? '') : '');
  for (const r of body) {
    const date = parseDate(g(r, map.date), o.dateFmt);
    if (!date) { bad++; continue; }
    let amt = null;
    if (map.amount > -1) amt = parseAmount(g(r, map.amount));
    if (amt == null && (map.debit > -1 || map.credit > -1)) {
      const d = parseAmount(g(r, map.debit)), c = parseAmount(g(r, map.credit));
      if (d != null && d !== 0) amt = -Math.abs(d);
      else if (c != null && c !== 0) amt = Math.abs(c);
      else if (d === 0 || c === 0) amt = 0;
    } else if (amt != null && o.useType && map.type > -1) {
      const t = g(r, map.type).toLowerCase();
      if (/debit|withdraw|^dr$/.test(t)) amt = -Math.abs(amt); else if (/credit|deposit|^cr$/.test(t)) amt = Math.abs(amt);
    }
    if (amt == null) { bad++; continue; }
    if (o.flip) amt = -amt;
    out.push({ date, desc: clean(g(r, map.desc)) || '(no description)', amt: r2(amt) });
  }
  return { txns: out, bad };
}
function suggestFlip(body, map) {
  if (map.amount < 0) return false;
  const a = body.map(r => parseAmount(r[map.amount])).filter(x => x != null && x !== 0);
  return a.length >= 5 && a.every(x => x > 0);
}

/* ----- OFX / QFX ----- */
function parseOFX(text) {
  const out = [];
  for (const b of text.split(/<STMTTRN>/i).slice(1)) {
    const blk = b.split(/<\/STMTTRN>/i)[0];
    const tag = n => { const m = blk.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
    const dt = tag('DTPOSTED').match(/^(\d{4})(\d{2})(\d{2})/);
    const amt = parseFloat(tag('TRNAMT').replace(/,/g, ''));
    if (!dt || isNaN(amt)) continue;
    const name = clean(tag('NAME')), memo = clean(tag('MEMO'));
    const desc = name && memo && !memo.toLowerCase().includes(name.toLowerCase()) ? name + ' ' + memo : (name || memo);
    out.push({ date: `${dt[1]}-${dt[2]}-${dt[3]}`, desc: desc || '(no description)', amt: r2(amt) });
  }
  return out;
}

/* ----- PDF (best effort: reads the text layer and looks for "date ... amount" lines) ----- */
let _pdfjs = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!_pdfjs) {
    _pdfjs = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); } catch (e) { rej(e); } };
      s.onerror = () => { _pdfjs = null; rej(new Error('the PDF reader could not load. Check your connection or use the CSV download from your bank')); };
      document.head.appendChild(s);
    });
  }
  return _pdfjs;
}
async function extractPdfLines(buf) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    const flush = () => { if (cur) { cur.items.sort((a, b) => a.x - b.x); lines.push(cur.items.map(i => i.s.trim()).join(' ').replace(/\s+/g, ' ')); } };
    for (const it of items) {
      if (cur && Math.abs(it.y - cur.y) <= 3) cur.items.push(it); else { flush(); cur = { y: it.y, items: [it] }; }
    }
    flush();
  }
  return lines;
}
const AMT_RE = '[-+(]?\\$?\\s?\\d[\\d,]*\\.\\d{2}\\)?-?(?:\\s?(?:CR|DR))?';
function statementYears(text) {
  let end = null;
  for (const m of text.matchAll(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/g)) { const d = mkDate(+m[3], +m[1], +m[2]); if (d && (!end || d > end)) end = d; }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/g)) { const mi = MONTH_IDX[m[1].slice(0, 3).toLowerCase()]; if (!mi) continue; const d = mkDate(+m[3], mi, +m[2]); if (d && (!end || d > end)) end = d; }
  if (end) return { y: +end.slice(0, 4), m: +end.slice(5, 7) };
  const counts = {};
  for (const m of text.matchAll(/\b(20\d{2})\b/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? { y: +top[0], m: 12 } : { y: new Date().getFullYear(), m: 12 };
}
const CREDIT_WORDS = /deposit|payroll|direct dep|refund|interest paid|transfer from|payment.*thank|credit(?! card)|reversal|cashback|dividend|zelle from|venmo cashout/i;
function parsePdfLines(lines) {
  const text = lines.join('\n');
  const yi = statementYears(text);
  const dateTok = '(?:\\d{1,2}[\\/\\-]\\d{1,2}(?:[\\/\\-]\\d{2,4})?|[A-Za-z]{3}\\.?\\s+\\d{1,2}(?:,?\\s+\\d{4})?)';
  const lineRe = new RegExp(`^(${dateTok})\\s+(?:(${dateTok})\\s+)?(.+?)\\s+((?:${AMT_RE}\\s*){1,2})$`, 'i');
  const out = [];
  let prevBal = null;
  for (const raw of lines) {
    const bal0 = raw.match(new RegExp(`(?:beginning|opening|previous) balance.*?(${AMT_RE})`, 'i'));
    if (bal0) { prevBal = parseAmount(bal0[1]); continue; }
    const m = raw.match(lineRe);
    if (!m) continue;
    const amts = m[4].match(new RegExp(AMT_RE, 'gi')).map(x => x.trim());
    let dateStr = m[1];
    let date = parseDate(dateStr);
    if (!date) {
      const nm = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})$/) || null;
      let mo, d;
      if (nm) { mo = +nm[1]; d = +nm[2]; } else { const w = dateStr.match(/^([A-Za-z]{3})\.?\s+(\d{1,2})/); if (!w || !MONTH_IDX[w[1].toLowerCase()]) continue; mo = MONTH_IDX[w[1].toLowerCase()]; d = +w[2]; }
      date = mkDate(mo > yi.m ? yi.y - 1 : yi.y, mo, d);
    }
    if (!date) continue;
    const tok = amts[0], balTok = amts.length > 1 ? amts[1] : null;
    const desc = clean(m[3]);
    let a = Math.abs(parseAmount(tok));
    if (/^[-(]|\)$|-$|\bDR\b/i.test(tok)) a = -a;
    else if (/^\+|\bCR\b/i.test(tok)) a = +a;
    else if (balTok != null && prevBal != null) {
      const delta = r2(parseAmount(balTok) - prevBal);
      a = Math.abs(delta - a) < 0.011 ? +a : Math.abs(delta + a) < 0.011 ? -a : (CREDIT_WORDS.test(desc) ? +a : -a);
    } else a = CREDIT_WORDS.test(desc) ? +a : -a;
    if (balTok != null) prevBal = parseAmount(balTok);
    out.push({ date, desc: desc || '(no description)', amt: r2(a) });
  }
  return { txns: out };
}
