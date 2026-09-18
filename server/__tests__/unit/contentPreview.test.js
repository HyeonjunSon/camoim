const { toContentPreview } = require('../../utils/contentPreview');

describe('toContentPreview', () => {
  it('빈 값이면 빈 문자열', () => {
    expect(toContentPreview('')).toBe('');
    expect(toContentPreview(null)).toBe('');
    expect(toContentPreview(undefined)).toBe('');
    expect(toContentPreview(123)).toBe('');
  });

  it('HTML 태그를 제거한다', () => {
    expect(toContentPreview('<p>안녕하세요</p>')).toBe('안녕하세요');
    expect(toContentPreview('<div><b>굵게</b> 보통</div>')).toBe('굵게 보통');
  });

  it('style/script 블록은 내용까지 통째로 제거한다', () => {
    expect(toContentPreview('<style>.a{color:red}</style>본문')).toBe('본문');
    expect(toContentPreview('<script>alert(1)</script>본문')).toBe('본문');
  });

  it('블록 종료 태그와 <br>은 공백으로 치환한다', () => {
    expect(toContentPreview('<p>첫줄</p><p>둘째줄</p>')).toBe('첫줄 둘째줄');
    expect(toContentPreview('첫줄<br>둘째줄')).toBe('첫줄 둘째줄');
    expect(toContentPreview('<li>a</li><li>b</li>')).toBe('a b');
  });

  it('HTML 엔티티를 디코드한다', () => {
    expect(toContentPreview('a&nbsp;b')).toBe('a b');
    expect(toContentPreview('A&amp;B')).toBe('A&B');
    expect(toContentPreview('&lt;tag&gt;')).toBe('<tag>');
    expect(toContentPreview('&quot;인용&quot;')).toBe('"인용"');
  });

  it('에디터 전용 마커([IMG:n], [B]/[H]/[C])를 제거한다', () => {
    expect(toContentPreview('사진[IMG:0]설명')).toBe('사진설명');
    expect(toContentPreview('[B]강조[/B]')).toBe('강조');
    expect(toContentPreview('[H]제목[/H][C]코드[/C]')).toBe('제목코드');
  });

  it('연속 공백을 하나로 접고 양끝을 자른다', () => {
    expect(toContentPreview('  a    b  \n  c ')).toBe('a b c');
  });

  it('maxLen으로 자른다 (기본 300)', () => {
    expect(toContentPreview('가'.repeat(400))).toHaveLength(300);
    expect(toContentPreview('가'.repeat(400), 10)).toHaveLength(10);
  });
});
