import type { Language } from '../../shared/types/renderer/editor'
import type { SystemFolderAlias } from '@shared/types/renderer/sidebar'
import { useApi } from '@/composable'
import { store } from '@/electron'
import type {
  Folder,
  Snippet,
  SnippetContent,
  Tag
} from '@shared/types/main/db'
import { defineStore } from 'pinia'
import { useFolderStore } from './folders'
import type {
  SnippetWithFolder,
  State
} from '@shared/types/renderer/store/snippets'
import { useTagStore } from './tags'
import { useAppStore } from './app'
import { uniqBy } from 'lodash'

export const useSnippetStore = defineStore('snippets', {
  state: (): State => ({
    all: [],
    snippets: [],
    selected: undefined,
    selectedMultiple: [],
    fragment: 0,
    searchQuery: undefined,
    isContextState: false,
    isMarkdownPreview: false
  }),

  getters: {
    selectedId: state => state.selected?.id,
    selectedIds: state => state.selectedMultiple.map(i => i.id),
    selectedIndex: state =>
      state.snippets.findIndex(i => i.id === state.selected?.id),
    currentContent: state =>
      state.selected?.content?.[state.fragment]?.value || undefined,
    currentLanguage: state =>
      state.selected?.content?.[state.fragment]?.language,
    currentTags (): Tag[] {
      const tagStore = useTagStore()
      const tags: Tag[] = []

      if (this.selected?.tagsIds.length) {
        this.selected.tagsIds.forEach(i => {
          const tag = tagStore.tags.find(t => t.id === i)
          if (tag) tags.push(tag)
        })
      }

      return tags
    },
    fragmentLabels: state => state.selected?.content?.map(i => i.label),
    fragmentCount: state => state.selected?.content?.length,
    tagsCount: state => state.selected?.tagsIds?.length,
    isFragmentsShow (): boolean {
      return this.fragmentCount ? this.fragmentCount > 1 : false
    },
    isTagsShow (): boolean {
      const appStore = useAppStore()
      return this.tagsCount ? this.tagsCount > 0 : appStore.showTags
    }
  },

  actions: {
    async getSnippets () {
      const { data } = await useApi('/snippets/embed-folder').get().json()

      this.all = data.value
      this.all.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
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
        .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
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

      if (snippet.id === this.selected?.id) {
        this.selected.name = data.value.name
      }

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
        await this.getSnippetsByFolderIds(folderStore.selectedIds!)
      }
    },
    async addNewSnippet (body?: Partial<Snippet>) {
      const folderStore = useFolderStore()
      let _body: Partial<Snippet> = {}

      _body.isDeleted = false
      _body.isFavorites = false
      _body.folderId = ''
      _body.tagsIds = []

      if (body) {
        _body = {
          ..._body,
          name: body.name,
          content: body.content
        }
      } else {
        _body.name = 'Untitled snippet'
        _body.folderId = folderStore.selectedId || ''
        _body.content = [
          {
            label: 'Fragment 1',
            language: folderStore.selected?.defaultLanguage || 'plain_text',
            value: ''
          }
        ]
      }

      const { data } = await useApi('/snippets').post(_body).json()

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
      await this.getSnippetsByFolderIds(folderStore.selectedIds!)
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
      await useApi('/snippets/delete').post({ ids })
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

      folderStore.selected = undefined
      folderStore.selectedId = undefined
      folderStore.selectedIds = undefined
      folderStore.selectedAlias = alias

      store.app.set('selectedFolderAlias', alias)
      store.app.delete('selectedFolderId')
      store.app.delete('selectedFolderIds')
    },
    async setSnippetsByTagId (id: string) {
      const snippets: SnippetWithFolder[] = this.all.filter(i =>
        i.tagsIds.includes(id)
      )

      this.snippets = snippets
      this.selected = snippets[0]
    },
    setSnippetById (id: string) {
      const snippet = this.all.find(i => i.id === id)
      if (snippet) this.selected = snippet
    },
    async emptyTrash () {
      const ids = this.all.filter(i => i.isDeleted).map(i => i.id)
      await this.deleteSnippetsByIds(ids)
    },
    search (query: string) {
      const byName = this.all.filter(i =>
        i.name.toLowerCase().includes(query.toLowerCase())
      )

      const byContent = this.all.filter(i => {
        return i.content.some(c =>
          c.value.toLowerCase().includes(query.toLowerCase())
        )
      })

      this.snippets = uniqBy([...byName, ...byContent], 'id')
      this.selected = this.snippets[0]
    }
  }
})
