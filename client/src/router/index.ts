import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getUser } from '../composables/useAuth'

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
      meta: { requiresAdmin: true },
    },
    {
      path: '/monitor',
      name: 'monitor',
      component: () => import('../views/Monitor/MonitorView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/acesso-negado',
      name: 'access-denied',
      component: () => import('../views/AccessDenied/AccessDeniedView.vue'),
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

router.beforeEach((to, _from, next) => {
  if (to.meta.hideHeader) {
    next()
    return
  }

  if (!getToken()) {
    next('/')
    return
  }

  if (to.meta.requiresAdmin && !getUser()?.isAdmin) {
    next('/acesso-negado')
    return
  }

  next()
})

export default router
