import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * Post bodies are HTML written by other users through the app's pell editor
 * (and, on the web, TipTap). This is the one place in the product where markup
 * from one user is rendered into another's page, so nothing reaches the DOM
 * without passing through here.
 *
 * The allowlist is drawn from what the two editors can actually produce. The
 * app's toolbar is image / bold / italic / underline / H2 / align / undo-redo
 * (src/screens/board/CreatePostScreen.js), and `execCommand` additionally emits
 * `div`, `font` and `span` wrappers, so those are tolerated and stripped of
 * everything but a text alignment. Lists, headings and blockquote are allowed
 * because TipTap can emit them and the app's react-native-render-html renders
 * them fine.
 */
const ALLOWED_TAGS = [
  'p', 'div', 'br', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'hr', 'pre', 'code',
  'a', 'img',
];

const options: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // Attribute filtering runs after transformTags, so the hardening attributes
  // added down there have to be allowed here or they are stripped right back off.
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'loading', 'referrerpolicy'],
    '*': ['style'],
  },
  // No `data:` and no `javascript:`. Images are https-only, which also keeps a
  // mixed-content warning off the page.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'], a: ['http', 'https', 'mailto'] },
  allowProtocolRelative: false,
  // Only alignment survives. Anything else an editor emitted (colour, font size,
  // and above all `position` or a `url()` background) is dropped.
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/] },
  },
  // Empty tags that carried no attributes are noise once stripped.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed'],
  transformTags: {
    // Outbound links are untrusted: open away from the session and tell search
    // engines not to follow user-submitted URLs.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'nofollow ugc noopener noreferrer',
      },
    }),
    // Images are usually Cloudinary, but posts migrated from the old Daum cafe
    // can point anywhere, and a remote image is a tracking pixel if it is given
    // a referrer. Lazy loading also keeps a long post off the critical path.
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', referrerpolicy: 'no-referrer' },
    }),
    // execCommand's font wrappers carry presentation we do not keep.
    font: () => ({ tagName: 'span', attribs: {} }),
  },
};

export function sanitizePostHtml(html: string | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, options);
}

/**
 * Comments are plain text in the database, so they are escaped by React rather
 * than sanitised. This only normalises the line breaks for display.
 */
export function commentLines(content: string | undefined): string[] {
  return (content ?? '').replace(/\r\n/g, '\n').split('\n');
}
