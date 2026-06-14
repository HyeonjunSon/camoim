/**
 * 시드 계정으로 캐스모 이관 글을 운영 API에 업로드.
 * 운영 PUBLIC API(https://camoim-production.up.railway.app/api)를 그대로 호출하므로
 * railway run / DB 직결 불필요. 시드 계정 공통 비번만 있으면 됨.
 *
 * 사용법:
 *   cd server
 *   node scripts/uploadSeedPosts.js posts.json
 *   # 비번은 server/seed-accounts.env의 SEED_PASSWORD 자동 사용 (없으면 SEED_PASSWORD env)
 *
 * posts.json 형식 (배열):
 * [
 *   { "board": "free",   "title": "제목", "content": "본문\n여러 줄 가능" },
 *   { "board": "market", "title": "...",  "content": "...", "account": 7 }  // account: 1~35 강제 지정(선택)
 * ]
 *  - board: 게시판 slug (free/anonymous/meetup/market/jobs/roomrent/exchange/
 *           immigration/study/workingholiday/car/giveaway/realestate)
 *  - content: 플레인 텍스트 (HTML 태그 X). 줄바꿈은 \n
 *  - account 생략 시 35개 계정에 자동 분배(셔플 순환)
 */
const fs = require('fs');
const path = require('path');

const API = process.env.API_BASE || 'https://camoim-production.up.railway.app/api';
const DOMAIN = process.env.SEED_DOMAIN || 'camoimapp.com';
const PREFIX = process.env.SEED_PREFIX || 'seed';
const TOTAL_ACCOUNTS = parseInt(process.env.SEED_COUNT || '35', 10);
const DELAY_MS = parseInt(process.env.UPLOAD_DELAY_MS || '350', 10);

// 공통 비번: env 우선, 없으면 seed-accounts.env에서 파싱
function resolvePassword() {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  const envFile = path.join(__dirname, '..', 'seed-accounts.env');
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^SEED_PASSWORD=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

// 1..n 셔플
function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

(async () => {
  const file = process.argv[2];
  if (!file) {
    console.error('❌ 사용법: node scripts/uploadSeedPosts.js posts.json');
    process.exit(1);
  }
  const password = resolvePassword();
  if (!password) {
    console.error('❌ 비밀번호를 찾을 수 없음. SEED_PASSWORD env 또는 seed-accounts.env 필요.');
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!Array.isArray(posts) || posts.length === 0) {
    console.error('❌ posts.json은 비어있지 않은 배열이어야 함.');
    process.exit(1);
  }

  // 보드 slug → id 매핑 (운영에서 실시간 조회)
  const boardsRes = await api('/boards');
  if (!boardsRes.ok) {
    console.error('❌ 보드 목록 조회 실패:', boardsRes.status, boardsRes.data);
    process.exit(1);
  }
  const boardList = boardsRes.data?.data || boardsRes.data || [];
  const boardMap = {};
  boardList.forEach((b) => { boardMap[b.slug] = b.id || b._id; });

  // 사전 발급 토큰 파일이 있으면 로그인 대신 사용 (login rate limit 우회)
  // generateSeedTokens.js 로 생성. 없으면 /auth/login 폴백.
  const tokensFile = process.env.TOKENS_FILE || path.join(__dirname, 'seed-tokens.json');
  let preTokens = null;
  if (fs.existsSync(tokensFile)) {
    preTokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
    console.log(`🔑 사전 토큰 사용: ${tokensFile} (${Object.keys(preTokens).length}개)`);
  }

  const tokens = {};   // accountNum -> { token, nickname }
  async function loginAs(n) {
    if (tokens[n]) return tokens[n];
    if (preTokens && preTokens[n]?.token) {
      tokens[n] = { token: preTokens[n].token, nickname: preTokens[n].nickname };
      return tokens[n];
    }
    const email = `${PREFIX}${String(n).padStart(2, '0')}@${DOMAIN}`.toLowerCase();
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (!r.ok || !r.data?.data?.token) {
      throw new Error(`로그인 실패 ${email}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    tokens[n] = { token: r.data.data.token, nickname: r.data.data.user?.nickname || email };
    return tokens[n];
  }

  // 자동 분배용 셔플 순환 큐
  const order = shuffled(TOTAL_ACCOUNTS);
  let cursor = 0;

  const results = [];
  for (let i = 0; i < posts.length; i += 1) {
    const p = posts[i];
    const label = `[${i + 1}/${posts.length}] "${(p.title || '').slice(0, 30)}"`;
    try {
      const boardId = boardMap[p.board];
      if (!boardId) throw new Error(`알 수 없는 board slug: ${p.board}`);
      if (!p.title || !p.content) throw new Error('title/content 누락');

      // 계정 결정: 지정값 우선, 없으면 셔플 순환
      let n = p.account;
      if (!n) { n = order[cursor % order.length]; cursor += 1; }

      const { token, nickname } = await loginAs(n);
      const r = await api('/posts', {
        method: 'POST',
        token,
        body: { boardId, title: p.title, content: p.content },
      });
      if (!r.ok) throw new Error(`업로드 실패: ${r.status} ${JSON.stringify(r.data)}`);

      console.log(`✅ ${label} → ${p.board} / ${nickname} (seed${String(n).padStart(2, '0')})`);
      results.push({ ok: true, board: p.board, account: n, nickname, postId: r.data?.data?.id });
    } catch (err) {
      console.log(`❌ ${label} — ${err.message}`);
      results.push({ ok: false, title: p.title, error: err.message });
    }
    await sleep(DELAY_MS);
  }

  const ok = results.filter((r) => r.ok).length;
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 완료: ${ok}/${posts.length} 성공`);
  if (ok < posts.length) {
    console.log('실패 목록:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`   - "${r.title}": ${r.error}`));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})().catch((e) => { console.error('치명적 오류:', e); process.exit(1); });
