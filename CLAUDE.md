# CaMoim (camoim)

캐나다 거주 한국인을 위한 커뮤니티 모바일 앱.
캐스모(다음 카페 기반 한인 커뮤니티)를 앱으로 만들고 에브리타임 기능을 결합.

## 타겟 유저
캐나다 거주 한국인 (유학생, 이민자, 워홀러 등)

---

## 작업 방식 (필수)

모든 작업을 다음 **4명 관점에서 회의하듯 검토**하고 진행한다:

1. **PM (기획자)** — 기능 요구사항, 사용자 경험 검토
2. **Frontend 개발자** — UI/UX 구현, 컴포넌트 설계
3. **Backend 개발자** — API 설계, DB 구조
4. **QA (테스터)** — 버그, 엣지케이스, 예외처리 검토

유저는 의사결정만 하고 나머지는 알아서 처리.

---

## 🏗 배포 아키텍처 (완성됨)

```
[유저 폰 - iOS/Android 앱]        [브라우저 - 웹 (개발 중)]
      │ HTTPS / WSS                     │ httpOnly 쿠키
      │                                 ▼
      │                         [Next.js on Vercel]  ← camoimapp.com (예정)
      │                                 │ Bearer JWT
      ▼                                 ▼
[Railway 백엔드 서버]  ← https://camoim-production.up.railway.app
      │
      ├─ MongoDB Atlas (운영 DB)
      ├─ Cloudinary (이미지 저장소 — 전용)
      └─ Resend (이메일 발송, no-reply@camoimapp.com)
```

### 인프라 요약
| 항목 | 서비스 | 비고 |
|---|---|---|
| 백엔드 호스팅 | **Railway** | GitHub 자동 배포, Root Directory = `server` |
| DB | **MongoDB Atlas** | 클러스터 호스트명은 Railway `MONGODB_URI`에만 존재 (공개 레포에 안 적음), Database: `cahanin` |
| 이미지 | **Cloudinary** | 폴더: `camoim/posts`, `camoim/avatars`, `camoim/verify` |
| 이메일 | **Resend API** | HTTPS 기반 (Railway가 SMTP 차단) |
| 도메인 | `camoimapp.com` | Cloudflare DNS, Resend 검증 완료 |

### 환경변수 (Railway Variables)
- `MONGODB_URI` — Atlas 연결 문자열
- `JWT_SECRET` — 64자 랜덤 키
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`, `MAIL_FROM` (`CaMoim <no-reply@camoimapp.com>`)

로컬 `server/.env`도 동일한 키가 있음 (gitignore됨).

---

## 💻 기술 스택

### Frontend (모바일 앱)
- **Expo** (React Native), JavaScript
- **React Navigation** (native-stack + bottom-tabs)
- **react-native-pell-rich-editor** — 리치 텍스트 에디터
- **Socket.io-client** — 실시간 채팅
- **expo-image-picker**, **expo-image-manipulator** — 이미지 업로드

### Backend (server/)
- **Node.js + Express**
- **Mongoose** (MongoDB ODM)
- **Socket.io** — 채팅
- **Cloudinary + multer-storage-cloudinary** — 이미지 업로드
- **Resend** — 이메일 발송
- **bcryptjs + jsonwebtoken** — 인증

---

## 📂 프로젝트 구조

```
camoim/
├── App.js                       # 앱 루트
├── app.json                     # Expo 설정 (bundleId: com.hyeonjun122.cahanin)
├── eas.json                     # EAS Build 설정
├── .easignore                   # EAS 빌드 시 server/ 제외
│
├── src/                         # React Native 클라이언트
│   ├── components/              # 재사용 UI 컴포넌트
│   ├── screens/                 # 화면
│   │   ├── auth/                # 로그인, 회원가입, 학교인증
│   │   ├── home/                # 홈 피드, 포스트 상세
│   │   ├── board/               # 게시판 목록/피드/글작성·수정
│   │   ├── chat/                # 채팅 (DM + 그룹 + 학교 라운지)
│   │   ├── group/               # 모임 — 생성/상세/멤버/수정/리스트
│   │   ├── admin/               # 관리자 (모임 승인 포함)
│   │   ├── mypage/              # 마이페이지
│   │   └── ...
│   ├── navigation/              # 네비게이션 설정
│   ├── context/                 # Auth, Socket, Theme, Lang
│   ├── lib/                     # api, config, i18n, storage 등
│   ├── constants/               # colors, fonts, roles, legal
│   └── hooks/
│
├── web/                         # Next.js 웹 클라이언트 (Vercel 배포 — 개발 중)
│   └── src/
│       ├── app/                 # App Router (페이지 + BFF 라우트 핸들러)
│       ├── components/
│       └── lib/                 # api(서버전용 fetch), session(쿠키), boards, legal
│
└── server/                      # Express 백엔드 (Railway 배포)
    ├── index.js                 # 서버 엔트리
    ├── db.js                    # Mongo 연결
    ├── socket.js                # Socket.io
    ├── routes/                  # auth, posts, users, chats, admin, ...
    ├── models/                  # Mongoose 스키마
    ├── middleware/              # auth, requireRole, systemGuard
    ├── utils/                   # mailer (Resend), push, blocks, metro
    ├── constants/               # roles, universities, boards
    └── scripts/                 # 마이그레이션 스크립트
```

---

## 🔧 주요 명령어

### 개발
```bash
# Expo 앱 시작 (폰 QR 스캔)
npx expo start

# 캐시 클리어 후 시작
npx expo start -c

# 터널 모드 (다른 WiFi에서 테스트)
npx expo start --tunnel

# iOS 시뮬레이터
npx expo start --ios
```

### 로컬 백엔드 실행 (선택)
```bash
cd server
node index.js
# 또는
npm run dev  # nodemon
```

### 배포

#### ⚡ OTA 업데이트 (JS 변경 → 기본 배포 경로, 1.0.6+)
Expo 개발 서버(`npx expo start`)로 테스트하지 않고, **JS 변경은 `eas update`로 사용자 폰에 즉시 반영**한다 (스토어 심사 X, 비용 0).
```bash
git commit + push
eas update --branch production --message "변경 요약"
# → 앱 재실행 시 자동 다운로드. runtimeVersion(app.json version)이 같은 빌드만 수신
```
- **OTA 가능**: 화면/로직/컴포넌트, i18n·텍스트, 스타일·색상·레이아웃, API 호출, 기존 네비게이션 내 새 화면, require asset
- **OTA 불가 (새 빌드 + 심사 필요)**: 새 네이티브 모듈, app.json 네이티브 설정(bundleId·permissions·plugins), Expo SDK 업그레이드, `runtimeVersion`(=version) bump
- `channel` ↔ `branch` 동일 이름 매칭 (`production` 빌드 → `production` 채널 구독)
- ⚠️ **자동 실행 금지**: 사용자가 "업데이트/출시/전달" 명시할 때만. `eas build`는 특히 명시 명령 필수

#### 📦 네이티브 빌드 (새 버전 출시 시만)
```bash
# 1. app.json version bump (예: 1.0.7 → 1.0.8)  ← runtimeVersion 갱신 = OTA 호환 끊김 신호
# 2. iOS 프로덕션 빌드
eas build --platform ios --profile production
# 3. App Store 제출
eas submit -p ios
```

### 맥북 IP 확인 (로컬 서버 테스트용)
```bash
ipconfig getifaddr en0
```

---

## 🎛 백엔드 스위치 (개발 중)

[src/lib/config.js](src/lib/config.js) 에서 `USE_LOCAL_SERVER` 플래그로 전환:
- `false` (기본) → 🚂 **Railway 서버** 사용 (어디서든 테스트 가능)
- `true` → 💻 **로컬 맥북 서버** (같은 WiFi 필요 + `cd server && node index.js`)

**프로덕션 빌드(App Store)는 항상 Railway 사용** (`__DEV__=false`라 이 플래그 무관).

---

## 📖 문서 (영어 — 외부 공개용)

| 파일 | 내용 |
|---|---|
| [README.md](README.md) | 채용 담당자용 5분 개요 — 기능·아키텍처 다이어그램·기술 선택·문제 4건 요약 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 시스템/시퀀스/ER 다이어그램, 요청 경로, 실시간 채팅, 인증, 미디어, 배포, 알려진 한계 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 기술 선택 11건 — 이유 + 트레이드오프 + "다시 고른다면" |
| [docs/ENGINEERING-NOTES.md](docs/ENGINEERING-NOTES.md) | 프로덕션 문제 4건 상세 (면접용 30초 스크립트 포함) |
| [docs/TESTING.md](docs/TESTING.md) | 테스트 3계층 + CI |
| [docs/BUSINESS-MAP-PLAN.md](docs/BUSINESS-MAP-PLAN.md) | 한인업체 지도 설계 문서 + 실제 출시된 결과 차이 |
| [server/.env.example](server/.env.example) | 서버 환경변수 템플릿 |

기능·구조를 바꾸면 해당 문서도 같이 갱신할 것. 특히 ARCHITECTURE.md의 "Known limits"와
DECISIONS.md의 트레이드오프는 사실과 어긋나면 역효과가 난다.

---

## 🧪 테스트 & CI

```bash
npm test             # 클라이언트 Jest (72 tests)
npm run test:server  # 서버 Jest — 유닛 + 통합 (81 tests)
npm run test:all     # 둘 다
```

- 상세: [docs/TESTING.md](docs/TESTING.md), E2E: [.maestro/README.md](.maestro/README.md)
- ⚠️ **docs/ 와 README.md, .maestro/README.md 는 영어로 작성** (채용 담당자·북미 지원용).
  **코드 주석도 전부 영어**로 통일됨 (2026-09, 공개 레포 + 북미 채용 대비).
  CLAUDE.md만 한국어 유지. 문서 수정 시 언어 섞지 말 것
- **CI**: `.github/workflows/ci.yml` — main push/PR마다 양쪽 Jest 자동 실행
- **서버 앱 분리**: `server/app.js`(Express 조립, 부작용 없음) ↔ `server/index.js`(DB연결·시드·listen).
  테스트는 `app.js`를 supertest로 가져다 쓴다. 새 라우트는 `app.js`에 마운트할 것
- **rate limiter**는 `NODE_ENV === 'test'`일 때 skip (`routes/auth.js`의 `skipInTest`)
- **E2E testID 규약**: `login-*`, `tab-*`, `chat-*` — UI 수정 시 지우면 Maestro 플로우가 깨짐
- 새 기능 추가 시 최소한 순수 로직 유닛 테스트 + 라우트 통합 테스트 1개는 같이 넣는다

---

## ⚡ 성능 (2주차, 2026-09)

상세·수치: [perf/README.md](perf/README.md). 결과 원본은 `perf/results/*.json`.

- **운영 DB 왕복 1회 ≈ 70ms** (Railway ↔ Atlas 리전 불일치 추정 — 대시보드 확인 필요).
  그래서 비용은 쿼리 속도가 아니라 **요청당 "직렬" DB 호출 횟수**. 새 API는 독립 쿼리를 `Promise.all`로
- **캐시** (`server/utils/cache.js`): 게시판 목록(`utils/boardCache.js`, 60s), 차단 목록(`utils/blocks.js`, 30s)
  - 무효화는 **`models/Board.js`, `models/Block.js`의 Mongoose post 훅**이 자동 처리 — 라우트에서 invalidate 호출 불필요
  - ⚠️ 드라이버 직접 쓰기(`collection.xxx`, 마이그레이션 스크립트)는 훅을 안 탐 → TTL 후 반영
  - ⚠️ 단일 인스턴스 전제. 인스턴스 늘리면(AWS 이전 시) 다른 인스턴스는 TTL만큼 낡은 값
- ⚠️ **`aggregate()`는 Mongoose 캐스팅이 없다** — `$match`에 문자열 ID를 넣으면 조용히 아무것도 안 걸림.
  `new mongoose.Types.ObjectId(id)`로 변환 필수 (차단 필터가 뚫렸던 함정, `home-feed.test.js`가 지킴)
- **`$lookup`으로 유저 조인 시 `pipeline`에서 `$project: { nickname: 1 }`** — 유저 문서 전체(passwordHash 등) 끌어오지 않기
- `GET /posts/hot-by-board?top=5` — 앱은 top=5로 5개만 받음. top 없는 구버전 앱은 기존 응답 그대로(하위 호환)
- **클라 세션 복원** (`src/lib/session.js`): 캐시 유저로 즉시 렌더 → `/auth/me` 백그라운드 갱신.
  로그아웃은 **인증 실패(401·정지·탈퇴)일 때만** — 네트워크/5xx/점검은 세션 유지 (예전엔 오프라인 실행 시 로그아웃되던 버그)
- **아이콘**: `import Ionicons from '@expo/vector-icons/Ionicons'` 만 사용. 배럴(`'@expo/vector-icons'`) import 금지 — 19개 세트 폰트 3.5MB가 번들에 들어감
- **RUM**: `src/lib/perf.js` → `perf_cold_start` / `perf_feed_load` / `perf_chat_rtt` 이벤트 (기존 analytics 파이프라인).
  집계: `cd server && railway run node scripts/perf-report.js --since <날짜>`
- 벤치마크: `node perf/server-bench.js --rtt 70 --hot-top 5 --label <이름>` (in-memory DB + 지연 주입 프록시, 운영 무관)
- 번들 비교는 **반드시 같은 플래그**로 (`expo export --dump-sourcemap` 유무로 hbc 크기가 4MB↔6MB 차이남)

---

## 🌐 웹 (web/ — 개발 중, 2026-10)

상세: [web/README.md](web/README.md). 디자인 원본은 Claude 디자인 캔버스 "CaMoim Web"
(홈 / 게시판 피드 / 글 상세 / 지도 / 채팅 5화면).

- **스택**: Next.js 16 App Router + TypeScript + Tailwind v4. 배포는 Vercel, 도메인은 `camoimapp.com` 루트
- **인증은 BFF 패턴** — 브라우저는 Railway에 직접 안 붙는다. Next 서버가 JWT를
  httpOnly 쿠키(`camoim_session`)에 넣고, 서버 쪽에서만 `Bearer`로 붙인다.
  - 이유: 앱 pell 에디터가 만든 글 HTML을 웹에서 렌더하므로 XSS 표면이 있는데,
    토큰이 JS에서 안 읽히면 30일 토큰 탈취가 불가능해진다
  - 같은 도메인 쿠키라 `SameSite=None`·CSRF 토큰 교환이 필요 없다. 쓰기는 `Origin`↔`Host` 일치로 막는다
  - **서버 auth 코드는 안 건드린다** — `middleware/auth.js`는 그대로 Bearer만 읽는다
  - 토큰을 발급하는 엔드포인트(`auth/login`·`register`·`apple`·`google`·`social-complete`·`logout`)는
    범용 프록시 `src/app/api/bff/[...path]`에서 **차단**. 전용 핸들러만 통과
- **`x-app-version` 헤더를 웹에서 보내지 말 것** — systemGuard의 force-update 게이트는
  이 헤더가 있을 때만 발동한다. 웹은 스토어 업데이트 개념이 없으니 안 보내는 게 맞다
- **앱과 동기화 유지해야 하는 4곳**:
  - `web/src/lib/boards.ts` ← `src/constants/colors.js`, `constants/boards.js`, `constants/cities.js`
  - `web/src/lib/stays.ts` ← `src/constants/stays.js`
  - `web/src/lib/camel.ts` ← `src/lib/api.js`의 `toCamel` (`_id`→`id`. 웹도 항상 `.id`)
  - `web/src/lib/legal.ts` 는 `src/constants/legal.js` 를 **직접 import** — 그래서
    `next.config.ts`의 `turbopack.root`가 web/이 아니라 레포 루트다. 건드리면 약관 페이지가 깨짐
- ⚠️ **`city`를 넘기면 도시 없는 글이 전부 탈락한다** — 서버가 `city: { $in: [...] }`를 붙이는데
  도시를 쓰는 건 `LOCAL_BOARD_SLUGS`뿐이다. 즉 `hot-by-board`에 city를 주면 자유·익명·이민·교육·
  워홀·환전 게시판 글이 통째로 사라진다 (앱이 `getHotByBoard()`를 **인자 없이** 부르는 이유).
  city는 `home-sections`(마켓·구인)·`/stays`·보드 피드의 명시적 도시 필터에만 쓸 것
- **`hot-by-board`의 hours 기본값은 48** — 앱은 hours를 안 보내므로 48시간이다.
  웹 홈 첫 탭도 48(`지금`)로 맞춰야 앱과 같은 목록이 나온다
- **도시 키는 영문** (`Toronto`, `Vancouver`…) — `src/constants/cities.js`가 단일 소스.
  `Post.city`와 `?city=` 쿼리가 이 문자열을 그대로 쓴다. **API로 보낼 값은 절대 번역 금지**.
  화면 표기만 `cityLabel()` (`web/src/lib/boards.ts`)로 한글 변환 — 목록에 없는 도시는 영문 그대로 fallback
  (metro folding으로 Kitchener 같은 값이 올 수 있음). 앱은 영문을 그대로 보여주므로 표기는 양쪽이 다르다
- **role 값은 스네이크케이스** (`working_holiday`). `toCamel`은 키만 바꾸고 값은 안 건드린다
- **웹 전용 색 토큰 2개** (`web/src/app/globals.css`) — 앱 값이 흰 배경에서 AA 미달이라 웹에서만 올림.
  앱은 안 건드린다
  - `primary #7F77DD` + 흰 글씨 = 3.6:1 → `--color-brand-strong #6B63D0` (4.6:1)
  - `textSecondary #888888` on white = 3.5:1 → `--color-muted #6E6E73` (4.8:1)
  - `#7F77DD`는 로고 타일·보드 점(위에 글자 없음)에만 계속 사용
- **환율은 서버에서 받는다** (`/api/rate`, 10분 캐시) — 앱의 `CurrencyWidget`은 단말에서
  네이버/야후를 직접 치지만 브라우저에선 CORS로 막힌다. 소스 3종·순서는 앱과 동일
- **Socket.io CORS**: `SOCKET_CORS_ORIGINS`가 비면 모든 origin 허용 분기를 타므로 채팅 단계에서도
  당장 손댈 게 없다. 좁히려면 반드시 빈 화이트리스트=전체허용 분기를 남길 것 (앱이 끊긴다)
- **인증 게이트는 `web/src/proxy.ts`** (Next 16이 `middleware.ts`에서 이름 바꾼 규칙. 구 이름은 경고 발생)
  — 페이지 안의 `redirect()`는 스트리밍이 시작된 뒤면 상태코드를 못 바꿔서 200으로 나간다.
  proxy는 렌더 전에 돌아 제대로 307을 준다.
  **쿠키 존재만** 확인하고 유효성은 API가 판단 → 페이지 안 검사는 2차 방어로 남겨둘 것
- **`apiFetchOrNull`로 "없음"을 판단하지 말 것** — 모든 에러를 삼켜 null을 주므로, 그 값으로
  `notFound()`를 부르면 API가 한 번 흔들릴 때 실존 페이지가 404가 되고 크롤러에 그렇게 캐시된다.
  `loadBoards()`는 그래서 **throw**하고, `app/error.tsx`가 사람 읽을 화면을 보여준다
- **체감 속도 구조** (2026-10 개편)
  - 헤더는 `web/src/app/(site)/layout.tsx`에서 **한 번만** 렌더. 레이아웃은 내부 페이지 이동 시
    다시 렌더되지 않으므로 헤더가 유지된다. 페이지마다 그리던 시절엔 클릭 한 번에 화면 전체가
    갈려나가 300ms 대기가 새로고침처럼 느껴졌다. 그래서 nav 활성 상태·검색어는 props가 아니라
    `usePathname`/`useSearchParams`로 URL에서 읽는다
  - **`loading.tsx`는 `notFound()`를 안 쓰는 페이지에만** 둔다. 경계가 생기면 셸이 200으로 먼저
    흘러나가 뒤이은 `notFound()`·`redirect()`가 상태코드에 반영되지 않는다 (없는 글이 404 대신 200).
    홈·게시판목록·지도·모임목록은 `(index)`/`(home)` route group으로 감싸서 **자식 상세 라우트에
    경계가 번지지 않게** 격리했다 — 그냥 부모 세그먼트에 두면 `/boards/[slug]`까지 덮인다
  - 404를 지켜야 하는 상세 페이지(`/posts/[id]`, `/boards/[slug]`, `/businesses/[id]` …)는 경계 대신
    **`LinkPending`**(`useLinkStatus`)으로 클릭을 즉시 피드백한다
  - 측정(프로덕션 빌드, 로그인 경로): 경계 있음 **첫 바이트 ~80ms** / 없음 **~400ms**
  - ⚠️ **prefetch는 프로덕션에서만 동작**한다. dev가 느린 건 일부 이 탓이니 dev 수치로 판단 말 것
- **좁은 화면 레이아웃 함정** — `flex-wrap` 안에서 `flex-[1_1_210px]`처럼 basis를 주면, 폭이 좁아질 때
  그 항목이 **한 줄을 통째로 차지**하고 grow까지 먹어 전체 폭으로 펼쳐진다. 게시판 레일이 그래서
  모바일에서 13개 세로 목록으로 화면을 덮고 본문을 아래로 밀어냈다.
  - 해결: basis·박스 스타일을 **`lg:` 이상에만** 걸고, 좁은 폭에선 `overflow-x-auto` 가로 칩 행으로
    (`BoardRail.tsx`). 마크업은 하나만 유지 — 모바일/데스크톱 두 벌로 쪼개면 갈라진다
  - `li`에 `display: contents`(= `className="contents"`)를 쓰지 말 것 — 일부 엔진에서 리스트 항목
    role이 접근성 트리에서 사라진다
  - 헤더는 DOM 순서를 **모바일 기준**으로 두고 `md:order-*`로 데스크톱 순서를 복원한다.
    (로고+액션 / 검색 / nav 3줄 → md에서 1줄). 그래야 탭 순서가 보이는 순서와 같다
  - 지도는 모바일에서 **지도를 위로** (`order-1`). 목록이 위면 120행에 밀려 지도에 도달 못 한다
- **글 상세 링크는 `prefetch={false}`** — `GET /api/posts/:id`가 `viewCount`를 올리므로
  링크에 마우스만 올려도 조회수가 오른다. HotPosts·MarketGrid·FreeAndJobs·PostListRow·검색 5곳
- **`/search` 응답은 뷰어 권한으로 안 걸러져 온다** — 학교 게시판 글과 모임 글이 섞여 온다.
  `src/app/search/page.tsx`의 `visiblePosts()`가 서버에서 걸러낸다. 앱도 같은 노출이 있으니 서버 수정 검토 필요
- **글 작성 POST는 JSON으로 보낸다** — `POST /api/posts`는 multer로 감싸져 있지만 multipart가 아니면
  통과시키고 `express.json()`이 파싱한다 (앱도 이미 JSON으로 보냄). 이미지는 `/api/upload/image`로
  먼저 올려 Cloudinary URL을 본문 HTML에 심는 방식
- **`@types/node` v24 + `lib.dom` 충돌** — `Request.formData()`가 빈 타입으로 해석된다.
  업로드 라우트는 파싱 대신 **원본 바디를 스트리밍 패스스루**해서 이 문제를 비켜간다 (`duplex: 'half'` 필요)
- 테스트: `cd web && npm test` (Node 내장 러너 + 네이티브 TS, 22개). sanitize·boards·camel 순수 로직.
  CI `web` job은 Node 24 필요 (네이티브 TS 스트리핑)
- **채팅만 브라우저가 Railway에 직접 붙는다** — WebSocket은 다른 origin이라 httpOnly 쿠키가 안 가고
  Vercel은 소켓을 프록시 못 한다. 그래서 **단기 티켓** 방식:
  - `POST /api/auth/socket-ticket` (서버) — 2분 수명 + `scope: 'socket'` 클레임
  - `middleware/auth.js`가 `scope === 'socket'`을 **거부** → 티켓이 유출돼도 REST에 못 쓴다
  - `socket.js`는 scope 없음(앱) 또는 `'socket'`(웹)만 수락
  - 웹은 `/api/socket-ticket` BFF 핸들러로만 받는다. 범용 프록시에선 차단
  - **`auth`를 콜백으로 넘길 것** (`web/src/lib/socket.ts`) — socket.io가 재연결마다 호출하므로
    객체로 넘기면 30분 뒤 재연결 때 만료된 티켓을 재전송해서 영구 실패한다
- **헤더 뱃지(알림·채팅)는 클라이언트에서 가져온다** (`HeaderBadges.tsx`) — 헤더는 모든 페이지에 있고,
  서버 컴포넌트에서 fetch하면 그 페이지 await가 끝난 뒤에야 도는 **직렬 왕복**이 매 페이지에 붙는다
- **`data` 옆에 형제 필드를 주는 엔드포인트가 있다** — 채팅 메시지는 `{ data, kind, group, school, otherLeft }`.
  `apiFetch`는 `data`만 꺼내므로 이런 곳은 `apiFetchEnvelope()`를 쓸 것.
  BFF 범용 프록시도 이제 **봉투 전체를 그대로 전달**한다
- **익명 글에는 1:1 채팅 버튼을 띄우지 말 것** — `post.userId`가 null이다 (`authorId`는 차단·신고 전용).
  채팅을 열면 익명성이 깨진다
- 테스트: `cd web && npm test` (Node 내장 러너 + 네이티브 TS, 22개). sanitize·boards·camel 순수 로직.
  ⚠️ **Node 22.6+ 필요** — 레포 기본이 v20.13.1이라 `web/.nvmrc`(=24)로 고정. `cd web && nvm use` 후 실행.
  CI `web` job은 Node 24 고정
- **지도 화면은 도시 어휘가 두 개다** (4단계에서 제일 많이 헤맨 지점)
  - `Business.city` = **소문자 슬러그** (`toronto`) — `src/constants/businesses.js`의 `BUSINESS_CITIES`
  - `StayListing.city` = **영문 대문자** (`Toronto`) — `src/constants/cities.js`
  - 둘을 섞으면 조용히 0건이 나온다. `web/src/lib/businesses.ts`의 `stayCityForSlug()`로 변환
- **지도는 거리순 상한 120개** — 토론토 업체만 534개고, 목록 행과 마커가 둘 다 실제 DOM이라
  전부 그리면 패널이 버벅인다. `near`(= **`lng,lat` 순서**)를 항상 넘겨 API가 거리순으로 주게 하고 앞 120개만 렌더
- **Google Maps 키**: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (리퍼러 제한 브라우저 키라 공개가 정상).
  없으면 지도 자리에 안내만 뜨고 목록은 정상 동작 — 설정 공백은 에러가 아니다.
  ⚠️ 앱 Android/iOS 키와 **같은 Cloud 프로젝트**에서 **Maps JavaScript API**를 따로 켜야 함
- **업로드 라우트는 `/api/upload/[kind]` 하나** — upstream 경로는 그 파일의 맵에서만 오고 요청에서 안 온다.
  이게 Cloudinary 폴더 분리(posts/avatars/verify/groups)를 지키는 장치.
  응답 모양이 엔드포인트마다 다르다 (`data.url` / `data.avatarUrl` / **맨 `url`**) → 호출자가 각자 읽는다
- **숙소 주소·핀은 정확한 값이 아니다** — 서버가 exact를 안 내보내고 핀도 jitter를 준다.
  상세 페이지에 그 사실을 명시할 것 (문 앞이라고 오해하면 안 됨)
- **익명 글엔 1:1 채팅 버튼 금지** — `post.userId`가 null (`authorId`는 차단·신고 전용)
- **소개팅은 전면 익명** — 닉네임·아바타가 어디에도 안 나온다. 거절은 신청자에게 **안 알린다**.
  19세 확인은 서버가 `introAgreedAt`만 기록하므로 게이트는 웹에서 구현 (`IntroAgreeGate`, 앱과 같은 문구)
  - `preferredBirthYearMin/Max`는 **`null`로 보낼 것** — `Number('')`은 0이고 0은 finite라서 서버 검사를 통과한다
- **모임 멤버 API의 `id`는 멤버십 id가 아니라 유저 id** — 모든 관리 호출이 유저 id를 받는다
- **글은 board 또는 group 중 하나** (`Post` pre-validate). `/write?group=`은 `groupId`를 보내고
  보드 선택·도시·익명 안내를 숨긴다 (모임 글은 익명 불가)
- **zsh에서 `GID`는 특수 변수** (프로세스 group id) — 셸 스크립트에서 ObjectId를 담으면 산술 오류가 난다
- 명령어: `cd web && npm run dev | typecheck | test | build`

### 진행 상황
- [x] 1단계 — 프로젝트 세팅, BFF 인증, 로그인·회원가입·이메일 인증, 홈 화면, 약관/개인정보 페이지
- [x] 2단계 — 게시판 목록·피드(도시·정렬·거래중 필터·페이지네이션), 글 상세(sanitize·좋아요·북마크),
      댓글(답글·비밀댓글·삭제), 글쓰기·수정(TipTap), 검색
- [x] 3단계 — 채팅(Socket.io 실시간·요청 수락·나가기), 알림(읽음·헤더 뱃지), 마이페이지(프로필·아바타·
      내 글/좋아요/북마크·차단 목록), 공개 프로필, 신고·차단, 1:1 채팅 시작
- [x] 4단계 — 지도(업체·숙소·리뷰·등록요청), 숙소 등록·수정, 모임(가입·멤버관리·모임글),
      학교 커뮤니티(링크·학생회장 인수인계), 소개팅(19세 게이트·신청·수락)
- [ ] 5단계 — 관리자 페이지, Vercel 배포, `camoimapp.com` 연결, 공개 문서(README·ARCHITECTURE) 갱신

### 웹에서 반드시 지킬 것 (QA)
- [x] 앱에서 작성된 글 HTML은 **sanitize 후** 렌더 — `web/src/lib/sanitize.ts` (allowlist + 테스트 10개).
  `dangerouslySetInnerHTML`은 이 함수를 통과한 값만 받는다
- [x] 학교 커뮤니티·익명게시판·소개팅은 **비로그인 접근 차단 + 색인 차단** — 차단은 미들웨어,
  색인은 각 페이지 `robots`. 소개팅은 서버가 보드 row를 더 안 주므로 `/intro`가 앱 안내 페이지
- [x] 소개팅은 웹에서도 **만 19세 이상 확인** 동일 적용 — `IntroAgreeGate`가 앱과 같은 3개 규칙·
  같은 체크박스 문구를 쓰고, 동의 없으면 작성·신청 API가 403
- 학생증 업로드는 웹에서도 **`camoim/verify` 폴더 전용** — 아직 웹에 학교 인증 화면 없음 (앱 안내로 처리)
- TipTap이 만든 HTML이 앱 pell 에디터에서 깨지지 않는지 **실기기 교차 테스트** (아직 안 함).
  툴바를 pell과 같은 세트로 맞추고 codeBlock·blockquote·horizontalRule을 끈 상태 (`PostEditor.tsx`)

---

## 🎨 개발 규칙

- **함수형 컴포넌트 + 훅** 사용
- `StyleSheet.create()` 사용
- 색상은 [src/constants/colors.js](src/constants/colors.js)에서 import
- **주석은 영어로** (공개 레포 — 북미 채용 담당자가 읽음)
- 단, `i18n.js`·`legal.js`·서버 API 에러 메시지의 **한국어 문자열은 유지** (사용자 대상 UI)
- 컴포넌트 파일명: **PascalCase**
- **git commit 메시지는 영어로** (유저 요청)
- **파일 저장은 Cloudinary 전용** (로컬 디스크 저장 금지)

---

## 🧱 핵심 도메인 시스템 (1.0.5 기준)

### 모임 (Groups)
- `server/models/Group.js`, `GroupMembership.js`
- 카테고리 6종 (hobby/study/local/job/workinghol/general), 가입 정책 open|approval, status: pending_review→active 흐름
- 그룹 채팅: `ChatRoom.kind='group'` — 멤버십이 ChatRoom.participants와 자동 동기화
- 그룹 게시판: `Post.groupId` 있으면 모임 글, `Post.boardId`/`groupId` 둘 중 하나 필수 (pre-validate)
- 그룹장/부그룹장 권한: 회원 글 삭제 + pin, 멤버 추방/차단, 부그룹장 임명, 그룹장 양도

### 학교 동아리 (Group.university 필드)
- 비어있으면 일반 모임, 값 있으면 학교 한정
- 가입: 인증된 회원 + `user.university === group.university` 일치
- 일반 모임 목록(`box='all'`) 노출 규칙:
  - admin → 전부
  - 인증 회원 → 일반 + 내 학교 + 가입한 그룹(학교 무관)
  - 미인증/비로그인 → 일반만

### 학교 전체 채팅 (ChatRoom.kind='school')
- 학교당 1개, `ChatRoom.university` 필드로 식별
- `GET /api/universities/chat` — 본인 학교 채팅방 lazy-create + 자동 참여 (인증 회원 전용)
- 메시지 응답에 `school.leaderUserId` 포함 → 클라가 sender와 비교해 ⭐ 학생회장 배지 표시

### 학교 마스터 (University 모델, 1.0.5+)
- `server/models/University.js` — 학교 단일 진실(source of truth)
- 필드: `name` (표시명, Board.university·User.university와 동일 키), `fullName`, `sortOrder`, `active`, `leaderUserId`, `community`
- startup `seedUniversities`로 `constants/universities.js` 풀 리스트를 idempotent upsert
- `/auth/universities` + `/verify/apply`는 이제 DB 조회 (active=true만)
- admin CRUD: `/api/admin/universities` (POST 시 자동으로 free + anonymous 보드 시드)
- 학교 보드 템플릿은 free + anonymous 2종만 (meetup/info 1.0.5에 폐기)

### 학생회장 (University.leaderUserId, 1.0.5+)
- 학교당 1명, admin이 인증 회원을 임명 또는 현 학생회장이 인수인계
- 자격: `user.verified === true && user.university === university.name`
- 변경 경로:
  - `PUT /api/admin/users/:id/university-leader { isLeader }` — admin 임명/해제
  - `PUT /api/universities/leader/transfer { newUserId }` — 현 학생회장이 인수인계 (admin 거치지 않음)
  - `DELETE /api/universities/leader` — 현 학생회장 사임
- 자동 정리: 학생회장이 탈퇴 / unverified / 다른 학교로 이동하면 `GET /community`에서 lazy 검증으로 leaderUserId=null 처리
- 알림: 임명·인수인계 시 `Notification` (`type='university_leader'`) + Expo push 발송
- 배지: 학교 채팅 sender, 학교 게시판 글 작성자 옆에 ⭐ 표시 (`authorIsLeader` / `school.leaderUserId`)

### 학교 커뮤니티 카드 (University.community, 1.0.5+)
- 필드 5종: instagram / kakaoOpen / discord / homepage / notice
- `GET /api/universities/community` — 본인 학교 회원 전용, `canEdit` / `isLeader` 플래그 반환
- `PUT /api/universities/community` — 학생회장 또는 admin, 저장 시점에 URL 정규화 (`@handle` → `https://instagram.com/handle`)
- UI: 학교 커뮤니티 페이지 hero 아래 카드. 학생회장만 우측 상단 ⭐꾸미기 펜슬. `SchoolCommunityEditScreen`에 인수인계/사임 섹션 포함 (학생회장 본인에게만 노출)

### 마켓 거래 상태 (Post.tradeStatus)
- enum `'selling'|'sold'`, default selling, indexed
- 적용: `TRADE_BOARD_SLUGS` = [market, giveaway, car, roomrent] — realestate/jobs 제외
- roomrent만 라벨이 `입주가능/입주완료` (`getTradeLabel`이 슬러그별로 분기)
- 토글: `PUT /api/posts/:id/trade-status` — 작성자 또는 admin

### 알림 정책 (Option B)
- 채팅 메시지는 **Notification 레코드 안 만듦** (카톡 패턴)
- 채팅탭 unread 뱃지 + 푸쉬만 사용
- `/api/notifications` 응답에서 chat/group_chat 타입 자동 필터
- `calculateUnreadBadge`도 chat/group_chat 알림 제외 (ChatRoom.unreadCount로 카운트되니 중복 방지)

### UI 통일 — `CustomHeader` 공통 컴포넌트
- `src/components/CustomHeader.js`
- 좌측 back / 중앙 제목(absoluteFill 정중앙) / 우측 액션
- iOS systemFill `rgba(118,118,128,0.12)` 캡슐
- 11개 화면에 적용 — ChatRoom, GroupDetail/Edit/Members/Create, BoardPostDetail, PostDetail, BoardFeed, UserProfile, Notices/Detail
- 탭 root는 적용 안 함 (back 버튼 없음)

---

## 🚨 중요 결정·주의사항

### 1. 이미지 저장은 Cloudinary 전용
- 과거 로컬 `server/uploads/` 디스크 저장은 **완전히 제거됨**
- `multer.diskStorage` 쓰지 말고 **`CloudinaryStorage`** 사용
- `server/index.js` 의 `/uploads` static serve는 **절대 재도입 금지** (학생증 public 노출 취약점)
- 폴더 분리: `camoim/posts`, `camoim/avatars`, `camoim/verify`, `camoim/groups`

### 2. 이메일은 Resend (SMTP 금지)
- Railway가 SMTP 포트(25/465/587) 차단 → Gmail Nodemailer는 `ETIMEDOUT`
- **Resend HTTPS API** 사용 ([server/utils/mailer.js](server/utils/mailer.js))
- 발신자는 검증된 도메인 `no-reply@camoimapp.com` 사용

### 3. Railway 배포
- GitHub main 브랜치 push 시 자동 재배포
- **Root Directory = `server`** 설정 (repo 루트에 Expo 앱도 같이 있음)
- 포트는 Railway가 `PORT` 환경변수 주입 → 서버 `process.env.PORT || 4000`
- Networking 타겟 포트는 8080 (Railway 기본)

### 4. MongoDB Atlas
- Network Access `0.0.0.0/0` 허용 중 (추후 Railway outbound IP로 좁힐 예정)
- DB 이름: `cahanin` (과거 이름 유지)
- 운영 DB이므로 테스트 데이터 주의

### 5. pell-rich-editor 주의점
- `WebView.scrollEnabled` 가 **하드코딩 `false`** → 외부 `<ScrollView>` 래핑 필수
- `defaultParagraphSeparator` 기본값이 `'div'` → prop으로 `"p"` 강제 필요
- `.pell-content { height: 100% }` 때문에 빈공간 lock-in 발생 → `contentCSSText`에 `height: auto !important` override 필수
- 힌트(글 추가) 로직: `data-fresh` 플래그 + 전역 `e.isTrusted` 리스너로 fresh/typed 상태 관리

### 6. React Native Hermes 주의
- `AbortSignal.timeout()` **미지원** → `AbortController` + `setTimeout` 사용

### 7. api.js `toCamel`: `_id` → `id` 자동 변환
- `request()` helper의 응답이 통과하는 `toCamel`이 `_id` 필드를 `id`로 바꿈
- **프론트에서는 항상 `obj.id` 사용** — `obj._id`는 `undefined`
- 백엔드가 명시적으로 `id: doc._id`로 보내든, list 응답에서 `.lean()` 결과를 그대로 보내든 결과적으로 클라에서는 `id`로 접근
- 새 API 추가할 때 프론트 코드에서 `_id` 쓰면 100% 버그

### 8. 채팅 ChatRoom.kind 3가지
- `'dm'` — 1:1, 차단/요청 단계 로직 있음
- `'group'` — 모임 단체 (groupId 필드, GroupMembership.notifyChat 토글로 푸쉬 제어)
- `'school'` — 학교 라운지 (university 필드, 학교당 1개)
- send_message 핸들러는 group/school을 모두 `isMultiUser`로 묶어 DM 전용 검사 우회
- group/school 모두 `accepted` 상태로 시작 (pending 흐름 없음)

### 9. 거래 상태 게시판 (TRADE_BOARD_SLUGS)
- `server/constants/boards.js`, `src/constants/boards.js` 둘 다 동기화 유지
- 현재: `['market', 'giveaway', 'car', 'roomrent']` — realestate/jobs는 의도적 제외
- 새 거래 보드 추가하려면 양쪽 모두 업데이트

---

## 📱 모바일 앱 배포 플로우 (참고)

1. **백엔드 (Railway)** — git push → 자동 재배포 (1-2분)
2. **프론트엔드 (iOS 앱)** — `eas build -p ios --profile production` → `.ipa` 생성 → `eas submit -p ios` → App Store Connect → TestFlight → 심사 → 공개
3. **`.easignore`** 로 `server/` 폴더는 EAS 빌드에서 제외됨

---

## 🔐 민감 파일 (절대 커밋 금지)

`.gitignore`에 포함됨:
- `server/.env` (JWT_SECRET, CLOUDINARY_API_SECRET, RESEND_API_KEY 등)
- `.env`
- `node_modules/`
- `.expo/`, `dist/`
- `server/uploads/*` (`.gitkeep` 제외)
