/** Allow only strong/br in activity HTML (matches legacy dashboard behavior). */
export function sanitizeInlineHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const allowedTags = new Set(['STRONG', 'BR']);
  for (const node of template.content.querySelectorAll('*')) {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ''));
      continue;
    }
    for (const attr of [...node.attributes]) node.removeAttribute(attr.name);
  }
  return template.innerHTML;
}
