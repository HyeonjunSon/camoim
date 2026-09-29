/**
 * Creates the App Store reviewer test account straight in the DB.
 * The account skips email verification and can log in immediately.
 *
 * Usage:
 *   cd server
 *   REVIEWER_EMAIL="apple.reviewer@camoim.app" \
 *   REVIEWER_PASSWORD="your-password-here" \
 *   REVIEWER_NICKNAME="App Reviewer" \
 *   node scripts/createReviewerAccount.js
 *
 * Or keep them in a .env.local file (gitignored):
 *   REVIEWER_EMAIL=...
 *   REVIEWER_PASSWORD=...
 *   REVIEWER_NICKNAME=...
 *   then: node -r dotenv/config scripts/createReviewerAccount.js dotenv_config_path=.env.local
 *
 * To create it on the production (Atlas) DB, override MONGODB_URI too:
 *   MONGODB_URI="mongodb+srv://..." REVIEWER_EMAIL="..." REVIEWER_PASSWORD="..." node ...
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const email     = process.env.REVIEWER_EMAIL;
const password  = process.env.REVIEWER_PASSWORD;
const nickname  = process.env.REVIEWER_NICKNAME || 'App Reviewer';
const role      = process.env.REVIEWER_ROLE || 'general';

if (!email || !password) {
  console.error('❌ Set the REVIEWER_EMAIL and REVIEWER_PASSWORD environment variables.');
  console.error('Example:');
  console.error('  REVIEWER_EMAIL="apple.reviewer@camoim.app" REVIEWER_PASSWORD="..." node scripts/createReviewerAccount.js');
  process.exit(1);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ connected to Mongo');

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('ℹ️  the account already exists — resetting only the password.');
      existing.passwordHash = await bcrypt.hash(password, 10);
      existing.emailVerified = true;
      existing.status = 'active';
      await existing.save();
      console.log('✅ password reset and email marked verified');
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await User.create({
        email: email.toLowerCase(),
        passwordHash,
        nickname,
        role,
        emailVerified: true, // Skip verification
        verified: false,
        status: 'active',
      });
      console.log('✅ reviewer account created');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 App Store Connect Sign-in Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Username: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
