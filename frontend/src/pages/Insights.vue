<template>
  <div class="insights">
    <header class="page-header">
      <h1 class="page-title">📊 이용 인사이트</h1>
      <p class="page-subtitle">세미나실·캐럴실 예약 데이터로 보는 재미있는 통계</p>
    </header>

    <!-- 로딩 / 에러 -->
    <div v-if="loading" class="status-card">
      <v-progress-circular indeterminate color="primary" />
      <p>통계 데이터를 불러오는 중...</p>
    </div>
    <div v-else-if="error" class="status-card error">
      <v-icon color="error" size="large">mdi-alert-circle</v-icon>
      <p>{{ error }}</p>
      <v-btn color="primary" variant="text" @click="load">다시 시도</v-btn>
    </div>

    <template v-else>
      <!-- 필터 -->
      <div class="controls">
        <div class="control-group">
          <span class="control-label">기간</span>
          <div class="chips">
            <button v-for="o in rangeOpts" :key="o.v"
              :class="['chip', { active: range === o.v }]" @click="range = o.v">{{ o.t }}</button>
          </div>
        </div>
        <div class="control-group">
          <span class="control-label">구분</span>
          <div class="chips">
            <button v-for="o in cateOpts" :key="o.v"
              :class="['chip', { active: cate === o.v }]" @click="cate = o.v">{{ o.t }}</button>
          </div>
        </div>
      </div>

      <!-- 핵심 지표 -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">{{ pct(kpi.rate) }}</div>
          <div class="kpi-label">평균 이용률</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ kpi.booked.toLocaleString() }}</div>
          <div class="kpi-label">총 예약 슬롯</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ kpi.days }}일</div>
          <div class="kpi-label">집계 일수</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ pct(kpi.advRate) }}</div>
          <div class="kpi-label">전날까지 선예약 비율</div>
        </div>
      </div>

      <!-- 재미있는 한 줄 -->
      <div class="fun-grid">
        <div class="fun-card">🔥 <b>{{ fun.hotDow?.dow }}요일</b>이 가장 붐벼요 ({{ pct(fun.hotDow?.rate) }})</div>
        <div class="fun-card">😴 <b>{{ fun.coolDow?.dow }}요일</b>은 한산해요 ({{ pct(fun.coolDow?.rate) }})</div>
        <div class="fun-card">⏰ <b>{{ fun.hotSlot?.slot }}</b> 시간대가 제일 인기 ({{ pct(fun.hotSlot?.rate) }})</div>
        <div class="fun-card">🍀 꿀자리 시간은 <b>{{ fun.coolSlot?.slot }}</b> ({{ pct(fun.coolSlot?.rate) }})</div>
        <div class="fun-card">🏆 경쟁률 1위 방 <b>{{ fun.topRoom?.title }}</b> ({{ pct(fun.topRoom?.rate) }})</div>
        <div class="fun-card">📅 가장 붐빈 날 <b>{{ fun.busiestDay?.date }}</b> ({{ fun.busiestDay?.booked }}건)</div>
      </div>

      <!-- 요일별 -->
      <section class="card">
        <h2 class="card-title">요일별 이용률</h2>
        <div class="bar-chart">
          <div v-for="(d, i) in byDow" :key="i" class="bar-col">
            <span class="bar-val">{{ pct(d.rate) }}</span>
            <div class="bar-track">
              <div class="bar" :class="{ weekend: i === 0 || i === 6 }" :style="{ height: barH(d.rate) }"></div>
            </div>
            <span class="bar-label" :class="{ weekend: i === 0 || i === 6 }">{{ d.dow }}</span>
          </div>
        </div>
      </section>

      <!-- 시간대별 -->
      <section class="card">
        <h2 class="card-title">시간대별 이용률</h2>
        <div class="bar-chart slots">
          <div v-for="(s, i) in bySlot" :key="i" class="bar-col">
            <div class="bar-track">
              <div class="bar" :style="{ height: barH(s.rate), background: heat(s.rate) }"
                :title="`${s.slot} · ${pct(s.rate)}`"></div>
            </div>
            <span class="bar-label slot" v-if="i % 2 === 0">{{ s.slot }}</span>
            <span class="bar-label slot" v-else>&nbsp;</span>
          </div>
        </div>
      </section>

      <!-- 히트맵 -->
      <section class="card">
        <h2 class="card-title">언제가 제일 핫할까 <small>(요일 × 시간대)</small></h2>
        <div class="heatmap-scroll">
          <div class="heatmap" :style="{ gridTemplateColumns: `2.2rem repeat(${slots.length}, 1fr)` }">
            <div class="hm-corner"></div>
            <div v-for="(sl, i) in slots" :key="'h' + i" class="hm-htext">{{ i % 2 === 0 ? sl.slice(0, 2) : '' }}</div>
            <template v-for="(w, di) in dowOrder" :key="'r' + di">
              <div class="hm-rlabel" :class="{ weekend: w === 0 || w === 6 }">{{ DOW[w] }}</div>
              <div v-for="(sl, si) in slots" :key="di + '-' + si" class="hm-cell"
                :style="{ background: heat(hmRate(w, si)) }"
                :title="`${DOW[w]} ${sl} · ${pct(hmRate(w, si))}`"></div>
            </template>
          </div>
        </div>
        <div class="legend-row">
          <span>한산</span>
          <div class="legend-grad"></div>
          <span>붐빔</span>
        </div>
      </section>

      <!-- 일별 추세 -->
      <section class="card">
        <h2 class="card-title">날짜별 이용률 추세 <small>(시험·과제 기간 스파이크)</small></h2>
        <svg class="trend" viewBox="0 0 1000 220" preserveAspectRatio="none">
          <line v-for="g in [0, 25, 50, 75, 100]" :key="g" class="grid"
            x1="0" :x2="1000" :y1="200 - g * 2" :y2="200 - g * 2" />
          <polygon :points="trendArea" class="trend-area" />
          <polyline :points="trendLine" class="trend-line" />
        </svg>
        <div class="trend-axis">
          <span v-for="t in trendTicks" :key="t.x" class="trend-tick" :style="{ left: t.x + '%' }">{{ t.label }}</span>
        </div>
      </section>

      <!-- 방별 랭킹 -->
      <section class="card">
        <h2 class="card-title">방별 경쟁률 랭킹</h2>
        <div class="room-list">
          <div v-for="(r, i) in byRoom" :key="r.title" class="room-row">
            <span class="room-rank">{{ i + 1 }}</span>
            <span class="room-name">{{ r.title }}<small>{{ CATE_LABEL[r.cate] || r.cate }}</small></span>
            <div class="room-bar-track">
              <div class="room-bar" :style="{ width: pct(r.rate), background: heat(r.rate) }"></div>
            </div>
            <span class="room-pct">{{ pct(r.rate) }}</span>
          </div>
        </div>
      </section>

      <!-- 구분별 + 선예약 -->
      <div class="two-col">
        <section class="card">
          <h2 class="card-title">구분별 이용률</h2>
          <div class="bar-chart wide">
            <div v-for="c in byCate" :key="c.cate" class="bar-col">
              <span class="bar-val">{{ pct(c.rate) }}</span>
              <div class="bar-track">
                <div class="bar" :style="{ height: barH(c.rate) }"></div>
              </div>
              <span class="bar-label">{{ CATE_LABEL[c.cate] || c.cate }}</span>
            </div>
          </div>
        </section>
        <section class="card">
          <h2 class="card-title">예약 타이밍</h2>
          <div class="timing">
            <div class="timing-bar">
              <div class="timing-seg advance" :style="{ width: pct(kpi.advRate) }">
                <span v-if="kpi.advRate > 0.12">전날 {{ pct(kpi.advRate) }}</span>
              </div>
              <div class="timing-seg sameday" :style="{ width: pct(1 - kpi.advRate) }">
                <span>당일 {{ pct(1 - kpi.advRate) }}</span>
              </div>
            </div>
            <p class="timing-note">예약의 대부분이 <b>당일</b>에 이뤄집니다 — 미리 잡는 사람은 드물어요.</p>
          </div>
        </section>
      </div>

      <p class="method-note">
        ※ 이용률 = "예약 가능했던 슬롯 중 시작 전에 예약돼 사라진 비율" (한국시간 기준 보정).
        시간이 지나 마감된 슬롯은 제외했습니다 · 6시간마다 자동 갱신 ·
        업데이트 {{ formatUpdated(updatedAt) }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const SUPA = (import.meta.env.VITE_API_BASE_URL || "").replace("/functions/v1", "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // 월~일 표시 순서
const CATE_LABEL = { C: "캐럴실", S: "세미나실", Z: "소강당" };
const rangeOpts = [{ v: "ALL", t: "전체" }, { v: "180", t: "최근 6개월" }, { v: "90", t: "최근 90일" }, { v: "30", t: "최근 30일" }];
const cateOpts = [{ v: "ALL", t: "전체" }, { v: "C", t: "캐럴실" }, { v: "S", t: "세미나실" }, { v: "Z", t: "소강당" }];

const loading = ref(true);
const error = ref("");
const slots = ref([]);
const rows = ref([]);
const updatedAt = ref("");
const range = ref("ALL");
const cate = ref("ALL");

function popcount(n) { n = n >>> 0; let c = 0; while (n) { n &= n - 1; c++; } return c; }
function dowOf(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); }
function pct(r) { return ((r || 0) * 100).toFixed(r != null && r < 0.1 ? 1 : 0) + "%"; }
function barH(r) { return (8 + (r || 0) * 92).toFixed(1) + "%"; }
function heat(r) { return `rgba(30,64,175,${(0.07 + (r || 0) * 0.93).toFixed(3)})`; }
function formatUpdated(s) { if (!s) return "-"; const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

async function load() {
  loading.value = true; error.value = "";
  try {
    const res = await fetch(`${SUPA}/rest/v1/rpc/get_booking_facts_json`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error("서버 오류 " + res.status);
    const d = await res.json();
    slots.value = d.slots || [];
    rows.value = d.rows || [];
    updatedAt.value = d.updated_at;
  } catch (e) {
    error.value = e.message || "데이터를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const cutoff = computed(() => {
  if (range.value === "ALL") return null;
  const t = new Date(); t.setDate(t.getDate() - Number(range.value));
  return t.toISOString().slice(0, 10);
});
// row: [date, cate, title, bookable, booked, advance]
const filtered = computed(() => rows.value.filter(r =>
  (cate.value === "ALL" || r[1] === cate.value) && (!cutoff.value || r[0] >= cutoff.value)
));

const kpi = computed(() => {
  let bk = 0, bd = 0, adv = 0; const dates = new Set();
  for (const r of filtered.value) { bk += popcount(r[3]); bd += popcount(r[4]); adv += popcount(r[5]); dates.add(r[0]); }
  return { bookable: bk, booked: bd, advance: adv, days: dates.size, rate: bk ? bd / bk : 0, advRate: bd ? adv / bd : 0 };
});

const byDow = computed(() => {
  const a = Array.from({ length: 7 }, () => ({ b: 0, k: 0 }));
  for (const r of filtered.value) { const w = dowOf(r[0]); a[w].b += popcount(r[4]); a[w].k += popcount(r[3]); }
  return a.map((x, i) => ({ dow: DOW[i], rate: x.k ? x.b / x.k : 0, booked: x.b }));
});

const slotAgg = computed(() => {
  const n = slots.value.length;
  const bd = new Array(n).fill(0), bk = new Array(n).fill(0);
  for (const r of filtered.value) for (let s = 0; s < n; s++) { if ((r[4] >> s) & 1) bd[s]++; if ((r[3] >> s) & 1) bk[s]++; }
  return { bd, bk };
});
const bySlot = computed(() => slots.value.map((lbl, s) => {
  const { bd, bk } = slotAgg.value;
  return { slot: lbl, rate: bk[s] ? bd[s] / bk[s] : 0, booked: bd[s] };
}));

const hm = computed(() => {
  const n = slots.value.length;
  const bd = Array.from({ length: 7 }, () => new Array(n).fill(0));
  const bk = Array.from({ length: 7 }, () => new Array(n).fill(0));
  for (const r of filtered.value) { const w = dowOf(r[0]); for (let s = 0; s < n; s++) { if ((r[4] >> s) & 1) bd[w][s]++; if ((r[3] >> s) & 1) bk[w][s]++; } }
  return { bd, bk };
});
function hmRate(w, s) { const { bd, bk } = hm.value; return bk[w][s] ? bd[w][s] / bk[w][s] : 0; }

const byRoom = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    if (!m.has(r[2])) m.set(r[2], { title: r[2], cate: r[1], b: 0, k: 0 });
    const o = m.get(r[2]); o.b += popcount(r[4]); o.k += popcount(r[3]);
  }
  return [...m.values()].map(o => ({ title: o.title, cate: o.cate, rate: o.k ? o.b / o.k : 0 }))
    .sort((a, b) => b.rate - a.rate);
});

const byCate = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    if (!m.has(r[1])) m.set(r[1], { cate: r[1], b: 0, k: 0 });
    const o = m.get(r[1]); o.b += popcount(r[4]); o.k += popcount(r[3]);
  }
  return [...m.values()].map(o => ({ cate: o.cate, rate: o.k ? o.b / o.k : 0 })).sort((a, b) => b.rate - a.rate);
});

const trend = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    if (!m.has(r[0])) m.set(r[0], { b: 0, k: 0 });
    const o = m.get(r[0]); o.b += popcount(r[4]); o.k += popcount(r[3]);
  }
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([date, o]) => ({ date, rate: o.k ? o.b / o.k : 0, booked: o.b }));
});
const trendLine = computed(() => {
  const t = trend.value; if (t.length < 2) return "";
  return t.map((p, i) => `${(i / (t.length - 1) * 1000).toFixed(1)},${(200 - p.rate * 200).toFixed(1)}`).join(" ");
});
const trendArea = computed(() => {
  const t = trend.value; if (t.length < 2) return "";
  return `0,200 ${trendLine.value} 1000,200`;
});
const trendTicks = computed(() => {
  const t = trend.value; if (!t.length) return [];
  const seen = new Set(); const out = [];
  t.forEach((p, i) => { const ym = p.date.slice(0, 7); if (!seen.has(ym)) { seen.add(ym); out.push({ x: (i / Math.max(t.length - 1, 1) * 100).toFixed(1), label: p.date.slice(5, 7) + "월" }); } });
  return out;
});

const fun = computed(() => {
  const s = [...bySlot.value].filter(x => x.rate > 0).sort((a, b) => b.rate - a.rate);
  const d = [...byDow.value].filter(x => x.rate > 0).sort((a, b) => b.rate - a.rate);
  const day = [...trend.value].sort((a, b) => b.booked - a.booked);
  return {
    hotSlot: s[0], coolSlot: s[s.length - 1],
    hotDow: d[0], coolDow: d[d.length - 1],
    topRoom: byRoom.value[0], busiestDay: day[0],
  };
});
</script>

<style scoped>
.insights { max-width: 100%; }
.page-header { text-align: center; margin-bottom: 24px; }
.page-title { color: var(--primary); font-weight: 700; font-size: 1.8rem; margin: 0; }
.page-subtitle { color: var(--text-light); margin: 6px 0 0; }

.status-card { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; background: var(--card-bg); border-radius: 16px; box-shadow: var(--shadow); }
.status-card.error { color: var(--text); }

.controls { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; background: var(--card-bg); padding: 16px 20px; border-radius: 14px; box-shadow: var(--shadow); }
.control-group { display: flex; align-items: center; gap: 10px; }
.control-label { font-size: 0.85rem; font-weight: 600; color: var(--text-light); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { border: 1px solid #e2e8f0; background: #fff; color: var(--text); padding: 5px 12px; border-radius: 999px; font-size: 0.82rem; cursor: pointer; font-weight: 500; }
.chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.kpi-card { background: var(--card-bg); border-radius: 16px; padding: 20px; text-align: center; box-shadow: var(--shadow); }
.kpi-value { font-size: 1.9rem; font-weight: 800; color: var(--primary); line-height: 1.1; }
.kpi-label { font-size: 0.8rem; color: var(--text-light); margin-top: 6px; }

.fun-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
.fun-card { background: linear-gradient(135deg, #eff6ff, #fff); border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 0.9rem; }
.fun-card b { color: var(--primary); }

.card { background: var(--card-bg); border-radius: 16px; padding: 22px; box-shadow: var(--shadow); margin-bottom: 18px; }
.card-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0 0 18px; }
.card-title small { font-weight: 400; color: var(--text-light); font-size: 0.8rem; }

.bar-chart { display: flex; align-items: flex-end; gap: 10px; height: 190px; }
.bar-chart.slots { gap: 3px; }
.bar-chart.wide .bar-col { max-width: 90px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px; }
.bar-val { font-size: 0.72rem; font-weight: 700; color: var(--text); }
.bar-track { width: 100%; max-width: 46px; flex: 1; display: flex; align-items: flex-end; }
.bar { width: 100%; background: var(--primary-light); border-radius: 6px 6px 0 0; transition: height 0.4s ease; min-height: 2px; }
.bar.weekend { background: var(--accent); }
.bar-label { font-size: 0.78rem; color: var(--text-light); font-weight: 600; }
.bar-label.weekend { color: var(--accent); }
.bar-label.slot { font-size: 0.6rem; white-space: nowrap; }

.heatmap-scroll { overflow-x: auto; }
.heatmap { display: grid; gap: 2px; min-width: 520px; }
.hm-corner { }
.hm-htext { font-size: 0.55rem; color: var(--text-light); text-align: center; }
.hm-rlabel { font-size: 0.75rem; font-weight: 600; color: var(--text-light); display: flex; align-items: center; }
.hm-rlabel.weekend { color: var(--accent); }
.hm-cell { aspect-ratio: 1; border-radius: 3px; min-height: 16px; }
.legend-row { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; font-size: 0.72rem; color: var(--text-light); }
.legend-grad { width: 120px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, rgba(30,64,175,0.07), rgba(30,64,175,1)); }

.trend { width: 100%; height: 220px; display: block; }
.trend .grid { stroke: #eef2f7; stroke-width: 1; }
.trend-line { fill: none; stroke: var(--primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
.trend-area { fill: rgba(59,130,246,0.12); }
.trend-axis { position: relative; height: 18px; margin-top: 2px; }
.trend-tick { position: absolute; transform: translateX(-50%); font-size: 0.65rem; color: var(--text-light); }

.room-list { display: flex; flex-direction: column; gap: 8px; }
.room-row { display: grid; grid-template-columns: 1.6rem 8.5rem 1fr 3rem; align-items: center; gap: 10px; }
.room-rank { font-weight: 700; color: var(--text-light); text-align: center; font-size: 0.85rem; }
.room-name { font-size: 0.85rem; font-weight: 600; display: flex; flex-direction: column; line-height: 1.15; }
.room-name small { font-weight: 400; color: var(--text-light); font-size: 0.68rem; }
.room-bar-track { background: #f1f5f9; border-radius: 6px; height: 14px; overflow: hidden; }
.room-bar { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
.room-pct { font-size: 0.8rem; font-weight: 700; color: var(--text); text-align: right; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.timing { padding-top: 8px; }
.timing-bar { display: flex; height: 40px; border-radius: 10px; overflow: hidden; font-size: 0.78rem; color: #fff; font-weight: 600; }
.timing-seg { display: flex; align-items: center; justify-content: center; }
.timing-seg.advance { background: var(--accent); }
.timing-seg.sameday { background: var(--primary); }
.timing-note { font-size: 0.82rem; color: var(--text-light); margin: 14px 0 0; }

.method-note { font-size: 0.72rem; color: var(--text-light); text-align: center; margin: 8px 4px 0; line-height: 1.5; }

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .fun-grid { grid-template-columns: 1fr; }
  .two-col { grid-template-columns: 1fr; }
  .room-row { grid-template-columns: 1.4rem 6.5rem 1fr 2.6rem; }
}
</style>
