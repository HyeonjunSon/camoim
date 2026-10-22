import { compareVersions, isNewerVersion } from '../storeUpdate';

describe('compareVersions', () => {
  it('compares numerically, not as strings', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
  });
  it('treats missing parts as 0', () => {
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
  });
});

describe('isNewerVersion', () => {
  it('only prompts when the store is strictly ahead', () => {
    expect(isNewerVersion('1.0.9', '1.0.8')).toBe(true);
    expect(isNewerVersion('1.0.8', '1.0.8')).toBe(false);
    // Store lags behind a build still in review
    expect(isNewerVersion('1.0.8', '1.0.9')).toBe(false);
  });
  it('never prompts when either version is unknown', () => {
    expect(isNewerVersion(null, '1.0.8')).toBe(false);
    expect(isNewerVersion('1.0.9', '')).toBe(false);
  });
});
