import { createRouter, createWebHistory } from "vue-router";
import Availability from "./pages/Availability.vue";
import Insights from "./pages/Insights.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: Availability,
      name: "home"
    },
    {
      path: "/insights",
      component: Insights,
      name: "insights"
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/"
    }
  ],
});