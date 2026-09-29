// Mocks for RN native modules — unit tests exercise JS logic without any native layer.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
