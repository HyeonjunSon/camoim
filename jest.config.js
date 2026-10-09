/** Client (React Native/Expo) test configuration */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // server/ and web/ run under their own test configs (cd server && npm test,
  // cd web && npm test — web/ uses Node's built-in runner on native TypeScript)
  testPathIgnorePatterns: ['/node_modules/', '/server/', '/web/', '/android/', '/ios/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: ['src/lib/**/*.js', 'src/constants/**/*.js'],
};
