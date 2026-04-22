// 차단 관련 헬퍼
const Block = require('../models/Block');

/**
 * 양방향 차단 ID 모음 — 양쪽 어느 방향이든 차단이면 숨김
 * @param {string} userId
 * @param {'hideContent'|'blockChat'} flag
 * @returns {Promise<string[]>} 숨길 사용자 ID 배열 (string)
 */
async function getBlockedUserIds(userId, flag = 'hideContent') {
  if (!userId) return [];
  const filter = { [flag]: true, $or: [{ blockerId: userId }, { blockedId: userId }] };
  const rows = await Block.find(filter).select('blockerId blockedId').lean();
  const set = new Set();
  for (const r of rows) {
    const other = String(r.blockerId) === String(userId) ? r.blockedId : r.blockerId;
    set.add(String(other));
  }
  return [...set];
}

/**
 * 두 사용자 사이에 chat 차단이 걸려있는지 (양방향)
 */
async function isChatBlocked(userA, userB) {
  if (!userA || !userB) return false;
  const exists = await Block.findOne({
    blockChat: true,
    $or: [
      { blockerId: userA, blockedId: userB },
      { blockerId: userB, blockedId: userA },
    ],
  }).select('_id').lean();
  return !!exists;
}

module.exports = { getBlockedUserIds, isChatBlocked };
