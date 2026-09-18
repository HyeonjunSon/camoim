import { setRuntimeLang, getRuntimeLang, rt } from '../runtimeLang';
import { TRANSLATIONS } from '../i18n';

// React 밖(api.js 등)에서 쓰는 언어 holder — 기본값이 흐트러지면 에러 메시지가
// 전부 원문 키로 노출되므로 고정해 둔다.
describe('runtimeLang', () => {
  afterEach(() => setRuntimeLang('ko'));

  it('기본 언어는 ko', () => {
    expect(getRuntimeLang()).toBe('ko');
  });

  it('en으로 바꿀 수 있다', () => {
    setRuntimeLang('en');
    expect(getRuntimeLang()).toBe('en');
  });

  it('알 수 없는 값은 ko로 정규화한다', () => {
    setRuntimeLang('fr');
    expect(getRuntimeLang()).toBe('ko');
    setRuntimeLang(undefined);
    expect(getRuntimeLang()).toBe('ko');
  });
});

describe('rt (React 밖 번역 조회)', () => {
  afterEach(() => setRuntimeLang('ko'));

  it('현재 언어의 값을 점 표기로 찾는다', () => {
    expect(rt('common.timeoutError')).toBe(TRANSLATIONS.ko.common.timeoutError);
    setRuntimeLang('en');
    expect(rt('common.timeoutError')).toBe(TRANSLATIONS.en.common.timeoutError);
  });

  it('없는 키는 키 자체를 반환한다 (앱이 죽지 않게)', () => {
    expect(rt('nope.not.here')).toBe('nope.not.here');
    expect(rt('common.정말없는키')).toBe('common.정말없는키');
  });

  it('문자열이 아닌 노드(중간 객체)를 가리키면 키를 반환한다', () => {
    expect(rt('common')).toBe('common');
  });
});

describe('i18n 사전', () => {
  it('ko와 en이 같은 키 집합을 갖는다', () => {
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
