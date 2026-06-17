/**
 * 이미 올라간 환전 글(환율 없는 버전)을 새 "앱 환율 기준" 스타일로 편집.
 * 작성 계정(seed) 토큰으로 PUT /api/posts/:id.
 *
 * 사용법: cd server && node scripts/editExchangePosts.js
 */
const fs = require('fs');
const path = require('path');

const API = process.env.API_BASE || 'https://camoim-production.up.railway.app/api';
const EXCHANGE_BOARD_ID = '69d574f49f4f31d9de17653e';
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-tokens.json'), 'utf8'));

// 편집할 글: 기존 제목으로 찾아서 새 제목/본문으로 교체. account = seed 번호(작성자)
const EDITS = [
  {
    matchTitle: '캐나다 달러 삽니다!',
    account: 10, // 워홀1년차
    newTitle: '캐나다 달러 2000불 사요',
    newContent: '앱 환율 기준으로 한국 계좌에 보내드려요.\n영앤핀치 부근 조율 가능합니다.',
  },
  {
    matchTitle: '캐나다 달러 팝니다 (다운타운 직거래)',
    account: 32, // 핼리팩스바다
    newTitle: '캐나다 달러 2000불 팔아요',
    newContent: '캐모임 앱 환율 기준으로 거래해요.\n다운타운 직거래 가능합니다. 연락 주세요!',
  },
];

async function api(p, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null; try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  // 환전 보드 최신 글 목록
  const r = await api(`/boards/${EXCHANGE_BOARD_ID}/posts?limit=50`);
  const list = r.data?.data?.posts || r.data?.data || r.data?.posts || (Array.isArray(r.data) ? r.data : []);
  console.log(`환전 보드 글 ${list.length}개 조회`);

  for (const e of EDITS) {
    const post = list.find(p => (p.title || '').trim() === e.matchTitle);
    if (!post) { console.log(`❌ 못 찾음: "${e.matchTitle}"`); continue; }
    const id = post.id || post._id;
    const { token, nickname } = tokens[e.account] || {};
    if (!token) { console.log(`❌ 토큰 없음: account ${e.account}`); continue; }

    const up = await api(`/posts/${id}`, {
      method: 'PUT', token,
      body: { title: e.newTitle, content: e.newContent },
    });
    if (up.ok) console.log(`✅ 수정됨 (${nickname}) "${e.matchTitle}" → "${e.newTitle}"`);
    else console.log(`❌ 수정 실패 ${up.status} ${JSON.stringify(up.data)} — "${e.matchTitle}"`);
  }
})().catch(e => { console.error('오류:', e); process.exit(1); });
