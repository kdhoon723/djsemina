# DJSemina 초기 백엔드 실험

이 폴더에는 DJSemina의 초기 Node.js·Deno 크롤러와 로컬 API 실험 코드가 있습니다. 현재 Vue 프론트엔드는 이 서버가 아니라 `supabase/functions/`의 Edge Function을 사용합니다.

현재 구조와 프론트엔드 실행 방법은 [프로젝트 루트 README](../README.md)를 먼저 참고하세요.

## 포함된 구현

- Puppeteer로 도서관 페이지에 로그인하고 예약 가능 시간을 수집하는 구현
- `got`과 `tough-cookie`로 같은 흐름을 HTTP 요청으로 처리하는 구현
- 메모리 캐시와 `/api/availability`, `/api/crawl`을 제공하는 Express 서버
- Node.js와 Deno 수집 방식을 비교하기 위한 디버그·테스트 스크립트

## 로컬 참고 실행

`backend/.env.example`을 `.env`로 복사하고 본인이 정당하게 사용할 수 있는 도서관 계정 값을 입력합니다. 자격증명을 저장소에 커밋하지 마세요.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

일반 실행 명령은 다음과 같습니다.

```bash
npm start
```

서버는 기본적으로 `http://localhost:8080`에서 시작합니다. 시작 과정에서 크롤러를 초기화하고 첫 수집을 수행하므로, 도서관 페이지의 로그인·화면 구조가 달라지면 실행되지 않을 수 있습니다.

이 구현은 실험 기록과 참고용입니다. 현재 Supabase 백엔드의 구성이나 배포 절차를 설명하지 않습니다.
