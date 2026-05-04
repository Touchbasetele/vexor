import type { CSSProperties } from 'react';
import { escapeHtml } from './escape';
import type { QuoteCompare } from './types';
import { scoreFillColorAt, winnerVendorIndex } from './quoteHelpers';

export function QuoteCompareTable({ qc }: { qc: QuoteCompare }) {
  const vendors = qc.vendors || [];
  const winnerIdx = winnerVendorIndex(qc);

  return (
    <>
      <div className="winner-badge" id="hydrate-winner-badge">
        {qc.winner_line}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="quote-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Criteria</th>
              {vendors.map((v, i) => (
                <th
                  key={i}
                  className={i === winnerIdx ? 'winner-header' : undefined}
                  style={i === winnerIdx ? { borderRadius: 0 } : undefined}
                >
                  {i === winnerIdx ? '★ ' : ''}
                  {escapeHtml(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(qc.criteria || []).map((row, ri) => {
              const [label, a, b, c, kind] = row;
              if (kind === 'scores') {
                const vals = [a, b, c].slice(0, vendors.length);
                return (
                  <tr key={ri}>
                    <td className="label">{escapeHtml(label)}</td>
                    {vals.map((score, i) => {
                      const pct = Math.min(100, Math.max(0, Number(score)));
                      const wc = i === winnerIdx ? 'winner-col' : undefined;
                      const mono: CSSProperties =
                        i !== winnerIdx ? { color: 'var(--color-text-secondary)' } : {};
                      return (
                        <td key={i} className={wc}>
                          <div className="score-bar">
                            <div className="score-bg">
                              <div
                                className="score-fill"
                                style={{ width: `${pct}%`, background: scoreFillColorAt(i) }}
                              />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, ...mono }}>
                              {escapeHtml(score)}/100
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              }
              const cells = [a, b, c].slice(0, vendors.length);
              return (
                <tr key={ri}>
                  <td className="label">{escapeHtml(label)}</td>
                  {cells.map((cell, i) => {
                    const badge =
                      kind === 'winner' && i === winnerIdx ? (
                        <span className="best-badge"> BEST</span>
                      ) : kind === 'tie' && i === winnerIdx ? (
                        ' ✓'
                      ) : (
                        ''
                      );
                    const wc =
                      kind === 'winner' || kind === 'tie'
                        ? i === winnerIdx
                          ? 'winner-col'
                          : undefined
                        : undefined;
                    return (
                      <td key={i} className={wc}>
                        {escapeHtml(cell)}
                        {badge}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
