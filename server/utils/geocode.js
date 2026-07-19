// OpenStreetMap Nominatim 지오코딩 (무료·키 불필요) — 주소 → 좌표 best-effort 변환
// Google Places 대신 사용 (약관/과금 이슈 회피). 저볼륨 전제.
// 주의: Nominatim 이용 정책상 User-Agent 필수 + 초당 1req 권장. 대량 시드는 지연 필요.
const CITY_HINT = {
  toronto: 'Toronto, ON, Canada',
  vancouver: 'Vancouver, BC, Canada',
  montreal: 'Montreal, QC, Canada',
};

// 주소에서 층·호수·유닛 등 지오코딩을 방해하는 표현 제거.
// Nominatim은 "번지 도로명, 도시" 구조를 기대 → 중간에 "2nd Floor", "Unit 5" 같은 표현이
// 끼면 매칭에 실패한다. 원본 텍스트는 DB에 그대로 두고, 좌표 검색용으로만 정리한다.
function stripUnitTokens(address) {
  let s = ` ${address} `;
  // 영문 층: "2nd Floor", "3rd Fl", "Floor 2", "Ground/Lower/Upper/Basement Floor"
  s = s.replace(/\b(?:ground|lower|upper|basement)\s+floors?\b\.?/gi, ' ');
  s = s.replace(/\b\d+\s*(?:st|nd|rd|th)?\s*(?:floor|fl)\b\.?/gi, ' ');
  s = s.replace(/\bfloors?\s*\d+\b/gi, ' ');
  // 영문 유닛/호수: Unit / Suite / Ste / Apt / Apartment / Room / Rm / Bldg (+ 번호)
  s = s.replace(/\b(?:unit|suite|ste|apt|apartment|room|rm|bldg|building)\.?\s*#?\s*[\w-]+/gi, ' ');
  // "#200", "# 3" 형태
  s = s.replace(/#\s*[\w-]+/g, ' ');
  // 한글 층: "2층", "지하 1층", "B1"
  s = s.replace(/(?:지하\s*)?\d+\s*층/g, ' ');
  s = s.replace(/\bB\d+\b/gi, ' ');
  // 정리: 중복 공백 → 하나, 콤마 주변 정돈, 앞뒤 콤마/공백 제거
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

// 주소 문자열을 { lat, lng }로 변환. 실패하면 null (업체는 좌표 없이 저장됨 → 승인/수정 시 재시도 가능)
// 시도 순서: 정리본(층·호수 제거) 먼저 → 실패 시 원본. 대부분 정리본에서 바로 성공한다.
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
    // Nominatim 정책상 연속 요청 간 간격 (마지막 시도 뒤엔 대기 불필요)
    if (i < candidates.length - 1) await new Promise((s) => setTimeout(s, 1100));
  }
  return null;
}

module.exports = { geocodeAddress, stripUnitTokens };
