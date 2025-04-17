<script setup>
// ⚙️ props 선언 및 전체 rooms 배열 출력
const props = defineProps({
  rooms: { type: Array, default: () => [] },
});
console.log("🛠 DEBUG rooms:", props.rooms);

// ⚙️ 첫 번째 방의 times 배열 출력
console.log("🛠 DEBUG first room times:", props.rooms[0]?.times);

// ⚙️ slots 배열 생성 및 출력
const slots = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 9; // 09:00부터 시작
  const m = i % 2 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
});
console.log("🛠 DEBUG slots:", slots);
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
          v-for="r in props.rooms"
          :key="r.room_cd"
          class="hover:bg-sky-50 transition-colors"
        >
          <td class="border px-2 py-1 whitespace-nowrap font-medium w-16">
            {{ r.room_cd }}
          </td>

          <td
            v-for="s in slots"
            :key="s"
            class="border h-6 sm:h-8 w-14"
            :class="{
              'bg-green-500 text-white': r.times.some(t => {
                // ⚙️ 각 매칭 결과도 로그로 함께 찍어 봅니다
                const match = t.start.slice(0,5) === s;
                console.log(`🛠 matching ${t.start} → ${s}:`, match);
                return match;
              }),
              'bg-gray-200': !r.times.some(t => t.start.slice(0,5) === s)
            }"
          />
        </tr>
      </tbody>
    </table>
  </div>
</template>
