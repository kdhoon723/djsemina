import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

/* ─── 설정 ─── */
const TERM_MIN = 30;
const HEADLESS = "new"; // 또는 false 로 설정하여 디버깅 시 확인
const SESSION_RENEW_INTERVAL = 25 * 60 * 1000; // 25분마다 세션 갱신
const TODAY = new Date().toISOString().slice(0, 10);

/* ─── 전역 변수 ─── */
let browser = null;
let sessionPage = null;
let sessionIntervalId = null;

/* ─── 유틸 함수 ─── */
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
  try {
    // page._requestInterceptionEnabled 는 비공식 속성이므로 사용에 주의, 또는 다른 플래그 관리 방식 사용
    if (page && !page.isClosed() && !(page._requestInterceptionEnabled === true) ) {
        await page.setRequestInterception(true);
        page._requestInterceptionEnabled = true; // 플래그 설정 (주의)
        page.on("request", (req) => {
          // 리소스 타입 확인 강화 (script는 제외)
          if (/image|font|stylesheet|media|other/.test(req.resourceType())) {
            req.abort().catch(err => {/* 이미 처리되었거나 무시해도 되는 에러 */});
          } else {
            req.continue().catch(err => {/* 이미 처리되었거나 무시해도 되는 에러 */});
          }
        });
    }
  } catch (err) {
      console.warn(`[blockAssets] Failed to set request interception: ${err.message}`);
  }
}


/**
 * 로그인 로직 분리 (재사용 위함)
 * @param {puppeteer.Page} page 로그인할 페이지 객체
 * @returns {Promise<boolean>} 로그인 성공 여부
 */
async function _performLogin(page) {
    if (!page || page.isClosed()) {
        console.error("[로그인] 실패: 페이지가 유효하지 않거나 닫혔습니다.");
        return false;
    }
    console.log("[로그인] 시도...");
    try {
        console.log("[로그인] 로그인 페이지로 이동");
        await page.goto("https://library.daejin.ac.kr/home_login_write.mir", {
          waitUntil: "networkidle2", timeout: 30000
        });

        console.log("[로그인] 아이디/비밀번호 입력 및 로그인 시도");
        await page.type("#home_login_id_login01", process.env.USER_ID);
        await page.type("#home_login_password_login01", process.env.USER_PW);
        await page.keyboard.press("Enter");

        console.log("[로그인] 로그인 완료 대기 (Navigation)");
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

        const finalUrl = page.url();
        if (finalUrl.includes("home_login_write.mir")) {
            console.error("[로그인] 실패: 로그인 후에도 로그인 페이지에 머물러 있습니다.");
            return false;
        }

        console.log("[로그인] 성공!");
        return true;

    } catch (error) {
        console.error("❌ [로그인] 중 오류 발생:", error.message);
        return false;
    }
}

/**
 * 크롤러 초기화
 */
export async function initializeCrawler() {
  if (browser) {
    console.log("이미 크롤러가 초기화되었습니다.");
    return;
  }
  console.log("🚀 [크롤러 초기화] 시작...");

  try {
    console.log("[초기화] 브라우저 실행 중...");
    browser = await puppeteer.launch({ headless: HEADLESS });
    console.log("[초기화] 세션 유지용 페이지 열기");
    sessionPage = await browser.newPage();

    sessionPage.on("dialog", (d) => {
      console.log(`[세션 페이지] 대화상자 발생: \"${d.message()}\", 수락 처리`);
      d.accept().catch(e => console.warn(`Dialog accept error: ${e.message}`));
    });

    const loginSuccess = await _performLogin(sessionPage);
    if (!loginSuccess) {
        throw new Error("크롤러 초기 로그인 실패");
    }

    console.log("[초기화] 세션 자동 갱신 설정 (25분 간격)");
    sessionIntervalId = setInterval(async () => {
      try {
        console.log("[세션] 자동 갱신 시도...");
        if (!sessionPage || sessionPage.isClosed()) {
             console.error("[세션] 자동 갱신 실패: 세션 페이지가 닫혔습니다.");
             if(sessionIntervalId) clearInterval(sessionIntervalId);
             sessionIntervalId = null;
             return;
        }
        const currentUrlBeforeRenew = sessionPage.url();
        console.log(`[세션] 갱신 전 URL: ${currentUrlBeforeRenew}`);

        if (currentUrlBeforeRenew.includes("home_login_write.mir")) {
            console.warn("[세션] 자동 갱신 전 로그아웃 감지. 재로그인 시도...");
            const reloginSuccess = await _performLogin(sessionPage);
            if (!reloginSuccess) {
                console.error("[세션] 자동 갱신 중 재로그인 실패. 갱신 중단.");
                return;
            }
            console.log("[세션] 재로그인 성공. 갱신 로직 계속 진행.");
        }

        await sessionPage.evaluate(() => {
            if (typeof home_renew_session_ajax === 'function') {
                home_renew_session_ajax();
            } else {
                console.error('home_renew_session_ajax function not found on window');
            }
        });
        await sleep(1000);
        const currentUrlAfterRenew = sessionPage.url();
        console.log(`[세션] 갱신 후 URL: ${currentUrlAfterRenew}`);

        if (currentUrlAfterRenew.includes("home_login_write.mir")) {
             console.warn("[세션] 자동 갱신 후 로그인 페이지로 이동됨. 다음 주기 재로그인 시도 예정.");
        } else if (!currentUrlAfterRenew.includes("library.daejin.ac.kr")) {
             console.warn("[세션] 자동 갱신 후 예상치 못한 페이지로 이동했을 수 있습니다.");
        } else {
            console.log("[세션] 자동 갱신 완료");
        }

      } catch (err) {
        console.error("[세션] 자동 갱신 중 오류 발생:", err.message);
        if (err.message.includes('Target closed') || err.message.includes('Session closed') || err.message.includes('Navigation failed because browser has disconnected')) {
           console.error("[세션] 브라우저 또는 페이지 연결 끊김 감지. 갱신 중지.");
           if(sessionIntervalId) clearInterval(sessionIntervalId);
           sessionIntervalId = null;
        }
      }
    }, SESSION_RENEW_INTERVAL);

    console.log("✅ [크롤러 초기화] 완료");

  } catch (error) {
    console.error("❌ [크롤러 초기화] 실패:", error);
    await closeCrawler();
    throw error;
  }
}

/**
 * 크롤러 종료
 */
export async function closeCrawler() {
  console.log("🚀 [크롤러 종료] 시작...");
  if (sessionIntervalId) {
    clearInterval(sessionIntervalId);
    sessionIntervalId = null;
    console.log("[종료] 세션 갱신 중지됨");
  }
  if (browser) {
    try {
        await browser.close();
        console.log("[종료] 브라우저 닫힘");
    } catch (e) {
        console.error("Browser close error:", e.message);
    } finally {
        browser = null;
        sessionPage = null;
    }
  } else {
      sessionPage = null;
  }
  console.log("✅ [크롤러 종료] 완료");
}


/**
 * 개별 방 크롤링
 */
async function crawlSingleRoomPage(room, dateStr, cookies) {
    let page = null;
    const startTime = Date.now();
    console.log(`[크롤링 작업 시작] 방: ${room.title} (${room.room_cd})`);

    try {
        if (!browser || !browser.isConnected()) {
             throw new Error("Browser is not connected or initialized.");
        }
        page = await browser.newPage();

        page.on('error', err => {
            console.error(`[Page Error][방 ${room.room_cd}] ${err.message}`);
        });
        page.on('pageerror', pageErr => {
             // 콘솔 에러는 경고 수준으로 로깅 변경 (너무 많을 수 있음)
             console.warn(`[Page Console Warn][방 ${room.room_cd}] ${pageErr.message}`);
        });

        await page.setCookie(...cookies);

        // --- [수정됨] blockAssets 호출 제거 (주석 처리) ---
        // await blockAssets(page);
        // ------------------------------------------------

        console.log(`[방 ${room.room_cd}] 목록 페이지 이동`);
        await page.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
            waitUntil: "domcontentloaded", timeout: 20000
        });

        const singleRoomPageUrl = page.url();
        if (singleRoomPageUrl.includes("home_login_write.mir")) {
            console.error(`❌ [크롤링 작업 실패] 방: ${room.title} (${room.room_cd}) - 페이지 이동 후 로그아웃 감지`);
            await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
            return null;
        }

        console.log(`[방 ${room.room_cd}] 날짜 재설정: ${dateStr}`);
        const dateSet = await page.evaluate((d) => {
            const inp = document.getElementById("open_btn");
            if (inp) {
                inp.value = d;
                inp.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
            } return false;
        }, dateStr);
        if (!dateSet) throw new Error("날짜 입력 필드(#open_btn)를 찾을 수 없습니다.");

        console.log(`[방 ${room.room_cd}] 날짜 변경 후 DOM 업데이트 대기 (1.5초)...`);
        await sleep(1500);

        console.log(`[방 ${room.room_cd}] 예약 링크 로딩 대기...`);
        try {
            await page.waitForFunction(
                () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0,
                { timeout: 15000 }
            );
        } catch (e) {
             console.warn(`[방 ${room.room_cd}] 해당 날짜(${dateStr})에 예약 가능한 링크를 찾지 못함 (시간 초과 또는 방 없음)`);
             await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
             return { ...room, times: [] };
        }

        console.log(`[방 ${room.room_cd}] 해당 방 링크 클릭`);
        const clicked = await page.evaluate((r) => {
            const links = [...document.querySelectorAll("a[onclick*='seminar_resv']")];
            const link = links.find((a) => a.getAttribute("onclick")?.includes(`\'${r.room_cd}\'`));
            if (link) { link.click(); return true; }
            console.error(`Link not found for room ${r.room_cd}. Available links: ${links.length}`);
            return false;
        }, room);
        if (!clicked) {
          console.warn(`[방 ${room.room_cd}] 해당 방(${room.room_cd})의 예약 링크를 찾거나 클릭할 수 없습니다.`);
          await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
          return { ...room, times: [] };
        }

        console.log(`[방 ${room.room_cd}] AJAX 로딩 대기 (#start_time)`);
        try {
            await page.waitForSelector("#start_time", { timeout: 20000 });
        } catch (e) {
            console.warn(`[방 ${room.room_cd}] #start_time 요소를 시간 내에 찾지 못함 (예약 마감 가능성)`);
            const isClosedMsg = await page.evaluate(() => document.body.innerText.includes('예약이 마감되었습니다'));
            if(isClosedMsg) console.log(`[방 ${room.room_cd}] 예약 마감됨 확인 (텍스트 기반)`);
            await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
            return { ...room, times: [] };
        }

        await sleep(1000);

        const startTimeElement = await page.$('#start_time');
        let isReservationClosed = false;
        let optionsLoaded = false;
        let totalOpt = 0;

        if (startTimeElement) {
            const startTimeText = await startTimeElement.evaluate(sel => sel.textContent || '');
            isReservationClosed = startTimeText.includes('예약이 마감되었습니다');
            optionsLoaded = await startTimeElement.evaluate(() => {
               const options = document.querySelectorAll("#start_time option");
               return options.length > 0 && Array.from(options).some(opt => /^\d{1,2}:\d{2}$/.test(opt.textContent.trim()));
            });
            totalOpt = await startTimeElement.evaluate(() => document.querySelectorAll("#start_time option").length);
        } else {
             console.warn(`[방 ${room.room_cd}] #start_time 요소를 찾을 수 없음.`);
             await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
             return { ...room, times: [] };
        }

        if (!optionsLoaded && isReservationClosed) {
             console.log(`[방 ${room.room_cd}] 예약 마감됨 (옵션 없음)`);
             await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
             return { ...room, times: [] };
        } else if (!optionsLoaded) {
            console.warn(`[방 ${room.room_cd}] 시간 옵션 로딩 확인 실패.`);
            await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
            return { ...room, times: [] };
        }

        console.log(`[방 ${room.room_cd}] 예약 옵션 수집`);
        let starts = await startTimeElement.$$eval("option", (opts) =>
          opts.map((el) => el.textContent.trim())
              .filter(t => t && /^\d{1,2}:\d{2}$/.test(t))
        );

        if (dateStr === TODAY) {
            starts = starts.filter((t) => !pastToday(t));
        }
        const times = starts.map((s) => ({ start: s, end: plus30(s) }));

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[크롤링 작업 완료] 방: ${room.title} (${room.room_cd}), 유효 시간 ${times.length}개 / 총 ${totalOpt}개 (${duration.toFixed(1)}초 소요)`);
        await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
        return { ...room, times };

    } catch (err) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`❌ [크롤링 작업 실패] 방: ${room.title} (${room.room_cd}) (${duration.toFixed(1)}초 소요)`);
        console.error(`  - 에러: ${err.name} - ${err.message}`);
        if (page && !page.isClosed()) {
            await page.close().catch(e => console.warn(`Page close error on failure: ${e.message}`));
        }
        return null;
    }
}


/**
 * 메인 크롤링 함수
 */
export async function crawl(dateStr) {
  if (!browser || !browser.isConnected() || !sessionPage || sessionPage.isClosed()) {
    console.error("크롤러 비정상 상태 감지. 초기화 상태 확인 필요.");
    throw new Error("크롤러가 초기화되지 않았거나 비정상 상태입니다.");
  }
  console.log(`🚀 [크롤] 시작: ${dateStr}`);
  const overallStartTime = Date.now();

  try {
    console.log("[크롤] 세션 페이지에서 방 목록 가져오기 시도...");
    console.log("[크롤] 세미나 목록 페이지로 이동");
    await sessionPage.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "domcontentloaded", timeout: 20000
    });

    let currentPageUrl = sessionPage.url();
    console.log(`[크롤] 현재 sessionPage URL: ${currentPageUrl}`);
    if (currentPageUrl.includes("home_login_write.mir")) {
        console.warn("[크롤] 세미나 목록 페이지 이동 실패 (로그인 페이지 감지). 재로그인 시도...");
        const reloginSuccess = await _performLogin(sessionPage);
        if (!reloginSuccess) throw new Error("세션 만료 후 재로그인 실패");

        console.log("[크롤] 재로그인 성공. 다시 세미나 목록 페이지로 이동 시도.");
        await sessionPage.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
          waitUntil: "domcontentloaded", timeout: 20000
        });
        currentPageUrl = sessionPage.url();
        console.log(`[크롤] 재시도 후 sessionPage URL: ${currentPageUrl}`);
        if (!currentPageUrl.includes("seminar_seminar_list.mir")) {
            throw new Error("재로그인 후에도 세미나 목록 페이지 이동 실패");
        }
        console.log("[크롤] 재시도 성공. 세미나 목록 페이지 로드됨.");
    }

    console.log("[크롤] 날짜 입력 필드(#open_btn) 대기...");
    try {
        await sessionPage.waitForSelector("#open_btn", { timeout: 10000 });
    } catch (error) {
        console.error("[크롤] 날짜 입력 필드(#open_btn)를 시간 내에 찾지 못했습니다.");
        const pageContentForDebug = await sessionPage.content();
        console.error("현재 페이지 내용:", pageContentForDebug.substring(0, 500) + "...");
        throw new Error("세미나 목록 페이지 로드 실패 또는 날짜 필드 없음");
    }
    console.log("[크롤] 날짜 입력 필드 확인됨.");

    console.log(`[크롤] 날짜 필터 설정: ${dateStr}`);
    const dateSet = await sessionPage.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      if (inp) { inp.value = d; inp.dispatchEvent(new Event("change", { bubbles: true })); return true; }
      return false;
    }, dateStr);
    if (!dateSet) throw new Error("[크롤] 날짜 필드 설정 실패 (evaluate 로직 오류 가능성)");

    console.log("[크롤] 날짜 변경 후 DOM 업데이트 대기 (1.5초)...");
    await sleep(1500);

    console.log("[크롤] 예약 링크 로딩 대기...");
    let rooms = [];
    try {
        await sessionPage.waitForFunction(
            () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0,
            { timeout: 15000 }
        );

        console.log("[크롤] 사용 가능한 방 목록 파싱 시도...");
        rooms = await sessionPage.$$eval("a[onclick*='seminar_resv']", (links) => {
          // $$eval 내부 로그는 필요시 활성화
          // console.log(`[$$eval 내부] 발견된 링크 수: ${links.length}`);
          const parsedRooms = links.map((a, index) => {
            const onclickAttr = a.getAttribute("onclick");
            if (!onclickAttr) return null;
            const m = onclickAttr.match(/\'[^\']*\'\s*,\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'\s*,\s*\'([^\']+)\'/);
            if (!m || m.length < 4) return null;
            return {
              cate_cd: m[2], room_cd: m[3],
              title: a.textContent?.replace(/\s+/g, " ").trim() || '제목 없음',
            };
          });
          return parsedRooms.filter(Boolean);
        });
        console.log(`[크롤] 파싱 완료 후 rooms 배열 길이: ${rooms.length}`);

    } catch (e) {
        console.warn(`[크롤] 해당 날짜(${dateStr})에 예약 가능한 방이 없거나 로딩에 실패했습니다.`);
    }

    console.log(`[크롤] 총 ${rooms.length}개 방 발견`);

    if (rooms.length === 0) {
        console.log("[크롤] 예약 가능한 방이 없으므로 크롤링 종료.");
        const duration = (Date.now() - overallStartTime) / 1000;
        console.log(`✅ [크롤] 완료: 방 없음 (${duration.toFixed(1)}초 소요)`);
        return [];
    }

    console.log(`[크롤] ${rooms.length}개 방 병렬 크롤링 시작...`);
    const cookies = await sessionPage.cookies();

    const crawlPromises = rooms.map(room => crawlSingleRoomPage(room, dateStr, cookies));
    const results = await Promise.allSettled(crawlPromises);

    const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);

    const failedCount = results.filter(result => result.status === 'rejected' || result.value === null).length;

    const duration = (Date.now() - overallStartTime) / 1000;
    console.log(`✅ [크롤] 완료: 총 ${successfulResults.length}개 방 정보 수집 성공, ${failedCount}개 실패 (${duration.toFixed(1)}초 소요)`);

    return successfulResults;

  } catch (error) {
    const duration = (Date.now() - overallStartTime) / 1000;
    console.error(`❌ [크롤] 전체 작업 실패 (${duration.toFixed(1)}초 소요):`, error);
    return [];
  }
}
