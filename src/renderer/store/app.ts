import { platform, store } from '@/electron'
import type {
  CodePreviewSettings,
  EditorSettings,
  ScreenshotSettings,
  State,
  Theme
} from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'
import { version } from '../../../package.json'

const EDITOR_DEFAULTS: EditorSettings = {
  fontFamily: 'SF Mono, Consolas, Menlo',
  fontSize: 12,
  showInvisibles: false,
  tabSize: 2,
  wrap: 'free',
  trailingComma: 'none',
  semi: false,
  singleQuote: true,
  theme: 'chrome',
  highlightLine: false,
  highlightGutter: false
}

const SCREENSHOT_DEFAULTS: ScreenshotSettings = {
  background: false,
  gradient: ['#D02F98', '#9439CA'],
  darkMode: true,
  width: 600
}

const CODE_PREVIEW_DEFAULTS: CodePreviewSettings = {
  darkMode: false
}

export const useAppStore = defineStore('app', {
  state: (): State => ({
    isInit: false,
    isSponsored: import.meta.env.VITE_SPONSORED === 'true',
    theme: 'light:chrome',
    showTags: true,
    sizes: {
      titlebar: 15,
      sidebar: 180,
      snippetList: 250,
      codePreviewHeight: 200,
      editor: {
        titleHeight: 34,
        fragmentsHeight: 25,
        tagsHeight: 40,
        descriptionHeight: 58,
        footerHeight: 30
      }
    },
    editor: EDITOR_DEFAULTS,
    screenshot: SCREENSHOT_DEFAULTS,
    codePreview: CODE_PREVIEW_DEFAULTS,
    selectedPreferencesMenu: 'storage',
    language: store.preferences.get('language'),
    version,
    platform: platform()
  }),

  getters: {
    isLightTheme: state => !!state.theme.match(/^light/)
  },

  actions: {
    setTheme (theme: Theme) {
      this.theme = theme

      if (theme === 'light:chrome') {
        this.editor.theme = 'chrome'
      }
      if (theme === 'light:solarized') {
        this.editor.theme = 'solarized_light'
      }
      if (theme === 'light:xcode') {
        this.editor.theme = 'xcode'
      }
      if (theme === 'light:textmate') {
        this.editor.theme = 'textmate'
      }
      if (theme === 'dark:one') {
        this.editor.theme = 'one_dark'
      }
      if (theme === 'dark:dracula') {
        this.editor.theme = 'dracula'
      }
      if (theme === 'dark:monokai') {
        this.editor.theme = 'monokai'
      }
      if (theme === 'dark:merbivore') {
        this.editor.theme = 'merbivore_soft'
      }

      store.preferences.set('theme', theme)
      store.preferences.set('editor', { ...this.editor })
    },
    resetEditorSettings () {
      this.editor = EDITOR_DEFAULTS
    },
    isEditorSettingsValid (settings: EditorSettings) {
      const defaults = Object.keys(EDITOR_DEFAULTS)
      const toCompare = Object.keys(settings)

      return defaults.every(i => toCompare.includes(i))
    },
    setLang (lang: string) {
      this.language = lang
      store.preferences.set('language', lang)
    }
  }
})
