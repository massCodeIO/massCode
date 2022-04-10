import { platform } from '@/electron'
import type { State } from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'
import { version } from '../../../package.json'

export const useAppStore = defineStore('app', {
  state: (): State => ({
    isInit: false,
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
    },
    version,
    platform: platform()
  })
})
