// 서버 주소 — __DEV__이면 로컬, 아니면 배포 서버 자동 전환
const LOCAL_HOST = 'http://172.31.99.175:4000';
const PROD_HOST = 'https://camoim-production.up.railway.app';

// ⚠️ 테스트용 임시: 무조건 PROD(Railway) 붙기. 테스트 끝나면 아래 줄로 원복:
//   export const SERVER_HOST = __DEV__ ? LOCAL_HOST : PROD_HOST;
export const SERVER_HOST = PROD_HOST;
export const API_BASE_URL = `${SERVER_HOST}/api`;
