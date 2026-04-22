require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const Board = require('./models/Board');
const initSocket = require('./socket');

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
const { systemGuard } = require('./middleware/systemGuard');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

app.get('/health', (req, res) => res.json({ success: true, message: 'CaMoim 서버 정상 작동 중' }));

// 기본 게시판 데이터 시드 (없을 때만)
async function seedBoards() {
  // 공식 글로벌 게시판 slug 목록 (이 외 일반 게시판은 삭제)
  const officialSlugs = [
    'free', 'anonymous',
    'meetup',
    'immigration', 'study', 'workingholiday',
    'market', 'car', 'giveaway',
    'jobs',
    'realestate', 'roomrent',
    'exchange',
  ];
  await Board.deleteMany({ isUniversityBoard: { $ne: true }, slug: { $nin: officialSlugs } });

  const boardDefs = [
    { slug: 'free',           name: '자유게시판',         description: '자유롭게 이야기해요',                  isAnonymousAllowed: false, sortOrder: 1 },
    { slug: 'anonymous',      name: '익명게시판',         description: '익명으로 털어놓아요',                  isAnonymousAllowed: true,  sortOrder: 2 },
    { slug: 'meetup',         name: '같이가요 함께해요',  description: '같이 갈 사람·동행 구해요',             isAnonymousAllowed: false, sortOrder: 3 },
    { slug: 'immigration',    name: '이민·영주권',        description: '이민·영주권 정보와 질문',              isAnonymousAllowed: false, sortOrder: 4 },
    { slug: 'study',          name: '교육·유학',          description: '유학·학교·교육 정보와 질문',           isAnonymousAllowed: false, sortOrder: 5 },
    { slug: 'workingholiday', name: '워킹홀리데이',       description: '워홀 정보와 질문',                     isAnonymousAllowed: false, sortOrder: 6 },
    { slug: 'market',         name: '사고팔고 아나바다',  description: '물건을 사고팔아요',                    isAnonymousAllowed: false, sortOrder: 7 },
    { slug: 'car',            name: '자동차 사고팔기',    description: '중고차를 사고팔아요',                  isAnonymousAllowed: false, sortOrder: 8 },
    { slug: 'giveaway',       name: '나눔해 드려요',      description: '필요한 물건 무료로 나눠요',            isAnonymousAllowed: false, sortOrder: 9 },
    { slug: 'jobs',           name: '구인구직·알바',      description: '일자리를 구하거나 구인해요',           isAnonymousAllowed: false, sortOrder: 10 },
    { slug: 'realestate',     name: '부동산 매매/전세',   description: '집 매매·전세 정보',                    isAnonymousAllowed: false, sortOrder: 11 },
    { slug: 'roomrent',       name: '룸랜트·민박·하숙',   description: '룸랜트·하우스 부분랜트·민박·하숙',     isAnonymousAllowed: false, sortOrder: 12 },
    { slug: 'exchange',       name: '환전·사기주의',      description: '환전 정보와 사기 주의 공유',           isAnonymousAllowed: false, sortOrder: 13 },
  ];

  for (const def of boardDefs) {
    await Board.findOneAndUpdate(
      { slug: def.slug },
      {
        $setOnInsert: { slug: def.slug },
        $set: {
          name: def.name,
          description: def.description,
          isAnonymousAllowed: def.isAnonymousAllowed,
          sortOrder: def.sortOrder,
          isUniversityBoard: false,
        },
      },
      { upsert: true, new: false }
    );
  }
  console.log('✅ 기본 게시판 확인 완료');
}

// 학교 게시판 일회성 마이그레이션: 옛 4종(notice/qna) → 새 4종(meetup/info)
async function migrateUniversityBoards() {
  // 1) 옛 학교 자유게시판 이름 정리: "학교 자유게시판" → "학교자유게시판"
  await Board.updateMany(
    { isUniversityBoard: true, slug: /-free$/, name: '학교 자유게시판' },
    { $set: { name: '학교자유게시판' } }
  );

  // 2) 옛 sortOrder 갱신: anonymous → 2
  await Board.updateMany(
    { isUniversityBoard: true, slug: /-anonymous$/ },
    { $set: { sortOrder: 2 } }
  );

  // 2-1) 학교자유게시판 익명 비허용으로 전환
  await Board.updateMany(
    { isUniversityBoard: true, slug: /-free$/ },
    { $set: { isAnonymousAllowed: false } }
  );

  // 3) 사용 안 하는 옛 게시판(notice/qna) 제거
  // 글이 있으면 보존을 위해 그냥 두고, 비어있을 때만 삭제
  const Post = require('./models/Post');
  const stale = await Board.find({ isUniversityBoard: true, slug: { $regex: /-(notice|qna)$/ } });
  for (const b of stale) {
    const cnt = await Post.countDocuments({ boardId: b._id });
    if (cnt === 0) await b.deleteOne();
  }

  // 4) 캐나다 주요 대학 + 이미 인증된 학교 목록을 합쳐 게시판 생성
  // (관리자는 모든 학교에 접근해야 하므로 미리 시드)
  const SEED_UNIVERSITIES = [
    'University of Toronto (UofT)',
    'University of British Columbia (UBC)',
    'McGill University',
    'University of Waterloo (UW)',
    'University of Alberta (UAlberta)',
    'Western University',
    'Queen\'s University',
    'McMaster University',
    'York University',
    'Simon Fraser University (SFU)',
    'University of Calgary (UCalgary)',
    'University of Ottawa (uOttawa)',
    'Concordia University',
    'Dalhousie University (Dal)',
    'University of Victoria (UVic)',
    'University of Manitoba (UManitoba)',
    'Carleton University',
    'Toronto Metropolitan University',
    'Université de Montréal',
    'University of Saskatchewan',
  ];
  const existing = await Board.distinct('university', { isUniversityBoard: true, university: { $ne: null } });
  const universities = Array.from(new Set([...SEED_UNIVERSITIES, ...existing]));
  const newTemplates = [
    { slugSuffix: 'free',      name: '학교자유게시판',   description: '학교 친구들과 자유롭게 이야기해요',          isAnonymousAllowed: false, sortOrder: 1 },
    { slugSuffix: 'anonymous', name: '학교익명게시판',   description: '학교 친구들과 익명으로 이야기해요',          isAnonymousAllowed: true,  sortOrder: 2 },
    { slugSuffix: 'meetup',    name: '학교 한인 모임',   description: '밥약·스터디·운동·동아리 같이 할 사람 찾아요', isAnonymousAllowed: false, sortOrder: 3 },
    { slugSuffix: 'info',      name: '학교 유학생 정보', description: '학교 생활·비자·세금 등 궁금한 걸 물어봐요',   isAnonymousAllowed: false, sortOrder: 4 },
  ];
  for (const uni of universities) {
    if (!uni) continue;
    const prefix = uni.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, '-');
    for (const tmpl of newTemplates) {
      const slug = `${prefix}-${tmpl.slugSuffix}`;
      await Board.findOneAndUpdate(
        { slug },
        {
          $setOnInsert: {
            slug,
            name: tmpl.name,
            description: tmpl.description,
            isAnonymousAllowed: tmpl.isAnonymousAllowed,
            sortOrder: tmpl.sortOrder,
            university: uni,
            isUniversityBoard: true,
          },
        },
        { upsert: true, new: false }
      );
    }
  }
  console.log('✅ 학교 게시판 마이그레이션 완료');
}

// 학교 이름 풀네임 마이그레이션 (약어 → 풀네임)
async function migrateUniversityNames() {
  const { SHORT_NAME_MIGRATION } = require('./constants/universities');
  const User = require('./models/User');
  const VerifyRequest = require('./models/VerifyRequest');
  const Post = require('./models/Post');

  let count = 0;
  for (const [oldName, newName] of Object.entries(SHORT_NAME_MIGRATION)) {
    if (oldName === newName) continue;

    // Board.university 필드 업데이트
    const r1 = await Board.updateMany({ university: oldName }, { $set: { university: newName } });
    // User.university 필드
    const r2 = await User.updateMany({ university: oldName }, { $set: { university: newName } });
    // VerifyRequest.university 필드
    const r3 = await VerifyRequest.updateMany({ university: oldName }, { $set: { university: newName } });
    count += (r1.modifiedCount || 0) + (r2.modifiedCount || 0) + (r3.modifiedCount || 0);
  }

  // slug 정리: university 필드 기반으로 올바른 slug 보장
  const uniBoards = await Board.find({ isUniversityBoard: true, university: { $ne: null } });
  let slugFixed = 0;
  for (const b of uniBoards) {
    const parts = b.slug.split('-');
    const suffix = parts[parts.length - 1];
    if (!['free', 'anonymous', 'meetup', 'info'].includes(suffix)) continue;
    const prefix = b.university.toLowerCase().replace(/[()]/g, '').replace(/\s+/g, '-');
    const correctSlug = `${prefix}-${suffix}`;
    if (b.slug !== correctSlug) {
      const dup = await Board.findOne({ slug: correctSlug, _id: { $ne: b._id } });
      if (dup) {
        await Post.updateMany({ boardId: b._id }, { $set: { boardId: dup._id } });
        await b.deleteOne();
      } else {
        b.slug = correctSlug;
        await b.save();
      }
      slugFixed++;
    }
  }

  if (count > 0 || slugFixed > 0) console.log(`✅ 학교 이름 마이그레이션: 이름 ${count}건, slug ${slugFixed}건 업데이트`);
  else console.log('✅ 학교 이름 이미 최신 상태');
}

connectDB().then(async () => {
  await seedBoards();
  await migrateUniversityBoards();
  await migrateUniversityNames();
  const io = initSocket(httpServer);
  app.set('io', io); // 라우트에서 req.app.get('io')로 접근 가능
  httpServer.listen(PORT, () => {
    console.log(`🚀 서버 시작: http://localhost:${PORT}`);
  });
});
