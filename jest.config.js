/** Client (React Native/Expo) test configuration */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // server/ runs under its own jest config (cd server && npm test)
  testPathIgnorePatterns: ['/node_modules/', '/server/', '/android/', '/ios/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: ['src/lib/**/*.js', 'src/constants/**/*.js'],
};
