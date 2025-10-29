# Cloudflare Pages 마이그레이션 가이드
## 기존 도메인(djsemina.kdhoon.me) 유지하면서 Firebase → Cloudflare Pages 전환

**작성일**: 2025-10-29
**현재 상태**: Firebase Hosting (`djsemina.web.app`)
**목표**: Cloudflare Pages로 전환하면서 `djsemina.kdhoon.me` 도메인 유지

---

## 📊 현재 DNS 설정

```
도메인: kdhoon.me (Cloudflare에서 관리 중)
서브도메인: djsemina.kdhoon.me
  ↓ CNAME
  djsemina.web.app (Firebase Hosting)
  ↓
  IP: 199.36.158.100
```

---

## ✅ 마이그레이션 장점

### 도메인이 이미 Cloudflare에 있으므로:

1. ✅ **DNS 전환 즉시 적용** (수초 이내)
2. ✅ **다운타임 없음** (Cloudflare 네트워크 내에서 전환)
3. ✅ **SSL 자동 갱신** (Let's Encrypt)
4. ✅ **추가 비용 없음** (도메인 이전 불필요)
5. ✅ **Rollback 쉬움** (DNS 레코드만 복원)

---

## 🚀 마이그레이션 단계별 가이드

### Phase 1: Cloudflare Pages 프로젝트 생성 (15분)

#### 1-1. Cloudflare Dashboard 접속

1. https://dash.cloudflare.com/ 로그인
2. 좌측 메뉴 **"Workers & Pages"** 클릭
3. **"Create application"** → **"Pages"** 탭 선택

#### 1-2. Git 저장소 연결

**연결 옵션**:
- **GitHub**: 추천 (자동 배포)
- **GitLab**: 지원됨
- **Direct Upload**: Git 없이 수동 업로드 (비추천)

**저장소 선택**:
```
Repository: djsemina (또는 저장소 이름)
```

#### 1-3. 빌드 설정

```yaml
Project name: djsemina
Production branch: main

Build settings:
  Framework preset: None (또는 Vue)
  Build command: npm run build
  Build output directory: dist
  Root directory: frontend

Environment variables:
  VITE_API_BASE_URL=https://jfgahabbpkskrjonquxd.supabase.co/functions/v1
  # 필요시 추가 환경 변수
```

**중요**: Root directory를 `frontend`로 설정해야 함!

#### 1-4. 첫 배포

**"Save and Deploy"** 클릭

→ 자동 빌드 시작 (1-3분 소요)

→ 배포 완료 시 Cloudflare Pages URL 생성:
```
https://djsemina-abc.pages.dev
```

**테스트**: 이 URL에서 정상 작동 확인

---

### Phase 2: 커스텀 도메인 설정 (5분)

#### 2-1. Cloudflare Pages에서 도메인 추가

1. Cloudflare Pages 프로젝트 대시보드
2. **"Custom domains"** 탭 클릭
3. **"Set up a custom domain"** 클릭
4. 도메인 입력:
   ```
   djsemina.kdhoon.me
   ```
5. **"Continue"** 클릭

#### 2-2. DNS 레코드 자동 생성

Cloudflare가 자동으로 제안:

**옵션 1 (CNAME - 추천)**:
```
Type: CNAME
Name: djsemina
Target: djsemina-abc.pages.dev
Proxied: ✅ (Cloudflare CDN 사용)
```

**옵션 2 (AAAA + A)**:
```
Type: AAAA
Name: djsemina
IPv6: [Cloudflare Pages IP]
Proxied: ✅
```

**"Activate domain"** 클릭

---

### Phase 3: 기존 Firebase DNS 레코드 처리 (2분)

#### 3-1. 현재 DNS 레코드 확인

Cloudflare DNS 탭에서:
```
Type: CNAME
Name: djsemina
Target: djsemina.web.app (Firebase)
```

#### 3-2. 레코드 업데이트

**방법 A (자동 - 추천)**:
- Cloudflare Pages 도메인 추가 시 자동으로 업데이트됨
- 기존 레코드를 덮어씀

**방법 B (수동)**:
1. 기존 `djsemina` CNAME 레코드 **편집**
2. Target 변경:
   ```
   OLD: djsemina.web.app
   NEW: djsemina-abc.pages.dev
   ```
3. Proxied: ✅ 유지
4. **Save** 클릭

---

### Phase 4: SSL 인증서 확인 (자동, 1-2분)

Cloudflare가 자동으로 처리:

1. Let's Encrypt SSL 인증서 발급
2. HTTPS 자동 활성화
3. HTTP → HTTPS 자동 리디렉션

**확인 방법**:
```
https://djsemina.kdhoon.me
```
브라우저에서 🔒 표시 확인

---

### Phase 5: Firebase Hosting 정리 (선택)

#### 5-1. Firebase Hosting 비활성화

```bash
cd frontend
firebase hosting:disable
```

또는 Firebase Console에서:
1. https://console.firebase.google.com/
2. 프로젝트 `djsemina` 선택
3. Hosting 섹션
4. **"Release history"** → **"Disable"**

#### 5-2. Firebase 프로젝트 삭제 (선택)

**주의**: 다른 서비스(Firestore, Auth 등) 사용 중이면 **삭제 금지**

djsemina 프로젝트가 Hosting만 사용했다면:
1. Firebase Console → 프로젝트 설정
2. **"Delete project"**

---

## 🔧 API 엔드포인트 마이그레이션

### 현재 코드

```javascript
// frontend/src/api.js
export default axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
  // "https://api.kdhoon.me"
});

// frontend/src/pages/Availability.vue
const res = await api.get(`/api/availability?date=${date.value}`);
```

### 마이그레이션 후 (Supabase Edge Function)

#### Step 1: 환경 변수 업데이트

**Cloudflare Pages 환경 변수**:
```
VITE_API_BASE_URL=https://jfgahabbpkskrjonquxd.supabase.co/functions/v1
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Step 2: API 호출 변경

**frontend/src/api.js**:
```javascript
import axios from "axios";

export default axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }
});
```

**frontend/src/pages/Availability.vue**:
```javascript
// OLD
const res = await api.get(`/api/availability?date=${date.value}`);

// NEW
const res = await api.post('/library-crawler', {
  userId: import.meta.env.VITE_USER_ID || '20241476',
  userPw: import.meta.env.VITE_USER_PW || 'kdhkdh0723',
  date: date.value
});

// 응답 구조도 변경됨
rooms.value = res.data.rooms; // 동일
fetchedAt.value = res.data.date; // fetchedAt → date
```

#### Step 3: 환경 변수 추가 (보안)

**Cloudflare Pages 대시보드**:
```
Settings → Environment variables

Production:
  VITE_USER_ID=20241476
  VITE_USER_PW=********  (암호화됨)
  VITE_API_BASE_URL=https://jfgahabbpkskrjonquxd.supabase.co/functions/v1
  VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**주의**: `.env` 파일은 Git에 커밋하지 말 것!

---

## 📋 마이그레이션 체크리스트

### ✅ 배포 전 체크리스트

- [ ] Cloudflare Pages 프로젝트 생성
- [ ] Git 저장소 연결
- [ ] 빌드 설정 (Root directory: `frontend`)
- [ ] 환경 변수 설정
- [ ] 첫 배포 성공 확인
- [ ] `.pages.dev` URL에서 테스트

### ✅ 도메인 전환 체크리스트

- [ ] Cloudflare Pages에 커스텀 도메인 추가
- [ ] DNS 레코드 자동 업데이트 확인
- [ ] SSL 인증서 발급 확인 (1-2분)
- [ ] `https://djsemina.kdhoon.me` 접속 테스트
- [ ] 기존 Firebase URL 접속 불가 확인

### ✅ API 마이그레이션 체크리스트

- [ ] Supabase Edge Function 정상 작동 확인
- [ ] 환경 변수 설정 (USER_ID, USER_PW, API_BASE_URL)
- [ ] `src/api.js` 코드 수정
- [ ] `Availability.vue` API 호출 로직 수정
- [ ] 로컬 테스트 (`npm run dev`)
- [ ] 프로덕션 배포 및 테스트

### ✅ 정리 체크리스트

- [ ] Firebase Hosting 비활성화
- [ ] 구 백엔드 서버 종료 (api.kdhoon.me)
- [ ] Node.js + Puppeteer 서버 종료
- [ ] 비용 절감 확인

---

## ⚡ DNS 전환 타이밍

### 다운타임 없는 배포 전략

#### 옵션 A: Blue-Green 배포 (추천)

```
1. Cloudflare Pages 배포 (djsemina-abc.pages.dev)
2. 테스트 완료
3. DNS 전환 (djsemina.kdhoon.me → Cloudflare Pages)
   └─ Cloudflare 네트워크 내 전환 (수초)
4. Firebase 비활성화
```

**다운타임**: 0초 (Cloudflare CDN 캐시 활용)

#### 옵션 B: 단계적 전환

```
1. Cloudflare Pages 배포 (djsemina-test.kdhoon.me)
2. 일부 트래픽만 전환 (Cloudflare Load Balancing)
3. 모니터링 (1-2일)
4. 전체 트래픽 전환
```

**다운타임**: 0초 (점진적 전환)

---

## 🔍 트러블슈팅

### 문제 1: DNS 전파 지연

**증상**: `djsemina.kdhoon.me`가 여전히 Firebase를 가리킴

**원인**: DNS 캐시 (최대 24시간)

**해결**:
```bash
# Windows
ipconfig /flushdns

# Mac/Linux
sudo dscacheutil -flushcache

# 또는 직접 확인
nslookup djsemina.kdhoon.me 1.1.1.1
```

**Cloudflare는 즉시 전파**: Proxied(주황 구름) 활성화 시 수초 이내

---

### 문제 2: SSL 인증서 오류

**증상**: `NET::ERR_CERT_COMMON_NAME_INVALID`

**원인**: SSL 인증서 발급 진행 중

**해결**: 1-2분 대기 후 새로고침

**확인**:
```bash
openssl s_client -connect djsemina.kdhoon.me:443 -servername djsemina.kdhoon.me
```

---

### 문제 3: 빌드 실패

**증상**: Cloudflare Pages 빌드 에러

**원인**: Root directory 설정 오류

**해결**:
```
Settings → Builds & deployments
Root directory: frontend  (중요!)
Build command: npm run build
Output directory: dist
```

---

### 문제 4: API 호출 실패

**증상**: CORS 에러 또는 401 Unauthorized

**원인**: 환경 변수 미설정 또는 잘못된 API 키

**해결**:
```javascript
// Supabase Edge Function은 CORS 헤더 필요
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// edge-function-index.ts에 이미 포함되어 있음
```

**환경 변수 확인**:
```bash
# Cloudflare Pages 대시보드
Settings → Environment variables
└─ VITE_API_BASE_URL 존재 여부 확인
```

---

## 📊 배포 전후 비교

### 배포 전 (Firebase Hosting)

```
URL: https://djsemina.kdhoon.me
  ↓ DNS (Cloudflare)
  ↓ CNAME: djsemina.web.app
  ↓ Firebase CDN
  ↓ IP: 199.36.158.100

API: https://api.kdhoon.me/api/availability
  ↓ Node.js 서버 (VPS/Cloud)
  ↓ Puppeteer 크롤러
  ↓ 응답: 2-20초
```

### 배포 후 (Cloudflare Pages)

```
URL: https://djsemina.kdhoon.me
  ↓ DNS (Cloudflare)
  ↓ CNAME: djsemina-abc.pages.dev
  ↓ Cloudflare CDN (300+ 데이터센터)
  ↓ Edge Network

API: https://jfgahabbpkskrjonquxd.supabase.co/functions/v1/library-crawler
  ↓ Supabase Edge Function (서울 리전)
  ↓ got + tough-cookie 크롤러
  ↓ 응답: 1-2초
```

---

## 🎯 권장 실행 순서

### Day 1 (오늘): Cloudflare Pages 설정

```bash
1. Cloudflare Pages 프로젝트 생성          [15분]
2. Git 저장소 연결                         [5분]
3. 빌드 설정 (Root: frontend)             [5분]
4. 환경 변수 설정                          [5분]
5. 첫 배포 & 테스트 (.pages.dev URL)      [10분]

총 소요 시간: 40분
```

**결과**: `https://djsemina-abc.pages.dev` 배포 완료

---

### Day 2 (내일): API 마이그레이션

```bash
1. src/api.js 수정                         [5분]
2. Availability.vue API 호출 수정          [10분]
3. 로컬 테스트                             [10분]
4. Git commit & push (자동 배포)          [5분]
5. .pages.dev URL에서 테스트              [10분]

총 소요 시간: 40분
```

**결과**: Supabase Edge Function 연동 완료

---

### Day 3 (모레): 도메인 전환

```bash
1. Cloudflare Pages 커스텀 도메인 추가     [5분]
2. DNS 레코드 자동 업데이트 확인           [2분]
3. SSL 인증서 발급 대기                    [2분]
4. djsemina.kdhoon.me 접속 테스트         [5분]
5. Firebase Hosting 비활성화               [5분]
6. 구 백엔드 서버 종료                     [10분]

총 소요 시간: 30분
```

**결과**:
- ✅ 도메인 전환 완료
- ✅ 서버 비용 $0/월
- ✅ 관리 부담 제로

---

## 🎉 마이그레이션 완료 후

### 최종 아키텍처

```
┌─────────────────────────────────────┐
│     https://djsemina.kdhoon.me      │
│       (기존 도메인 유지!)            │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│      Cloudflare Pages (Vue 3)       │
│  - 자동 빌드 & 배포 (Git push)       │
│  - 글로벌 CDN (300+ DC)             │
│  - 완전 무료                         │
└────────────┬────────────────────────┘
             │ POST /library-crawler
             ↓
┌─────────────────────────────────────┐
│   Supabase Edge Functions (Deno)    │
│  - got + tough-cookie 크롤러        │
│  - 서울 리전 (낮은 레이턴시)         │
│  - 500K 요청/월 무료                 │
└─────────────────────────────────────┘
```

### 혜택

1. ✅ **도메인 유지**: `djsemina.kdhoon.me` 그대로 사용
2. ✅ **다운타임 0초**: Cloudflare 네트워크 내 전환
3. ✅ **비용 절감**: $120-600/년 → $0/년 (92-98% 절감)
4. ✅ **성능 향상**: 응답 시간 2-20초 → 1-2초
5. ✅ **자동 배포**: Git push = 배포 완료
6. ✅ **관리 부담 0**: 서버 없음

---

## 📞 다음 단계

지금 바로 시작하시겠습니까?

**1단계**: Cloudflare Dashboard → Workers & Pages → Create application

**질문이 있으시면**:
- Cloudflare Pages 프로젝트명 추천: `djsemina`
- GitHub 저장소 연결 방법 안내 필요 시 요청
- 환경 변수 설정 도움 필요 시 요청

**준비물**:
- ✅ Cloudflare 계정 (kdhoon.me 관리 중인 계정)
- ✅ GitHub/GitLab 계정 (djsemina 저장소)
- ✅ 환경 변수 값 (USER_ID, USER_PW)
