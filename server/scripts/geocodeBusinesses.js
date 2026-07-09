// 좌표(location) 없는 업체를 배치로 지오코딩 — 재실행 안전(남은 것만 처리)
//
// 사용법:
//   railway run node scripts/geocodeBusinesses.js --limit 300
//
// 주의: OSM Nominatim은 대량 지오코딩을 제한(초당 1건, 벌크 비권장)해요.
//       한 번에 300개 정도씩 나눠 여러 번 실행하는 걸 권장. 실패한 건 다음 실행에서 재시도됨.
//       더 빠르게 하려면 Google Geocoding API 키로 바꾸는 것도 방법(utils/geocode.js 교체).
require('dotenv').config();
const connectDB = require('../db');
const Business = require('../models/Business');
const { geocodeAddress } = require('../utils/geocode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MISSING = { $or: [{ location: { $exists: false } }, { 'location.coordinates': { $exists: false } }] };

async function main() {
  const flags = process.argv.slice(2);
  const li = flags.indexOf('--limit');
  const limit = li >= 0 ? parseInt(flags[li + 1]) || 300 : 300;

  await connectDB();
  const total = await Business.countDocuments(MISSING);
  const targets = await Business.find(MISSING).limit(limit);
  console.log(`좌표 없는 업체 총 ${total}개 · 이번 실행 ${targets.length}개 처리`);

  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const b = targets[i];
    const geo = await geocodeAddress(b.address, b.city);
    if (geo) {
      b.location = { type: 'Point', coordinates: [geo.lng, geo.lat] };
      await b.save();
      ok++;
    } else {
      fail++;
    }
    await sleep(1200); // Nominatim 이용정책 준수
    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${targets.length} (성공 ${ok} / 실패 ${fail})`);
  }

  const remaining = await Business.countDocuments(MISSING);
  console.log('─'.repeat(48));
  console.log(`✅ 이번 실행: 성공 ${ok} · 실패 ${fail}`);
  console.log(`📍 아직 좌표 없는 업체: ${remaining}개 ${remaining > 0 ? '→ 스크립트 한 번 더 실행' : '→ 완료!'}`);
  process.exit(0);
}

main().catch((e) => { console.error('❌ 지오코딩 실패:', e); process.exit(1); });
