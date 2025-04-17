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
            <td class="room-name">{{ formatRoomName(room) }}</td>
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
    rooms: {
      type: Array,
      default: () => [],
    }
  });
  
  // 09:00 부터 20:30 까지 30분 단위 슬롯 생성
  const slots = Array.from({ length: (20 - 9 + 1) * 2 }, (_, i) => {
    const hour = Math.floor((9 * 2 + i) / 2);
    const minute = (i % 2) * 30;
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${hh}:${mm}`;
  });
  
  // 슬롯이 예약 가능한지
  function isAvailable(room, slot) {
    return room.times?.some(t => t.start === slot);
  }
  
  // 방 이름을 "[캐럴실] 캐럴1실 캐럴실 ... (C01)" → "캐럴1실 (C01)" 처럼 압축
  function formatRoomName(room) {
    // 1) 제목에서 맨 앞의 [카테고리] 제거
    let title = room.title.replace(/^\[.*?\]\s*/, '');
    // 2) 너무 길면 10자 정도로 자르기
    if (title.length > 10) {
      title = title.slice(0, 10) + '…';
    }
    return `${title} (${room.room_cd})`;
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
  
  .room-table th, .room-table td {
    padding: 8px 6px;
    text-align: center;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .room-col {
    min-width: 120px;
    text-align: left;
    position: sticky;
    left: 0;
    background-color: #f5f5f5;
    z-index: 2;
  }
  
  .time-col {
    min-width: 45px;
    background-color: #fafafa;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .room-name {
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    .room-col { min-width: 80px; }
    .time-col { min-width: 40px; }
    .room-table { font-size: 0.75rem; }
  }
  </style>
  