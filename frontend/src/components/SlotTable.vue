<script setup>
import { ref } from "vue";  
const props = defineProps({
  rooms: { type: Array, default: () => [] },
});

// 시간대별로 그룹화해서 표시할 시간 슬롯 생성 (9:00-21:00, 30분 단위)
// 모바일 환경을 위해 더 작은 범위로 조정
const timeRanges = [
  { label: "오전", slots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"] },
  { label: "오후1", slots: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"] },
  { label: "오후2", slots: ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30"] },
  { label: "저녁", slots: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"] }
];

// 현재 활성화된 시간대 (기본: 오전)
const activeRange = ref(timeRanges[0]);

// 시간대 변경 함수
function changeTimeRange(range) {
  activeRange.value = range;
}

// 방 이름 가공 (짧게 만들기)
function formatRoomName(room) {
  // 이름이 너무 길면 줄임
  const title = room.title.length > 15 
    ? room.title.substring(0, 15) + '...' 
    : room.title;
  return `${title} (${room.room_cd})`;
}

// 슬롯이 예약 가능한지 확인
function isAvailable(room, slot) {
  return room.times && room.times.some(t => t.start === slot);
}
</script>

<template>
  <div class="room-filter">
    <!-- 시간대 필터 버튼 -->
    <div class="time-range-selector">
      <button 
        v-for="range in timeRanges" 
        :key="range.label"
        @click="changeTimeRange(range)"
        :class="{ active: activeRange === range }"
        class="time-range-btn"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 테이블 -->
    <div class="table-container">
      <table class="room-table">
        <thead>
          <tr>
            <th class="room-col">방</th>
            <th v-for="slot in activeRange.slots" :key="slot" class="time-col">
              {{ slot.substring(0, 5) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in props.rooms" :key="room.room_cd">
            <td class="room-name">{{ formatRoomName(room) }}</td>
            <td 
              v-for="slot in activeRange.slots" 
              :key="slot"
              class="time-slot"
              :class="{ available: isAvailable(room, slot) }"
            >
              <span v-if="isAvailable(room, slot)" class="check-icon">✓</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.room-filter {
  width: 100%;
  margin-bottom: 20px;
}

.time-range-selector {
  display: flex;
  overflow-x: auto;
  margin-bottom: 10px;
  justify-content: center;
  gap: 5px;
}

.time-range-btn {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.time-range-btn.active {
  background-color: #1976D2;
  color: white;
  border-color: #1976D2;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.room-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.room-table th, .room-table td {
  padding: 8px 6px;
  text-align: center;
  border-bottom: 1px solid #e0e0e0;
}

.room-col {
  min-width: 100px;
  text-align: left;
  position: sticky;
  left: 0;
  background-color: #f5f5f5;
  z-index: 1;
}

.time-col {
  min-width: 45px;
}

.room-name {
  text-align: left;
  font-weight: 500;
  position: sticky;
  left: 0;
  background-color: #f9f9f9;
  z-index: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time-slot {
  background-color: #f5f5f5;
  height: 30px;
}

.time-slot.available {
  background-color: #4CAF50;
  color: white;
}

.check-icon {
  font-weight: bold;
}

@media (max-width: 640px) {
  .room-table {
    font-size: 0.75rem;
  }
  
  .room-col {
    min-width: 80px;
  }
  
  .time-col {
    min-width: 40px;
  }
  
  .room-table th, .room-table td {
    padding: 6px 4px;
  }
}
</style>