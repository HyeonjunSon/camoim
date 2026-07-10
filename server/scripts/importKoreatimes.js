// 캐나다 한국일보 업소록 CSV → CaMoim Business 등록 (제휴 허가 하 사용, 출처 표기 포함)
//
// 사용법:
//   railway run node scripts/importKoreatimes.js <directory.csv> [--pending]
//
// - 원본 CSV 컬럼: category_id, category_kr, category_en, name_kr, name_en, phone, address, detail_url
// - category_id로 CaMoim 카테고리 매핑, 업체 아닌 분류(종교/단체/공공/언론/대기업지사/B2B)는 제외
// - 주소에서 도시 추출 → GTA=toronto / BC=vancouver / QC=montreal, 그 외는 건너뜀
// - 좌표는 여기서 안 찍음(대량). 등록 후 scripts/geocodeBusinesses.js 로 배치 지오코딩
// - (name + address) 중복 방지 → 재실행 안전
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Business = require('../models/Business');

const SOURCE_NAME = '캐나다 한국일보';

// ── category_id → CaMoim 카테고리 (명시 매핑 외 나머지 = etc, EXCLUDE = 건너뜀) ──
const CATEGORY_MAP = {
  '2004': 'food',                                                   // 음식점
  '2002': 'cafe', '2010': 'cafe',                                   // 떡집·방앗간 / 제과점
  '2003': 'mart', '2006': 'mart', '2009': 'mart',                  // 생선·식품점·정육점
  '2161': 'hair',                                                   // 미용실·이발관만 (재료·화장품·피부는 EXCLUDE)
  // 병원·의료·한의원·약국·물리치료·검안 등
  '2012': 'clinic', '2014': 'clinic', '2018': 'clinic', '2019': 'clinic', '2020': 'clinic',
  '2021': 'clinic', '2022': 'clinic', '2023': 'clinic', '2024': 'clinic', '2025': 'clinic',
  '2026': 'clinic', '2027': 'clinic', '2028': 'clinic', '2029': 'clinic', '2030': 'clinic',
  '2031': 'clinic', '2032': 'clinic', '2160': 'clinic', '2210': 'clinic',
};

// 지도에 안 넣을 분류 (업체 아님 / 순수 B2B / 종교 / 단체 / 공공 / 언론 / 대기업지사 / 잡음)
const EXCLUDE = new Set([
  '2001',                                                              // 분류 오류/잡음
  '2162', '2167', '2168',                                              // 미용재료·피부미용·화장품 (미용실 아님 — 제외 결정)
  '2053', '2076', '2078', '2079', '2080', '2081',                     // 부동산·이민·모기지·보험 (제외 결정)
  '2005', '2007', '2011', '2054', '2070', '2075', '2077', '2089', '2101', '2108', '2116', // B2B/도매/제조/사무기기
  '2173', '2183',                                                     // 공공기관/정부
  '2182', '2185',                                                     // 언론사(한국일보 본사 포함)/방송
  '2186',                                                             // 한국 대기업 지사
  '2179', '2184', '2187', '2188', '2189', '2190', '2191', '2192', '2193', // 단체/협회/한인회/동창회
  '2178', '2180', '2181', '2194', '2195', '2196', '2198', '2199', '2200', '2201', '2203', '2204', '2205', '2206', '2207', '2208', '2209', // 종교
]);

// GTA(토론토 광역권) → toronto 로 통합
const GTA = new Set([
  'toronto', 'north york', 'scarborough', 'etobicoke', 'york', 'east york', 'weston', 'downsview',
  'markham', 'mississauga', 'richmond hill', 'thornhill', 'vaughan', 'concord', 'woodbridge', 'maple',
  'oakville', 'brampton', 'newmarket', 'aurora', 'pickering', 'ajax', 'whitby', 'oshawa',
  'stouffville', 'whitchurch-stouffville', 'king city', 'unionville', 'milton', 'burlington',
]);

function detectCity(address) {
  const m = String(address).match(/,\s*([A-Za-z .'-]+?),\s*(ON|BC|QC|AB|MB|SK|NS|NB|NL|PE)\b/);
  if (!m) return null;
  const city = m[1].replace(/^[NSEW]\.\s*/i, '').trim().toLowerCase();
  const prov = m[2].toUpperCase();
  if (prov === 'ON') return GTA.has(city) ? 'toronto' : null; // 온타리오는 GTA만
  if (prov === 'BC') return 'vancouver';
  if (prov === 'QC') return 'montreal';
  return null;
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM 제거
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => {
    const o = {}; header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); }); return o;
  });
}

async function main() {
  const flags = process.argv.slice(2);
  const file = flags.find((a) => !a.startsWith('--'));
  const asPending = flags.includes('--pending');
  const dry = flags.includes('--dry'); // DB 안 건드리고 개수만 미리보기
  // --only=food,cafe,mart,hair,clinic → 이 카테고리만 등록 (없으면 전부)
  const onlyArg = flags.find((a) => a.startsWith('--only='));
  const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean)) : null;
  if (!file) { console.log('사용법: node scripts/importKoreatimes.js <directory.csv> [--pending] [--dry] [--only=food,cafe,...]'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(path.resolve(file), 'utf8'));
  console.log(`📄 ${rows.length}행 · 상태=${asPending ? 'pending' : 'approved'} · 출처="${SOURCE_NAME}"${ONLY ? ` · only=[${[...ONLY].join(',')}]` : ''}${dry ? ' · [DRY-RUN: DB 안 씀]' : ''}`);

  if (!dry) await connectDB();
  let added = 0, updated = 0, skipCat = 0, skipCity = 0, skipBad = 0, skipOnly = 0, wouldImport = 0;
  const catCount = {}, cityCount = {};

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cid = String(r.category_id || '').trim();
    if (EXCLUDE.has(cid)) { skipCat++; continue; }
    const category = CATEGORY_MAP[cid] || 'etc';
    if (ONLY && !ONLY.has(category)) { skipOnly++; continue; }

    const name = String(r.name_kr || r.name_en || '').trim();
    const address = String(r.address || '').trim();
    if (!name || !address || address === ',') { skipBad++; continue; }

    const city = detectCity(address);
    if (!city) { skipCity++; continue; }

    catCount[category] = (catCount[category] || 0) + 1;
    cityCount[city] = (cityCount[city] || 0) + 1;

    if (dry) { wouldImport++; continue; }

    const doc = {
      name, category, city, address,
      phone: String(r.phone || '').trim(),
      hours: '', description: '', images: [],
      source: 'admin', sourceName: SOURCE_NAME,
      status: asPending ? 'pending' : 'approved',
    };
    const existing = await Business.findOne({ name, address });
    if (existing) { Object.assign(existing, doc); await existing.save(); updated++; }
    else { await Business.create(doc); added++; }
    if ((i + 1) % 200 === 0) console.log(`  ... ${i + 1}/${rows.length}`);
  }

  console.log('─'.repeat(48));
  if (dry) console.log(`✅ 등록 예정: ${wouldImport}개`);
  else console.log(`✅ 등록: 추가 ${added} · 갱신 ${updated}`);
  console.log(`⏭  제외: 분류(업체아님) ${skipCat}${ONLY ? ` · only필터 ${skipOnly}` : ''} · 도시밖 ${skipCity} · 필수값누락 ${skipBad}`);
  console.log('📊 카테고리별:', catCount);
  console.log('🏙  도시별:', cityCount);
  if (!dry) console.log('👉 다음: railway run node scripts/geocodeBusinesses.js --limit 300  (좌표 배치 등록)');
  process.exit(0);
}

main().catch((e) => { console.error('❌ import 실패:', e); process.exit(1); });
