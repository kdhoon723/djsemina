# 배포 방식 최종 비교 및 권장사항

## 요약

| 항목 | Puppeteer | got (Node.js) | Cloudflare Workers | **Supabase Edge Functions** |
|------|-----------|---------------|--------------------|-----------------------------|
| **환경** | Node.js 서버 | Node.js 서버 | Edge (V8 Isolate) | **Edge (Deno)** |
| **사용 가능 여부** | ✅ 작동 중 | ✅ 검증됨 | ❌ 불가능 | **✅ 가능 (예상)** |
| **성능 (전체)** | ~5-10초 | ~2-3초 | - | **~2-4초 (예상)** |
| **리소스 사용** | 높음 (브라우저) | 낮음 | 매우 낮음 | **매우 낮음** |
| **서버 필요** | ✅ 필요 | ✅ 필요 | ❌ 불필요 | **❌ 불필요** |
| **글로벌 배포** | ❌ | ❌ | ✅ | **✅** |
| **비용** | 서버 유지비 | 서버 유지비 | 무료~저렴 | **무료~저렴** |
| **타임아웃** | 무제한 | 무제한 | 10초 | **30초** |
| **Cold Start** | 해당없음 | 해당없음 | ~50ms | **~100ms** |

---

## 1. 현재 상황

### ✅ 작동 확인된 방식
1. **Puppeteer (crawler.js)** - 브라우저 자동화
   - 장점: 완전 동작 검증됨
   - 단점: 무겁고 느림 (~5-10초)

2. **got + tough-cookie (api-crawler.js)** - HTTP API 방식
   - 장점: 빠름 (~2-3초), 가벼움
   - 단점: Node.js 서버 필요

### ❌ 작동 불가
3. **Cloudflare Workers**
   - 이유: `got` 라이브러리가 global scope에서 async I/O 수행
   - 에러: "Disallowed operation called within global scope"
   - Node.js 의존성이 너무 깊음

### 🔍 검증 필요
4. **Supabase Edge Functions (Deno)**
   - Deno 네이티브 라이브러리 사용 (`another_cookiejar`)
   - 로컬 테스트 필요

---

## 2. Supabase Edge Functions 장점

### ✅ 기술적 장점
1. **Edge Runtime 최적화**
   - Deno 네이티브 라이브러리 사용
   - Web API 표준 (fetch)
   - 가벼운 런타임

2. **더 긴 실행 시간**
   - Cloudflare Workers: 10초
   - Supabase: **30초** (크롤링에 충분)

3. **Node.js 호환성**
   - Cloudflare보다 나은 Node.js API 지원
   - npm 패키지 import 가능 (제한적)

### ✅ 운영적 장점
1. **서버리스**
   - 서버 관리 불필요
   - 자동 스케일링
   - 글로벌 분산 배포

2. **비용 효율**
   - 무료 티어: 500K 요청/월
   - Pay-as-you-go
   - 서버 유지비 없음

3. **개발 경험**
   - TypeScript 네이티브
   - 로컬 개발 환경
   - GitHub Actions 통합

---

## 3. 예상 문제점 및 해결책

### 문제 1: another_cookiejar 안정성
- **우려**: "가볍게 테스트됨, 스펙을 엄격히 따르지 않음" 명시
- **해결**: 로컬 테스트로 SSO 로그인 완전 검증 필요

### 문제 2: HTML 파싱 성능
- **우려**: `deno-dom`이 `cheerio`보다 느릴 수 있음
- **해결**: 벤치마크 테스트, 필요시 정규표현식 파싱

### 문제 3: Cold Start
- **우려**: 첫 요청 시 100ms 추가 레이턴시
- **해결**: 주기적 호출로 Warm 상태 유지 (cron)

### 문제 4: 디버깅
- **우려**: Edge 환경에서 디버깅 어려움
- **해결**: 로컬 Supabase로 충분한 테스트 후 배포

---

## 4. 단계별 전환 계획

### Phase 1: 검증 (1-2일)
1. ✅ Deno 설치
2. ✅ `api-crawler-deno.ts` 로컬 실행
3. ✅ SSO 로그인 완전 작동 확인
4. ✅ 전체 크롤링 정확도 검증
5. ✅ 성능 측정

### Phase 2: Supabase 테스트 (1일)
1. ✅ Supabase CLI 설치
2. ✅ Edge Function 생성 및 로컬 테스트
3. ✅ Supabase 배포
4. ✅ 실제 환경 테스트

### Phase 3: 통합 (1일)
1. ✅ 기존 백엔드에 Supabase 함수 호출 추가
2. ✅ Puppeteer와 병행 운영
3. ✅ 1주일 안정성 모니터링

### Phase 4: 전환 결정
- ✅ 정확도: 100% 일치
- ✅ 안정성: 99% 성공률
- ✅ 성능: 평균 3초 이하
→ **Puppeteer 대체 결정**

---

## 5. 최종 권장사항

### 🎯 **추천: Supabase Edge Functions**

**이유:**
1. ✅ **기술적 타당성 높음**
   - Deno 네이티브 라이브러리 사용
   - 30초 타임아웃 (충분)
   - Web API 표준

2. ✅ **비용 효율적**
   - 서버 유지비 제거
   - 무료 티어로 충분

3. ✅ **확장성**
   - 글로벌 분산
   - 자동 스케일링
   - 트래픽 증가 대응

4. ✅ **유지보수**
   - TypeScript
   - 로컬 테스트 환경
   - CI/CD 통합 쉬움

### 📋 **실행 계획**

**즉시 진행:**
```bash
# 1. Deno 설치
choco install deno

# 2. 로컬 테스트
deno run --allow-net --allow-env api-crawler-deno.ts

# 3. 결과 확인 후 Supabase 진행
```

**성공 시:**
- Puppeteer 완전 대체
- 서버 리소스 절감
- 성능 2-3배 개선

**실패 시:**
- 기존 Node.js + got 유지
- Puppeteer 백업 유지
- 추가 비용 없음

---

## 6. 대안 시나리오

### Supabase 실패 시
1. **Option A: Node.js 서버 유지 + got**
   - 현재 방식 유지
   - 안정성 보장
   - 서버 비용 발생

2. **Option B: Vercel Edge Functions 시도**
   - Supabase와 유사한 환경
   - Cloudflare Workers보다 관대한 제약

3. **Option C: Hybrid**
   - Edge에서 캐시 제공
   - Node.js에서 실제 크롤링
   - 복잡도 증가

---

## 7. 성공 지표

### 필수 조건 (모두 만족 시 전환)
- [ ] SSO 로그인 100% 성공
- [ ] 세미나실 목록 정확도 100%
- [ ] 시간 조회 정확도 100%
- [ ] 평균 응답 시간 < 5초
- [ ] 에러율 < 1%

### 선택 조건 (추가 보너스)
- [ ] 응답 시간 < 3초
- [ ] Cold start < 200ms
- [ ] 월 비용 < $5
- [ ] 배포 자동화 완료

---

## 8. 리스크 관리

### 낮은 리스크
- ✅ Puppeteer 백업 유지
- ✅ 로컬 테스트 먼저 진행
- ✅ 단계적 전환
- ✅ 롤백 계획 준비

### 예상 문제
1. **another_cookiejar 버그**
   - 해결: 수동 쿠키 관리로 폴백
   - 영향: 코드 복잡도 증가

2. **Deno 생태계 불안정**
   - 해결: Node.js로 롤백
   - 영향: 서버 유지 필요

3. **Supabase 제약 발견**
   - 해결: 대안 플랫폼 시도
   - 영향: 개발 시간 추가

---

## 결론

**Supabase Edge Functions는 기술적으로 가능성이 매우 높으며, 성공 시 큰 이득이 예상됩니다.**

**다음 단계:**
1. 즉시 Deno 로컬 테스트 진행
2. 성공 시 Supabase 배포 테스트
3. 검증 완료 후 프로덕션 전환

**예상 타임라인:**
- 로컬 테스트: 1-2시간
- Supabase 배포: 1-2시간
- 검증: 1주일
- **총 소요**: 1-2주

**투자 대비 효과:**
- 개발 시간: 1-2일
- 예상 절감: 서버 비용 월 $10-50
- 성능 개선: 2-3배
- ROI: 매우 높음
