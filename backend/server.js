// backend/server.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { crawl } from "./crawler.js";

const PORT = process.env.PORT || 8080;
const app = express();
app.use(cors());

// 메모리 캐시: { date: { ts, data, fetchedAt } }
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

// 1) 캐시 조회용
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2) 진행률 SSE (필요시)
app.get("/api/availability‑progress", (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const onProgress = pct => {
    res.write(`event: progress\n`);
    res.write(`data: ${pct}\n\n`);
  };
  crawl(date, onProgress)
    .then(rooms => {
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ rooms })}\n\n`);
      res.end();
    })
    .catch(err => {
      res.write(`event: error\n`);
      res.write(`data: ${err.message}\n\n`);
      res.end();
    });
});

app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
