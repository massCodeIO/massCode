import type { State } from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: (): State => ({
    theme: 'light',
    showTags: true,
    sizes: {
      titlebar: 15,
      editor: {
        titleHeight: 34,
        fragmentsHeight: 25,
        tagsHeight: 40,
        footerHeight: 30
      }
    }
  })
})
