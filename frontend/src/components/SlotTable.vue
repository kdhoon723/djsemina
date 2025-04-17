<script setup>
import { computed } from 'vue';

const props = defineProps({
  rooms: { type: Array, default: () => [] },
});

// 시간 슬롯 생성 (09:00 ~ 20:30)
const slots = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 9; // 09:00부터 시작
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});

// 각 방의 시간별 가용성 확인 함수
const isAvailable = (room, slot) => {
  return room.times?.some(t => t.start.slice(0, 5) === slot);
};
</script>

<template>
  <div class="overflow-x-auto border rounded-lg">
    <table class="min-w-full text-[11px] sm:text-sm">
      <thead>
        <tr class="bg-gray-100 sticky top-0">
          <th class="p-2 border text-left whitespace-nowrap w-16">방</th>
          <th
            v-for="s in slots"
            :key="s"
            class="p-2 border text-center whitespace-nowrap w-14"
          >
            {{ s }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rooms"
          :key="r.room_cd"
          class="hover:bg-sky-50 transition-colors"
        >
          <td class="border px-2 py-1 whitespace-nowrap font-medium w-16">
            {{ r.title }} ({{ r.room_cd }})
          </td>

          <td
            v-for="s in slots"
            :key="s"
            class="border h-6 sm:h-8 w-14"
            :class="{
              'bg-green-500 text-white': isAvailable(r, s),
              'bg-gray-200': !isAvailable(r, s)
            }"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>