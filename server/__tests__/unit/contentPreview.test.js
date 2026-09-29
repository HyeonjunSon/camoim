const { toContentPreview } = require('../../utils/contentPreview');

describe('toContentPreview', () => {
  it('empty input gives an empty string', () => {
    expect(toContentPreview('')).toBe('');
    expect(toContentPreview(null)).toBe('');
    expect(toContentPreview(undefined)).toBe('');
    expect(toContentPreview(123)).toBe('');
  });

  it('strips HTML tags', () => {
    expect(toContentPreview('<p>안녕하세요</p>')).toBe('안녕하세요');
    expect(toContentPreview('<div><b>굵게</b> 보통</div>')).toBe('굵게 보통');
  });

  it('removes style and script blocks including their contents', () => {
    expect(toContentPreview('<style>.a{color:red}</style>본문')).toBe('본문');
    expect(toContentPreview('<script>alert(1)</script>본문')).toBe('본문');
  });

  it('replaces closing block tags and <br> with a space', () => {
    expect(toContentPreview('<p>첫줄</p><p>둘째줄</p>')).toBe('첫줄 둘째줄');
    expect(toContentPreview('첫줄<br>둘째줄')).toBe('첫줄 둘째줄');
    expect(toContentPreview('<li>a</li><li>b</li>')).toBe('a b');
  });

  it('decodes HTML entities', () => {
    expect(toContentPreview('a&nbsp;b')).toBe('a b');
    expect(toContentPreview('A&amp;B')).toBe('A&B');
    expect(toContentPreview('&lt;tag&gt;')).toBe('<tag>');
    expect(toContentPreview('&quot;인용&quot;')).toBe('"인용"');
  });

  it('removes editor-only markers ([IMG:n], [B]/[H]/[C])', () => {
    expect(toContentPreview('사진[IMG:0]설명')).toBe('사진설명');
    expect(toContentPreview('[B]강조[/B]')).toBe('강조');
    expect(toContentPreview('[H]제목[/H][C]코드[/C]')).toBe('제목코드');
  });

  it('collapses runs of whitespace and trims both ends', () => {
    expect(toContentPreview('  a    b  \n  c ')).toBe('a b c');
  });

  it('truncates at maxLen (default 300)', () => {
    expect(toContentPreview('가'.repeat(400))).toHaveLength(300);
    expect(toContentPreview('가'.repeat(400), 10)).toHaveLength(10);
  });
});
