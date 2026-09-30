# DJSemina

대진대학교 도서관의 캐럴실·세미나실·소강당 예약 가능 시간을 조회하고, 저장된 스냅샷으로 이용 패턴을 살펴보는 웹앱입니다. 날짜별 빈 시간을 표로 확인하는 조회 화면과 누적 데이터를 분석하는 인사이트 화면을 함께 제공합니다.

## 무엇을 보여주나

- 날짜를 선택해 공간별 예약 가능 시간을 30분 단위로 확인합니다.
- 캐럴실, 세미나실, 소강당으로 결과를 나눠 봅니다.
- 같은 날짜에 저장된 스냅샷을 시간순으로 이동하거나 재생해 가능 시간이 달라지는 과정을 확인합니다.
- 요일·시간대·공간별 이용률, 기간별 추세, 과거 데이터 기반 빈방 확률과 예약 행동 추정치를 봅니다.

조회 화면은 브라우저의 최근 데이터를 먼저 표시한 뒤 서버 캐시와 새 수집 결과를 차례로 반영합니다. 조회 버튼을 5초 동안 누르면 캐시를 사용하지 않고 새 수집을 요청합니다.

## 데이터 흐름

```text
대진대 도서관 예약 페이지
        │ Supabase Edge Function에서 로그인·조회
        ▼
공간별 예약 가능 시간
        │ seminar_room_snapshots에 시점별 저장
        ├──────────────▶ 예약 현황·히스토리 화면
        │ SQL 집계 함수
        └──────────────▶ 이용률·추세·예약 행동 추정치
```

- **서버 측 수집**: `library-crawler` Edge Function이 도서관 계정으로 로그인하고 공간별 예약 가능 시간을 병렬로 조회합니다. 계정 정보는 프론트엔드가 아니라 Edge Function secret에서 읽습니다.
- **캐시 우선 표시**: 프론트엔드는 24시간 동안 보관한 브라우저 데이터를 먼저 사용하고, Supabase에 저장된 최신 스냅샷과 새 수집 결과로 화면을 갱신합니다.
- **시점별 비교**: `library-history`가 같은 날짜의 스냅샷과 공간 데이터를 시간순으로 반환합니다. 프론트엔드는 이를 슬라이더와 재생 UI로 보여줍니다.
- **가공된 분석 데이터**: `supabase/sql/insights.sql`은 스냅샷을 날짜·공간·시간 슬롯 단위로 집계하고, 프론트엔드는 작은 JSON 응답을 받아 차트와 추천 값을 계산합니다.

## 주요 구성

| 경로 | 역할 | 구현 |
| --- | --- | --- |
| `frontend/` | 예약 현황, 히스토리, 인사이트 화면 | Vue 3, Vuetify, Vite |
| `supabase/functions/` | 도서관 조회와 스냅샷 API | Supabase Edge Functions, Deno |
| `supabase/sql/insights.sql` | 이용률과 예약 행동 추정치 집계 | PostgreSQL 함수·캐시 테이블 |
| `backend/` | 초기 로컬 크롤러/API 실험 | Node.js, Express, Puppeteer 및 HTTP 파서 |

`backend/`는 현재 프론트엔드가 사용하는 Supabase 구성 이전의 실험·참고 구현입니다. 현재 프론트엔드는 `VITE_API_BASE_URL` 아래의 Edge Function을 호출합니다.

## 현재 범위

이 저장소에는 프론트엔드, Edge Function, 인사이트용 SQL이 있지만 **새 Supabase 프로젝트를 처음부터 구성하는 전체 마이그레이션은 포함하지 않습니다.** Edge Function과 SQL은 `seminar_room_snapshots` 테이블 및 배포된 집계 함수를 전제로 합니다. `supabase/sql/insights.sql`도 이 스냅샷 테이블을 읽지만 테이블 자체를 만들지는 않습니다.

따라서 아래 로컬 실행은 이미 준비된 Supabase 프로젝트에 프론트엔드를 연결하는 절차입니다. 신규 백엔드를 재현하려면 스냅샷 테이블의 열과 접근 정책, Edge Function 배포, 집계 SQL 적용을 별도로 구성해야 합니다.

또한 예약 가능 시간은 도서관 페이지를 조회한 시점의 스냅샷입니다. 실제 예약 가능 여부는 이후 변경될 수 있습니다.

## 프론트엔드 실행

환경변수 예시를 복사하고 연결할 Supabase 프로젝트의 값을 입력합니다.

```bash
cp frontend/.env.example frontend/.env.local
```

```env
VITE_API_BASE_URL=https://YOUR-PROJECT-REF.supabase.co/functions/v1
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

앱을 실행하거나 빌드합니다.

```bash
cd frontend
npm install
npm run dev

# 정적 빌드
npm run build
```

프론트엔드의 자세한 항목은 [`frontend/README.md`](./frontend/README.md)를 참고하세요.

## 백엔드 설정에 필요한 값

`library-crawler` Edge Function은 다음 서버 환경변수를 사용합니다.

- `LIBRARY_USER_ID`
- `LIBRARY_USER_PW`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

학번·비밀번호와 service role key는 프론트엔드 환경변수나 저장소에 넣지 말고 배포 플랫폼의 secret으로 관리해야 합니다. 이 저장소는 실제 운영 계정, 배포 토큰, 학번·비밀번호, 로컬 링크 상태 파일을 포함하지 않습니다.

초기 Node.js 구현을 살펴볼 때는 [`backend/README.md`](./backend/README.md)를 참고하세요. 이 경로는 현재 Supabase 백엔드의 설치 안내가 아닙니다.

## 저장소 구조

```text
djsemina/
├── frontend/           # Vue 웹앱
├── supabase/
│   ├── functions/      # crawler, history, snapshot Edge Function
│   └── sql/            # 인사이트 집계 SQL
├── backend/            # 초기 로컬 크롤러/API 실험
├── LICENSE
└── README.md
```

## 라이선스

MIT License. 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
