import type { NavKey } from './types';
import { PlaceholderModuleScreen } from './ScreenViews';

type ModuleCfg = { screenId: string; title: string; description: string; bullets?: string[] };

const MODULES: Record<
  | 'requisitions'
  | 'po_transfer'
  | 'sales_orders'
  | 'receiving'
  | 'vendor_items'
  | 'catalog_items'
  | 'contracts',
  ModuleCfg
> = {
  requisitions: {
    screenId: 'screen-requisitions',
    title: 'Requisitions (REQ)',
    description:
      'Purchase requisitions before sourcing: departmental requests, project spends, and catalog lines pending approval.',
    bullets: [
      'REQ intake, approval chains, and budget / commodity checks',
      'Convert approved REQ to RFQ or draft PO',
      'Track draft → submitted → approved → sourced → ordered',
    ],
  },
  po_transfer: {
    screenId: 'screen-po-transfer',
    title: 'PO transfer',
    description:
      'Transfer open purchase orders or lines between entities, sites, or cost centers while preserving RFQ, receipt, and invoice linkage.',
    bullets: ['Source / destination acknowledgement', 'Audit trail and dual signatures where required'],
  },
  sales_orders: {
    screenId: 'screen-sales-orders',
    title: 'Sales orders',
    description:
      'Customer orders that drive supply: drop-ship, back-to-back buys, and ATP visibility for procurement.',
    bullets: ['SO lines tied to allocation and PO suggestions', 'Link outbound demand to inbound PO or transfer'],
  },
  receiving: {
    screenId: 'screen-receiving',
    title: 'Receiving',
    description:
      'Goods receipt against PO and ASN — the operational bridge to inventory updates and three-way match.',
    bullets: ['ASN matching, partial receipts, discrepancies, putaway tasks'],
  },
  vendor_items: {
    screenId: 'screen-vendor-items',
    title: 'Vendor items',
    description:
      'Vendor-specific catalog data: supplier part numbers, pack quantities, lead times, and contracted prices mapped to your item master.',
    bullets: ['Vendor SKU ↔ internal item mapping', 'Price breaks, effective dates, min order qty'],
  },
  catalog_items: {
    screenId: 'screen-catalog-items',
    title: 'Catalog items',
    description:
      'Enterprise item master used across requisitions and POs: descriptions, categories, attributes, and default sourcing.',
    bullets: ['Commodity codes, inspection flags, preferred vendors', 'Revision and lifecycle status'],
  },
  contracts: {
    screenId: 'screen-contracts',
    title: 'Contracts',
    description:
      'Supplier agreements and blanket orders that constrain RFQ responses and PO pricing.',
    bullets: ['Spend against contract, tiers, expiry and renewal workflow'],
  },
};

const ORDER = [
  'requisitions',
  'po_transfer',
  'sales_orders',
  'receiving',
  'vendor_items',
  'catalog_items',
  'contracts',
] as const;

/** Placeholder screens for procurement modules until APIs are wired. */
export function ProcurementPlaceholderScreens({ nav }: { nav: NavKey }) {
  return (
    <>
      {ORDER.map((key) => (
        <PlaceholderModuleScreen key={key} active={nav === key} {...MODULES[key]} />
      ))}
    </>
  );
}
