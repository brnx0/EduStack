import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/Login/LoginView.vue'),
      meta: { hideHeader: true },
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/Home/HomeView.vue'),
    },
    {
      path: '/atesto',
      name: 'atesto',
      component: () => import('../views/Atesto/AtestoView.vue'),
    },
    {
      path: '/poker',
      name: 'poker',
      component: () => import('../views/PlanningPoker/HomeView.vue'),
    },
    {
      path: '/poker/room/:roomId',
      name: 'poker-room',
      component: () => import('../views/PlanningPoker/RoomView.vue'),
    },
  ],
})

export default router
