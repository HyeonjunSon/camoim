/**
 * App Store 심사관용 테스트 계정을 DB에 직접 생성.
 * 이메일 인증 건너뛴 바로 로그인 가능한 계정.
 *
 * 사용법:
 *   cd server
 *   REVIEWER_EMAIL="apple.reviewer@camoim.app" \
 *   REVIEWER_PASSWORD="여기에비번" \
 *   REVIEWER_NICKNAME="심사리뷰어" \
 *   node scripts/createReviewerAccount.js
 *
 * 또는 .env.local (gitignored) 파일 만들어 관리:
 *   REVIEWER_EMAIL=...
 *   REVIEWER_PASSWORD=...
 *   REVIEWER_NICKNAME=...
 *   그리고: node -r dotenv/config scripts/createReviewerAccount.js dotenv_config_path=.env.local
 *
 * 운영(Atlas) DB에 만들려면 MONGODB_URI도 덮어쓰기:
 *   MONGODB_URI="mongodb+srv://..." REVIEWER_EMAIL="..." REVIEWER_PASSWORD="..." node ...
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const email     = process.env.REVIEWER_EMAIL;
const password  = process.env.REVIEWER_PASSWORD;
const nickname  = process.env.REVIEWER_NICKNAME || '심사리뷰어';
const role      = process.env.REVIEWER_ROLE || 'general';

if (!email || !password) {
  console.error('❌ REVIEWER_EMAIL, REVIEWER_PASSWORD 환경변수를 지정해주세요.');
  console.error('예:');
  console.error('  REVIEWER_EMAIL="apple.reviewer@camoim.app" REVIEWER_PASSWORD="..." node scripts/createReviewerAccount.js');
  process.exit(1);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI 환경변수가 없습니다.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Mongo 연결됨');

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('ℹ️  이미 존재하는 계정이 있습니다. 비밀번호만 재설정합니다.');
      existing.passwordHash = await bcrypt.hash(password, 10);
      existing.emailVerified = true;
      existing.status = 'active';
      await existing.save();
      console.log('✅ 비밀번호 재설정 + 이메일 인증 상태 활성 완료');
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({
        email: email.toLowerCase(),
        passwordHash,
        nickname,
        role,
        emailVerified: true, // 인증 건너뛰기
        verified: false,
        status: 'active',
      });
      console.log('✅ 심사관 계정 생성 완료');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 App Store Connect Sign-in Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Username: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ 오류:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
