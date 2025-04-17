import express from "express";
import cors from "cors";
import { crawl } from "./crawler.js";

const app = express();
app.use(cors());

/* SSE 진행률 스트리밍 */
app.get("/api/availability-progress", (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  // SSE 헤더
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 진행률 콜백
  const onProgress = (pct) => {
    res.write(`event: progress\n`);
    res.write(`data: ${pct}\n\n`);
  };

  // 실제 크롤 시작
  crawl(date, onProgress)
    .then((rooms) => {
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ rooms })}\n\n`);
      res.end();
    })
    .catch((err) => {
      res.write(`event: error\n`);
      res.write(`data: ${err.message}\n\n`);
      res.end();
    });
});

// (기존 /api/availability 캐시 엔드포인트도 그대로 보존)

app.listen(8080, () => {
  console.log("🚀 서버 실행 중 – 포트 8080");
});
