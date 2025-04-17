<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";

const date = ref(new Date().toISOString().slice(0, 10));
const rooms = ref([]);
const loading = ref(false);
const error = ref("");
const filter = ref("ALL");     // ALL | C | S | Z
const cached = ref(false);

// 필터 옵션
const filterOptions = [
  { title: '전체', value: 'ALL' },
  { title: '캐럴실', value: 'C' },
  { title: '세미나실', value: 'S' },
  { title: '소강당', value: 'Z' },
];

const fetchData = async () => {
    loading.value = true;
    error.value = "";
    try {
        const url = `/api/availability?date=${date.value}&_ts=${Date.now()}`;
        const res = await axios.get(url, {
            headers: { "Cache-Control": "no-cache" }
        });
        console.log("[API 응답]", res.data);
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

const filteredRooms = computed(() =>
    filter.value === "ALL"
        ? rooms.value
        : rooms.value.filter((r) => r.room_cd.startsWith(filter.value))
);

// 시간 슬롯 생성 (09:00 ~ 20:30)
const slots = computed(() => {
  return Array.from({ length: 24 }, (_, i) => {
    const h = Math.floor(i / 2) + 9; // 09:00부터 시작
    const m = i % 2 ? "30" : "00";
    return `${String(h).padStart(2, "0")}:${m}`;
  });
});

// 시간대가 예약 가능한지 확인하는 함수
const isAvailable = (room, timeSlot) => {
  return room.times && room.times.some(t => t.start === timeSlot);
};
</script>

<template>
  <v-card class="mb-6">
    <v-card-title class="text-h5 text-center">
      대진대학교 도서관 캐럴실 예약 현황
    </v-card-title>
    
    <v-card-text>
      <v-row align="center" no-gutters>
        <v-col cols="12" sm="auto">
          <v-menu 
            v-model="menu"
            :close-on-content-click="false"
            transition="scale-transition"
            offset-y
          >
            <template v-slot:activator="{ props }">
              <div class="d-flex align-center">
                <v-text-field
                  v-model="date"
                  label="날짜 선택"
                  prepend-icon="mdi-calendar"
                  readonly
                  v-bind="props"
                  density="compact"
                  hide-details
                  class="me-2"
                ></v-text-field>
                
                <v-btn 
                  color="primary" 
                  @click="fetchData"
                  :loading="loading"
                  :disabled="loading"
                  variant="tonal"
                >
                  <v-icon left>mdi-refresh</v-icon>
                  새로고침
                </v-btn>
              </div>
            </template>
            <v-date-picker v-model="date" @update:model-value="menu = false; fetchData()"></v-date-picker>
          </v-menu>
          
          <span v-if="cached" class="text-caption text-grey">(캐시된 데이터)</span>
        </v-col>
        
        <v-col cols="12" sm="auto" class="ms-sm-auto mt-2 mt-sm-0">
          <v-chip-group
            v-model="filter"
            mandatory
          >
            <v-chip
              v-for="item in filterOptions"
              :key="item.value"
              :value="item.value"
              filter
            >
              {{ item.title }}
            </v-chip>
          </v-chip-group>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <!-- 로딩 상태 표시 -->
  <v-overlay
    :model-value="loading"
    class="align-center justify-center"
  >
    <v-progress-circular
      indeterminate
      color="primary"
      size="64"
    ></v-progress-circular>
  </v-overlay>

  <!-- 에러 상태 -->
  <v-alert
    v-if="error"
    type="error"
    variant="tonal"
    class="mb-4"
  >
    {{ error }}
  </v-alert>

  <v-alert
    v-if="!loading && !error && rooms.length === 0"
    type="info"
    variant="tonal"
    class="mb-4"
  >
    예약 가능한 방이 없습니다.
  </v-alert>

  <!-- 필터링된 결과 카운트 -->
  <v-sheet v-if="rooms.length > 0" class="mb-4 text-body-2 text-medium-emphasis">
    총 {{ filteredRooms.length }}개 방 표시 중 (전체 {{ rooms.length }}개)
  </v-sheet>

  <!-- 슬롯 테이블 -->
  <v-card v-if="!loading && !error && rooms.length > 0">
    <div class="table-responsive">
      <v-table density="compact" fixed-header height="500px">
        <thead>
          <tr>
            <th class="text-left">방</th>
            <th v-for="s in slots" :key="s" class="text-center" width="70">
              {{ s }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filteredRooms" :key="r.room_cd">
            <td class="font-weight-medium">{{ r.title }} ({{ r.room_cd }})</td>
            <td 
              v-for="s in slots" 
              :key="s" 
              class="text-center" 
              :class="isAvailable(r, s) ? 'bg-success text-white' : 'bg-grey-lighten-3'"
            >
              <v-icon v-if="isAvailable(r, s)" size="small" color="white">
                mdi-check
              </v-icon>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </v-card>
</template>

<style scoped>
.table-responsive {
  overflow-x: auto;
}
</style>