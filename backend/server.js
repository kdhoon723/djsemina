import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { crawl } from "./crawler.js";      // ← import 변경

const PORT = process.env.PORT || 8080;
const app = express();
app.use(cors());

/* 메모리 캐시 */
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

app.get("/api/availability", async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const cached = cache.get(date);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return res.json({
            date,
            cached: true,
            rooms: cached.data ?? [],      // rooms 가 undefined 면 빈 배열로
        });
    }

    try {
        const rooms = await crawl(date);       // ← 함수명 변경
        cache.set(date, { ts: Date.now(), data: rooms });
        res.json({ date, cached: false, rooms });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/health", (_, res) => res.send("OK"));

app.listen(PORT, () =>
    console.log(`🚀 backend 서버 구동 : http://localhost:${PORT}`)
);
