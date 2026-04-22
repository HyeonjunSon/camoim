// 서버 주소 — __DEV__이면 로컬, 아니면 배포 서버 자동 전환
const LOCAL_HOST = 'http://172.30.1.23:4000';
const PROD_HOST = 'https://camoim-production.up.railway.app';

export const SERVER_HOST = __DEV__ ? LOCAL_HOST : PROD_HOST;
export const API_BASE_URL = `${SERVER_HOST}/api`;
