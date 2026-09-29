/**
 * Clear the city field on posts from non-local boards (free, anonymous, info, immigration,
 * study abroad, working holiday, currency exchange and so on). Removes the residue of an old bug
 * where the profile city (Toronto, say) was copied onto every post at signup.
 *
 * Idempotent: posts already cleared are excluded from the update.
 * Run: node server/scripts/clearNonLocalCity.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Board = require('../models/Board');
const Post = require('../models/Post');
const { LOCAL_BOARD_SLUGS } = require('../constants/boards');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ connected to the DB');

  const localBoards = await Board.find({ slug: { $in: LOCAL_BOARD_SLUGS } }).select('_id slug').lean();
  const localBoardIds = localBoards.map(b => b._id);
  console.log(`${localBoards.length} local boards:`, localBoards.map(b => b.slug).join(', '));

  const filter = {
    boardId: { $nin: localBoardIds },
    city: { $nin: [null, ''] },
  };

  const before = await Post.countDocuments(filter);
  console.log(`posts to clean up: ${before}`);

  if (before === 0) {
    console.log('nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  const result = await Post.updateMany(filter, { $set: { city: '' } });
  console.log(`✅ update complete: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('migration failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
