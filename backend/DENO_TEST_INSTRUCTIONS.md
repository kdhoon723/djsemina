# Deno/Supabase Edge Functions 테스트 가이드

## 1. Deno 설치

### Windows (PowerShell)
```powershell
irm https://deno.land/install.ps1 | iex
```

### 또는 Chocolatey
```powershell
choco install deno
```

### 설치 확인
```bash
deno --version
```

---

## 2. 로컬 Deno 테스트

### 기본 실행 (오늘 날짜)
```bash
deno run --allow-net --allow-env api-crawler-deno.ts
```

### 특정 날짜 지정
```bash
deno run --allow-net --allow-env api-crawler-deno.ts 2025-10-31
```

### 권한 설명
- `--allow-net`: HTTP 요청 허용
- `--allow-env`: 환경 변수 접근 허용

---

## 3. Supabase Edge Functions 배포

### 3.1 Supabase CLI 설치

**Windows (Chocolatey):**
```bash
choco install supabase
```

**또는 npm:**
```bash
npm install -g supabase
```

### 3.2 Supabase 프로젝트 초기화

```bash
# 프로젝트 루트에서
supabase init

# 로그인
supabase login
```

### 3.3 Edge Function 생성

```bash
# 함수 생성
supabase functions new library-crawler

# api-crawler-deno.ts 내용을 복사
cp api-crawler-deno.ts supabase/functions/library-crawler/index.ts
```

### 3.4 로컬 테스트

```bash
# 로컬 Supabase 시작
supabase start

# 함수 로컬 실행
supabase functions serve library-crawler

# 다른 터미널에서 테스트
curl -i --location --request POST 'http://localhost:54321/functions/v1/library-crawler' \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "20241476",
    "userPw": "kdhkdh0723",
    "date": "2025-10-29"
  }'
```

### 3.5 Supabase에 배포

```bash
# 배포
supabase functions deploy library-crawler

# 환경 변수 설정 (선택)
supabase secrets set USER_ID=20241476
supabase secrets set USER_PW=kdhkdh0723
```

### 3.6 배포된 함수 호출

```bash
# Supabase URL과 anon key 필요
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/library-crawler' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "20241476",
    "userPw": "kdhkdh0723",
    "date": "2025-10-29"
  }'
```

---

## 4. 예상 응답

### 성공
```json
{
  "success": true,
  "date": "2025-10-29",
  "rooms": [
    {
      "sloc_code": "SWON",
      "cate_cd": "SEMINAR",
      "room_cd": "SWON_SEMINAR_01",
      "title": "1층 세미나실1 (12인실)",
      "times": [
        { "start": "09:00", "end": "09:30" },
        { "start": "09:30", "end": "10:00" },
        ...
      ]
    },
    ...
  ],
  "count": 20
}
```

### 실패 (로그인)
```json
{
  "success": false,
  "error": "로그인 실패"
}
```

---

## 5. 성능 예상

### Node.js (got) vs Deno (fetch)
- **로그인**: ~1초 (동일)
- **방 목록**: ~0.2초 (동일)
- **시간 조회 (20개 병렬)**: ~0.3-0.5초 (약간 더 느릴 수 있음)
- **전체 크롤링**: ~2-3초

### Edge Functions 추가 레이턴시
- **Cold start**: +100ms (첫 요청)
- **Warm**: 추가 레이턴시 거의 없음

---

## 6. 문제 해결

### 문제 1: Deno 권한 오류
```bash
# 모든 권한 허용 (테스트용)
deno run --allow-all api-crawler-deno.ts
```

### 문제 2: 의존성 오류
```bash
# deno.json 생성 (프로젝트 루트)
{
  "imports": {
    "@deno/another-cookiejar": "jsr:@deno/another-cookiejar@5",
    "@b-fuze/deno-dom": "jsr:@b-fuze/deno-dom"
  }
}
```

### 문제 3: Supabase 함수 로그 확인
```bash
# 로컬
supabase functions logs library-crawler

# 배포 후
supabase functions logs library-crawler --remote
```

---

## 7. 다음 단계

1. ✅ Deno 로컬 테스트
2. ✅ Supabase 로컬 함수 테스트
3. ✅ Supabase 배포
4. ⬜ 성능 벤치마크 (Node.js vs Deno)
5. ⬜ 프로덕션 전환 결정

---

## 8. 참고 자료

- [Deno 공식 문서](https://deno.land/manual)
- [Supabase Edge Functions 가이드](https://supabase.com/docs/guides/functions)
- [another_cookiejar 문서](https://jsr.io/@deno/another-cookiejar)
- [deno-dom 문서](https://deno.land/x/deno_dom)
