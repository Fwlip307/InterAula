import DOMPurify from 'dompurify';

if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof HTMLAnchorElement && node.target === '_blank') node.rel = 'noopener noreferrer';
    if (!(node instanceof HTMLElement) || !node.hasAttribute('style')) return;
    const allowed = new Set(['text-align', 'font-weight', 'font-style', 'font-size', 'text-decoration', 'color', 'background-color']);
    for (const property of Array.from(node.style)) {
      const value = node.style.getPropertyValue(property);
      if (!allowed.has(property) || /url|expression|@|\\/i.test(value)) node.style.removeProperty(property);
    }
    if (!node.style.length) node.removeAttribute('style');
  });
}

export function safeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_DATA_ATTR: false,
  });
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}
