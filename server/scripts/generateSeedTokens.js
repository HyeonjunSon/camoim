/**
 * 시드 계정용 JWT를 DB에서 직접 발급 → seed-tokens.json 저장.
 * 로그인 API(rate limit 10회/15분)를 우회하기 위함.
 *
 * 사용법 (운영 env 필요 — JWT_SECRET + Atlas):
 *   cd server
 *   railway run node scripts/generateSeedTokens.js
 *
 * 출력: server/scripts/seed-tokens.json  (gitignore됨)
 *   { "1": { "token": "...", "nickname": "토론토라이프", "email": "seed01@..." }, ... }
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const PREFIX = process.env.SEED_PREFIX || 'seed';
const DOMAIN = process.env.SEED_DOMAIN || 'camoimapp.com';

(async () => {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    console.error('❌ MONGODB_URI / JWT_SECRET 필요. `railway run`으로 실행하세요.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ Mongo 연결됨 — ${mongoose.connection.host} / ${mongoose.connection.name}`);

  // seed 이메일 prefix를 가진 계정 전부
  const regex = new RegExp(`^${PREFIX}\\d+@${DOMAIN.replace('.', '\\.')}$`, 'i');
  const users = await User.find({ email: regex })
    .select('_id email nickname tokenVersion')
    .lean();

  const tokens = {};
  users.forEach((u) => {
    const m = u.email.match(new RegExp(`^${PREFIX}(\\d+)@`, 'i'));
    if (!m) return;
    const n = parseInt(m[1], 10);
    const token = jwt.sign(
      { id: u._id, email: u.email, nickname: u.nickname, v: u.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    tokens[n] = { token, nickname: u.nickname, email: u.email };
  });

  const outFile = path.join(__dirname, 'seed-tokens.json');
  fs.writeFileSync(outFile, JSON.stringify(tokens, null, 2));
  console.log(`✅ ${Object.keys(tokens).length}개 토큰 발급 → ${outFile}`);

  await mongoose.disconnect();
})().catch((e) => { console.error('오류:', e); process.exit(1); });
