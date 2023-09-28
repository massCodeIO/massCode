import { goToSnippet } from '@/composable'
import { platform, store } from '@/electron'
import type { MarkdownSettings } from '@shared/types/main/store'
import type {
  CodePreviewSettings,
  EditorSettings,
  ScreenshotSettings,
  State,
  Theme
} from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'
import { version } from '../../../package.json'

export const EDITOR_DEFAULTS: EditorSettings = {
  fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
  fontSize: 12,
  tabSize: 2,
  wrap: true,
  trailingComma: 'none',
  semi: false,
  singleQuote: true,
  highlightLine: false,
  highlightGutter: false,
  matchBrackets: false
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

const MARKDOWN_DEFAULTS: MarkdownSettings = {
  presentationScale: 1.3,
  codeRenderer: 'highlight.js'
}

const HISTORY_LIMIT = 50

export const useAppStore = defineStore('app', {
  state: (): State => ({
    isInit: false,
    isSponsored: import.meta.env.VITE_SPONSORED === 'true',
    theme: 'light:github',
    showTags: true,
    showModal: false,
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
    markdown: MARKDOWN_DEFAULTS,
    selectedPreferencesMenu: 'storage',
    selectedDevtoolsMenu: 'textTools.caseConverter',
    language: store.preferences.get('language'),
    history: [],
    historyIndex: 0,
    version,
    platform: platform()
  }),

  getters: {
    isLightTheme: state => !!state.theme.match(/^light/)
  },

  actions: {
    setTheme (theme: Theme) {
      this.theme = theme

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
    },
    addToHistory (snippetId: string) {
      if (!snippetId) return
      if (this.history[this.history.length - 1] === snippetId) return

      if (this.history.length === HISTORY_LIMIT) this.history.shift()

      this.history.push(snippetId)
      this.historyIndex = this.history.length - 1
    },
    historyBack () {
      if (this.historyIndex === 0) return

      this.historyIndex = this.historyIndex - 1
      goToSnippet(this.history[this.historyIndex])
    },
    historyForward () {
      if (this.historyIndex === this.history.length - 1) return

      this.historyIndex = this.historyIndex + 1
      goToSnippet(this.history[this.historyIndex])
    }
  }
})
