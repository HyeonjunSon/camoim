// ═══════════════════════════════════════════════════════════════════
// 🔧 백엔드 스위치 — true/false 한 글자만 바꾸면 됨
// ═══════════════════════════════════════════════════════════════════
//   true  = 💻 맥북 로컬 서버 (같은 WiFi 필요 + 맥북에서 `cd server && node index.js` 실행)
//   false = 🚂 Railway 배포 서버 (어디서든 접속 가능)
// ═══════════════════════════════════════════════════════════════════
const USE_LOCAL_SERVER = false;

// 로컬 서버 주소 — 맥북 IP가 바뀌면 `ipconfig getifaddr en0` 로 확인 후 수정
const LOCAL_HOST = 'http://172.31.99.175:4000';
const PROD_HOST  = 'https://camoim-production.up.railway.app';

// EAS 프로덕션 빌드(App Store)는 __DEV__=false라 항상 PROD_HOST 사용.
// 개발 중(Expo Go)일 때만 USE_LOCAL_SERVER 플래그가 영향.
export const SERVER_HOST = (__DEV__ && USE_LOCAL_SERVER) ? LOCAL_HOST : PROD_HOST;
export const API_BASE_URL = `${SERVER_HOST}/api`;
