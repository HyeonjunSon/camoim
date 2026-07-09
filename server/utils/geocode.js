// OpenStreetMap Nominatim 지오코딩 (무료·키 불필요) — 주소 → 좌표 best-effort 변환
// Google Places 대신 사용 (약관/과금 이슈 회피). 저볼륨 전제.
// 주의: Nominatim 이용 정책상 User-Agent 필수 + 초당 1req 권장. 대량 시드는 지연 필요.
const CITY_HINT = {
  toronto: 'Toronto, ON, Canada',
  vancouver: 'Vancouver, BC, Canada',
  montreal: 'Montreal, QC, Canada',
};

// 주소 문자열을 { lat, lng }로 변환. 실패하면 null (업체는 좌표 없이 저장됨 → 승인/수정 시 재시도 가능)
async function geocodeAddress(address, cityKey) {
  if (!address || !address.trim()) return null;
  const hint = CITY_HINT[cityKey] || 'Canada';
  const q = /canada/i.test(address) ? address : `${address.trim()}, ${hint}`;
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

module.exports = { geocodeAddress };
