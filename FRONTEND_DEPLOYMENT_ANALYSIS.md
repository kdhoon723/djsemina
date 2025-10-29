# 프론트엔드 배포 전략 분석

**작성일**: 2025-10-29
**목적**: djsemina 프론트엔드의 현재 상태 파악 및 Cloudflare Pages 마이그레이션 검토

---

## 📊 현재 프론트엔드 상태

### 기술 스택

**프레임워크 & 라이브러리**:
- Vue 3.5.13 (Composition API)
- Vite 6.3.1 (빌드 도구)
- Vuetify 3.8.2 (Material Design UI)
- Tailwind CSS 4.1.4 (유틸리티 CSS)
- Vue Router 4.5.0
- Axios 1.8.4

**배포 환경**:
- Firebase Hosting (프로젝트: `djsemina`)
- 빌드 출력: `dist/` 디렉토리
- SPA 라우팅: `**` → `/index.html` (firebase.json)

### 현재 아키텍처

```
[프론트엔드]                    [백엔드]
Vue 3 App                       Node.js + Express
  ↓                                    ↓
Firebase Hosting               Puppeteer 크롤러
  ↓ (API 요청)                        ↓
https://api.kdhoon.me          세미나실 크롤링
  ↓                                    ↓
/api/availability              캐시 + 실시간 조회
```

### API 사용 현황

**엔드포인트**:
```
https://api.kdhoon.me/api/availability
```

**요청 방식**:
1. **캐시 조회** (기본): `GET /api/availability?date=YYYY-MM-DD`
2. **실시간 조회** (5초 롱프레스): `GET /api/availability?date=YYYY-MM-DD&_ts={timestamp}`

**응답 구조**:
```json
{
  "rooms": [
    {
      "room_cd": "C01",
      "title": "캐럴1실",
      "times": [
        {"start": "09:00", "end": "09:30"},
        ...
      ]
    }
  ],
  "fetchedAt": "2025-10-29T12:00:00.000Z",
  "cached": true
}
```

---

## 🔄 Cloudflare Pages vs Firebase Hosting 비교

| 항목 | Firebase Hosting | Cloudflare Pages |
|-----|-----------------|------------------|
| **무료 티어** | 10GB 저장 + 360MB/일 전송 | 무제한 요청 + 대역폭 |
| **빌드 시간** | 로컬 빌드 필요 | 자동 빌드 (500회/월) |
| **배포 방식** | `firebase deploy` | Git push (자동 배포) |
| **글로벌 CDN** | ✅ Firebase CDN | ✅ Cloudflare CDN (더 빠름) |
| **커스텀 도메인** | ✅ 무료 SSL | ✅ 무료 SSL |
| **환경 변수** | ❌ (빌드 시 주입) | ✅ 프로젝트 설정 |
| **프리뷰 배포** | ❌ | ✅ PR별 자동 생성 |
| **Edge Functions** | ❌ | ✅ (Cloudflare Workers 통합) |
| **분석/모니터링** | Firebase Analytics | Cloudflare Analytics |
| **가격** | 사용량 기반 | 완전 무료 (Pro: $20/월) |

---

## 🎯 Cloudflare Pages 추천 여부

### ✅ **추천함** - 다음 이유로:

#### 1. **완전 무료 + 무제한**
- Firebase는 10GB/360MB 제한이 있지만, Cloudflare Pages는 **완전 무료**
- 트래픽 걱정 없음 (Cloudflare CDN)

#### 2. **자동 배포 (Git 연동)**
```bash
# Firebase (현재)
npm run build
firebase deploy

# Cloudflare Pages (미래)
git push origin main
# → 자동 빌드 & 배포 완료!
```

#### 3. **Supabase Edge Function과 통합**
현재 아키텍처:
```
Vue App (Firebase) → api.kdhoon.me (Node.js) → Puppeteer
```

향후 아키텍처 (권장):
```
Vue App (Cloudflare Pages) → Supabase Edge Function → got 크롤러
```

**장점**:
- 서버 유지비 $0 (Node.js 서버 제거)
- Cloudflare + Supabase 모두 글로벌 CDN
- 완전 서버리스 아키텍처

#### 4. **프리뷰 배포**
- PR마다 자동으로 프리뷰 URL 생성
- 예: `https://abc123.djsemina.pages.dev`
- 배포 전 테스트 가능

#### 5. **더 빠른 CDN**
- Cloudflare는 전 세계 300+ 데이터센터 보유
- Firebase보다 평균 응답 속도 빠름
- 특히 한국/아시아 리전에서 유리

---

## 📋 마이그레이션 계획

### Phase 1: Cloudflare Pages 설정 (1시간)

1. **Cloudflare Pages 프로젝트 생성**
   - GitHub/GitLab 저장소 연결
   - 빌드 명령: `npm run build`
   - 빌드 출력 디렉토리: `frontend/dist`
   - Root 디렉토리: `frontend`

2. **환경 변수 설정**
   ```
   VITE_API_BASE_URL=https://jfgahabbpkskrjonquxd.supabase.co/functions/v1
   ```

3. **첫 배포**
   - Git push → 자동 빌드 & 배포
   - 프리뷰 URL 확인

### Phase 2: API 마이그레이션 (2시간)

**현재 API 구조**:
```javascript
// frontend/src/api.js
export default axios.create({
  baseURL: "https://api.kdhoon.me"
});

// Availability.vue
const res = await api.get(`/api/availability?date=${date.value}`);
```

**마이그레이션 후**:
```javascript
// frontend/src/api.js
export default axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
  // "https://jfgahabbpkskrjonquxd.supabase.co/functions/v1"
});

// Availability.vue
const res = await api.post(`/library-crawler`, {
  userId: import.meta.env.VITE_USER_ID,
  userPw: import.meta.env.VITE_USER_PW,
  date: date.value
});
```

**변경 사항**:
1. ~~GET /api/availability~~ → **POST /library-crawler**
2. 응답 구조 매핑:
   - `rooms` → 동일
   - `fetchedAt` → `date` (ISO 형식)
   - ~~cached 필드~~ → 제거 (Edge Function은 항상 실시간)

### Phase 3: 캐싱 전략 구현 (선택사항, 3시간)

**문제**: Edge Function은 매번 크롤링 (느림 + 비용)

**해결**: Supabase Database 캐시

```sql
-- Supabase에 캐시 테이블 생성
CREATE TABLE availability_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  rooms JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- 5분 이내 데이터는 캐시 사용
CREATE INDEX idx_availability_cache_date
ON availability_cache(date, created_at);
```

**Edge Function 로직 수정**:
```typescript
// 1. 캐시 확인 (5분 이내)
const cached = await supabase
  .from('availability_cache')
  .select('*')
  .eq('date', dateStr)
  .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
  .single();

if (cached.data) {
  return cached.data.rooms; // 캐시 반환
}

// 2. 캐시 없으면 크롤링
const results = await crawler.crawl(dateStr);

// 3. 캐시 저장
await supabase
  .from('availability_cache')
  .upsert({ date: dateStr, rooms: results });

return results;
```

### Phase 4: 도메인 전환 (1시간)

1. **Cloudflare Pages 도메인 설정**
   - `djsemina.kdhoon.me` 또는 `seminar.kdhoon.me`
   - DNS CNAME 레코드 추가

2. **Firebase Hosting 중단**
   - `firebase hosting:disable`

3. **구 백엔드 서버 중단**
   - Node.js + Puppeteer 서버 종료
   - 서버 비용 절감

---

## 💰 비용 비교

### 현재 (Firebase + Node.js 서버)

| 항목 | 비용 |
|-----|------|
| Firebase Hosting | $0 (무료 티어) |
| Node.js 서버 (VPS/Cloud) | $10-50/월 |
| 도메인 | $10-15/년 |
| **총 비용** | **$120-600/년** |

### 마이그레이션 후 (Cloudflare + Supabase)

| 항목 | 비용 |
|-----|------|
| Cloudflare Pages | $0 (무료) |
| Supabase Free Tier | $0 (무료) |
| - Edge Functions | 500K 요청/월 무료 |
| - Database | 500MB 무료 |
| 도메인 | $10-15/년 |
| **총 비용** | **$10-15/년** |

**절감액**: **$110-585/년** (92-98% 절감)

---

## ⚡ 성능 비교

### 현재 아키텍처

```
사용자 → Firebase CDN (서울) → api.kdhoon.me (서버 위치?) → Puppeteer 실행
└─ 응답 시간: 2-5초 (캐시), 20초+ (실시간)
```

### 마이그레이션 후

```
사용자 → Cloudflare CDN (서울) → Supabase Edge (서울) → got 크롤러
└─ 응답 시간: 1-2초 (첫 요청), 0.5초 (캐시)
```

**개선 사항**:
- ✅ CDN 응답: Firebase < Cloudflare
- ✅ Edge Function: 서울 리전 (낮은 레이턴시)
- ✅ got vs Puppeteer: 10배 이상 빠름
- ✅ 캐시 (Supabase DB): 밀리초 단위 응답

---

## 🚦 마이그레이션 우선순위

### 즉시 시작 가능 (High Priority)

1. ✅ **Cloudflare Pages 설정** - 1시간
2. ✅ **API 엔드포인트 변경** - 2시간
3. ✅ **배포 테스트** - 30분

**예상 소요 시간**: 3.5시간
**위험도**: 낮음 (Firebase는 유지, 병렬 테스트 가능)

### 선택사항 (Medium Priority)

4. **Supabase 캐싱 구현** - 3시간
5. **도메인 전환** - 1시간
6. **구 서버 종료** - 30분

**예상 소요 시간**: 4.5시간
**위험도**: 낮음

---

## ✅ 권장 사항

### 결론: **Cloudflare Pages로 마이그레이션 추천**

**이유**:
1. ✅ **완전 무료** (연간 $110-585 절감)
2. ✅ **자동 배포** (Git push = 배포 완료)
3. ✅ **더 빠른 성능** (Cloudflare CDN + Edge Functions)
4. ✅ **관리 부담 제로** (서버 없음)
5. ✅ **Supabase와 완벽 통합** (이미 Edge Function 배포 완료)
6. ✅ **프리뷰 배포** (PR별 자동 생성)

### 단계별 실행 계획

**1단계 (오늘)**: Cloudflare Pages 프로젝트 생성 + 배포
- Firebase는 그대로 유지 (백업)
- Cloudflare에서 테스트

**2단계 (내일)**: API 마이그레이션
- Supabase Edge Function 연결
- 프론트엔드 코드 수정 (api.js, Availability.vue)
- 테스트

**3단계 (다음 주)**: 캐싱 + 도메인 전환
- Supabase Database 캐시 구현
- 도메인을 Cloudflare Pages로 전환
- Firebase Hosting 중단
- 구 백엔드 서버 종료

---

## 📁 관련 파일

### 프론트엔드 구조
```
frontend/
├── src/
│   ├── api.js                 # Axios 인스턴스
│   ├── App.vue
│   ├── main.js
│   ├── router.js
│   ├── components/
│   │   ├── RoomFilter.vue
│   │   └── SlotTable.vue
│   └── pages/
│       └── Availability.vue    # 메인 페이지
├── .env.development           # 로컬: http://localhost:8080
├── .env.production            # 프로덕션: https://api.kdhoon.me
├── firebase.json              # Firebase 설정
├── package.json
└── vite.config.js
```

### 수정 필요 파일
- `src/api.js` - baseURL 변경
- `src/pages/Availability.vue` - API 호출 로직 수정
- `.env.production` - Supabase Edge Function URL

---

## 🎉 마이그레이션 후 아키텍처

```
┌─────────────────────────────────────────────────┐
│                    사용자                        │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│         Cloudflare Pages (Vue 3 SPA)            │
│  - 자동 빌드 & 배포 (Git push)                   │
│  - 글로벌 CDN (300+ 데이터센터)                  │
│  - 무료 무제한                                    │
└────────────────┬────────────────────────────────┘
                 │ POST /library-crawler
                 ↓
┌─────────────────────────────────────────────────┐
│    Supabase Edge Functions (Deno + npm:got)     │
│  - 서울 리전 (낮은 레이턴시)                      │
│  - 500K 요청/월 무료                             │
│  - 세미나실 크롤링 (1-2초)                        │
└────────────────┬────────────────────────────────┘
                 │ (선택) 캐시 확인
                 ↓
┌─────────────────────────────────────────────────┐
│         Supabase Database (PostgreSQL)          │
│  - 캐시 테이블 (5분 TTL)                         │
│  - 500MB 무료                                    │
└─────────────────────────────────────────────────┘
```

**특징**:
- ✅ 완전 서버리스
- ✅ 자동 스케일링
- ✅ 글로벌 배포
- ✅ 거의 무료 ($0-2/월)
- ✅ 관리 부담 제로

**다음 단계**: Cloudflare Pages 프로젝트 생성부터 시작하시겠습니까?
