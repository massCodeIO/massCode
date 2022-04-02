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
      selectedId: undefined,
      selectedIds: undefined,
      selectedAlias: undefined
    } as State),

  getters: {
    system: state => state.folders.filter(i => i.isSystem),
    main: state => state.folders.filter(i => !i.isSystem)
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
      this.selected = this.findFolderById(id, this.foldersTree)
      this.selectedAlias = undefined
      const ids = this.getIds([this.selected!])
      this.selectedIds = ids

      store.app.set('selectedFolderId', id)
      store.app.set('selectedFolderIds', ids)
      store.app.delete('selectedFolderAlias')
    },
    findFolderById (id: string, folders: FolderTree[]) {
      let folder: FolderTree | undefined

      const find = (id: string, folders: FolderTree[]) => {
        folders.forEach(i => {
          console.log(i.id, id)
          if (i.id === id) {
            folder = i
          } else if (i.children) {
            find(id, i.children as FolderTree[])
          }
        })
      }

      find(id, folders)

      return folder
    },
    getIds (folders: FolderTree[]) {
      const ids: string[] = []

      const find = (folders: FolderTree[]) => {
        folders.forEach(i => {
          ids.push(i.id)

          if (i.children && i.children.length) {
            find(i.children as FolderTree[])
          }
        })
      }

      find(folders)

      return ids
    }
  }
})
