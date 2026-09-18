/** 클라이언트(React Native/Expo) 테스트 설정 */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // server/는 자체 jest 설정으로 따로 돌린다 (cd server && npm test)
  testPathIgnorePatterns: ['/node_modules/', '/server/', '/android/', '/ios/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: ['src/lib/**/*.js', 'src/constants/**/*.js'],
};
