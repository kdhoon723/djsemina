<template>
    <div class="app-container">
        <header class="app-header">
            <h1 class="app-title">대진대학교 도서관 예약 현황</h1>
        </header>

        <div class="control-panel">
            <div class="date-controls">
                <v-text-field v-model="date" type="date" outlined dense hide-details
                    style="max-width: 150px;"></v-text-field>
                <v-btn @click="fetchRealtime" :loading="realtimeLoading" small color="primary">
                    실시간 불러오기
                </v-btn>
            </div>

            <div class="info-bar">
                <span v-if="fetchedAt">
                    마지막 업데이트: {{ formatTime(fetchedAt) }}
                </span>
            </div>

            <div class="filter-controls">
                <v-btn v-for="opt in filterOptions" :key="opt.value" depressed
                    :color="filter === opt.value ? 'primary' : ''" @click="filter = opt.value" small>
                    {{ opt.label }}
                </v-btn>
            </div>
        </div>

        <div class="data-area">
            <div v-if="loading" class="skeleton-table">
                로딩 중…
            </div>
            <div v-else-if="error" class="error-message">
                오류: {{ error }}
            </div>
            <div v-else-if="roomList.length === 0" class="empty-message">
                예약 가능한 방이 없습니다.
            </div>
            <div v-else>
                <div class="room-count">
                    총 {{ filteredRooms.length }}개 방 표시 중 (전체 {{ roomList.length }}개)
                </div>
                <SlotTable :rooms="filteredRooms" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import api from "@/api.js";            // axios 인스턴스
import SlotTable from "@/components/SlotTable.vue";

const date = ref(new Date().toISOString().slice(0, 10));
const rooms = ref([]);
const loading = ref(false);
const realtimeLoading = ref(false);
const error = ref("");
const fetchedAt = ref("");
const filter = ref("ALL");

const filterOptions = [
    { label: "전체", value: "ALL" },
    { label: "캐럴실", value: "C" },
    { label: "세미나실", value: "S" },
    { label: "소강당", value: "Z" },
];

// rooms 값이 배열이 아니면 빈 배열로 대체
const roomList = computed(() =>
    Array.isArray(rooms.value) ? rooms.value : []
);

// 필터링 시에도 안전하게 처리
const filteredRooms = computed(() => {
    const arr = roomList.value;
    return filter.value === "ALL"
        ? arr
        : arr.filter(r => r.room_cd.startsWith(filter.value));
});

async function fetchCached() {
    loading.value = true;
    error.value = "";
    try {
        const res = await api.get(`/api/availability?date=${date.value}`);
        rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
        fetchedAt.value = res.data.fetchedAt || "";
    } catch (e) {
        error.value = e.message;
    } finally {
        loading.value = false;
    }
}

async function fetchRealtime() {
    realtimeLoading.value = true;
    error.value = "";
    try {
        const res = await api.get(
            `/api/availability?date=${date.value}&_ts=${Date.now()}`
        );
        rooms.value = Array.isArray(res.data.rooms) ? res.data.rooms : [];
        fetchedAt.value = res.data.fetchedAt || "";
    } catch (e) {
        error.value = e.message;
    } finally {
        realtimeLoading.value = false;
    }
}

// date가 바뀔 때마다 캐시된 데이터를 다시 불러옴
watch(date, (newD, oldD) => {
    if (newD !== oldD) fetchCached();
});

onMounted(fetchCached);

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}
</script>

<style scoped>
.app-container {
    max-width: 100%;
    margin: 0 auto;
    padding: 16px;
}

.app-header {
    text-align: center;
    margin-bottom: 16px;
}

.app-title {
    color: #1976d2;
    font-weight: 600;
}

.control-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.date-controls {
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-bar {
    flex: 1;
    font-size: 0.9rem;
    color: #555;
}

.filter-controls {
    display: flex;
    gap: 4px;
}

.data-area {
    min-height: 300px;
}

.error-message {
    color: #ff5252;
    text-align: center;
    margin-top: 32px;
}

.empty-message {
    text-align: center;
    margin-top: 32px;
    color: #888;
}

.room-count {
    margin-bottom: 8px;
    font-weight: 500;
}

.skeleton-table {
    text-align: center;
    padding: 50px 0;
    color: #aaa;
}

@media (max-width: 640px) {
    .control-panel {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>