<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import RoomFilter from "@/components/RoomFilter.vue";
import SlotTable from "@/components/SlotTable.vue";

const date = ref(new Date().toISOString().slice(0, 10));
const rooms = ref([]);
const loading = ref(false);
const error = ref("");
const filter = ref("ALL");          // ALL | C | S | Z

const fetchData = async () => {
    loading.value = true;
    error.value = "";
    try {
        // 타임스탬프 파라미터를 붙여서 매번 다른 URL로 요청 → 브라우저/프록시 캐시 무시
        const url = `/api/availability?date=${date.value}&_ts=${Date.now()}`;
        const res = await axios.get(url, {
            headers: { "Cache-Control": "no-cache" }
        });
        console.log("[API 응답]", res.data);
        rooms.value = res.data.rooms ?? [];
    } catch (e) {
        error.value = e.message;
        console.error(e);
    } finally {
        loading.value = false;
    }
};

onMounted(fetchData);

const filteredRooms = computed(() =>
    filter.value === "ALL"
        ? rooms.value
        : rooms.value.filter((r) => r.cate_cd === filter.value),
);
</script>

<template>
    <div class="p-4 space-y-4 max-w-screen-lg mx-auto">
        <!-- 컨트롤 바 -->
        <div class="flex flex-wrap gap-3 items-center">
            <input type="date" v-model="date" @change="fetchData" class="border p-1 rounded" />
            <button @click="fetchData" class="bg-blue-600 text-white px-3 py-1 rounded">
                새로고침
            </button>

            <RoomFilter v-model="filter" />
        </div>

        <!-- 상태 표시 -->
        <div v-if="loading" class="text-center text-gray-600">로딩 중…</div>
        <div v-else-if="error" class="text-red-600">{{ error }}</div>

        <!-- 슬롯 테이블 -->
        <SlotTable v-else :rooms="filteredRooms" />
    </div>
</template>
