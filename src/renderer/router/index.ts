import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'main',
    component: () => import('@/views/Main.vue'),
  },
  {
    path: '/preferences',
    name: 'preferences',
    component: () => import('@/views/Preferences.vue'),
    children: [
      {
        path: 'storage',
        name: 'preferences/storage',
        component: () => import('@/components/preferences/Storage.vue'),
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
