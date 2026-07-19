// 좌표 없이 저장된 업체를 개선된 지오코더로 재시도해 채운다 (idempotent).
// 실행: railway run node scripts/backfillBusinessGeo.js
require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const { geocodeAddress } = require('../utils/geocode');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // location 없거나 좌표 배열이 비어있는 업체
  const list = await Business.find({
    $or: [
      { location: { $exists: false } },
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates': { $size: 0 } },
    ],
  }).lean();

  console.log(`좌표 없는 업체 ${list.length}개 발견\n`);
  let fixed = 0, stillFail = 0;

  for (const b of list) {
    const geo = await geocodeAddress(b.address, b.city);
    if (geo) {
      await Business.updateOne(
        { _id: b._id },
        { $set: { location: { type: 'Point', coordinates: [geo.lng, geo.lat] } } }
      );
      fixed++;
      console.log(`✅ ${b.name}  ← ${b.address}`);
      console.log(`   ${geo.lat}, ${geo.lng}`);
    } else {
      stillFail++;
      console.log(`❌ ${b.name}  ← ${b.address}  (여전히 실패 — 수동 좌표 필요)`);
    }
    // Nominatim rate limit
    await new Promise((s) => setTimeout(s, 1200));
  }

  console.log(`\n완료: ${fixed}개 좌표 채움, ${stillFail}개 여전히 실패`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
