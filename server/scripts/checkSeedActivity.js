/**
 * 시드 계정 35개에 들어온 반응(알림/DM/댓글/좋아요) 집계.
 * 사용법: cd server && railway run node scripts/checkSeedActivity.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const Comment = require('../models/Comment');
const Post = require('../models/Post');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅ ${mongoose.connection.host} / ${mongoose.connection.name}\n`);

  const seeds = await User.find({ email: /^seed\d+@/ }).select('_id email nickname').lean();
  const seedIds = seeds.map(s => s._id);
  const seedIdSet = new Set(seedIds.map(String));
  const nick = new Map(seeds.map(s => [String(s._id), s.nickname]));
  console.log(`시드 계정 ${seeds.length}개 기준으로 조회\n`);

  // 1) 알림 (댓글/대댓글/좋아요/학생회장 등) — 시드가 받은 것
  const notis = await Notification.find({ userId: { $in: seedIds } })
    .sort({ createdAt: -1 }).limit(50).lean();
  const byType = {};
  notis.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
  console.log('━━ 1) 받은 알림 ━━');
  console.log(`총 ${notis.length}건` + (notis.length ? ` (타입별: ${JSON.stringify(byType)})` : ''));
  notis.slice(0, 15).forEach(n =>
    console.log(`   · [${n.type}] ${nick.get(String(n.userId))} ← "${(n.message || '').slice(0, 50)}" (${n.createdAt.toISOString().slice(0,16)})`));

  // 2) DM (1:1 채팅) — 시드가 낀 dm 방 + 상대/메시지수
  const dmRooms = await ChatRoom.find({ kind: 'dm', participants: { $in: seedIds } })
    .sort({ lastMessageAt: -1 }).lean();
  console.log('\n━━ 2) 받은 DM (1:1 채팅) ━━');
  console.log(`시드가 낀 DM방 ${dmRooms.length}개`);
  for (const r of dmRooms) {
    const otherId = r.participants.map(String).find(p => !seedIdSet.has(p));
    const seedSide = r.participants.map(String).find(p => seedIdSet.has(p));
    const msgCount = await Message.countDocuments({ roomId: r._id });
    let other = '(알수없음)';
    if (otherId) {
      const u = await User.findById(otherId).select('nickname email').lean();
      other = u ? `${u.nickname}` : '(탈퇴/삭제)';
    }
    console.log(`   · 시드[${nick.get(seedSide)}] ↔ ${other} | 메시지 ${msgCount}개 | status=${r.status} | last="${(r.lastMessage||'').slice(0,30)}"`);
  }

  // 3) 시드 글에 달린 댓글 (시드끼리 말고 외부인만)
  const seedPosts = await Post.find({ userId: { $in: seedIds } }).select('_id title userId').lean();
  const seedPostIds = seedPosts.map(p => p._id);
  const comments = await Comment.find({ postId: { $in: seedPostIds }, userId: { $nin: seedIds } })
    .sort({ createdAt: -1 }).limit(30).lean();
  console.log('\n━━ 3) 시드 글에 달린 외부 댓글 ━━');
  console.log(`시드 글 ${seedPosts.length}개 중 외부 댓글 ${comments.length}건`);
  for (const c of comments.slice(0, 15)) {
    const u = await User.findById(c.userId).select('nickname').lean();
    const post = seedPosts.find(p => String(p._id) === String(c.postId));
    console.log(`   · ${u?.nickname || '(?)'} → "${(c.content||'').slice(0,40)}" (글: ${(post?.title||'').slice(0,20)})`);
  }

  // 4) 시드 글 좋아요
  const liked = seedPosts.length
    ? await Post.find({ _id: { $in: seedPostIds }, likeCount: { $gt: 0 } }).select('title likeCount').lean()
    : [];
  console.log('\n━━ 4) 좋아요 받은 시드 글 ━━');
  console.log(`${liked.length}개`);
  liked.slice(0, 15).forEach(p => console.log(`   · ❤️ ${p.likeCount} — "${(p.title||'').slice(0,30)}"`));

  await mongoose.disconnect();
})().catch(e => { console.error('오류:', e); process.exit(1); });
