import { useApi } from '@/composable'
import { i18n, store } from '@/electron'
import { flatToNested } from '@/utils'
import type { Folder, FolderTree } from '@shared/types/main/db'
import { defineStore } from 'pinia'
import type { State } from '@shared/types/renderer/store/folders'
import { nestedToFlat } from '../../main/utils'
import type { SnippetWithFolder } from '@shared/types/renderer/store/snippets'
import { useSnippetStore } from './snippets'

export const useFolderStore = defineStore('folders', {
  state: () =>
    ({
      folders: [],
      foldersTree: [],
      selected: undefined,
      selectedId: undefined,
      selectedContextId: undefined,
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
    async addNewFolder () {
      const snippetStore = useSnippetStore()

      const body: Partial<Folder> = {
        name: i18n.t('folder.untitled'),
        parentId: null,
        isOpen: false,
        isSystem: false,
        defaultLanguage: 'plain_text'
      }

      const { data } = await useApi('/folders').post(body).json()

      await this.getFolders()
      this.selectId(data.value.id)
      await snippetStore.getSnippetsByFolderIds(this.selectedIds!)
      return data.value as Folder
    },
    async patchFoldersById (id: string, body: Partial<Folder>) {
      body.updatedAt = new Date().valueOf()
      await useApi(`/folders/${id}`).patch(body)
      await this.getFolders()

      if (id === this.selectedId) {
        this.selected = this.findFolderById(id, this.foldersTree)
      }
    },
    async updateFoldersTable () {
      const body = {
        value: [
          ...JSON.parse(JSON.stringify(this.system)),
          ...nestedToFlat(this.foldersTree)
        ]
      }
      await useApi('/db/update/folders').post(body)
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
    },
    async deleteFoldersById (id: string) {
      const snippetStore = useSnippetStore()
      const folder = this.findFolderById(id, this.foldersTree)
      const folderIds: string[] = []
      const snippetsIds: string[] = []

      if (folder) {
        const ids = this.getIds([folder])
        folderIds.push(...ids)
      }

      for (const id of folderIds) {
        const { data } = await useApi<SnippetWithFolder[]>(
          `/folders/${id}/snippets?_expand=folder`
        )
          .get()
          .json()
        data.value.forEach((i: any) => {
          snippetsIds.push(i.id)
        })
      }

      console.log(snippetsIds)

      for (const id of snippetsIds) {
        await useApi(`/snippets/${id}`).patch({
          folderId: '',
          isDeleted: true
        })
      }

      for (const id of folderIds) {
        await useApi(`/folders/${id}`).delete()
      }

      await this.getFolders()
      await snippetStore.getSnippets()
      snippetStore.setSnippetsByAlias('trash')
    },
    openFolders (action: 'open' | 'close') {
      if (action === 'open') {
        this.folders.forEach(async i => {
          this.patchFoldersById(i.id, {
            isOpen: true
          })
        })
      } else {
        this.folders.forEach(i => {
          this.patchFoldersById(i.id, {
            isOpen: false
          })
        })
      }
    }
  }
})
