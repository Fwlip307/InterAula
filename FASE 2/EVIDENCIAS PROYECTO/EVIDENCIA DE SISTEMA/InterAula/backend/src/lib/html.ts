import sanitizeHtml from 'sanitize-html';

export function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'h1', 'h2', 'span', 'sub', 'sup'],
    allowedAttributes: {
      '*': ['class', 'style'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      code: ['class'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        'font-weight': [/^(normal|bold|[1-9]00)$/],
        'font-style': [/^(normal|italic)$/],
        'font-size': [/^\d{1,2}(\.\d+)?(px|pt|em|rem|%)$/],
        'text-decoration': [/^(none|underline|line-through)$/],
        'color': [/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i],
        'background-color': [/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i],
      },
    },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
  });
}

// Presentations contain HTML inside JSON as well as in content_html.
export function sanitizeNoteJson(value: unknown): any {
  if (typeof value === 'string') return sanitizeNoteHtml(value);
  if (Array.isArray(value)) return value.map(sanitizeNoteJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeNoteJson(item)]));
  }
  return value;
}
