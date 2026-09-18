// RN 네이티브 모듈 모킹 — 유닛 테스트는 네이티브 없이 JS 로직만 검증한다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
