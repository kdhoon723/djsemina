<template>
  <div class="insights">
    <header class="page-header">
      <h1 class="page-title">📊 이용 인사이트</h1>
      <p class="page-subtitle">세미나실·캐럴실 예약 데이터로 보는 재미있는 통계</p>
    </header>

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
            <button v-for="o in rangeOpts" :key="o.v" :class="['chip', { active: range === o.v }]" @click="range = o.v">{{ o.t }}</button>
          </div>
        </div>
        <div class="control-group">
          <span class="control-label">구분</span>
          <div class="chips">
            <button v-for="o in cateOpts" :key="o.v" :class="['chip', { active: cate === o.v }]" @click="cate = o.v">{{ o.t }}</button>
          </div>
        </div>
      </div>

      <!-- 탭 -->
      <div class="tabs">
        <button v-for="t in tabs" :key="t.v" :class="['tab', { active: tab === t.v }]" @click="tab = t.v">{{ t.t }}</button>
      </div>

      <!-- ===== 개요 ===== -->
      <div v-show="tab === 'overview'">
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">{{ pct(kpi.rate) }}</div><div class="kpi-label">평균 이용률</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ kpi.booked.toLocaleString() }}</div><div class="kpi-label">총 예약 슬롯</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ kpi.days }}일</div><div class="kpi-label">집계 일수</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ pct(kpi.advRate) }}</div><div class="kpi-label">전날까지 선예약</div></div>
        </div>
        <div class="fun-grid">
          <div class="fun-card">🔥 <b>{{ fun.hotDow?.dow }}요일</b> 최고 ({{ pct(fun.hotDow?.rate) }})</div>
          <div class="fun-card">😴 <b>{{ fun.coolDow?.dow }}요일</b> 한산 ({{ pct(fun.coolDow?.rate) }})</div>
          <div class="fun-card">⏰ <b>{{ fun.hotSlot?.slot }}</b> 인기 ({{ pct(fun.hotSlot?.rate) }})</div>
          <div class="fun-card">🍀 꿀자리 <b>{{ fun.coolSlot?.slot }}</b> ({{ pct(fun.coolSlot?.rate) }})</div>
          <div class="fun-card">🏆 1위 방 <b>{{ fun.topRoom?.title }}</b> ({{ pct(fun.topRoom?.rate) }})</div>
          <div class="fun-card">📅 최다 <b>{{ fun.busiestDay?.date }}</b> ({{ fun.busiestDay?.booked }}건)</div>
        </div>

        <section class="card">
          <h2 class="card-title">요일별 이용률</h2>
          <div class="bar-chart">
            <div v-for="(d, i) in byDow" :key="i" class="bar-col">
              <span class="bar-val">{{ pct(d.rate) }}</span>
              <div class="bar-track"><div class="bar" :class="{ weekend: i === 0 || i === 6 }" :style="{ height: barH(d.rate) }"></div></div>
              <span class="bar-label" :class="{ weekend: i === 0 || i === 6 }">{{ d.dow }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">시간대별 이용률</h2>
          <div class="bar-chart slots">
            <div v-for="(s, i) in bySlot" :key="i" class="bar-col">
              <div class="bar-track"><div class="bar" :style="{ height: barH(s.rate), background: heat(s.rate) }" :title="`${s.slot} · ${pct(s.rate)}`"></div></div>
              <span class="bar-label slot">{{ i % 2 === 0 ? s.slot : '' }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">언제가 제일 핫할까 <small>(요일 × 시간대)</small></h2>
          <div class="heatmap-scroll">
            <div class="heatmap" :style="{ gridTemplateColumns: `2.2rem repeat(${slots.length}, 1fr)` }">
              <div></div>
              <div v-for="(sl, i) in slots" :key="'h' + i" class="hm-htext">{{ i % 2 === 0 ? sl.slice(0, 2) : '' }}</div>
              <template v-for="(w, di) in dowOrder" :key="'r' + di">
                <div class="hm-rlabel" :class="{ weekend: w === 0 || w === 6 }">{{ DOW[w] }}</div>
                <div v-for="(sl, si) in slots" :key="di + '-' + si" class="hm-cell" :style="{ background: heat(hmRate(w, si)) }" :title="`${DOW[w]} ${sl} · ${pct(hmRate(w, si))}`"></div>
              </template>
            </div>
          </div>
          <div class="legend-row"><span>한산</span><div class="legend-grad"></div><span>붐빔</span></div>
        </section>
      </div>

      <!-- ===== 시간·추세 ===== -->
      <div v-show="tab === 'trend'">
        <section class="card">
          <h2 class="card-title">날짜별 이용률 추세 <small>(빨강 = 시험 추정기간)</small></h2>
          <svg class="trend" viewBox="0 0 1000 220" preserveAspectRatio="none">
            <line v-for="g in [0, 25, 50, 75, 100]" :key="g" class="grid" x1="0" x2="1000" :y1="200 - g * 2" :y2="200 - g * 2" />
            <rect v-for="(ex, i) in examBands" :key="'ex' + i" :x="ex.x" y="0" :width="ex.w" height="200" class="exam-band" />
            <polygon :points="trendArea" class="trend-area" />
            <polyline :points="trendLine" class="trend-line" />
          </svg>
          <div class="trend-axis"><span v-for="t in trendTicks" :key="t.x" class="trend-tick" :style="{ left: t.x + '%' }">{{ t.label }}</span></div>
        </section>

        <div class="two-col">
          <section class="card">
            <h2 class="card-title">평일 이용률 절벽 <small>(월→금)</small></h2>
            <div class="bar-chart">
              <div v-for="d in weekdayDow" :key="d.dow" class="bar-col">
                <span class="bar-val">{{ pct(d.rate) }}</span>
                <div class="bar-track"><div class="bar" :style="{ height: barH(d.rate) }"></div></div>
                <span class="bar-label">{{ d.dow }}</span>
              </div>
            </div>
          </section>
          <section class="card">
            <h2 class="card-title">주말 데드존</h2>
            <div class="stat-rows">
              <div class="stat-row"><span>평일 평균</span><b>{{ pct(weekendStats.weekday) }}</b></div>
              <div class="stat-row"><span>주말 평균</span><b>{{ pct(weekendStats.weekend) }}</b></div>
              <div class="stat-row"><span>예약 0건 주말</span><b>{{ weekendStats.zeroDays }} / {{ weekendStats.totalWeekend }}일</b></div>
              <p class="timing-note">주말은 평일의 <b>{{ weekendStats.ratio }}배</b> 수준 — 사실상 비어있어요.</p>
            </div>
          </section>
        </div>
      </div>

      <!-- ===== 방별 ===== -->
      <div v-show="tab === 'rooms'">
        <section class="card">
          <h2 class="card-title">방별 경쟁률 랭킹</h2>
          <div class="room-list">
            <div v-for="(r, i) in byRoom" :key="r.title" class="room-row">
              <span class="room-rank">{{ i + 1 }}</span>
              <span class="room-name">{{ r.title }}<small>{{ CATE_LABEL[r.cate] || r.cate }}</small></span>
              <div class="room-bar-track"><div class="room-bar" :style="{ width: pct(r.rate), background: heat(r.rate) }"></div></div>
              <span class="room-pct">{{ pct(r.rate) }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">방별 시그니처 시간대 <small>(가장 인기인 슬롯)</small></h2>
          <div class="sig-list">
            <div v-for="r in roomSignature" :key="r.title" class="sig-row">
              <span class="sig-name">{{ r.title }}</span>
              <span class="sig-peak" :style="{ left: sigPos(r.peakIdx) }">{{ r.peak }}</span>
            </div>
            <div class="sig-axis"><span v-for="h in [9, 12, 15, 18, 20]" :key="h" :style="{ left: sigPosByHour(h) }">{{ h }}시</span></div>
          </div>
          <p class="timing-note">캐럴실은 점심(12시대), 세미나실은 오후로 피크가 갈립니다.</p>
        </section>

        <section class="card">
          <h2 class="card-title">버려진 방 <small>(열렸는데 예약 0건인 날 비율)</small></h2>
          <div class="room-list">
            <div v-for="(r, i) in roomZeroDays" :key="r.title" class="room-row">
              <span class="room-rank">{{ i + 1 }}</span>
              <span class="room-name">{{ r.title }}<small>{{ CATE_LABEL[r.cate] || r.cate }}</small></span>
              <div class="room-bar-track"><div class="room-bar" :style="{ width: pct(r.rate), background: zeroHeat(r.rate) }"></div></div>
              <span class="room-pct">{{ pct(r.rate) }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- ===== 예약행동 ===== -->
      <div v-show="tab === 'behavior'">
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">{{ beh.avgHours }}h</div><div class="kpi-label">1회 평균 예약</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ beh.cap }}%</div><div class="kpi-label">3시간 제한 준수</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ beh.total?.toLocaleString() }}</div><div class="kpi-label">예약 건수(최근{{ beh.window }}일)</div></div>
          <div class="kpi-card"><div class="kpi-value">{{ beh.peakHour }}시</div><div class="kpi-label">예약 폭주 시각</div></div>
        </div>

        <section class="card">
          <h2 class="card-title">1회 예약량 분포 <small>(시스템 3시간 제한이 보임)</small></h2>
          <div class="bar-chart">
            <div v-for="b in beh.burst" :key="b.label" class="bar-col">
              <span class="bar-val">{{ b.pct }}%</span>
              <div class="bar-track"><div class="bar" :class="{ over: b.over }" :style="{ height: barHv(b.count, beh.burstMax) }"></div></div>
              <span class="bar-label">{{ b.label }}</span>
            </div>
          </div>
          <p class="timing-note">1회 예약은 대부분 1.5~2.5시간. <b>98%가 3시간 이내</b>로 제한을 지키고, 그 이상(주황)은 여러 명이 연속으로 잡은 경우예요.</p>
        </section>

        <section class="card">
          <h2 class="card-title">예약은 몇 시에 일어날까 <small>(예약 버튼을 누른 시각)</small></h2>
          <div class="bar-chart slots">
            <div v-for="h in beh.byHour" :key="h.h" class="bar-col">
              <div class="bar-track"><div class="bar" :style="{ height: barHv(h.c, beh.byHourMax), background: heat(h.c / beh.byHourMax) }" :title="`${h.h}시 · ${h.c}건`"></div></div>
              <span class="bar-label slot">{{ h.h % 3 === 0 ? h.h : '' }}</span>
            </div>
          </div>
        </section>

        <div class="two-col">
          <section class="card">
            <h2 class="card-title">예약 리드타임 <small>(얼마나 미리 잡나)</small></h2>
            <div class="bar-chart wide">
              <div v-for="l in beh.leadtime" :key="l.label" class="bar-col">
                <span class="bar-val">{{ l.c }}</span>
                <div class="bar-track"><div class="bar" :style="{ height: barHv(l.c, beh.leadMax) }"></div></div>
                <span class="bar-label tiny">{{ l.label }}</span>
              </div>
            </div>
            <p class="timing-note">대부분 <b>1시간 이내 막판</b> 예약 — 미리 잡는 사람은 드뭅니다.</p>
          </section>
          <section class="card">
            <h2 class="card-title">구분별 1회 예약량</h2>
            <div class="stat-rows">
              <div v-for="c in beh.byCate" :key="c.cate" class="stat-row">
                <span>{{ CATE_LABEL[c.cate] || c.cate }}</span>
                <b>{{ c.hours }}시간 · {{ c.bookings }}건</b>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- ===== 빈방 찾기 ===== -->
      <div v-show="tab === 'finder'">
        <section class="card">
          <h2 class="card-title">🔍 빈방 찾기 추천기 <small>(과거 통계 기반)</small></h2>
          <div class="finder-controls">
            <div class="control-group"><span class="control-label">요일</span>
              <div class="chips"><button v-for="(d, i) in DOW" :key="i" :class="['chip', { active: fDow === i }]" @click="fDow = i">{{ d }}</button></div>
            </div>
            <div class="control-group"><span class="control-label">시간</span>
              <select v-model.number="fSlot" class="finder-select">
                <option v-for="(sl, i) in slots" :key="i" :value="i">{{ sl }}</option>
              </select>
            </div>
          </div>
          <p class="finder-head">{{ DOW[fDow] }}요일 {{ slots[fSlot] }} — 빈방일 확률 순</p>
          <div class="room-list">
            <div v-for="(r, i) in finderResult" :key="r.title" class="room-row">
              <span class="room-rank">{{ i + 1 }}</span>
              <span class="room-name">{{ r.title }}<small>{{ CATE_LABEL[r.cate] || r.cate }}</small></span>
              <div class="room-bar-track"><div class="room-bar" :style="{ width: pct(r.free), background: freeHeat(r.free) }"></div></div>
              <span class="room-pct">{{ pct(r.free) }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">연속 블록 확보 확률 <small>(평일 기준)</small></h2>
          <div class="block-grid">
            <div v-for="b in blockProb" :key="b.cate" class="block-card">
              <div class="block-cate">{{ CATE_LABEL[b.cate] || b.cate }}</div>
              <div class="block-row"><span>2시간 연속</span><b>{{ pct(b.h2) }}</b></div>
              <div class="block-row"><span>4시간 연속</span><b>{{ pct(b.h4) }}</b></div>
            </div>
          </div>
          <p class="timing-note">긴 작업이라면 캐럴실이 연속 확보 확률이 높아요.</p>
        </section>
      </div>

      <!-- ===== 기록 ===== -->
      <div v-show="tab === 'records'">
        <div class="records-grid">
          <div class="record-card"><div class="rc-emoji">📈</div><div class="rc-val">{{ pct(records.maxUtil.rate) }}</div><div class="rc-label">역대 최고 이용률<br><small>{{ records.maxUtil.date }}</small></div></div>
          <div class="record-card"><div class="rc-emoji">🔥</div><div class="rc-val">{{ records.maxBooked.booked }}</div><div class="rc-label">단일일 최다 예약<br><small>{{ records.maxBooked.date }}</small></div></div>
          <div class="record-card"><div class="rc-emoji">⛔</div><div class="rc-val">{{ records.fullHouse.count }}회</div><div class="rc-label">전 방 동시 매진<br><small>최고 {{ records.fullHouse.best?.date }}</small></div></div>
          <div class="record-card"><div class="rc-emoji">⏱️</div><div class="rc-val">{{ records.longest.hours }}h</div><div class="rc-label">최장 연속 점유<br><small>{{ records.longest.room }} {{ records.longest.date }}</small></div></div>
        </div>

        <section class="card">
          <h2 class="card-title">🏅 일 최다 예약 신기록 갱신</h2>
          <div class="record-list">
            <div v-for="(r, i) in records.progression" :key="i" class="rec-row">
              <span class="rec-date">{{ r.date }}</span>
              <div class="rec-bar-track"><div class="rec-bar" :style="{ width: (r.booked / records.progression[records.progression.length - 1].booked * 100) + '%' }"></div></div>
              <span class="rec-num">{{ r.booked }}</span>
            </div>
          </div>
        </section>
      </div>

      <p class="method-note">
        ※ 이용률 = "가능했던 슬롯 중 시작 전 예약돼 사라진 비율"(KST 보정). 예약행동 지표는 5분 간격 스냅샷 차분 기반 ·
        자동 갱신 · 업데이트 {{ formatUpdated(updatedAt) }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";

const SUPA = (import.meta.env.VITE_API_BASE_URL || "").replace("/functions/v1", "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dowOrder = [1, 2, 3, 4, 5, 6, 0];
const CATE_LABEL = { C: "캐럴실", S: "세미나실", Z: "소강당" };
const rangeOpts = [{ v: "ALL", t: "전체" }, { v: "180", t: "6개월" }, { v: "90", t: "90일" }, { v: "30", t: "30일" }];
const cateOpts = [{ v: "ALL", t: "전체" }, { v: "C", t: "캐럴실" }, { v: "S", t: "세미나실" }, { v: "Z", t: "소강당" }];
const tabs = [
  { v: "overview", t: "개요" }, { v: "trend", t: "시간·추세" }, { v: "rooms", t: "방별" },
  { v: "behavior", t: "예약행동" }, { v: "finder", t: "빈방찾기" }, { v: "records", t: "기록" },
];

const loading = ref(true);
const error = ref("");
const slots = ref([]);
const rows = ref([]);
const updatedAt = ref("");
const behavior = ref(null);
const range = ref("ALL");
const cate = ref("ALL");
const tab = ref("overview");
const fDow = ref(1);
const fSlot = ref(7);

function popcount(n) { n = n >>> 0; let c = 0; while (n) { n &= n - 1; c++; } return c; }
function dowOf(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); }
function pct(r) { return ((r || 0) * 100).toFixed(r != null && r < 0.1 ? 1 : 0) + "%"; }
function barH(r) { return (8 + (r || 0) * 92).toFixed(1) + "%"; }
function barHv(v, max) { return (8 + (max ? v / max : 0) * 92).toFixed(1) + "%"; }
function heat(r) { return `rgba(30,64,175,${(0.07 + (r || 0) * 0.93).toFixed(3)})`; }
function zeroHeat(r) { return `rgba(239,68,68,${(0.2 + (r || 0) * 0.8).toFixed(3)})`; }
function freeHeat(r) { return `rgba(16,185,129,${(0.2 + (r || 0) * 0.8).toFixed(3)})`; }
function formatUpdated(s) { if (!s) return "-"; const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
function sigPos(i) { return (i / 22 * 100) + "%"; }
function sigPosByHour(h) { return ((h - 9) / 11 * 100) + "%"; }

async function rpc(fn) {
  const res = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: "{}",
  });
  if (!res.ok) throw new Error("서버 오류 " + res.status);
  return res.json();
}
async function load() {
  loading.value = true; error.value = "";
  try {
    const [facts, beh] = await Promise.all([rpc("get_booking_facts_json"), rpc("get_behavior_stats_json").catch(() => null)]);
    slots.value = facts.slots || [];
    rows.value = facts.rows || [];
    updatedAt.value = facts.updated_at;
    behavior.value = beh;
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
const filtered = computed(() => rows.value.filter((r) =>
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
const weekdayDow = computed(() => byDow.value.filter((_, i) => i >= 1 && i <= 5));
const weekendStats = computed(() => {
  let wkB = 0, wkK = 0, weB = 0, weK = 0; const weDates = new Map();
  for (const r of filtered.value) {
    const w = dowOf(r[0]); const bd = popcount(r[4]), bk = popcount(r[3]);
    if (w === 0 || w === 6) { weB += bd; weK += bk; weDates.set(r[0], (weDates.get(r[0]) || 0) + bd); }
    else { wkB += bd; wkK += bk; }
  }
  const weekday = wkK ? wkB / wkK : 0, weekend = weK ? weB / weK : 0;
  let zero = 0; for (const v of weDates.values()) if (v === 0) zero++;
  return { weekday, weekend, ratio: weekend ? (weekday / weekend).toFixed(0) : "∞", zeroDays: zero, totalWeekend: weDates.size };
});

const slotAgg = computed(() => {
  const n = slots.value.length; const bd = new Array(n).fill(0), bk = new Array(n).fill(0);
  for (const r of filtered.value) for (let s = 0; s < n; s++) { if ((r[4] >> s) & 1) bd[s]++; if ((r[3] >> s) & 1) bk[s]++; }
  return { bd, bk };
});
const bySlot = computed(() => slots.value.map((lbl, s) => { const { bd, bk } = slotAgg.value; return { slot: lbl, rate: bk[s] ? bd[s] / bk[s] : 0, booked: bd[s] }; }));

const hm = computed(() => {
  const n = slots.value.length;
  const bd = Array.from({ length: 7 }, () => new Array(n).fill(0)), bk = Array.from({ length: 7 }, () => new Array(n).fill(0));
  for (const r of filtered.value) { const w = dowOf(r[0]); for (let s = 0; s < n; s++) { if ((r[4] >> s) & 1) bd[w][s]++; if ((r[3] >> s) & 1) bk[w][s]++; } }
  return { bd, bk };
});
function hmRate(w, s) { const { bd, bk } = hm.value; return bk[w][s] ? bd[w][s] / bk[w][s] : 0; }

const byRoom = computed(() => {
  const m = new Map();
  for (const r of filtered.value) { if (!m.has(r[2])) m.set(r[2], { title: r[2], cate: r[1], b: 0, k: 0 }); const o = m.get(r[2]); o.b += popcount(r[4]); o.k += popcount(r[3]); }
  return [...m.values()].map((o) => ({ title: o.title, cate: o.cate, rate: o.k ? o.b / o.k : 0 })).sort((a, b) => b.rate - a.rate);
});
const byCate = computed(() => {
  const m = new Map();
  for (const r of filtered.value) { if (!m.has(r[1])) m.set(r[1], { b: 0, k: 0 }); const o = m.get(r[1]); o.b += popcount(r[4]); o.k += popcount(r[3]); }
  return [...m.entries()].map(([c, o]) => ({ cate: c, rate: o.k ? o.b / o.k : 0 })).sort((a, b) => b.rate - a.rate);
});

// 방별 시그니처(피크 슬롯) / 버려진 방
const roomSlotAgg = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    if (!m.has(r[2])) m.set(r[2], { cate: r[1], booked: new Array(slots.value.length).fill(0), bookable: new Array(slots.value.length).fill(0), zeroDates: 0, openDates: 0 });
    const o = m.get(r[2]); let open = false;
    for (let s = 0; s < slots.value.length; s++) { if ((r[3] >> s) & 1) { o.bookable[s]++; open = true; } if ((r[4] >> s) & 1) o.booked[s]++; }
    if (open) { o.openDates++; if (popcount(r[4]) === 0) o.zeroDates++; }
  }
  return m;
});
const roomSignature = computed(() => {
  const out = [];
  for (const [title, o] of roomSlotAgg.value) { let pk = 0, pv = -1; for (let s = 0; s < o.booked.length; s++) if (o.booked[s] > pv) { pv = o.booked[s]; pk = s; } out.push({ title, cate: o.cate, peakIdx: pk, peak: slots.value[pk] }); }
  return out.sort((a, b) => a.peakIdx - b.peakIdx);
});
const roomZeroDays = computed(() => {
  const out = [];
  for (const [title, o] of roomSlotAgg.value) out.push({ title, cate: o.cate, rate: o.openDates ? o.zeroDates / o.openDates : 0 });
  return out.sort((a, b) => b.rate - a.rate);
});

// 추세 + 시험기간 탐지
const trend = computed(() => {
  const m = new Map();
  for (const r of filtered.value) { if (!m.has(r[0])) m.set(r[0], { b: 0, k: 0 }); const o = m.get(r[0]); o.b += popcount(r[4]); o.k += popcount(r[3]); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, o]) => ({ date, rate: o.k ? o.b / o.k : 0, booked: o.b }));
});
const trendLine = computed(() => { const t = trend.value; if (t.length < 2) return ""; return t.map((p, i) => `${(i / (t.length - 1) * 1000).toFixed(1)},${(200 - p.rate * 200).toFixed(1)}`).join(" "); });
const trendArea = computed(() => { const t = trend.value; if (t.length < 2) return ""; return `0,200 ${trendLine.value} 1000,200`; });
const trendTicks = computed(() => {
  const t = trend.value; if (!t.length) return []; const seen = new Set(); const out = [];
  t.forEach((p, i) => { const ym = p.date.slice(0, 7); if (!seen.has(ym)) { seen.add(ym); out.push({ x: (i / Math.max(t.length - 1, 1) * 100).toFixed(1), label: p.date.slice(5, 7) + "월" }); } });
  return out;
});
// 평일 z-score >1.2 = 시험 추정
const examBands = computed(() => {
  const t = trend.value; if (t.length < 5) return [];
  const wk = t.filter((p) => { const w = dowOf(p.date); return w >= 1 && w <= 5 && p.rate > 0.02; });
  if (wk.length < 5) return [];
  const mean = wk.reduce((s, p) => s + p.rate, 0) / wk.length;
  const sd = Math.sqrt(wk.reduce((s, p) => s + (p.rate - mean) ** 2, 0) / wk.length) || 1;
  const bands = [];
  t.forEach((p, i) => { const w = dowOf(p.date); if (w >= 1 && w <= 5 && (p.rate - mean) / sd > 1.2) bands.push({ x: (i / (t.length - 1) * 1000).toFixed(1), w: (1000 / t.length).toFixed(1) }); });
  return bands;
});

const fun = computed(() => {
  const s = [...bySlot.value].filter((x) => x.rate > 0).sort((a, b) => b.rate - a.rate);
  const d = [...byDow.value].filter((x) => x.rate > 0).sort((a, b) => b.rate - a.rate);
  const day = [...trend.value].sort((a, b) => b.booked - a.booked);
  return { hotSlot: s[0], coolSlot: s[s.length - 1], hotDow: d[0], coolDow: d[d.length - 1], topRoom: byRoom.value[0], busiestDay: day[0] };
});

// 빈방 찾기 추천기: (요일, 슬롯, 방) 빈방률
const finderResult = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    if (dowOf(r[0]) !== fDow.value) continue;
    const open = (r[3] >> fSlot.value) & 1; if (!open) continue;
    const free = open && !((r[4] >> fSlot.value) & 1);
    if (!m.has(r[2])) m.set(r[2], { title: r[2], cate: r[1], open: 0, free: 0 });
    const o = m.get(r[2]); o.open++; if (free) o.free++;
  }
  return [...m.values()].map((o) => ({ title: o.title, cate: o.cate, free: o.open ? o.free / o.open : 0 })).sort((a, b) => b.free - a.free);
});

// 연속 블록 확보 확률 (평일, 구분별)
const blockProb = computed(() => {
  const m = new Map();
  for (const r of filtered.value) {
    const w = dowOf(r[0]); if (w < 1 || w > 5) continue;
    if (popcount(r[3]) === 0) continue;
    const freeMask = r[3] & ~r[4]; let run = 0, best = 0;
    for (let s = 0; s < slots.value.length; s++) { if ((freeMask >> s) & 1) { run++; best = Math.max(best, run); } else run = 0; }
    if (!m.has(r[1])) m.set(r[1], { cate: r[1], n: 0, h2: 0, h4: 0 });
    const o = m.get(r[1]); o.n++; if (best >= 4) o.h2++; if (best >= 8) o.h4++;
  }
  return [...m.values()].map((o) => ({ cate: o.cate, h2: o.n ? o.h2 / o.n : 0, h4: o.n ? o.h4 / o.n : 0 })).sort((a, b) => b.h2 - a.h2);
});

// 기록
const records = computed(() => {
  const t = trend.value;
  const maxUtil = [...t].sort((a, b) => b.rate - a.rate)[0] || { rate: 0, date: "-" };
  const maxBooked = [...t].sort((a, b) => b.booked - a.booked)[0] || { booked: 0, date: "-" };
  // 신기록 갱신
  const prog = []; let mx = 0;
  for (const p of t) if (p.booked > mx) { mx = p.booked; prog.push({ date: p.date, booked: p.booked }); }
  // 전 방 동시 매진: 날짜별, 모든 열린 방이 booked인 슬롯 존재
  const byDate = new Map();
  for (const r of filtered.value) { if (!byDate.has(r[0])) byDate.set(r[0], []); byDate.get(r[0]).push(r); }
  let fhCount = 0, fhBest = null, fhBestN = 0;
  for (const [date, rs] of byDate) {
    for (let s = 0; s < slots.value.length; s++) {
      let open = 0, bk = 0; for (const r of rs) { if ((r[3] >> s) & 1) { open++; if ((r[4] >> s) & 1) bk++; } }
      if (open >= 12 && open === bk) { fhCount++; if (open > fhBestN) { fhBestN = open; fhBest = { date, slot: slots.value[s], n: open }; } break; }
    }
  }
  // 최장 연속 점유 (한 방-하루의 최장 booked run)
  let longest = { hours: 0, room: "-", date: "-" };
  for (const r of filtered.value) {
    let run = 0, best = 0; for (let s = 0; s < slots.value.length; s++) { if ((r[4] >> s) & 1) { run++; best = Math.max(best, run); } else run = 0; }
    if (best > longest.hours * 2) longest = { hours: best * 0.5, room: r[2], date: r[0] };
  }
  return { maxUtil, maxBooked, progression: prog, fullHouse: { count: fhCount, best: fhBest }, longest };
});

// 예약행동 (behavior RPC)
const beh = computed(() => {
  const p = behavior.value?.payload; if (!p) return {};
  const burstRaw = p.burst || [];
  const totalB = burstRaw.reduce((s, b) => s + b[1], 0) || 1;
  const burst = burstRaw.map(([k, c]) => ({ label: k >= 7 ? "3.5h+" : (k * 0.5) + "h", count: c, pct: (100 * c / totalB).toFixed(0), over: k >= 7 }));
  const burstMax = Math.max(...burstRaw.map((b) => b[1]), 1);
  const byHour = (p.bookingByHour || []).map(([h, c]) => ({ h, c }));
  const byHourMax = Math.max(...byHour.map((x) => x.c), 1);
  const peakHour = byHour.length ? byHour.reduce((a, b) => (b.c > a.c ? b : a)).h : "-";
  const leadtime = (p.leadtime || []).map(([label, c]) => ({ label, c }));
  const leadMax = Math.max(...leadtime.map((x) => x.c), 1);
  const byCateB = Object.entries(p.byCate || {}).map(([cate, v]) => ({ cate, hours: (v.avgSlots * 0.5).toFixed(1), bookings: v.bookings })).sort((a, b) => b.bookings - a.bookings);
  return {
    avgHours: ((p.avgSlots || 0) * 0.5).toFixed(1), cap: p.capCompliancePct, total: p.totalBookings, window: behavior.value?.window_days,
    burst, burstMax, byHour, byHourMax, peakHour, leadtime, leadMax, byCate: byCateB,
  };
});
</script>

<style scoped>
.insights { max-width: 100%; }
.page-header { text-align: center; margin-bottom: 24px; }
.page-title { color: var(--primary); font-weight: 700; font-size: 1.8rem; margin: 0; }
.page-subtitle { color: var(--text-light); margin: 6px 0 0; }
.status-card { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; background: var(--card-bg); border-radius: 16px; box-shadow: var(--shadow); }

.controls { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 14px; background: var(--card-bg); padding: 14px 18px; border-radius: 14px; box-shadow: var(--shadow); }
.control-group { display: flex; align-items: center; gap: 10px; }
.control-label { font-size: 0.82rem; font-weight: 600; color: var(--text-light); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { border: 1px solid #e2e8f0; background: #fff; color: var(--text); padding: 5px 12px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; font-weight: 500; }
.chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }

.tabs { display: flex; gap: 4px; margin-bottom: 18px; overflow-x: auto; padding-bottom: 2px; }
.tab { flex: 0 0 auto; border: none; background: transparent; color: var(--text-light); padding: 9px 16px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.tab.active { background: var(--primary); color: #fff; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.kpi-card { background: var(--card-bg); border-radius: 16px; padding: 18px; text-align: center; box-shadow: var(--shadow); }
.kpi-value { font-size: 1.7rem; font-weight: 800; color: var(--primary); line-height: 1.1; }
.kpi-label { font-size: 0.78rem; color: var(--text-light); margin-top: 6px; }

.fun-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
.fun-card { background: linear-gradient(135deg, #eff6ff, #fff); border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 0.88rem; }
.fun-card b { color: var(--primary); }

.card { background: var(--card-bg); border-radius: 16px; padding: 22px; box-shadow: var(--shadow); margin-bottom: 18px; }
.card-title { font-size: 1.08rem; font-weight: 700; color: var(--text); margin: 0 0 18px; }
.card-title small { font-weight: 400; color: var(--text-light); font-size: 0.78rem; }

.bar-chart { display: flex; align-items: flex-end; gap: 10px; height: 180px; }
.bar-chart.slots { gap: 3px; }
.bar-chart.wide .bar-col { max-width: 70px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px; }
.bar-val { font-size: 0.7rem; font-weight: 700; color: var(--text); }
.bar-track { width: 100%; max-width: 46px; flex: 1; display: flex; align-items: flex-end; }
.bar { width: 100%; background: var(--primary-light); border-radius: 6px 6px 0 0; transition: height 0.4s ease; min-height: 2px; }
.bar.weekend { background: var(--accent); }
.bar.over { background: #f59e0b; }
.bar-label { font-size: 0.76rem; color: var(--text-light); font-weight: 600; }
.bar-label.weekend { color: var(--accent); }
.bar-label.slot { font-size: 0.58rem; white-space: nowrap; height: 0.9rem; line-height: 0.9rem; flex-shrink: 0; }
.bar-label.tiny { font-size: 0.6rem; }

.heatmap-scroll { overflow-x: auto; }
.heatmap { display: grid; gap: 2px; min-width: 520px; }
.hm-htext { font-size: 0.55rem; color: var(--text-light); text-align: center; }
.hm-rlabel { font-size: 0.72rem; font-weight: 600; color: var(--text-light); display: flex; align-items: center; }
.hm-rlabel.weekend { color: var(--accent); }
.hm-cell { aspect-ratio: 1; border-radius: 3px; min-height: 16px; }
.legend-row { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; font-size: 0.7rem; color: var(--text-light); }
.legend-grad { width: 120px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, rgba(30,64,175,0.07), rgba(30,64,175,1)); }

.trend { width: 100%; height: 220px; display: block; }
.trend .grid { stroke: #eef2f7; stroke-width: 1; }
.trend-line { fill: none; stroke: var(--primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
.trend-area { fill: rgba(59,130,246,0.12); }
.exam-band { fill: rgba(239,68,68,0.13); }
.trend-axis { position: relative; height: 18px; margin-top: 2px; }
.trend-tick { position: absolute; transform: translateX(-50%); font-size: 0.62rem; color: var(--text-light); }

.room-list { display: flex; flex-direction: column; gap: 8px; }
.room-row { display: grid; grid-template-columns: 1.6rem 8.5rem 1fr 3rem; align-items: center; gap: 10px; }
.room-rank { font-weight: 700; color: var(--text-light); text-align: center; font-size: 0.85rem; }
.room-name { font-size: 0.84rem; font-weight: 600; display: flex; flex-direction: column; line-height: 1.15; }
.room-name small { font-weight: 400; color: var(--text-light); font-size: 0.66rem; }
.room-bar-track { background: #f1f5f9; border-radius: 6px; height: 14px; overflow: hidden; }
.room-bar { height: 100%; border-radius: 6px; transition: width 0.4s ease; }
.room-pct { font-size: 0.8rem; font-weight: 700; color: var(--text); text-align: right; }

.sig-list { position: relative; }
.sig-row { display: grid; grid-template-columns: 6rem 1fr; align-items: center; height: 22px; }
.sig-name { font-size: 0.74rem; font-weight: 600; }
.sig-peak { position: relative; display: inline-block; transform: translateX(-50%); background: var(--primary); color: #fff; font-size: 0.6rem; padding: 1px 5px; border-radius: 999px; white-space: nowrap; }
.sig-axis { position: relative; height: 16px; margin-left: 6rem; margin-top: 4px; border-top: 1px dashed #e2e8f0; }
.sig-axis span { position: absolute; transform: translateX(-50%); font-size: 0.6rem; color: var(--text-light); top: 2px; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.stat-rows { display: flex; flex-direction: column; gap: 10px; }
.stat-row { display: flex; justify-content: space-between; font-size: 0.88rem; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
.stat-row b { color: var(--primary); }
.timing-note { font-size: 0.8rem; color: var(--text-light); margin: 14px 0 0; }
.timing-note b { color: var(--text); }

.finder-controls { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 14px; }
.finder-select { border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 10px; font-size: 0.85rem; }
.finder-head { font-weight: 700; margin: 0 0 12px; color: var(--text); }
.block-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.block-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
.block-cate { font-weight: 700; margin-bottom: 8px; color: var(--primary); }
.block-row { display: flex; justify-content: space-between; font-size: 0.84rem; padding: 3px 0; }
.block-row b { color: var(--success); }

.records-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.record-card { background: linear-gradient(135deg, #fffbeb, #fff); border: 1px solid #fde68a; border-radius: 16px; padding: 18px; text-align: center; }
.rc-emoji { font-size: 1.6rem; }
.rc-val { font-size: 1.6rem; font-weight: 800; color: #d97706; line-height: 1.2; }
.rc-label { font-size: 0.74rem; color: var(--text-light); margin-top: 4px; }
.record-list { display: flex; flex-direction: column; gap: 7px; }
.rec-row { display: grid; grid-template-columns: 5rem 1fr 2.5rem; align-items: center; gap: 10px; }
.rec-date { font-size: 0.76rem; color: var(--text-light); }
.rec-bar-track { background: #f1f5f9; border-radius: 6px; height: 13px; overflow: hidden; }
.rec-bar { height: 100%; background: linear-gradient(90deg, #fbbf24, #d97706); border-radius: 6px; }
.rec-num { font-size: 0.8rem; font-weight: 700; text-align: right; }

.method-note { font-size: 0.7rem; color: var(--text-light); text-align: center; margin: 8px 4px 0; line-height: 1.5; }

@media (max-width: 768px) {
  .kpi-grid, .records-grid { grid-template-columns: repeat(2, 1fr); }
  .fun-grid { grid-template-columns: 1fr; }
  .two-col { grid-template-columns: 1fr; }
  .room-row { grid-template-columns: 1.4rem 6.5rem 1fr 2.6rem; }
}
</style>
