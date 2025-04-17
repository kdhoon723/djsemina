<script setup>
// App.vue는 라우터 뷰와 기본 레이아웃을 포함
</script>

<template>
  <div class="app-wrapper">
    <nav class="navbar">
      <div class="navbar-brand">대진대학교 도서관 캐럴실 체커</div>
    </nav>
    
    <main class="main-content">
      <RouterView />
    </main>
    
    <footer class="footer">
      <p class="footer-text">© {{ new Date().getFullYear() }} 대진대학교 도서관 캐럴실 체커</p>
    </footer>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  background-color: #f9f9f9;
  color: #333;
}

.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.navbar {
  background-color: #1976D2;
  color: white;
  padding: 12px 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.navbar-brand {
  font-size: 1.2rem;
  font-weight: 500;
}

.main-content {
  flex: 1;
  padding: 20px 0;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background-color: #f5f5f5;
  padding: 15px 20px;
  text-align: center;
  border-top: 1px solid #e0e0e0;
}

.footer-text {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}
</style>