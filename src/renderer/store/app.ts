import { platform, store } from '@/electron'
import type {
  EditorSettings,
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

export const useAppStore = defineStore('app', {
  state: (): State => ({
    isInit: false,
    theme: 'light:chrome',
    showTags: true,
    sizes: {
      titlebar: 15,
      sidebar: 180,
      snippetList: 250,
      editor: {
        titleHeight: 34,
        fragmentsHeight: 25,
        tagsHeight: 40,
        footerHeight: 30
      }
    },
    editor: EDITOR_DEFAULTS,
    selectedPreferencesMenu: 'storage',
    version,
    platform: platform()
  }),

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
    }
  }
})
