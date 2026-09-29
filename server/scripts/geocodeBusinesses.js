// Batch-geocode businesses with no location — safe to re-run (it only processes what is left)
//
// Usage:
//   railway run node scripts/geocodeBusinesses.js --limit 300
//
// Note: OSM Nominatim throttles bulk geocoding (1 request per second, bulk discouraged).
//       Prefer several runs of ~300 at a time. Failures are retried on the next run.
//       For more speed, swap in a Google Geocoding API key (replace utils/geocode.js).
require('dotenv').config();
const connectDB = require('../db');
const Business = require('../models/Business');
const { geocodeAddress } = require('../utils/geocode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MISSING = { $or: [{ location: { $exists: false } }, { 'location.coordinates': { $exists: false } }] };

// Korea Times address quirks — candidate queries to retry, in order, when the first attempt fails
// e.g. "691 Bloor , W. Toronto, ON. M6G 1L3"
//  1) the cleaned form (parentheses, Unit and # removed)
//  2) direction fixed: "691 Bloor W, Toronto, ..."
//  3) street type inserted: Korea Times addresses often omit St/Ave/Rd, which OSM struggles to match
//     → try "691 Bloor St W", "691 Bloor Ave W" and so on (in practice this resolves most failures)
//  4) postal code only (last resort — OSM's Canadian postal data is patchy)
const STREET_SUFFIXES = ['St', 'Ave', 'Rd', 'Dr', 'Blvd'];
const HAS_SUFFIX_RE = /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|cres|crescent|way|ct|court|pkwy|parkway|line|circle|cir|trail|gate|hwy|highway|sideroad|terrace|lane|ln|pl|place|quay|sq|square|grove|path|heights|hts|gardens|gdns|mall|row|walk|close|view|mills|park|loop)\b\.?$/i;

function candidateQueries(address) {
  const out = [];
  // Base cleanup: drop parenthesized text (Korean descriptions and the like), Unit/Suite/#, and tidy whitespace
  let a = String(address)
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .replace(/\b(unit|suite|ste)\.?\s*#?\s*[\w-]+/gi, ' ')
    .replace(/#\s*[\w-]+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  out.push(a);

  // When a direction (N./S./E./W.) sits before the city, move it after the street name
  const dirFix = a.replace(/^(\d[\w' .-]*?)\s*,\s*([NSEW])\.\s+/i, '$1 $2, ');
  if (dirFix !== a) { out.push(dirFix); a = dirFix; }

  // With no street type, try St/Ave/Rd/Dr/Blvd in turn (the direction goes after the type: "Bloor St W")
  const m = a.match(/^(\d+[A-Za-z]?\s+[A-Za-z][\w' .-]*?)(\s+[NSEW])?\s*,(.*)$/);
  if (m && !HAS_SUFFIX_RE.test(m[1].trim())) {
    for (const suf of STREET_SUFFIXES) out.push(`${m[1].trim()} ${suf}${m[2] || ''},${m[3]}`);
  }

  // Postal code fallback
  const postal = a.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
  if (postal) out.push(postal[0].toUpperCase());

  // Final normalization: "ON." becomes "ON", and ", Canada" is appended
  // (with canada in the address, geocodeAddress skips the city hint —
  //  a hint would duplicate the city, as in "Richmond Hill ... Toronto ...", and break the Nominatim match)
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
  console.log(`${total} businesses without coordinates · processing ${targets.length} this run`);

  let ok = 0, fail = 0, cached = 0;
  const cache = new Map(); // Address → [lng, lat] (avoids re-querying the same address)
  const keyOf = (b) => `${b.city}|${b.address.trim().toLowerCase()}`;

  for (let i = 0; i < targets.length; i++) {
    const b = targets[i];
    const key = keyOf(b);

    let coords = cache.get(key);
    if (!coords) {
      // Reuse coordinates when another business in the DB already has this address (no API call)
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
      continue; // A cache hit makes no API call, so no sleep is needed
    }

    let geo = null;
    for (const q of candidateQueries(b.address)) {
      geo = await geocodeAddress(q, b.city);
      if (geo) break;
      await sleep(1200); // Respect the rate limit between candidates too
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
    await sleep(1200); // Comply with the Nominatim usage policy (only when an API call actually happened)
    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${targets.length} (ok ${ok} / failed ${fail} / address reused ${cached})`);
  }

  const remaining = await Business.countDocuments(MISSING);
  console.log('─'.repeat(48));
  console.log(`✅ this run: ${ok} ok · ${fail} failed`);
  console.log(`📍 still without coordinates: ${remaining} ${remaining > 0 ? '→ run the script again' : '→ all done!'}`);
  process.exit(0);
}

main().catch((e) => { console.error('❌ geocoding failed:', e); process.exit(1); });
