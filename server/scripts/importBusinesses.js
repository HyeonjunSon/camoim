// Bulk business import — reads a CSV or JSON file into the Business collection
//
// Usage:
//   railway run node scripts/importBusinesses.js <file> [--pending] [--source admin|user]
//   (local test) node scripts/importBusinesses.js scripts/businesses.template.csv
//
// - With no lat/lng, the address is geocoded automatically (Nominatim, 1 request per second)
// - Deduplicated on (name + address), so re-running is safe (existing rows are updated)
// - Defaults to status=approved (visible on the map immediately); --pending files them for review
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Business = require('../models/Business');
const { geocodeAddress } = require('../utils/geocode');

// ── Category and city aliases mapped to internal keys (human-written labels and English both accepted) ──
const CATEGORY_ALIASES = {
  food: 'food', 음식점: 'food', 식당: 'food', restaurant: 'food', 한식: 'food', bbq: 'food', 'korean restaurant': 'food',
  cafe: 'cafe', 카페: 'cafe', 베이커리: 'cafe', bakery: 'cafe', coffee: 'cafe', '카페·베이커리': 'cafe', 디저트: 'cafe',
  mart: 'mart', 마트: 'mart', 슈퍼: 'mart', grocery: 'mart', supermarket: 'mart', 한인마트: 'mart', 한국마트: 'mart', market: 'mart',
  hair: 'hair', 미용실: 'hair', 헤어: 'hair', salon: 'hair', beauty: 'hair', 네일: 'hair', nail: 'hair', 뷰티: 'hair',
  clinic: 'clinic', 병원: 'clinic', 한의원: 'clinic', 한의: 'clinic', 의원: 'clinic', hospital: 'clinic', medical: 'clinic', 약국: 'clinic', pharmacy: 'clinic', 치과: 'clinic', dental: 'clinic', 클리닉: 'clinic',
  realty: 'realty', 부동산: 'realty', 이민: 'realty', 'real estate': 'realty', realestate: 'realty', immigration: 'realty', 법무: 'realty', 변호사: 'realty', law: 'realty',
  etc: 'etc', 기타: 'etc', other: 'etc', others: 'etc',
};
const CITY_ALIASES = {
  toronto: 'toronto', 토론토: 'toronto', on: 'toronto', ontario: 'toronto', gta: 'toronto',
  vancouver: 'vancouver', 밴쿠버: 'vancouver', bc: 'vancouver', 뱅쿠버: 'vancouver',
  montreal: 'montreal', 몬트리올: 'montreal', qc: 'montreal', quebec: 'montreal', 'montréal': 'montreal',
};

function resolveCategory(v) {
  if (!v) return null;
  return CATEGORY_ALIASES[String(v).trim().toLowerCase()] || null;
}
function resolveCity(v) {
  if (!v) return null;
  return CITY_ALIASES[String(v).trim().toLowerCase()] || null;
}

// ── Resilient CSV parser (handles quoted commas and newlines, UTF-8) ──
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => {
      const o = {};
      header.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
      return o;
    });
}

function loadRows(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.businesses || [];
  }
  return parseCSV(text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const file = process.argv[2];
  const flags = process.argv.slice(3);
  if (!file) {
    console.log('Usage: node scripts/importBusinesses.js <file.csv|file.json> [--pending] [--source admin|user]');
    process.exit(1);
  }
  const asPending = flags.includes('--pending');
  const srcFlag = flags.indexOf('--source');
  const source = srcFlag >= 0 && ['admin', 'user', 'google'].includes(flags[srcFlag + 1]) ? flags[srcFlag + 1] : 'admin';

  const rows = loadRows(path.resolve(file));
  console.log(`📄 read ${rows.length} rows · source=${source} · status=${asPending ? 'pending' : 'approved'}`);

  await connectDB();

  let added = 0, updated = 0, skipped = 0, geocoded = 0, geoFail = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row.name || '').trim();
    const category = resolveCategory(row.category);
    const city = resolveCity(row.city);
    const address = String(row.address || '').trim();

    if (!name || !category || !city || !address) {
      skipped++;
      console.warn(`  ⚠︎ [${i + 1}] skipped — missing or unrecognized required field (name="${name}", category="${row.category}", city="${row.city}", address="${address}")`);
      continue;
    }

    let lat = parseFloat(row.lat);
    let lng = parseFloat(row.lng);
    let location = null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      location = { type: 'Point', coordinates: [lng, lat] };
    } else {
      const geo = await geocodeAddress(address, city);
      if (geo) { location = { type: 'Point', coordinates: [geo.lng, geo.lat] }; geocoded++; }
      else geoFail++;
      await sleep(1100); // Nominatim usage policy: 1 request per second
    }

    const images = String(row.images || '').split('|').map((s) => s.trim()).filter(Boolean);
    const doc = {
      name, category, city, address,
      phone: String(row.phone || '').trim(),
      hours: String(row.hours || '').trim(),
      description: String(row.description || '').trim(),
      images,
      source,
      status: asPending ? 'pending' : 'approved',
    };
    if (location) doc.location = location;

    const existing = await Business.findOne({ name, address });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
      updated++;
    } else {
      await Business.create(doc);
      added++;
    }
    console.log(`  [${i + 1}/${rows.length}] ${name} · ${city}/${category}${location ? '' : ' ⚠︎ no coordinates'}`);
  }

  console.log('─'.repeat(40));
  console.log(`✅ done: ${added} added · ${updated} updated · ${skipped} skipped · ${geocoded} geocoded (${geoFail} failed)`);
  process.exit(0);
}

main().catch((e) => { console.error('❌ import failed:', e); process.exit(1); });
