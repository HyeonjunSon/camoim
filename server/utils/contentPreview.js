// Body preview for list responses — strips HTML tags and special markers, then truncates
// Same rules as HomeScreen.getPreview() on the client (trimming server-side shrinks the payload)
function toContentPreview(html, maxLen = 300) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h\d|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/​/g, '')
    .replace(/\[IMG:\d+\]/g, '')
    .replace(/\[\/?[BHC]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

module.exports = { toContentPreview };
