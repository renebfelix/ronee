import type { Borders, Fill } from 'exceljs';
import { Category, ME_ID, Occurrence, Transaction } from './types';

export interface ExportContext {
  catById: (id: string) => Category | undefined;
  respName: (id: string) => string;
  methodOf: (tx: Transaction) => { name: string };
}

export interface ExportOptions {
  /** Nome do arquivo, sem extensão. */
  fileName: string;
  items: Occurrence[];
}

const BRAND_SOFT = 'FFE8E9FD';
const INK = 'FF1B2236';
const MUTED = 'FF5B6B86';
const LINE = 'FFD9DEE8';
const ZEBRA = 'FFF6F7FB';
const IN = 'FF0E9F83';
const OUT = 'FFE23D4B';
const MONEY = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

const fill = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin' as const, color: { argb: LINE } };
const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

const COLUMNS = [
  { header: 'Data', width: 12 },
  { header: 'Descrição', width: 40 },
  { header: 'Parcela', width: 10 },
  { header: 'Valor total', width: 16 },
];
const LAST_COL = COLUMNS.length;
const VALUE_COL = 4;

/** Data "YYYY-MM-DD" como Date local (meia-noite UTC para o Excel não deslocar o dia). */
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export async function exportOccurrences(ctx: ExportContext, opts: ExportOptions) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Feenanceiro';
  wb.created = new Date();

  // ---------- Aba principal ----------
  const ws = wb.addWorksheet('Lançamentos', { views: [{ showGridLines: false }] });
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  const header = ws.addRow(COLUMNS.map((c) => c.header));
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = fill(INK);
    cell.border = box;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  const headerRow = header.number;

  let inc = 0;
  let exp = 0;
  const perResp = new Map<string, { name: string; total: number; paid: number; pending: number; count: number }>();

  opts.items.forEach((o, i) => {
    // Cobrança: valor a receber de um responsável. Aparece como entrada na linha, mas não soma em
    // entradas/saídas (não é receita nem gasto meu); conta só no resumo por responsável.
    const isCharge = o.tx.type === 'CHARGE';
    const isInc = o.tx.type === 'INCOME' || isCharge;
    if (o.tx.type === 'INCOME') inc += o.amount;
    else if (!isCharge) exp += o.amount;
    const splits = o.splits.length ? o.splits : [{ responsibleId: ME_ID, amount: o.amount, isPaid: false }];

    if (o.tx.type !== 'INCOME') {
      for (const s of splits) {
        const cur = perResp.get(s.responsibleId) ?? { name: ctx.respName(s.responsibleId), total: 0, paid: 0, pending: 0, count: 0 };
        cur.total += s.amount;
        cur.count += 1;
        if (s.responsibleId !== ME_ID) {
          if (s.isPaid) cur.paid += s.amount;
          else cur.pending += s.amount;
        }
        perResp.set(s.responsibleId, cur);
      }
    }

    const row = ws.addRow([
      toDate(o.date),
      o.tx.title,
      o.installment ? `${o.installment.current}/${o.installment.total}` : o.tx.frequency === 'FIXED' ? 'Fixa' : '—',
      isInc ? o.amount : -o.amount,
    ]);
    const bg = i % 2 ? ZEBRA : 'FFFFFFFF';
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > LAST_COL) return;
      cell.fill = fill(bg);
      cell.border = box;
      cell.alignment = { vertical: 'middle', wrapText: col === 2 };
    });
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).font = { bold: true, color: { argb: INK } };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(VALUE_COL).numFmt = MONEY;
    row.getCell(VALUE_COL).font = { bold: true, color: { argb: isInc ? IN : OUT } };
  });

  if (!opts.items.length) {
    const r = ws.addRow(['Nenhum lançamento para exportar.']);
    ws.mergeCells(r.number, 1, r.number, LAST_COL);
    r.getCell(1).font = { italic: true, color: { argb: MUTED } };
  }

  // Totais
  ws.addRow([]);
  const totals: [string, number, string][] = [
    ['Entradas', inc, IN],
    ['Saídas', -exp, OUT],
    ['Resultado', inc - exp, inc - exp >= 0 ? IN : OUT],
  ];
  for (const [label, value, color] of totals) {
    const r = ws.addRow([]);
    ws.mergeCells(r.number, 1, r.number, VALUE_COL - 1);
    r.getCell(1).value = label;
    r.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    r.getCell(1).font = { bold: true, color: { argb: INK } };
    r.getCell(VALUE_COL).value = value;
    r.getCell(VALUE_COL).numFmt = MONEY;
    r.getCell(VALUE_COL).font = { bold: true, size: 12, color: { argb: color } };
    r.getCell(1).fill = fill(BRAND_SOFT);
    r.getCell(VALUE_COL).fill = fill(BRAND_SOFT);
    r.getCell(VALUE_COL).border = box;
  }

  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: LAST_COL } };
  ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRow}:${headerRow}` };

  // ---------- Aba de resumo por responsável ----------
  const rs = wb.addWorksheet('Por responsável', { views: [{ showGridLines: false }] });
  rs.columns = [{ width: 26 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const rh = rs.addRow(['Responsável', 'Lançamentos', 'Total da parte', 'Já pago', 'Pendente']);
  rh.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(INK);
    c.border = box;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  [...perResp.entries()]
    .sort(([a, x], [b, y]) => (a === ME_ID ? -1 : b === ME_ID ? 1 : x.name.localeCompare(y.name, 'pt-BR')))
    .forEach(([id, r], i) => {
      const me = id === ME_ID;
      const row = rs.addRow([r.name, r.count, r.total, me ? null : r.paid, me ? null : r.pending]);
      row.eachCell({ includeEmpty: true }, (c, col) => {
        if (col > 5) return;
        c.fill = fill(i % 2 ? ZEBRA : 'FFFFFFFF');
        c.border = box;
      });
      row.getCell(1).font = { bold: true, color: { argb: INK } };
      row.getCell(2).alignment = { horizontal: 'center' };
      [3, 4, 5].forEach((c) => (row.getCell(c).numFmt = MONEY));
      row.getCell(4).font = { color: { argb: IN } };
      row.getCell(5).font = { bold: !me && r.pending > 0, color: { argb: OUT } };
    });

  // ---------- Download ----------
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.fileName.replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
