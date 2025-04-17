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
          @change="fetchWithProgress"
          outlined
          dense
          hide-details
        ></v-text-field>
        <v-btn :loading="loading" @click="fetchWithProgress" color="primary">
          새로고침
        </v-btn>
      </div>
      <div class="filter-controls">
        <v-btn
          v-for="opt in filterOptions"
          :key="opt.value"
          depressed
          :color="filter === opt.value ? 'primary' : ''"
          @click="filter = opt.value"
        >
          {{ opt.label }}
        </v-btn>
      </div>
    </div>

    <!-- ▶ 데이터 영역: 로딩 중이면 큼직한 프로그레스, 완료되면 테이블 -->
    <div class="data-area">
      <v-sheet
        v-if="loading"
        class="d-flex align-center justify-center"
        height="300"
        elevation="1"
      >
        <v-progress-linear
          :value="progress"
          height="12"
          striped
          color="primary"
        >
          <template #default>
            {{ progress }}%
          </template>
        </v-progress-linear>
      </v-sheet>

      <div v-else-if="error" class="error-message">
        오류가 발생했습니다: {{ error }}
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
import { ref, computed, onMounted } from "vue";
import SlotTable from "@/components/SlotTable.vue";

const date = ref(new Date().toISOString().slice(0, 10));
const rooms = ref([]);
const loading = ref(false);
const error = ref("");
const progress = ref(0);
const filter = ref("ALL");

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

function fetchWithProgress() {
  loading.value = true;
  error.value = "";
  progress.value = 0;
  rooms.value = [];

  const es = new EventSource(
    `/api/availability-progress?date=${date.value}`
  );
  es.addEventListener("progress", (e) => {
    progress.value = Number(e.data);
  });
  es.addEventListener("done", (e) => {
    const data = JSON.parse(e.data);
    rooms.value = data.rooms;
    loading.value = false;
    es.close();
  });
  es.addEventListener("error", (e) => {
    error.value = e.data || "알 수 없는 오류";
    loading.value = false;
    es.close();
  });
}

onMounted(fetchWithProgress);
</script>

<style scoped>
.app-container { max-width: 100%; margin: 0 auto; padding: 16px; }
.app-header { text-align: center; margin-bottom: 16px; }
.app-title { color: #1976d2; font-weight: 600; }

.control-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.date-controls { display: flex; gap: 8px; }
.filter-controls { display: flex; gap: 4px; }

.data-area { min-height: 320px; } /* 프로그레스 바 위치 확보 */

.room-count { margin-bottom: 8px; font-weight: 500; }
.error-message { color: #ff5252; text-align: center; margin-top: 32px; }
.empty-message { text-align: center; margin-top: 32px; color: #888; }

@media (max-width: 640px) {
  .control-panel { flex-direction: column; gap: 12px; }
}
</style>
