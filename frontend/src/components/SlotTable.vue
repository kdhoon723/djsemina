<template>
    <div class="table-container">
      <table class="room-table">
        <thead>
          <tr>
            <th class="room-col">방</th>
            <th
              v-for="slot in slots"
              :key="slot"
              class="time-col"
            >
              {{ slot }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in props.rooms" :key="room.room_cd">
            <!-- 변경: td.room-name에도 sticky 적용 -->
            <td class="room-name">{{ shortName(room) }}</td>
            <td
              v-for="slot in slots"
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
  </template>
  
  <script setup>
  import { defineProps } from 'vue';
  
  const props = defineProps({
    rooms: { type: Array, default: () => [] }
  });
  
  // 09:00~20:30 30분 단위 슬롯 생성
  const slots = Array.from({ length: (20 - 9 + 1) * 2 }, (_, i) => {
    const hour = Math.floor((9 * 2 + i) / 2);
    const minute = (i % 2) * 30;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  });
  
  // 예약 가능 여부
  function isAvailable(room, slot) {
    return room.times?.some(t => t.start === slot);
  }
  
  // 짧은 방 이름 생성
  function shortName(room) {
    // 1) [카테고리] 제거
    let t = room.title.replace(/^\[.*?\]\s*/, '');
    const parts = t.split(/\s+/);
    // 2) 소강당(학생회관)인 경우 학생회관 + 호수 두 단어로
    if (t.includes('학생회관')) {
      return parts.slice(0, 2).join(' ');
    }
    // 3) 그 외는 첫 단어만
    return parts[0];
  }
  </script>
  
  <style scoped>
  .table-container {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e0e0e0;
  }
  
  .room-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  
  .room-table th,
  .room-table td {
    padding: 8px 6px;
    text-align: center;
    border-bottom: 1px solid #e0e0e0;
  }
  
  /* 방 열 헤더 */
  .room-col {
    min-width: 100px;
    background-color: #f5f5f5;
    position: sticky;
    left: 0;
    z-index: 2;
  }
  
  /* 방 이름 셀(본문)에도 sticky 적용 */
  .room-name {
    min-width: 100px;
    background-color: #f5f5f5;
    position: sticky;
    left: 0;
    z-index: 1;
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .time-col {
    min-width: 45px;
    background-color: #fafafa;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .time-slot {
    height: 28px;
    background-color: #f5f5f5;
  }
  
  .time-slot.available {
    background-color: #4caf50;
    color: white;
  }
  
  .check-icon {
    font-weight: bold;
  }
  
  @media (max-width: 640px) {
    .room-col,
    .room-name { min-width: 80px; }
    .time-col { min-width: 40px; }
    .room-table { font-size: 0.75rem; }
  }
  </style>
  