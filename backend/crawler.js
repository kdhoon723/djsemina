import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

/* ─── 설정 ─── */
const PARALLEL = 12;          // 동시에 열 탭 수
const TERM_MIN = 30;         // 서비스 단위(분)
const HEADLESS = "new";
const TODAY = new Date().toISOString().slice(0, 10);

/* ─── 유틸 ─── */
const HHMM = /^\d{1,2}:\d{2}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plus30 = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};
const pastToday = (t) => {
  const now = new Date();
  const [h, m] = t.split(":").map(Number);
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
};
async function blockAssets(p) {
  await p.setRequestInterception(true);
  p.on("request", (r) =>
    /image|font|stylesheet/.test(r.resourceType()) ? r.abort() : r.continue()
  );
}

/* ─── 메인 ─── */
export async function crawl(dateStr) {
  console.log(`🚀 크롤 시작 (${dateStr}${dateStr === TODAY ? "·오늘" : ""})`);
  const br = await puppeteer.launch({ headless: HEADLESS });

  try {
    /* 로그인 */
    const main = await br.newPage();
    main.setDefaultTimeout(15000);
    await blockAssets(main);

    await main.goto("https://library.daejin.ac.kr/home_login_write.mir", {
      waitUntil: "networkidle2",
    });
    await main.type("#home_login_id_login01", process.env.USER_ID);
    await main.type("#home_login_password_login01", process.env.USER_PW);
    await main.keyboard.press("Enter");
    main.on("dialog", (d) => d.accept());
    await main.waitForNavigation({ waitUntil: "networkidle2" });
    if (main.url().includes("2faSCPwdChangeRecomm"))
      await main.goto("https://library.daejin.ac.kr/", {
        waitUntil: "networkidle2",
      });

    /* 목록 페이지 + 날짜 지정 */
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

    /* 방 정보 파싱 (정규식 4캡처) */
    const rooms = await main.$$eval("a[onclick*='seminar_resv']", (links) =>
      links.map((a) => {
        const m = a
          .getAttribute("onclick")
          .match(
            /'[^']*'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/
          );                // org      cate_cd     room_cd
        return {
          cate_cd: m[2],
          room_cd: m[3],          // ex) C03, S07, Z01
          title: a.textContent.replace(/\s+/g, " ").trim(),
        };
      })
    );
    console.log(`🔍 방 수: ${rooms.length}`);

    /* 병렬 크롤 */
    const results = [];
    for (let i = 0; i < rooms.length; i += PARALLEL) {
      const chunk = rooms.slice(i, i + PARALLEL);
      results.push(
        ...(await Promise.all(chunk.map((r) => crawlRoom(br, r, dateStr))))
      );
    }

    /* 출력 */
    console.log("\n📊 남은 예약 시간");
    results
      .filter(Boolean)
      .forEach(({ title, room_cd, times }) => {
        console.log(`🏠 ${title} (${room_cd})`);
        times.forEach(({ start, end }) =>
          console.log(`   🕒 ${start} ~ ${end}`)
        );
      });
      return results.filter(Boolean);
  } finally {
    await br.close();
  }
}

/* ─── 개별 방 처리 ─── */
async function crawlRoom(br, room, dateStr) {
  const p = await br.newPage();
  p.setDefaultTimeout(15000);
  await blockAssets(p);

  try {
    /* 목록 페이지 → 날짜 유지 → 특정 방 클릭 */
    await p.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "networkidle2",
    });
    await p.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      inp.value = d;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }, dateStr);
    await p.waitForFunction(
      () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0
    );
    const ok = await p.evaluate(({ room_cd }) => {
      const link = [...document.querySelectorAll("a[onclick*='seminar_resv']")].find(
        (a) => a.getAttribute("onclick").includes(`'${room_cd}'`)
      );
      link?.click();
      return !!link;
    }, room);
    if (!ok) throw new Error("링크 클릭 실패");

    /* AJAX 완료 대기 */
    await p.waitForSelector("#start_time");
    await p.evaluate(() => {
      return new Promise((resolve) => {
        const sel = document.getElementById("start_time");
        const ready = () =>
          [...sel.options].some((o) => /^\d{1,2}:\d{2}$/.test(o.textContent));
        if (ready()) return resolve();
        const ob = new MutationObserver(() => {
          if (ready()) {
            ob.disconnect();
            resolve();
          }
        });
        ob.observe(sel, { childList: true });
        setTimeout(() => {
          ob.disconnect();
          resolve();
        }, 1500);
      });
    });

    /* 옵션 읽기 */
    let starts = await p.$$eval("#start_time option", (o) =>
      o.map((el) => el.textContent.trim())
    );
    const total = starts.length;
    starts = starts.filter((t) => HHMM.test(t));
    if (dateStr === TODAY) starts = starts.filter((t) => !pastToday(t));

    const times = starts.map((s) => ({ start: s, end: plus30(s) }));
    console.log(
      `  ↳ ${room.room_cd}: 옵션 ${total} → HH:MM ${starts.length}`
    );

    await p.close();
    return { ...room, times };
  } catch (e) {
    console.warn(`❌ ${room.room_cd}`, e.message);
    await p.close();
    return null;
  }
}
