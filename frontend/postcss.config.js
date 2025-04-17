// postcss.config.js
export default {
    plugins: {
      "@tailwindcss/postcss": {},  // 이 부분이 중요합니다 - tailwindcss가 아니라 @tailwindcss/postcss를 사용
      autoprefixer: {},
    },
  };