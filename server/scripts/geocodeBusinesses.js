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

// 한국일보 주소 특성 보정 — 실패 시 순서대로 재시도할 후보 쿼리 목록
// 예) "691 Bloor , W. Toronto, ON. M6G 1L3"
//  1) 정제본 (괄호/Unit/# 제거)
//  2) 방향 보정: "691 Bloor W, Toronto, ..."
//  3) 도로 타입 삽입: 한국일보 주소는 St/Ave/Rd가 빠져 있어 OSM 매칭 실패가 많음
//     → "691 Bloor St W", "691 Bloor Ave W" ... 순회 (실측: 실패분의 대다수가 이걸로 해결)
//  4) 우편번호만 (최후 수단 — OSM 캐나다 우편번호 데이터는 부분적)
const STREET_SUFFIXES = ['St', 'Ave', 'Rd', 'Dr', 'Blvd'];
const HAS_SUFFIX_RE = /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|cres|crescent|way|ct|court|pkwy|parkway|line|circle|cir|trail|gate|hwy|highway|sideroad|terrace|lane|ln|pl|place|quay|sq|square|grove|path|heights|hts|gardens|gdns|mall|row|walk|close|view|mills|park|loop)\b\.?$/i;

function candidateQueries(address) {
  const out = [];
  // 기본 정제: 괄호 내용(한글 설명 등)·Unit/Suite/# 제거, 공백 정리
  let a = String(address)
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .replace(/\b(unit|suite|ste)\.?\s*#?\s*[\w-]+/gi, ' ')
    .replace(/#\s*[\w-]+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  out.push(a);

  // 방향(N./S./E./W.)이 도시 앞에 붙은 형식 → 도로명 뒤로 이동
  const dirFix = a.replace(/^(\d[\w' .-]*?)\s*,\s*([NSEW])\.\s+/i, '$1 $2, ');
  if (dirFix !== a) { out.push(dirFix); a = dirFix; }

  // 도로 타입이 없으면 St/Ave/Rd/Dr/Blvd 순회 삽입 (방향 문자는 타입 뒤로: "Bloor St W")
  const m = a.match(/^(\d+[A-Za-z]?\s+[A-Za-z][\w' .-]*?)(\s+[NSEW])?\s*,(.*)$/);
  if (m && !HAS_SUFFIX_RE.test(m[1].trim())) {
    for (const suf of STREET_SUFFIXES) out.push(`${m[1].trim()} ${suf}${m[2] || ''},${m[3]}`);
  }

  // 우편번호 fallback
  const postal = a.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
  if (postal) out.push(postal[0].toUpperCase());

  // 마무리 정규화: "ON." → "ON" + 끝에 ", Canada" 부착
  // (주소에 canada가 있으면 geocodeAddress가 도시 힌트를 안 붙임 —
  //  힌트가 붙으면 "Richmond Hill ... Toronto ..." 처럼 도시가 중복돼 Nominatim 매칭 실패)
  return [...new Set(out.map((c) =>
    `${c.replace(/,\s*(ON|BC|QC|AB|MB|SK|NS|NB|NL|PE)\.\s*/g, ', $1 ').trim().replace(/,$/, '')}, Canada`
  ))];
}

async function main() {
  const flags = process.argv.slice(2);
  const li = flags.indexOf('--limit');
  const limit = li >= 0 ? parseInt(flags[li + 1]) || 300 : 300;

  await connectDB();
  const total = await Business.countDocuments(MISSING);
  const targets = await Business.find(MISSING).limit(limit);
  console.log(`좌표 없는 업체 총 ${total}개 · 이번 실행 ${targets.length}개 처리`);

  let ok = 0, fail = 0, cached = 0;
  const cache = new Map(); // 주소 → [lng, lat] (같은 주소 재호출 방지)
  const keyOf = (b) => `${b.city}|${b.address.trim().toLowerCase()}`;

  for (let i = 0; i < targets.length; i++) {
    const b = targets[i];
    const key = keyOf(b);

    let coords = cache.get(key);
    if (!coords) {
      // 같은 주소로 이미 좌표 찍힌 업체가 DB에 있으면 재사용 (API 호출 안 함)
      const sib = await Business.findOne({
        city: b.city, address: b.address, 'location.coordinates.0': { $exists: true },
      }).select('location').lean();
      if (sib?.location?.coordinates) coords = sib.location.coordinates;
    }

    if (coords) {
      b.location = { type: 'Point', coordinates: coords };
      await b.save();
      cache.set(key, coords);
      ok++; cached++;
      continue; // 캐시/재사용은 API 안 쓰니 sleep 불필요
    }

    let geo = null;
    for (const q of candidateQueries(b.address)) {
      geo = await geocodeAddress(q, b.city);
      if (geo) break;
      await sleep(1200); // 후보 간에도 rate limit 준수
    }
    if (geo) {
      const c = [geo.lng, geo.lat];
      b.location = { type: 'Point', coordinates: c };
      await b.save();
      cache.set(key, c);
      ok++;
    } else {
      fail++;
    }
    await sleep(1200); // Nominatim 이용정책 준수 (실제 API 호출한 경우만)
    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${targets.length} (성공 ${ok} / 실패 ${fail} / 주소재사용 ${cached})`);
  }

  const remaining = await Business.countDocuments(MISSING);
  console.log('─'.repeat(48));
  console.log(`✅ 이번 실행: 성공 ${ok} · 실패 ${fail}`);
  console.log(`📍 아직 좌표 없는 업체: ${remaining}개 ${remaining > 0 ? '→ 스크립트 한 번 더 실행' : '→ 완료!'}`);
  process.exit(0);
}

main().catch((e) => { console.error('❌ 지오코딩 실패:', e); process.exit(1); });
