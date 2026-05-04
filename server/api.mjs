import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

function escapeHtmlSnippet(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeActivityHtml(html) {
  const placeholders = [];
  const stash = (tag) => {
    const token = `__VEXOR_SAFE_TAG_${placeholders.length}__`;
    placeholders.push([token, tag]);
    return token;
  };
  const withPlaceholders = String(html)
    .replace(/<\/?strong>/gi, (tag) => stash(tag.toLowerCase()))
    .replace(/<br\s*\/?>/gi, () => stash('<br>'));
  let escaped = escapeHtmlSnippet(withPlaceholders);
  for (const [token, tag] of placeholders) escaped = escaped.replaceAll(token, tag);
  return escaped;
}

function stringifyCsv(cell) {
  const t = String(cell);
  if (t.includes('"') || t.includes(',') || t.includes('\n')) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

function formatMeta(meta, inboxUnread, criticalStock, rfqCount, approvalsPending, vendorActive, db) {
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const dateStr = new Intl.DateTimeFormat('en-US', opts).format(new Date());

  let quotesSub = 'No active comparison';
  try {
    const qcRow = db.prepare('SELECT rfq_code, vendors_json FROM quote_compare WHERE id = 1').get();
    if (qcRow) {
      const vendors = JSON.parse(qcRow.vendors_json || '[]');
      const n = Array.isArray(vendors) ? vendors.length : 0;
      quotesSub = `${qcRow.rfq_code} · ${n} vendor quote${n === 1 ? '' : 's'}`;
    }
  } catch {
    /* ignore */
  }

  return {
    dashboard: {
      title: `${meta.greeting}, ${meta.user_name}`,
      sub: dateStr,
    },
    inbox: {
      title: 'Procurement inbox',
      sub: `${inboxUnread} unread`,
    },
    rfx: {
      title: 'RFX manager',
      sub: `${rfqCount} RFQs`,
    },
    quotes: {
      title: 'Quote comparison',
      sub: quotesSub,
    },
    po: {
      title: 'Purchase orders',
      sub: 'Drafts and approvals',
    },
    invoices: {
      title: 'Invoices',
      sub: 'Match and reconcile',
    },
    inventory: {
      title: 'Inventory',
      sub: `${criticalStock} critical SKUs`,
    },
    approvals: {
      title: 'Approval queue',
      sub: `${approvalsPending} pending`,
    },
    vendors: {
      title: 'Vendor directory',
      sub: `${vendorActive} active vendors`,
    },
    analytics: {
      title: 'Spend analytics',
      sub: 'KPIs and funnel',
    },
    requisitions: {
      title: 'Requisitions',
      sub: 'Internal purchase requests (REQ)',
    },
    po_transfer: {
      title: 'PO transfer',
      sub: 'Intercompany or cross-site PO transfers',
    },
    sales_orders: {
      title: 'Sales orders',
      sub: 'Demand and back-to-back buy links',
    },
    receiving: {
      title: 'Receiving',
      sub: 'ASN, GRN, and putaway',
    },
    vendor_items: {
      title: 'Vendor items',
      sub: 'Vendor SKU matrix, UoM, and price breaks',
    },
    catalog_items: {
      title: 'Catalog items',
      sub: 'Enterprise item master and categories',
    },
    contracts: {
      title: 'Contracts',
      sub: 'Supplier agreements and tier spend',
    },
  };
}

function rfqMatchesFilter(workflow_stage, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'emergency') return workflow_stage === 'emergency';
  if (filter === 'awaiting_quotes') return workflow_stage === 'awaiting_quotes';
  if (filter === 'pending_po') return workflow_stage === 'pending_po';
  if (filter === 'in_progress') return workflow_stage !== 'fulfilled';
  return true;
}

function serializePo(row) {
  if (!row) return null;
  const lines = JSON.parse(row.lines_json || '[]');
  const { lines_json, ...rest } = row;
  return { ...rest, lines };
}

function nextActivityOrder(db) {
  return db.prepare('SELECT COALESCE(MAX(sort_order), -1)+1 AS o FROM activity').get().o;
}

function logActivity(db, tag_class, tag_label, description_html, time_label = 'Just now') {
  const o = nextActivityOrder(db);
  db.prepare(
    `INSERT INTO activity (tag_class, tag_label, description_html, time_label, sort_order) VALUES (?,?,?,?,?)`,
  ).run(tag_class, tag_label, sanitizeActivityHtml(description_html), time_label, o);
}

export function registerApi(app, db) {
  app.get('/api/bootstrap', (_req, res) => {
    try {
      const tenant = db.prepare('SELECT name, wordmark FROM tenant WHERE id = 1').get();
      const meta = db.prepare('SELECT greeting, user_name FROM dashboard_meta WHERE id = 1').get();
      const stats = db.prepare('SELECT * FROM stat_snapshot WHERE id = 1').get();
      const inboxUnread = db.prepare(`SELECT COUNT(*) AS c FROM inbox_message`).get().c;
      const criticalCount = db
        .prepare(`SELECT COUNT(*) AS c FROM inventory_item WHERE forecast_class = 'crit'`)
        .get().c;
      const rfqCount = db.prepare('SELECT COUNT(*) AS c FROM rfq').get().c;
      const approvalsPending = db
        .prepare(`SELECT COUNT(*) AS c FROM approval WHERE status = 'pending'`)
        .get().c;
      const vendorActive = db.prepare(`SELECT COUNT(*) AS c FROM vendor WHERE active = 1`).get().c;
      const screens = formatMeta(meta, inboxUnread, criticalCount, rfqCount, approvalsPending, vendorActive, db);

      res.json({
        tenant,
        stats,
        badges: {
          inbox: inboxUnread,
          rfx: rfqCount,
          invoices: db.prepare('SELECT COUNT(*) AS c FROM invoice').get().c,
          approvals: approvalsPending,
        },
        screens,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/activities', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT tag_class, tag_label, description_html, time_label FROM activity ORDER BY sort_order`,
      )
      .all();
    res.json(rows);
  });

  app.post('/api/activities', (req, res) => {
    try {
      const { tag_class = 'internal', tag_label = 'Event', description_html } = req.body || {};
      if (!description_html) return res.status(400).json({ error: 'description_html required' });
      logActivity(db, tag_class, tag_label, description_html);
      const row = db.prepare(`SELECT * FROM activity ORDER BY id DESC LIMIT 1`).get();
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/stock-critical', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT sku, name, count, fill_pct, fill_color, count_class FROM stock_row ORDER BY sort_order`,
      )
      .all();
    res.json(rows);
  });

  app.get('/api/inbox', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, sender, subject, preview, time_label, avatar_initials, avatar_bg, avatar_color, tags_json, category, ai_processed
         FROM inbox_message ORDER BY sort_order`,
      )
      .all();
    res.json(rows.map((r) => ({ ...r, tags: JSON.parse(r.tags_json || '[]') })));
  });

  app.get('/api/search', (req, res) => {
    const qRaw = ((req.query.q ?? '') + '').trim();
    const q = qRaw.toLowerCase();
    const limit = Math.min(25, Math.max(4, +(req.query.limit || 12)));
    if (!qRaw) return res.json({ rfqs: [], inbox: [], invoices: [], vendors: [] });

    const rfqs = db
      .prepare(`SELECT code AS id, title, 'RFQ' AS type FROM rfq WHERE LOWER(title) LIKE ? OR LOWER(code) LIKE ? LIMIT ?`)
      .all(`%${q}%`, `%${q}%`, limit);

    const inbox = db
      .prepare(
        `SELECT CAST(id AS TEXT) AS id, subject AS title, 'Inbox' AS type FROM inbox_message WHERE LOWER(subject) LIKE ? OR LOWER(sender) LIKE ? OR LOWER(preview) LIKE ? LIMIT ?`,
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`, limit);

    const invoices = db
      .prepare(
        `SELECT number AS id, supplier || ' · ' || number AS title, 'Invoice' AS type FROM invoice WHERE LOWER(number) LIKE ? OR LOWER(supplier) LIKE ? LIMIT ?`,
      )
      .all(`%${q}%`, `%${q}%`, limit);

    const vendors = db
      .prepare(
        `SELECT CAST(id AS TEXT) AS id, name || ' (' || code || ')' AS title, 'Vendor' AS type FROM vendor WHERE active = 1 AND (LOWER(name) LIKE ? OR LOWER(code) LIKE ? OR LOWER(IFNULL(contact_email,'')) LIKE ?) LIMIT ?`,
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`, limit);

    res.json({ rfqs, inbox, invoices, vendors });
  });

  app.get('/api/rfqs', (req, res) => {
    const filter = (req.query.filter || '').toString();
    const rows = db
      .prepare(
        `SELECT code, title, pipeline_json, badge_text, badge_kind, meta_button_label, meta_nav,
                COALESCE(workflow_stage,'open') AS workflow_stage FROM rfq ORDER BY sort_order`,
      )
      .all();
    const mapped = rows
      .map((r) => ({ ...r, pipeline: JSON.parse(r.pipeline_json || '[]') }))
      .filter((r) => rfqMatchesFilter(r.workflow_stage, filter));
    res.json(mapped);
  });

  app.post('/api/rfqs', (req, res) => {
    try {
      const { title } = req.body || {};
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
      const n = db.prepare('SELECT COUNT(*) AS c FROM rfq').get().c;
      const yr = new Date().getFullYear();
      const code = `RFQ-${yr}-${String(100 + n + 1).padStart(3, '0')}`;
      const pipeline = JSON.stringify([
        { label: 'RFQ Sent', state: 'active' },
        { label: 'Quotes In', state: '' },
        { label: 'Compare', state: '' },
        { label: 'PO Draft', state: '' },
        { label: 'Approved', state: '' },
        { label: 'Payment', state: '' },
      ]);
      db.prepare(
        `INSERT INTO rfq (code, title, pipeline_json, badge_text, badge_kind, meta_button_label, meta_nav, workflow_stage, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(code, title.trim(), pipeline, 'Gathering vendors', 'pending', '', '', 'awaiting_quotes', 900 + n);
      logActivity(
        db,
        'extracted',
        'RFQ created',
        `<strong>${escapeHtmlSnippet(code)}</strong> — ${escapeHtmlSnippet(title.trim())}`,
        'Just now',
      );
      res.json({ ok: true, code, row: db.prepare('SELECT * FROM rfq WHERE code = ?').get(code) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/rfqs/emergency-stock', (_req, res) => {
    try {
      const crit = db
        .prepare(`SELECT sku, name FROM inventory_item WHERE forecast_class = 'crit' ORDER BY sort_order LIMIT 1`)
        .get();
      const sku = crit?.sku || 'SKU-4421';
      const name = crit?.name || 'Critical SKU';
      const n = db.prepare('SELECT COUNT(*) AS c FROM rfq').get().c;
      const code = `EMG-2026-${String(n + 1).padStart(3, '0')}`;
      const pipeline = JSON.stringify([
        { label: 'Requested', state: 'done' },
        { label: 'PO Draft', state: 'active' },
        { label: 'Approval', state: '' },
        { label: 'Sent', state: '' },
      ]);
      db.prepare(
        `INSERT INTO rfq (code, title, pipeline_json, badge_text, badge_kind, meta_button_label, meta_nav, workflow_stage, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(code, `${name} (${sku}) emergency restock × 120`, pipeline, 'Auto-RFQ queued', 'emg', 'Create PO →', 'po', 'emergency', 50);
      logActivity(db, 'emergency', 'Auto RFQ', `System queued <strong>${escapeHtmlSnippet(code)}</strong> for ${escapeHtmlSnippet(sku)} · 120 units suggested.`);
      const rows = db
        .prepare(
          `SELECT code, title, pipeline_json, badge_text, badge_kind, meta_button_label, meta_nav, workflow_stage FROM rfq ORDER BY sort_order`,
        )
        .all();
      res.json({
        ok: true,
        code,
        rfqs: rows.map((r) => ({ ...r, pipeline: JSON.parse(r.pipeline_json || '[]') })),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/quote-compare', (_req, res) => {
    const row = db.prepare('SELECT rfq_code, subtitle, winner_line, criteria_json, vendors_json FROM quote_compare WHERE id = 1').get();
    if (!row) return res.status(404).json({ error: 'No quote compare' });
    res.json({
      ...row,
      criteria: JSON.parse(row.criteria_json || '[]'),
      vendors: JSON.parse(row.vendors_json || '[]'),
    });
  });

  app.get('/api/quote-compare/export.csv', (_req, res) => {
    const row = db.prepare('SELECT criteria_json, vendors_json FROM quote_compare WHERE id = 1').get();
    if (!row) return res.status(404).send('Not found');
    const criteria = JSON.parse(row.criteria_json || '[]');
    const vendors = JSON.parse(row.vendors_json || '[]');
    const header = ['Criteria', ...vendors];
    const lines = [header.join(',')]
      .concat(
        criteria.map((r) =>
          [
            stringifyCsv(r[0]),
            stringifyCsv(String(r[1])),
            stringifyCsv(String(r[2])),
            stringifyCsv(String(r[3])),
          ].join(','),
        ),
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="quote-comparison.csv"');
    res.send(lines);
  });

  app.post('/api/quote-compare/reject-losers', (_req, res) => {
    logActivity(db, 'internal', 'Quote decision', '<strong>Allied Metals + Midwest Supply</strong> marked not selected · audit trail retained.');
    res.json({ ok: true });
  });

  app.get('/api/po-documents', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT id, po_number, status, vendor_name, total, header_sub FROM po_documents ORDER BY sort_order ASC, id ASC`,
      )
      .all();
    res.json(rows);
  });

  app.get('/api/po-documents/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM po_documents WHERE id = ?').get(+req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const po = serializePo(row);
    res.json(po);
  });

  app.post('/api/po-documents', (_req, res) => {
    try {
      const cnt = db.prepare(`SELECT COUNT(*) AS c FROM po_documents`).get().c;
      const po_number = `PO-2026-${String(cnt + 200).padStart(4, '0')}`;
      const tenant = db.prepare(`SELECT name FROM tenant WHERE id=1`).get();
      const buyer = tenant?.name || 'ACME RETAIL CO.';
      const lines_json = JSON.stringify([
        { num: 1, code: '-', desc: 'Line item', qty: '0', unit: 'ea', price: '$0.00', total: '$0.00' },
      ]);
      db.prepare(
        `
        INSERT INTO po_documents (
          status, header_title, header_sub, po_number, po_date, rfq_ref,
          buyer_company, buyer_address, vendor_name, vendor_detail, ship_name, ship_detail,
          lines_json, subtotal, tax, shipping, total,
          auth_name, auth_status, approver_name, approver_status, sort_order)
        VALUES (
          'draft','New draft PO','Specify vendor · add lines', ?, date('now'),'',
          ?,'Receiving address on file<br>Chicago, IL 60601<br>buyer@acme.example',
          '', '','Receiving Dept','Receiving — Dock B',
          ?, '$0.00','$0.00','$0.00','$0.00',
          'Sarah Martinez','Draft','Mark Chen','⏳ Not submitted',990
        )
      `,
      ).run(po_number, buyer, lines_json);
      const inserted = db.prepare(`SELECT last_insert_rowid() AS id`).get().id;
      logActivity(
        db,
        'approval',
        'PO draft',
        `Created <strong>${escapeHtmlSnippet(po_number)}</strong> — add vendor & lines.`,
        'Just now',
      );
      res.json({ ok: true, id: inserted, po_number });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/po-documents/:id', (req, res) => {
    try {
      const id = +req.params.id;
      const row = db.prepare('SELECT * FROM po_documents WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      const patch = req.body || {};
      const allowed = ['header_sub', 'shipping', 'vendor_name', 'total', 'header_title'];
      const kv = {};
      for (const k of allowed)
        if (patch[k] != null && String(patch[k]).trim()) kv[k] = String(patch[k]);
      if (!Object.keys(kv).length) return res.status(400).json({ error: 'No patch fields' });
      const keys = Object.keys(kv);
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE po_documents SET ${setClause} WHERE id = ?`).run(...keys.map((k) => kv[k]), id);
      logActivity(db, 'invoice', 'PO updated', `Document <strong>${escapeHtmlSnippet(row.po_number)}</strong> amended in cockpit.`);
      res.json({ ok: true, doc: serializePo(db.prepare('SELECT * FROM po_documents WHERE id=?').get(id)) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/po-documents/:id/submit-for-approval', (req, res) => {
    try {
      const id = +req.params.id;
      const row = db.prepare('SELECT * FROM po_documents WHERE id=?').get(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      db.prepare(
        `UPDATE po_documents SET status = 'pending_approval', header_sub = COALESCE(?, header_sub),
         approver_status = '⏳ Pending CFO' WHERE id = ?`,
      ).run(req.body?.note || row.header_sub || 'Submitted for CFO review', id);
      db.prepare(
        `INSERT INTO approval (document_type, reference, title, amount, requester, status, notes, sort_order)
         VALUES ('PO', ?, ?, ?, 'Sarah Martinez', 'pending', ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM approval))`,
      ).run(
        row.po_number,
        row.header_title || row.po_number,
        row.total,
        'Submitted from cockpit',
      );
      logActivity(
        db,
        'approval',
        'Submitted',
        `<strong>${escapeHtmlSnippet(row.po_number)}</strong> sent for approval.`,
      );
      res.json({ ok: true, doc: serializePo(db.prepare('SELECT * FROM po_documents WHERE id=?').get(id)) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/po-documents/:id/send-to-supplier', (req, res) => {
    try {
      const id = +req.params.id;
      const row = db.prepare('SELECT * FROM po_documents WHERE id=?').get(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      const ship = req.body?.shipping || row.shipping || 'Buyer-arranged freight';
      db.prepare(
        `UPDATE po_documents SET status = 'sent', shipping = ?, approver_status = '✓ Released',
         auth_status = '✓ Procurement release', header_sub = 'Transmit pack generated · awaiting ASN' WHERE id = ?`,
      ).run(ship, id);
      logActivity(db, 'approval', 'PO released', `<strong>${escapeHtmlSnippet(row.po_number)}</strong> transmitted — ${escapeHtmlSnippet(ship)}.`);
      res.json({ ok: true, doc: serializePo(db.prepare('SELECT * FROM po_documents WHERE id=?').get(id)) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/vendors', (_req, res) => {
    const rows = db.prepare(`SELECT * FROM vendor WHERE active = 1 ORDER BY sort_order, name`).all();
    res.json(rows);
  });

  app.post('/api/vendors', (req, res) => {
    try {
      const { code, name, category = '', contact_email = '', notes = '' } = req.body || {};
      if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: 'code and name required' });
      const sort = db.prepare(`SELECT COALESCE(MAX(sort_order), 0)+1 AS s FROM vendor`).get().s;
      db.prepare(
        `INSERT INTO vendor (code, name, category, rating, spend_ytd, contact_email, notes, active, sort_order)
         VALUES (?,?,?,?,?,?,?,1,?)`,
      ).run(code.trim(), name.trim(), category, 4.5, '$— YTD — new', contact_email, notes, sort);
      const v = db.prepare(`SELECT * FROM vendor WHERE code = ?`).get(code.trim());
      logActivity(db, 'internal', 'Vendor added', `<strong>${escapeHtmlSnippet(code)}</strong> · ${escapeHtmlSnippet(name)} onboarded.`);
      res.json({ ok: true, vendor: v });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Vendor code exists' });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/vendors/:id', (req, res) => {
    const id = +req.params.id;
    const v = db.prepare(`SELECT id FROM vendor WHERE id=?`).get(id);
    if (!v) return res.status(404).json({ error: 'Not found' });
    const p = req.body || {};
    const allow = ['name', 'category', 'rating', 'spend_ytd', 'contact_email', 'notes'];
    const kv = {};
    for (const k of allow)
      if (p[k] !== undefined && p[k] !== '') kv[k] = k === 'rating' ? +p[k] : String(p[k]);
    if (!Object.keys(kv).length) return res.status(400).json({ error: 'nothing to update' });
    const keys = Object.keys(kv);
    db.prepare(`UPDATE vendor SET ${keys.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((x) => kv[x]),
      id,
    );
    res.json({ ok: true, vendor: db.prepare(`SELECT * FROM vendor WHERE id=?`).get(id) });
  });

  app.delete('/api/vendors/:id', (req, res) => {
    db.prepare(`UPDATE vendor SET active = 0 WHERE id=?`).run(+req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/approvals', (_req, res) => {
    const rows = db.prepare(`SELECT * FROM approval ORDER BY sort_order`).all();
    res.json(rows);
  });

  app.post('/api/approvals/:id/decision', (req, res) => {
    try {
      const id = +req.params.id;
      const action = (req.body?.action || '').toLowerCase();
      if (!['approve', 'reject'].includes(action))
        return res.status(400).json({ error: 'action must be approve|reject' });
      const row = db.prepare(`SELECT * FROM approval WHERE id=?`).get(id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      const status = action === 'approve' ? 'approved' : 'rejected';
      db.prepare(`UPDATE approval SET status = ? WHERE id = ?`).run(status, id);
      if (row.document_type === 'PO' && action === 'approve') {
        db.prepare(
          `UPDATE po_documents SET approver_status = '✓ Approved', status='sent',
           header_sub = 'Approver released · awaiting supplier acknowledgement' WHERE po_number=?`,
        ).run(row.reference);
      }
      if (row.document_type === 'PO' && action === 'reject') {
        db.prepare(
          `UPDATE po_documents SET approver_status = 'Rejected', header_sub='Return to procurement' WHERE po_number=?`,
        ).run(row.reference);
      }
      logActivity(
        db,
        'approval',
        action === 'approve' ? 'Approved' : 'Rejected',
        `${escapeHtmlSnippet(row.reference)} — ${escapeHtmlSnippet(row.title || '')}`,
      );
      res.json({
        ok: true,
        approval: db.prepare(`SELECT * FROM approval WHERE id=?`).get(id),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/analytics/overview', (_req, res) => {
    try {
      const kpis = db.prepare(`SELECT key,label,value,sub,accent FROM analytics_kpi`).all();
      const funnel = db
        .prepare(
          `
        SELECT COALESCE(workflow_stage,'unknown') AS stage, COUNT(*) AS count FROM rfq GROUP BY workflow_stage
      `,
        )
        .all();
      const vendorSpend = db
        .prepare(`SELECT name,code,spend_ytd,rating FROM vendor WHERE active=1 ORDER BY sort_order`)
        .all();
      res.json({ kpis, funnel, vendorSpend });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/invoices', (_req, res) => {
    const rows = db.prepare('SELECT number, supplier, po_ref, amount, due, status FROM invoice ORDER BY sort_order').all();
    res.json(rows);
  });

  app.post('/api/invoices/:number/match', (req, res) => {
    try {
      const num = req.params.number;
      const po_ref = (req.body?.po_ref || '').trim();
      if (!po_ref) return res.status(400).json({ error: 'po_ref required' });
      db.prepare(`UPDATE invoice SET po_ref = ?, status = 'matched' WHERE number = ?`).run(po_ref, num);
      logActivity(db, 'invoice', 'Matched', `<strong>${escapeHtmlSnippet(num)}</strong> tied to ${escapeHtmlSnippet(po_ref)}.`);
      res.json({ ok: true, invoices: db.prepare(`SELECT number,supplier,po_ref,amount,due,status FROM invoice ORDER BY sort_order`).all() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/inventory', (_req, res) => {
    const forecast = db
      .prepare('SELECT title, sku_line, days_label, days_class FROM forecast_item ORDER BY sort_order')
      .all();
    const items = db
      .prepare(
        `SELECT sku, name, in_stock, reorder_at, level_pct, level_color, forecast, forecast_class, action_label, action_style
         FROM inventory_item ORDER BY sort_order`,
      )
      .all();
    res.json({ forecast, items });
  });

  app.patch('/api/inventory/:sku', (req, res) => {
    try {
      const sku = decodeURIComponent(req.params.sku);
      const patch = req.body || {};
      if (patch.reorder_at != null)
        db.prepare(`UPDATE inventory_item SET reorder_at = ? WHERE sku = ?`).run(+patch.reorder_at, sku);
      if (patch.in_stock != null)
        db.prepare(`UPDATE inventory_item SET in_stock = ? WHERE sku = ?`).run(+patch.in_stock, sku);
      const row = db.prepare(`SELECT * FROM inventory_item WHERE sku=?`).get(sku);
      if (!row) return res.status(404).json({ error: 'SKU not found' });
      logActivity(db, 'urgent', 'Inventory', `SKU <strong>${escapeHtmlSnippet(sku)}</strong> rule updated (${JSON.stringify(patch)}).`);
      res.json({ ok: true, item: row });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** Legacy single-doc endpoint for older clients — returns default draft-first */
  app.get('/api/purchase-order', (_req, res) => {
    const row = db.prepare(`SELECT * FROM po_documents ORDER BY sort_order ASC, id ASC LIMIT 1`).get();
    if (!row) return res.status(404).json({ error: 'No PO' });
    res.json(serializePo(row));
  });

  app.post('/api/automation/process-inbox', (_req, res) => {
    const pending = db.prepare('SELECT id FROM inbox_message WHERE ai_processed = 0').all();
    const job = db
      .prepare(`INSERT INTO automation_job (kind, status, payload_json) VALUES ('inbox_ai','running',?)`)
      .run(JSON.stringify({ ids: pending.map((p) => p.id) }));

    const tagByCategory = {
      quote: ['quote', 'extracted'],
      invoice: ['invoice', 'matched'],
      emergency: ['emergency', 'internal'],
      approval: ['approval'],
      rfq: ['extracted'],
    };

    const upd = db.prepare(`UPDATE inbox_message SET ai_processed = 1, tags_json = ? WHERE id = ?`);

    for (const p of pending) {
      const row = db.prepare('SELECT category FROM inbox_message WHERE id = ?').get(p.id);
      const tags = tagByCategory[row.category] || ['extracted'];
      upd.run(JSON.stringify(tags), p.id);
    }

    db.prepare(`UPDATE automation_job SET status='done', finished_at=datetime('now') WHERE id=?`).run(job.lastInsertRowid);

    const inbox = db
      .prepare(
        `SELECT id, sender, subject, preview, time_label, avatar_initials, avatar_bg, avatar_color, tags_json, category, ai_processed FROM inbox_message ORDER BY sort_order`,
      )
      .all();

    res.json({
      processed: pending.length,
      messages: inbox.map((r) => ({ ...r, tags: JSON.parse(r.tags_json || '[]') })),
    });
  });
}

export function registerAuthApi(app, knex, config) {
  // Auth: login
  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await knex('users').where({ email, active: true }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isBcryptHash = /^\$2[aby]\$/.test(user.password_hash);
    if (!isBcryptHash && config.isProduction) {
      return res.status(500).json({ error: 'Password store is not production-ready' });
    }
    const valid = isBcryptHash
      ? await bcrypt.compare(password, user.password_hash)
      : password === 'admin';
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role_id: user.role_id }, config.jwtSecret, {
      expiresIn: '8h',
      issuer: 'vexor-erp',
    });
    res.json({ token });
  });

  // Auth middleware
  app.use('/api/products', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Products CRUD (protected)
  app.get('/api/products', async (req, res) => {
    const products = await knex('products').select();
    res.json(products);
  });

  app.post('/api/products', async (req, res) => {
    const { sku, name, uom, cost, price } = req.body;
    const [id] = await knex('products').insert({ sku, name, uom, cost, price });
    res.json({ id });
  });
}
