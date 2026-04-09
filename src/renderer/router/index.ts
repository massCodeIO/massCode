import { createRouter, createWebHashHistory } from 'vue-router'

export const RouterName = {
  main: 'main',
  preferences: 'preferences',
  preferencesStorage: 'preferences/storage',
  preferencesLanguage: 'preferences/language',
  preferencesAppearance: 'preferences/appearance',
  preferencesEditor: 'preferences/editor',
  preferencesNotesEditor: 'preferences/notes-editor',
  preferencesMath: 'preferences/math',
  preferencesAPI: 'preferences/api',
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
  devtoolsJsonGenerator: 'devtools/json-generator',
  devtoolsLoremIpsumGenerator: 'devtools/lorem-ipsum-generator',
  devtoolsJsonDiff: 'devtools/json-diff',
  mathNotebook: 'math-notebook',
  notesSpace: 'notes-space',
  notesDashboard: 'notes-space/dashboard',
  notesGraph: 'notes-space/graph',
  notesPresentation: 'notes-space/presentation',
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
    redirect: () => {
      const saved = sessionStorage.getItem('preferences:lastRoute')
      return { name: saved || RouterName.preferencesStorage }
    },
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
      {
        path: 'notes-editor',
        name: RouterName.preferencesNotesEditor,
        component: () => import('@/components/preferences/NotesEditor.vue'),
      },
      {
        path: 'math',
        name: RouterName.preferencesMath,
        component: () => import('@/components/preferences/Math.vue'),
      },
      {
        path: 'api',
        name: RouterName.preferencesAPI,
        component: () => import('@/components/preferences/API.vue'),
      },
    ],
  },
  {
    path: '/devtools',
    name: RouterName.devtools,
    component: () => import('@/views/Devtools.vue'),
    redirect: () => {
      const saved = sessionStorage.getItem('devtools:lastRoute')
      return { name: saved || RouterName.devtoolsCaseConverter }
    },
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
      {
        path: 'json-generator',
        name: RouterName.devtoolsJsonGenerator,
        component: () =>
          import('@/components/devtools/generators/JsonGenerator.vue'),
      },
      {
        path: 'lorem-ipsum-generator',
        name: RouterName.devtoolsLoremIpsumGenerator,
        component: () =>
          import('@/components/devtools/generators/LoremIpsumGenerator.vue'),
      },
      {
        path: 'compare/json-diff',
        name: RouterName.devtoolsJsonDiff,
        component: () => import('@/components/devtools/compare/JsonDiff.vue'),
      },
    ],
  },
  {
    path: '/math-notebook',
    name: RouterName.mathNotebook,
    component: () => import('@/views/MathNotebook.vue'),
  },
  {
    path: '/notes',
    name: RouterName.notesSpace,
    component: () => import('@/components/notes/NotesSpace.vue'),
    children: [
      {
        path: 'dashboard',
        name: RouterName.notesDashboard,
        component: () => import('@/views/NotesDashboard.vue'),
      },
      {
        path: 'graph',
        name: RouterName.notesGraph,
        component: () => import('@/views/NotesGraph.vue'),
      },
    ],
  },
  {
    path: '/notes/presentation',
    name: RouterName.notesPresentation,
    component: () => import('@/views/NotesPresentation.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
