/**
 * 글을 한 번에 하나씩, 랜덤 간격(기본 13~27분, 평균 ~20분)으로 천천히 업로드.
 * 봇처럼 정확히 N분마다가 아니라 매번 다른 간격으로 올림.
 *
 * 시드 토큰(seed-tokens.json) + 운영 PUBLIC API 사용. railway run 불필요.
 * 중단돼도 posts-drip-state.json에 다음 인덱스를 기록 → 재실행 시 이어서.
 *
 * 사용법 (백그라운드 권장):
 *   cd server
 *   nohup caffeinate -is node scripts/dripUploadPosts.js scripts/posts-drip.json \
 *     >> scripts/drip.log 2>&1 &
 *
 * 간격 조정:  DRIP_MIN_MIN / DRIP_MAX_MIN (분 단위)
 */
const fs = require('fs');
const path = require('path');

const API = process.env.API_BASE || 'https://camoim-production.up.railway.app/api';
const MIN_MIN = parseFloat(process.env.DRIP_MIN_MIN || '13');
const MAX_MIN = parseFloat(process.env.DRIP_MAX_MIN || '27');
const tokensFile = process.env.TOKENS_FILE || path.join(__dirname, 'seed-tokens.json');
const stateFile  = process.env.STATE_FILE  || path.join(__dirname, 'posts-drip-state.json');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postOne(token, boardId, title, content) {
  const res = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ boardId, title, content }),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  const file = process.argv[2];
  if (!file) { log('❌ 사용법: node scripts/dripUploadPosts.js posts.json'); process.exit(1); }

  const posts  = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
  const accountNums = Object.keys(tokens);

  // 보드 slug → id (운영 실시간 조회)
  const br = await fetch(`${API}/boards`).then((r) => r.json()).catch(() => null);
  const boardList = br?.data || br || [];
  const boardMap = {};
  boardList.forEach((b) => { boardMap[b.slug] = b.id || b._id; });

  let startIndex = 0;
  if (fs.existsSync(stateFile)) {
    try { startIndex = JSON.parse(fs.readFileSync(stateFile, 'utf8')).nextIndex || 0; } catch {}
  }

  log(`🚿 드립 시작 — 총 ${posts.length}개, 시작 인덱스 ${startIndex}, 간격 ${MIN_MIN}~${MAX_MIN}분 랜덤`);

  let lastAcct = null;
  for (let i = startIndex; i < posts.length; i += 1) {
    const p = posts[i];
    const boardId = boardMap[p.board];

    // 직전과 다른 계정으로 (자연스럽게)
    let n;
    do { n = accountNums[Math.floor(Math.random() * accountNums.length)]; }
    while (accountNums.length > 1 && n === lastAcct);
    lastAcct = n;
    const { token, nickname } = tokens[n];

    if (!boardId) {
      log(`❌ [${i + 1}/${posts.length}] 알 수 없는 board "${p.board}" — 스킵`);
    } else {
      try {
        const r = await postOne(token, boardId, p.title, p.content);
        if (r.ok) log(`✅ [${i + 1}/${posts.length}] ${p.board} / ${nickname} — "${p.title.slice(0, 28)}"`);
        else      log(`❌ [${i + 1}/${posts.length}] 실패 ${r.status} ${JSON.stringify(r.data)} — "${p.title.slice(0, 28)}"`);
      } catch (e) {
        log(`❌ [${i + 1}/${posts.length}] 에러 ${e.message}`);
      }
    }
    fs.writeFileSync(stateFile, JSON.stringify({ nextIndex: i + 1 }));

    if (i < posts.length - 1) {
      const ms = Math.round((MIN_MIN + Math.random() * (MAX_MIN - MIN_MIN)) * 60000);
      log(`⏳ 다음 글까지 ${(ms / 60000).toFixed(1)}분 대기 (예정 ${new Date(Date.now() + ms).toLocaleTimeString()})`);
      await sleep(ms);
    }
  }

  log(`🎉 드립 완료 — ${posts.length}개 전부 업로드`);
})().catch((e) => { log('치명적 오류: ' + e.message); process.exit(1); });
