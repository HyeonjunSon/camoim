// Block-related helpers
const Block = require('../models/Block');
const { createCache } = require('./cache');

// Per-user block-list cache — nearly every list API reads it on every request.
// The hook in models/Block.js invalidates everything on block/unblock, so a single instance is always current.
// The TTL is short on purpose: with more than one instance, the others lag by up to the TTL.
const cache = createCache({ ttlMs: 30_000 });

/**
 * Set of bidirectionally blocked IDs — hidden if a block exists in either direction
 * @param {string} userId
 * @param {'hideContent'|'blockChat'} flag
 * @returns {Promise<string[]>} user IDs to hide. The array is shared, so do not mutate it
 */
async function getBlockedUserIds(userId, flag = 'hideContent') {
  if (!userId) return [];
  return cache.get(`${flag}:${userId}`, async () => {
    const filter = { [flag]: true, $or: [{ blockerId: userId }, { blockedId: userId }] };
    const rows = await Block.find(filter).select('blockerId blockedId').lean();
    const set = new Set();
    for (const r of rows) {
      const other = String(r.blockerId) === String(userId) ? r.blockedId : r.blockerId;
      set.add(String(other));
    }
    return Object.freeze([...set]);
  });
}

/**
 * Whether a chat block stands between two users (in either direction)
 * Equivalent, since getBlockedUserIds(A, 'blockChat') already covers everyone A blocked and everyone who blocked A
 */
async function isChatBlocked(userA, userB) {
  if (!userA || !userB) return false;
  const ids = await getBlockedUserIds(String(userA), 'blockChat');
  return ids.includes(String(userB));
}

function invalidateBlockCache() {
  cache.clear();
}

module.exports = { getBlockedUserIds, isChatBlocked, invalidateBlockCache };
