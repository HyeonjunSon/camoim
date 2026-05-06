const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { UNIVERSITIES } = require('../constants/universities');
const { generateCode, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});
const codeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests. Please try again later.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts. Please try again later.' },
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again later.' },
});

const router = express.Router();
const ALLOWED_SIGNUP_ROLES = [ROLES.STUDENT, ROLES.WORKING_HOLIDAY, ROLES.GENERAL];

// 가입 전 이메일 인증 코드 임시 저장 (메모리)
const pendingCodes = new Map(); // email -> { code, expires }

// POST /api/auth/send-code — 가입 전 이메일 인증 코드 발송
router.post('/send-code', codeLimiter, async (req, res) => {
  const { email } = req.body || {};
  try {
    if (!email) return res.status(400).json({ success: false, message: '이메일을 입력해주세요.' });

    // 이미 가입된 이메일인지 확인
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: '이미 가입된 이메일입니다.' });

    const code = generateCode();
    pendingCodes.set(email.toLowerCase(), {
      code,
      expires: Date.now() + 10 * 60 * 1000, // 10분
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

// POST /api/auth/check-code — 가입 전 인증 코드 확인
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

    // 인증 성공 — verified 마킹
    pending.verified = true;
    res.json({ success: true, message: '이메일 인증이 완료되었습니다.' });
  } catch (err) {
    console.error("[api]", req.method, req.originalUrl, err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/forgot-password — 가입된 이메일에 재설정 코드 전송
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter your email.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    // user enumeration 방어 — 가입 여부와 무관하게 동일 응답
    if (user) {
      const code = generateCode();
      user.resetCode = code;
      user.resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15분
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

// POST /api/auth/verify-reset-code — 비밀번호 재설정 코드 사전 검증 (consume 안 함)
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

// POST /api/auth/reset-password — 코드 검증 + 비밀번호 변경
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
    user.tokenVersion = (user.tokenVersion || 0) + 1; // 기존 모든 토큰 무효화
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

    // 이메일 인증 완료 여부 확인
    const pending = pendingCodes.get(email.toLowerCase());
    if (!pending || !pending.verified) {
      return res.status(400).json({ success: false, message: '이메일 인증을 먼저 완료해주세요.' });
    }
    pendingCodes.delete(email.toLowerCase()); // 사용 완료된 코드 제거

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
        user: {
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
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/verify-email — 이메일 인증 코드 확인
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

// POST /api/auth/resend-email — 인증 코드 재발송
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

    // 잠금 상태 확인 — 잠긴 시간이 지났으면 자동 해제
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
        update.failedLoginCount = 0; // 잠금 후 카운트 리셋 (잠금 풀린 후 다시 시도 가능)
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

    // 로그인 성공 — 카운터 리셋 + 잠금 해제
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
        user: {
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
          emailVerified: user.emailVerified ?? false,
        },
      },
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// POST /api/auth/logout — 현재 토큰 + 동일 사용자의 모든 기존 토큰 무효화
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
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    res.json({
      success: true,
      data: {
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
      },
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

// GET /api/auth/universities
router.get('/universities', (req, res) => {
  res.json({ success: true, data: UNIVERSITIES.map(u => ({ name: u.name, shortName: u.shortName })) });
});

// DELETE /api/auth/me — 회원탈퇴
// 비밀번호 확인 후 본인 계정 및 관련 데이터 정리
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const { password, reason } = req.body || {};
    const userId = req.user.id;

    // 비밀번호 확인
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    if (!password) return res.status(400).json({ success: false, message: '비밀번호를 입력해주세요.' });
    const isMatch = await bcrypt.compare(password, currentUser.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });

    // 탈퇴 이유 로깅 (서비스 개선용)
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

    // 1. 본인 좋아요 회수 (다른 사람 글에서)
    await Post.updateMany(
      { likedBy: userId },
      { $pull: { likedBy: userId }, $inc: { likeCount: -1 } }
    );

    // 2. 본인 게시글 hard delete + 그 글에 달린 모든 댓글/북마크/신고 cascade
    const userPostIds = await Post.find({ userId }).distinct('_id');
    if (userPostIds.length) {
      await Promise.all([
        Comment.deleteMany({ postId: { $in: userPostIds } }),
        Bookmark.deleteMany({ postId: { $in: userPostIds } }),
        Report.deleteMany({ targetType: 'post', targetId: { $in: userPostIds } }),
        Post.deleteMany({ _id: { $in: userPostIds } }),
      ]);
    }

    // 3. 본인이 다른 사람 글에 단 댓글 hard delete
    //    - 부모 글의 commentCount 감소
    //    - 댓글 대상 신고 삭제
    const userComments = await Comment.find({ userId }).select('_id postId').lean();
    if (userComments.length) {
      const commentIds = userComments.map(c => c._id);
      // postId별 카운트 집계 (자기 글은 이미 위에서 통째로 삭제됐으므로 자연스럽게 빠짐)
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

    // 4. 채팅 메시지 — 내용 마스킹 + 발신자 null (상대방 채팅 흐름은 유지)
    await Message.updateMany(
      { senderId: userId },
      { $set: { senderId: null, content: '(탈퇴한 사용자가 보낸 메시지)' } }
    );

    // 5. 그 외 본인 데이터 hard delete
    await Promise.all([
      Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
      Report.deleteMany({ reporterId: userId }), // 본인이 한 신고
      VerifyRequest.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
      Inquiry.deleteMany({ userId }),
      Bookmark.deleteMany({ userId }),
    ]);

    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: '회원탈퇴가 완료되었습니다.' });
  } catch (err) {
    console.error('[auth] delete account error:', err);
    res.status(500).json({ success: false, message: '회원탈퇴 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
