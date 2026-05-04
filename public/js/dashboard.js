/* Vexor ERP cockpit — hydrated views + workflows */

const state = {
  inbox: [],
  inboxFilter: 'all',
  inboxQuery: '',
  rfxFilter: 'all',
  invFilter: 'all',
  allInvoices: [],
  rfqsRaw: [],
  qc: null,
  poSummaries: [],
  selectedPoId: null,
  vendors: [],
  approvals: [],
  analytics: null,
  requisitions: [],
  selectedReqId: null,
};

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function toast(msg) {
  const el = document.getElementById('automation-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3400);
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`);
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error('Invalid JSON');
  }
}

function mergeScreens(apiScreens) {
  const base = { ...(window.PROCUREOS_SCREENS || {}) };
  if (!apiScreens) return base;
  for (const [k, v] of Object.entries(apiScreens))
    base[k] = { ...base[k], ...v };
  return base;
}

function tagLabel(t) {
  const map = {
    quote: 'Quote',
    urgent: 'Urgent',
    extracted: 'AI ✓',
    invoice: 'Invoice',
    matched: 'PO Matched ✓',
    emergency: 'Emergency',
    internal: 'Internal',
    approval: 'Approval',
  };
  return map[t] || t;
}

/** --- Rendering --- */

function filteredInbox() {
  let m = [...state.inbox];
  const q = state.inboxQuery.trim().toLowerCase();
  if (q) {
    m = m.filter((x) =>
      [x.sender, x.subject, x.preview].some((field) =>
        String(field || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }
  if (state.inboxFilter !== 'all') {
    const f = state.inboxFilter;
    m = m.filter((x) => x.category === f);
  }
  return m;
}

function renderInbox() {
  const el = document.getElementById('hydrate-inbox');
  if (!el) return;
  const msgs = filteredInbox();
  el.innerHTML = msgs.length
    ? msgs
        .map((msg, i) => {
          const tags = (msg.tags || [])
            .map((t) => `<span class="tag ${escapeHtml(t)}">${escapeHtml(tagLabel(t))}</span>`)
            .join('');
          const sel = i === 0 ? ' selected' : '';
          return `<button type="button" class="inbox-row${sel}" data-msg-id="${msg.id}">
          <div class="inbox-avatar" style="background:${escapeHtml(msg.avatar_bg)};color:${escapeHtml(
            msg.avatar_color,
          )}">${escapeHtml(msg.avatar_initials)}</div>
          <div class="inbox-body">
            <div class="inbox-sender">${escapeHtml(msg.sender)}</div>
            <div class="inbox-subject">${escapeHtml(msg.subject)}</div>
            <div class="inbox-preview">${escapeHtml(msg.preview)}</div>
          </div>
          <div class="inbox-meta">
            <div class="inbox-time">${escapeHtml(msg.time_label)}</div>
            <div class="inbox-tags">${tags}</div>
          </div>
        </button>`;
        })
        .join('')
    : `<div style="padding:20px;color:var(--color-text-secondary);font-size:12px;">No messages match this filter.</div>`;

  document.querySelectorAll('[data-msg-id]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.inbox-row').forEach((r) => r.classList.remove('selected'));
      btn.classList.add('selected');
      const mid = +btn.getAttribute('data-msg-id');
      const row = state.inbox.find((m) => m.id === mid);
      if (!row) return;
      if (['quote'].includes(row.category)) navSafe('quotes', document.getElementById('sb-quotes'));
      else if (row.category === 'invoice') navSafe('invoices', document.getElementById('sb-invoices'));
      else if (row.category === 'emergency' || row.category === 'approval')
        navSafe('approvals', document.getElementById('sb-approvals'));
      else if (row.category === 'rfq') navSafe('rfx', document.getElementById('sb-rfx'));
    }),
  );

  inboxRowAsButtonAccessibility();
}

function inboxRowAsButtonAccessibility() {
  document.querySelectorAll('#hydrate-inbox .inbox-row').forEach((b) => {
    b.style.width = '100%';
    b.style.border = 'none';
    b.style.borderRadius = '0';
    b.style.cursor = 'pointer';
    b.style.background = 'transparent';
  });
}

function renderStats(stats) {
  const el = document.getElementById('hydrate-stats');
  if (!el || !stats) return;
  el.innerHTML = [
    ['Open RFQs', stats.open_rfqs, stats.open_rfqs_sub, 'up'],
    ['Pending POs', stats.pending_pos, stats.pending_pos_sub, 'warn'],
    ['Invoices Due', stats.invoices_due, stats.invoices_sub, 'down'],
    ['Month Spend', stats.month_spend, stats.month_spend_sub, 'warn'],
  ]
    .map(
      ([label, val, sub, subClass]) =>
        `<div class="stat-card"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-val">${escapeHtml(
          String(val),
        )}</div><div class="stat-sub ${escapeHtml(subClass)}">${escapeHtml(sub)}</div></div>`,
    )
    .join('');
}

function renderActivities(rows) {
  const el = document.getElementById('hydrate-activity');
  if (!el) return;
  el.innerHTML = rows
    .map(
      (r) => `<div class="activity-item">
      <span class="tag ${escapeHtml(r.tag_class)}">${escapeHtml(r.tag_label)}</span>
      <span class="desc">${r.description_html}</span>
      <div class="time">${escapeHtml(r.time_label)}</div>
    </div>`,
    )
    .join('');
}

function renderStock(rows) {
  const el = document.getElementById('hydrate-stock');
  if (!el) return;
  el.innerHTML = rows
    .map((r) => {
      const cc = r.count_class ? ` ${escapeHtml(r.count_class)}` : '';
      const countStyle = !r.count_class && r.fill_color === 'var(--brand)' ? ` style="color:var(--success)"` : '';
      return `<div class="stock-row">
        <div class="sku">${escapeHtml(r.sku)}</div>
        <div class="stock-bar"><div class="stock-fill" style="width:${Number(r.fill_pct)}%;background:${escapeHtml(
          r.fill_color,
        )}"></div></div>
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="count${cc}"${countStyle}>${escapeHtml(String(r.count))}</div>
      </div>`;
    })
    .join('');
}

function pipelineHtml(pipeline) {
  const parts = [];
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    const st = step.state === 'done' ? 'done' : step.state === 'active' ? 'active' : '';
    parts.push(`<div class="step ${st}"><div class="step-dot"></div>${escapeHtml(step.label)}</div>`);
    if (i < pipeline.length - 1) parts.push('<div class="step-arrow">→</div>');
  }
  return `<div class="pipeline-steps">${parts.join('')}</div>`;
}

function rfqCard(r) {
  const codeStyle = r.code.startsWith('EMG') ? ' style="color:var(--danger)"' : '';
  const pipe = pipelineHtml(r.pipeline);
  let badge = '';
  if (r.badge_kind === 'pending') badge = `<span class="pending-badge">${escapeHtml(r.badge_text)}</span>`;
  else if (r.badge_kind === 'emg') badge = `<span class="emg-badge">${escapeHtml(r.badge_text)}</span>`;
  else if (r.badge_kind === 'success')
    badge = `<span style="font-size:10px;color:var(--success);font-family:var(--mono)">${escapeHtml(
      r.badge_text,
    )}</span>`;
  else badge = `<span class="pending-badge">${escapeHtml(r.badge_text)}</span>`;

  let btnOnclick = '';
  if (r.meta_nav === 'quotes')
    btnOnclick = `onclick="navSafe('quotes',document.getElementById('sb-quotes'))"`;
  else if (r.meta_nav === 'po') btnOnclick = `onclick="navSafe('po',document.getElementById('sb-po'))"`;

  const btn = r.meta_button_label
    ? `<button type="button" class="mini-btn" ${btnOnclick}>${escapeHtml(r.meta_button_label)}</button>`
    : '';

  return `<div class="rfq-card">
    <div class="rfq-id"${codeStyle}>${escapeHtml(r.code)}</div>
    <div class="rfq-name">${escapeHtml(r.title)}</div>
    ${pipe}
    <div class="rfq-meta">${badge}${btn}</div>
  </div>`;
}

async function reloadRfqs() {
  state.rfqsRaw = await fetchJson(`/api/rfqs?filter=${encodeURIComponent(state.rfxFilter)}`);
  const wrap = document.getElementById('hydrate-rfq');
  if (wrap) wrap.innerHTML = state.rfqsRaw.map(rfqCard).join('');
}

function renderQuoteCompare(qc) {
  if (!qc || !qc.vendors) return;
  state.qc = qc;
  document.getElementById('quote-title').textContent = qc.rfq_code;
  document.getElementById('quote-subtitle').textContent = qc.subtitle;
  const wb = document.getElementById('hydrate-winner-badge');
  if (wb) wb.textContent = qc.winner_line;

  const vendors = qc.vendors;
  const winnerIdx = 1;
  const th = document.getElementById('hydrate-quote-thead');
  th.innerHTML = `<tr><th style="width:120px">Criteria</th>${vendors
    .map(
      (v, i) =>
        `<th${i === winnerIdx ? ' class="winner-header" style="border-radius:0"' : ''}>${i === winnerIdx ? '★ ' : ''}${escapeHtml(
          v,
        )}</th>`,
    )
    .join('')}</tr>`;

  const fills = ['background:var(--color-text-tertiary)', 'background:var(--brand)', 'background:var(--accent)'];
  document.getElementById('hydrate-quote-tbody').innerHTML = (qc.criteria || [])
    .map((row) => {
      const [label, a, b, c, kind] = row;
      if (kind === 'scores') {
        const vals = [a, b, c];
        return `<tr><td class="label">${escapeHtml(label)}</td>${vals
          .map((score, i) => {
            const pct = Math.min(100, Math.max(0, Number(score)));
            const wc = i === winnerIdx ? ' class="winner-col"' : '';
            const mono =
              i !== winnerIdx ? ';color:var(--color-text-secondary)' : '';
            return `<td${wc}><div class="score-bar"><div class="score-bg"><div class="score-fill" style="width:${pct}%;${fills[i]}"></div></div><span style="font-family:var(--mono);font-size:11px${mono}">${escapeHtml(
              score,
            )}/100</span></div></td>`;
          })
          .join('')}</tr>`;
      }
      const cells = [a, b, c];
      const isW = (i) =>
        kind === 'winner'
          ? i === winnerIdx
          : kind === 'tie'
            ? i === winnerIdx
            : false;
      return `<tr><td class="label">${escapeHtml(label)}</td>${cells
        .map((cell, i) => {
          const best = kind === 'winner' && i === winnerIdx ? ' BEST' : kind === 'tie' && i === winnerIdx ? ' ✓' : '';
          const badge = kind === 'winner' && i === winnerIdx ? ' <span class="best-badge">BEST</span>' : '';
          const wc =
            kind === 'winner' || kind === 'tie'
              ? i === winnerIdx
                ? ' class="winner-col"'
                : ''
              : '';
          return `<td${wc}>${escapeHtml(cell)}${badge}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('');
}

function toolbarHtml(po, id) {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px" id="po-toolbar-root" data-po-parent="${id}">
    <div><div style="font-size:14px;font-weight:700;color:var(--color-text-primary);font-family:var(--sans);">${escapeHtml(
      po.header_title || '',
    )}</div>
    <div style="font-size:11px;color:var(--color-text-secondary);font-family:var(--mono);margin-top:3px">${escapeHtml(
      po.header_sub || '',
    )} · Status: <strong>${escapeHtml(po.status || '')}</strong></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn" data-po-act="quick-edit">Edit fields</button>
      <button type="button" class="btn" data-po-act="submit-approve">Send for approval</button>
      <button type="button" class="btn primary" data-po-act="send-supplier">Send to supplier →</button>
    </div>
  </div>`;
}

function renderPoBody(po) {
  const doc = document.getElementById('hydrate-po-doc');
  if (!doc) return;
  const trustedHtml = (h) => (h == null ? '' : String(h));
  const lines = (po.lines || [])
    .map(
      (ln) =>
        `<tr><td>${escapeHtml(String(ln.num))}</td><td style="font-family:var(--mono);font-size:10px">${escapeHtml(
          ln.code,
        )}</td><td>${escapeHtml(ln.desc)}</td><td style="font-family:var(--mono)">${escapeHtml(ln.qty)}</td><td>${escapeHtml(
          ln.unit,
        )}</td><td style="font-family:var(--mono)">${escapeHtml(ln.price)}</td><td style="font-family:var(--mono)">${escapeHtml(
          ln.total,
        )}</td></tr>`,
    )
    .join('');
  doc.innerHTML = `
  <div class="po-header">
    <div><div class="po-company">${escapeHtml(po.buyer_company)}</div><div class="po-address">${trustedHtml(
      po.buyer_address,
    )}</div></div>
    <div class="po-title-block"><div class="po-title">Purchase Order</div>
    <div class="po-num">${escapeHtml(po.po_number)}</div>
    <div class="po-meta">Date: ${escapeHtml(po.po_date)}<br>RFQ: ${escapeHtml(po.rfq_ref || '—')}</div></div>
  </div>
  <div class="po-parties">
    <div><div class="po-party-label">Vendor</div><div class="po-party-name">${escapeHtml(
      po.vendor_name || '(set vendor)',
    )}</div><div class="po-party-detail">${trustedHtml(po.vendor_detail || '')}</div></div>
    <div><div class="po-party-label">Ship To</div><div class="po-party-name">${escapeHtml(
      po.ship_name || '',
    )}</div><div class="po-party-detail">${trustedHtml(po.ship_detail || '')}</div></div>
  </div>
  <table class="po-line-table" style="width:100%"><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
  <div class="po-totals">
    <div class="total-row"><span>Subtotal</span><span style="font-family:var(--mono)">${escapeHtml(po.subtotal)}</span></div>
    <div class="total-row"><span>Tax</span><span style="font-family:var(--mono)">${escapeHtml(po.tax)}</span></div>
    <div class="total-row"><span>Shipping</span><span style="font-family:var(--mono)">${escapeHtml(po.shipping)}</span></div>
    <div class="total-row grand"><span>Total</span><span style="font-family:var(--mono)">${escapeHtml(po.total)}</span></div>
  </div>
  <div class="po-footer">
    <div><div class="sig-label">Authorized by</div><div class="sig-name">${escapeHtml(po.auth_name)}</div><div class="sig-status approved">${escapeHtml(
      po.auth_status,
    )}</div></div>
    <div><div class="sig-label">Approved by</div><div class="sig-name">${escapeHtml(po.approver_name)}</div><div class="sig-status pending">${escapeHtml(
      po.approver_status,
    )}</div></div>
  </div>`;
}

/** --- Requisitions --- */

function reqStatusTag(status) {
  const cls =
    status === 'approved' ? 'matched' : status === 'submitted' ? 'approval' : status === 'rejected' ? 'urgent' : 'internal';
  return `<span class="tag ${escapeHtml(cls)}">${escapeHtml(status || '')}</span>`;
}

function reqListRow(r) {
  return `<button type="button" class="po-row" data-select-req="${escapeHtml(String(r.id))}">
    <div class="num">${escapeHtml(r.req_number)}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${reqStatusTag(r.status)}
      <span style="font-family:var(--mono);font-size:10px;color:var(--color-text-tertiary)">${escapeHtml(
        r.department || '',
      )}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--color-text-tertiary)">${escapeHtml(
        r.needed_by || '',
      )}</span>
    </div>
    <div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px">${escapeHtml(
      r.requester || '',
    )} · ${escapeHtml(String(r.line_count || 0))} lines · <strong style="font-family:var(--mono)">${escapeHtml(
      r.est_total || '',
    )}</strong></div>
  </button>`;
}

function renderReqList() {
  const el = document.getElementById('hydrate-req-list');
  if (!el) return;
  if (!state.requisitions.length) {
    el.innerHTML = `<div style="padding:14px;color:var(--color-text-secondary);font-size:12px;">No requisitions yet.</div>`;
    return;
  }
  el.innerHTML = state.requisitions.map(reqListRow).join('');
  document.querySelectorAll('[data-select-req]').forEach((b) =>
    b.addEventListener('click', async () => openRequisition(+b.getAttribute('data-select-req'))),
  );
}

function reqDetailHtml(req) {
  const row = (label, value) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(13,10,30,0.06)">
      <div style="font-family:var(--mono);font-size:10px;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.12em">${escapeHtml(
        label,
      )}</div>
      <div style="font-size:12px;color:var(--color-text-primary);text-align:right">${escapeHtml(value || '')}</div>
    </div>`;

  const actions = [];
  actions.push(`<button type="button" class="btn" data-req-act="edit">Edit</button>`);
  if (req.status === 'draft') actions.push(`<button type="button" class="btn primary" data-req-act="submit">Submit for approval</button>`);
  if (req.status === 'approved') actions.push(`<button type="button" class="btn primary" data-req-act="create-po">Create PO draft →</button>`);
  if (req.status === 'submitted') actions.push(`<button type="button" class="btn" data-req-act="goto-approvals">View in approvals</button>`);

  return `
    <div id="req-detail-root" data-req-id="${escapeHtml(String(req.id))}">
      ${row('Requisition', req.req_number)}
      ${row('Status', req.status)}
      ${row('Requester', req.requester)}
      ${row('Department', req.department)}
      ${row('Needed By', req.needed_by)}
      ${row('Notes', req.notes)}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${actions.join('')}</div>
    </div>
  `;
}

function reqLinesHtml(req) {
  const canEdit = req.status === 'draft';
  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--color-text-tertiary)">${
        canEdit ? 'Edit lines in draft · submit for approval when ready' : 'Lines locked after submission'
      }</div>
      ${canEdit ? `<button type="button" class="btn" data-req-line-act="add">+ Add line</button>` : ``}
    </div>
  `;
  const rows = (req.lines || []).length
    ? `
      <div style="overflow-x:auto;background:var(--color-background-primary);border:1px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);overflow:hidden">
        <table class="inv-table" style="width:100%">
          <thead><tr><th>#</th><th>Type</th><th>SKU</th><th>Description</th><th>Qty</th><th>UOM</th><th>Est Unit</th><th>Vendor</th><th>Actions</th></tr></thead>
          <tbody>
            ${(req.lines || [])
              .map((ln) => {
                const acts = canEdit
                  ? `<button type="button" class="mini-btn" data-req-line-edit="${escapeHtml(String(ln.id))}">Edit</button>
                     <button type="button" class="mini-btn" data-req-line-del="${escapeHtml(String(ln.id))}">Del</button>`
                  : `<span style="font-size:10px;color:var(--color-text-tertiary);font-family:var(--mono)">—</span>`;
                return `<tr>
                  <td style="font-family:var(--mono)">${escapeHtml(String(ln.line_no || ''))}</td>
                  <td style="font-family:var(--mono);font-size:10px">${escapeHtml(ln.line_type || '')}</td>
                  <td style="font-family:var(--mono);font-size:10px;color:var(--brand)">${escapeHtml(ln.sku || '')}</td>
                  <td>${escapeHtml(ln.description || '')}</td>
                  <td style="font-family:var(--mono)">${escapeHtml(String(ln.qty ?? ''))}</td>
                  <td style="font-family:var(--mono)">${escapeHtml(ln.uom || '')}</td>
                  <td style="font-family:var(--mono)">${escapeHtml(String(ln.est_unit_cost ?? ''))}</td>
                  <td style="font-family:var(--mono)">${escapeHtml(ln.preferred_vendor_code || '')}</td>
                  <td>${acts}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `
    : `<div style="padding:10px 0;color:var(--color-text-secondary);font-size:12px;">No lines.</div>`;

  return header + rows;
}

async function reloadRequisitions() {
  state.requisitions = await fetchJson('/api/requisitions');
  renderReqList();
  if (!state.selectedReqId && state.requisitions.length) state.selectedReqId = state.requisitions[0].id;
  if (state.selectedReqId) await openRequisition(state.selectedReqId, true);
}

async function openRequisition(id, silent = false) {
  state.selectedReqId = id;
  document.querySelectorAll('[data-select-req]').forEach((b) =>
    b.classList.toggle('active', +b.getAttribute('data-select-req') === id),
  );
  const req = await fetchJson(`/api/requisitions/${id}`);
  const d = document.getElementById('hydrate-req-detail');
  const l = document.getElementById('hydrate-req-lines');
  if (d) d.innerHTML = reqDetailHtml(req);
  if (l) l.innerHTML = reqLinesHtml(req);
  bindReqDetailActions(req);
  bindReqLineActions(req);
  if (!silent) toast(`Opened ${req.req_number}`);
}

function bindReqDetailActions(req) {
  const root = document.getElementById('req-detail-root');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-req-act]');
    if (!b) return;
    const act = b.getAttribute('data-req-act');
    const id = req.id;
    try {
      if (act === 'edit') {
        openModal({
          title: 'Edit requisition',
          desc: 'Drafts can be changed; submissions lock line edits.',
          fields: [
            { key: 'requester', label: 'Requester', value: req.requester || '', placeholder: 'Name' },
            { key: 'department', label: 'Department', value: req.department || '', placeholder: 'e.g. Sales' },
            { key: 'needed_by', label: 'Needed by (YYYY-MM-DD)', value: req.needed_by || '', placeholder: '2026-05-10' },
            { key: 'notes', label: 'Notes', value: req.notes || '', placeholder: '', large: true },
          ],
          confirm: 'Save requisition',
          onConfirm: async (vals) => {
            await fetchJson(`/api/requisitions/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(vals),
            });
            toast('Requisition updated.');
            await reloadRequisitions();
          },
        });
      }
      if (act === 'submit') {
        await fetchJson(`/api/requisitions/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        toast('Submitted for approval.');
        await reloadApprovalsBadge();
        await reloadRequisitions();
      }
      if (act === 'goto-approvals') navSafe('approvals', document.getElementById('sb-approvals'));
      if (act === 'create-po') {
        const out = await fetchJson(`/api/requisitions/${id}/create-po`, { method: 'POST' });
        toast(`Drafted ${out.po_number}`);
        await refreshPoSummaries();
        navSafe('po', document.getElementById('sb-po'));
      }
    } catch (err) {
      toast(String(err.message || err));
    }
  });
}

function bindReqLineActions(req) {
  const root = document.getElementById('hydrate-req-lines');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  root.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-req-line-act="add"]');
    if (addBtn) {
      openModal({
        title: 'Add requisition line',
        desc: 'Use SKU for stocked items; use Service for vendor work.',
        fields: [
          { key: 'line_type', label: 'Type (item|service)', value: 'item', placeholder: 'item' },
          { key: 'sku', label: 'SKU', value: '', placeholder: 'SKU-0889' },
          { key: 'description', label: 'Description', value: '', placeholder: 'Line description' },
          { key: 'qty', label: 'Qty', value: '1', placeholder: '1' },
          { key: 'uom', label: 'UOM', value: 'ea', placeholder: 'ea' },
          { key: 'est_unit_cost', label: 'Est unit cost', value: '', placeholder: 'e.g. 12.50' },
          { key: 'preferred_vendor_code', label: 'Vendor code', value: '', placeholder: 'MWS' },
        ],
        confirm: 'Add line',
        onConfirm: async (vals) => {
          await fetchJson(`/api/requisitions/${req.id}/lines`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vals),
          });
          toast('Line added.');
          await openRequisition(req.id, true);
          await reloadRequisitions();
        },
      });
      return;
    }

    const edit = e.target.closest('[data-req-line-edit]');
    if (edit) {
      const lineId = +edit.getAttribute('data-req-line-edit');
      const ln = (req.lines || []).find((x) => x.id === lineId);
      if (!ln) return;
      openModal({
        title: 'Edit line',
        desc: 'Edits are allowed in draft.',
        fields: [
          { key: 'line_type', label: 'Type (item|service)', value: ln.line_type || 'item', placeholder: 'item' },
          { key: 'sku', label: 'SKU', value: ln.sku || '', placeholder: '' },
          { key: 'description', label: 'Description', value: ln.description || '', placeholder: '' },
          { key: 'qty', label: 'Qty', value: String(ln.qty ?? ''), placeholder: '' },
          { key: 'uom', label: 'UOM', value: ln.uom || 'ea', placeholder: '' },
          { key: 'est_unit_cost', label: 'Est unit cost', value: ln.est_unit_cost == null ? '' : String(ln.est_unit_cost), placeholder: '' },
          { key: 'preferred_vendor_code', label: 'Vendor code', value: ln.preferred_vendor_code || '', placeholder: '' },
        ],
        confirm: 'Save line',
        onConfirm: async (vals) => {
          await fetchJson(`/api/requisition-lines/${lineId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vals),
          });
          toast('Line updated.');
          await openRequisition(req.id, true);
          await reloadRequisitions();
        },
      });
      return;
    }

    const del = e.target.closest('[data-req-line-del]');
    if (del) {
      const lineId = +del.getAttribute('data-req-line-del');
      openModal({
        title: 'Delete line?',
        desc: 'This removes the line from the draft requisition.',
        fields: [],
        confirm: 'Delete',
        onConfirm: async () => {
          await fetchJson(`/api/requisition-lines/${lineId}`, { method: 'DELETE' });
          toast('Line deleted.');
          await openRequisition(req.id, true);
          await reloadRequisitions();
        },
      });
    }
  });
}

async function refreshPoSummaries(selectId = null) {
  state.poSummaries = await fetchJson('/api/po-documents');
  const list = document.getElementById('hydrate-po-list');
  if (list)
    list.innerHTML = state.poSummaries
      .map(
        (s) =>
          `<button type="button" class="po-row${s.id === state.selectedPoId ? ' active' : ''}" data-select-po="${s.id}">
          <span class="num">${escapeHtml(s.po_number)}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);font-family:var(--mono);">${escapeHtml(
            s.status,
          )}</span>
          <span style="font-size:11px;color:var(--color-text-secondary)">${escapeHtml(s.vendor_name || '—')} · ${escapeHtml(
            s.total,
          )}</span>
          <span style="font-size:10px;font-family:var(--mono);color:var(--color-text-tertiary)">${escapeHtml(
            s.header_sub || '',
          )}</span>
        </button>`,
      )
      .join('');

  document.querySelectorAll('[data-select-po]').forEach((b) =>
    b.addEventListener('click', () => selectPo(+b.getAttribute('data-select-po'))),
  );

  let nextSel = selectId ?? state.selectedPoId;
  if (!nextSel && state.poSummaries.length) nextSel = state.poSummaries[0].id;
  if (nextSel) await selectPo(nextSel, true);
}

async function selectPo(id, silentToast = false) {
  state.selectedPoId = id;
  document.querySelectorAll('.po-row').forEach((b) =>
    b.classList.toggle('active', +b.getAttribute('data-select-po') === id),
  );
  const po = await fetchJson(`/api/po-documents/${id}`);
  const tb = document.getElementById('hydrate-po-toolbar');
  if (tb) tb.innerHTML = toolbarHtml(po, id);
  renderPoBody(po);
  bindPoToolbar();
  if (!silentToast) toast(`Opened ${po.po_number}`);
}

function bindPoToolbar() {
  const root = document.getElementById('hydrate-po-toolbar');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-po-act]');
    if (!b) return;
    const act = b.getAttribute('data-po-act');
    const id = state.selectedPoId;
    if (!id) return;
    try {
      if (act === 'quick-edit') {
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
            toast('Purchase order amended.');
            await refreshPoSummaries(id);
          },
        });
      }
      if (act === 'submit-approve') {
        await fetchJson(`/api/po-documents/${id}/submit-for-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        toast('Queued for CFO approval.');
        await reloadApprovalsBadge();
        await refreshPoSummaries(id);
      }
      if (act === 'send-supplier') {
        openModal({
          title: 'Transmit PO to supplier',
          desc: 'Finalizes outbound pack and marks status as Sent.',
          fields: [{ key: 'shipping', label: 'Shipment terms', placeholder: 'Describe routing', value: '' }],
          confirm: 'Send now',
          onConfirm: async (vals) => {
            await fetchJson(`/api/po-documents/${id}/send-to-supplier`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shipping: vals.shipping || 'Electronic transmission' }),
            });
            toast('PO transmitted · supplier acknowledgement pending.');
            await refreshPoSummaries(id);
          },
        });
      }
    } catch (err) {
      toast(String(err.message || err));
    }
  });
}

function invoiceTag(status) {
  if (status === 'matched') return '<span class="tag matched">Matched ✓</span>';
  if (status === 'overdue') return '<span class="tag urgent">Overdue</span>';
  if (status === 'unmatched') return '<span class="tag invoice">Unmatched</span>';
  return `<span class="tag internal">${escapeHtml(status)}</span>`;
}

function renderInvoices() {
  let rows = [...state.allInvoices];
  if (state.invFilter === 'unmatched') rows = rows.filter((i) => i.status === 'unmatched');
  if (state.invFilter === 'overdue') rows = rows.filter((i) => i.status === 'overdue');
  document.getElementById('hydrate-invoices').innerHTML = rows
    .map(
      (inv) =>
        `<tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--brand)">${escapeHtml(inv.number)}</td>
        <td>${escapeHtml(inv.supplier)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--color-text-tertiary)">${escapeHtml(inv.po_ref)}</td>
        <td style="font-family:var(--mono);font-weight:600">${escapeHtml(inv.amount)}</td>
        <td style="font-family:var(--mono);font-size:11px${inv.status === 'overdue' ? ';color:var(--danger)' : ''}">${escapeHtml(
          inv.due,
        )}</td>
        <td>${invoiceTag(inv.status)}</td>
        <td>${
          inv.status === 'unmatched'
            ? `<button type="button" class="mini-btn" data-inv-num="${escapeHtml(inv.number)}">Match</button>`
            : `<span style="font-size:10px;color:var(--color-text-tertiary);font-family:var(--mono)">—</span>`
        }</td></tr>`,
    )
    .join('');
}

function renderForecast(rows) {
  document.getElementById('hydrate-forecast').innerHTML = rows
    .map(
      (r) =>
        `<div class="forecast-item"><div><div style="font-size:12px;font-weight:600;color:var(--color-text-primary);font-family:var(--sans)">${escapeHtml(
          r.title,
        )}</div><div class="forecast-sku">${escapeHtml(r.sku_line)}</div></div><div class="forecast-days ${escapeHtml(
          r.days_class,
        )}">${escapeHtml(r.days_label)}</div></div>`,
    )
    .join('');
}

function renderInventoryTable(items) {
  document.getElementById('hydrate-inventory').innerHTML = items
    .map((it) => {
      let skuColor = 'var(--success)';
      if (it.forecast_class === 'crit') skuColor = 'var(--danger)';
      else if (it.forecast_class === 'warn') skuColor = 'var(--accent)';
      const btnStyle =
        it.action_style === 'danger'
          ? ' style="background:var(--danger-light);color:var(--danger);border-color:var(--danger)"'
          : '';
      return `<tr><td style="font-family:var(--mono);font-size:10px;color:${skuColor}" data-inv-sku="${escapeHtml(it.sku)}">${escapeHtml(
        it.sku,
      )}</td>
      <td style="font-size:12px">${escapeHtml(it.name)}</td>
      <td style="font-family:var(--mono);font-weight:600;color:${skuColor}">${escapeHtml(String(it.in_stock))}</td>
      <td style="font-family:var(--mono);font-size:11px">${escapeHtml(String(it.reorder_at))}</td>
      <td><div class="inv-level"><div class="inv-fill" style="width:${Number(it.level_pct)}%;background:${escapeHtml(
        it.level_color,
      )}"></div></div></td>
      <td><span class="forecast-days ${escapeHtml(it.forecast_class)}" style="font-size:11px">${escapeHtml(it.forecast)}</span></td>
      <td><button type="button" class="mini-btn"${btnStyle} data-mini-rfq="${escapeHtml(it.sku)}">${escapeHtml(
        it.action_label,
      )}</button></td></tr>`;
    })
    .join('');
}

function renderVendors() {
  const tb = document.getElementById('hydrate-vendors');
  if (!tb) return;
  tb.innerHTML = state.vendors
    .map(
      (v) =>
        `<tr><td style="font-weight:700;color:var(--indigo)">${escapeHtml(v.code)}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(
          v.category,
        )}</td><td style="font-family:var(--mono)">${escapeHtml(Number(v.rating).toFixed(1))}</td><td style="font-family:var(--mono)">${escapeHtml(
          v.spend_ytd,
        )}</td>
        <td><button type="button" class="mini-btn" data-vendor-edit="${v.id}">Edit</button>
        <button type="button" class="mini-btn" data-vendor-del="${v.id}" style="margin-left:4px;color:var(--danger)">Deactivate</button></td></tr>`,
    )
    .join('');
}

function renderApprovalsList() {
  const tb = document.getElementById('hydrate-approvals');
  if (!tb) return;
  tb.innerHTML = state.approvals
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.document_type)}</td><td style="font-family:var(--mono)">${escapeHtml(
          a.reference,
        )}</td><td>${escapeHtml(a.title)}</td><td style="font-family:var(--mono)">${escapeHtml(a.amount)}</td><td>${escapeHtml(
          a.requester,
        )}</td>
        <td>${a.status === 'pending' ? '<span class="pending-badge">pending</span>' : escapeHtml(a.status)}</td>
        <td>${a.status === 'pending' ? `<button type="button" class="mini-btn" data-appr-yes="${a.id}" style="background:var(--success-light);color:var(--success)">Approve</button> <button type="button" class="mini-btn" data-appr-no="${a.id}">Reject</button>` : '—'}
        </td></tr>`,
    )
    .join('');
}

function renderAnalytics(data) {
  state.analytics = data;
  const k = document.getElementById('hydrate-analytics-kpis');
  if (k && data?.kpis)
    k.innerHTML = data.kpis
      .map(
        (x) =>
          `<div class="kpi"><div class="lbl">${escapeHtml(x.label)}</div><div class="big">${escapeHtml(x.value)}</div><div class="sub">${escapeHtml(
            x.sub,
          )}</div></div>`,
      )
      .join('');
  const fn = document.getElementById('hydrate-analytics-funnel');
  if (fn && data?.funnel)
    fn.innerHTML = data.funnel
      .map((f) => `<div style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid rgba(13,10,30,0.08);"><span>${escapeHtml(
        f.stage,
      )}</span><span style="font-family:var(--mono);font-weight:700;">${escapeHtml(String(f.count))}</span></div>`)
      .join('');
  const vs = document.getElementById('hydrate-analytics-vendors');
  if (vs && data?.vendorSpend)
    vs.innerHTML = data.vendorSpend
      .map(
        (v) =>
          `<tr><td>${escapeHtml(v.name)} <span style="font-size:10px;color:var(--color-text-tertiary)">(${escapeHtml(
            v.code,
          )})</span></td><td style="font-family:var(--mono)">${escapeHtml(v.spend_ytd)}</td><td style="font-family:var(--mono)">${escapeHtml(
            String(Number(v.rating || 0).toFixed(1)),
          )}</td></tr>`,
      )
      .join('');
}

/** Modal */
let _modalCb = null;
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  _modalCb = null;
}

function openModal({ title, desc, fields = [], confirm, onConfirm }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent = desc || '';
  const wrap = document.getElementById('modal-fields');
  wrap.innerHTML = fields
    .map(
      (f) =>
        `<div><label for="mf_${escapeHtml(f.key)}">${escapeHtml(f.label)}</label>${f.large ? `<textarea id="mf_${escapeHtml(f.key)}">${escapeHtml(f.value ?? '')}</textarea>` : `<input id="mf_${escapeHtml(f.key)}" value="${escapeHtml(f.value ?? '')}" placeholder="${escapeHtml(f.placeholder || '')}" />`}</div>`,
    )
    .join('');
  document.getElementById('modal-confirm').textContent = confirm || 'Confirm';
  _modalCb = async () => {
    const vals = {};
    fields.forEach((f) => {
      const el = document.getElementById(`mf_${f.key}`);
      if (el) vals[f.key] = el.value;
    });
    try {
      const ret = await onConfirm(vals);
      if (ret !== false) closeModal();
    } catch (e) {
      toast(String(e.message || e));
    }
  };
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function openThresholdModal(prefillSku) {
  const skuDefault =
    prefillSku !== undefined ? String(prefillSku) : String(state.inventoryCritSku || '');
  openModal({
    title: 'Reorder guardrails',
    desc: 'Applies SKU-level reorder points for alerting + stock rows.',
    fields: [
      { key: 'sku', label: 'SKU', value: skuDefault, placeholder: 'SKU-4421' },
      { key: 'reorder_at', label: 'Reorder at qty', placeholder: 'e.g. 20', value: '20' },
      { key: 'in_stock', label: '(Optional) true-up on-hand', placeholder: '', value: '' },
    ],
    confirm: 'Apply thresholds',
    onConfirm: async (vals) => {
      if (!vals.sku?.trim()) {
        toast('SKU needed.');
        return false;
      }
      const body = { reorder_at: +vals.reorder_at };
      if (vals.in_stock?.trim()) body.in_stock = +vals.in_stock;
      await fetchJson(`/api/inventory/${encodeURIComponent(vals.sku.trim())}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const inv = await fetchJson('/api/inventory');
      renderForecast(inv.forecast || []);
      renderInventoryTable(inv.items || []);
      const st = await fetchJson('/api/stock-critical');
      renderStock(st);
      toast(`Rules applied to ${vals.sku}.`);
    },
  });
}

function navSafe(key, el) {
  window.nav(key, el);
}

/** Global search debounce */
let _searchT = null;
async function globalSearch(raw) {
  const q = raw.trim();
  const box = document.getElementById('search-results');
  if (!q) {
    box.classList.remove('open');
    box.innerHTML = '';
    return;
  }
  try {
    const data = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
    const blocks = [];
    const pushSection = (label, rows, navCb) => {
      if (!rows?.length) return;
      blocks.push(`<div class="sr-h">${escapeHtml(label)}</div>${rows.map((r) => `<div class="sr-row" tabindex="0" data-hit="${escapeHtml(label)}" data-id="${escapeHtml(r.id)}">${escapeHtml(r.title)}</div>`).join('')}`);
    };
    pushSection('RFQs', data.rfqs);
    pushSection('Inbox', data.inbox);
    pushSection('Invoices', data.invoices);
    pushSection('Vendors', data.vendors);
    box.innerHTML = blocks.join('') || `<div style="padding:12px;font-size:11px;color:var(--color-text-secondary)">No hits.</div>`;
    box.classList.add('open');
    box.querySelectorAll('[data-hit]').forEach((rowEl) =>
      rowEl.addEventListener('click', async () => {
        const lab = rowEl.getAttribute('data-hit');
        if (lab === 'RFQs') navSafe('rfx', document.getElementById('sb-rfx'));
        if (lab === 'Inbox') navSafe('inbox', document.getElementById('sb-inbox'));
        if (lab === 'Invoices') navSafe('invoices', document.getElementById('sb-invoices'));
        if (lab === 'Vendors') navSafe('vendors', document.getElementById('sb-vendors'));
        await reloadRfqs();
        box.classList.remove('open');
      }),
    );
  } catch (e) {
    toast(String(e.message || e));
  }
}

async function reloadApprovalsBadge() {
  const boot = await fetchJson('/api/bootstrap');
  document.getElementById('badge-approvals').textContent = String(boot.badges?.approvals ?? '0');
}

async function hydrate() {
  const boot = await fetchJson('/api/bootstrap');
  document.getElementById('brand-wordmark').textContent = boot.tenant?.wordmark || 'VEXOR';
  document.getElementById('tenant-name').textContent = boot.tenant?.name || '';

  document.getElementById('badge-inbox').textContent = String(boot.badges.inbox ?? '—');
  document.getElementById('badge-rfx').textContent = String(boot.badges.rfx ?? '—');
  document.getElementById('badge-invoices').textContent = String(boot.badges.invoices ?? '—');
  document.getElementById('badge-approvals').textContent = String(boot.badges.approvals ?? '—');

  window.PROCUREOS_SCREENS = mergeScreens(boot.screens);

  renderStats(boot.stats);

  const activities = await fetchJson('/api/activities');
  const stock = await fetchJson('/api/stock-critical');
  state.inbox = await fetchJson('/api/inbox');
  renderActivities(activities);
  renderStock(stock);
  renderInbox();

  state.invFilter = 'all';
  state.allInvoices = await fetchJson('/api/invoices');
  renderInvoices();

  const qc = await fetchJson('/api/quote-compare');
  renderQuoteCompare(qc);

  state.qc = qc;
  await reloadRfqs();
  await refreshPoSummaries(state.selectedPoId);

  const inv = await fetchJson('/api/inventory');
  renderForecast(inv.forecast || []);
  renderInventoryTable(inv.items || []);

  state.vendors = await fetchJson('/api/vendors');
  renderVendors();

  state.approvals = await fetchJson('/api/approvals');
  renderApprovalsList();
  try {
    await reloadRequisitions();
  } catch {
    /* ignore */
  }

  const analytics = await fetchJson('/api/analytics/overview');
  renderAnalytics(analytics);

  syncTopbarTitles();
}

function syncTopbarTitles() {
  const active = document.querySelector('.sb-item.active');
  if (!active?.id?.startsWith('sb-')) return;
  const key = {
    'sb-dashboard': 'dashboard',
    'sb-inbox': 'inbox',
    'sb-rfx': 'rfx',
    'sb-quotes': 'quotes',
    'sb-po': 'po',
    'sb-req': 'requisitions',
    'sb-invoices': 'invoices',
    'sb-inventory': 'inventory',
    'sb-approvals': 'approvals',
    'sb-vendors': 'vendors',
    'sb-analytics': 'analytics',
  }[active.id];
  const sc = (window.PROCUREOS_SCREENS || {})[key];
  if (sc) {
    document.getElementById('tb-title').textContent = sc.title;
    document.getElementById('tb-sub').textContent = sc.sub;
  }
}

function wireChrome() {
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('modal-confirm').addEventListener('click', async () => {
    if (_modalCb) await _modalCb();
  });

  document.getElementById('btn-ai-inbox')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-ai-inbox');
    btn.disabled = true;
    try {
      const res = await fetchJson('/api/automation/process-inbox', { method: 'POST' });
      state.inbox = res.messages;
      renderInbox();
      toast(`AI inbox: normalized ${res.processed} threads.`);
    } catch (e) {
      toast(String(e.message || e));
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-new-rfq')?.addEventListener('click', () =>
    openModal({
      title: 'Create sourcing request',
      desc: 'Publishes a new RFQ to your pipeline (demo state).',
      fields: [{ key: 'title', label: 'Program title', value: '', placeholder: 'Describe parts / scope' }],
      confirm: 'Create RFQ',
      onConfirm: async (vals) => {
        if (!vals.title?.trim()) {
          toast('Title required.');
          return false;
        }
        const created = await fetchJson('/api/rfqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: vals.title.trim() }),
        });
        toast(`Created ${created.code}`);
        await reloadRfqs();
        navSafe('rfx', document.getElementById('sb-rfx'));
        const acts = await fetchJson('/api/activities');
        renderActivities(acts);
      },
    }),
  );

  document.getElementById('btn-create-po')?.addEventListener('click', async () => {
    try {
      const r = await fetchJson('/api/po-documents', { method: 'POST' });
      toast(`Draft ${r.po_number} created`);
      await refreshPoSummaries(r.id);
      navSafe('po', document.getElementById('sb-po'));
    } catch (e) {
      toast(String(e.message || e));
    }
  });

  document.getElementById('btn-create-req')?.addEventListener('click', () =>
    openModal({
      title: 'New requisition',
      desc: 'Create an internal request for purchasing or service work.',
      fields: [
        { key: 'requester', label: 'Requester', value: 'Requester', placeholder: 'Name' },
        { key: 'department', label: 'Department', value: 'General', placeholder: 'Sales · Store Ops · Facilities' },
        { key: 'needed_by', label: 'Needed by (YYYY-MM-DD)', value: '', placeholder: '2026-05-10' },
        { key: 'notes', label: 'Notes', value: '', placeholder: '', large: true },
      ],
      confirm: 'Create requisition',
      onConfirm: async (vals) => {
        const created = await fetchJson('/api/requisitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vals),
        });
        toast(`Created ${created.requisition?.req_number || 'requisition'}`);
        await reloadRequisitions();
        navSafe('requisitions', document.getElementById('sb-req'));
      },
    }),
  );

  document.getElementById('global-search-q').addEventListener('input', (e) => {
    clearTimeout(_searchT);
    _searchT = setTimeout(() => globalSearch(e.target.value), 200);
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.glob-wrap')) document.getElementById('search-results')?.classList.remove('open');
  });

  document.querySelectorAll('[data-inbox-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-inbox-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.inboxFilter = btn.getAttribute('data-inbox-filter');
      renderInbox();
    }),
  );

  document.getElementById('inbox-q')?.addEventListener('input', (ev) => {
    state.inboxQuery = ev.target.value;
    renderInbox();
  });

  document.querySelectorAll('[data-rfx-filter]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-rfx-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.rfxFilter = btn.getAttribute('data-rfx-filter');
      await reloadRfqs();
    }),
  );

  document.querySelectorAll('[data-inv-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-inv-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.invFilter = btn.getAttribute('data-inv-filter');
      renderInvoices();
    }),
  );

  document.getElementById('btn-quote-csv')?.addEventListener('click', () => {
    window.location.href = '/api/quote-compare/export.csv';
    toast('CSV download started.');
  });

  document.getElementById('btn-quote-reject')?.addEventListener('click', async () => {
    try {
      await fetchJson('/api/quote-compare/reject-losers', { method: 'POST' });
      toast('Runners-up recorded · winner locked.');
      const acts = await fetchJson('/api/activities');
      renderActivities(acts);
    } catch (e) {
      toast(String(e.message || e));
    }
  });

  document.getElementById('hydrate-invoices')?.addEventListener('click', async (e) => {
    const bt = e.target.closest('[data-inv-num]');
    if (!bt) return;
    const num = bt.getAttribute('data-inv-num');
    openModal({
      title: `Match invoice ${num}`,
      desc: 'Associate an open PO to clear three-way-match exceptions.',
      fields: [{ key: 'po_ref', label: 'PO reference', value: '', placeholder: 'PO-2024-xxxx' }],
      confirm: 'Record match',
      onConfirm: async (vals) => {
        await fetchJson(`/api/invoices/${encodeURIComponent(num)}/match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ po_ref: vals.po_ref?.trim() }),
        });
        state.allInvoices = await fetchJson('/api/invoices');
        renderInvoices();
        toast('Invoice matched ✓');
        const acts = await fetchJson('/api/activities');
        renderActivities(acts);
      },
    });
  });

  document.getElementById('btn-add-vendor')?.addEventListener('click', () =>
    openModal({
      title: 'Provision vendor record',
      desc: 'Codes power RFQ invites and OCR routing.',
      fields: [
        { key: 'code', label: 'Vendor code', placeholder: 'e.g. ACME01' },
        { key: 'name', label: 'Legal name' },
        { key: 'category', label: 'Category', value: '', placeholder: 'Raw · MRO · Services' },
        { key: 'contact_email', label: 'PO email inbox' },
      ],
      confirm: 'Save vendor',
      onConfirm: async (vals) => {
        await fetchJson('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vals),
        });
        state.vendors = await fetchJson('/api/vendors');
        renderVendors();
        toast('Vendor created.');
      },
    }),
  );

  document.getElementById('hydrate-vendors')?.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-vendor-edit]');
    const dl = e.target.closest('[data-vendor-del]');
    if (!ed && !dl) return;
    if (dl) {
      if (!confirm('Deactivate this vendor listing?')) return;
      await fetchJson(`/api/vendors/${encodeURIComponent(dl.getAttribute('data-vendor-del'))}`, { method: 'DELETE' });
      state.vendors = await fetchJson('/api/vendors');
      renderVendors();
      toast('Vendor archived.');
      return;
    }
    const id = +ed.getAttribute('data-vendor-edit');
    const v = state.vendors.find((x) => x.id === id);
    if (!v) return;
    openModal({
      title: `Edit · ${v.name}`,
      fields: [
        { key: 'notes', label: 'Internal notes', value: v.notes || '', placeholder: '', large: true },
        {
          key: 'spend_ytd',
          label: 'Rolling spend headline',
          value: v.spend_ytd || '',
        },
      ],
      confirm: 'Update profile',
      onConfirm: async (vals) => {
        await fetchJson(`/api/vendors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: vals.notes, spend_ytd: vals.spend_ytd }),
        });
        state.vendors = await fetchJson('/api/vendors');
        renderVendors();
        toast('Vendor updated.');
      },
    });
  });

  document.getElementById('hydrate-approvals')?.addEventListener('click', async (e) => {
    const ya = e.target.closest('[data-appr-yes]');
    const no = e.target.closest('[data-appr-no]');
    if (!ya && !no) return;
    const id = ya ? +ya.getAttribute('data-appr-yes') : +no.getAttribute('data-appr-no');
    const action = ya ? 'approve' : 'reject';
    await fetchJson(`/api/approvals/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    toast(action === 'approve' ? 'Released for execution.' : 'Returned to procurement.');
    state.approvals = await fetchJson('/api/approvals');
    renderApprovalsList();
    await reloadApprovalsBadge();
    await refreshPoSummaries(state.selectedPoId);
    const acts = await fetchJson('/api/activities');
    renderActivities(acts);
    const ana = await fetchJson('/api/analytics/overview');
    renderAnalytics(ana);
  });

  document.getElementById('btn-inv-thresholds')?.addEventListener('click', () => openThresholdModal());

  document.getElementById('btn-auto-reorder-crit')?.addEventListener('click', async () => {
    try {
      await fetchJson('/api/rfqs/emergency-stock', { method: 'POST' });
      toast('Emergency RFQ synthesized from critical SKU.');
      await reloadRfqs();
      navSafe('rfx', document.getElementById('sb-rfx'));
    } catch (e) {
      toast(String(e.message || e));
    }
  });

  document.getElementById('act-auto-rfq-bear')?.addEventListener('click', async () => {
    await fetchJson('/api/rfqs/emergency-stock', { method: 'POST' });
    await reloadRfqs();
    navSafe('rfx', document.getElementById('sb-rfx'));
  });

  document.getElementById('act-draft-rfq-filters')?.addEventListener('click', async () => {
    await fetchJson('/api/rfqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Filters + seals MRO bundle draft' }),
    });
    toast('RFC queued for filtration SKUs.');
    await reloadRfqs();
  });

  document.getElementById('act-demand-forecast')?.addEventListener('click', () =>
    openModal({
      title: 'Demand projection (Beta)',
      desc: 'Consumption model blends historical PO releases with production calendar (seeded heuristic). Expect GA attach to telemetry soon.',
      fields: [
        {
          key: 'forecast_blurb',
          label: 'Preview window',
          value: 'Next 6 weeks (+9% uplift vs prior year).',
          large: true,
        },
      ],
      confirm: 'Close preview',
      onConfirm: async () => toast('Forecast snapshot locked to planning board.'),
    }),
  );

  document.getElementById('act-reorder-rules')?.addEventListener('click', () =>
    openModal({
      title: 'Auto-reorder playbook',
      desc: 'Orchestration runs nightly · ties into inventory deltas + SLA timers.',
      fields: [{ key: 'rule', label: 'Active ruleset', large: true, value: '- Critical SKUs escalate to CFO after 48h stall\n- MRO carts batch Wednesday 06:00 CT\n- Duplicate vendor quotes auto-collapsed', placeholder: '' }],
      confirm: 'Acknowledge playbook',
      onConfirm: async () => toast('Playbook synced to automation worker (demo).'),
    }),
  );

  document.getElementById('hydrate-inventory')?.addEventListener('click', async (e) => {
    const skuBtn = e.target.closest('[data-mini-rfq]')?.getAttribute('data-mini-rfq');
    if (skuBtn) {
      await fetchJson('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Restock program · ${skuBtn}` }),
      });
      toast(`RFQ opened for ${skuBtn}`);
      await reloadRfqs();
    }
  });

  /** Double-click SKU for threshold modal preset */
  document.getElementById('hydrate-inventory')?.addEventListener('dblclick', (e) => {
    const skuCell = e.target.closest('td[data-inv-sku]');
    if (!skuCell) return;
    openThresholdModal(skuCell.getAttribute('data-inv-sku'));
  });

  window.addEventListener('vexor:nav', (ev) => {
    syncTopbarTitles();
    const key = ev?.detail?.key;
    if (key === 'requisitions') reloadRequisitions().catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {
  state.inventoryCritSku = 'SKU-4421';
  wireChrome();
  hydrate().catch((e) => {
    console.error(e);
    toast('Run npm start · open http://localhost:3000');
  });
});
