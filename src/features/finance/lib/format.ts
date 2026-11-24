export const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const monthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

export const dateBR = (d: string) => d.split('-').reverse().join('/');
export const dateShort = (d: string) => dateBR(d).slice(0, 5);

export const pctChange = (cur: number, prev: number): number | null =>
  prev === 0 ? null : ((cur - prev) / prev) * 100;

// Ordena opções de select pelo nome, em ordem alfabética (ignora acentos e maiúsculas).
export const byName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

const PALETTE = ['#3A3DE8', '#0E9F83', '#E23D4B', '#E8A317', '#8E44EC', '#0F8FD6', '#E0558F', '#5B6B86'];
export const hashColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
export const COLORS = PALETTE.concat(['#14B8A6', '#F97316', '#84CC16', '#06B6D4']);

export const parseMoney = (v: string) => {
  const t = v.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  // Formato pt-BR: ponto é separador de milhar ("5.000" = 5000; "1.234,56" = 1234.56).
  // Sem vírgula, só trata o ponto como decimal quando não forma grupos de milhar ("12.5").
  const thousands = /^-?\d{1,3}(\.\d{3})+$/.test(t);
  const n = t.includes(',') || thousands ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
};
