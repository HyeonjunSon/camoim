const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Board = require('../models/Board');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { UNIVERSITIES, findUniversityByEmail } = require('../constants/universities');
const { generateCode, sendVerificationEmail } = require('../utils/mailer');

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

// 학교 인증 시 생성할 게시판 4종 템플릿
const UNIVERSITY_BOARD_TEMPLATES = [
  { slugSuffix: 'free',      name: '학교자유게시판',   description: '학교 친구들과 자유롭게 이야기해요',         isAnonymousAllowed: false, sortOrder: 1 },
  { slugSuffix: 'anonymous', name: '학교 익명',        description: '익명으로 털어놓아요',                       isAnonymousAllowed: true,  sortOrder: 2 },
  { slugSuffix: 'meetup',    name: '학교 한인 모임',   description: '밥약·스터디·운동·동아리 같이 할 사람 찾아요', isAnonymousAllowed: false, sortOrder: 3 },
  { slugSuffix: 'info',      name: '학교 유학생 정보', description: '학교 생활·비자·세금 등 궁금한 걸 물어봐요',   isAnonymousAllowed: false, sortOrder: 4 },
];

async function ensureUniversityBoards(universityShortName) {
  // slug 생성은 server/index.js의 seed/migration과 동일해야 중복 방지됨
  // (괄호 포함 학교명이 있어 반드시 [()]도 제거)
  const prefix = universityShortName.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, '-');
  for (const tmpl of UNIVERSITY_BOARD_TEMPLATES) {
    const slug = `${prefix}-${tmpl.slugSuffix}`;
    const exists = await Board.findOne({ slug });
    if (!exists) {
      await Board.create({
        slug,
        name: tmpl.name,
        description: tmpl.description,
        isAnonymousAllowed: tmpl.isAnonymousAllowed,
        sortOrder: tmpl.sortOrder,
        university: universityShortName,
        isUniversityBoard: true,
      });
    }
  }
}

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

    const token = jwt.sign({ id: user._id, email: user.email, nickname: user.nickname }, process.env.JWT_SECRET, { expiresIn: '30d' });

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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, nickname: user.nickname }, process.env.JWT_SECRET, { expiresIn: '30d' });

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

// POST /api/auth/verify-student
router.post('/verify-student', requireAuth, async (req, res) => {
  try {
    const { universityEmail } = req.body;
    if (!universityEmail) {
      return res.status(400).json({ success: false, message: '학교 이메일을 입력해주세요.' });
    }
    const university = findUniversityByEmail(universityEmail);
    if (!university) {
      return res.status(400).json({
        success: false,
        message: '지원하지 않는 학교 이메일입니다. 관리자에게 문의해주세요.',
      });
    }
    await User.findByIdAndUpdate(req.user.id, {
      role: 'student',
      verified: true,
      university: university.shortName,
    });
    await ensureUniversityBoards(university.shortName);
    res.json({
      success: true,
      data: { verified: true, university: university.shortName, universityName: university.name },
    });
  } catch (err) {
    console.error('학교 인증 오류:', err);
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

    // 작성 콘텐츠의 userId를 null로 설정 (클라이언트에서 '탈퇴한 회원' 표시)
    // 좋아요 배열에서도 제거
    await Post.updateMany({ likedBy: userId }, { $pull: { likedBy: userId }, $inc: { likeCount: -1 } });
    await Promise.all([
      Post.updateMany({ userId }, { $set: { userId: null, isAnonymous: true } }),
      Comment.updateMany({ userId }, { $set: { userId: null, isAnonymous: true } }),
      Block.deleteMany({ $or: [{ blockerId: userId }, { blockedId: userId }] }),
      Report.deleteMany({ reporterId: userId }),
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
