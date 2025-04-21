// backend/server.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { crawl } from "./crawler.js";

const PORT = process.env.PORT || 8080;
const app = express();

// ─── 프록시 신뢰 설정 (Cloudflare 등 뒤에 있을 때 실제 클라이언트 IP 확보) ───
app.set("trust proxy", true);

// ─── CORS 전역 적용 ───
const allowedOrigins = [
    "https://example.invalid",
    "https://www.example.invalid",
    "https://djsemina.example.invalid",
    "https://djsemina.web.app",
    "https://card.example.invalid",
    "https://api.example.invalid",
    "https://example.invalid",
    "http://localhost:5000",
];
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

// ─── 요청 로깅 미들웨어 ───
app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip}`
    );
    next();
});

// ─── 메모리 캐시 설정 ───
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

// ─── GET /api/availability ───
app.get("/api/availability", async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const skipCache = req.query._ts !== undefined;
    const entry = cache.get(date);

    if (entry && !skipCache && Date.now() - entry.ts < CACHE_TTL_MS) {
        return res.json({
            date,
            cached: true,
            fetchedAt: entry.fetchedAt,
            rooms: entry.data,
        });
    }

    try {
        const rooms = await crawl(date);
        const now = Date.now();
        const fetchedAt = new Date(now).toISOString();
        cache.set(date, { ts: now, data: rooms, fetchedAt });
        res.json({ date, cached: false, fetchedAt, rooms });
    } catch (err) {
        console.error("[/api/availability] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/availability-progress ───
app.get("/api/availability-progress", (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });

    const onProgress = (pct) => {
        res.write(`event: progress\n`);
        res.write(`data: ${pct}\n\n`);
    };

    crawl(date, onProgress)
        .then((rooms) => {
            res.write(`event: done\n`);
            res.write(`data: ${JSON.stringify({ rooms })}\n\n`);
            res.end();
        })
        .catch((err) => {
            console.error("[/api/availability-progress] Error:", err);
            res.write(`event: error\n`);
            res.write(`data: ${err.message}\n\n`);
            res.end();
        });
});

// ─── 서버 시작 ───
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
});
