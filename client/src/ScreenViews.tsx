import type { CSSProperties, ReactNode } from 'react';
import { escapeHtml } from './escape';
import { tagLabel } from './labels';
import { sanitizeInlineHtml } from './sanitize';
import { QuoteCompareTable } from './QuoteCompareTable';
import { PoDocumentView } from './PoDocumentView';
import type {
  ActivityRow,
  AnalyticsOverview,
  ApprovalRow,
  Bootstrap,
  ForecastRow,
  InboxMessage,
  InventoryItem,
  InvoiceRow,
  PoDocument,
  PoSummary,
  QuoteCompare,
  RfqRow,
  StockRow,
  VendorRow,
} from './types';
import { winnerVendorIndex } from './quoteHelpers';

export function PlaceholderModuleScreen({
  active,
  screenId,
  title,
  description,
  bullets,
}: {
  active: boolean;
  screenId: string;
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id={screenId}>
      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="panel-title">{title}</div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
            marginBottom: bullets?.length ? 12 : 0,
          }}
        >
          {description}
        </p>
        {bullets?.length ? (
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {bullets.map((x) => (
              <li key={x} style={{ marginBottom: 8 }}>
                {x}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="muted-note" style={{ marginTop: 14 }}>
          Connect this module&apos;s API to load live data. No placeholder rows are shown in production.
        </p>
      </div>
    </div>
  );
}

function PipelineSteps({ pipeline }: { pipeline: RfqRow['pipeline'] }) {
  const parts: ReactNode[] = [];
  pipeline.forEach((step, i) => {
    const st = step.state === 'done' ? 'done' : step.state === 'active' ? 'active' : '';
    parts.push(
      <div key={`s-${i}`} className={`step ${st}`}>
        <div className="step-dot" />
        {escapeHtml(step.label)}
      </div>,
    );
    if (i < pipeline.length - 1)
      parts.push(
        <div key={`a-${i}`} className="step-arrow">
          →
        </div>,
      );
  });
  return <div className="pipeline-steps">{parts}</div>;
}

function RfqCardView({
  r,
  onMetaNav,
}: {
  r: RfqRow;
  onMetaNav: (nav: string | null) => void;
}) {
  const codeStyle: CSSProperties | undefined = r.code.startsWith('EMG') ? { color: 'var(--danger)' } : undefined;
  let badge: ReactNode = null;
  if (r.badge_kind === 'pending')
    badge = <span className="pending-badge">{escapeHtml(r.badge_text)}</span>;
  else if (r.badge_kind === 'emg')
    badge = <span className="emg-badge">{escapeHtml(r.badge_text)}</span>;
  else if (r.badge_kind === 'success')
    badge = (
      <span style={{ fontSize: 10, color: 'var(--success)', fontFamily: 'var(--mono)' }}>
        {escapeHtml(r.badge_text)}
      </span>
    );
  else badge = <span className="pending-badge">{escapeHtml(r.badge_text)}</span>;

  const btn =
    r.meta_button_label && r.meta_nav ? (
      <button type="button" className="mini-btn" onClick={() => onMetaNav(r.meta_nav)}>
        {escapeHtml(r.meta_button_label)}
      </button>
    ) : null;

  return (
    <div className="rfq-card">
      <div className="rfq-id" style={codeStyle}>
        {escapeHtml(r.code)}
      </div>
      <div className="rfq-name">{escapeHtml(r.title)}</div>
      <PipelineSteps pipeline={r.pipeline} />
      <div className="rfq-meta">
        {badge}
        {btn}
      </div>
    </div>
  );
}

function invoiceTag(status: string) {
  if (status === 'matched') return <span className="tag matched">Matched ✓</span>;
  if (status === 'overdue') return <span className="tag urgent">Overdue</span>;
  if (status === 'unmatched') return <span className="tag invoice">Unmatched</span>;
  return <span className="tag internal">{escapeHtml(status)}</span>;
}

export function DashboardScreen({
  active,
  boot,
  activities,
  stockRows,
  onNavInventory,
}: {
  active: boolean;
  boot: Bootstrap | null;
  activities: ActivityRow[];
  stockRows: StockRow[];
  onNavInventory: () => void;
}) {
  const stats = boot?.stats;
  const statBlocks = stats
    ? [
        ['Open RFQs', stats.open_rfqs, stats.open_rfqs_sub, 'up'],
        ['Pending POs', stats.pending_pos, stats.pending_pos_sub, 'warn'],
        ['Invoices Due', stats.invoices_due, stats.invoices_sub, 'down'],
        ['Month Spend', stats.month_spend, stats.month_spend_sub, 'warn'],
      ]
    : [];

  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-dashboard">
      <div className="stat-grid">
        {statBlocks.map(([label, val, sub, cls]) => (
          <div key={String(label)} className="stat-card">
            <div className="stat-label">{escapeHtml(label)}</div>
            <div className="stat-val">{escapeHtml(String(val ?? ''))}</div>
            <div className={`stat-sub ${cls}`}>{escapeHtml(String(sub ?? ''))}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Recent activity</div>
          <div>
            {activities.length === 0 ? (
              <p className="muted-note" style={{ padding: '8px 0' }}>
                No activity yet.
              </p>
            ) : (
              activities.map((r, i) => (
                <div key={i} className="activity-item">
                  <span className={`tag ${r.tag_class}`}>{escapeHtml(r.tag_label)}</span>{' '}
                  <span
                    className="desc"
                    dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(r.description_html) }}
                  />
                  <div className="time">{escapeHtml(r.time_label)}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Critical stock</div>
          <div className="critical-stock">
            {stockRows.length === 0 ? (
              <p className="muted-note">No stock alerts.</p>
            ) : (
              stockRows.map((r, i) => {
                const cc = r.count_class ? ` ${r.count_class}` : '';
                const countStyle: CSSProperties =
                  !r.count_class && r.fill_color === 'var(--brand)' ? { color: 'var(--success)' } : {};
                return (
                  <div key={i} className="stock-row">
                    <div className="sku">{escapeHtml(r.sku)}</div>
                    <div className="stock-bar">
                      <div
                        className="stock-fill"
                        style={{ width: `${Number(r.fill_pct)}%`, background: r.fill_color }}
                      />
                    </div>
                    <div className="name">{escapeHtml(r.name)}</div>
                    <div className={`count${cc}`} style={countStyle}>
                      {escapeHtml(String(r.count))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '0.5px solid var(--color-border-tertiary)',
            }}
          >
            <button type="button" className="action-btn" onClick={onNavInventory}>
              <div className="dot" style={{ background: 'var(--danger)' }} />
              View inventory →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxScreen({
  active,
  inboxQuery,
  setInboxQuery,
  inboxFilter,
  setInboxFilter,
  filteredInbox,
  selectedMsgId,
  setSelectedMsgId,
  onRowNavigate,
}: {
  active: boolean;
  inboxQuery: string;
  setInboxQuery: (q: string) => void;
  inboxFilter: string;
  setInboxFilter: (f: string) => void;
  filteredInbox: InboxMessage[];
  selectedMsgId: number | null;
  setSelectedMsgId: (id: number) => void;
  onRowNavigate: (msg: InboxMessage) => void;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-inbox">
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search messages"
          value={inboxQuery}
          onChange={(e) => setInboxQuery(e.target.value)}
        />
      </div>
      <div className="inbox-filter">
        {(['all', 'quote', 'invoice', 'rfq', 'emergency'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn${inboxFilter === f ? ' active' : ''}`}
            onClick={() => setInboxFilter(f)}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div
        className="inbox-list"
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        {filteredInbox.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--color-text-secondary)', fontSize: 12 }}>No messages.</div>
        ) : (
          filteredInbox.map((msg) => {
            const sel = msg.id === selectedMsgId;
            return (
              <button
                key={msg.id}
                type="button"
                className={`inbox-row${sel ? ' selected' : ''}`}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  background: 'transparent',
                  textAlign: 'left',
                }}
                onClick={() => {
                  setSelectedMsgId(msg.id);
                  onRowNavigate(msg);
                }}
              >
                <div
                  className="inbox-avatar"
                  style={{ background: msg.avatar_bg, color: msg.avatar_color }}
                >
                  {escapeHtml(msg.avatar_initials)}
                </div>
                <div className="inbox-body">
                  <div className="inbox-sender">{escapeHtml(msg.sender)}</div>
                  <div className="inbox-subject">{escapeHtml(msg.subject)}</div>
                  <div className="inbox-preview">{escapeHtml(msg.preview)}</div>
                </div>
                <div className="inbox-meta">
                  <div className="inbox-time">{escapeHtml(msg.time_label)}</div>
                  <div className="inbox-tags">
                    {(msg.tags || []).map((t) => (
                      <span key={t} className={`tag ${t}`}>
                        {escapeHtml(tagLabel(t))}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function RfxScreen({
  active,
  rfqs,
  rfxFilter,
  setRfxFilter,
  onMetaNav,
}: {
  active: boolean;
  rfqs: RfqRow[];
  rfxFilter: string;
  setRfxFilter: (f: string) => void;
  onMetaNav: (nav: string | null) => void;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-rfx">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'in_progress', 'awaiting_quotes', 'pending_po', 'emergency'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn${rfxFilter === f ? ' active' : ''}`}
            onClick={() => setRfxFilter(f)}
          >
            {f === 'in_progress'
              ? 'In progress'
              : f === 'awaiting_quotes'
                ? 'Awaiting quotes'
                : f === 'pending_po'
                  ? 'Pending PO'
                  : f === 'emergency'
                    ? 'Emergency'
                    : 'All'}
          </button>
        ))}
      </div>
      <div className="rfq-pipeline">
        {rfqs.length === 0 ? (
          <p className="muted-note">No RFQs.</p>
        ) : (
          rfqs.map((r) => <RfqCardView key={r.code} r={r} onMetaNav={onMetaNav} />)
        )}
      </div>
    </div>
  );
}

export function QuotesScreen({
  active,
  qc,
  onExportCsv,
  onRejectRunners,
  onGeneratePo,
}: {
  active: boolean;
  qc: QuoteCompare | null;
  onExportCsv: () => void;
  onRejectRunners: () => void;
  onGeneratePo: () => void;
}) {
  if (!qc || !qc.vendors?.length) {
    return (
      <div className={`screen${active ? ' active' : ''}`} id="screen-quotes">
        <p className="muted-note">No quote comparison loaded. Configure quote_compare in the database.</p>
      </div>
    );
  }
  const winnerIdx = winnerVendorIndex(qc);
  const winnerName = qc.vendors[winnerIdx] || qc.vendors[0];

  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-quotes">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {escapeHtml(qc.rfq_code)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--mono)',
              marginTop: 2,
            }}
          >
            {escapeHtml(qc.subtitle)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onExportCsv}>
            Export CSV
          </button>
          <button type="button" className="btn primary" onClick={onGeneratePo}>
            Generate PO — winner →
          </button>
        </div>
      </div>
      <QuoteCompareTable qc={qc} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn primary" onClick={onGeneratePo}>
          Generate PO — {winnerName} →
        </button>
        <button type="button" className="btn" onClick={onRejectRunners}>
          Reject runners-up
        </button>
      </div>
    </div>
  );
}

export function PoScreen({
  active,
  poSummaries,
  selectedPoId,
  selectPo,
  poDetail,
  toolbar,
}: {
  active: boolean;
  poSummaries: PoSummary[];
  selectedPoId: number | null;
  selectPo: (id: number) => void;
  poDetail: PoDocument | null;
  toolbar: ReactNode;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-po">
      <div style={{ marginBottom: 10 }}>{toolbar}</div>
      <div className="po-split">
        <aside className="po-list-panel">
          <div>
            {poSummaries.length === 0 ? (
              <p className="muted-note" style={{ padding: 12 }}>
                No purchase orders.
              </p>
            ) : (
              poSummaries.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`po-row${s.id === selectedPoId ? ' active' : ''}`}
                  onClick={() => selectPo(s.id)}
                >
                  <span className="num">{escapeHtml(s.po_number)}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--mono)' }}>
                    {escapeHtml(s.status)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {escapeHtml(s.vendor_name || '—')} · {escapeHtml(s.total)}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--color-text-tertiary)' }}>
                    {escapeHtml(s.header_sub || '')}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
        <div>{poDetail ? <PoDocumentView po={poDetail} /> : <p className="muted-note">Select a PO.</p>}</div>
      </div>
    </div>
  );
}

export function InvoicesScreen({
  active,
  rows,
  invFilter,
  setInvFilter,
  onMatch,
}: {
  active: boolean;
  rows: InvoiceRow[];
  invFilter: string;
  setInvFilter: (f: string) => void;
  onMatch: (num: string) => void;
}) {
  const filtered =
    invFilter === 'unmatched'
      ? rows.filter((i) => i.status === 'unmatched')
      : invFilter === 'overdue'
        ? rows.filter((i) => i.status === 'overdue')
        : rows;

  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-invoices">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Invoices</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'unmatched', 'overdue'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-btn${invFilter === f ? ' active' : ''}`}
              onClick={() => setInvFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table className="inv-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Supplier</th>
              <th>PO Ref</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16 }}>
                  <span className="muted-note">No invoices.</span>
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.number}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--brand)' }}>
                    {escapeHtml(inv.number)}
                  </td>
                  <td>{escapeHtml(inv.supplier)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                    {escapeHtml(inv.po_ref)}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{escapeHtml(inv.amount)}</td>
                  <td
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: inv.status === 'overdue' ? 'var(--danger)' : undefined,
                    }}
                  >
                    {escapeHtml(inv.due)}
                  </td>
                  <td>{invoiceTag(inv.status)}</td>
                  <td>
                    {inv.status === 'unmatched' ? (
                      <button type="button" className="mini-btn" onClick={() => onMatch(inv.number)}>
                        Match
                      </button>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--mono)' }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryScreen({
  active,
  forecast,
  items,
  onThresholds,
  onEmergencyRfq,
  onMiniRfq,
  onRowDblSku,
}: {
  active: boolean;
  forecast: ForecastRow[];
  items: InventoryItem[];
  onThresholds: () => void;
  onEmergencyRfq: () => void;
  onMiniRfq: (sku: string) => void;
  onRowDblSku: (sku: string) => void;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-inventory">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Inventory</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--mono)',
              marginTop: 1,
            }}
          >
            Reorder signals from current stock levels
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onThresholds}>
            Set thresholds
          </button>
          <button type="button" className="btn primary" onClick={onEmergencyRfq}>
            Auto-reorder critical
          </button>
        </div>
      </div>
      <div className="inv-grid">
        <div className="panel">
          <div className="panel-title">Reorder forecast</div>
          <div>
            {forecast.length === 0 ? (
              <p className="muted-note">No forecast rows.</p>
            ) : (
              forecast.map((r, i) => (
                <div key={i} className="forecast-item">
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--sans)',
                      }}
                    >
                      {escapeHtml(r.title)}
                    </div>
                    <div className="forecast-sku">{escapeHtml(r.sku_line)}</div>
                  </div>
                  <div className={`forecast-days ${r.days_class}`}>{escapeHtml(r.days_label)}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Quick actions</div>
          <button type="button" className="action-btn" onClick={onEmergencyRfq}>
            <div className="dot" style={{ background: 'var(--danger)' }} />
            <strong style={{ fontSize: 11 }}>Emergency restock RFQ</strong>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>Critical SKU</span>
          </button>
        </div>
      </div>
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table className="inv-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>In Stock</th>
              <th>Reorder At</th>
              <th>Level</th>
              <th>Forecast</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16 }}>
                  <span className="muted-note">No inventory rows.</span>
                </td>
              </tr>
            ) : (
              items.map((it) => {
                let skuColor = 'var(--success)';
                if (it.forecast_class === 'crit') skuColor = 'var(--danger)';
                else if (it.forecast_class === 'warn') skuColor = 'var(--accent)';
                const btnStyle: CSSProperties =
                  it.action_style === 'danger'
                    ? { background: 'var(--danger-light)', color: 'var(--danger)', borderColor: 'var(--danger)' }
                    : {};
                return (
                  <tr key={it.sku}>
                    <td
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, color: skuColor }}
                      data-inv-sku={it.sku}
                      onDoubleClick={() => onRowDblSku(it.sku)}
                    >
                      {escapeHtml(it.sku)}
                    </td>
                    <td style={{ fontSize: 12 }}>{escapeHtml(it.name)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: skuColor }}>
                      {escapeHtml(String(it.in_stock))}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{escapeHtml(String(it.reorder_at))}</td>
                    <td>
                      <div className="inv-level">
                        <div
                          className="inv-fill"
                          style={{ width: `${Number(it.level_pct)}%`, background: it.level_color }}
                        />
                      </div>
                    </td>
                    <td>
                      <span className={`forecast-days ${it.forecast_class}`} style={{ fontSize: 11 }}>
                        {escapeHtml(it.forecast)}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="mini-btn" style={btnStyle} onClick={() => onMiniRfq(it.sku)}>
                        {escapeHtml(it.action_label)}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ApprovalsScreen({
  active,
  rows,
  onDecision,
}: {
  active: boolean;
  rows: ApprovalRow[];
  onDecision: (id: number, action: 'approve' | 'reject') => void;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-approvals">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Approval queue</div>
          <p className="muted-note">Approve or reject spend requests linked to purchase orders.</p>
        </div>
      </div>
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '1px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table className="inv-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Reference</th>
              <th>Subject</th>
              <th>Amount</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16 }}>
                  <span className="muted-note">No pending approvals.</span>
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id}>
                  <td>{escapeHtml(a.document_type)}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(a.reference)}</td>
                  <td>{escapeHtml(a.title)}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(a.amount)}</td>
                  <td>{escapeHtml(a.requester)}</td>
                  <td>
                    {a.status === 'pending' ? <span className="pending-badge">pending</span> : escapeHtml(a.status)}
                  </td>
                  <td>
                    {a.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="mini-btn"
                          style={{ background: 'var(--success-light)', color: 'var(--success)' }}
                          onClick={() => onDecision(a.id, 'approve')}
                        >
                          Approve
                        </button>{' '}
                        <button type="button" className="mini-btn" onClick={() => onDecision(a.id, 'reject')}>
                          Reject
                        </button>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VendorsScreen({
  active,
  vendors,
  onAdd,
  onEdit,
  onDeactivate,
}: {
  active: boolean;
  vendors: VendorRow[];
  onAdd: () => void;
  onEdit: (v: VendorRow) => void;
  onDeactivate: (id: number) => void;
}) {
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-vendors">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>Vendors</div>
        <button type="button" className="btn primary" onClick={onAdd}>
          + Add vendor
        </button>
      </div>
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '1px solid var(--color-border-tertiary)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table className="inv-table vendor-row" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Rating</th>
              <th>YTD Spend</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 16 }}>
                  <span className="muted-note">No vendors.</span>
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, color: 'var(--indigo)' }}>{escapeHtml(v.code)}</td>
                  <td>{escapeHtml(v.name)}</td>
                  <td>{escapeHtml(v.category)}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(Number(v.rating).toFixed(1))}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(v.spend_ytd)}</td>
                  <td>
                    <button type="button" className="mini-btn" onClick={() => onEdit(v)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      style={{ marginLeft: 4, color: 'var(--danger)' }}
                      onClick={() => onDeactivate(v.id)}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsScreen({ active, data }: { active: boolean; data: AnalyticsOverview | null }) {
  if (!data) {
    return (
      <div className={`screen${active ? ' active' : ''}`} id="screen-analytics">
        <p className="muted-note">Loading analytics…</p>
      </div>
    );
  }
  return (
    <div className={`screen${active ? ' active' : ''}`} id="screen-analytics">
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Spend intelligence</div>
      <div className="analytics-grid">
        {(data.kpis || []).map((x, i) => (
          <div key={i} className="kpi">
            <div className="lbl">{escapeHtml(x.label)}</div>
            <div className="big">{escapeHtml(x.value)}</div>
            <div className="sub">{escapeHtml(x.sub)}</div>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">RFQ funnel</div>
          <div>
            {(data.funnel || []).length === 0 ? (
              <p className="muted-note">No funnel data.</p>
            ) : (
              data.funnel.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px',
                    borderBottom: '1px solid rgba(13,10,30,0.08)',
                  }}
                >
                  <span>{escapeHtml(f.stage)}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{escapeHtml(String(f.count))}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Vendor spend</div>
          <table className="inv-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>YTD Spend</th>
                <th>★</th>
              </tr>
            </thead>
            <tbody>
              {(data.vendorSpend || []).length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12 }}>
                    <span className="muted-note">No vendors.</span>
                  </td>
                </tr>
              ) : (
                data.vendorSpend.map((v, i) => (
                  <tr key={i}>
                    <td>
                      {escapeHtml(v.name)}{' '}
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>({escapeHtml(v.code)})</span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(v.spend_ytd)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(String(Number(v.rating || 0).toFixed(1)))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
