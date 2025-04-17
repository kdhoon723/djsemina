<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import RoomFilter from "@/components/RoomFilter.vue";
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
        // 타임스탬프 파라미터를 붙여서 매번 다른 URL로 요청 → 브라우저/프록시 캐시 무시
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
</script>

<template>
    <div class="p-4 space-y-4 max-w-screen-lg mx-auto">
        <h1 class="text-xl sm:text-2xl font-bold text-center mb-6">
            대진대학교 도서관 캐럴실 예약 현황
        </h1>
        
        <!-- 컨트롤 바 -->
        <div class="flex flex-wrap gap-3 items-center justify-between">
            <div class="flex flex-wrap gap-3 items-center">
                <input 
                    type="date" 
                    v-model="date" 
                    @change="fetchData" 
                    class="border p-1 rounded"
                />
                <button 
                    @click="fetchData" 
                    class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    :disabled="loading"
                >
                    {{ loading ? '로딩 중...' : '새로고침' }}
                </button>
                
                <span v-if="cached" class="text-xs text-gray-500">(캐시된 데이터)</span>
            </div>

            <RoomFilter v-model="filter" />
        </div>

        <!-- 상태 표시 -->
        <div v-if="loading" class="text-center text-gray-600 py-8">
            <div class="inline-block animate-spin mr-2">⏳</div> 로딩 중...
        </div>
        <div v-else-if="error" class="text-red-600 bg-red-50 p-4 rounded">
            오류 발생: {{ error }}
        </div>
        <div v-else-if="rooms.length === 0" class="text-center text-gray-600 py-8">
            예약 가능한 방이 없습니다.
        </div>

        <!-- 필터링된 결과 카운트 -->
        <div v-if="rooms.length > 0" class="text-sm text-gray-600">
            총 {{ filteredRooms.length }}개 방 표시 중 (전체 {{ rooms.length }}개)
        </div>

        <!-- 슬롯 테이블 -->
        <SlotTable v-if="!loading && !error && rooms.length > 0" :rooms="filteredRooms" />
    </div>
</template>