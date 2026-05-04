// 리스트 응답용 본문 프리뷰 — HTML 태그 제거 + 특수 마커 제거 + 길이 제한
// 클라이언트 HomeScreen.getPreview()와 동일 규칙 (서버에서 미리 잘라 페이로드 절감)
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
