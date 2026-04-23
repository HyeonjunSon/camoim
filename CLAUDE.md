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
│   │   ├── chat/                # 채팅
│   │   ├── admin/               # 관리자
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
```bash
# iOS 프로덕션 빌드
eas build --platform ios --profile production

# App Store 제출
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

## 🚨 중요 결정·주의사항

### 1. 이미지 저장은 Cloudinary 전용
- 과거 로컬 `server/uploads/` 디스크 저장은 **완전히 제거됨**
- `multer.diskStorage` 쓰지 말고 **`CloudinaryStorage`** 사용
- `server/index.js` 의 `/uploads` static serve는 **절대 재도입 금지** (학생증 public 노출 취약점)
- 폴더 분리: `camoim/posts`, `camoim/avatars`, `camoim/verify`

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
