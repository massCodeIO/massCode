import type { RouteRecordRaw } from 'vue-router'
import { createWebHistory, createRouter } from 'vue-router'
import Main from './views/Main.vue'
import Preferences from './views/Preferences.vue'

const history = createWebHistory()
const routes: RouteRecordRaw[] = [
  { path: '/', component: Main },
  { path: '/preferences', component: Preferences }
]

const router = createRouter({ history, routes })

export default router
