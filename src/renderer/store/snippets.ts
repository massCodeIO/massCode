import type { Language } from '@/components/editor/types'
import type { SystemFolderAlias } from '@/components/sidebar/types'
import { useApi } from '@/composable'
import { store } from '@/electron'
import type { Folder, Snippet, SnippetContent } from '@@/types/db'
import { defineStore } from 'pinia'
import { useFolderStore } from './folders'
import type { SnippetWithFolder, State } from './types/snippets'

export const useSnippetStore = defineStore('snippets', {
  state: () =>
    ({
      all: [],
      snippets: [],
      snippet: undefined,
      fragment: 0
    } as State),

  getters: {
    selectedId: state => state.snippet?.id,
    currentContent: state =>
      state.snippet?.content?.[state.fragment]?.value || undefined,
    currentLanguage: state =>
      state.snippet?.content?.[state.fragment]?.language,
    fragmentLabels: state => state.snippet?.content?.map(i => i.label),
    fragmentCount: state => state.snippet?.content?.length,
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
        this.snippet = data.value
        store.app.set('selectedSnippetId', id)
      } else {
        store.app.delete('selectedSnippetId')
        this.snippet = undefined
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
      const content = this.snippet?.content

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
      body.content = [
        {
          label: 'Fragment 1',
          language: folderStore.selected?.defaultLanguage || 'plain_text',
          value: ''
        }
      ]

      const { data } = await useApi('/snippets').post(body).json()

      this.snippet = data.value
      store.app.set('selectedSnippetId', this.snippet!.id)
    },
    async duplicateSnippetById (id: string) {
      const snippet = this.snippets.find(i => i.id === id)

      if (snippet) {
        const body = Object.assign({}, snippet)
        body.name = body.name + ' Copy'

        const { data } = await useApi('/snippets').post(body).json()
        this.snippet = data.value
        this.fragment = 0

        store.app.set('selectedSnippetId', this.snippet!.id)
      }
    },
    async addNewFragmentToSnippetsById (id: string) {
      const folderStore = useFolderStore()
      const content = [...this.snippet!.content]
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
      const content = [...this.snippet!.content]

      content.splice(index, 1)
      body.content = content

      await this.patchSnippetsById(this.selectedId!, body)
      await this.getSnippetsById(this.selectedId!)
    },
    async setSnippetsByFolderIds (setFirst?: boolean) {
      const folderStore = useFolderStore()
      await this.getSnippetsByFolderIds(folderStore.selectedIds!)

      if (setFirst) {
        this.snippet = this.snippets[0]
        store.app.set('selectedSnippetId', this.snippets[0].id)
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
      this.snippet = snippets[0]

      folderStore.selectedId = undefined
      folderStore.selectedAlias = alias

      store.app.set('selectedFolderAlias', alias)
      store.app.delete('selectedFolderId')
      store.app.delete('selectedFolderIds')
    },
    setSnippetById (id: string) {
      const snippet = this.all.find(i => i.id === id)
      if (snippet) this.snippet = snippet
    }
  }
})
