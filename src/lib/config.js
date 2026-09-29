import Constants from 'expo-constants';

// ═══════════════════════════════════════════════════════════════════
// 🔧 Backend switch — flip this single boolean
// ═══════════════════════════════════════════════════════════════════
//   true  = 💻 local MacBook server (same WiFi, and `cd server && node index.js` on the Mac)
//                → the IP is detected from the Expo dev server (no edits when moving between home and a café)
//   false = 🚂 the deployed Railway server (reachable anywhere)
// ═══════════════════════════════════════════════════════════════════
const USE_LOCAL_SERVER = false;

// Reuses whichever network IP the Expo dev server knows about, so moving networks needs no edit
// hostUri looks like "192.168.x.x:19000" or "172.30.x.x:19000"
const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || '';
const autoLocalIp = hostUri.split(':')[0];
const LOCAL_HOST = autoLocalIp ? `http://${autoLocalIp}:4000` : 'http://localhost:4000';
const PROD_HOST  = 'https://camoim-production.up.railway.app';

// EAS production builds (App Store) have __DEV__=false and always use PROD_HOST.
// The USE_LOCAL_SERVER flag only matters during development (Expo Go).
export const SERVER_HOST = (__DEV__ && USE_LOCAL_SERVER) ? LOCAL_HOST : PROD_HOST;
export const API_BASE_URL = `${SERVER_HOST}/api`;
