<script setup>
// App.vue는 라우터 뷰와 기본 레이아웃을 포함
</script>

<template>
  <div class="app-wrapper">
    <nav class="navbar">
      <div class="navbar-content">
        <div class="navbar-brand">
          <img src="https://www.daejin.ac.kr/sites/daejin/images/common/logo.png" alt="대진대학교" class="logo" />
          <span class="brand-text">DJSemina</span>
        </div>
      </div>
    </nav>
    
    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
    
    <footer class="footer">
      <div class="footer-content">
        <p class="footer-text">© {{ new Date().getFullYear() }} DJSemina</p>
      </div>
    </footer>
  </div>
</template>

<style>
:root {
  --primary: #1e40af;
  --primary-light: #3b82f6;
  --secondary: #64748b;
  --accent: #06b6d4;
  --background: #f8fafc;
  --card-bg: #ffffff;
  --text: #334155;
  --text-light: #94a3b8;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --success: #10b981;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  background-color: var(--background);
  color: var(--text);
  line-height: 1.6;
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.navbar {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: white;
  padding: 0;
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 10;
}

.navbar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  height: 28px;
  width: auto;
}

.brand-text {
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.main-content {
  flex: 1;
  padding: 30px 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background-color: #f1f5f9;
  border-top: 1px solid #e2e8f0;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.footer-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-light);
}

/* 페이지 전환 애니메이션 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 전역 스타일 개선 */
button {
  transition: all 0.2s ease;
}

button:active {
  transform: scale(0.98);
}

a {
  color: var(--primary);
  text-decoration: none;
  transition: color 0.2s;
}

a:hover {
  color: var(--primary-light);
}

@media (max-width: 768px) {
  .main-content {
    padding: 20px 15px;
  }
}
</style>