import { store } from '@/electron'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'

import type { State } from '@shared/types/renderer/store/preferences'
import type { LanguageOption } from '@shared/types/renderer/editor'

export const usePreferencesStore = defineStore('preferences', {
  state: (): State => ({
    customLanguages: store.preferences.get('customLanguages') || []
  }),

  actions: {
    upsertCustomLanguage (language: LanguageOption, index: number) {
      this.customLanguages[index] = language
      store.preferences.set('customLanguages', toRaw(this.customLanguages))
    },
    removeCustomLanguage (index: number) {
      this.customLanguages.splice(index, 1)

      store.preferences.set('customLanguages', toRaw(this.customLanguages))
    }
  }
})
