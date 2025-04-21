// backend/crawler.js

import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

/* ─── 설정 ─── */
const PARALLEL = 12;
const TERM_MIN = 30;
const HEADLESS = "new";
const TODAY = new Date().toISOString().slice(0, 10);

/* ─── 유틸 함수 ─── */
const HHMM = /^\d{1,2}:\d{2}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plus30 = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:` +
    `${d.getMinutes().toString().padStart(2, "0")}`;
};
const pastToday = (t) => {
  const now = new Date();
  const [h, m] = t.split(":").map(Number);
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
};
async function blockAssets(page) {
  console.log("[유틸] 이미지·폰트·스타일 차단 활성화");
  await page.setRequestInterception(true);
  page.on("request", (req) =>
    /image|font|stylesheet/.test(req.resourceType())
      ? req.abort()
      : req.continue()
  );
}

/**
 * @param {string} dateStr  YYYY-MM-DD
 * @param {(pct: number)=>void} onProgress
 */
export async function crawl(dateStr, onProgress = () => { }) {
  console.log(`🚀 [크롤] 시작: ${dateStr}`);
  onProgress(1);

  console.log("[크롤] 브라우저 실행 중...");
  const browser = await puppeteer.launch({ headless: HEADLESS });
  try {
    // 1) 로그인 단계
    console.log("[로그인] 새 페이지 열기");
    const main = await browser.newPage();
    main.setDefaultTimeout(15000);

    await blockAssets(main);

    console.log("[로그인] 로그인 페이지로 이동");
    await main.goto("https://library.daejin.ac.kr/home_login_write.mir", {
      waitUntil: "networkidle2",
    });
    onProgress(5);

    console.log("[로그인] 아이디 입력");
    await main.type("#home_login_id_login01", process.env.USER_ID);
    console.log("[로그인] 비밀번호 입력");
    await main.type("#home_login_password_login01", process.env.USER_PW);

    console.log("[로그인] 로그인 제출 (Enter)");
    await main.keyboard.press("Enter");

    console.log("[로그인] 대화상자 수락 핸들러 설정");
    main.on("dialog", (d) => {
      console.log(`[로그인] 대화상자 발생: "${d.message()}", 수락 처리`);
      d.accept();
    });

    console.log("[로그인] 네비게이션 완료 대기");
    await main.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("[로그인] 로그인 성공");
    onProgress(10);

    // 2) 날짜 지정
    console.log("[단계 2] 세미나 목록 페이지로 이동");
    await main.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "domcontentloaded",
    });
    console.log(`[단계 2] 날짜 필터 설정: ${dateStr}`);
    await main.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      inp.value = d;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, dateStr);
    await main.waitForFunction(
      () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0
    );
    console.log("[단계 2] 날짜 적용 완료, 예약 링크 있음");
    onProgress(15);

    // 3) 방 목록 파싱
    console.log("[단계 3] 사용 가능한 방 목록 파싱");
    const rooms = await main.$$eval("a[onclick*='seminar_resv']", (links) =>
      links.map((a) => {
        const m = a
          .getAttribute("onclick")
          .match(/'[^']*'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/);
        return {
          cate_cd: m[2],
          room_cd: m[3],
          title: a.textContent.replace(/\s+/g, " ").trim(),
        };
      })
    );
    await main.close();
    console.log(`[단계 3] 총 ${rooms.length}개 방 발견`);
    onProgress(20);

    // 4) 병렬 크롤링
    console.log("[단계 4] 방별 병렬 크롤 시작");
    const total = rooms.length;
    let results = [];
    for (let i = 0; i < total; i += PARALLEL) {
      const chunk = rooms.slice(i, i + PARALLEL);
      console.log(`[단계 4] ${i + 1}번 방부터 ${Math.min(i + PARALLEL, total)}번 방 크롤링`);
      const part = await Promise.all(
        chunk.map((r) => crawlRoom(browser, r, dateStr))
      );
      results.push(...part.filter(Boolean));
      const doneCount = Math.min(i + PARALLEL, total);
      const pct = 20 + Math.floor((doneCount / total) * 60);
      onProgress(pct);
    }

    // 5) 종료
    console.log("[크롤] 브라우저 닫고 결과 반환");
    await browser.close();
    onProgress(100);
    return results;
  } finally {
    await browser.close();
  }
}

// 개별 방 크롤
async function crawlRoom(browser, room, dateStr) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await blockAssets(page);

  try {
    console.log(`[방 ${room.room_cd}] 목록 페이지 이동`);
    await page.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "networkidle2",
    });
    console.log(`[방 ${room.room_cd}] 날짜 재설정: ${dateStr}`);
    await page.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      inp.value = d;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, dateStr);
    await page.waitForFunction(
      () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0
    );

    console.log(`[방 ${room.room_cd}] 해당 방 링크 클릭`);
    await page.evaluate((r) => {
      const link = [...document.querySelectorAll("a[onclick*='seminar_resv']")]
        .find((a) => a.getAttribute("onclick").includes(`'${r.room_cd}'`));
      link.click();
    }, room);

    console.log(`[방 ${room.room_cd}] AJAX 로딩 대기`);
    await page.waitForSelector("#start_time");
    await page.evaluate(() => new Promise((resolve) => {
      const sel = document.getElementById("start_time");
      const ob = new MutationObserver(() => { ob.disconnect(); resolve(); });
      ob.observe(sel, { childList: true });
      setTimeout(() => { ob.disconnect(); resolve(); }, 2000);
    }));

    console.log(`[방 ${room.room_cd}] 예약 옵션 수집`);
    let starts = await page.$$eval("#start_time option", (opts) =>
      opts.map((el) => el.textContent.trim())
    );
    const totalOpt = starts.length;
    starts = starts.filter((t) => HHMM.test(t));
    if (dateStr === TODAY) starts = starts.filter((t) => !pastToday(t));
    const times = starts.map((s) => ({ start: s, end: plus30(s) }));

    console.log(
      `↳ [방 ${room.room_cd}] 총 옵션 ${totalOpt}개 → 유효 ${starts.length}개`
    );
    await page.close();
    return { ...room, times };
  } catch (err) {
    console.warn(`[방 ${room.room_cd}] 에러 발생: ${err.message}`);
    await page.close();
    return null;
  }
}
