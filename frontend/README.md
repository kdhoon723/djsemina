# DJSemina 프론트엔드

DJSemina의 예약 현황·히스토리·인사이트 화면을 제공하는 Vue 3 앱입니다. 프로젝트의 데이터 흐름과 현재 범위는 [루트 README](../README.md)를 참고하세요.

## 화면 구성

- `/`: 날짜별 예약 가능 시간, 공간 구분 필터, 스냅샷 히스토리
- `/insights`: 요일·시간대·공간별 이용 패턴, 기간별 추세, 과거 데이터 기반 빈방 확률

프론트엔드는 Supabase Edge Function과 RPC에 연결됩니다. 이 폴더만 실행해서는 예약 데이터가 만들어지지 않습니다.

## 환경변수

```bash
cp .env.example .env.local
```

```env
VITE_API_BASE_URL=https://YOUR-PROJECT-REF.supabase.co/functions/v1
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

`VITE_API_BASE_URL`은 예약 현황과 히스토리 Edge Function 호출에 사용됩니다. 인사이트 화면은 같은 URL에서 Supabase 프로젝트 주소를 구해 집계 RPC를 호출합니다.

## 실행과 빌드

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

학번·비밀번호와 Supabase service role key는 프론트엔드에 넣지 않습니다. 서버 자격증명은 Edge Function secret으로 관리합니다.
