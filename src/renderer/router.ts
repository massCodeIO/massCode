import type { RouteRecordRaw } from 'vue-router'
import { createWebHistory, createRouter } from 'vue-router'
import Main from './views/Main.vue'

const history = createWebHistory()
const routes: RouteRecordRaw[] = [
  { path: '/', component: Main },
  {
    path: '/preferences',
    component: import('./views/Preferences.vue')
  }
]

const router = createRouter({ history, routes })

export default router
