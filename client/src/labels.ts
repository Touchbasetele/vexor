export function tagLabel(t: string) {
  const map: Record<string, string> = {
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
