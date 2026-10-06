// Assembles the Express app only — listen, DB connection and seeding live in index.js.
// Split out so tests (supertest) can use the app without starting a server.
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
const introRoutes = require('./routes/intro');
const { systemGuard } = require('./middleware/systemGuard');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Maintenance-mode / IP-block / force-update guard (admin and health are exempt)
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
app.use('/api/intro', introRoutes);

app.get('/health', (req, res) => res.json({ success: true, message: 'CaMoim 서버 정상 작동 중' }));

// Privacy Policy (required URL for App Store review)
app.get(['/privacy', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Account Deletion (required URL for Google Play)
app.get(['/delete-account', '/account-deletion'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'delete-account.html'));
});

// Child Safety Standards (required URL for the Google Play Social category)
app.get(['/child-safety', '/child-safety-standards', '/csae'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'child-safety.html'));
});


module.exports = app;
