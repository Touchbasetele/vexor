import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from './api';
import { escapeHtml } from './escape';
import type {
  ActivityRow,
  AnalyticsOverview,
  ApprovalRow,
  Bootstrap,
  ForecastRow,
  InboxMessage,
  InventoryItem,
  InvoiceRow,
  ModalField,
  NavKey,
  PoDocument,
  PoSummary,
  QuoteCompare,
  RfqRow,
  SearchResponse,
  StockRow,
  VendorRow,
} from './types';
import { ProcurementPlaceholderScreens } from './ProcurementPlaceholderScreens';
import {
  AnalyticsScreen,
  ApprovalsScreen,
  DashboardScreen,
  InboxScreen,
  InventoryScreen,
  InvoicesScreen,
  PoScreen,
  QuotesScreen,
  RfxScreen,
  VendorsScreen,
} from './ScreenViews';

function PoToolbar({
  po,
  id,
  onQuickEdit,
  onSubmitApprove,
  onSendSupplier,
}: {
  po: PoDocument;
  id: number;
  onQuickEdit: (id: number) => void;
  onSubmitApprove: (id: number) => void;
  onSendSupplier: (id: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--sans)' }}>
          {escapeHtml(po.header_title || '')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--mono)', marginTop: 3 }}>
          {escapeHtml(po.header_sub || '')} · Status: <strong>{escapeHtml(po.status || '')}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => onQuickEdit(id)}>
          Edit fields
        </button>
        <button type="button" className="btn" onClick={() => onSubmitApprove(id)}>
          Send for approval
        </button>
        <button type="button" className="btn primary" onClick={() => onSendSupplier(id)}>
          Send to supplier →
        </button>
      </div>
    </div>
  );
}

export default function VexorDashboard() {
  const [nav, setNav] = useState<NavKey>('dashboard');
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxFilter, setInboxFilter] = useState('all');
  const [inboxQuery, setInboxQuery] = useState('');
  const [selectedMsgId, setSelectedMsgId] = useState<number | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invFilter, setInvFilter] = useState('all');

  const [qc, setQc] = useState<QuoteCompare | null>(null);

  const [rfqs, setRfqs] = useState<RfqRow[]>([]);
  const [rfxFilter, setRfxFilter] = useState('all');

  const [poSummaries, setPoSummaries] = useState<PoSummary[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [poDetail, setPoDetail] = useState<PoDocument | null>(null);

  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);

  const [topTitle, setTopTitle] = useState('');
  const [topSub, setTopSub] = useState('');

  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDesc, setModalDesc] = useState('');
  const [modalFields, setModalFields] = useState<ModalField[]>([]);
  const [modalConfirm, setModalConfirm] = useState('Confirm');
  const [modalValues, setModalValues] = useState<Record<string, string>>({});
  const [modalAction, setModalAction] = useState<null | ((vals: Record<string, string>) => Promise<void | false>)>(
    null,
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    window.setTimeout(() => setToastShow(false), 3400);
  }, []);

  const reloadBootstrapBadges = useCallback(async () => {
    const b = await fetchJson<Bootstrap>('/api/bootstrap');
    setBoot(b);
  }, []);

  const selectPo = useCallback(
    async (id: number, silentToast = false) => {
      setSelectedPoId(id);
      const po = await fetchJson<PoDocument>(`/api/po-documents/${id}`);
      setPoDetail(po);
      if (!silentToast) showToast(`Opened ${po.po_number}`);
    },
    [showToast],
  );

  const refreshPoSummaries = useCallback(
    async (selectId?: number | null) => {
      const list = await fetchJson<PoSummary[]>('/api/po-documents');
      setPoSummaries(list);
      let next = selectId ?? selectedPoId;
      if (next == null && list.length) next = list[0].id;
      if (next != null) await selectPo(next, true);
    },
    [selectPo, selectedPoId],
  );

  const reloadRfqs = useCallback(async () => {
    const rows = await fetchJson<RfqRow[]>(`/api/rfqs?filter=${encodeURIComponent(rfxFilter)}`);
    setRfqs(rows);
  }, [rfxFilter]);

  const reloadActivities = useCallback(async () => {
    const rows = await fetchJson<ActivityRow[]>('/api/activities');
    setActivities(rows);
  }, []);

  const reloadInventoryViews = useCallback(async () => {
    const inv = await fetchJson<{ forecast: ForecastRow[]; items: InventoryItem[] }>('/api/inventory');
    setForecast(inv.forecast || []);
    setInventoryItems(inv.items || []);
    const st = await fetchJson<StockRow[]>('/api/stock-critical');
    setStockRows(st);
  }, []);

  const initialLoad = useCallback(async () => {
    setLoadError(null);
    try {
      const bootData = await fetchJson<Bootstrap>('/api/bootstrap');
      setBoot(bootData);

      const [acts, stock, inbox, invs, poList, inv, vend, appr, ana] = await Promise.all([
        fetchJson<ActivityRow[]>('/api/activities'),
        fetchJson<StockRow[]>('/api/stock-critical'),
        fetchJson<InboxMessage[]>('/api/inbox'),
        fetchJson<InvoiceRow[]>('/api/invoices'),
        fetchJson<PoSummary[]>('/api/po-documents'),
        fetchJson<{ forecast: ForecastRow[]; items: InventoryItem[] }>('/api/inventory'),
        fetchJson<VendorRow[]>('/api/vendors'),
        fetchJson<ApprovalRow[]>('/api/approvals'),
        fetchJson<AnalyticsOverview>('/api/analytics/overview'),
      ]);

      setActivities(acts);
      setStockRows(stock);
      setInboxMessages(inbox);
      setInvoices(invs);
      setPoSummaries(poList);
      setForecast(inv.forecast || []);
      setInventoryItems(inv.items || []);
      setVendors(vend);
      setApprovals(appr);
      setAnalytics(ana);

      let quote: QuoteCompare | null = null;
      try {
        quote = await fetchJson<QuoteCompare>('/api/quote-compare');
      } catch {
        quote = null;
      }
      setQc(quote);

      const rfqRows = await fetchJson<RfqRow[]>(`/api/rfqs?filter=${encodeURIComponent('all')}`);
      setRfqs(rfqRows);

      if (poList.length) await selectPo(poList[0].id, true);
      else {
        setSelectedPoId(null);
        setPoDetail(null);
      }

      if (inbox.length) setSelectedMsgId(inbox[0].id);
    } catch (e) {
      setLoadError(String((e as Error).message || e));
    }
  }, [selectPo]);

  useEffect(() => {
    initialLoad();
  }, []);

  useEffect(() => {
    reloadRfqs().catch(() => {});
  }, [rfxFilter, reloadRfqs]);

  useEffect(() => {
    const sc = boot?.screens?.[nav];
    if (sc) {
      setTopTitle(sc.title);
      setTopSub(sc.sub);
    }
  }, [boot, nav]);

  const filteredInbox = useMemo(() => {
    let m = [...inboxMessages];
    const q = inboxQuery.trim().toLowerCase();
    if (q) {
      m = m.filter((x) =>
        [x.sender, x.subject, x.preview].some((field) => String(field || '').toLowerCase().includes(q)),
      );
    }
    if (inboxFilter !== 'all') m = m.filter((x) => x.category === inboxFilter);
    return m;
  }, [inboxMessages, inboxQuery, inboxFilter]);

  const openModal = useCallback(
    (opts: {
      title: string;
      desc?: string;
      fields: ModalField[];
      confirm?: string;
      onConfirm: (vals: Record<string, string>) => Promise<void | false>;
    }) => {
      setModalTitle(opts.title);
      setModalDesc(opts.desc || '');
      setModalFields(opts.fields);
      const init: Record<string, string> = {};
      for (const f of opts.fields) init[f.key] = f.value ?? '';
      setModalValues(init);
      setModalConfirm(opts.confirm || 'Confirm');
      setModalAction(() => opts.onConfirm);
      setModalOpen(true);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalAction(null);
  }, []);

  const onModalConfirm = useCallback(async () => {
    if (!modalAction) return;
    try {
      const ret = await modalAction(modalValues);
      if (ret !== false) closeModal();
    } catch (e) {
      showToast(String((e as Error).message || e));
    }
  }, [modalAction, modalValues, closeModal, showToast]);

  const inboxNavigateFromRow = useCallback(
    (msg: InboxMessage) => {
      if (msg.category === 'quote') setNav('quotes');
      else if (msg.category === 'invoice') setNav('invoices');
      else if (msg.category === 'emergency' || msg.category === 'approval') setNav('approvals');
      else if (msg.category === 'rfq') setNav('rfx');
    },
    [],
  );

  const rfxMetaNav = useCallback((meta: string | null) => {
    if (meta === 'quotes') setNav('quotes');
    else if (meta === 'po') setNav('po');
  }, []);

  const runGlobalSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setSearchOpen(false);
        setSearchData(null);
        return;
      }
      try {
        const data = await fetchJson<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
        setSearchData(data);
        setSearchOpen(true);
      } catch (e) {
        showToast(String((e as Error).message || e));
      }
    },
    [showToast],
  );

  useEffect(() => {
    const t = window.setTimeout(() => runGlobalSearch(searchQ), 200);
    return () => window.clearTimeout(t);
  }, [searchQ, runGlobalSearch]);

  const onPoQuickEdit = useCallback(
    (id: number) => {
      openModal({
        title: 'Adjust PO routing',
        desc: 'Shipping line and internal note propagate to approvals.',
        fields: [
          { key: 'shipping', label: 'Shipping / freight', value: '', placeholder: 'e.g. FOB Chicago' },
          { key: 'header_sub', label: 'Internal subtitle', placeholder: '', value: '' },
        ],
        confirm: 'Save PO fields',
        onConfirm: async (vals) => {
          await fetchJson(`/api/po-documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipping: vals.shipping, header_sub: vals.header_sub }),
          });
          showToast('Purchase order amended.');
          await refreshPoSummaries(id);
        },
      });
    },
    [openModal, showToast, refreshPoSummaries],
  );

  const onPoSubmitApprove = useCallback(
    async (id: number) => {
      await fetchJson(`/api/po-documents/${id}/submit-for-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      showToast('Queued for approval.');
      await reloadBootstrapBadges();
      await refreshPoSummaries(id);
    },
    [showToast, reloadBootstrapBadges, refreshPoSummaries],
  );

  const onPoSendSupplier = useCallback(
    (id: number) => {
      openModal({
        title: 'Transmit PO to supplier',
        desc: 'Finalizes outbound pack and marks status as sent.',
        fields: [{ key: 'shipping', label: 'Shipment terms', placeholder: 'Describe routing', value: '' }],
        confirm: 'Send now',
        onConfirm: async (vals) => {
          await fetchJson(`/api/po-documents/${id}/send-to-supplier`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipping: vals.shipping || 'Electronic transmission' }),
          });
          showToast('PO transmitted.');
          await refreshPoSummaries(id);
        },
      });
    },
    [openModal, showToast, refreshPoSummaries],
  );

  const poToolbar =
    poDetail && selectedPoId ? (
      <PoToolbar
        po={poDetail}
        id={selectedPoId}
        onQuickEdit={onPoQuickEdit}
        onSubmitApprove={onPoSubmitApprove}
        onSendSupplier={onPoSendSupplier}
      />
    ) : null;

  const badge = (n: number | undefined) => (n == null ? '—' : String(n));

  if (loadError && !boot) {
    return (
      <div style={{ color: 'var(--cream)', fontFamily: 'var(--mono)', padding: 24, textAlign: 'center' }}>
        <p>Could not load workspace.</p>
        <p className="muted-note">{escapeHtml(loadError)}</p>
        <p className="muted-note" style={{ marginTop: 12 }}>
          Ensure the API is running and reload.
        </p>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="sidebar">
        <div className="sb-logo">
          <div className="sb-brand-lockup">
            <img className="sb-mark" src="/assets/vexor-mark.svg" width={44} height={44} alt="" decoding="async" />
            <div className="sb-brand-text">
              <div className="wordmark">{boot?.tenant?.wordmark ?? '—'}</div>
              <div className="sb-tagline">Procurement intelligence</div>
            </div>
          </div>
          <div className="tenant">{boot?.tenant?.name ?? ''}</div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Workspace</div>
          <button type="button" className={`sb-item${nav === 'dashboard' ? ' active' : ''}`} onClick={() => setNav('dashboard')}>
            <span className="icon">▣</span>Dashboard
          </button>
          <button type="button" className={`sb-item${nav === 'inbox' ? ' active' : ''}`} onClick={() => setNav('inbox')}>
            <span className="icon">✉</span>Inbox<span className="badge">{badge(boot?.badges.inbox)}</span>
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Sourcing</div>
          <button type="button" className={`sb-item${nav === 'rfx' ? ' active' : ''}`} onClick={() => setNav('rfx')}>
            <span className="icon">≡</span>RFX<span className="badge">{badge(boot?.badges.rfx)}</span>
          </button>
          <button type="button" className={`sb-item${nav === 'quotes' ? ' active' : ''}`} onClick={() => setNav('quotes')}>
            <span className="icon">⚖</span>Quote compare
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Orders</div>
          <button
            type="button"
            title="Purchase requisitions (REQ)"
            className={`sb-item${nav === 'requisitions' ? ' active' : ''}`}
            onClick={() => setNav('requisitions')}
          >
            <span className="icon">＋</span>Requisitions
          </button>
          <button type="button" className={`sb-item${nav === 'po' ? ' active' : ''}`} onClick={() => setNav('po')}>
            <span className="icon">◻</span>Purchase orders
          </button>
          <button type="button" className={`sb-item${nav === 'po_transfer' ? ' active' : ''}`} onClick={() => setNav('po_transfer')}>
            <span className="icon">⇄</span>PO transfer
          </button>
          <button type="button" className={`sb-item${nav === 'sales_orders' ? ' active' : ''}`} onClick={() => setNav('sales_orders')}>
            <span className="icon">◇</span>Sales orders
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Receiving</div>
          <button type="button" className={`sb-item${nav === 'receiving' ? ' active' : ''}`} onClick={() => setNav('receiving')}>
            <span className="icon">▤</span>Receiving
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Finance</div>
          <button type="button" className={`sb-item${nav === 'invoices' ? ' active' : ''}`} onClick={() => setNav('invoices')}>
            <span className="icon">≣</span>Invoices<span className="badge">{badge(boot?.badges.invoices)}</span>
          </button>
          <button type="button" className={`sb-item${nav === 'approvals' ? ' active' : ''}`} onClick={() => setNav('approvals')}>
            <span className="icon">✔</span>Approvals<span className="badge">{badge(boot?.badges.approvals)}</span>
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Catalog</div>
          <button type="button" className={`sb-item${nav === 'vendor_items' ? ' active' : ''}`} onClick={() => setNav('vendor_items')}>
            <span className="icon">⊡</span>Vendor items
          </button>
          <button type="button" className={`sb-item${nav === 'catalog_items' ? ' active' : ''}`} onClick={() => setNav('catalog_items')}>
            <span className="icon">☷</span>Catalog items
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Partners</div>
          <button type="button" className={`sb-item${nav === 'vendors' ? ' active' : ''}`} onClick={() => setNav('vendors')}>
            <span className="icon">⊞</span>Vendors
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Operations</div>
          <button type="button" className={`sb-item${nav === 'inventory' ? ' active' : ''}`} onClick={() => setNav('inventory')}>
            <span className="icon">▦</span>Inventory
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Governance</div>
          <button type="button" className={`sb-item${nav === 'contracts' ? ' active' : ''}`} onClick={() => setNav('contracts')}>
            <span className="icon">▭</span>Contracts
          </button>
        </div>

        <div className="sb-section">
          <div className="sb-label">Insights</div>
          <button type="button" className={`sb-item${nav === 'analytics' ? ' active' : ''}`} onClick={() => setNav('analytics')}>
            <span className="icon">↑↓</span>Analytics
          </button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div className="topbar-shell">
            <div className="glob-wrap">
              <div className="search-bar">
                <span className="search-icon">⌕</span>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Search RFQs, inbox, invoices, vendors"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onFocus={() => searchQ.trim() && setSearchOpen(true)}
                />
              </div>
              <div id="search-results" className={searchOpen ? 'open' : ''} role="listbox" aria-label="Global search">
                {searchOpen && searchData && (
                  <>
                    {(
                      [
                        ['RFQs', 'rfqs'],
                        ['Inbox', 'inbox'],
                        ['Invoices', 'invoices'],
                        ['Vendors', 'vendors'],
                      ] as const
                    ).map(([label, key]) => {
                      const rows = searchData[key];
                      if (!rows?.length) return null;
                      return (
                        <div key={label}>
                          <div className="sr-h">{label}</div>
                          {rows.map((r) => (
                            <div
                              key={`${label}-${r.id}`}
                              className="sr-row"
                              role="option"
                              tabIndex={0}
                              onClick={() => {
                                if (label === 'RFQs') setNav('rfx');
                                if (label === 'Inbox') setNav('inbox');
                                if (label === 'Invoices') setNav('invoices');
                                if (label === 'Vendors') setNav('vendors');
                                setSearchOpen(false);
                                reloadRfqs().catch(() => {});
                              }}
                            >
                              {r.title}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {!searchData.rfqs?.length &&
                    !searchData.inbox?.length &&
                    !searchData.invoices?.length &&
                    !searchData.vendors?.length ? (
                      <div style={{ padding: 12, fontSize: 11, color: 'var(--color-text-secondary)' }}>No results.</div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="topbar-titles">
              <div className="topbar-title">{topTitle || '—'}</div>
              <div className="topbar-sub">{topSub}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="topbar-status">
              <div className="pulse" />
              Connected
            </div>
            <button
              type="button"
              className="btn"
              title="Run inbox automation"
              onClick={async () => {
                try {
                  const data = await fetchJson<{ messages: InboxMessage[]; processed: number }>(
                    '/api/automation/process-inbox',
                    { method: 'POST' },
                  );
                  setInboxMessages(data.messages);
                  showToast(`Processed ${data.processed ?? 0} threads.`);
                  await reloadBootstrapBadges();
                } catch (e) {
                  showToast(String((e as Error).message || e));
                }
              }}
            >
              Run inbox automation
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                openModal({
                  title: 'Create sourcing request',
                  desc: 'Publishes a new RFQ to your pipeline.',
                  fields: [{ key: 'title', label: 'Program title', value: '', placeholder: 'Describe parts / scope' }],
                  confirm: 'Create RFQ',
                  onConfirm: async (vals) => {
                    if (!vals.title?.trim()) {
                      showToast('Title required.');
                      return false;
                    }
                    const created = await fetchJson<{ code: string }>('/api/rfqs', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: vals.title.trim() }),
                    });
                    showToast(`Created ${created.code}`);
                    await reloadRfqs();
                    setNav('rfx');
                    await reloadActivities();
                    await reloadBootstrapBadges();
                  },
                })
              }
            >
              + New RFQ
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  const r = await fetchJson<{ id: number; po_number: string }>('/api/po-documents', { method: 'POST' });
                  showToast(`Draft ${r.po_number} created`);
                  await refreshPoSummaries(r.id);
                  setNav('po');
                  await reloadActivities();
                  await reloadBootstrapBadges();
                } catch (e) {
                  showToast(String((e as Error).message || e));
                }
              }}
            >
              + Create PO
            </button>
          </div>
        </div>

        <div
          className="content"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('.glob-wrap')) setSearchOpen(false);
          }}
        >
          <DashboardScreen
            active={nav === 'dashboard'}
            boot={boot}
            activities={activities}
            stockRows={stockRows}
            onNavInventory={() => setNav('inventory')}
          />
          <InboxScreen
            active={nav === 'inbox'}
            inboxQuery={inboxQuery}
            setInboxQuery={setInboxQuery}
            inboxFilter={inboxFilter}
            setInboxFilter={setInboxFilter}
            filteredInbox={filteredInbox}
            selectedMsgId={selectedMsgId}
            setSelectedMsgId={setSelectedMsgId}
            onRowNavigate={inboxNavigateFromRow}
          />
          <RfxScreen active={nav === 'rfx'} rfqs={rfqs} rfxFilter={rfxFilter} setRfxFilter={setRfxFilter} onMetaNav={rfxMetaNav} />
          <QuotesScreen
            active={nav === 'quotes'}
            qc={qc}
            onExportCsv={() => {
              window.location.href = '/api/quote-compare/export.csv';
              showToast('CSV download started.');
            }}
            onRejectRunners={async () => {
              try {
                await fetchJson('/api/quote-compare/reject-losers', { method: 'POST' });
                showToast('Runners-up recorded.');
                await reloadActivities();
              } catch (e) {
                showToast(String((e as Error).message || e));
              }
            }}
            onGeneratePo={() => setNav('po')}
          />
          <PoScreen
            active={nav === 'po'}
            poSummaries={poSummaries}
            selectedPoId={selectedPoId}
            selectPo={(id) => selectPo(id).catch((e) => showToast(String(e)))}
            poDetail={poDetail}
            toolbar={poToolbar}
          />
          <ProcurementPlaceholderScreens nav={nav} />
          <InvoicesScreen
            active={nav === 'invoices'}
            rows={invoices}
            invFilter={invFilter}
            setInvFilter={setInvFilter}
            onMatch={(num) =>
              openModal({
                title: `Match invoice ${num}`,
                desc: 'Associate an open PO to clear three-way-match exceptions.',
                fields: [{ key: 'po_ref', label: 'PO reference', value: '', placeholder: 'PO number' }],
                confirm: 'Record match',
                onConfirm: async (vals) => {
                  await fetchJson(`/api/invoices/${encodeURIComponent(num)}/match`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ po_ref: vals.po_ref?.trim() }),
                  });
                  const next = await fetchJson<InvoiceRow[]>('/api/invoices');
                  setInvoices(next);
                  showToast('Invoice matched.');
                  await reloadActivities();
                  await reloadBootstrapBadges();
                },
              })
            }
          />
          <InventoryScreen
            active={nav === 'inventory'}
            forecast={forecast}
            items={inventoryItems}
            onThresholds={() =>
              openModal({
                title: 'Reorder guardrails',
                desc: 'SKU-level reorder points for alerting and stock rows.',
                fields: [
                  { key: 'sku', label: 'SKU', value: '', placeholder: 'SKU' },
                  { key: 'reorder_at', label: 'Reorder at qty', placeholder: 'e.g. 20', value: '20' },
                  { key: 'in_stock', label: '(Optional) true-up on-hand', placeholder: '', value: '' },
                ],
                confirm: 'Apply thresholds',
                onConfirm: async (vals) => {
                  if (!vals.sku?.trim()) {
                    showToast('SKU required.');
                    return false;
                  }
                  const body: { reorder_at: number; in_stock?: number } = { reorder_at: +vals.reorder_at };
                  if (vals.in_stock?.trim()) body.in_stock = +vals.in_stock;
                  await fetchJson(`/api/inventory/${encodeURIComponent(vals.sku.trim())}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  await reloadInventoryViews();
                  showToast(`Rules applied to ${vals.sku.trim()}.`);
                  await reloadActivities();
                },
              })
            }
            onEmergencyRfq={async () => {
              try {
                await fetchJson('/api/rfqs/emergency-stock', { method: 'POST' });
                showToast('Emergency RFQ queued.');
                await reloadRfqs();
                setNav('rfx');
                await reloadActivities();
                await reloadBootstrapBadges();
              } catch (e) {
                showToast(String((e as Error).message || e));
              }
            }}
            onMiniRfq={async (sku) => {
              try {
                await fetchJson('/api/rfqs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: `Restock · ${sku}` }),
                });
                showToast(`RFQ opened for ${sku}`);
                await reloadRfqs();
                await reloadActivities();
                await reloadBootstrapBadges();
              } catch (e) {
                showToast(String((e as Error).message || e));
              }
            }}
            onRowDblSku={(sku) =>
              openModal({
                title: 'Reorder guardrails',
                desc: 'SKU-level reorder points.',
                fields: [
                  { key: 'sku', label: 'SKU', value: sku, placeholder: 'SKU' },
                  { key: 'reorder_at', label: 'Reorder at qty', placeholder: 'e.g. 20', value: '20' },
                  { key: 'in_stock', label: '(Optional) true-up on-hand', placeholder: '', value: '' },
                ],
                confirm: 'Apply thresholds',
                onConfirm: async (vals) => {
                  if (!vals.sku?.trim()) {
                    showToast('SKU required.');
                    return false;
                  }
                  const body: { reorder_at: number; in_stock?: number } = { reorder_at: +vals.reorder_at };
                  if (vals.in_stock?.trim()) body.in_stock = +vals.in_stock;
                  await fetchJson(`/api/inventory/${encodeURIComponent(vals.sku.trim())}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                  });
                  await reloadInventoryViews();
                  showToast(`Rules applied to ${vals.sku.trim()}.`);
                },
              })
            }
          />
          <ApprovalsScreen
            active={nav === 'approvals'}
            rows={approvals}
            onDecision={async (id, action) => {
              await fetchJson(`/api/approvals/${id}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
              });
              showToast(action === 'approve' ? 'Approved.' : 'Rejected.');
              const next = await fetchJson<ApprovalRow[]>('/api/approvals');
              setApprovals(next);
              await reloadBootstrapBadges();
              await refreshPoSummaries(selectedPoId);
              await reloadActivities();
              const ana = await fetchJson<AnalyticsOverview>('/api/analytics/overview');
              setAnalytics(ana);
            }}
          />
          <VendorsScreen
            active={nav === 'vendors'}
            vendors={vendors}
            onAdd={() =>
              openModal({
                title: 'Add vendor',
                desc: 'Vendor codes are used for RFQ routing.',
                fields: [
                  { key: 'code', label: 'Vendor code', placeholder: 'e.g. ACME01' },
                  { key: 'name', label: 'Legal name' },
                  { key: 'category', label: 'Category', value: '', placeholder: 'Category' },
                  { key: 'contact_email', label: 'PO email inbox' },
                ],
                confirm: 'Save vendor',
                onConfirm: async (vals) => {
                  await fetchJson('/api/vendors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(vals),
                  });
                  const v = await fetchJson<VendorRow[]>('/api/vendors');
                  setVendors(v);
                  showToast('Vendor saved.');
                  await reloadActivities();
                  await reloadBootstrapBadges();
                },
              })
            }
            onEdit={(v) =>
              openModal({
                title: `Edit · ${v.name}`,
                fields: [
                  { key: 'notes', label: 'Internal notes', value: v.notes || '', placeholder: '', large: true },
                  { key: 'spend_ytd', label: 'Rolling spend headline', value: v.spend_ytd || '' },
                ],
                confirm: 'Update profile',
                onConfirm: async (vals) => {
                  await fetchJson(`/api/vendors/${v.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: vals.notes, spend_ytd: vals.spend_ytd }),
                  });
                  const list = await fetchJson<VendorRow[]>('/api/vendors');
                  setVendors(list);
                  showToast('Vendor updated.');
                },
              })
            }
            onDeactivate={async (id) => {
              if (!window.confirm('Deactivate this vendor?')) return;
              await fetchJson(`/api/vendors/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
              const list = await fetchJson<VendorRow[]>('/api/vendors');
              setVendors(list);
              showToast('Vendor deactivated.');
              await reloadBootstrapBadges();
            }}
          />
          <AnalyticsScreen active={nav === 'analytics'} data={analytics} />
        </div>
      </div>

      <div
        id="modal-overlay"
        className={`vex-modal-overlay${modalOpen ? ' open' : ''}`}
        aria-hidden={!modalOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div id="modal-pane" role="dialog" aria-labelledby="modal-title">
          <div id="modal-title">{modalTitle}</div>
          <div id="modal-desc" className="muted-note">
            {modalDesc}
          </div>
          <div id="modal-fields">
            {modalFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`mf_${f.key}`}>{f.label}</label>
                {f.large ? (
                  <textarea
                    id={`mf_${f.key}`}
                    value={modalValues[f.key] ?? ''}
                    onChange={(e) => setModalValues((m) => ({ ...m, [f.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={`mf_${f.key}`}
                    value={modalValues[f.key] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setModalValues((m) => ({ ...m, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={() => onModalConfirm()}>
              {modalConfirm}
            </button>
          </div>
        </div>
      </div>

      <div id="automation-toast" className={toastShow ? 'show' : ''} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </div>
  );
}
