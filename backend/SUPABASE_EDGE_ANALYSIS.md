# Supabase Edge Functions 호환성 분석

## 결론: ✅ Supabase Edge Functions 사용 가능!

**핵심**: `got` + `tough-cookie` (Node.js) 대신 **Deno 네이티브 라이브러리** 사용

---

## 1. Supabase Edge Functions 환경

### 런타임
- **Deno 기반** (Node.js 아님)
- TypeScript 우선 지원
- V8 isolate 기반 실행
- **타임아웃**: 30초 (Cloudflare Workers보다 관대)
- **Cold start**: 100ms 이하

### npm 패키지 지원
- ✅ npm 패키지 import 가능 (`npm:` 접두사 사용)
- ⚠️ 하지만 문서 경고: "대부분의 Node.js 패키지는 edge에서 작동하지 않음"
- 권장: Web API 표준 사용

---

## 2. got + tough-cookie 사용 불가 이유

### Cloudflare Workers와 동일한 문제점
```
❌ got 라이브러리
- Node.js http, https, net, stream 모듈에 깊게 의존
- import 시점에 async I/O 수행 (global scope 제약 위반)
- Edge runtime에 최적화되지 않음

❌ tough-cookie
- Node.js 생태계 전용
- Deno에서 네이티브 지원 없음
```

### 실패한 접근법
- Cloudflare Workers: "Disallowed operation called within global scope" 에러
- Supabase도 동일한 제약사항 예상

---

## 3. ✅ Deno 네이티브 솔루션

### another_cookiejar
- **패키지**: `https://deno.land/x/another_cookiejar` 또는 JSR
- **목적**: Deno fetch API에 자동 쿠키 관리 추가
- **특징**:
  - `wrapFetch` 함수로 fetch를 래핑
  - 이전 요청의 쿠키를 자동으로 저장/전송
  - 도메인별 쿠키 분리
  - Secure 쿠키는 HTTPS에서만 전송
  - **edge runtime에 최적화됨**

### 사용 예시
```typescript
import { CookieJar, wrapFetch } from "jsr:@deno/another-cookiejar"

// CookieJar 생성
const cookieJar = new CookieJar()

// fetch 래핑 (자동 쿠키 관리)
const fetch = wrapFetch({ cookieJar })

// 일반 fetch처럼 사용 - 쿠키 자동 관리!
await fetch('https://library.daejin.ac.kr/home_login_write.mir')
await fetch('https://library.daejin.ac.kr/home_security_login_write_prss.mir', {
  method: 'POST',
  body: formData
})
// 쿠키가 자동으로 저장되고 다음 요청에 포함됨
```

---

## 4. 구현 계획

### 기존 코드 변환
```javascript
// ❌ Node.js (got + tough-cookie)
import got from 'got'
import { CookieJar } from 'tough-cookie'

const cookieJar = new CookieJar()
const client = got.extend({ cookieJar })
const response = await client.get(url)

// ✅ Deno (fetch + another_cookiejar)
import { CookieJar, wrapFetch } from "jsr:@deno/another-cookiejar"

const cookieJar = new CookieJar()
const fetch = wrapFetch({ cookieJar })
const response = await fetch(url)
const html = await response.text()
```

### 주요 변경 사항
1. **HTTP 클라이언트**: `got` → `fetch` (Web API 표준)
2. **쿠키 관리**: `tough-cookie` → `another_cookiejar`
3. **응답 처리**: `response.body` → `await response.text()`
4. **에러 처리**: got의 HTTPError → fetch의 Response.ok 확인

---

## 5. 장점

### Cloudflare Workers 대비
✅ **더 긴 실행 시간**: 30초 vs 10초
✅ **더 나은 Node.js 호환성**: 부분적으로 Node.js API 지원
✅ **Deno 생태계**: 풍부한 Deno 전용 라이브러리

### got 방식 대비
✅ **Edge 최적화**: Deno runtime에 네이티브
✅ **가벼움**: Node.js 의존성 없음
✅ **표준 준수**: Web API fetch 사용
✅ **Cold start**: 더 빠른 시작 시간

---

## 6. 예상 문제점 및 해결

### 문제 1: FormData 처리
```typescript
// got에서는 URLSearchParams를 .toString()으로 전송
const form = new URLSearchParams()
form.append('key', 'value')

// Deno fetch에서도 동일
await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form.toString()
})
```

### 문제 2: Redirect 처리
```typescript
// Deno fetch는 자동으로 redirect 따라감 (기본값)
const response = await fetch(url, {
  redirect: 'follow'  // 기본값
})
```

### 문제 3: Timeout 설정
```typescript
// AbortController 사용
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000)

const response = await fetch(url, {
  signal: controller.signal
})
clearTimeout(timeoutId)
```

---

## 7. 테스트 계획

### 로컬 테스트
1. Deno 설치
2. `another_cookiejar` 테스트 스크립트 작성
3. 로그인 → 세미나실 목록 → 시간 조회 전체 플로우 검증

### Supabase 배포 테스트
1. Supabase CLI 설치
2. Edge Function 프로젝트 생성
3. 로컬에서 `supabase functions serve` 실행
4. 실제 Supabase에 배포 및 테스트

---

## 8. 최종 권장 사항

### ✅ Supabase Edge Functions 사용 가능!

**이유**:
1. Deno 네이티브 라이브러리 사용 가능 (`another_cookiejar`)
2. Web API 표준 fetch 사용 (edge에 최적화)
3. 30초 타임아웃 (크롤링에 충분)
4. SSO 로그인 로직 그대로 이식 가능

**다음 단계**:
1. `api-crawler-deno.js` 작성 (fetch + another_cookiejar 사용)
2. 로컬 Deno 환경에서 테스트
3. Supabase Edge Function으로 배포
4. 성능 및 안정성 검증

---

## 9. 대안 비교

| 방식 | 환경 | 장점 | 단점 |
|------|------|------|------|
| **Puppeteer** | Node.js 서버 | 완전 동작 검증됨 | 무겁고 느림, 서버 필요 |
| **got + tough-cookie** | Node.js 서버 | 빠르고 가벼움 | 서버 필요 |
| **Cloudflare Workers** | Edge | 글로벌 배포, 저렴 | ❌ got 사용 불가 |
| **Supabase Edge Functions** | Edge (Deno) | ✅ 사용 가능, 30초 타임아웃 | Deno 라이브러리로 이식 필요 |

---

## 10. 구현 우선순위

1. **즉시**: Deno 환경에서 `another_cookiejar` 테스트
2. **1단계**: `api-crawler-deno.js` 작성 및 로컬 검증
3. **2단계**: Supabase Edge Function으로 배포
4. **3단계**: 기존 Node.js 백엔드와 성능 비교
5. **최종**: Puppeteer 완전 대체 결정
