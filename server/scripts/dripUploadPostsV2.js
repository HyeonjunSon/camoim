/**
 * dripUploadPosts V2 — 사진 1장 + 도시(city) 지원 버전.
 * 글을 하나씩 랜덤 간격(기본 13~27분)으로 업로드. 시드 토큰 + 운영 PUBLIC API.
 *
 * posts JSON 항목: { board, title, content, city?, image?, stay? }
 *   - city:  "Toronto" 같은 표시 문자열 (LOCAL 보드만 의미 있음)
 *   - image: 사진 파일명 (PHOTO_DIR 기준) 또는 절대경로. 있으면 multipart로 업로드
 *   - stay:  있으면 글 등록 후 같은 계정으로 지도 숙소(POST /stays)도 생성.
 *            { title?, stayType, price, priceUnit?, deposit?, conditions[], address,
 *              neighborhood?, moveInDate?, availableUntil?, minLeaseMonths?, description? }
 *            숙소 이미지는 방금 올린 글의 Cloudinary 이미지를 재사용, sourcePostId로 연동.
 *
 * 사용법:
 *   cd server
 *   nohup caffeinate -is node scripts/dripUploadPostsV2.js scripts/posts-xxx.json \
 *     >> scripts/drip-xxx.log 2>&1 &
 *
 * 환경변수: DRIP_MIN_MIN/DRIP_MAX_MIN(간격,분), PHOTO_DIR(사진 폴더), STATE_FILE
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const API = process.env.API_BASE || 'https://camoim-production.up.railway.app/api';
const MIN_MIN = parseFloat(process.env.DRIP_MIN_MIN || '13');
const MAX_MIN = parseFloat(process.env.DRIP_MAX_MIN || '27');
const PHOTO_DIR = process.env.PHOTO_DIR || path.join(os.homedir(), 'Desktop', '방사진');
const tokensFile = process.env.TOKENS_FILE || path.join(__dirname, 'seed-tokens.json');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveImage(img) {
  if (!img) return null;
  const p = path.isAbsolute(img) ? img : path.join(PHOTO_DIR, img);
  return fs.existsSync(p) ? p : null;
}

async function postOne(token, boardId, p) {
  const imgPath = resolveImage(p.image);
  let res;
  if (imgPath) {
    const fd = new FormData();
    fd.append('boardId', boardId);
    fd.append('title', p.title);
    fd.append('content', p.content);
    if (p.city) fd.append('city', p.city);
    const buf = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    const type = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    fd.append('images', new Blob([buf], { type }), path.basename(imgPath));
    res = await fetch(`${API}/posts`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  } else {
    const body = { boardId, title: p.title, content: p.content };
    if (p.city) body.city = p.city;
    res = await fetch(`${API}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data, hadImage: !!imgPath, wantedImage: !!p.image };
}

// 글 등록 후 같은 계정으로 지도 숙소 생성 (글 이미지 재사용 + sourcePostId 연동)
async function createStayForPost(token, postId, p) {
  let images = [];
  try {
    const pd = await (await fetch(`${API}/posts/${postId}`)).json();
    images = pd?.data?.images || [];
  } catch {}
  const s = p.stay;
  const body = {
    title: s.title || p.title.replace(/^\[[^\]]*\]\s*/, ''), // "[지역] " 프리픽스 제거
    stayType: s.stayType,
    price: s.price,
    priceUnit: s.priceUnit || 'month',
    deposit: s.deposit || 0,
    conditions: s.conditions || [],
    address: s.address,
    neighborhood: s.neighborhood || '',
    moveInDate: s.moveInDate || '',
    availableUntil: s.availableUntil || '',
    minLeaseMonths: s.minLeaseMonths || 0,
    description: s.description || p.content,
    images,
    city: s.city || p.city || '',
    sourcePostId: postId,
  };
  const res = await fetch(`${API}/stays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, located: data?.located, data };
}

(async () => {
  const file = process.argv[2];
  if (!file) { log('❌ 사용법: node scripts/dripUploadPostsV2.js posts.json'); process.exit(1); }

  const stateFile = process.env.STATE_FILE || path.resolve(file).replace(/\.json$/, '-state.json');
  const posts = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
  const accountNums = Object.keys(tokens);

  const br = await fetch(`${API}/boards`).then((r) => r.json()).catch(() => null);
  const boardList = br?.data || br || [];
  const boardMap = {};
  boardList.forEach((b) => { boardMap[b.slug] = b.id || b._id; });

  let startIndex = 0;
  if (fs.existsSync(stateFile)) {
    try { startIndex = JSON.parse(fs.readFileSync(stateFile, 'utf8')).nextIndex || 0; } catch {}
  }

  log(`🚿 V2 드립 시작 — 총 ${posts.length}개, 시작 ${startIndex}, 간격 ${MIN_MIN}~${MAX_MIN}분, 사진폴더 ${PHOTO_DIR}`);

  let lastAcct = null;
  for (let i = startIndex; i < posts.length; i += 1) {
    const p = posts[i];
    const boardId = boardMap[p.board];

    let n;
    do { n = accountNums[Math.floor(Math.random() * accountNums.length)]; }
    while (accountNums.length > 1 && n === lastAcct);
    lastAcct = n;
    const { token, nickname } = tokens[n];

    if (!boardId) {
      log(`❌ [${i + 1}/${posts.length}] 알 수 없는 board "${p.board}" — 스킵`);
    } else {
      try {
        const r = await postOne(token, boardId, p);
        const imgNote = r.wantedImage ? (r.hadImage ? '📷' : '⚠️사진못찾음') : '';
        if (r.ok) {
          log(`✅ [${i + 1}/${posts.length}] ${p.board}/${nickname} ${imgNote} — "${p.title.slice(0, 30)}"`);
          // 숙소 지도 동시 등록
          if (p.stay && r.data?.data?.id) {
            try {
              const sr = await createStayForPost(token, r.data.data.id, p);
              if (sr.ok) log(`   🗺 지도 숙소 등록 OK${sr.located === false ? ' (⚠️지오코딩 실패 — 핀 없음)' : ''}`);
              else log(`   🗺❌ 숙소 등록 실패 ${sr.status} ${JSON.stringify(sr.data).slice(0, 120)}`);
            } catch (e) { log(`   🗺❌ 숙소 등록 에러 ${e.message}`); }
          }
        } else log(`❌ [${i + 1}/${posts.length}] 실패 ${r.status} ${JSON.stringify(r.data)} — "${p.title.slice(0, 30)}"`);
      } catch (e) {
        log(`❌ [${i + 1}/${posts.length}] 에러 ${e.message}`);
      }
    }

    fs.writeFileSync(stateFile, JSON.stringify({ nextIndex: i + 1 }));

    if (i < posts.length - 1) {
      const mins = MIN_MIN + Math.random() * (MAX_MIN - MIN_MIN);
      log(`⏳ 다음까지 ${mins.toFixed(1)}분 대기...`);
      await sleep(mins * 60 * 1000);
    }
  }
  log('🏁 드립 완료');
})();
