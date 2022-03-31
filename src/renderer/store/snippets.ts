import type { Language } from '@/components/editor/types'
import { useApi } from '@/composable'
import { store } from '@/electron'
import type { Snippet, SnippetContent } from '@@/types/db'
import { defineStore } from 'pinia'
import { useFolderStore } from './folders'
import type { SnippetWithFolder, State } from './types/snippets'

export const useSnippetStore = defineStore('snippets', {
  state: () =>
    ({
      snippets: [],
      snippet: undefined,
      fragment: 0
    } as State),

  getters: {
    snippetsNonDeleted: state =>
      state.snippets.filter(i => !i.isDeleted) as SnippetWithFolder[],
    snippetsDeleted: state =>
      state.snippets.filter(i => !i.isDeleted) as SnippetWithFolder[],
    selectedId: state => state.snippet?.id,
    currentContent: state => state.snippet?.content[state.fragment]?.value,
    currentLanguage: state =>
      state.snippet?.content[state.fragment]?.language,
    fragmentLabels: state => state.snippet?.content.map(i => i.label),
    fragmentCount: state => state.snippet?.content.length,
    isFragmentsShow () {
      return this.fragmentLabels?.length > 1
    }
  },

  actions: {
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

      this.snippets = snippets.sort((a, b) =>
        a.createdAt > b.createdAt ? -1 : 1
      )
    },
    async getSnippetsById (id: string) {
      const { data } = await useApi<Snippet>(`/snippets/${id}`).get().json()
      this.snippet = data.value
      store.app.set('selectedSnippetId', id)
    },
    async patchSnippetsById (id: string, body: Partial<Snippet>) {
      const { data } = await useApi(`/snippets/${id}`).patch(body).json()
      const snippet = this.snippets.find(i => i.id === id)

      if (!snippet) return

      if (snippet.name !== data.value.name) {
        snippet.name = data.value.name
      }
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
    }
  }
})
