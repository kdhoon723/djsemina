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
            :disabled="isHistoryMode"
          ></v-text-field>
          <v-btn
            @mousedown="handleButtonDown"
            @mouseup="handleButtonUp"
            @mouseleave="handleButtonLeave"
            :loading="loading || forceCrawlLoading"
            :disabled="isHistoryMode"
            color="primary"
            prepend-icon="mdi-refresh"
            variant="elevated"
            class="refresh-btn"
          >
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
            v-if="!isHistoryMode"
            @click="enterHistoryMode"
            :loading="historyLoading"
            size="small"
            variant="text"
            prepend-icon="mdi-history"
            color="grey-darken-1"
          >
            히스토리
          </v-btn>
          <v-btn
            v-else
            @click="exitHistoryMode"
            size="small"
            variant="text"
            prepend-icon="mdi-close"
            color="error"
          >
            히스토리 종료
          </v-btn>
        </div>
      </div>

      <!-- 히스토리 슬라이더 (메인 화면에 통합) -->
      <transition name="slide-fade">
        <div v-if="isHistoryMode" class="history-slider-section">
          <v-divider class="my-4"></v-divider>

          <div v-if="historyError" class="text-center py-4 text-error">
            {{ historyError }}
          </div>

          <div v-else-if="allSnapshotsData.length === 0" class="text-center py-4 text-grey">
            이 날짜의 히스토리가 없습니다.
          </div>

          <div v-else class="history-controls">
            <div class="slider-container">
              <div class="slider-header">
                <v-icon size="small" color="primary">mdi-history</v-icon>
                <span class="slider-title">타임라인</span>
                <span class="slider-counter">{{ historySliderIndex + 1 }} / {{ allSnapshotsData.length }}</span>
              </div>

              <v-slider
                v-model="historySliderIndex"
                :min="0"
                :max="allSnapshotsData.length - 1"
                :step="1"
                thumb-label="always"
                color="primary"
                track-color="grey-lighten-2"
                @update:model-value="onSliderChange"
                hide-details
                class="history-slider"
              >
                <template v-slot:thumb-label="{ modelValue }">
                  <div class="text-caption">
                    {{ formatTime(allSnapshotsData[modelValue]?.fetched_at) }}
                  </div>
                </template>
              </v-slider>
            </div>

            <!-- 재생 컨트롤 -->
            <div class="playback-controls">
              <v-btn
                @click="historySliderIndex = 0"
                icon="mdi-skip-backward"
                variant="text"
                size="small"
                color="primary"
              ></v-btn>
              <v-btn
                @click="playHistory"
                :icon="isPlaying ? 'mdi-pause' : 'mdi-play'"
                variant="tonal"
                color="primary"
                size="small"
              ></v-btn>
              <v-btn
                @click="historySliderIndex = allSnapshotsData.length - 1"
                icon="mdi-skip-forward"
                variant="text"
                size="small"
                color="primary"
              ></v-btn>
            </div>
          </div>
        </div>
      </transition>

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
      <!-- 로딩 상태 표시 -->
      <div v-if="loading || forceCrawlLoading || historyLoading" class="status-card loading">
        <v-progress-circular indeterminate color="primary" class="loader"></v-progress-circular>
        <p v-if="historyLoading">히스토리 데이터를 불러오는 중입니다...</p>
        <p v-else-if="forceCrawlLoading">실시간 데이터를 강제로 불러오는 중입니다...</p>
        <p v-else>데이터를 불러오는 중입니다...</p>
        <p class="hint" v-if="forceCrawlLoading">약 20초 정도 소요될 수 있습니다...</p>
        <p class="hint" v-if="historyLoading && allSnapshotsData.length > 0">{{ allSnapshotsData.length }}개의 스냅샷을 로드하는 중...</p>
      </div>

      <div v-else-if="error" class="status-card error">
        <v-icon color="error" size="large">mdi-alert-circle</v-icon>
        <p>{{ error }}</p>
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

// --- 초기 날짜 계산 로직 ---
function getInitialDate() {
  const now = new Date();
  const currentHour = now.getHours();
  let targetDate = new Date(now);

  if (currentHour >= 20) {
    targetDate.setDate(now.getDate() + 1);
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const date = ref(getInitialDate());
const rooms = ref([]);
const loading = ref(false);
const forceCrawlLoading = ref(false);
const error = ref("");
const fetchedAt = ref("");
const isCachedData = ref(true);
const filter = ref("ALL");

// 히스토리 모드 관련 상태
const isHistoryMode = ref(false);
const historyLoading = ref(false);
const historyError = ref("");
const allSnapshotsData = ref([]); // 모든 스냅샷 데이터를 메모리에 저장
const historySliderIndex = ref(0);
const isPlaying = ref(false);
let playInterval = null;

// Long Press 관련 상태
const longPressTimer = ref(null);
const LONG_PRESS_DURATION = 5000;

const filterOptions = [
  { label: "전체", value: "ALL" },
  { label: "캐럴실", value: "C" },
  { label: "세미나실", value: "S" },
  { label: "소강당", value: "Z" },
];

const roomList = computed(() =>
  Array.isArray(rooms.value) ? rooms.value : []
);

const filteredRooms = computed(() => {
  const arr = roomList.value;
  return filter.value === "ALL"
    ? arr
    : arr.filter(r => r.room_cd.startsWith(filter.value));
});

/**
 * LocalStorage 저장/읽기
 */
const STORAGE_PREFIX = 'djsemina_data_';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간

function saveToLocalStorage(dateStr, data) {
  try {
    const storageData = {
      rooms: data.rooms,
      fetchedAt: data.fetchedAt,
      cached: data.cached,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_PREFIX + dateStr, JSON.stringify(storageData));
  } catch (e) {
    console.warn('LocalStorage 저장 실패:', e);
  }
}

function loadFromLocalStorage(dateStr) {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + dateStr);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // 24시간 이상 오래된 데이터는 삭제
    if (Date.now() - data.timestamp > STORAGE_EXPIRY) {
      localStorage.removeItem(STORAGE_PREFIX + dateStr);
      return null;
    }

    return data;
  } catch (e) {
    console.warn('LocalStorage 읽기 실패:', e);
    return null;
  }
}

/**
 * LocalStorage 먼저 표시하고 백그라운드에서 서버 데이터 가져오기
 */
async function fetchLatestCached() {
  forceCrawlLoading.value = false;
  error.value = "";

  // 1단계: LocalStorage에서 즉시 로드 (스피너 없음)
  const localData = loadFromLocalStorage(date.value);
  if (localData) {
    rooms.value = Array.isArray(localData.rooms) ? localData.rooms : [];
    fetchedAt.value = localData.fetchedAt;
    isCachedData.value = true;
    loading.value = false;
    console.log('[LocalStorage] 즉시 표시:', localData.rooms.length, '개 방');
  } else {
    // LocalStorage에 데이터가 없으면 스피너 표시
    loading.value = true;
  }

  // 2단계: 백그라운드로 서버 캐시 확인
  try {
    const cacheRes = await api.post('/library-crawler', {
      date: date.value,
      useCache: true
    });

    if (cacheRes.data.success && cacheRes.data.cached) {
      const serverRooms = Array.isArray(cacheRes.data.rooms) ? cacheRes.data.rooms : [];
      const serverFetchedAt = cacheRes.data.fetchedAt || cacheRes.data.date;

      // LocalStorage 업데이트
      saveToLocalStorage(date.value, {
        rooms: serverRooms,
        fetchedAt: serverFetchedAt,
        cached: true
      });

      // 화면 업데이트 (LocalStorage 데이터와 다른 경우만)
      if (!localData || localData.fetchedAt !== serverFetchedAt) {
        rooms.value = serverRooms;
        fetchedAt.value = serverFetchedAt;
        isCachedData.value = true;
        console.log('[Server Cache] 업데이트:', serverRooms.length, '개 방');
      }

      loading.value = false;

      // 3단계: 백그라운드로 실시간 데이터 가져오기
      try {
        const realtimeRes = await api.post('/library-crawler', {
          date: date.value,
          useCache: false
        });

        if (realtimeRes.data.success) {
          const realtimeRooms = Array.isArray(realtimeRes.data.rooms) ? realtimeRes.data.rooms : [];
          const realtimeFetchedAt = realtimeRes.data.fetchedAt;

          // LocalStorage 업데이트
          saveToLocalStorage(date.value, {
            rooms: realtimeRooms,
            fetchedAt: realtimeFetchedAt,
            cached: false
          });

          rooms.value = realtimeRooms;
          fetchedAt.value = realtimeFetchedAt;
          isCachedData.value = false;
          console.log('[Realtime] 최종 업데이트:', realtimeRooms.length, '개 방');
        }
      } catch (bgError) {
        console.warn('백그라운드 업데이트 실패:', bgError);
      }
    } else {
      // 캐시가 없으면 실시간 크롤링
      const res = await api.post('/library-crawler', {
        date: date.value,
        useCache: false
      });

      const realtimeRooms = Array.isArray(res.data.rooms) ? res.data.rooms : [];
      const realtimeFetchedAt = res.data.fetchedAt || res.data.date;

      // LocalStorage 저장
      saveToLocalStorage(date.value, {
        rooms: realtimeRooms,
        fetchedAt: realtimeFetchedAt,
        cached: false
      });

      rooms.value = realtimeRooms;
      fetchedAt.value = realtimeFetchedAt;
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
 * 실시간 크롤링 강제 요청
 */
async function forceRealtimeCrawl() {
  forceCrawlLoading.value = true;
  loading.value = false;
  error.value = "";

  try {
    const res = await api.post('/library-crawler', {
      date: date.value,
      useCache: false
    });

    const realtimeRooms = Array.isArray(res.data.rooms) ? res.data.rooms : [];
    const realtimeFetchedAt = res.data.fetchedAt || res.data.date;

    // LocalStorage에 저장
    saveToLocalStorage(date.value, {
      rooms: realtimeRooms,
      fetchedAt: realtimeFetchedAt,
      cached: false
    });

    rooms.value = realtimeRooms;
    fetchedAt.value = realtimeFetchedAt;
    isCachedData.value = false;
  } catch (e) {
    error.value = e.response?.data?.error || e.message || "실시간 데이터를 불러오는 중 오류가 발생했습니다.";
    rooms.value = [];
    fetchedAt.value = "";
  } finally {
    forceCrawlLoading.value = false;
  }
}

// 버튼 이벤트 핸들러
function handleButtonDown() {
  if (loading.value || forceCrawlLoading.value || isHistoryMode.value) return;

  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }

  longPressTimer.value = setTimeout(() => {
    console.log("Long press detected!");
    triggerLongPress();
    longPressTimer.value = null;
  }, LONG_PRESS_DURATION);
}

function handleButtonUp() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
    console.log("Short click detected!");
    fetchLatestCached();
  }
}

function handleButtonLeave() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
    console.log("Mouse left before long press.");
  }
}

function triggerLongPress() {
  forceRealtimeCrawl();
}

// 히스토리 모드 진입
async function enterHistoryMode() {
  historyLoading.value = true;
  historyError.value = "";
  allSnapshotsData.value = [];
  historySliderIndex.value = 0;

  try {
    // 한 번의 요청으로 해당 날짜의 모든 스냅샷(rooms 포함)을 가져온다 (N+1 제거)
    const listRes = await api.get(`/library-history?date=${date.value}`);

    if (!listRes.data.success) {
      historyError.value = listRes.data.error || "히스토리를 불러올 수 없습니다.";
      return;
    }

    const snapshots = Array.isArray(listRes.data.snapshots) ? listRes.data.snapshots : [];

    if (snapshots.length === 0) {
      historyError.value = "";
      allSnapshotsData.value = [];
      isHistoryMode.value = true;
      return;
    }

    // 시간 오름차순 정렬(과거→현재): 슬라이더 왼쪽=과거, 오른쪽=현재
    allSnapshotsData.value = snapshots
      .slice()
      .sort((a, b) => new Date(a.fetched_at) - new Date(b.fetched_at));

    if (allSnapshotsData.value.length > 0) {
      historySliderIndex.value = allSnapshotsData.value.length - 1; // 가장 오른쪽 = 현재(최신)에서 시작
      applySnapshotToView(historySliderIndex.value);
    }

    isHistoryMode.value = true;
  } catch (e) {
    historyError.value = e.response?.data?.error || e.message || "히스토리 조회 중 오류가 발생했습니다.";
  } finally {
    historyLoading.value = false;
  }
}

// 히스토리 모드 종료
function exitHistoryMode() {
  stopPlaying();
  isHistoryMode.value = false;
  allSnapshotsData.value = [];
  historySliderIndex.value = 0;
  historyError.value = "";

  // 현재 날짜의 최신 데이터로 복귀
  fetchLatestCached();
}

// 슬라이더 변경 - 즉시 반응 (API 호출 없음)
function onSliderChange(newIndex) {
  applySnapshotToView(newIndex);
}

// 스냅샷을 화면에 적용
function applySnapshotToView(index) {
  if (index >= 0 && index < allSnapshotsData.value.length) {
    const snapshot = allSnapshotsData.value[index];
    rooms.value = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
    fetchedAt.value = snapshot.fetched_at;
    isCachedData.value = true;
  }
}

// 히스토리 재생
function playHistory() {
  if (isPlaying.value) {
    stopPlaying();
  } else {
    startPlaying();
  }
}

// 재생 시작 - 더 빠르게 (200ms 간격)
function startPlaying() {
  isPlaying.value = true;
  playInterval = setInterval(() => {
    if (historySliderIndex.value < allSnapshotsData.value.length - 1) {
      historySliderIndex.value++;
    } else {
      stopPlaying();
    }
  }, 200); // 200ms마다 다음 스냅샷 (부드러운 애니메이션)
}

// 재생 중지
function stopPlaying() {
  isPlaying.value = false;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

// date 변경 감지
watch(date, (newD, oldD) => {
  if (newD !== oldD && !isHistoryMode.value) {
    fetchLatestCached();
  }
});

// 컴포넌트 마운트
onMounted(() => {
  const correctDate = getInitialDate();
  if (date.value !== correctDate) {
    date.value = correctDate;
  }
  fetchLatestCached();
});

// 시간 포맷 함수
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

.refresh-btn {
  height: 40px;
  font-weight: 500;
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
  gap: 8px;
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

/* 히스토리 슬라이더 섹션 */
.history-slider-section {
  margin-top: 8px;
}

.history-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slider-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text);
}

.slider-title {
  font-weight: 500;
  flex: 1;
}

.slider-counter {
  font-size: 0.85rem;
  color: var(--text-light);
  background-color: rgba(255, 255, 255, 0.8);
  padding: 4px 12px;
  border-radius: 12px;
}

.history-slider {
  margin: 0;
}

.playback-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

/* 애니메이션 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-5px);
  opacity: 0;
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
  color: #ef4444;
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
  background-color: var(--success);
}

.legend-color.unavailable {
  background-color: #e2e8f0;
}

.table-wrapper {
  background-color: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

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

  .history-controls {
    padding: 12px;
  }

  .slider-header {
    font-size: 0.85rem;
  }
}
</style>
