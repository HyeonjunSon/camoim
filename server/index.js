require('dotenv').config();
const http = require('http');
const connectDB = require('./db');
const Board = require('./models/Board');
const University = require('./models/University');
const initSocket = require('./socket');
const app = require('./app');

const httpServer = http.createServer(app);
const PORT = process.env.PORT || 4000;

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
    { slug: 'market',         name: '사고팔고 아나바다',  description: '물건을 사고팔아요',                    isAnonymousAllowed: false, sortOrder: 4 },
    { slug: 'jobs',           name: '구인구직·알바',      description: '일자리를 구하거나 구인해요',           isAnonymousAllowed: false, sortOrder: 5 },
    { slug: 'roomrent',       name: '룸랜트·민박·하숙',   description: '룸랜트·하우스 부분랜트·민박·하숙',     isAnonymousAllowed: false, sortOrder: 6 },
    { slug: 'exchange',       name: '환전·사기주의',      description: '환전 정보와 사기 주의 공유',           isAnonymousAllowed: false, sortOrder: 7 },
    { slug: 'immigration',    name: '이민·영주권',        description: '이민·영주권 정보와 질문',              isAnonymousAllowed: false, sortOrder: 8 },
    { slug: 'study',          name: '교육·유학',          description: '유학·학교·교육 정보와 질문',           isAnonymousAllowed: false, sortOrder: 9 },
    { slug: 'workingholiday', name: '워킹홀리데이',       description: '워홀 정보와 질문',                     isAnonymousAllowed: false, sortOrder: 10 },
    { slug: 'car',            name: '자동차 사고팔기',    description: '중고차를 사고팔아요',                  isAnonymousAllowed: false, sortOrder: 11 },
    { slug: 'giveaway',       name: '나눔해 드려요',      description: '필요한 물건 무료로 나눠요',            isAnonymousAllowed: false, sortOrder: 12 },
    { slug: 'realestate',     name: '부동산 매매/전세',   description: '집 매매·전세 정보',                    isAnonymousAllowed: false, sortOrder: 13 },
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

// University 마스터 데이터 시드 — constants/universities.js의 풀 리스트를 DB에 upsert
async function seedUniversities() {
  const { UNIVERSITIES } = require('./constants/universities');
  let added = 0;
  for (let i = 0; i < UNIVERSITIES.length; i++) {
    const u = UNIVERSITIES[i];
    const r = await University.findOneAndUpdate(
      { name: u.shortName },
      {
        $setOnInsert: { name: u.shortName, active: true },
        $set: { fullName: u.name, sortOrder: i + 1 },
      },
      { upsert: true, new: false }
    );
    if (!r) added++;
  }
  if (added > 0) console.log(`✅ 학교 마스터 시드: 신규 ${added}개 추가`);
  else console.log('✅ 학교 마스터 이미 최신 상태');
}

// 학교 게시판 시드/정리: 현재 템플릿은 free + anonymous 2종 (meetup/info는 1.0.5에서 제거)
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
    { slugSuffix: 'free',      name: '학교자유게시판', description: '학교 친구들과 자유롭게 이야기해요', isAnonymousAllowed: false, sortOrder: 1 },
    { slugSuffix: 'anonymous', name: '학교익명게시판', description: '학교 친구들과 익명으로 이야기해요', isAnonymousAllowed: true,  sortOrder: 2 },
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
    if (!['free', 'anonymous'].includes(suffix)) continue;
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

// 학교 게시판 meetup/info 제거 — 1.0.5에서 폐기 결정 (글/댓글까지 cascade 삭제)
async function cleanupLegacyMeetupInfoBoards() {
  const Post = require('./models/Post');
  const Comment = require('./models/Comment');

  const legacy = await Board.find({
    isUniversityBoard: true,
    slug: { $regex: /-(meetup|info)$/ },
  }).select('_id slug').lean();

  if (legacy.length === 0) return;

  const boardIds = legacy.map(b => b._id);
  const posts = await Post.find({ boardId: { $in: boardIds } }).select('_id').lean();
  const postIds = posts.map(p => p._id);

  const commentRes = postIds.length
    ? await Comment.deleteMany({ postId: { $in: postIds } })
    : { deletedCount: 0 };
  const postRes = postIds.length
    ? await Post.deleteMany({ _id: { $in: postIds } })
    : { deletedCount: 0 };
  const boardRes = await Board.deleteMany({ _id: { $in: boardIds } });

  console.log(`🧹 학교 meetup/info 정리: 게시판 ${boardRes.deletedCount}개, 글 ${postRes.deletedCount}개, 댓글 ${commentRes.deletedCount}개 삭제`);
}

const { startVerifyCleanupJob } = require('./utils/verifyCleanup');

connectDB().then(async () => {
  await seedBoards();
  await seedUniversities();
  await migrateUniversityBoards();
  await migrateUniversityNames();
  await cleanupLegacyMeetupInfoBoards();
  const io = initSocket(httpServer);
  app.set('io', io); // 라우트에서 req.app.get('io')로 접근 가능
  startVerifyCleanupJob(); // 인증 서류 90일 자동 삭제 cron
  httpServer.listen(PORT, () => {
    console.log(`🚀 서버 시작: http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('❌ DB 연결 실패. 서버 시작 안 함:', err);
  process.exit(1);
});
