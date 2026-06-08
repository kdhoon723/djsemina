<template>
  <div class="timeline-card">
    <!-- 요약 + 범례 -->
    <div class="tl-head">
      <span class="tl-summary">
        <span class="dot"></span>{{ summaryText }}
      </span>
      <div class="tl-legend">
        <span class="lg"><i class="sw avail"></i>예약 가능</span>
        <span class="lg"><i class="sw none"></i>예약 마감</span>
      </div>
    </div>

    <!-- 시간 축 -->
    <div class="tl-axis">
      <div class="tl-axis-track">
        <span v-for="h in axisHours" :key="h" class="tl-tick" :style="{ left: posPct(h * 60) + '%' }">{{ h }}</span>
        <span v-if="nowPct !== null" class="tl-now-tick" :style="{ left: nowPct + '%' }">지금</span>
      </div>
    </div>

    <!-- 방별 타임라인 -->
    <div class="tl-rows">
      <div v-for="room in rooms" :key="room.room_cd" class="tl-row">
        <div class="tl-room">
          <span class="tl-room-name">{{ shortName(room) }}</span>
          <span class="tl-room-type">{{ getRoomType(room) }}</span>
        </div>
        <div class="tl-track">
          <span v-for="h in axisHours" :key="'g' + h" class="tl-grid" :style="{ left: posPct(h * 60) + '%' }"></span>
          <span v-if="nowPct !== null" class="tl-now" :style="{ left: nowPct + '%' }"></span>
          <span v-for="(seg, i) in segments(room)" :key="i" class="tl-bar"
            :style="{ left: posPct(seg.start) + '%', width: (posPct(seg.end) - posPct(seg.start)) + '%' }"
            :title="`${fmt(seg.start)}–${fmt(seg.end)} 예약 가능`"></span>
          <span v-if="segments(room).length === 0" class="tl-nonebar">예약 마감</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  rooms: { type: Array, default: () => [] },
  date: { type: String, default: "" },
});

const START = 9 * 60;   // 09:00
const END = 21 * 60;    // 20:30 슬롯 종료
const axisHours = [9, 11, 13, 15, 17, 19, 21];

const toMin = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const posPct = (m) => ((Math.max(START, Math.min(END, m)) - START) / (END - START)) * 100;

// 연속 가능 슬롯을 하나의 막대로 병합
function segments(room) {
  const starts = [...new Set((room.times || []).map((t) => toMin(t.start)).filter((m) => !isNaN(m)))].sort((a, b) => a - b);
  const segs = [];
  for (const s of starts) {
    const last = segs[segs.length - 1];
    if (last && s === last.end) last.end = s + 30;
    else segs.push({ start: s, end: s + 30 });
  }
  return segs;
}

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const isToday = computed(() => props.date === todayStr.value);
const nowMin = computed(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
const nowPct = computed(() => {
  if (!isToday.value) return null;
  if (nowMin.value < START || nowMin.value > END) return null;
  return posPct(nowMin.value);
});

const summaryText = computed(() => {
  if (props.rooms.length === 0) return "이용 가능한 방이 없습니다";
  if (isToday.value) {
    const n = props.rooms.filter((r) => segments(r).some((s) => s.end > nowMin.value)).length;
    return n > 0 ? `지금 이용 가능 ${n}곳` : "지금 이용 가능한 방이 없습니다";
  }
  const n = props.rooms.filter((r) => segments(r).length > 0).length;
  return `이용 가능 ${n}곳`;
});

function getRoomType(room) {
  if (room.room_cd?.startsWith("C")) return "캐럴실";
  if (room.room_cd?.startsWith("S")) return "세미나실";
  if (room.room_cd?.startsWith("Z")) return "소강당";
  return "";
}
function shortName(room) {
  let t = (room.title || "").replace(/^\[.*?\]\s*/, "");
  const parts = t.split(/\s+/);
  if (t.includes("학생회관")) return parts.slice(0, 2).join(" ");
  return parts[0];
}
</script>

<style scoped>
.timeline-card { --rooml: 92px; }

.tl-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.tl-summary { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text); font-size: 1rem; }
.tl-summary .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18); }
.tl-legend { display: flex; gap: 14px; font-size: 0.78rem; color: var(--text-light); }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 14px; height: 10px; border-radius: 3px; display: inline-block; }
.sw.avail { background: linear-gradient(135deg, #34d399, #10b981); }
.sw.none { background: #eef2f7; }

.tl-axis { margin-bottom: 6px; }
.tl-axis-track { position: relative; height: 16px; margin-left: var(--rooml); }
.tl-tick { position: absolute; transform: translateX(-50%); font-size: 0.68rem; color: var(--text-light); font-weight: 600; }
.tl-now-tick { position: absolute; transform: translateX(-50%); font-size: 0.62rem; font-weight: 700; color: #fff; background: #ef4444; padding: 1px 5px; border-radius: 999px; white-space: nowrap; top: -1px; }

.tl-rows { display: flex; flex-direction: column; }
.tl-row { display: grid; grid-template-columns: var(--rooml) 1fr; align-items: center; gap: 0; padding: 5px 0; }
.tl-row:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
.tl-room { display: flex; flex-direction: column; line-height: 1.2; padding-right: 8px; min-width: 0; }
.tl-room-name { font-weight: 700; font-size: 0.86rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-room-type { font-size: 0.68rem; color: var(--text-light); }

.tl-track { position: relative; height: 30px; background: #f8fafc; border-radius: 8px; overflow: hidden; }
.tl-grid { position: absolute; top: 0; bottom: 0; width: 1px; background: #eef2f7; }
.tl-now { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 3; }

.tl-bar {
  position: absolute; top: 5px; bottom: 5px; min-width: 4px;
  background: linear-gradient(135deg, #34d399, #10b981);
  border-radius: 5px; z-index: 2;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.35);
  transition: transform 0.15s ease, filter 0.15s ease;
}
.tl-bar:hover { filter: brightness(1.05); z-index: 4; }
.tl-nonebar { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.66rem; color: var(--text-light); }

@media (max-width: 560px) {
  .timeline-card { --rooml: 64px; }
  .tl-room-name { font-size: 0.78rem; }
  .tl-room-type { font-size: 0.6rem; }
  .tl-tick { font-size: 0.6rem; }
  .tl-track { height: 26px; }
}
</style>
