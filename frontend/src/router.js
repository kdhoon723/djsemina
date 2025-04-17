import { createRouter, createWebHistory } from "vue-router";
import Availability from "./pages/Availability.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: Availability }],
});
