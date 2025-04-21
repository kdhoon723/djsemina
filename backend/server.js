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
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 캐시

// --- API 라우트 (기존 코드 유지) ---
// 1) 캐시 조회용
app.get("/api/availability", async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const skipCache = req.query._ts !== undefined; // 타임스탬프 파라미터로 캐시 무시
    const entry = cache.get(date);
    const now = Date.now();

    console.log(`[API /availability] 요청 수신: date=${date}, skipCache=${skipCache}`);


    if (entry && !skipCache && now - entry.ts < CACHE_TTL_MS) {
        console.log(`[API /availability] 캐시 히트: date=${date}`);
        return res.json({
            date,
            cached: true,
            fetchedAt: entry.fetchedAt,
            rooms: entry.data,
        });
    }

    // 캐시 없거나 만료 시 크롤링
    try {
        console.log(`[API /availability] 캐시 미스 또는 만료. 크롤링 시작: ${date}`);
        const fetchedAt = new Date().toISOString();
        const rooms = await crawl(date); // crawl 함수 호출

        // 새 데이터 캐시 저장
        console.log(`[API /availability] 크롤링 완료. 캐시 저장: ${date}, ${rooms.length} rooms`);
        cache.set(date, { ts: Date.now(), data: rooms, fetchedAt });

        res.json({
            date,
            cached: false,
            fetchedAt: fetchedAt,
            rooms: rooms,
        });
    } catch (error) {
        console.error(`[/api/availability] Error:`, error);
        res.status(500).json({ error: "Failed to fetch availability data.", message: error.message });
    }
});

// 2) 실시간 크롤링용 (선택적 - 캐시 무시하고 항상 크롤링)
app.get("/api/crawl", async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    console.log(`[API /crawl] 강제 크롤링 요청 수신: date=${date}`);
    try {
        const fetchedAt = new Date().toISOString();
        const rooms = await crawl(date); // crawl 함수 호출

        // 새 데이터 캐시 저장 (실시간 크롤링 결과도 캐시 업데이트)
        console.log(`[API /crawl] 크롤링 완료. 캐시 업데이트: ${date}, ${rooms.length} rooms`);
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

// 서버 시작 전에 크롤러 초기화
(async () => {
    try {
        await initializeCrawler(); // 크롤러 초기화 함수 호출
        // 초기화 성공 시 서버 리스닝 시작
        app.listen(PORT, () => {
            console.log(`Server listening on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error("크롤러 초기화 실패. 서버를 시작할 수 없습니다.", error);
        process.exit(1); // 초기화 실패 시 프로세스 종료
    }
})();


// 정상 종료 처리 (Ctrl+C 등)
process.on('SIGINT', async () => {
    console.log('\nSIGINT signal received. Closing crawler and exiting...');
    await closeCrawler(); // 크롤러 종료 함수 호출
    process.exit(0);
});

// 다른 종료 신호 처리 (선택적)
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received. Closing crawler and exiting...');
    await closeCrawler(); // 크롤러 종료 함수 호출
    process.exit(0);
});

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error, origin) => {
    console.error(`\n\n========= UNCAUGHT EXCEPTION =========`);
    console.error(`Origin: ${origin}`);
    console.error(error);
    console.error(`======================================`);
    // 여기서 크롤러를 닫는 것은 문제의 원인일 수 있으므로 피합니다.
    // 프로세스 관리자가 재시작하도록 프로세스를 종료합니다.
    process.exit(1); // 로깅 후 종료
});

// 처리되지 않은 프로미스 거부 처리 (수정됨: closeCrawler 호출 제거)
process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n\n======= UNHANDLED REJECTION ========`);
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    console.error(`======================================`);
    // 여기서 크롤러를 닫지 않습니다. 개별 크롤링 함수가 오류를 처리해야 합니다.
    // process.exit(1); // 필요에 따라 종료하거나, 치명적이지 않다고 판단되면 앱을 계속 실행할 수도 있습니다.
});
