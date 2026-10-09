const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const University = require('../models/University');
const { generateCode, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const { verifyAppleIdToken, verifyGoogleIdToken } = require('../utils/socialAuth');

// Automated tests skip the rate limit (NODE_ENV=test is never set in production)
const skipInTest = () => process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  skip: skipInTest,
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});
const codeLimiter = rateLimit({
  skip: skipInTest,
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests. Please try again later.' },
});
const registerLimiter = rateLimit({
  skip: skipInTest,
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts. Please try again later.' },
});
const resetLimiter = rateLimit({
  skip: skipInTest,
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again later.' },
});

const router = express.Router();
const ALLOWED_SIGNUP_ROLES = [ROLES.STUDENT, ROLES.WORKING_HOLIDAY, ROLES.GENERAL];

// Pre-signup email codes, held in memory
const pendingCodes = new Map(); // email -> { code, expires }

// POST /api/auth/send-code — send the pre-signup email verification code
router.post('/send-code', codeLimiter, async (req, res) => {
  const { email } = req.body || {};
  try {
    if (!email) return res.status(400).json({ success: false, message: '이메일을 입력해주세요.' });

    // Check whether the email is already registered
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: '이미 가입된 이메일입니다.' });

    const code = generateCode();
    pendingCodes.set(email.toLowerCase(), {
      code,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    await sendVerificationEmail(email, code);
    res.json({ success: true, message: '인증 코드가 발송되었습니다.' });
  } catch (err) {
    console.error('[send-code] 이메일 발송 실패:', {
      to: email,
      code: err.code,
      command: err.command,
      response: err.response,
      message: err.message,
    });
    res.status(500).json({ success: false, message: `이메일 발송에 실패했습니다. (${err.code || err.message || 'unknown'})` });
  }
});

// POST /api/auth/check-code — check the pre-signup code
router.post('/check-code', codeLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: '이메일과 코드를 입력해주세요.' });

    const pending = pendingCodes.get(email.toLowerCase());
    if (!pending) return res.status(400).json({ success: false, message: '인증 코드를 먼저 발송해주세요.' });
    if (pending.expires < Date.now()) {
      pendingCodes.delete(email.toLowerCase());
      return res.status(400).json({ success: false, message: '인증 코드가 만료되었습니다.' });
    }
    if (pending.code !== code.trim()) {
      return res.status(400).json({ success: false, message: '인증 코드가 일치하지 않습니다.' });
    }

    // Verified — mark the account
    pending.verified = true;
    res.json({ success: true, message: '이메일 인증이 완료되었습니다.' });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/forgot-password — mail a reset code to a registered address
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter your email.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    // Defends against user enumeration — the response is identical whether or not the account exists
    if (user) {
      const code = generateCode();
      user.resetCode = code;
      user.resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();
      try {
        await sendPasswordResetEmail(user.email, code);
      } catch (mailErr) {
        console.error('[api] reset mail send failed:', mailErr);
      }
    }
    res.json({
      success: true,
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/verify-reset-code — pre-check the reset code without consuming it
router.post('/verify-reset-code', resetLimiter, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required.' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user || !user.resetCode || !user.resetExpires) {
      return res.status(400).json({ success: false, code: 'INVALID_CODE', message: 'Invalid or expired code.' });
    }
    if (user.resetExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, code: 'EXPIRED_CODE', message: 'Code expired. Please request a new one.' });
    }
    if (user.resetCode !== String(code).trim()) {
      return res.status(400).json({ success: false, code: 'INVALID_CODE', message: 'Invalid code.' });
    }
    res.json({ success: true, message: 'Code verified.' });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/reset-password — verify the code and change the password
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user || !user.resetCode || !user.resetExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    }
    if (user.resetExpires.getTime() < Date.now()) {
      user.resetCode = '';
      user.resetExpires = null;
      await user.save();
      return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
    }
    if (user.resetCode !== String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.resetCode = '';
    user.resetExpires = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate every existing token
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    res.json({ success: true, message: 'Password has been reset. Please log in with your new password.' });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, nickname, role, city } = req.body;
    if (!email || !password || !nickname) {
      return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '비밀번호는 6자 이상이어야 합니다.' });
    }

    const userRole = role && ALLOWED_SIGNUP_ROLES.includes(role) ? role : ROLES.GENERAL;

    const existing = await User.findOne({ $or: [{ email }, { nickname }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? '이메일' : '닉네임';
      return res.status(409).json({ success: false, message: `이미 사용 중인 ${field}입니다.` });
    }

    // Confirm the email verification finished
    const pending = pendingCodes.get(email.toLowerCase());
    if (!pending || !pending.verified) {
      return res.status(400).json({ success: false, message: '이메일 인증을 먼저 완료해주세요.' });
    }
    pendingCodes.delete(email.toLowerCase()); // Drop the now-used code

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      nickname,
      role: userRole,
      city: city || '',
      emailVerified: true,
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, nickname: user.nickname, v: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: userResponse(user),
      },
    });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/verify-email — check the email verification code
router.post('/verify-email', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: '인증 코드를 입력해주세요.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    if (user.emailVerified) return res.json({ success: true, message: '이미 인증되었습니다.' });

    if (user.emailVerifyCode !== code.trim()) {
      return res.status(400).json({ success: false, message: '인증 코드가 일치하지 않습니다.' });
    }
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return res.status(400).json({ success: false, message: '인증 코드가 만료되었습니다. 재발송해주세요.' });
    }

    user.emailVerified = true;
    user.emailVerifyCode = '';
    user.emailVerifyExpires = null;
    await user.save();

    res.json({ success: true, message: '이메일 인증이 완료되었습니다.' });
  } catch (err) {
    console.error('이메일 인증 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/resend-email — resend the verification code
router.post('/resend-email', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    if (user.emailVerified) return res.json({ success: true, message: '이미 인증되었습니다.' });

    const code = generateCode();
    user.emailVerifyCode = code;
    user.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, code);
    res.json({ success: true, message: '인증 코드가 재발송되었습니다.' });
  } catch (err) {
    console.error('인증 코드 재발송 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/login
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 30;

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // Soft-deleted account — refuse the login
    if (user.status === 'deleted') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DELETED', message: '탈퇴 처리된 계정입니다.' });
    }

    // Social-only account with no password — refuse password login
    if (!user.passwordHash) {
      const provider = user.appleSub ? 'Apple' : (user.googleSub ? 'Google' : '소셜');
      return res.status(401).json({
        success: false,
        code: 'SOCIAL_ONLY',
        message: `이 계정은 ${provider} 로그인을 사용해주세요.`,
      });
    }

    // Check the lockout, releasing it automatically once the window has passed
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: `Too many failed attempts. Account locked for ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const newCount = (user.failedLoginCount || 0) + 1;
      const update = { failedLoginCount: newCount };
      if (newCount >= MAX_FAILED_LOGINS) {
        update.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        update.failedLoginCount = 0; // Reset the counter after a lockout so the user can try again once it lifts
      }
      await User.updateOne({ _id: user._id }, { $set: update });
      const remaining = Math.max(0, MAX_FAILED_LOGINS - newCount);
      const lockedNow = newCount >= MAX_FAILED_LOGINS;
      return res.status(401).json({
        success: false,
        code: lockedNow ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
        message: lockedNow
          ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
          : `이메일 또는 비밀번호가 올바르지 않습니다.${remaining > 0 ? ` (${remaining} 회 남음)` : ''}`,
      });
    }

    // Successful login — reset the counter and clear the lockout
    if (user.failedLoginCount || user.lockedUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0, lockedUntil: null } });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, nickname: user.nickname, v: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: userResponse(user),
      },
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/logout — invalidate this token and every other token for the same user
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
    res.json({ success: true, message: 'Logged out.' });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    // Only whether a passwordHash exists matters (the value itself never reaches the response)
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    res.json({
      success: true,
      data: userResponse(user),
    });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/auth/check-nickname?nickname=xxx
router.get('/check-nickname', async (req, res) => {
  try {
    const raw = (req.query.nickname || '').toString().trim();
    if (raw.length < 2 || raw.length > 20) {
      return res.status(400).json({ success: false, message: '닉네임은 2~20자여야 합니다.' });
    }
    const authHeader = req.headers.authorization;
    let selfId = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        selfId = decoded.id;
      } catch {}
    }
    const existing = await User.findOne({ nickname: raw });
    const available = !existing || (selfId && String(existing._id) === String(selfId));
    res.json({ success: true, data: { available } });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// GET /api/auth/universities — active schools only, sorted
router.get('/universities', async (req, res) => {
  try {
    const list = await University.find({ active: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name fullName')
      .lean();
    res.json({ success: true, data: list.map(u => ({ name: u.fullName, shortName: u.name })) });
  } catch (err) {
    console.error('[api]', req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// DELETE /api/auth/me — delete the account
// Confirms intent, then cleans up the account and its data.
// Retyping the nickname is the check for every account. The request is already authenticated, and
// a password could never work for a social signup — nor for an email account that later linked
// Apple/Google and has not thought about its password since. One path, no dead ends.
// A password is still accepted when no nickname is sent: app builds older than the OTA that drops
// the password field keep sending one, and an OTA only reaches builds on the same runtimeVersion.
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const { password, reason, confirmText } = req.body || {};
    const userId = req.user.id;

    const currentUser = await User.findById(userId).select('+passwordHash');
    if (!currentUser) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });

    const typedNickname = String(confirmText ?? '').trim();
    if (typedNickname) {
      if (typedNickname !== currentUser.nickname) {
        return res.status(401).json({ success: false, message: '닉네임이 일치하지 않습니다.' });
      }
    } else if (password) {
      // Legacy client
      if (!currentUser.passwordHash) {
        return res.status(400).json({ success: false, message: '닉네임을 입력해주세요.' });
      }
      const isMatch = await bcrypt.compare(password, currentUser.passwordHash);
      if (!isMatch) return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    } else {
      return res.status(400).json({ success: false, message: '닉네임을 입력해주세요.' });
    }

    // Log the deletion reason (used to improve the service)
    if (reason) {
      console.log(`[auth] account deletion reason (user: ${userId}): ${reason}`);
    }

    const Post = require('../models/Post');
    const Comment = require('../models/Comment');
    const Block = require('../models/Block');
    const Report = require('../models/Report');
    const VerifyRequest = require('../models/VerifyRequest');
    const Notification = require('../models/Notification');
    const Inquiry = require('../models/Inquiry');
    const Bookmark = require('../models/Bookmark');
    const Message = require('../models/Message');

    // 1. Withdraw likes the user left on other people's posts
    await Post.updateMany(
      { likedBy: userId },
      { $pull: { likedBy: userId }, $inc: { likeCount: -1 } }
    );

    // 2. Hard-delete the user's posts, cascading to their comments, bookmarks and reports
    const userPostIds = await Post.find({ userId }).distinct('_id');
    if (userPostIds.length) {
      await Promise.all([
        Comment.deleteMany({ postId: { $in: userPostIds } }),
        Bookmark.deleteMany({ postId: { $in: userPostIds } }),
        Report.deleteMany({ targetType: 'post', targetId: { $in: userPostIds } }),
        Post.deleteMany({ _id: { $in: userPostIds } }),
      ]);
    }

    // 3. Hard-delete the comments the user left on other people's posts
    //    - decrement the parent post's commentCount
    //    - delete reports targeting those comments
    const userComments = await Comment.find({ userId }).select('_id postId').lean();
    if (userComments.length) {
      const commentIds = userComments.map(c => c._id);
      // Tally per postId (the user's own posts were already deleted wholesale above, so they drop out naturally)
      const countByPost = new Map();
      for (const c of userComments) {
        if (!c.postId) continue;
        countByPost.set(String(c.postId), (countByPost.get(String(c.postId)) || 0) + 1);
      }
      const decrementOps = [];
      for (const [postId, count] of countByPost) {
        decrementOps.push(Post.findByIdAndUpdate(postId, { $inc: { commentCount: -count } }));
      }
      await Promise.all([
        ...decrementOps,
        Report.deleteMany({ targetType: 'comment', targetId: { $in: commentIds } }),
        Comment.deleteMany({ _id: { $in: commentIds } }),
      ]);
    }

    // 4. Chat messages — mask the content and null the sender, leaving the other party's thread readable
    await Message.updateMany(
      { senderId: userId },
      { $set: { senderId: null, content: '(탈퇴한 사용자가 보낸 메시지)' } }
    );

    // 5. Hard-delete everything else belonging to the user
    await Promise.all([
      Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
      Report.deleteMany({ reporterId: userId }), // Reports the user filed
      VerifyRequest.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      Inquiry.deleteMany({ userId }),
      Bookmark.deleteMany({ userId }),
      // Clear the school president seat so no dangling reference is left
      University.updateMany({ leaderUserId: userId }, { $set: { leaderUserId: null } }),
    ]);

    // The account is soft-deleted: status becomes 'deleted' while the identity (email, nickname) is retained.
    // Bumping tokenVersion invalidates existing JWTs at once (requireAuth also blocks 'deleted').
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          deleteReason: reason ? String(reason).slice(0, 500) : '',
          pushToken: '',          // Stop sending push
          lockedUntil: null,
          failedLoginCount: 0,
        },
        $inc: { tokenVersion: 1 },
      }
    );
    res.json({ success: true, message: '회원탈퇴가 완료되었습니다.' });
  } catch (err) {
    console.error('[auth] delete account error:', err);
    res.status(500).json({ success: false, message: '회원탈퇴 처리 중 오류가 발생했습니다.' });
  }
});

// ── Social login ────────────────────────────────────────
// Shared flow:
//   1) the client sends an Apple/Google idToken
//   2) the server verifies it and extracts { sub, email }
//   3) match against existing users:
//      - by appleSub/googleSub first
//      - then by email (auto-link)
//   4) on a match, issue a JWT (login complete)
//   5) with no match, issue a preReg JWT (for the onboarding screen)

const socialLimiter = rateLimit({
  skip: skipInTest,
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const PREREG_TTL_SEC = 30 * 60; // 30 minutes

function makeAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, nickname: user.nickname, v: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function makePreRegToken(provider, sub, email) {
  return jwt.sign(
    { kind: 'preReg', provider, sub, email },
    process.env.JWT_SECRET,
    { expiresIn: `${PREREG_TTL_SEC}s` }
  );
}

function userResponse(user) {
  return {
    id: user._id,
    email: user.email,
    nickname: user.nickname,
    location: user.location,
    school: user.school,
    bio: user.bio,
    role: user.role,
    verified: user.verified,
    university: user.university,
    city: user.city,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified ?? false,
    // Social-only signups have no password, which decides whether account deletion asks for a
    // password or for the nickname. Must be on *every* response that carries a user, not just
    // /auth/me — a Google user who deletes right after signing in never calls /auth/me first.
    hasPassword: !!user.passwordHash,
  };
}

async function findOrPreReg(provider, sub, email) {
  // Match on the provider sub first
  const subQuery = provider === 'apple' ? { appleSub: sub } : { googleSub: sub };
  let user = await User.findOne(subQuery);
  if (user) return { user };

  // Then match on email (auto-link)
  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      // Attach the social sub to the existing account
      if (provider === 'apple' && !user.appleSub) user.appleSub = sub;
      if (provider === 'google' && !user.googleSub) user.googleSub = sub;
      // Social sign-in is already verified, so set emailVerified automatically
      user.emailVerified = true;
      await user.save();
      return { user, linked: true };
    }
  }

  // No match — onboarding is required
  return { user: null };
}

// POST /api/auth/apple
router.post('/apple', socialLimiter, async (req, res) => {
  try {
    const { identityToken } = req.body || {};
    if (!identityToken) return res.status(400).json({ success: false, message: 'identityToken 필요' });

    const { sub, email } = await verifyAppleIdToken(identityToken);
    const { user, linked } = await findOrPreReg('apple', sub, email);

    if (user?.status === 'deleted') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DELETED', message: '탈퇴 처리된 계정입니다.' });
    }
    if (user) {
      const token = makeAccessToken(user);
      return res.json({ success: true, data: { token, user: userResponse(user), linked: !!linked } });
    }

    // New user: issue a preReg token and send the client to the onboarding screen
    const preRegToken = makePreRegToken('apple', sub, email || '');
    res.json({
      success: true,
      data: { needsOnboarding: true, preRegToken, provider: 'apple', email: email || '' },
    });
  } catch (err) {
    console.error('[auth] apple login error:', {
      message: err.message,
      hasClientId: !!process.env.APPLE_CLIENT_ID,
      clientId: process.env.APPLE_CLIENT_ID,
    });
    res.status(401).json({
      success: false,
      message: 'Apple 로그인 검증에 실패했어요.',
      debug: err.message || 'unknown',
    });
  }
});

// POST /api/auth/google
router.post('/google', socialLimiter, async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ success: false, message: 'idToken 필요' });

    const { sub, email } = await verifyGoogleIdToken(idToken);
    const { user, linked } = await findOrPreReg('google', sub, email);

    if (user?.status === 'deleted') {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DELETED', message: '탈퇴 처리된 계정입니다.' });
    }
    if (user) {
      const token = makeAccessToken(user);
      return res.json({ success: true, data: { token, user: userResponse(user), linked: !!linked } });
    }

    const preRegToken = makePreRegToken('google', sub, email || '');
    res.json({
      success: true,
      data: { needsOnboarding: true, preRegToken, provider: 'google', email: email || '' },
    });
  } catch (err) {
    console.error('[auth] google login error:', {
      message: err.message,
      hasIosId: !!process.env.GOOGLE_IOS_CLIENT_ID,
      hasWebId: !!process.env.GOOGLE_WEB_CLIENT_ID,
    });
    res.status(401).json({
      success: false,
      message: 'Google 로그인 검증에 실패했어요.',
      debug: err.message || 'unknown',
    });
  }
});

// POST /api/auth/social-complete
// Finish signup with the preReg token plus the extra details (nickname, type, city, terms)
router.post('/social-complete', socialLimiter, async (req, res) => {
  try {
    const { preRegToken, nickname, role, city } = req.body || {};
    if (!preRegToken || !nickname || !role) {
      return res.status(400).json({ success: false, message: '필수 항목이 누락됐어요.' });
    }
    if (!ALLOWED_SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: '올바른 유형을 선택해주세요.' });
    }
    const cleanNickname = String(nickname).trim();
    if (cleanNickname.length < 2 || cleanNickname.length > 20) {
      return res.status(400).json({ success: false, message: '닉네임은 2~20자로 입력해주세요.' });
    }

    let payload;
    try {
      payload = jwt.verify(preRegToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: '인증이 만료됐어요. 다시 로그인해주세요.' });
    }
    if (payload?.kind !== 'preReg' || !payload.provider || !payload.sub) {
      return res.status(401).json({ success: false, message: '잘못된 인증 토큰이에요.' });
    }

    // Check the nickname is not taken
    const dup = await User.findOne({ nickname: cleanNickname });
    if (dup) return res.status(409).json({ success: false, message: '이미 사용 중인 닉네임입니다.' });

    // Re-check whether a concurrent request already created this sub
    const subQuery = payload.provider === 'apple' ? { appleSub: payload.sub } : { googleSub: payload.sub };
    const existing = await User.findOne(subQuery);
    if (existing) {
      if (existing.status === 'deleted') {
        return res.status(403).json({ success: false, code: 'ACCOUNT_DELETED', message: '탈퇴 처리된 계정입니다.' });
      }
      const token = makeAccessToken(existing);
      return res.json({ success: true, data: { token, user: userResponse(existing) } });
    }

    // Check the email once more too (a race, or a signup through another path)
    const email = String(payload.email || '').toLowerCase();
    if (email) {
      const byEmail = await User.findOne({ email });
      if (byEmail) {
        if (byEmail.status === 'deleted') {
          return res.status(403).json({ success: false, code: 'ACCOUNT_DELETED', message: '탈퇴 처리된 계정입니다.' });
        }
        if (payload.provider === 'apple' && !byEmail.appleSub) byEmail.appleSub = payload.sub;
        if (payload.provider === 'google' && !byEmail.googleSub) byEmail.googleSub = payload.sub;
        byEmail.emailVerified = true;
        await byEmail.save();
        const token = makeAccessToken(byEmail);
        return res.json({ success: true, data: { token, user: userResponse(byEmail), linked: true } });
      }
    }

    if (!email) {
      return res.status(400).json({ success: false, message: '이메일이 필요한 가입이에요. 다시 시도해주세요.' });
    }

    const user = await User.create({
      email,
      nickname: cleanNickname,
      role,
      city: city ? String(city).trim() : '',
      emailVerified: true,
      passwordHash: null, // Social only
      ...(payload.provider === 'apple' ? { appleSub: payload.sub } : { googleSub: payload.sub }),
    });

    const token = makeAccessToken(user);
    res.status(201).json({ success: true, data: { token, user: userResponse(user) } });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: '이미 가입된 계정이에요.' });
    }
    console.error('[auth] social-complete error:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했어요.' });
  }
});

module.exports = router;
