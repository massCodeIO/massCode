import { platform } from '@/electron'
import type { EditorSettings, State } from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'
import { version } from '../../../package.json'

const EDITOR_DEFAULTS: EditorSettings = {
  fontFamily: 'SF Mono, Consolas, Menlo',
  fontSize: 12,
  showInvisibles: false,
  tabSize: 2,
  wrap: 'free'
}

export const useAppStore = defineStore('app', {
  state: (): State => ({
    isInit: false,
    theme: 'light',
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
