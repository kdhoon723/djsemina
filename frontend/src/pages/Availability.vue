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
            <v-btn
              @click="fetchRealtime"
              :loading="realtimeLoading"
              color="primary"
              prepend-icon="mdi-refresh"
              variant="elevated"
              class="refresh-btn"
            >
              실시간 조회
            </v-btn>
          </div>
  
          <div class="info-section">
            <span v-if="fetchedAt" class="update-time">
              <v-icon size="small" color="grey">mdi-clock-outline</v-icon>
              마지막 업데이트: {{ formatTime(fetchedAt) }}
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
        <div v-if="loading" class="status-card loading">
          <v-progress-circular indeterminate color="primary" class="loader"></v-progress-circular>
          <p>데이터를 불러오는 중입니다...</p>
        </div>
        
        <div v-else-if="error" class="status-card error">
          <v-icon color="error" size="large">mdi-alert-circle</v-icon>
          <p>{{ error }}</p>
          <v-btn color="primary" @click="fetchCached" variant="text">다시 시도</v-btn>
        </div>
        
        <div v-else-if="roomList.length === 0" class="status-card empty">
          <v-icon color="grey" size="large">mdi-calendar-remove</v-icon>
          <p>선택하신 날짜에 예약 가능한 방이 없습니다.</p>
          <p class="hint">다른 날짜를 선택해보세요.</p>
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
  
  const date = ref(new Date().toISOString().slice(0, 10));
  const rooms = ref([]);
  const loading = ref(false);
  const realtimeLoading = ref(false);
  const error = ref("");
  const fetchedAt = ref("");
  const filter = ref("ALL");
  
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
  
  async function fetchCached() {
    loading.value = true;
    error.value = "";
    try {
      const res = await api.get(`/api/availability?date=${date.value}`);
      rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
      fetchedAt.value = res.data.fetchedAt || "";
    } catch (e) {
      error.value = e.message || "데이터를 불러오는 중 오류가 발생했습니다.";
    } finally {
      loading.value = false;
    }
  }
  
  async function fetchRealtime() {
    realtimeLoading.value = true;
    error.value = "";
    try {
      const res = await api.get(
        `/api/availability?date=${date.value}&_ts=${Date.now()}`
      );
      rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
      fetchedAt.value = res.data.fetchedAt || "";
    } catch (e) {
      error.value = e.message || "실시간 데이터를 불러오는 중 오류가 발생했습니다.";
    } finally {
      realtimeLoading.value = false;
    }
  }
  
  // date가 바뀔 때마다 캐시된 데이터를 다시 불러옴
  watch(date, (newD, oldD) => {
    if (newD !== oldD) fetchCached();
  });
  
  onMounted(fetchCached);
  
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
  
  /* 애니메이션 */
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