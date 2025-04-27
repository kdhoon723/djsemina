// backend/server.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
// initializeCrawler와 closeCrawler를 import 합니다.
import { crawl, initializeCrawler, closeCrawler } from "./crawler.js";

const PORT = process.env.PORT || 8080;
const app = express();
app.use(cors());

// 메모리 캐시: { date: { ts, data, fetchedAt } }
const cache = new Map();

// --- 자동 크롤링 설정 ---
const AUTO_CRAWL_INTERVAL_MS = 10 * 60 * 1000; // 10분
let autoCrawlIntervalId = null;
let isCrawlerReady = false; // 크롤러 초기화 상태 플래그

/**
 * 크롤링 대상 날짜를 결정하는 함수 (프런트엔드 로직과 유사하게)
 * 현재 시간이 오후 8시 (20시) 이후면 다음날을, 아니면 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTargetDateForAutoCrawl() {
    const now = new Date();
    // 서버 시간 기준으로 20시 체크 (필요시 특정 타임존 적용 고려, 예: KST)
    if (now.getHours() >= 20) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        return tomorrow.toISOString().slice(0, 10);
    } else {
        return now.toISOString().slice(0, 10);
    }
}


/**
 * 주기적으로 대상 날짜의 데이터를 크롤링하고 캐시를 업데이트하는 함수
 */
async function runAutoCrawl() {
    // 크롤러가 준비되지 않았으면 실행하지 않음
    if (!isCrawlerReady) {
        console.log("[Auto Crawl] 크롤러가 아직 준비되지 않았습니다. 다음 주기에 시도합니다.");
        return;
    }
    // *** 수정된 부분: 프런트엔드 로직에 맞춰 크롤링 대상 날짜 결정 ***
    const targetDate = getTargetDateForAutoCrawl();
    console.log(`[Auto Crawl] 주기적 크롤링 시작: 대상 날짜=${targetDate}`);
    try {
        const fetchedAt = new Date().toISOString();
        // *** 수정된 부분: 계산된 targetDate로 크롤링 ***
        const rooms = await crawl(targetDate);

        // 새 데이터 캐시 저장
        console.log(`[Auto Crawl] 크롤링 완료. 캐시 저장: ${targetDate}, ${rooms.length} rooms`);
        cache.set(targetDate, { ts: Date.now(), data: rooms, fetchedAt });

    } catch (error) {
        console.error(`[Auto Crawl] 주기적 크롤링 중 오류 발생 (${targetDate}):`, error.message);
        // 여기서 에러가 발생해도 다음 주기에 다시 시도
    }
}


// --- API 라우트 수정 ---
// '/api/availability' 엔드포인트: 최신 캐시 반환 또는 강제 크롤링
app.get("/api/availability", async (req, res) => {
    // *** API 요청 시 날짜 결정 로직은 기존 유지 (프론트에서 명시적 요청) ***
    // 기본값을 자동 크롤링 대상 날짜로 설정하면, 프론트 첫 로딩 시 백엔드 자동 크롤링과 같은 날짜를 보게 됨
    const date = req.query.date || getTargetDateForAutoCrawl();
    const forceCrawl = req.query._ts !== undefined; // _ts 파라미터가 있으면 강제 크롤링 (롱 프레스용)
    const entry = cache.get(date); // 요청된 날짜의 캐시 확인

    console.log(`[API /availability] 요청 수신: date=${date}, forceCrawl=${forceCrawl}`);

    // 1. 강제 크롤링 요청 (_ts 파라미터 존재)
    if (forceCrawl) {
        console.log(`[API /availability] 강제 크롤링 요청: ${date}.`);
        // 크롤링 수행
        try {
            const fetchedAt = new Date().toISOString();
            const rooms = await crawl(date); // 요청된 날짜로 크롤링

            // 새 데이터 캐시 저장 (크롤링 결과로 캐시 업데이트)
            console.log(`[API /availability] 강제 크롤링 완료. 캐시 업데이트: ${date}, ${rooms.length} rooms`);
            cache.set(date, { ts: Date.now(), data: rooms, fetchedAt });

            return res.json({
                date,
                cached: false, // 새로 크롤링했으므로 false
                fetchedAt: fetchedAt,
                rooms: rooms,
            });
        } catch (error) {
            console.error(`[/api/availability] 강제 크롤링 오류 (date: ${date}):`, error);
            return res.status(500).json({ error: "Failed to fetch availability data.", message: error.message });
        }
    }

    // 2. 일반 요청 (강제 크롤링 아님) - 캐시된 데이터 반환 시도
    if (entry) {
        console.log(`[API /availability] 캐시 히트: date=${date}`);
        return res.json({
            date,
            cached: true, // 캐시에서 가져왔으므로 true
            fetchedAt: entry.fetchedAt,
            rooms: entry.data,
        });
    }

    // 3. 일반 요청인데 캐시가 없는 경우 (예: 서버 시작 직후 다른 날짜 조회) - 크롤링 수행
    console.log(`[API /availability] 캐시 미스 (일반 요청): ${date}. 크롤링 시작.`);
    try {
        const fetchedAt = new Date().toISOString();
        const rooms = await crawl(date); // 요청된 날짜로 크롤링

        // 새 데이터 캐시 저장
        console.log(`[API /availability] 캐시 미스 크롤링 완료. 캐시 저장: ${date}, ${rooms.length} rooms`);
        cache.set(date, { ts: Date.now(), data: rooms, fetchedAt });

        return res.json({
            date,
            cached: false, // 새로 크롤링했으므로 false
            fetchedAt: fetchedAt,
            rooms: rooms,
        });
    } catch (error) {
        console.error(`[/api/availability] 캐시 미스 크롤링 오류 (date: ${date}):`, error);
        return res.status(500).json({ error: "Failed to fetch availability data.", message: error.message });
    }
});


// '/api/crawl' 엔드포인트는 유지 (디버깅 또는 특정 목적용)
app.get("/api/crawl", async (req, res) => {
    // '/api/crawl' 직접 호출 시 날짜는 요청 파라미터 또는 오늘 날짜 기준 (기존 동작 유지)
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log(`[API /crawl] 직접 크롤링 요청 수신: date=${date}`);
    try {
        const fetchedAt = new Date().toISOString();
        const rooms = await crawl(date); // crawl 함수 호출

        // 새 데이터 캐시 저장 (직접 크롤링 결과도 캐시 업데이트)
        console.log(`[API /crawl] 직접 크롤링 완료. 캐시 업데이트: ${date}, ${rooms.length} rooms`);
        cache.set(date, { ts: Date.now(), data: rooms, fetchedAt });

        res.json({
            date,
            cached: false, // 항상 새로 가져왔으므로 false
            fetchedAt: fetchedAt,
            rooms: rooms,
        });
    } catch (error) {
        console.error(`[/api/crawl] Error:`, error);
        res.status(500).json({ error: "Failed to fetch availability data.", message: error.message });
    }
});


// --- 서버 시작 및 종료 처리 ---

// 서버 시작 전에 크롤러 초기화 및 자동 크롤링 시작
(async () => {
    try {
        await initializeCrawler(); // 크롤러 초기화 함수 호출
        console.log("✅ 크롤러 초기화 성공.");
        isCrawlerReady = true; // 크롤러 준비 완료 상태로 설정

        // 초기화 성공 시 즉시 오늘 데이터 크롤링 한번 실행 (서버 시작 시 최신 데이터 확보)
        console.log("[초기 실행] 서버 시작 후 첫 자동 크롤링 실행 (대상 날짜 계산)...");
        // *** 수정된 부분: 수정된 runAutoCrawl 호출 ***
        await runAutoCrawl(); // 첫 크롤링 실행 (수정된 로직으로 대상 날짜 계산)

        // 주기적 크롤링 시작 (첫 실행 후 설정)
        // *** 수정된 부분: AUTO_CRAWL_INTERVAL_MS 변수 사용 확인 ***
        console.log(`[Auto Crawl] ${AUTO_CRAWL_INTERVAL_MS / 60000}분 간격으로 자동 크롤링 설정.`);
        autoCrawlIntervalId = setInterval(runAutoCrawl, AUTO_CRAWL_INTERVAL_MS);

        // 초기화 및 첫 크롤링 성공 후 서버 리스닝 시작
        app.listen(PORT, () => {
            console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error("❌ 크롤러 초기화 또는 첫 크롤링 실패. 서버를 시작할 수 없습니다.", error);
        // 크롤러가 준비 안된 상태로 남아있거나, 에러 발생 시 프로세스 종료
        process.exit(1);
    }
})();


// 정상 종료 처리 (Ctrl+C 등) - Interval 클리어 추가
process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received. Closing crawler and exiting...');
    if (autoCrawlIntervalId) {
        clearInterval(autoCrawlIntervalId); // 주기적 크롤링 중지
        console.log("[종료] 자동 크롤링 Interval 중지됨.");
    }
    await closeCrawler(); // 크롤러 종료 함수 호출
    process.exit(0);
});

// 다른 종료 신호 처리 (선택적) - Interval 클리어 추가
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received. Closing crawler and exiting...');
     if (autoCrawlIntervalId) {
        clearInterval(autoCrawlIntervalId); // 주기적 크롤링 중지
        console.log("[종료] 자동 크롤링 Interval 중지됨.");
    }
    await closeCrawler(); // 크롤러 종료 함수 호출
    process.exit(0);
});

// 처리되지 않은 예외 처리 (기존 유지)
process.on('uncaughtException', (error, origin) => {
    console.error(`\n\n========= UNCAUGHT EXCEPTION =========`);
    console.error(`Origin: ${origin}`);
    console.error(error);
    console.error(`======================================`);
    // 자동 크롤링 Interval 정리 시도 (선택적)
    if (autoCrawlIntervalId) clearInterval(autoCrawlIntervalId);
    // 프로세스 관리자가 재시작하도록 프로세스를 종료합니다.
    process.exit(1); // 로깅 후 종료
});

// 처리되지 않은 프로미스 거부 처리 (기존 유지)
process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n\n======= UNHANDLED REJECTION ========`);
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    console.error(`======================================`);
    // 여기서 크롤러를 닫거나 Interval을 정리하는 것은 위험할 수 있음
});
