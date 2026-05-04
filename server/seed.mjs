import { db, dbPath, migrate } from './db.mjs';

migrate();

db.exec(`
  DELETE FROM tenant;
  DELETE FROM dashboard_meta;
  DELETE FROM stat_snapshot;
  DELETE FROM activity;
  DELETE FROM stock_row;
  DELETE FROM inbox_message;
  DELETE FROM rfq;
  DELETE FROM quote_compare;
  DELETE FROM purchase_order;
  DELETE FROM po_documents;
  DELETE FROM invoice;
  DELETE FROM inventory_item;
  DELETE FROM forecast_item;
  DELETE FROM automation_job;
  DELETE FROM vendor;
  DELETE FROM approval;
  DELETE FROM analytics_kpi;
`);

db.prepare(`INSERT INTO tenant (id, name, wordmark) VALUES (1, 'Acme Retail Co.', 'VEXOR')`).run();

db.prepare(`
  INSERT INTO dashboard_meta (id, greeting, user_name, subtitle) VALUES (1, 'Good morning', 'Sarah', '')
`).run();

db.prepare(`
  INSERT INTO stat_snapshot (id, open_rfqs, open_rfqs_sub, pending_pos, pending_pos_sub, invoices_due, invoices_sub, month_spend, month_spend_sub)
  VALUES (1, 14, '↑ 3 new today', 7, '2 need approval', '$91K', '↓ 3 overdue', '$328K', '↑ 9% vs last mo')
`).run();

const activities = [
  ['extracted', 'AI Extracted', 'Quote from <strong>Global Steel Inc.</strong> — RFQ-2024-089 · 3 items', '2 min ago', 0],
  ['approval', 'Approval', '<strong>PO-2024-0234</strong> approved by Mark Chen, auto-submitted', '22 min ago', 1],
  ['urgent', 'Low Stock', '<strong>SKU-4421</strong> Industrial Bearings — 8 units, threshold 15', '1 hr ago', 2],
  ['emergency', 'Emergency', 'Warehouse — Line 3 down, needs 50x bearings ASAP', '2 hr ago', 3],
];
const insAct = db.prepare('INSERT INTO activity (tag_class, tag_label, description_html, time_label, sort_order) VALUES (?,?,?,?,?)');
activities.forEach((r) => insAct.run(...r));

const stocks = [
  ['SKU-4421', 'Industrial Bearings', 8, 27, 'var(--danger)', 'crit', 0],
  ['SKU-2211', 'Oil Filter HF-204', 12, 40, 'var(--accent)', 'warn', 1],
  ['SKU-3301', 'Shaft Seal 40x55', 19, 52, 'var(--accent)', 'warn', 2],
  ['SKU-0889', 'Hex Bolt M12×50', 240, 88, 'var(--brand)', '', 3],
];
const insStock = db.prepare(
  'INSERT INTO stock_row (sku, name, count, fill_pct, fill_color, count_class, sort_order) VALUES (?,?,?,?,?,?,?)'
);
stocks.forEach((r) => insStock.run(...r));

const inboxRows = [
  ['Global Steel Inc.', 'Re: RFQ-2024-089 — Steel Coil Quote', 'Please find attached our competitive pricing for 500kg HR + 400kg CR coils…', '10:24', 'GS', 'var(--info-light)', 'var(--info)', JSON.stringify(['quote', 'urgent', 'extracted']), 'quote', 1, 0],
  ['Precision Parts Ltd.', 'Invoice #INV-8821 — Due May 30', 'Attached invoice for PO-2024-0221. Payment terms Net 30…', '9:15', 'PP', 'var(--accent-light)', 'var(--accent)', JSON.stringify(['invoice', 'matched']), 'invoice', 1, 1],
  ['Warehouse (Internal)', 'URGENT: Line 3 down — need bearings', '50 units SKU-4421 needed immediately, production halted…', '8:47', 'WH', 'var(--danger-light)', 'var(--danger)', JSON.stringify(['emergency', 'internal']), 'emergency', 1, 2],
  ['Allied Metals Corp.', 'Updated Quote — RFQ-2024-089', 'Following our previous quote, we can offer improved terms…', 'Yesterday', 'AM', '#f0e8ff', '#534AB7', JSON.stringify(['quote', 'extracted']), 'quote', 1, 3],
  ['Mark Chen (CFO)', 'Approval: PO-2024-0234 ($42,500)', 'Please review the attached purchase order before Friday…', 'Yesterday', 'MC', 'var(--success-light)', 'var(--success)', JSON.stringify(['approval']), 'approval', 0, 4],
  ['Planning Dept.', 'RFQ draft: Hydraulic fittings Q2 restock', 'Please publish RFQ-2024-092 to Tier-1 hydraulic vendors…', 'Yesterday', 'PD', '#EDE9FE', '#4F35E8', JSON.stringify(['internal', 'extracted']), 'rfq', 1, 5],
];
const insInbox = db.prepare(`
  INSERT INTO inbox_message (sender, subject, preview, time_label, avatar_initials, avatar_bg, avatar_color, tags_json, category, ai_processed, sort_order)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`);
inboxRows.forEach((r) => insInbox.run(...r));

const linesMain = JSON.stringify([
  { num: 1, code: 'SC2024-A', desc: 'Hot Rolled Steel Coil, 2mm, Grade A36', qty: '500', unit: 'kg', price: '$42.50', total: '$21,250.00' },
  { num: 2, code: 'SC2024-B', desc: 'Cold Rolled Steel Coil, 1.5mm, Grade 1008', qty: '400', unit: 'kg', price: '$43.00', total: '$17,200.00' },
]);

const pipelines = [
  ['RFQ-2024-089', 'Steel Coils — 500kg HR + 400kg CR', JSON.stringify([
    { label: 'RFQ Sent', state: 'done' }, { label: 'Quotes In', state: 'done' }, { label: 'Compared', state: 'done' },
    { label: 'PO Draft', state: 'active' }, { label: 'Approved', state: '' }, { label: 'Payment', state: '' },
  ]), 'Awaiting CFO approval', 'pending', 'View quotes →', 'quotes', 'pending_po', 0],
  ['RFQ-2024-087', 'Industrial Bearings — 6204 Series × 200 units', JSON.stringify([
    { label: 'RFQ Sent', state: 'done' }, { label: 'Quotes In', state: 'active' }, { label: 'Compare', state: '' },
    { label: 'PO Draft', state: '' }, { label: 'Approved', state: '' }, { label: 'Payment', state: '' },
  ]), '3 quotes received', 'pending', 'Compare now →', '', 'awaiting_quotes', 1],
  ['EMG-2024-014', 'Emergency Order — Line 3 Bearings × 50 units', JSON.stringify([
    { label: 'Requested', state: 'done' }, { label: 'PO Draft', state: 'active' }, { label: 'Approval', state: '' }, { label: 'Sent', state: '' },
  ]), '⚡ Emergency', 'emg', 'Create PO →', 'po', 'emergency', 2],
  ['RFQ-2024-085', 'MRO Supplies — Q2 Restock (12 SKUs)', JSON.stringify([
    { label: 'RFQ Sent', state: 'done' }, { label: 'Quotes In', state: 'done' }, { label: 'Compared', state: 'done' },
    { label: 'PO Draft', state: 'done' }, { label: 'Approved', state: 'done' }, { label: 'Payment', state: 'active' },
  ]), '✓ PO sent · awaiting delivery', 'success', 'Track →', '', 'fulfilled', 3],
];
const insRfq = db.prepare(`
  INSERT INTO rfq (code, title, pipeline_json, badge_text, badge_kind, meta_button_label, meta_nav, workflow_stage, sort_order)
  VALUES (?,?,?,?,?,?,?,?,?)
`);
pipelines.forEach((r) => insRfq.run(...r));

const criteria = [
  ['Total price', '$41,200.00', '$38,450.00', '$39,900.00', 'winner'],
  ['Lead time', '21 days', '14 days', '18 days', 'winner'],
  ['Payment terms', 'Net 30', 'Net 30', 'Net 45', 'tie'],
  ['HR Coil / kg', '$44.20', '$42.50', '$43.80', 'winner'],
  ['CR Coil / kg', '$45.00', '$43.00', '$43.50', 'winner'],
  ['Overall score', '71', '94', '80', 'scores'],
];

db.prepare(`
  INSERT INTO quote_compare (id, rfq_code, subtitle, winner_line, criteria_json, vendors_json)
  VALUES (1, 'RFQ-2024-089 · Steel Coil', '3 quotes received · Winner selected',
    '★ Winner: Global Steel Inc. · Score 94/100',
    ?, ?
)`).run(JSON.stringify(criteria), JSON.stringify(['Allied Metals Corp.', 'Global Steel Inc.', 'Midwest Supply Co.']));

const insPoDoc = db.prepare(`
  INSERT INTO po_documents (
    status, header_title, header_sub, po_number, po_date, rfq_ref,
    buyer_company, buyer_address, vendor_name, vendor_detail, ship_name, ship_detail,
    lines_json, subtotal, tax, shipping, total,
    auth_name, auth_status, approver_name, approver_status, sort_order
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

insPoDoc.run(
  'pending_approval',
  'Draft PO-2024-0235 — Auto-generated',
  'from RFQ-2024-089 · Awaiting approval',
  'PO-2024-0235',
  'April 29, 2026',
  'RFQ-2024-089',
  'ACME RETAIL CO.',
  '1400 Commerce Blvd, Chicago, IL 60601<br>procurement@acmeco.com',
  'Global Steel Inc.',
  'Sarah Wong, Account Manager<br>800 Steel Ave, Gary, IN 46401<br>swong@globalsteel.com',
  'Acme Retail Co.',
  'Receiving Dept — Dock B<br>1400 Commerce Blvd<br>Chicago, IL 60601',
  linesMain,
  '$38,450.00',
  '$0.00',
  'TBD',
  '$38,450.00',
  'Sarah Martinez',
  '✓ Procurement Manager',
  'Mark Chen, CFO',
  '⏳ Pending approval',
  0,
);

insPoDoc.run(
  'sent',
  'PO-2024-0234 · Sent to supplier',
  'Industrial bearings shipment · Released',
  'PO-2024-0234',
  'April 12, 2026',
  'RFQ-2024-080',
  'ACME RETAIL CO.',
  '1400 Commerce Blvd, Chicago, IL 60601<br>procurement@acmeco.com',
  'Precision Parts Ltd.',
  'AP Dept<br>PO Box 92, Toledo, OH 43604<br>ap@precisionparts.example.com',
  'Acme Retail Co.',
  'Receiving Dept — Dock A<br>1400 Commerce Blvd<br>Chicago, IL 60601',
  JSON.stringify([
    { num: 1, code: 'BR-6204', desc: 'Bearing 6204 sealed × 220', qty: '220', unit: 'ea', price: '$18.40', total: '$4,048.00' },
  ]),
  '$4,048.00',
  '$485.76',
  'Freight prepaid',
  '$4,533.76',
  'Sarah Martinez',
  '✓ Procurement Manager',
  'Mark Chen, CFO',
  '✓ Approved Apr 14',
  1,
);

insPoDoc.run(
  'draft',
  'Draft PO-2024-0236 · MRO batch',
  'Awaiting vendor confirmation',
  'PO-2024-0236',
  'April 28, 2026',
  'RFQ-2024-085',
  'ACME RETAIL CO.',
  '1400 Commerce Blvd, Chicago, IL 60601<br>procurement@acmeco.com',
  'Midwest Supply Co.',
  'Orders desk<br>220 Logistics Way<br>Milwaukee, WI 53201',
  'Acme Retail Co.',
  'MRO Cage — Door 4<br>1400 Commerce Blvd<br>Chicago, IL 60601',
  JSON.stringify([
    { num: 1, code: 'MRO-Q2', desc: 'MRO Supplies bundle (estimated)', qty: '1', unit: 'lot', price: '$12,900.00', total: '$12,900.00' },
  ]),
  '$12,900.00',
  '$1,548.00',
  'Quoted',
  '$14,448.00',
  'Sarah Martinez',
  '⏳ Draft',
  'Mark Chen, CFO',
  'Pending review',
  2,
);

const invs = [
  ['INV-8821', 'Precision Parts Ltd.', 'PO-2024-0221', '$12,400', 'May 30', 'matched', 0],
  ['INV-8819', 'Allied Metals Corp.', 'PO-2024-0218', '$29,100', 'Apr 15 ⚠', 'overdue', 1],
  ['INV-8817', 'Global Steel Inc.', 'PO-2024-0215', '$41,200', 'Apr 10 ⚠', 'overdue', 2],
  ['INV-8815', 'Midwest Supply Co.', '—', '$8,750', 'May 15', 'unmatched', 3],
  ['INV-8812', 'Precision Parts Ltd.', 'PO-2024-0210', '$5,300', 'Jun 01', 'matched', 4],
];
const insInv = db.prepare(
  'INSERT INTO invoice (number, supplier, po_ref, amount, due, status, sort_order) VALUES (?,?,?,?,?,?,?)'
);
invs.forEach((r) => insInv.run(...r));

const forecasts = [
  ['Industrial Bearings 6204', 'SKU-4421 · 8 in stock · threshold 15', '2 days', 'crit', 0],
  ['Oil Filter HF-204', 'SKU-2211 · 12 in stock · threshold 20', '5 days', 'warn', 1],
  ['Shaft Seal 40×55×8', 'SKU-3301 · 19 in stock · threshold 25', '8 days', 'warn', 2],
  ['Hex Bolt M12×50', 'SKU-0889 · 240 in stock · threshold 50', '45+ days', 'ok', 3],
];
const insFc = db.prepare(
  'INSERT INTO forecast_item (title, sku_line, days_label, days_class, sort_order) VALUES (?,?,?,?,?)'
);
forecasts.forEach((r) => insFc.run(...r));

const invItems = [
  ['SKU-4421', 'Industrial Bearings 6204', 8, 15, 27, 'var(--danger)', 'Runs out in 2 days', 'crit', '⚡ Auto-RFQ', 'danger', 0],
  ['SKU-2211', 'Oil Filter HF-204', 12, 20, 40, 'var(--accent)', 'Runs out in 5 days', 'warn', 'Draft RFQ', '', 1],
  ['SKU-3301', 'Shaft Seal 40×55×8', 19, 25, 52, 'var(--accent)', 'Runs out in 8 days', 'warn', 'Draft RFQ', '', 2],
  ['SKU-0889', 'Hex Bolt M12×50', 240, 50, 88, 'var(--brand)', 'OK for 45+ days', 'ok', 'Monitor', '', 3],
  ['SKU-1102', 'V-Belt A42', 55, 10, 80, 'var(--brand)', 'OK for 30+ days', 'ok', 'Monitor', '', 4],
];
const insIi = db.prepare(`
  INSERT INTO inventory_item (sku, name, in_stock, reorder_at, level_pct, level_color, forecast, forecast_class, action_label, action_style, sort_order)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`);
invItems.forEach((r) => insIi.run(...r));

const vendors = [
  ['GSI', 'Global Steel Inc.', 'Raw materials', 4.8, '$412K YTD', 'swong@globalsteel.com', 'Primary steel coils', 0],
  ['PPL', 'Precision Parts Ltd.', 'Precision MRO', 4.6, '$186K YTD', 'sales@precisionparts.example.com', 'Bearings vendor of record', 1],
  ['AMA', 'Allied Metals Corp.', 'Raw materials', 4.4, '$121K YTD', 'ops@alliedmetals.example.com', '', 2],
  ['MWS', 'Midwest Supply Co.', 'MRO consolidated', 4.7, '$95K YTD', 'orders@midwest.example.com', 'Multi-SKU pallets', 3],
];
const insVend = db.prepare(
  `INSERT INTO vendor (code, name, category, rating, spend_ytd, contact_email, notes, sort_order)
   VALUES (?,?,?,?,?,?,?,?)`
);
vendors.forEach((r) => insVend.run(...r));

const appr = [
  ['PO', 'PO-2024-0235', 'Steel coils — RFQ-2024-089', '$38,450', 'Sarah Martinez', 'pending', 'CFO review required · Net 30', 0],
  ['PO', 'PO-2024-0236', 'MRO batch — Midwest Supply', '$14,448', 'Sarah Martinez', 'pending', 'Verify tax jurisdiction', 1],
];
const insAppr = db.prepare(
  `INSERT INTO approval (document_type, reference, title, amount, requester, status, notes, sort_order)
   VALUES (?,?,?,?,?,?,?,?)`
);
appr.forEach((r) => insAppr.run(...r));

const kpis = [
  ['mtd_spend', 'Month spend (est.)', '$328K', '+9% vs last month', 'warn'],
  ['cycle_days', 'RFQ→PO avg', '18 days', 'Goal < 21 days · on track', 'up'],
  ['match_rate', 'Invoice PO match rate', '91%', '6 open exceptions', 'neutral'],
  ['active_vendors', 'Active vendors · rated', '4', 'Spend linked to Tier-1', 'ok'],
];

const insKpi = db.prepare(`INSERT INTO analytics_kpi (key, label, value, sub, accent) VALUES (?,?,?,?,?)`);
kpis.forEach((row) => insKpi.run(...row));

console.log('Seed complete:', dbPath);
