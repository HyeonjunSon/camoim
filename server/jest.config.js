/** 서버 테스트 설정 — Node 환경, in-memory MongoDB 사용 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/__tests__/helpers/env.js'],
  // mongodb-memory-server 최초 실행 시 바이너리 다운로드가 걸릴 수 있음
  testTimeout: 30000,
  // 통합 테스트가 같은 in-memory DB를 공유하지 않도록 파일 단위 직렬 실행
  maxWorkers: 1,
  collectCoverageFrom: [
    'routes/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'constants/**/*.js',
    'socket.js',
  ],
};
