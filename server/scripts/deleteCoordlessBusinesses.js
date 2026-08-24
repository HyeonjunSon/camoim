// 좌표 없는 업체 삭제 — 단, Whatasign(주소가 아예 없는 케이스)은 보존.
// cascade: BusinessBookmark + Report (관리자 DELETE 라우트와 동일)
// 실행: railway run node scripts/deleteCoordlessBusinesses.js
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const BusinessBookmark = require('../models/BusinessBookmark');
const Report = require('../models/Report');

const KEEP = /whatasign/i; // 보존할 업체명 패턴

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const coordless = await Business.find({
    $or: [
      { location: { $exists: false } },
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
    ],
  }).lean();

  const toDelete = coordless.filter((b) => !KEEP.test(b.name || ''));
  const kept = coordless.filter((b) => KEEP.test(b.name || ''));

  console.log(`좌표 없는 업체 ${coordless.length}개`);
  console.log(`보존 ${kept.length}개: ${kept.map((b) => b.name).join(', ') || '(없음)'}`);
  console.log(`삭제 대상 ${toDelete.length}개:\n`);

  for (const b of toDelete) {
    const [bm, rp] = await Promise.all([
      BusinessBookmark.deleteMany({ businessId: b._id }),
      Report.deleteMany({ targetType: 'business', targetId: b._id }),
    ]);
    await Business.deleteOne({ _id: b._id });
    console.log(`🗑  ${b.name}  ← ${b.address}  (bookmark ${bm.deletedCount}, report ${rp.deletedCount})`);
  }

  console.log(`\n완료: ${toDelete.length}개 삭제, ${kept.length}개 보존`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
