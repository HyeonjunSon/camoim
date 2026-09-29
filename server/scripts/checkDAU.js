/**
 * Active-user diagnostics — approximate DAU/WAU.
 * Usage: cd server && railway run node scripts/checkDAU.js
 *
 * The User schema has no lastLogin, so this is not exact, but:
 *  - User.updatedAt: push-token refreshes, profile edits and so on act as an app-launch proxy
 *  - Post/Comment.createdAt: unambiguous write activity (the more reliable signal)
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

  // ── Exclude seed accounts
  const seedEmails = /^seed\d+@/;
  const seedIds = (await User.find({ email: seedEmails }).select('_id').lean()).map(u => u._id);
  const seedIdStrs = new Set(seedIds.map(String));
  const notSeed = { _id: { $nin: seedIds } };

  const totalReal = await User.countDocuments(notSeed);
  const totalActiveStatus = await User.countDocuments({ ...notSeed, status: 'active' });
  const hasPushToken = await User.countDocuments({ ...notSeed, pushToken: { $ne: '' } });

  console.log('━━ All users (seed accounts excluded) ━━');
  console.log(`registered: ${totalReal}`);
  console.log(`status=active: ${totalActiveStatus}`);
  console.log(`has a pushToken (launched the app at least once): ${hasPushToken}`);

  // ── Approximation from User.updatedAt (bumped on push-token refresh and profile edits)
  console.log('\n━━ Approximate activity from User.updatedAt ━━');
  const dauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t24h } });
  const wauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t7d  } });
  const mauProxy  = await User.countDocuments({ ...notSeed, updatedAt: { $gte: t30d } });
  console.log(`updated in the last 24h: ${dauProxy} (DAU upper bound)`);
  console.log(`last 7 days: ${wauProxy} (WAU upper bound)`);
  console.log(`last 30 days: ${mauProxy} (MAU upper bound)`);

  // ── Unambiguous write activity
  console.log('\n━━ Write activity (real users) ━━');
  const postersDay = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t24h } });
  const postersWeek = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const postersMonth = await Post.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`posted in the last 24h: ${postersDay.length}`);
  console.log(`posted in the last 7 days: ${postersWeek.length}`);
  console.log(`posted in the last 30 days: ${postersMonth.length}`);

  const commWeek = await Comment.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const commMonth = await Comment.distinct('userId', { userId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`commented in the last 7 days: ${commWeek.length}`);
  console.log(`commented in the last 30 days: ${commMonth.length}`);

  // ── Chat (real community activity)
  const chatWeek = await Message.distinct('senderId', { senderId: { $nin: seedIds }, createdAt: { $gte: t7d } });
  const chatMonth = await Message.distinct('senderId', { senderId: { $nin: seedIds }, createdAt: { $gte: t30d } });
  console.log(`\n━━ Chat activity ━━`);
  console.log(`sent a chat in the last 7 days: ${chatWeek.length}`);
  console.log(`sent a chat in the last 30 days: ${chatMonth.length}`);

  // ── New signup trend
  console.log('\n━━ New signup trend ━━');
  const newDay = await User.countDocuments({ ...notSeed, createdAt: { $gte: t24h } });
  const newWeek = await User.countDocuments({ ...notSeed, createdAt: { $gte: t7d } });
  const newMonth = await User.countDocuments({ ...notSeed, createdAt: { $gte: t30d } });
  console.log(`new in the last 24h: ${newDay}`);
  console.log(`new in the last 7 days: ${newWeek}`);
  console.log(`new in the last 30 days: ${newMonth}`);

  // ── Share of silent users
  const silent7 = totalReal - wauProxy;
  console.log(`\n━━ Silent users ━━`);
  console.log(`active in some way over 7 days: ${wauProxy} / ${totalReal} (${((wauProxy/totalReal)*100).toFixed(1)}%)`);
  console.log(`silent: ${silent7}`);

  await mongoose.disconnect();
})().catch(e => { console.error('error:', e); process.exit(1); });
