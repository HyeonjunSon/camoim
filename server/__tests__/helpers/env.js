// 테스트 전용 환경변수 — 실제 .env(운영 DB/키)를 절대 읽지 않는다.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:0/placeholder'; // db.js는 테스트에서 안 씀
process.env.MAIL_FROM = 'CaMoim <no-reply@test.local>';
process.env.RESEND_API_KEY = 're_test_dummy_key';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';

// 서버의 일반 로그(소켓 연결 등)는 테스트 출력에서 지운다.
// console.error/warn은 실제 문제를 놓치지 않도록 그대로 둔다.
global.console.log = () => {};
