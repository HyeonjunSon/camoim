const { expandCity, METRO_AREAS } = require('../../utils/metro');

describe('expandCity', () => {
  it('null for an empty value', () => {
    expect(expandCity('')).toBeNull();
    expect(expandCity(null)).toBeNull();
    expect(expandCity(undefined)).toBeNull();
  });

  it('a city inside a metro area returns the whole group', () => {
    const toronto = expandCity('Mississauga');
    expect(toronto).toContain('Toronto');
    expect(toronto).toContain('Mississauga');
    expect(expandCity('Burnaby')).toContain('Vancouver');
  });

  it('cities in one group give each other the same result', () => {
    expect(expandCity('Toronto')).toEqual(expandCity('Markham'));
  });

  it('a city outside any metro area returns an array holding only itself', () => {
    expect(expandCity('Halifax')).toEqual(['Halifax']);
  });

  it('city names are case sensitive (exact match is assumed)', () => {
    expect(expandCity('toronto')).toEqual(['toronto']);
  });

  it('no city is registered in two metro areas', () => {
    const all = METRO_AREAS.flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
