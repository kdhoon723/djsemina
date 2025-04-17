<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import SlotTable from "@/components/SlotTable.vue";

const date = ref(new Date().toISOString().slice(0, 10));
const rooms = ref([]);
const loading = ref(false);
const error = ref("");
const filter = ref("ALL");     // ALL | C | S | Z
const cached = ref(false);

const fetchData = async () => {
    loading.value = true;
    error.value = "";
    try {
        const url = `/api/availability?date=${date.value}&_ts=${Date.now()}`;
        const res = await axios.get(url, {
            headers: { "Cache-Control": "no-cache" }
        });
        rooms.value = res.data.rooms || [];
        cached.value = res.data.cached || false;
    } catch (e) {
        error.value = e.message;
        console.error("API 오류:", e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchData);

// 필터 옵션
const filterOptions = [
  { label: "전체", value: "ALL" },
  { label: "캐럴실", value: "C" },
  { label: "세미나실", value: "S" },
  { label: "소강당", value: "Z" },
];

const filteredRooms = computed(() =>
    filter.value === "ALL"
        ? rooms.value
        : rooms.value.filter((r) => r.room_cd.startsWith(filter.value))
);
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1 class="app-title">대진대학교 도서관 캐럴실 예약 현황</h1>
    </header>
    
    <div class="control-panel">
      <div class="date-controls">
        <input 
          type="date" 
          v-model="date" 
          @change="fetchData" 
          class="date-picker"
        />
        <button 
          @click="fetchData" 
          class="refresh-button"
          :disabled="loading"
        >
          <span v-if="loading">로딩중...</span>
          <span v-else>새로고침</span>
        </button>
        <span v-if="cached" class="cached-label">(캐시)</span>
      </div>
      
      <div class="filter-controls">
        <button 
          v-for="option in filterOptions" 
          :key="option.value"
          @click="filter = option.value"
          :class="['filter-button', { active: filter === option.value }]"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loader">
      <div class="spinner"></div>
      <span>데이터를 불러오는 중...</span>
    </div>
    
    <div v-else-if="error" class="error-message">
      오류가 발생했습니다: {{ error }}
    </div>
    
    <div v-else-if="rooms.length === 0" class="empty-message">
      예약 가능한 방이 없습니다.
    </div>
    
    <div v-else class="room-count">
      총 {{ filteredRooms.length }}개 방 표시 중 (전체 {{ rooms.length }}개)
    </div>
    
    <SlotTable v-if="!loading && !error && rooms.length > 0" :rooms="filteredRooms" />
  </div>
</template>

<style scoped>
.app-container {
  max-width: 100%;
  padding: 0 15px;
  margin: 0 auto;
}

.app-header {
  text-align: center;
  padding: 15px 0;
  margin-bottom: 20px;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1976D2;
  margin: 0;
}

.control-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background-color: #f5f5f5;
  padding: 10px;
  border-radius: 6px;
}

.date-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-picker {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.refresh-button {
  background-color: #1976D2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
}

.refresh-button:disabled {
  background-color: #cccccc;
}

.cached-label {
  font-size: 0.8rem;
  color: #666;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.filter-button {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
}

.filter-button.active {
  background-color: #1976D2;
  color: white;
  border-color: #1976D2;
}

.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.empty-message {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.room-count {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 15px;
}

@media (max-width: 640px) {
  .control-panel {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .date-controls {
    flex-wrap: wrap;
  }
  
  .app-title {
    font-size: 1.3rem;
  }
}
</style>