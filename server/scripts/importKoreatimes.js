// Korea Times Canada business directory CSV → CaMoim businesses (used under a partnership, with attribution)
//
// Usage:
//   railway run node scripts/importKoreatimes.js <directory.csv> [--pending]
//
// - Source CSV columns: category_id, category_kr, category_en, name_kr, name_en, phone, address, detail_url
// - category_id maps to a CaMoim category; non-business entries (religion, associations, public bodies, media, corporate branches, B2B) are dropped
// - City is derived from the address: GTA=toronto / BC=vancouver / QC=montreal; anything else is skipped
// - Coordinates are not resolved here (too many). Run scripts/geocodeBusinesses.js afterwards
// - Deduplicated on (name + address), so re-running is safe
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../db');
const Business = require('../models/Business');

const SOURCE_NAME = '캐나다 한국일보';

// ── category_id → CaMoim category (anything unmapped becomes etc; EXCLUDE is skipped) ──
const CATEGORY_MAP = {
  '2004': 'food',                                                   // Restaurants
  '2002': 'cafe', '2010': 'cafe',                                   // Rice-cake and mill shops / bakeries
  '2003': 'mart', '2006': 'mart', '2009': 'mart',                  // Fishmongers, grocers and butchers
  '2161': 'hair',                                                   // Hair salons and barbers only (supplies, cosmetics and skincare are EXCLUDEd)
  // Clinics, medical practices, oriental medicine, pharmacies, physiotherapy, optometry and so on
  '2012': 'clinic', '2014': 'clinic', '2018': 'clinic', '2019': 'clinic', '2020': 'clinic',
  '2021': 'clinic', '2022': 'clinic', '2023': 'clinic', '2024': 'clinic', '2025': 'clinic',
  '2026': 'clinic', '2027': 'clinic', '2028': 'clinic', '2029': 'clinic', '2030': 'clinic',
  '2031': 'clinic', '2032': 'clinic', '2160': 'clinic', '2210': 'clinic',
};

// Categories kept off the map (not a business / pure B2B / religion / associations / public bodies / media / corporate branches / noise)
const EXCLUDE = new Set([
  '2001',                                                              // Misclassified or noisy rows
  '2162', '2167', '2168',                                              // Beauty supplies, skincare and cosmetics (not salons — deliberately excluded)
  '2053', '2076', '2078', '2079', '2080', '2081',                     // Real estate, immigration, mortgage and insurance (deliberately excluded)
  '2005', '2007', '2011', '2054', '2070', '2075', '2077', '2089', '2101', '2108', '2116', // B2B, wholesale, manufacturing and office equipment
  '2173', '2183',                                                     // Public bodies and government
  '2182', '2185',                                                     // News outlets (including the Korea Times head office) and broadcasters
  '2186',                                                             // Korean conglomerate branch offices
  '2179', '2184', '2187', '2188', '2189', '2190', '2191', '2192', '2193', // Associations, Korean community groups and alumni networks
  '2178', '2180', '2181', '2194', '2195', '2196', '2198', '2199', '2200', '2201', '2203', '2204', '2205', '2206', '2207', '2208', '2209', // Religion
]);

// Fold the Greater Toronto Area into toronto
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
  if (prov === 'ON') return GTA.has(city) ? 'toronto' : null; // In Ontario, only the GTA is covered
  if (prov === 'BC') return 'vancouver';
  if (prov === 'QC') return 'montreal';
  return null;
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // Strip the BOM
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
  const dry = flags.includes('--dry'); // Preview the counts without touching the DB
  // --only=food,cafe,mart,hair,clinic → import just these categories (all of them when omitted)
  const onlyArg = flags.find((a) => a.startsWith('--only='));
  const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim()).filter(Boolean)) : null;
  if (!file) { console.log('Usage: node scripts/importKoreatimes.js <directory.csv> [--pending] [--dry] [--only=food,cafe,...]'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(path.resolve(file), 'utf8'));
  console.log(`📄 ${rows.length} rows · status=${asPending ? 'pending' : 'approved'} · source="${SOURCE_NAME}"${ONLY ? ` · only=[${[...ONLY].join(',')}]` : ''}${dry ? ' · [DRY RUN: no DB writes]' : ''}`);

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
  if (dry) console.log(`✅ would import: ${wouldImport}`);
  else console.log(`✅ imported: ${added} added · ${updated} updated`);
  console.log(`⏭  skipped: not-a-business category ${skipCat}${ONLY ? ` · only filter ${skipOnly}` : ''} · outside covered cities ${skipCity} · missing required fields ${skipBad}`);
  console.log('📊 by category:', catCount);
  console.log('🏙  by city:', cityCount);
  if (!dry) console.log('👉 next: railway run node scripts/geocodeBusinesses.js --limit 300  (batch geocoding)');
  process.exit(0);
}

main().catch((e) => { console.error('❌ import failed:', e); process.exit(1); });
