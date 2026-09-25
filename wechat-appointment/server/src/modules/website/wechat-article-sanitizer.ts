import sanitizeHtml from 'sanitize-html';

const cleanText = (value: unknown, max = 2000) => String(value ?? '')
  .normalize('NFC')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
  .trim()
  .slice(0, max);

const responsiveStyle = (raw: string) => raw
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean)
  .filter((part) => !/^(?:width|min-width|max-width|height|min-height|max-height|font-family|position|left|right|top|bottom)\s*:/i.test(part))
  .join('; ');

export function normalizeWechatText(value: unknown, max?: number) {
  return cleanText(value, max);
}

export function sanitizeWechatArticleHtml(input: unknown) {
  const source = String(input ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '');
  return sanitizeHtml(source, {
    allowedTags: ['p', 'div', 'section', 'article', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'figure', 'figcaption', 'img', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'data-src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']
    },
    allowedSchemes: ['http', 'https', 'data'],
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb/i, /^[a-z]+$/i],
        'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb/i, /^transparent$/i],
        'text-align': [/^(left|right|center|justify)$/],
        'font-size': [/^(?:1[2-9]|2[0-8])px$/, /^(?:0\.[89]|1(?:\.\d+)?)em$/],
        'font-weight': [/^(?:normal|bold|[4-7]00)$/],
        'font-style': [/^(?:normal|italic)$/],
        'line-height': [/^(?:1(?:\.\d+)?|2(?:\.0+)?)$/],
        margin: [/^[\d.\s%-]+$/],
        'margin-top': [/^[\d.%-]+$/],
        'margin-bottom': [/^[\d.%-]+$/],
        padding: [/^[\d.\s%-]+$/],
        'padding-top': [/^[\d.%-]+$/],
        'padding-bottom': [/^[\d.%-]+$/],
        'border-radius': [/^[\d.]+(?:px|rem|%)$/]
      }
    },
    transformTags: {
      img: (_tag, attrs) => ({
        tagName: 'img',
        attribs: {
          src: attrs.src || attrs['data-src'] || '',
          alt: cleanText(attrs.alt || attrs.title || '文章配图', 120),
          loading: 'lazy',
          decoding: 'async'
        }
      }),
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { href: attrs.href || '#', title: cleanText(attrs.title, 120), target: '_blank', rel: 'noopener noreferrer' } }),
      '*': (tagName, attrs) => ({ tagName, attribs: { ...attrs, ...(attrs.style ? { style: responsiveStyle(attrs.style) } : {}) } })
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src
  });
}
