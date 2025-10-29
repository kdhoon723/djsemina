<template>
  <div class="availability-container">
    <header class="page-header">
      <h1 class="page-title">세미나실 예약 현황</h1>
      <p class="page-subtitle">원하는 날짜와 시간에 이용 가능한 방을 확인하세요</p>
    </header>

    <div class="control-card">
      <div class="control-grid">
        <div class="date-section">
          <v-text-field
            v-model="date"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            class="date-picker"
            bg-color="white"
          ></v-text-field>
          <!-- 버튼 이벤트 핸들러 수정: mousedown, mouseup, mouseleave -->
          <v-btn
            @mousedown="handleButtonDown"
            @mouseup="handleButtonUp"
            @mouseleave="handleButtonLeave"
            :loading="loading || forceCrawlLoading"
            color="primary"
            prepend-icon="mdi-refresh"
            variant="elevated"
            class="refresh-btn"
          >
            <!-- 버튼 텍스트는 그대로 유지 -->
            조회
          </v-btn>
        </div>

        <div class="info-section">
          <span v-if="fetchedAt" class="update-time">
            <v-icon size="small" color="grey">mdi-clock-outline</v-icon>
            마지막 업데이트: {{ formatTime(fetchedAt) }}
            <v-tooltip v-if="isCachedData" activator="parent" location="top">자동 갱신된 정보</v-tooltip>
            <v-tooltip v-else activator="parent" location="top">수동으로 갱신된 정보</v-tooltip>
          </span>
          <v-btn
            @click="openHistoryDialog"
            size="small"
            variant="text"
            prepend-icon="mdi-history"
            color="grey-darken-1"
          >
            히스토리
          </v-btn>
        </div>
      </div>

      <div class="divider"></div>

      <div class="filter-section">
        <span class="filter-label">구분:</span>
        <div class="filter-chips">
          <v-chip
            v-for="opt in filterOptions"
            :key="opt.value"
            :color="filter === opt.value ? 'primary' : 'default'"
            :variant="filter === opt.value ? 'elevated' : 'outlined'"
            @click="filter = opt.value"
            class="filter-chip"
          >
            {{ opt.label }}
          </v-chip>
        </div>
      </div>
    </div>

    <transition name="fade" mode="out-in">
      <!-- 로딩 상태 표시: loading 또는 forceCrawlLoading일 때 -->
      <div v-if="loading || forceCrawlLoading" class="status-card loading">
        <v-progress-circular indeterminate color="primary" class="loader"></v-progress-circular>
        <p>{{ forceCrawlLoading ? '실시간 데이터를 강제로 불러오는 중입니다...' : '데이터를 불러오는 중입니다...' }}</p>
          <p class="hint" v-if="forceCrawlLoading">약 20초 정도 소요될 수 있습니다...</p>
      </div>

      <div v-else-if="error" class="status-card error">
        <v-icon color="error" size="large">mdi-alert-circle</v-icon>
        <p>{{ error }}</p>
        <!-- 다시 시도 버튼은 일반 조회(캐시)를 하도록 함 -->
        <v-btn color="primary" @click="fetchLatestCached" variant="text">다시 시도</v-btn>
      </div>

      <div v-else-if="roomList.length === 0" class="status-card empty">
        <v-icon color="grey" size="large">mdi-calendar-remove</v-icon>
        <p>선택하신 날짜에 예약 가능한 방이 없습니다.</p>
        <p class="hint">다른 날짜를 선택해보거나, 버튼을 길게 눌러 실시간 조회를 시도해보세요.</p>
      </div>

      <div v-else class="results-container">
        <div class="results-header">
          <div class="room-count">
            <v-chip color="primary" variant="flat" size="small">{{ filteredRooms.length }}</v-chip>
            <span>개 방 표시 중</span>
            <span class="total-count">(전체 {{ roomList.length }}개)</span>
          </div>

          <div class="legend">
            <div class="legend-item">
              <span class="legend-color available"></span>
              <span>예약 가능</span>
            </div>
            <div class="legend-item">
              <span class="legend-color unavailable"></span>
              <span>예약 불가</span>
            </div>
          </div>
        </div>

        <div class="table-wrapper">
          <SlotTable :rooms="filteredRooms" />
        </div>
      </div>
    </transition>

    <!-- 히스토리 다이얼로그 -->
    <v-dialog v-model="historyDialog" max-width="800px">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>{{ date }} 히스토리</span>
          <v-btn icon="mdi-close" variant="text" @click="historyDialog = false"></v-btn>
        </v-card-title>
        <v-card-text>
          <div v-if="historyLoading" class="text-center py-8">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-4">히스토리를 불러오는 중...</p>
          </div>
          <div v-else-if="historyError" class="text-center py-8 text-error">
            {{ historyError }}
          </div>
          <div v-else-if="historySnapshots.length === 0" class="text-center py-8 text-grey">
            이 날짜의 히스토리가 없습니다.
          </div>
          <v-list v-else>
            <v-list-item
              v-for="snapshot in historySnapshots"
              :key="snapshot.id"
              @click="loadSnapshot(snapshot.id)"
              class="cursor-pointer"
            >
              <template v-slot:prepend>
                <v-icon>mdi-clock-outline</v-icon>
              </template>
              <v-list-item-title>
                {{ formatTime(snapshot.fetched_at) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                조회 시간: {{ new Date(snapshot.fetched_at).toLocaleString('ko-KR') }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "@/api.js";
import SlotTable from "@/components/SlotTable.vue";

// --- 초기 날짜 계산 로직 추가 ---
function getInitialDate() {
const now = new Date();
const currentHour = now.getHours();
let targetDate = new Date(now); // 현재 날짜로 초기화 (복사본 생성)

// 현재 시간이 오후 8시(20시) 이후이면
if (currentHour >= 20) {
  targetDate.setDate(now.getDate() + 1); // 날짜를 하루 뒤로 설정
}

return targetDate.toISOString().slice(0, 10); // YYYY-MM-DD 형식으로 반환
}
// --- 초기 날짜 계산 로직 끝 ---

const date = ref(getInitialDate()); // 계산된 초기 날짜로 설정
const rooms = ref([]);
const loading = ref(false); // 일반 로딩 (캐시 조회)
const forceCrawlLoading = ref(false); // 강제 크롤링 로딩
const error = ref("");
const fetchedAt = ref("");
const isCachedData = ref(true); // 현재 표시된 데이터가 캐시된 데이터인지 여부
const filter = ref("ALL");

// 히스토리 관련 상태
const historyDialog = ref(false);
const historyLoading = ref(false);
const historyError = ref("");
const historySnapshots = ref([]);

// --- Long Press 관련 상태 ---
const longPressTimer = ref(null);
const LONG_PRESS_DURATION = 5000; // 5초

const filterOptions = [
{ label: "전체", value: "ALL" },
{ label: "캐럴실", value: "C" },
{ label: "세미나실", value: "S" },
{ label: "소강당", value: "Z" },
];

// rooms 값이 배열이 아니면 빈 배열로 대체
const roomList = computed(() =>
Array.isArray(rooms.value) ? rooms.value : []
);

// 필터링 시에도 안전하게 처리
const filteredRooms = computed(() => {
const arr = roomList.value;
return filter.value === "ALL"
  ? arr
  : arr.filter(r => r.room_cd.startsWith(filter.value));
});

/**
* 캐시를 먼저 표시하고 백그라운드에서 업데이트
* Stale-While-Revalidate 패턴
*/
async function fetchLatestCached() {
loading.value = true;
forceCrawlLoading.value = false;
error.value = "";

try {
  // 1단계: 캐시 조회 (즉시 표시)
  const cacheRes = await api.post('/library-crawler', {
    userId: import.meta.env.VITE_USER_ID,
    userPw: import.meta.env.VITE_USER_PW,
    date: date.value,
    useCache: true
  });

  if (cacheRes.data.success && cacheRes.data.cached) {
    // 캐시된 데이터 즉시 표시
    rooms.value = Array.isArray(cacheRes.data.rooms) ? cacheRes.data.rooms : [];
    fetchedAt.value = cacheRes.data.fetchedAt || cacheRes.data.date;
    isCachedData.value = true;
    loading.value = false; // 캐시 표시 후 로딩 종료

    // 2단계: 백그라운드에서 실시간 데이터 가져오기
    try {
      const realtimeRes = await api.post('/library-crawler', {
        userId: import.meta.env.VITE_USER_ID,
        userPw: import.meta.env.VITE_USER_PW,
        date: date.value,
        useCache: false
      });

      if (realtimeRes.data.success) {
        // 새 데이터로 조용히 업데이트
        rooms.value = Array.isArray(realtimeRes.data.rooms) ? realtimeRes.data.rooms : [];
        fetchedAt.value = realtimeRes.data.fetchedAt;
        isCachedData.value = false;
      }
    } catch (bgError) {
      // 백그라운드 업데이트 실패는 무시 (캐시가 이미 표시됨)
      console.warn('백그라운드 업데이트 실패:', bgError);
    }
  } else {
    // 캐시 없음 - 실시간 크롤링
    const res = await api.post('/library-crawler', {
      userId: import.meta.env.VITE_USER_ID,
      userPw: import.meta.env.VITE_USER_PW,
      date: date.value,
      useCache: false
    });

    rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
    fetchedAt.value = res.data.fetchedAt || res.data.date;
    isCachedData.value = false;
    loading.value = false;
  }
} catch (e) {
  error.value = e.response?.data?.error || e.message || "데이터를 불러오는 중 오류가 발생했습니다.";
  rooms.value = [];
  fetchedAt.value = "";
  loading.value = false;
}
}

/**
* 실시간 크롤링 강제 요청 (롱프레스 시)
*/
async function forceRealtimeCrawl() {
forceCrawlLoading.value = true;
loading.value = false;
error.value = "";
try {
  // 캐시 무시하고 실시간 크롤링
  const res = await api.post('/library-crawler', {
    userId: import.meta.env.VITE_USER_ID,
    userPw: import.meta.env.VITE_USER_PW,
    date: date.value,
    useCache: false
  });
  rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
  fetchedAt.value = res.data.fetchedAt || res.data.date;
  isCachedData.value = false;
} catch (e) {
  error.value = e.response?.data?.error || e.message || "실시간 데이터를 불러오는 중 오류가 발생했습니다.";
  rooms.value = [];
  fetchedAt.value = "";
} finally {
  forceCrawlLoading.value = false;
}
}

// --- 버튼 이벤트 핸들러 ---

/**
* 버튼 누르기 시작 시: 타이머 설정
*/
function handleButtonDown() {
// 이미 진행 중인 로딩이 있으면 무시
if (loading.value || forceCrawlLoading.value) return;

// 기존 타이머가 있다면 제거
if (longPressTimer.value) {
  clearTimeout(longPressTimer.value);
  longPressTimer.value = null;
}

// 롱프레스 타이머 설정
longPressTimer.value = setTimeout(() => {
  console.log("Long press detected!");
  triggerLongPress();
  longPressTimer.value = null; // 타이머 완료 후 초기화
}, LONG_PRESS_DURATION);
}

/**
* 버튼 떼기 시: 타이머가 아직 있으면 (롱프레스 안됨) 일반 조회 실행
*/
function handleButtonUp() {
// 타이머가 아직 존재하면 (롱프레스 되기 전에 뗌)
if (longPressTimer.value) {
  clearTimeout(longPressTimer.value);
  longPressTimer.value = null;
  console.log("Short click detected!");
  // 일반 조회 (캐시된 데이터 가져오기)
  fetchLatestCached();
}
// 롱프레스가 이미 발동된 후 버튼을 떼는 경우는 아무것도 하지 않음
}

/**
* 버튼 위에서 마우스 벗어날 시: 타이머 해제
*/
function handleButtonLeave() {
if (longPressTimer.value) {
  clearTimeout(longPressTimer.value);
  longPressTimer.value = null;
  console.log("Mouse left before long press.");
}
}

/**
* 롱프레스 감지 시 호출: 강제 실시간 크롤링 실행
*/
function triggerLongPress() {
// 강제 실시간 크롤링 요청
forceRealtimeCrawl();
}


// date가 바뀔 때마다 캐시된 데이터를 다시 불러옴
watch(date, (newD, oldD) => {
if (newD !== oldD) fetchLatestCached();
});

// 컴포넌트 마운트 시 날짜 재확인 및 데이터 로드
onMounted(() => {
  // 페이지 로드 시마다 날짜를 다시 계산 (F5, 새로고침 대응)
  const correctDate = getInitialDate();
  if (date.value !== correctDate) {
    date.value = correctDate;
  }
  fetchLatestCached();
});

// 시간 포맷 함수 (기존 유지)
function formatTime(iso) {
if (!iso) return "";
const d = new Date(iso);
const hh = String(d.getHours()).padStart(2, "0");
const mm = String(d.getMinutes()).padStart(2, "0");
const ss = String(d.getSeconds()).padStart(2, "0");
return `${hh}:${mm}:${ss}`;
}

// 히스토리 다이얼로그 열기
async function openHistoryDialog() {
  historyDialog.value = true;
  historyLoading.value = true;
  historyError.value = "";
  historySnapshots.value = [];

  try {
    const res = await api.get(`/library-history?date=${date.value}`);
    if (res.data.success) {
      historySnapshots.value = res.data.snapshots;
    } else {
      historyError.value = res.data.error || "히스토리를 불러올 수 없습니다.";
    }
  } catch (e) {
    historyError.value = e.response?.data?.error || e.message || "히스토리 조회 중 오류가 발생했습니다.";
  } finally {
    historyLoading.value = false;
  }
}

// 특정 스냅샷 로드
async function loadSnapshot(snapshotId) {
  try {
    const res = await api.get(`/library-snapshot?id=${snapshotId}`);
    if (res.data.success) {
      const snapshot = res.data.snapshot;
      rooms.value = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
      fetchedAt.value = snapshot.fetchedAt;
      isCachedData.value = true;
      historyDialog.value = false; // 다이얼로그 닫기
    }
  } catch (e) {
    historyError.value = e.response?.data?.error || e.message || "스냅샷을 불러올 수 없습니다.";
  }
}
</script>

<style scoped>
.availability-container {
  max-width: 100%;
  padding: 0;
}

.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-title {
  color: var(--primary);
  font-weight: 700;
  margin-bottom: 4px;
  font-size: 1.8rem;
}

.page-subtitle {
  color: var(--text-light);
  font-size: 1rem;
  margin-top: 0;
}

.control-card {
  background-color: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 24px;
}

.control-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.date-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.date-picker {
  max-width: 160px;
}

/* 버튼 스타일 약간 조정 */
.refresh-btn {
  height: 40px;
  font-weight: 500;
  /* 사용자 선택 방지 (드래그 등) */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.info-section {
  font-size: 0.9rem;
  color: var(--text-light);
  display: flex;
  align-items: center;
}

.update-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.divider {
  height: 1px;
  background-color: #e2e8f0;
  margin: 16px 0;
}

.filter-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-label {
  font-weight: 500;
  color: var(--text);
  font-size: 0.9rem;
}

.filter-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip:hover {
  transform: translateY(-2px);
}

.status-card {
  background-color: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 40px 20px;
  text-align: center;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-card.loading {
  color: var(--text-light);
}

.status-card.error {
  color: #ef4444; /* Vuetify error color */
}

.status-card.empty {
  color: var(--text-light);
}

.hint {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-top: -10px;
}

.results-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.room-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.total-count {
  color: var(--text-light);
  font-weight: normal;
}

.legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-block;
}

.legend-color.available {
  background-color: var(--success); /* Vuetify success color */
}

.legend-color.unavailable {
  background-color: #e2e8f0; /* Tailwind gray-200 */
}

.table-wrapper {
  background-color: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

/* 애니메이션 (기존 유지) */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .control-grid,
  .results-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .date-section,
  .filter-section {
    width: 100%;
  }

  .date-picker {
    max-width: 100%;
    flex: 1;
  }

  .legend {
    margin-top: 8px;
  }

  .page-title {
    font-size: 1.6rem;
  }
}
</style>
