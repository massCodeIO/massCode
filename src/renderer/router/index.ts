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
  devtoolsCaseConverter: 'devtools/case-converter',
  devtoolsTextToUnicode: 'devtools/text-to-unicode',
  devtoolsTextToAscii: 'devtools/text-to-ascii',
  devtoolsBase64Converter: 'devtools/base64-converter',
  devtoolsJsonToYaml: 'devtools/json-to-yaml',
  devtoolsJsonToToml: 'devtools/json-to-toml',
  devtoolsJsonToXml: 'devtools/json-to-xml',
  devtoolsHash: 'devtools/hash',
  devtoolsHmac: 'devtools/hmac',
  devtoolsPassword: 'devtools/password',
  devtoolsUuid: 'devtools/uuid',
  devtoolsUrlParser: 'devtools/url-parser',
  devtoolsSlugify: 'devtools/slugify',
  devtoolsUrlEncoder: 'devtools/url-encoder',
  devtoolsColorConverter: 'devtools/color-converter',
} as const

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
        name: RouterName.devtoolsCaseConverter,
        component: () =>
          import('@/components/devtools/converters/CaseConverter.vue'),
      },
      {
        path: 'text/to-unicode',
        name: RouterName.devtoolsTextToUnicode,
        component: () =>
          import('@/components/devtools/converters/TextToUnicode.vue'),
      },
      {
        path: 'text/to-ascii',
        name: RouterName.devtoolsTextToAscii,
        component: () =>
          import('@/components/devtools/converters/TextToAsciiBinary.vue'),
      },
      {
        path: 'base64-converter',
        name: RouterName.devtoolsBase64Converter,
        component: () =>
          import('@/components/devtools/converters/Base64Converter.vue'),
      },
      {
        path: 'json-to-yaml',
        name: RouterName.devtoolsJsonToYaml,
        component: () =>
          import('@/components/devtools/converters/JsonToYaml.vue'),
      },
      {
        path: 'json-to-toml',
        name: RouterName.devtoolsJsonToToml,
        component: () =>
          import('@/components/devtools/converters/JsonToToml.vue'),
      },
      {
        path: 'json-to-xml',
        name: RouterName.devtoolsJsonToXml,
        component: () =>
          import('@/components/devtools/converters/JsonToXml.vue'),
      },
      {
        path: 'hash',
        name: RouterName.devtoolsHash,
        component: () => import('@/components/devtools/crypto/Hash.vue'),
      },
      {
        path: 'hmac',
        name: RouterName.devtoolsHmac,
        component: () => import('@/components/devtools/crypto/Hmac.vue'),
      },
      {
        path: 'password',
        name: RouterName.devtoolsPassword,
        component: () => import('@/components/devtools/crypto/Password.vue'),
      },
      {
        path: 'uuid',
        name: RouterName.devtoolsUuid,
        component: () => import('@/components/devtools/crypto/Uuid.vue'),
      },
      {
        path: 'url-parser',
        name: RouterName.devtoolsUrlParser,
        component: () => import('@/components/devtools/web/UrlParser.vue'),
      },
      {
        path: 'slugify',
        name: RouterName.devtoolsSlugify,
        component: () => import('@/components/devtools/web/Slugify.vue'),
      },
      {
        path: 'url-encoder',
        name: RouterName.devtoolsUrlEncoder,
        component: () => import('@/components/devtools/web/UrlEncoder.vue'),
      },
      {
        path: 'color-converter',
        name: RouterName.devtoolsColorConverter,
        component: () =>
          import('@/components/devtools/converters/ColorConverter.vue'),
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
