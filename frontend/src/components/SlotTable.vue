<template>
    <div class="table-container">
      <table class="room-table">
        <thead>
          <tr>
            <th class="room-col">시설명</th>
            <th
              v-for="slot in slots"
              :key="slot"
              class="time-col"
            >
              {{ formatTimeSlot(slot) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in props.rooms" :key="room.room_cd" class="room-row">
            <td class="room-name">
              <div class="room-info">
                <div class="room-title">{{ shortName(room) }}</div>
                <div class="room-detail" v-tooltip="room.title">{{ getRoomType(room) }}</div>
              </div>
            </td>
            <td
              v-for="slot in slots"
              :key="slot"
              class="time-slot"
              :class="{ available: isAvailable(room, slot) }"
            >
              <div v-if="isAvailable(room, slot)" class="available-indicator">
                <v-icon size="small" class="check-icon">mdi-check</v-icon>
              </div>
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
  
  // 시간 슬롯 표시 형식 변경
  function formatTimeSlot(time) {
    return time;
  }
  
  // 방 유형 가져오기
  function getRoomType(room) {
    if (room.room_cd.startsWith('C')) return '캐럴실';
    if (room.room_cd.startsWith('S')) return '세미나실';
    if (room.room_cd.startsWith('Z')) return '소강당';
    return '';
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
    border-radius: 8px;
    background-color: var(--card-bg);
  }
  
  .room-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.85rem;
  }
  
  .room-table th,
  .room-table td {
    padding: 10px 6px;
    text-align: center;
  }
  
  /* 테이블 헤더 */
  .room-table thead tr {
    background-color: #f8fafc;
  }
  
  .room-table th {
    font-weight: 600;
    color: var(--secondary);
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }
  
  /* 방 열 헤더 */
  .room-col {
    min-width: 110px;
    background-color: #f8fafc;
    position: sticky;
    left: 0;
    z-index: 2;
    text-align: left;
    padding-left: 16px;
  }
  
  /* 방 이름 셀(본문)에도 sticky 적용 */
  .room-name {
    min-width: 110px;
    background-color: white;
    position: sticky;
    left: 0;
    z-index: 1;
    text-align: left;
    padding-left: 16px;
    border-right: 1px solid #f1f5f9;
  }
  
  .room-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .room-title {
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .room-detail {
    font-size: 0.75rem;
    color: var(--text-light);
  }
  
  .time-col {
    min-width: 45px;
    background-color: #f8fafc;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .time-slot {
    height: 32px;
    background-color: #f9fafb;
    border-bottom: 1px solid #f1f5f9;
  }
  
  .room-row:hover .time-slot {
    background-color: #f1f5f9;
  }
  
  .room-row:hover .room-name {
    background-color: #f8fafc;
  }
  
  .time-slot.available {
    background-color: rgba(16, 185, 129, 0.15);
  }
  
  .room-row:hover .time-slot.available {
    background-color: rgba(16, 185, 129, 0.25);
  }
  
  .available-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  
  .check-icon {
    color: var(--success);
  }
  
  @media (max-width: 640px) {
    .room-col,
    .room-name { min-width: 90px; }
    .time-col { min-width: 40px; }
    .room-table { font-size: 0.75rem; }
  }
  </style>