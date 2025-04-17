<script setup>
// App.vue는 라우터 뷰와 Vuetify 레이아웃을 포함
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark app>
      <v-app-bar-title>대진대학교 도서관 캐럴실 체커</v-app-bar-title>
    </v-app-bar>
    
    <v-main>
      <v-container>
        <RouterView />
      </v-container>
    </v-main>
    
    <v-footer app>
      <span class="text-center w-100">© {{ new Date().getFullYear() }} - 대진대학교 도서관 캐럴실 체커</span>
    </v-footer>
  </v-app>
</template>