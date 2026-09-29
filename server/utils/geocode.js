// OpenStreetMap Nominatim geocoding (free, no key) — best-effort address to coordinates
// Used instead of Google Places to sidestep the terms and billing. Assumes low volume.
// Note: Nominatim's usage policy requires a User-Agent and suggests 1 req/sec. Bulk seeding needs a delay.
const CITY_HINT = {
  toronto: 'Toronto, ON, Canada',
  vancouver: 'Vancouver, BC, Canada',
  montreal: 'Montreal, QC, Canada',
};

// Strip floor, unit and suite fragments that throw geocoding off.
// Nominatim expects "street address, city", so a "2nd Floor" or "Unit 5" in the middle
// breaks the match. The original text stays in the DB; this cleanup is only for the lookup.
function stripUnitTokens(address) {
  let s = ` ${address} `;
  // Floors: "2nd Floor", "3rd Fl", "Floor 2", "Ground/Lower/Upper/Basement Floor"
  s = s.replace(/\b(?:ground|lower|upper|basement)\s+floors?\b\.?/gi, ' ');
  s = s.replace(/\b\d+\s*(?:st|nd|rd|th)?\s*(?:floor|fl)\b\.?/gi, ' ');
  s = s.replace(/\bfloors?\s*\d+\b/gi, ' ');
  // Units and suites: Unit / Suite / Ste / Apt / Apartment / Room / Rm / Bldg (+ number)
  s = s.replace(/\b(?:unit|suite|ste|apt|apartment|room|rm|bldg|building)\.?\s*#?\s*[\w-]+/gi, ' ');
  // "#200", "# 3" forms
  s = s.replace(/#\s*[\w-]+/g, ' ');
  // Korean-language floor notation: numbered floors, basement floors, "B1"
  s = s.replace(/(?:지하\s*)?\d+\s*층/g, ' ');
  s = s.replace(/\bB\d+\b/gi, ' ');
  // Tidy up: collapse repeated spaces, normalize around commas, trim stray commas and whitespace
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\s*,(?:\s*,)+/g, ', ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/^[\s,]+|[\s,]+$/g, '');
  return s.trim();
}

async function nominatimQuery(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CaMoim/1.0 (https://camoimapp.com)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Turn an address string into { lat, lng }, or null on failure (a business saves without coordinates and can be retried on approval or edit)
// Order: the cleaned form (floor/unit removed) first, the original as a fallback. The cleaned form usually hits.
async function geocodeAddress(address, cityKey) {
  if (!address || !address.trim()) return null;
  const hint = CITY_HINT[cityKey] || 'Canada';
  const withHint = (a) => (/canada/i.test(a) ? a : `${a.trim()}, ${hint}`);

  const base = address.trim();
  const cleaned = stripUnitTokens(base);
  const candidates = [];
  if (cleaned && cleaned.length >= 5 && cleaned.toLowerCase() !== base.toLowerCase()) {
    candidates.push(cleaned);
  }
  candidates.push(base);

  for (let i = 0; i < candidates.length; i++) {
    const r = await nominatimQuery(withHint(candidates[i]));
    if (r) return r;
    // Spacing between calls per Nominatim's policy (no need to wait after the final attempt)
    if (i < candidates.length - 1) await new Promise((s) => setTimeout(s, 1100));
  }
  return null;
}

module.exports = { geocodeAddress, stripUnitTokens };
