/* ---------- one-page monthly update as a PDF ----------
   Written by hand (text, lines and boxes in the built-in Helvetica), so nothing is loaded and nothing leaves the page. */
const PDF_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const PDF_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const PDF_CP = { '€': 128, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153 };
/* the byte a character becomes in the PDF's Windows-1252 text; anything else turns into ? */
const pdfCode = ch => { const c = ch.charCodeAt(0); return c >= 32 && c < 127 || c >= 160 && c < 256 ? c : PDF_CP[ch] || (/\s/.test(ch) ? 32 : 63); };
function pdfWidth(s, size, bold, spacing = 0) {
  let w = 0;
  for (const ch of s) {
    const c = pdfCode(ch), t = bold ? PDF_BOLD : PDF_REG;
    const em = c < 127 ? t[c - 32] : c === 151 || c === 133 ? 1000 : c === 160 || c === 183 ? 278 : c >= 192 ? (t[ch.normalize('NFD').charCodeAt(0) - 32] || 556) : 556;
    w += em * size / 1000 + spacing;
  }
  return w;
}
const pdfEsc = s => [...s].map(ch => { const c = String.fromCharCode(pdfCode(ch)); return c === '\\' || c === '(' || c === ')' ? '\\' + c : c; }).join('');
function pdfFit(s, size, bold, max) {
  if (pdfWidth(s, size, bold) <= max) return s;
  while (s.length > 1 && pdfWidth(s + '…', size, bold) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

function pdfNew() {
  const W = 595.28, H = 841.89, pages = [];
  let at = -1;
  const n = v => String(Math.round(v * 100) / 100), rgb = c => c.map(n).join(' ');
  const put = op => pages[at].push(op);
  return {
    W, H,
    page() { pages.push([]); at = pages.length - 1; },
    select(i) { at = i; },
    pageCount: () => pages.length,
    /* y is the text baseline, measured down from the top of the sheet */
    text(x, y, s, o = {}) {
      const size = o.size || 10, sp = o.spacing || 0;
      const px = o.align === 'right' ? x - pdfWidth(s, size, o.bold, sp) : x;
      put(`BT /${o.bold ? 'F2' : 'F1'} ${n(size)} Tf ${n(sp)} Tc ${rgb(o.color || [0, 0, 0])} rg ${n(px)} ${n(H - y)} Td (${pdfEsc(s)}) Tj ET`);
    },
    rect(x, y, w, h, c) { put(`${rgb(c)} rg ${n(x)} ${n(H - y - h)} ${n(w)} ${n(h)} re f`); },
    hline(x1, x2, y, c, lw = 0.6) { put(`${rgb(c)} RG ${n(lw)} w ${n(x1)} ${n(H - y)} m ${n(x2)} ${n(H - y)} l S`); },
    build(title) {
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + 2 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        `<< /Title (${pdfEsc(title)}) /Creator (Jarrod's CFO) >>`
      ];
      pages.forEach((ops, i) => {
        const body = ops.join('\n');
        objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`);
        objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      });
      let out = '%PDF-1.4\n', pos = [];
      objs.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return Uint8Array.from(out, ch => ch.charCodeAt(0));
    }
  };
}

/* the sheet: income in, bills paid, what is left to pay, and how the variable expenses stand */
function monthlyReport(ym) {
  const INK = [0.09, 0.11, 0.16], MUTED = [0.42, 0.46, 0.54], LINE = [0.85, 0.87, 0.91], PANEL = [0.955, 0.962, 0.977], ACCENT = [0.114, 0.357, 0.667], GOOD = [0.07, 0.46, 0.27], BAD = [0.74, 0.14, 0.14];
  const items = itemsFor(ym), S = summarize(items), cur = thisMonth(), today = todayStr(), lastDay = `${ym}-${pad(daysIn(ym))}`;
  const when = i => i.doneDate || i.due, byDate = f => (a, b) => f(a).localeCompare(f(b));
  const fixed = items.filter(i => i.type === 'bill' && !i.budget && !i.skip);
  const paid = fixed.filter(i => i.done).sort(byDate(when)), unpaid = fixed.filter(i => !i.done).sort(byDate(i => i.due));
  const buds = items.filter(i => i.budget), room = buds.map(b => ({ b, left: r2(b.amount - b.spent) })).filter(x => x.b.amount > 0 && x.left > 0);
  const inc = items.filter(i => i.type === 'income' && !i.skip), got = inc.filter(i => i.done).sort(byDate(when)), exp = inc.filter(i => !i.done).sort(byDate(i => i.due));
  const paidSum = sum(paid, i => i.amount), unpaidSum = sum(unpaid, i => i.amount), gotSum = sum(got, i => i.amount), expSum = sum(exp, i => i.amount);
  const pct = S.billsTotal ? Math.min(1, S.billsPaid / S.billsTotal) : 0;

  const sections = [
    { title: 'Income received', total: money(gotSum), empty: 'No income received yet.', rows: [
      ...got.map(i => ({ d: fmtShort(when(i)), n: i.name, a: money(i.amount) })),
      ...exp.map(i => ({ d: fmtShort(i.due), n: i.name + ' (expected)', a: money(i.amount), c: MUTED }))] },
    { title: 'Bills paid', total: money(paidSum), empty: 'No bills paid yet.', rows: paid.map(i => ({ d: fmtShort(when(i)), n: i.name, a: money(i.amount) })) },
    { title: 'Still to pay', total: money(S.billsLeft), empty: 'Everything is paid.', emptyColor: GOOD, rows: [
      ...unpaid.map(i => { const late = i.due < today && ym <= cur; return { d: fmtShort(i.due), n: i.name + (late ? ' (late)' : ''), a: money(i.amount), c: late ? BAD : INK }; }),
      ...room.map(x => ({ d: '', n: x.b.name + ' (left to spend)', a: money(x.left), c: MUTED }))] }
  ];
  if (buds.length) sections.push({ title: 'Variable expenses', total: 'Spent ' + money(S.budgetSpent), empty: '', rows: buds.map(b => {
    const limit = b.amount > 0, over = limit && b.spent > b.amount + 0.005;
    return { d: '', n: b.name, a: limit ? `${money(b.spent)} of ${money(b.amount)}` : `${money(b.spent)} (no limit)`, c: over ? BAD : INK };
  }) });

  // pick a row height that fits one sheet; past that, carry on to a second sheet
  const M = 44, CW = 595.28 - 2 * M, top = 250, bottom = 841.89 - 56;
  const nRows = sum(sections, s => Math.max(1, s.rows.length));
  const RH = Math.max(12.5, Math.min(15.5, (bottom - top - sections.length * 38) / nRows)), FS = RH >= 14 ? 9.5 : 8.5;

  const pdf = pdfNew();
  pdf.page();
  pdf.text(M, 46, "JARROD'S CFO  ·  MONTHLY UPDATE", { size: 8, bold: true, color: ACCENT, spacing: 1 });
  pdf.text(M, 78, fmtMonth(ym), { size: 28, bold: true, color: INK });
  pdf.text(M, 97, ym === cur ? `Position as of ${fmtDate(today)}` : ym < cur ? `Month ended ${fmtDate(lastDay)}` : 'Planned amounts for the month', { size: 10, color: MUTED });
  pdf.hline(M, M + CW, 110, LINE, 0.8);

  const gap = 10, bw = (CW - 2 * gap) / 3, by = 124;
  [['INCOME RECEIVED', money(gotSum), expSum > 0 ? `${money(expSum)} more expected` : 'everything expected is in', INK],
   ['PAID SO FAR', money(S.billsPaid), `bills ${money(paidSum)} + spending ${money(S.budgetSpent)}`, INK],
   ['STILL TO PAY', money(S.billsLeft), `${plural(unpaid.length, 'bill')} ${money(unpaidSum)} + ${money(S.budgetLeft)} to spend`, ACCENT]].forEach(([label, value, sub, c], i) => {
    const x = M + i * (bw + gap);
    pdf.rect(x, by, bw, 62, PANEL);
    pdf.text(x + 12, by + 18, label, { size: 7.5, bold: true, color: MUTED, spacing: 0.8 });
    pdf.text(x + 12, by + 41, value, { size: 17, bold: true, color: c });
    let fs = 7.5; while (fs > 6 && pdfWidth(sub, fs, false) > bw - 24) fs -= 0.25;
    pdf.text(x + 12, by + 55, pdfFit(sub, fs, false, bw - 24), { size: fs, color: MUTED });
  });

  const py = by + 62 + 20;
  pdf.text(M, py, `${S.billsDone} of ${S.bills.length} bills paid`, { size: 8.5, color: MUTED });
  pdf.text(M + CW, py, `${Math.round(pct * 100)}% of the month's outgoings`, { size: 8.5, color: MUTED, align: 'right' });
  pdf.rect(M, py + 7, CW, 5, LINE);
  if (pct > 0) pdf.rect(M, py + 7, CW * pct, 5, pct >= 0.999 ? GOOD : ACCENT);

  let y = top;
  const sheetHead = () => { pdf.page(); y = M + 6; pdf.text(M, y, `${fmtMonth(ym)} (continued)`, { size: 10, bold: true, color: MUTED }); y += 26; };
  for (const sec of sections) {
    if (y + 38 + RH > bottom) sheetHead();
    pdf.text(M, y, sec.title, { size: 11.5, bold: true, color: INK });
    pdf.text(M + CW, y, sec.total, { size: 11.5, bold: true, color: INK, align: 'right' });
    pdf.hline(M, M + CW, y + 7, LINE, 0.8);
    y += 7 + RH;
    if (!sec.rows.length && sec.empty) { pdf.text(M, y - 3, sec.empty, { size: FS, color: sec.emptyColor || MUTED }); y += RH; }
    for (const r of sec.rows) {
      if (y > bottom) { sheetHead(); }
      const c = r.c || INK, aw = pdfWidth(r.a, FS, false), nx = M + (r.d ? 54 : 0);
      if (r.d) pdf.text(M, y - 3, r.d, { size: FS, color: c === INK ? MUTED : c });
      pdf.text(nx, y - 3, pdfFit(r.n, FS, false, CW - (nx - M) - aw - 12), { size: FS, color: c });
      pdf.text(M + CW, y - 3, r.a, { size: FS, color: c, align: 'right' });
      y += RH;
    }
    y += 14;
  }
  const total = pdf.pageCount();
  for (let p = 0; p < total; p++) {
    pdf.select(p);
    pdf.hline(M, M + CW, 841.89 - 44, LINE, 0.8);
    pdf.text(M, 841.89 - 30, `Prepared with Jarrod's CFO on ${fmtDate(today)}`, { size: 8, color: MUTED });
    if (total > 1) pdf.text(M + CW, 841.89 - 30, `Page ${p + 1} of ${total}`, { size: 8, color: MUTED, align: 'right' });
  }
  return pdf.build(`${fmtMonth(ym)} monthly update`);
}

/* build the sheet and hand it to the viewer to save, ready to send on */
async function shareMonthlyUpdate(ym) {
  let bytes;
  try { bytes = monthlyReport(ym); } catch (e) { console.error(e); toast('Could not build the PDF.'); return; }
  await saveFile(`Jarrods-CFO-${ym}-update.pdf`, bytes, 'application/pdf');
}
