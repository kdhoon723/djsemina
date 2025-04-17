// backend/crawler.js

import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

/* ─── 설정 ─── */
const PARALLEL = 12;          // 동시에 열 탭 수
const TERM_MIN = 30;          // 서비스 단위(분)
const HEADLESS = "new";
const TODAY = new Date().toISOString().slice(0, 10);

/* ─── 유틸 함수 ─── */
// 시간 형식 검사용 정규식
const HHMM = /^\d{1,2}:\d{2}$/;

// 지정한 ms 만큼 대기
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 시작 시간에 TERM_MIN(30분)을 더해 종료 시간 계산
const plus30 = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:` +
         `${d.getMinutes().toString().padStart(2, "0")}`;
};

// 오늘 시간 이전 옵션은 지우기 위한 함수
const pastToday = (t) => {
  const now = new Date();
  const [h, m] = t.split(":").map(Number);
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
};

// 이미지·폰트·스타일시트 요청 차단
async function blockAssets(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) =>
    /image|font|stylesheet/.test(req.resourceType())
      ? req.abort()
      : req.continue()
  );
}

/* ─── 메인 크롤 함수 ─── */
/**
 * @param {string} dateStr  YYYY-MM-DD
 * @param {(pct: number)=>void} onProgress
 * @returns {Promise<Array<{cate_cd, room_cd, title, times}>>}
 */
export async function crawl(dateStr, onProgress = () => {}) {
  console.log(`🚀 크롤 시작: ${dateStr}`);
  onProgress(1);

  const browser = await puppeteer.launch({ headless: HEADLESS });
  try {
    // 1) 로그인
    const main = await browser.newPage();
    main.setDefaultTimeout(15000);
    await blockAssets(main);
    await main.goto("https://library.daejin.ac.kr/home_login_write.mir", {
      waitUntil: "networkidle2",
    });
    onProgress(5);

    await main.type("#home_login_id_login01", process.env.USER_ID);
    await main.type("#home_login_password_login01", process.env.USER_PW);
    await main.keyboard.press("Enter");
    main.on("dialog", (d) => d.accept());
    await main.waitForNavigation({ waitUntil: "networkidle2" });
    onProgress(10);

    // 2) 목록 페이지 + 날짜 지정
    await main.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "domcontentloaded",
    });
    await main.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      inp.value = d;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, dateStr);
    await main.waitForFunction(
      () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0
    );
    onProgress(15);

    // 3) 방 목록 파싱
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
    onProgress(20);

    // 4) 병렬 크롤 (20%~80% 구간)
    const total = rooms.length;
    let results = [];

    for (let i = 0; i < total; i += PARALLEL) {
      const chunk = rooms.slice(i, i + PARALLEL);
      const part = await Promise.all(
        chunk.map((r) => crawlRoom(browser, r, dateStr))
      );
      results.push(...part.filter(Boolean));

      // 진행률 계산: 20 + (완료 방 비율 * 60)
      const doneCount = Math.min(i + PARALLEL, total);
      const pct = 20 + Math.floor((doneCount / total) * 60);
      onProgress(pct);
    }

    // 5) 종료 직전
    await browser.close();
    onProgress(100);

    return results;
  } finally {
    await browser.close();
  }
}

/* ─── 개별 방 처리 ─── */
async function crawlRoom(browser, room, dateStr) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await blockAssets(page);

  try {
    // 리스트 페이지로 돌아가서 방 클릭
    await page.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "networkidle2",
    });
    await page.evaluate((r) => {
      const link = [...document.querySelectorAll("a[onclick*='seminar_resv']")]
        .find((a) => a.getAttribute("onclick").includes(`'${r.room_cd}'`));
      link.click();
    }, room);

    // AJAX 로딩 대기
    await page.waitForSelector("#start_time");
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const sel = document.getElementById("start_time");
        const ob = new MutationObserver(() => {
          ob.disconnect();
          resolve();
        });
        ob.observe(sel, { childList: true });
        setTimeout(() => {
          ob.disconnect();
          resolve();
        }, 2000);
      });
    });

    // 옵션 읽고 필터링
    let starts = await page.$$eval("#start_time option", (opts) =>
      opts.map((el) => el.textContent.trim())
    );
    const totalOpt = starts.length;

    starts = starts.filter((t) => HHMM.test(t));
    if (dateStr === TODAY) starts = starts.filter((t) => !pastToday(t));

    const times = starts.map((s) => ({ start: s, end: plus30(s) }));
    console.log(`  ↳ ${room.room_cd}: 옵션 ${totalOpt} → HH:MM ${starts.length}`);

    await page.close();
    return { ...room, times };
  } catch (err) {
    console.warn(`❌ ${room.room_cd}`, err.message);
    await page.close();
    return null;
  }
}
