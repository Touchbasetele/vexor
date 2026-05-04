import { escapeHtml } from './escape';
import type { PoDocument } from './types';

export function PoDocumentView({ po }: { po: PoDocument }) {
  const trusted = (h: string | undefined) => ({ __html: h ?? '' });

  const lines = po.lines || [];

  return (
    <div className="po-doc">
      <div className="po-header">
        <div>
          <div className="po-company">{escapeHtml(po.buyer_company)}</div>
          <div className="po-address" dangerouslySetInnerHTML={trusted(po.buyer_address)} />
        </div>
        <div className="po-title-block">
          <div className="po-title">Purchase Order</div>
          <div className="po-num">{escapeHtml(po.po_number)}</div>
          <div className="po-meta">
            Date: {escapeHtml(po.po_date)}
            <br />
            RFQ: {escapeHtml(po.rfq_ref || '—')}
          </div>
        </div>
      </div>
      <div className="po-parties">
        <div>
          <div className="po-party-label">Vendor</div>
          <div className="po-party-name">{escapeHtml(po.vendor_name || '(set vendor)')}</div>
          <div className="po-party-detail" dangerouslySetInnerHTML={trusted(po.vendor_detail)} />
        </div>
        <div>
          <div className="po-party-label">Ship To</div>
          <div className="po-party-name">{escapeHtml(po.ship_name || '')}</div>
          <div className="po-party-detail" dangerouslySetInnerHTML={trusted(po.ship_detail)} />
        </div>
      </div>
      <table className="po-line-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln, i) => (
            <tr key={i}>
              <td>{escapeHtml(String(ln.num))}</td>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{escapeHtml(ln.code)}</td>
              <td>{escapeHtml(ln.desc)}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(ln.qty)}</td>
              <td>{escapeHtml(ln.unit)}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(ln.price)}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(ln.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="po-totals">
        <div className="total-row">
          <span>Subtotal</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(po.subtotal)}</span>
        </div>
        <div className="total-row">
          <span>Tax</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(po.tax)}</span>
        </div>
        <div className="total-row">
          <span>Shipping</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(po.shipping)}</span>
        </div>
        <div className="total-row grand">
          <span>Total</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{escapeHtml(po.total)}</span>
        </div>
      </div>
      <div className="po-footer">
        <div>
          <div className="sig-label">Authorized by</div>
          <div className="sig-name">{escapeHtml(po.auth_name)}</div>
          <div className="sig-status approved">{escapeHtml(po.auth_status)}</div>
        </div>
        <div>
          <div className="sig-label">Approved by</div>
          <div className="sig-name">{escapeHtml(po.approver_name)}</div>
          <div className="sig-status pending">{escapeHtml(po.approver_status)}</div>
        </div>
      </div>
    </div>
  );
}
