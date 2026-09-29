// Test-only environment variables — the real .env (production DB and keys) is never read.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:0/placeholder'; // db.js is unused in tests
process.env.MAIL_FROM = 'CaMoim <no-reply@test.local>';
process.env.RESEND_API_KEY = 're_test_dummy_key';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';

// Silence the server's ordinary logs (socket connections and so on) in test output.
// console.error/warn stay, so real problems are not missed.
global.console.log = () => {};
