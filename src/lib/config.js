import Constants from 'expo-constants';

// ═══════════════════════════════════════════════════════════════════
// 🔧 백엔드 스위치 — true/false 한 글자만 바꾸면 됨
// ═══════════════════════════════════════════════════════════════════
//   true  = 💻 맥북 로컬 서버 (같은 WiFi 필요 + 맥북에서 `cd server && node index.js` 실행)
//                → IP는 Expo dev 서버에서 자동 감지 (집/카페 이동해도 수정 불필요)
//   false = 🚂 Railway 배포 서버 (어디서든 접속 가능)
// ═══════════════════════════════════════════════════════════════════
const USE_LOCAL_SERVER = false;

// Expo dev 서버가 알고 있는 현재 네트워크 IP를 자동으로 사용 → 이사/카페 이동해도 수정 X
// hostUri 형식: "192.168.x.x:19000" 또는 "172.30.x.x:19000"
const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
const autoLocalIp = hostUri.split(':')[0];
const LOCAL_HOST = autoLocalIp ? `http://${autoLocalIp}:4000` : 'http://localhost:4000';
const PROD_HOST  = 'https://camoim-production.up.railway.app';

// EAS 프로덕션 빌드(App Store)는 __DEV__=false라 항상 PROD_HOST 사용.
// 개발 중(Expo Go)일 때만 USE_LOCAL_SERVER 플래그가 영향.
export const SERVER_HOST = (__DEV__ && USE_LOCAL_SERVER) ? LOCAL_HOST : PROD_HOST;
export const API_BASE_URL = `${SERVER_HOST}/api`;
