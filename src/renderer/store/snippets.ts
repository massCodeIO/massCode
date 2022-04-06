import type { Language } from '../../shared/types/renderer/editor'
import type { SystemFolderAlias } from '@shared/types/renderer/sidebar'
import { useApi } from '@/composable'
import { store } from '@/electron'
import type { Folder, Snippet, SnippetContent } from '@shared/types/main/db'
import { defineStore } from 'pinia'
import { useFolderStore } from './folders'
import type {
  SnippetWithFolder,
  State
} from '@shared/types/renderer/store/snippets'

export const useSnippetStore = defineStore('snippets', {
  state: () =>
    ({
      all: [],
      snippets: [],
      selected: undefined,
      selectedMultiple: [],
      fragment: 0,
      isContextState: false
    } as State),

  getters: {
    selectedId: state => state.selected?.id,
    selectedIds: state => state.selectedMultiple.map(i => i.id),
    selectedIndex: state =>
      state.snippets.findIndex(i => i.id === state.selected?.id),
    currentContent: state =>
      state.selected?.content?.[state.fragment]?.value || undefined,
    currentLanguage: state =>
      state.selected?.content?.[state.fragment]?.language,
    fragmentLabels: state => state.selected?.content?.map(i => i.label),
    fragmentCount: state => state.selected?.content?.length,
    isFragmentsShow () {
      return this.fragmentLabels?.length > 1
    }
  },

  actions: {
    async getSnippets () {
      // Почему то не работает _expand
      const { data } = await useApi('/snippets?_expand=folder`').get().json()
      const { data: folderData } = await useApi('/folders').get().json()

      // Поэтому добавляем folder самостоятельно
      this.all = data.value.map((i: SnippetWithFolder) => {
        const folder = folderData.value.find((f: Folder) => f.id === i.folderId)
        if (folder) i.folder = folder
        return i
      })
    },
    async getSnippetsByFolderIds (ids: string[]) {
      const snippets: SnippetWithFolder[] = []

      for (const id of ids) {
        const { data } = await useApi<SnippetWithFolder[]>(
          `/folders/${id}/snippets?_expand=folder`
        )
          .get()
          .json()

        snippets.push(...data.value)
      }

      this.snippets = snippets
        .filter(i => !i.isDeleted)
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    },
    async getSnippetsById (id: string) {
      if (id) {
        const { data } = await useApi<Snippet>(`/snippets/${id}`).get().json()
        this.selected = data.value
        store.app.set('selectedSnippetId', id)
      } else {
        store.app.delete('selectedSnippetId')
        this.selected = undefined
      }
    },
    async patchSnippetsById (id: string, body: Partial<Snippet>) {
      const { data } = await useApi(`/snippets/${id}`).patch(body).json()
      const snippet = this.snippets.find(i => i.id === id)

      if (!snippet) return

      if (snippet.name !== data.value.name) {
        snippet.name = data.value.name
      }

      await this.getSnippets()
    },
    async patchCurrentSnippetContentByKey (
      key: keyof SnippetContent,
      value: string | Language
    ) {
      const folderStore = useFolderStore()
      const body: Partial<Snippet> = {}
      const content = this.selected?.content

      if (content) {
        (content[this.fragment] as any)[key] = value
        body.content = content
        body.updatedAt = new Date().valueOf()

        await useApi(`/snippets/${this.selectedId}`).patch(body)
        await this.getSnippetsByFolderIds(folderStore.selectedIds)
      }
    },
    async addNewSnippet () {
      const folderStore = useFolderStore()
      const body: Partial<Snippet> = {}

      body.name = 'Untitled snippet'
      body.folderId = folderStore.selectedId
      body.isDeleted = false
      body.isFavorites = false
      body.tagsIds = []
      body.content = [
        {
          label: 'Fragment 1',
          language: folderStore.selected?.defaultLanguage || 'plain_text',
          value: ''
        }
      ]

      const { data } = await useApi('/snippets').post(body).json()

      this.selected = data.value
      store.app.set('selectedSnippetId', this.selected!.id)
    },
    async duplicateSnippetById (id: string) {
      const snippet = this.snippets.find(i => i.id === id)

      if (snippet) {
        const body = Object.assign({}, snippet)
        body.name = body.name + ' Copy'

        const { data } = await useApi('/snippets').post(body).json()
        this.selected = data.value
        this.fragment = 0

        store.app.set('selectedSnippetId', this.selected!.id)
      }
    },
    async addNewFragmentToSnippetsById (id: string) {
      const folderStore = useFolderStore()
      const content = [...this.selected!.content]
      const fragmentCount = content.length + 1
      const body: Partial<Snippet> = {}

      content.push({
        label: `Fragment ${fragmentCount}`,
        language: folderStore.selected?.defaultLanguage || 'plain_text',
        value: ''
      })

      body.content = content

      await this.patchSnippetsById(id, body)
      await this.getSnippetsByFolderIds(folderStore.selectedIds)
      await this.getSnippetsById(id)
    },
    async deleteCurrentSnippetFragmentByIndex (index: number) {
      const body: Partial<Snippet> = {}
      const content = [...this.selected!.content]

      content.splice(index, 1)
      body.content = content

      await this.patchSnippetsById(this.selectedId!, body)
      await this.getSnippetsById(this.selectedId!)
    },
    async deleteSnippetsById (id: string) {
      await useApi(`/snippets/${id}`).delete()
    },
    async deleteSnippetsByIds (ids: string[]) {
      for (const id of ids) {
        await useApi(`/snippets/${id}`).delete()
      }
    },
    async setSnippetsByFolderIds (setFirst?: boolean) {
      const folderStore = useFolderStore()
      await this.getSnippetsByFolderIds(folderStore.selectedIds!)

      if (setFirst) {
        this.selected = this.snippets[0]
        if (this.selected) {
          store.app.set('selectedSnippetId', this.snippets[0].id)
        }
      }
    },
    setSnippetsByAlias (alias: SystemFolderAlias) {
      const folderStore = useFolderStore()

      let snippets: SnippetWithFolder[] = []

      if (alias === 'inbox') {
        snippets = this.all.filter(i => !i.folderId && !i.isDeleted)
      }

      if (alias === 'all') {
        snippets = this.all.filter(i => !i.isDeleted)
      }

      if (alias === 'favorites') {
        snippets = this.all.filter(i => i.isFavorites && !i.isDeleted)
      }

      if (alias === 'trash') {
        snippets = this.all.filter(i => i.isDeleted)
      }

      this.snippets = snippets
      this.selected = snippets[0]

      folderStore.selectedId = undefined
      folderStore.selectedIds = undefined
      folderStore.selectedAlias = alias

      store.app.set('selectedFolderAlias', alias)
      store.app.delete('selectedFolderId')
      store.app.delete('selectedFolderIds')
    },
    setSnippetById (id: string) {
      const snippet = this.all.find(i => i.id === id)
      if (snippet) this.selected = snippet
    }
  }
})
