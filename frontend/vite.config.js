import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  /* ★ 추가: dev 서버 프록시 */
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080", // 백엔드 주소
        changeOrigin: true,
      },
    },
  },
});
