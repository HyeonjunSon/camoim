/** Server test configuration — Node environment, in-memory MongoDB */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/helpers/env.js'],
  // The first mongodb-memory-server run may need to download a binary
  testTimeout: 30000,
  // Run files serially so integration tests never share one in-memory DB
  maxWorkers: 1,
  collectCoverageFrom: [
    'routes/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'constants/**/*.js',
    'socket.js',
  ],
};
