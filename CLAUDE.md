cat > /Users/sonhyeonjun/Desktop/cahanin/CLAUDE.md << 'EOF'
# cahanin

캐나다 거주 한국인을 위한 커뮤니티 모바일 앱.
캐스모(다음 카페 기반 한인 커뮤니티)를 앱으로 만들고, 에브리타임 기능을 결합.
캐나다 한국인 커뮤니티 활성화 목표.

## 타겟 유저
캐나다 거주 한국인 (유학생, 이민자, 워홀러 등)

## 핵심 기능 (예정)
- 게시판: 자유글, 질문, 정보공유, 구인구직 등
- 학교/지역별 커뮤니티
- 익명 게시판
- 댓글/대댓글
- 쪽지/DM

## 기술 스택
- Expo (React Native), JavaScript
- 네비게이션: React Navigation
- DB: Postgres (로컬 연결됨)

## 프로젝트 구조
src/
  components/   # 재사용 UI 컴포넌트
  screens/      # 화면별 컴포넌트
  navigation/   # 네비게이션 설정
  hooks/        # 커스텀 훅
  lib/          # API, 유틸리티
  constants/    # 색상 등 상수 (colors.js 완료)

## 개발 규칙
- 함수형 컴포넌트 + 훅 사용
- StyleSheet.create() 사용
- 색상은 src/constants/colors.js에서 import
- 한국어 주석 권장
- 컴포넌트 파일명: PascalCase

## 주요 명령어
npx expo start          # 개발 서버 시작
npx expo start --ios    # iOS 시뮬레이터
npx expo start --android # 안드로이드 에뮬레이터

## 현재 상태
- App.js: 기본 템플릿 상태
- 앱 기능 개발 시작 전
EOF
## 작업 방식
작업을 시작할 때 항상 다음 4명의 관점에서 생각하고 진행해:

1. **PM (기획자)** - 기능 요구사항, 사용자 경험 검토
2. **Frontend 개발자** - UI/UX 구현, 컴포넌트 설계  
3. **Backend 개발자** - API 설계, DB 구조
4. **QA (테스터)** - 버그, 엣지케이스, 예외처리 검토

작업 전 4명이 회의하듯 검토하고, 최선의 방향으로 진행해.
나는 의사결정만 하면 되고 나머지는 알아서 처리해줘.
