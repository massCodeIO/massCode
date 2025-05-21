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
      {
        path: 'language',
        name: 'preferences/language',
        component: () => import('@/components/preferences/Language.vue'),
      },
      {
        path: 'appearance',
        name: 'preferences/appearance',
        component: () => import('@/components/preferences/Appearance.vue'),
      },
      {
        path: 'editor',
        name: 'preferences/editor',
        component: () => import('@/components/preferences/Editor.vue'),
      },
    ],
  },
  {
    path: '/markdown-presentation',
    name: 'markdown-presentation',
    component: () => import('@/views/MarkdownPresentation.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
