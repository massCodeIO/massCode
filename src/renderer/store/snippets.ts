import type { Language } from '@/components/editor/types'
import { useApi } from '@/composable'
import { store } from '@/electron'
import type { Snippet, SnippetContent } from '@@/types/db'
import { defineStore } from 'pinia'
import type { SnippetWithFolder, State } from './types/snippets'

export const useSnippetStore = defineStore('snippets', {
  state: () =>
    ({
      snippets: [],
      snippet: undefined,
      fragment: 0
    } as State),

  getters: {
    selectedId: state => state.snippet?.id,
    currentContent: state => state.snippet?.content[state.fragment].value,
    currentLanguage: state => state.snippet?.content[state.fragment].language,
    fragmentLabels: state => state.snippet?.content.map(i => i.label),
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
      body.updatedAt = new Date().valueOf()
    },
    async patchCurrentSnippetContentByKey (
      key: keyof SnippetContent,
      value: string | Language
    ) {
      const body: Partial<Snippet> = {}
      const content = this.snippet?.content

      if (content) {
        (content[this.fragment] as any)[key] = value
        body.content = content
        body.updatedAt = new Date().valueOf()

        await useApi(`/snippets/${this.selectedId}`).patch(body)
      }
    }
  }
})
