/**
 * 캐스모 글 이관용 일반 계정 N개를 DB에 직접 생성.
 * 이메일 인증 건너뛴, 바로 로그인 가능한 일반(general) 계정.
 *
 * - 닉네임은 아래 POOL에서 DB에 없는 것부터 순서대로 선택 (중복 방지)
 * - 이메일은 seedNN@camoimapp.com 패턴 (실제 발송 X, emailVerified=true)
 *   → 이 prefix가 나중에 정리(cleanup)용 식별자 역할
 * - 모든 계정 동일 비밀번호 (SEED_PASSWORD)
 *
 * 사용법 (로컬 DB):
 *   cd server
 *   SEED_PASSWORD="공통비번" node scripts/createSeedAccounts.js
 *
 * 운영(Atlas) DB에 만들려면 MONGODB_URI를 Atlas 문자열로 덮어쓰기:
 *   MONGODB_URI="mongodb+srv://..." SEED_PASSWORD="공통비번" SEED_COUNT=20 \
 *     node scripts/createSeedAccounts.js
 *
 * 옵션 env:
 *   SEED_COUNT   — 만들 계정 수 (기본 20)
 *   SEED_PREFIX  — 이메일 prefix (기본 "seed")
 *   SEED_DOMAIN  — 이메일 도메인 (기본 "camoimapp.com")
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// 자연스러운 한인 커뮤니티 닉네임 풀 (전부 ≤20자) — 필요분보다 넉넉하게
const NICKNAME_POOL = [
  '토론토라이프', '단풍국유학생', '밴쿠버워홀러', '메이플러버', '캘거리이민러',
  '노스욕주민', '코퀴틀람댁', '다운타운직장인', '리치몬드맘', '워홀1년차',
  '영주권준비생', '커피한잔할래', '나이아가라폭포', '캐나다구스', '푸틴마니아',
  '새내기유학생', '이민2년차', '한인마트단골', '메이플시럽', '락키산맥',
  '오로라헌터', '토론토너구리', '밴쿠버비', '단풍잎하나', '겨울왕국주민',
  '곰돌이푸우', '스시도시락', '김치찌개한입', '해시브라운', '온타리오호수',
  '위니펙주민', '핼리팩스바다', '몬트리올불어', '에드먼튼겨울', '써리사는사람',
];

const password   = process.env.SEED_PASSWORD;
const count      = parseInt(process.env.SEED_COUNT || '20', 10);
const prefix     = process.env.SEED_PREFIX || 'seed';
const domain     = process.env.SEED_DOMAIN || 'camoimapp.com';

if (!password) {
  console.error('❌ SEED_PASSWORD 환경변수가 필요합니다.');
  console.error('예: SEED_PASSWORD="공통비번" node scripts/createSeedAccounts.js');
  process.exit(1);
}
if (count < 1 || count > NICKNAME_POOL.length) {
  console.error(`❌ SEED_COUNT는 1~${NICKNAME_POOL.length} 사이여야 합니다 (요청: ${count}).`);
  process.exit(1);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI 환경변수가 없습니다.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  // 어느 DB에 붙었는지 명시 (운영/로컬 헷갈림 방지)
  const host = mongoose.connection.host;
  const dbName = mongoose.connection.name;
  console.log(`✅ Mongo 연결됨 — host: ${host}, db: ${dbName}`);

  const passwordHash = await bcrypt.hash(password, 10);
  const created = [];
  const skipped = [];

  try {
    // POOL 인덱스 기준으로 이메일 번호 고정 (seedNN = 풀 N번째)
    // → 재실행해도 번호가 안 꼬이고, 새로 비는 자리만 채움 (idempotent)
    for (let idx = 0; idx < NICKNAME_POOL.length; idx += 1) {
      if (created.length >= count) break;

      const nickname = NICKNAME_POOL[idx];
      const email = `${prefix}${String(idx + 1).padStart(2, '0')}@${domain}`.toLowerCase();

      // 닉네임 또는 이메일이 이미 있으면 건너뜀
      const exists = await User
        .findOne({ $or: [{ nickname }, { email }] })
        .select('_id')
        .lean();
      if (exists) {
        skipped.push({ nickname, email, reason: '이미 존재' });
        continue;
      }

      await User.create({
        email,
        passwordHash,
        nickname,
        role: 'general',
        emailVerified: true, // 인증 건너뛰기 → 바로 로그인 가능
        verified: false,     // 학교 인증 X
        status: 'active',
      });
      created.push({ email, nickname });
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 생성된 계정 (${created.length}개) — 공통 비번: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    created.forEach((u, i) => {
      console.log(`  ${String(i + 1).padStart(2, '0')}. ${u.email.padEnd(28)} ${u.nickname}`);
    });
    if (skipped.length) {
      console.log('');
      console.log(`⏭  건너뜀 (${skipped.length}개):`);
      skipped.forEach((s) => console.log(`   - ${s.nickname} (${s.reason})`));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ 오류:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
