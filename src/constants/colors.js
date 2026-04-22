// 라이트/다크 테마 색상 정의

export const lightColors = {
  primary: '#7F77DD',
  primaryLight: '#A09BE8',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#888888',
  border: '#E5E5E5',
  danger: '#FF4444',
  card: '#FFFFFF',
  inputBg: '#F4F5F9',
};

export const darkColors = {
  primary: '#9A92E8',
  primaryLight: '#BAB4F0',
  background: '#0F1014',
  surface: '#1A1B22',
  white: '#FFFFFF',
  text: '#F2F2F5',
  textSecondary: '#9AA0AC',
  border: '#353845',
  danger: '#FF6B6B',
  card: '#1A1B22',
  inputBg: '#262830',
};

// 현재 활성 테마를 추적하는 반응형 colors 객체
// ThemeContext에서 setActiveColors()로 업데이트하면
// 모듈 스코프 StyleSheet에서도 새 값이 반영됨
let _active = { ...lightColors };

export function setActiveColors(c) {
  Object.assign(_active, c);
}

// Proxy: 항상 _active의 최신 값 반환
export const colors = new Proxy({}, {
  get(_, key) { return _active[key]; },
  ownKeys() { return Object.keys(_active); },
  getOwnPropertyDescriptor(_, key) {
    if (key in _active) return { configurable: true, enumerable: true, value: _active[key] };
  },
});
