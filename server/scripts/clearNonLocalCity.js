/**
 * 비-로컬 보드(자유/익명/정보/이민/유학/워홀/환전 등) 글의 city 필드를 빈값으로 정리.
 * 회원가입 시 프로필 도시(예: Toronto)가 모든 글에 자동 복사되던 과거 버그의 잔재를 제거.
 *
 * 멱등: 이미 비어있는 글은 업데이트 대상에서 제외됨.
 * 실행: node server/scripts/clearNonLocalCity.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Board = require('../models/Board');
const Post = require('../models/Post');
const { LOCAL_BOARD_SLUGS } = require('../constants/boards');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI 환경변수가 없습니다.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ DB 연결');

  const localBoards = await Board.find({ slug: { $in: LOCAL_BOARD_SLUGS } }).select('_id slug').lean();
  const localBoardIds = localBoards.map(b => b._id);
  console.log(`로컬 보드 ${localBoards.length}개:`, localBoards.map(b => b.slug).join(', '));

  const filter = {
    boardId: { $nin: localBoardIds },
    city: { $nin: [null, ''] },
  };

  const before = await Post.countDocuments(filter);
  console.log(`정리 대상 글 수: ${before}`);

  if (before === 0) {
    console.log('정리할 글이 없습니다.');
    await mongoose.disconnect();
    return;
  }

  const result = await Post.updateMany(filter, { $set: { city: '' } });
  console.log(`✅ 업데이트 완료: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('마이그레이션 실패:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
