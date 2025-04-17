<template>
    <div class="app-container">
      <header class="app-header">
        <h1 class="app-title">대진대학교 도서관 캐럴실 예약 현황</h1>
      </header>
  
      <div class="control-panel">
        <div class="date-controls">
          <v-text-field
            v-model="date"
            type="date"
            outlined
            dense
            hide-details
            style="max-width: 150px;"
          ></v-text-field>
          <v-btn
            @click="fetchRealtime"
            :loading="realtimeLoading"
            small
            color="primary"
          >
            실시간 불러오기
          </v-btn>
        </div>
  
        <div class="info-bar">
          <span v-if="fetchedAt">
            마지막 업데이트: {{ formatTime(fetchedAt) }}
          </span>
        </div>
  
        <div class="filter-controls">
          <v-btn
            v-for="opt in filterOptions"
            :key="opt.value"
            depressed
            :color="filter === opt.value ? 'primary' : ''"
            @click="filter = opt.value"
            small
          >
            {{ opt.label }}
          </v-btn>
        </div>
      </div>
  
      <div class="data-area">
        <div v-if="loading" class="skeleton-table">
          로딩 중…
        </div>
        <div v-else-if="error" class="error-message">
          오류: {{ error }}
        </div>
        <div v-else-if="rooms.length === 0" class="empty-message">
          예약 가능한 방이 없습니다.
        </div>
        <div v-else>
          <div class="room-count">
            총 {{ filteredRooms.length }}개 방 표시 중 (전체 {{ rooms.length }}개)
          </div>
          <SlotTable :rooms="filteredRooms" />
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, watch } from "vue";
  import axios from "axios";
  import SlotTable from "@/components/SlotTable.vue";
  
  const date      = ref(new Date().toISOString().slice(0, 10));
  const rooms     = ref([]);
  const loading   = ref(false);
  const realtimeLoading = ref(false);
  const error     = ref("");
  const fetchedAt = ref("");
  const filter    = ref("ALL");
  
  const filterOptions = [
    { label: "전체", value: "ALL" },
    { label: "캐럴실", value: "C" },
    { label: "세미나실", value: "S" },
    { label: "소강당", value: "Z" },
  ];
  
  const filteredRooms = computed(() =>
    filter.value === "ALL"
      ? rooms.value
      : rooms.value.filter(r => r.room_cd.startsWith(filter.value))
  );
  
  // 캐시된 데이터 조회
  async function fetchCached() {
    loading.value = true; error.value = "";
    try {
      const res = await axios.get(`/api/availability?date=${date.value}`);
      rooms.value     = res.data.rooms;
      fetchedAt.value = res.data.fetchedAt;
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }
  
  // 실시간 불러오기 (캐시 우회)
  async function fetchRealtime() {
    realtimeLoading.value = true; error.value = "";
    try {
      const res = await axios.get(
        `/api/availability?date=${date.value}&_ts=${Date.now()}`
      );
      rooms.value     = res.data.rooms;
      fetchedAt.value = res.data.fetchedAt;
    } catch (e) {
      error.value = e.message;
    } finally {
      realtimeLoading.value = false;
    }
  }
  
  // date 변경 감지
  watch(date, (newD, oldD) => {
    if (newD !== oldD) fetchCached();
  });
  
  // 페이지 로드 시 캐시 호출
  onMounted(fetchCached);
  
  function formatTime(iso) {
    const d  = new Date(iso);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    const ss = d.getSeconds().toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  </script>
  
  <style scoped>
  .app-container { max-width: 100%; margin: 0 auto; padding: 16px; }
  .app-header   { text-align: center; margin-bottom: 16px; }
  .app-title    { color: #1976d2; font-weight: 600; }
  
  .control-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
  .date-controls { display: flex; align-items: center; gap: 8px; }
  .info-bar      { flex: 1; font-size: 0.9rem; color: #555; }
  .filter-controls{ display: flex; gap: 4px; }
  
  .data-area     { min-height: 300px; }
  .error-message { color: #ff5252; text-align: center; margin-top: 32px; }
  .empty-message { text-align: center; margin-top: 32px; color: #888; }
  .room-count    { margin-bottom: 8px; font-weight: 500; }
  .skeleton-table{ text-align: center; padding: 50px 0; color: #aaa; }
  
  @media (max-width: 640px) {
    .control-panel { flex-direction: column; align-items: stretch; }
  }
  </style>
  