import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'vexor.sqlite');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function columnExists(table, col) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === col);
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenant (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      wordmark TEXT DEFAULT 'VEXOR'
    );
    CREATE TABLE IF NOT EXISTS dashboard_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      greeting TEXT,
      user_name TEXT,
      subtitle TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS stat_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      open_rfqs INTEGER,
      open_rfqs_sub TEXT,
      pending_pos INTEGER,
      pending_pos_sub TEXT,
      invoices_due TEXT,
      invoices_sub TEXT,
      month_spend TEXT,
      month_spend_sub TEXT
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_class TEXT,
      tag_label TEXT,
      description_html TEXT NOT NULL,
      time_label TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stock_row (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT,
      name TEXT,
      count INTEGER,
      fill_pct INTEGER,
      fill_color TEXT,
      count_class TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inbox_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      subject TEXT,
      preview TEXT,
      time_label TEXT,
      avatar_initials TEXT,
      avatar_bg TEXT,
      avatar_color TEXT,
      tags_json TEXT,
      category TEXT,
      ai_processed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rfq (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      title TEXT,
      pipeline_json TEXT,
      badge_text TEXT,
      badge_kind TEXT,
      meta_button_label TEXT,
      meta_nav TEXT,
      workflow_stage TEXT DEFAULT 'open',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quote_compare (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      rfq_code TEXT,
      subtitle TEXT,
      winner_line TEXT,
      criteria_json TEXT,
      vendors_json TEXT
    );
    CREATE TABLE IF NOT EXISTS purchase_order (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      header_title TEXT,
      header_sub TEXT,
      po_number TEXT,
      po_date TEXT,
      rfq_ref TEXT,
      buyer_company TEXT,
      buyer_address TEXT,
      vendor_name TEXT,
      vendor_detail TEXT,
      ship_name TEXT,
      ship_detail TEXT,
      lines_json TEXT,
      subtotal TEXT,
      tax TEXT,
      shipping TEXT,
      total TEXT,
      auth_name TEXT,
      auth_status TEXT,
      approver_name TEXT,
      approver_status TEXT
    );
    CREATE TABLE IF NOT EXISTS po_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'draft',
      header_title TEXT,
      header_sub TEXT,
      po_number TEXT UNIQUE NOT NULL,
      po_date TEXT,
      rfq_ref TEXT,
      buyer_company TEXT,
      buyer_address TEXT,
      vendor_name TEXT,
      vendor_detail TEXT,
      ship_name TEXT,
      ship_detail TEXT,
      lines_json TEXT,
      subtotal TEXT,
      tax TEXT,
      shipping TEXT,
      total TEXT,
      auth_name TEXT,
      auth_status TEXT,
      approver_name TEXT,
      approver_status TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS invoice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT,
      supplier TEXT,
      po_ref TEXT,
      amount TEXT,
      due TEXT,
      status TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inventory_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT,
      in_stock INTEGER,
      reorder_at INTEGER,
      level_pct INTEGER,
      level_color TEXT,
      forecast TEXT,
      forecast_class TEXT,
      action_label TEXT,
      action_style TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS forecast_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      sku_line TEXT,
      days_label TEXT,
      days_class TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS automation_job (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT,
      status TEXT,
      payload_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT
    );
    CREATE TABLE IF NOT EXISTS vendor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      rating REAL DEFAULT 4.5,
      spend_ytd TEXT,
      contact_email TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS approval (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT,
      reference TEXT,
      title TEXT,
      amount TEXT,
      requester TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS analytics_kpi (
      key TEXT PRIMARY KEY,
      label TEXT,
      value TEXT,
      sub TEXT,
      accent TEXT
    );
  `);

  if (!columnExists('rfq', 'workflow_stage')) {
    try {
      db.exec('ALTER TABLE rfq ADD COLUMN workflow_stage TEXT DEFAULT ' + "'open'");
    } catch {
      /* ignore */
    }
  }
}

migrate();

export { db, dbPath };
