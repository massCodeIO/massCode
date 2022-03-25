import { useApi } from '@/composable'
import { store } from '@/electron'
import type { Folder } from '@@/types/db'
import { defineStore } from 'pinia'
import type { State } from './types'

export const useFolderStore = defineStore('folders', {
  state: () =>
    ({
      folders: [],
      selectedId: undefined
    } as State),

  getters: {
    system: state => state.folders.filter(i => i.isSystem),
    main: state => state.folders.filter(i => !i.isSystem)
  },

  actions: {
    async getFolders () {
      const { data } = await useApi<Folder[]>('/folders').get().json()
      this.folders = data.value
    },
    async patchFoldersById (id: string, body: Partial<Folder>) {
      body.updatedAt = new Date().valueOf()
      await useApi(`/folders/${id}`).patch(body)
      await this.getFolders()
    },
    selectId (id: string) {
      this.selectedId = id
      store.app.set('selectedFolderId', id)
    }
  }
})
