import type { QuoteCompare } from './types';

export function winnerVendorIndex(qc: QuoteCompare): number {
  const n = qc.vendors?.length ?? 0;
  if (n <= 0) return 0;
  for (const row of qc.criteria || []) {
    const kind = row[4];
    if (kind !== 'winner' && kind !== 'tie') continue;
    const cells = [row[1], row[2], row[3]];
    for (let i = 0; i < Math.min(n, cells.length); i++) {
      if (String(cells[i] || '').includes('BEST')) return i;
    }
  }
  return 0;
}

const SCORE_FILL_COLORS = ['var(--color-text-tertiary)', 'var(--brand)', 'var(--accent)'];

export function scoreFillColorAt(i: number): string {
  return SCORE_FILL_COLORS[i % SCORE_FILL_COLORS.length];
}
