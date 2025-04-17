import { crawl } from "./crawler.js";

// ─────────────────────────────────────────────────────────────
// 실행 날짜 지정 – 반드시 YYYY-MM-DD 형식
// 예) 오늘 날짜를 자동으로 쓰고 싶으면 ↓ 주석 해제
const targetDate = new Date().toISOString().slice(0, 10);
// const targetDate = "2025-04-17";
// ─────────────────────────────────────────────────────────────

console.log(`[index.js] 시작 – 대상 날짜: ${targetDate}`);
crawl(targetDate).catch((err) => {
  console.error("[index.js] 치명적 오류", err);
});
