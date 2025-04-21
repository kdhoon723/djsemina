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
  // console.log("[유틸] 이미지·폰트·스타일 차단 활성화"); // 로그 간소화
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (/image|font|stylesheet/.test(req.resourceType())) {
        req.abort().catch(err => console.warn(`[blockAssets] Abort failed: ${err.message}`)); // Abort 실패 에러 처리
      } else {
        req.continue().catch(err => console.warn(`[blockAssets] Continue failed: ${err.message}`)); // Continue 실패 에러 처리
      }
    });
  } catch (err) {
      console.warn(`[blockAssets] Failed to set request interception: ${err.message}`);
      // 이미 interception이 설정되었거나 페이지가 닫힌 경우 발생 가능
  }
}

/**
 * 크롤러 초기화: 브라우저 실행, 로그인, 세션 유지 시작
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
    sessionPage.setDefaultTimeout(30000); // 타임아웃 증가

    // 로그인 대화상자 자동 수락 설정 (기존 방식 유지)
    sessionPage.on("dialog", (d) => {
      console.log(`[세션 페이지] 대화상자 발생: "${d.message()}", 수락 처리`);
      d.accept().catch(e => console.warn(`Dialog accept error: ${e.message}`)); // Dialog 에러 처리
    });

    console.log("[초기화] 로그인 페이지로 이동");
    await sessionPage.goto("https://library.daejin.ac.kr/home_login_write.mir", {
      waitUntil: "networkidle2", // networkidle2 대기
    });

    console.log("[초기화] 아이디/비밀번호 입력 및 로그인 시도");
    await sessionPage.type("#home_login_id_login01", process.env.USER_ID);
    await sessionPage.type("#home_login_password_login01", process.env.USER_PW);
    await sessionPage.keyboard.press("Enter");

    console.log("[초기화] 로그인 완료 대기 (기존 방식 복원)");
    // waitForSelector 대신 waitForNavigation 사용 (사용자 요청)
    await sessionPage.waitForNavigation({ waitUntil: "networkidle2" });
    console.log("[초기화] 로그인 성공 (Navigation 완료)");

    console.log("[초기화] 세션 자동 갱신 설정 (25분 간격)");
    sessionIntervalId = setInterval(async () => {
      try {
        console.log("[세션] 자동 갱신 시도...");
        // 세션 페이지가 닫히지 않았는지 확인
        if (!sessionPage || sessionPage.isClosed()) {
             console.error("[세션] 자동 갱신 실패: 세션 페이지가 닫혔습니다.");
             clearInterval(sessionIntervalId); // 더 이상 갱신 시도 중지
             sessionIntervalId = null;
             return;
        }
        // 세션 갱신 전 현재 URL 로깅 (디버깅용)
        const currentUrlBeforeRenew = sessionPage.url();
        console.log(`[세션] 갱신 전 URL: ${currentUrlBeforeRenew}`);

        await sessionPage.evaluate(() => {
            // home_renew_session_ajax 함수가 window 객체에 직접 정의되어 있다고 가정
            if (typeof home_renew_session_ajax === 'function') {
                home_renew_session_ajax();
            } else {
                console.error('home_renew_session_ajax function not found on window');
            }
        });
        // 세션 갱신 후 잠시 대기 (필요시) 및 URL 확인
        await sleep(1000); // AJAX 처리를 위한 짧은 대기
        const currentUrlAfterRenew = sessionPage.url();
        console.log(`[세션] 갱신 후 URL: ${currentUrlAfterRenew}`);

        // 만약 갱신 후 로그인 페이지 등으로 이동했다면 경고
        if (!currentUrlAfterRenew.includes("library.daejin.ac.kr")) { // 로그인 페이지 URL 패턴 확인 필요
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
        // 필요시 여기서 재로그인 또는 크롤러 재시작 로직 고려
      }
    }, SESSION_RENEW_INTERVAL);

    console.log("✅ [크롤러 초기화] 완료");

  } catch (error) {
    console.error("❌ [크롤러 초기화] 실패:", error);
    if (browser) {
      await browser.close().catch(e => console.error("Browser close error:", e)); // Close 에러 처리
      browser = null;
      sessionPage = null;
    }
    if (sessionIntervalId) {
        clearInterval(sessionIntervalId);
        sessionIntervalId = null;
    }
    throw error; // 에러를 다시 던져서 서버 시작 실패 등을 유도
  }
}

/**
 * 크롤러 종료: 세션 갱신 중지, 브라우저 닫기
 */
export async function closeCrawler() {
  console.log("🚀 [크롤러 종료] 시작...");
  if (sessionIntervalId) {
    clearInterval(sessionIntervalId);
    sessionIntervalId = null;
    console.log("[종료] 세션 갱신 중지됨");
  }
  if (browser) {
    await browser.close().catch(e => console.error("Browser close error:", e)); // Close 에러 처리
    browser = null;
    sessionPage = null;
    console.log("[종료] 브라우저 닫힘");
  }
  console.log("✅ [크롤러 종료] 완료");
}

/**
 * 개별 방의 예약 가능 시간 크롤링 (독립 페이지 사용)
 * @param {object} room 방 정보 객체 { cate_cd, room_cd, title }
 * @param {string} dateStr YYYY-MM-DD 형식의 날짜
 * @param {Array} cookies 로그인 세션 쿠키
 * @returns {Promise<object|null>} 방 정보와 시간 목록 또는 null (실패 시)
 */
async function crawlSingleRoomPage(room, dateStr, cookies) {
    let page = null;
    const startTime = Date.now(); // 성능 측정용
    console.log(`[크롤링 작업 시작] 방: ${room.title} (${room.room_cd})`);

    try {
        if (!browser || !browser.isConnected()) {
             throw new Error("Browser is not connected or initialized.");
        }
        page = await browser.newPage();
        page.setDefaultTimeout(25000); // 개별 페이지 타임아웃 조정

        // 에러 핸들러 추가
        page.on('error', err => {
            console.error(`[Page Error][방 ${room.room_cd}] ${err.message}`);
        });
        page.on('pageerror', pageErr => {
             console.error(`[Page Console Error][방 ${room.room_cd}] ${pageErr.message}`);
        });


        // 쿠키 설정 (로그인 상태 공유)
        await page.setCookie(...cookies);
        await blockAssets(page); // 에셋 차단

        console.log(`[방 ${room.room_cd}] 목록 페이지 이동`);
        await page.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
            waitUntil: "domcontentloaded", // domcontentloaded 가 더 빠를 수 있음
        });

        console.log(`[방 ${room.room_cd}] 날짜 재설정: ${dateStr}`);
        const dateSet = await page.evaluate((d) => {
            const inp = document.getElementById("open_btn");
            if (inp) {
                inp.value = d;
                inp.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
            }
            return false; // 입력 필드 못 찾음
        }, dateStr);
        if (!dateSet) {
            throw new Error("날짜 입력 필드(#open_btn)를 찾을 수 없습니다.");
        }

        // 날짜 적용 및 예약 링크 로딩 대기
        console.log(`[방 ${room.room_cd}] 예약 링크 로딩 대기...`);
        try {
            await page.waitForFunction(
                () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0,
                { timeout: 15000 } // 대기 시간 조정
            );
        } catch (e) {
             throw new Error("날짜 적용 후 예약 링크 로딩 타임아웃");
        }


        console.log(`[방 ${room.room_cd}] 해당 방 링크 클릭`);
        const clicked = await page.evaluate((r) => {
            const links = [...document.querySelectorAll("a[onclick*='seminar_resv']")];
            const link = links.find((a) => a.getAttribute("onclick")?.includes(`'${r.room_cd}'`));
            if (link) {
                link.click();
                return true;
            }
            console.error(`Link not found for room ${r.room_cd}. Available links: ${links.length}`);
            return false;
        }, room);

        if (!clicked) {
          throw new Error(`해당 방(${room.room_cd})의 예약 링크를 찾거나 클릭할 수 없습니다.`);
        }


        console.log(`[방 ${room.room_cd}] AJAX 로딩 대기 (#start_time)`);
        await page.waitForSelector("#start_time", { timeout: 20000 }); // 타임아웃 증가

        // 옵션 로드 안정성을 위한 추가 대기 및 검증
        await sleep(1000); // AJAX 처리 시간 확보

        // 수정된 예약 마감/옵션 로드 확인 로직
        const startTimeElement = await page.$('#start_time'); // 요소 존재 여부 먼저 확인
        let isReservationClosed = false;
        let optionsLoaded = false;
        let totalOpt = 0; // totalOpt 초기화

        if (startTimeElement) {
            const startTimeText = await startTimeElement.evaluate(sel => sel.textContent || '');
            isReservationClosed = startTimeText.includes('예약이 마감되었습니다');

            // optionsLoaded 평가 로직도 startTimeElement가 있을 때만 실행
            optionsLoaded = await startTimeElement.evaluate(() => {
               const options = document.querySelectorAll("#start_time option");
               // '예약 마감' 또는 '선택' 이 아닌 실제 시간 옵션이 있는지 확인
               return options.length > 0 && Array.from(options).some(opt => /^\d{1,2}:\d{2}$/.test(opt.textContent.trim()));
            });

             // 전체 옵션 개수 가져오기
             totalOpt = await startTimeElement.evaluate(() => document.querySelectorAll("#start_time option").length);

        } else {
            // #start_time 요소 자체가 없다면 문제 상황으로 간주하고 실패 처리
             console.warn(`[방 ${room.room_cd}] #start_time 요소를 찾을 수 없음.`);
             throw new Error("#start_time 요소를 찾을 수 없습니다.");
        }

        if (!optionsLoaded && isReservationClosed) {
             console.log(`[방 ${room.room_cd}] 예약 마감됨 (옵션 없음)`);
             await page.close().catch(e => console.warn(`Page close error: ${e.message}`));
             return { ...room, times: [] }; // 마감 시 빈 배열 반환
        } else if (!optionsLoaded) {
            // 옵션이 아직 로드되지 않았거나 다른 문제 발생 가능성
            console.warn(`[방 ${room.room_cd}] 시간 옵션 로딩 확인 실패. 페이지 내용 확인 필요.`);
            // 필요시 HTML 스냅샷 저장 등 디버깅 로직 추가
            // const html = await page.content(); console.log(html);
            throw new Error("시간 옵션 로딩 확인 실패");
        }


        console.log(`[방 ${room.room_cd}] 예약 옵션 수집`);
        // startTimeElement가 보장되므로 $$eval 사용 가능
        let starts = await startTimeElement.$$eval("option", (opts) =>
          opts.map((el) => el.textContent.trim()).filter(t => t) // 빈 텍스트 제거
        );

        // 유효한 시간 형식 필터링 및 과거 시간 필터링
        starts = starts.filter((t) => HHMM.test(t));
        if (dateStr === TODAY) {
            starts = starts.filter((t) => !pastToday(t));
        }
        const times = starts.map((s) => ({ start: s, end: plus30(s) }));

        const duration = (Date.now() - startTime) / 1000; // 초 단위
        console.log(`[크롤링 작업 완료] 방: ${room.title} (${room.room_cd}), 유효 시간 ${times.length}개 / 총 ${totalOpt}개 (${duration.toFixed(1)}초 소요)`);
        await page.close().catch(e => console.warn(`Page close error: ${e.message}`)); // Close 에러 처리
        return { ...room, times };

    } catch (err) {
        const duration = (Date.now() - startTime) / 1000;
        console.error(`❌ [크롤링 작업 실패] 방: ${room.title} (${room.room_cd}) (${duration.toFixed(1)}초 소요)`);
        console.error(`  - 에러: ${err.name} - ${err.message}`);
        if (page && !page.isClosed()) {
            // 실패 시 스크린샷 저장 (디버깅용)
            // const screenshotPath = `error_${room.room_cd}_${Date.now()}.png`;
            // await page.screenshot({ path: screenshotPath });
            // console.log(`  - 스크린샷 저장: ${screenshotPath}`);
            await page.close().catch(e => console.warn(`Page close error on failure: ${e.message}`)); // Close 에러 처리
        }
        return null; // 실패 시 null 반환
    }
}


/**
 * 지정된 날짜의 모든 세미나실 예약 가능 시간 크롤링 (병렬 처리)
 * @param {string} dateStr YYYY-MM-DD 형식의 날짜
 * @returns {Promise<Array<object>>} 방 정보와 시간 목록 배열
 */
export async function crawl(dateStr) {
  if (!browser || !sessionPage || sessionPage.isClosed() || !browser.isConnected()) {
    console.error("크롤러 비정상 상태 감지. 재초기화 필요.");
    throw new Error("크롤러가 초기화되지 않았거나 비정상 상태입니다. 서버 관리자에게 문의하세요.");
  }
  console.log(`🚀 [크롤] 시작: ${dateStr}`);
  const overallStartTime = Date.now();

  try {
    // 1) 방 목록 가져오기 (sessionPage 사용)
    console.log("[크롤] 세션 페이지에서 방 목록 가져오기 시도...");
    console.log("[크롤] 세미나 목록 페이지로 이동");
    await sessionPage.goto("https://library.daejin.ac.kr/seminar_seminar_list.mir", {
      waitUntil: "domcontentloaded",
    });

    // *** 추가된 부분: 현재 URL 확인하여 로그인 페이지 여부 판단 ***
    const currentPageUrl = sessionPage.url();
    console.log(`[크롤] 현재 sessionPage URL: ${currentPageUrl}`);
    if (!currentPageUrl.includes("seminar_seminar_list.mir")) {
        console.error("[크롤] 세미나 목록 페이지가 아닌 다른 페이지로 이동됨 (로그인 풀림 가능성)");
        throw new Error("세션이 만료되었거나 예기치 않은 페이지 이동 발생");
    }
    // *** 추가된 부분 끝 ***

    console.log("[크롤] 날짜 입력 필드(#open_btn) 대기...");
    try {
        await sessionPage.waitForSelector("#open_btn", { timeout: 10000 });
    } catch (error) {
        console.error("[크롤] 날짜 입력 필드(#open_btn)를 시간 내에 찾지 못했습니다.");
        const pageContentForDebug = await sessionPage.content(); // 디버깅 위해 현재 페이지 내용 로깅
        console.error("현재 페이지 내용:", pageContentForDebug.substring(0, 500) + "..."); // 너무 길지 않게 일부만 로깅
        throw new Error("세미나 목록 페이지 로드 실패 또는 날짜 필드 없음");
    }
    console.log("[크롤] 날짜 입력 필드 확인됨.");


    console.log(`[크롤] 날짜 필터 설정: ${dateStr}`);
    const dateSet = await sessionPage.evaluate((d) => {
      const inp = document.getElementById("open_btn");
      if (inp) {
          inp.value = d;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
      }
      return false;
    }, dateStr);

    if (!dateSet) {
        throw new Error("[크롤] 날짜 필드 설정 실패 (evaluate 로직 오류 가능성)");
    }

    // 예약 링크 로딩 대기
    console.log("[크롤] 예약 링크 로딩 대기...");
    try {
        await sessionPage.waitForFunction(
            () => document.querySelectorAll("a[onclick*='seminar_resv']").length > 0,
            { timeout: 15000 }
        );
    } catch (e) {
        console.warn("[크롤] 해당 날짜에 예약 가능한 방이 없거나 로딩에 실패했습니다.");
        return []; // 빈 배열 반환
    }

    console.log("[크롤] 사용 가능한 방 목록 파싱");
    const rooms = await sessionPage.$$eval("a[onclick*='seminar_resv']", (links) =>
      links.map((a) => {
        const onclickAttr = a.getAttribute("onclick");
        if (!onclickAttr) return null;
        const m = onclickAttr.match(/'[^']*'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/);
         if (!m || m.length < 4) return null;
        return {
          cate_cd: m[2],
          room_cd: m[3],
          title: a.textContent?.replace(/\s+/g, " ").trim() || '제목 없음',
        };
      }).filter(Boolean)
    );
    console.log(`[크롤] 총 ${rooms.length}개 방 발견`);

    if (rooms.length === 0) {
        console.log("[크롤] 예약 가능한 방이 없습니다.");
        return [];
    }

    // 2) 병렬 크롤링
    console.log(`[크롤] ${rooms.length}개 방 병렬 크롤링 시작...`);
    const cookies = await sessionPage.cookies();

    const crawlPromises = rooms.map(room => crawlSingleRoomPage(room, dateStr, cookies));
    const results = await Promise.all(crawlPromises);

    // 3) 결과 정리
    const successfulResults = results.filter(Boolean);
    const failedCount = rooms.length - successfulResults.length;
    const duration = (Date.now() - overallStartTime) / 1000;
    console.log(`✅ [크롤] 완료: 총 ${successfulResults.length}개 방 정보 수집 성공, ${failedCount}개 실패 (${duration.toFixed(1)}초 소요)`);

    return successfulResults;

  } catch (error) {
    const duration = (Date.now() - overallStartTime) / 1000;
    console.error(`❌ [크롤] 전체 작업 실패 (${duration.toFixed(1)}초 소요):`, error);
    return [];
    // throw error;
  }
}
