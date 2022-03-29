import { useApi } from '@/composable'
import { store, db } from '@/electron'
import { flatToNested } from '@/utils'
import type { Folder, FolderTree } from '@@/types/db'
import { defineStore } from 'pinia'
import type { State } from './types'
import { nestedToFlat } from '../../main/utils'

export const useFolderStore = defineStore('folders', {
  state: () =>
    ({
      folders: [],
      foldersTree: [],
      selected: undefined,
      selectedId: undefined
    } as State),

  getters: {
    system: state => state.folders.filter(i => i.isSystem),
    main: state => state.folders.filter(i => !i.isSystem),
    selectedIds (): string[] {
      const ids = [this.selectedId!]
      this.selected?.children.forEach(i => ids.push(i.id))
      return ids
    }
  },

  actions: {
    async getFolders () {
      const { data } = await useApi<Folder[]>('/folders').get().json()
      this.folders = data.value
      this.foldersTree = flatToNested(this.folders.filter(i => !i.isSystem))
    },
    async patchFoldersById (id: string, body: Partial<Folder>) {
      body.updatedAt = new Date().valueOf()
      await useApi(`/folders/${id}`).patch(body)
      await this.getFolders()
    },
    async updateSort () {
      const { data } = await useApi('/db').get().json()

      db.updateTable(
        'folders',
        [
          ...JSON.parse(JSON.stringify(this.system)),
          ...nestedToFlat(this.foldersTree)
        ],
        data.value
      )
      await useApi('/restart').get()
    },
    selectId (id: string) {
      this.selectedId = id
      this.selected = this.getSelectedFolder()
      store.app.set('selectedFolderId', id)
      store.app.set('selectedFolderIds', this.selectedIds)
    },
    getSelectedFolder () {
      let folder: FolderTree | undefined

      const findFolderById = (id: string, folders: FolderTree[]) => {
        folders.forEach(i => {
          if (i.id === id) {
            folder = i
          } else if (i.children) {
            findFolderById(id, i.children as FolderTree[])
          }
        })
      }

      findFolderById(this.selectedId!, this.foldersTree)

      return folder
    }
  }
})
