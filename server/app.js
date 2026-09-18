// Express 앱 조립만 담당 — listen / DB 연결 / 시드는 index.js가 맡는다.
// 테스트(supertest)가 서버를 띄우지 않고 앱만 가져다 쓸 수 있게 분리.
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const verifyRoutes = require('./routes/verify');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const chatRoutes = require('./routes/chats');
const noticeRoutes = require('./routes/notices');
const inquiryRoutes = require('./routes/inquiries');
const groupRoutes = require('./routes/groups');
const statsRoutes = require('./routes/stats');
const universityRoutes = require('./routes/universities');
const businessRoutes = require('./routes/businesses');
const stayRoutes = require('./routes/stays');
const draftRoutes = require('./routes/drafts');
const searchRoutes = require('./routes/search');
const analyticsRoutes = require('./routes/analytics');
const { systemGuard } = require('./middleware/systemGuard');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 점검모드/IP차단/강제업데이트 가드 (admin/health 제외)
app.use(systemGuard);

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/stays', stayRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/drafts', draftRoutes);

app.get('/health', (req, res) => res.json({ success: true, message: 'CaMoim 서버 정상 작동 중' }));

// 개인정보처리방침 · Privacy Policy (App Store 심사 필수 URL)
app.get(['/privacy', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// 계정 삭제 안내 · Account Deletion (Google Play 필수 URL)
app.get(['/delete-account', '/account-deletion'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'delete-account.html'));
});

// 아동 안전 정책 · Child Safety Standards (Google Play Social 카테고리 필수 URL)
app.get(['/child-safety', '/child-safety-standards', '/csae'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'child-safety.html'));
});


module.exports = app;
