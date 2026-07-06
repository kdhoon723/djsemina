# DJSemina

대진대학교 도서관 세미나실 예약 현황을 조회하고, 시간대별 이용 가능 여부와 간단한 인사이트를 확인하는 웹앱입니다.

## 주요 기능

- 세미나실 예약 가능 시간 조회
- 날짜별 예약 스냅샷 저장 및 조회
- 이용 패턴 인사이트 화면
- Vue 3 + Vite 프론트엔드
- Supabase Edge Functions 기반 크롤러/API

## 저장소 구조

```text
frontend/   Vue 3 + Vuetify + Vite 웹앱
backend/    초기 Node/Deno 크롤러 실험 코드와 참고 구현
supabase/   Edge Function 및 SQL 스키마
```

## 환경 변수

프론트엔드는 `frontend/.env.example`을 복사해 사용합니다.

```bash
cp frontend/.env.example frontend/.env.local
```

백엔드/크롤러 계정 정보는 로컬 환경 변수나 배포 플랫폼의 secret 기능으로만 주입하세요. 실제 학번, 비밀번호, API 토큰은 저장소에 커밋하지 않습니다.

## 개발

```bash
cd frontend
npm install
npm run dev
```

## 빌드

```bash
cd frontend
npm run build
```

## 공개 저장소 안내

이 저장소에는 실제 운영 계정, 배포 토큰, 학번/비밀번호, Firebase/Supabase 로컬 링크 상태 파일을 포함하지 않습니다. 필요한 값은 `.env.example`을 참고해 각자 환경에서 설정해야 합니다.

## 라이선스

MIT License
