export type NavKey =
  | 'dashboard'
  | 'inbox'
  | 'rfx'
  | 'quotes'
  | 'requisitions'
  | 'po'
  | 'po_transfer'
  | 'sales_orders'
  | 'receiving'
  | 'invoices'
  | 'approvals'
  | 'vendors'
  | 'vendor_items'
  | 'catalog_items'
  | 'inventory'
  | 'contracts'
  | 'analytics';

export type ScreenMeta = { title: string; sub: string };

export type Bootstrap = {
  tenant: { name: string; wordmark: string };
  stats: Record<string, string | number>;
  badges: { inbox: number; rfx: number; invoices: number; approvals: number };
  screens: Partial<Record<NavKey, ScreenMeta>>;
};

export type ActivityRow = {
  tag_class: string;
  tag_label: string;
  description_html: string;
  time_label: string;
};

export type StockRow = {
  sku: string;
  name: string;
  count: number | string;
  fill_pct: number;
  fill_color: string;
  count_class?: string;
};

export type InboxMessage = {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  time_label: string;
  avatar_initials: string;
  avatar_bg: string;
  avatar_color: string;
  tags: string[];
  category: string;
};

export type RfqRow = {
  code: string;
  title: string;
  pipeline: { label: string; state: string }[];
  badge_text: string;
  badge_kind: string;
  meta_button_label: string | null;
  meta_nav: string | null;
  workflow_stage?: string;
};

export type QuoteCriterionRow = [string, string, string, string, string];

export type QuoteCompare = {
  rfq_code: string;
  subtitle: string;
  winner_line: string;
  criteria: QuoteCriterionRow[];
  vendors: string[];
};

export type PoSummary = {
  id: number;
  po_number: string;
  status: string;
  vendor_name: string | null;
  total: string;
  header_sub?: string;
};

export type PoDocument = {
  header_title?: string;
  header_sub?: string;
  status?: string;
  buyer_company?: string;
  buyer_address?: string;
  po_number?: string;
  po_date?: string;
  rfq_ref?: string;
  vendor_name?: string;
  vendor_detail?: string;
  ship_name?: string;
  ship_detail?: string;
  lines?: {
    num: number | string;
    code: string;
    desc: string;
    qty: string;
    unit: string;
    price: string;
    total: string;
  }[];
  subtotal?: string;
  tax?: string;
  shipping?: string;
  total?: string;
  auth_name?: string;
  auth_status?: string;
  approver_name?: string;
  approver_status?: string;
};

export type InvoiceRow = {
  number: string;
  supplier: string;
  po_ref: string;
  amount: string;
  due: string;
  status: string;
};

export type ForecastRow = {
  title: string;
  sku_line: string;
  days_label: string;
  days_class: string;
};

export type InventoryItem = {
  sku: string;
  name: string;
  in_stock: number | string;
  reorder_at: number | string;
  level_pct: number;
  level_color: string;
  forecast: string;
  forecast_class: string;
  action_label: string;
  action_style: string;
};

export type VendorRow = {
  id: number;
  code: string;
  name: string;
  category: string;
  rating: number;
  spend_ytd: string;
  notes?: string;
};

export type ApprovalRow = {
  id: number;
  document_type: string;
  reference: string;
  title: string;
  amount: string;
  requester: string;
  status: string;
};

export type AnalyticsOverview = {
  kpis: { key?: string; label: string; value: string; sub: string; accent?: string }[];
  funnel: { stage: string; count: number }[];
  vendorSpend: { name: string; code: string; spend_ytd: string; rating: number | null }[];
};

export type SearchHit = { id: string; title: string; type: string };

export type SearchResponse = {
  rfqs: SearchHit[];
  inbox: SearchHit[];
  invoices: SearchHit[];
  vendors: SearchHit[];
};

export type ModalField = {
  key: string;
  label: string;
  value?: string;
  placeholder?: string;
  large?: boolean;
};
