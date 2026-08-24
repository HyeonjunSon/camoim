/**
 * 활성 유저 진단 — DAU/WAU 근사치.
 * 사용법: cd server && railway run node scripts/checkDAU.js
 *
 * User schema에 lastLogin이 없어서 완벽하진 않지만:
 *  - User.updatedAt: pushToken 갱신·프로필 편집 등 → 앱 실행 proxy
 *  - Post/Comment.createdAt: 확실한 write activity (더 신뢰도 높음)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Message = require('../models/Message');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ ${mongoose.connection.name}\n`);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const t24h = new Date(now - day);
  const t7d  = new Date(now - 7 * day);
  const t30d = new Date(now - 30 * day);

  // ── 시드 계정 제외
  const seedEmails = /^seed\d+@/;
  const seedIds = (await User.find({ email: seedEmails }).select('_id').lean()).map(u => u._id);
  const seedIdStrs = new Set(seedIds.map(String));
  const notSeed = { _id: { $nin: seedIds } };

  const totalReal = await User.countDocuments(notSeed);
  const totalActiveStatus = await User.countDocuments({ ...notSeed, status: 'active' });
  const hasPushToken = await User.countDocuments({ ...notSeed, pushToken: { $ne: '' } });

  console.log('━━ 전체 유저 (시드 제외) ━━');
  console.log(`총 등록: ${totalReal}명`);
  console.log(`status=active: ${totalActiveStatus}명`);
  console.log(`pushToken 있음 (앱 최소 1회 실행한 흔적): ${hasPushToken}명`);

  // ── User.updatedAt 기반 근사 (pushToken 갱신·프로필 편집 시 갱신)
  console.log('\n━━ User.updatedAt 기반 근사 활성 ━━');
  const dauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t24h } });
  const wauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t7d  } });
  const mauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t30d } });
  console.log(`24시간 내 뭔가 갱신: ${dauProxy}명 (DAU 상한)`);
  console.log(`7일 내: ${wauProxy}명 (WAU 상한)`);
  console.log(`30일 내: ${mauProxy}명 (MAU 상한)`);

  // ── 확실한 write activity
  console.log('\n━━ 쓰기 활동 (실제 유저) ━━');
  const postersDay = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t24h } });
  const postersWeek = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const postersMonth = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`24h 내 글 쓴 사람: ${postersDay.length}명`);
  console.log(`7일 내 글 쓴 사람: ${postersWeek.length}명`);
  console.log(`30일 내 글 쓴 사람: ${postersMonth.length}명`);

  const commWeek = await Comment.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const commMonth = await Comment.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`7일 내 댓글 쓴 사람: ${commWeek.length}명`);
  console.log(`30일 내 댓글 쓴 사람: ${commMonth.length}명`);

  // ── 채팅 (진짜 커뮤니티 활동)
  const chatWeek = await Message.distinct('senderId', { senderId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const chatMonth = await Message.distinct('senderId', { senderId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`\n━━ 채팅 활동 ━━`);
  console.log(`7일 내 채팅 보낸 사람: ${chatWeek.length}명`);
  console.log(`30일 내 채팅 보낸 사람: ${chatMonth.length}명`);

  // ── 신규 가입 추세
  console.log('\n━━ 신규 가입 추세 ━━');
  const newDay = await User.countDocuments({ ...notSeed, createdAt: { $gte: t24h } });
  const newWeek = await User.countDocuments({ ...notSeed, createdAt: { $gte: t7d } });
  const newMonth = await User.countDocuments({ ...notSeed, createdAt: { $gte: t30d } });
  console.log(`24h 신규: ${newDay}명`);
  console.log(`7일 신규: ${newWeek}명`);
  console.log(`30일 신규: ${newMonth}명`);

  // ── 침묵 유저 비율
  const silent7 = totalReal - wauProxy;
  console.log(`\n━━ 침묵 유저 ━━`);
  console.log(`7일간 뭔가 활동한 유저: ${wauProxy} / ${totalReal} (${((wauProxy/totalReal)*100).toFixed(1)}%)`);
  console.log(`나머지 침묵: ${silent7}명`);

  await mongoose.disconnect();
})().catch(e => { console.error('오류:', e); process.exit(1); });
