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
[유저 폰 - iOS 앱]
      │ HTTPS / WSS
      ▼
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
| DB | **MongoDB Atlas** | 클러스터: `camoim.dipyple.mongodb.net`, Database: `cahanin` |
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

## 🎨 개발 규칙

- **함수형 컴포넌트 + 훅** 사용
- `StyleSheet.create()` 사용
- 색상은 [src/constants/colors.js](src/constants/colors.js)에서 import
- 한국어 주석 권장
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
