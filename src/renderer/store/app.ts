import type { State } from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () =>
    ({
      theme: 'light',
      showTags: true,
      sizes: {
        editor: {
          titleHeight: 30,
          fragmentsHeight: 25,
          tagsHeight: 40,
          footerHeight: 30
        }
      }
    } as State)
})
