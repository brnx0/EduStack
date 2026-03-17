import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/PlanningPoker/HomeView.vue'
import RoomView from '../views/PlanningPoker/RoomView.vue'
import LoginView from '../views/Login/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
      meta: {
        hideHeader: true,
      },
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/Home/HomeView.vue'),
    },  
    {
      path: '/poker',
      name: 'poker',
      component: HomeView,
    },
    {
      path: '/poker/room/:roomId',
      name: 'poker-room',
      component: RoomView,
    },
  ],
})

export default router
