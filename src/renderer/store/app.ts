import type { State } from '@shared/types/renderer/store/app'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () =>
    ({
      theme: 'light'
    } as State)
})
