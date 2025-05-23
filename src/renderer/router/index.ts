import { createRouter, createWebHashHistory } from 'vue-router'

export const RouterName = {
  main: 'main',
  preferences: 'preferences',
  preferencesStorage: 'preferences/storage',
  preferencesLanguage: 'preferences/language',
  preferencesAppearance: 'preferences/appearance',
  preferencesEditor: 'preferences/editor',
  markdownPresentation: 'markdown-presentation',
  devtools: 'devtools',
  devtoolsTextCaseConverter: 'devtools/text/case-converter',
}

const routes = [
  {
    path: '/',
    name: RouterName.main,
    component: () => import('@/views/Main.vue'),
  },
  {
    path: '/preferences',
    name: RouterName.preferences,
    component: () => import('@/views/Preferences.vue'),
    children: [
      {
        path: 'storage',
        name: RouterName.preferencesStorage,
        component: () => import('@/components/preferences/Storage.vue'),
      },
      {
        path: 'language',
        name: RouterName.preferencesLanguage,
        component: () => import('@/components/preferences/Language.vue'),
      },
      {
        path: 'appearance',
        name: RouterName.preferencesAppearance,
        component: () => import('@/components/preferences/Appearance.vue'),
      },
      {
        path: 'editor',
        name: RouterName.preferencesEditor,
        component: () => import('@/components/preferences/Editor.vue'),
      },
    ],
  },
  {
    path: '/markdown-presentation',
    name: RouterName.markdownPresentation,
    component: () => import('@/views/MarkdownPresentation.vue'),
  },
  {
    path: '/devtools',
    name: RouterName.devtools,
    component: () => import('@/views/Devtools.vue'),
    children: [
      {
        path: 'text/case-converter',
        name: RouterName.devtoolsTextCaseConverter,
        component: () =>
          import('~/renderer/components/devtools/converters/CaseConverter.vue'),
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
