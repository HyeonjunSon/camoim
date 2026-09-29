import { setRuntimeLang, getRuntimeLang, rt } from '../runtimeLang';
import { TRANSLATIONS } from '../i18n';

// The language holder used outside React (api.js and friends). If its default drifts,
// every error message surfaces as a raw key, so it is pinned here.
describe('runtimeLang', () => {
  afterEach(() => setRuntimeLang('ko'));

  it('the default language is ko', () => {
    expect(getRuntimeLang()).toBe('ko');
  });

  it('can be switched to en', () => {
    setRuntimeLang('en');
    expect(getRuntimeLang()).toBe('en');
  });

  it('normalizes an unknown value to ko', () => {
    setRuntimeLang('fr');
    expect(getRuntimeLang()).toBe('ko');
    setRuntimeLang(undefined);
    expect(getRuntimeLang()).toBe('ko');
  });
});

describe('rt (translation lookup outside React)', () => {
  afterEach(() => setRuntimeLang('ko'));

  it('finds the current language value by dotted key', () => {
    expect(rt('common.timeoutError')).toBe(TRANSLATIONS.ko.common.timeoutError);
    setRuntimeLang('en');
    expect(rt('common.timeoutError')).toBe(TRANSLATIONS.en.common.timeoutError);
  });

  it('returns the key itself when missing (so the app does not crash)', () => {
    expect(rt('nope.not.here')).toBe('nope.not.here');
    expect(rt('common.정말없는키')).toBe('common.정말없는키');
  });

  it('returns the key when it points at a non-string node', () => {
    expect(rt('common')).toBe('common');
  });
});

describe('i18n dictionary', () => {
  it('ko and en hold the same set of keys', () => {
    const flatten = (obj, prefix = '') =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
      );
    const ko = flatten(TRANSLATIONS.ko).sort();
    const en = flatten(TRANSLATIONS.en).sort();
    expect(en.filter((k) => !ko.includes(k))).toEqual([]);
    expect(ko.filter((k) => !en.includes(k))).toEqual([]);
  });
});
