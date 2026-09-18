const { expandCity, METRO_AREAS } = require('../../utils/metro');

describe('expandCity', () => {
  it('값이 없으면 null', () => {
    expect(expandCity('')).toBeNull();
    expect(expandCity(null)).toBeNull();
    expect(expandCity(undefined)).toBeNull();
  });

  it('광역권에 속한 도시는 그룹 전체를 반환한다', () => {
    const toronto = expandCity('Mississauga');
    expect(toronto).toContain('Toronto');
    expect(toronto).toContain('Mississauga');
    expect(expandCity('Burnaby')).toContain('Vancouver');
  });

  it('같은 그룹 안 도시는 서로 같은 결과를 준다', () => {
    expect(expandCity('Toronto')).toEqual(expandCity('Markham'));
  });

  it('광역권에 없는 도시는 자기 자신만 담긴 배열', () => {
    expect(expandCity('Halifax')).toEqual(['Halifax']);
  });

  it('도시 이름은 대소문자를 구분한다 (정확 일치 전제)', () => {
    expect(expandCity('toronto')).toEqual(['toronto']);
  });

  it('도시가 두 광역권에 중복 등록되지 않았다', () => {
    const all = METRO_AREAS.flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
