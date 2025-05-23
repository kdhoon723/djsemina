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
* 최신 캐시된 데이터를 가져오는 함수 (기존 fetchCached 역할)
*/
async function fetchLatestCached() {
loading.value = true; // 일반 로딩 시작
forceCrawlLoading.value = false; // 강제 크롤링 로딩 해제
error.value = "";
try {
  // _ts 파라미터 없이 요청하여 캐시된 데이터 요청
  const res = await api.get(`/api/availability?date=${date.value}`);
  rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
  fetchedAt.value = res.data.fetchedAt || "";
  isCachedData.value = res.data.cached ?? true; // 응답에 cached 필드가 있으면 사용, 없으면 true
} catch (e) {
  error.value = e.response?.data?.message || e.message || "데이터를 불러오는 중 오류가 발생했습니다.";
  rooms.value = []; // 오류 시 방 목록 초기화
  fetchedAt.value = "";
} finally {
  loading.value = false; // 일반 로딩 종료
}
}

/**
* 실시간 크롤링을 강제로 요청하는 함수 (기존 fetchRealtime 역할)
*/
async function forceRealtimeCrawl() {
forceCrawlLoading.value = true; // 강제 크롤링 로딩 시작
loading.value = false; // 일반 로딩 해제
error.value = "";
try {
  // _ts 파라미터를 추가하여 강제 크롤링 요청
  const res = await api.get(
    `/api/availability?date=${date.value}&_ts=${Date.now()}`
  );
  rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
  fetchedAt.value = res.data.fetchedAt || "";
  isCachedData.value = false; // 강제로 가져왔으므로 캐시 아님
} catch (e) {
  error.value = e.response?.data?.message || e.message || "실시간 데이터를 불러오는 중 오류가 발생했습니다.";
  rooms.value = []; // 오류 시 방 목록 초기화
  fetchedAt.value = "";
} finally {
  forceCrawlLoading.value = false; // 강제 크롤링 로딩 종료
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

// 컴포넌트 마운트 시 캐시된 데이터 로드
onMounted(fetchLatestCached);

// 시간 포맷 함수 (기존 유지)
function formatTime(iso) {
if (!iso) return "";
const d = new Date(iso);
const hh = String(d.getHours()).padStart(2, "0");
const mm = String(d.getMinutes()).padStart(2, "0");
const ss = String(d.getSeconds()).padStart(2, "0");
return `${hh}:${mm}:${ss}`;
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
