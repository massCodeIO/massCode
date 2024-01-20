import type { Language } from '../../shared/types/renderer/editor'
import type { SystemFolderAlias } from '@shared/types/renderer/sidebar'
import { sortSnippetsBy, useApi } from '@/composable'
import { i18n, store } from '@/electron'
import type {
  Snippet,
  SnippetContent,
  SnippetsSort,
  Tag
} from '@shared/types/main/db'
import { defineStore } from 'pinia'
import { useFolderStore } from './folders'
import type {
  SnippetWithFolder,
  State,
  PreviewType
} from '@shared/types/renderer/store/snippets'
import { useTagStore } from './tags'
import { useAppStore } from './app'
import Fuse from 'fuse.js'

export const useSnippetStore = defineStore('snippets', {
  state: (): State => ({
    all: [],
    snippets: [],
    selected: undefined,
    selectedMultiple: [],
    fragment: 0,
    searchQuery: undefined,
    searchQueryEscaped: undefined,
    sort: 'updatedAt',
    hideSubfolderSnippets: false,
    compactMode: false,
    isContextState: false,
    isMarkdownPreview: false,
    isMindmapPreview: false,
    isScreenshotPreview: false,
    isCodePreview: false
  }),

  getters: {
    snippetsByFilter: (state): SnippetWithFolder[] => {
      const folderStore = useFolderStore()

      if (folderStore.selectedAlias) {
        return state.snippets
      }

      if (state.hideSubfolderSnippets) {
        return state.snippets.filter(
          i => i.folderId === folderStore.selectedId
        )
      }

      return state.snippets
    },
    selectedId: state => state.selected?.id,
    selectedIds: state => state.selectedMultiple.map(i => i.id),
    selectedIndex () {
      // @ts-expect-error
      // FIXME: Разобраться с типами
      return this.snippetsByFilter.findIndex(i => i.id === this.selected?.id)
    },
    currentContent: state =>
      state.selected?.content?.[state.fragment]?.value || undefined,
    currentLanguage: state =>
      state.selected?.content?.[state.fragment]?.language,
    currentTags (): Tag[] {
      const tagStore = useTagStore()
      const tags: Tag[] = []

      if (this.selected?.tagsIds?.length) {
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
    },
    isDescriptionShow: state =>
      typeof state.selected?.description === 'string'
  },

  actions: {
    async getSnippets () {
      const { data } = await useApi('/snippets/embed-folder').get().json()

      this.all = data.value
      sortSnippetsBy(this.all, this.sort)
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

      this.snippets = snippets.filter(i => !i.isDeleted)
      sortSnippetsBy(this.snippets, this.sort)
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
      const snippet = this.snippets.find(i => i.id === id)

      if (!snippet) return

      if (snippet.id === this.selectedId) {
        for (const props in body) {
          (this.selected as any)[props] = (body as any)[props]
        }
      }

      for (const props in body) {
        (snippet as any)[props] = (body as any)[props]
      }

      await useApi(`/snippets/${id}`).patch(body).json()
    },
    async patchCurrentSnippetContentByKey (
      key: keyof SnippetContent,
      value: string | Language
    ) {
      const body: Partial<Snippet> = {}
      const content = this.selected?.content

      if (content) {
        (content[this.fragment] as any)[key] = value
        body.content = content
        body.updatedAt = new Date().valueOf()

        await useApi(`/snippets/${this.selectedId}`).patch(body)
      }
    },
    async addNewSnippet (body?: Partial<Snippet>) {
      const folderStore = useFolderStore()
      let _body: Partial<Snippet> = {}

      _body.isDeleted = false
      _body.isFavorites = false
      _body.folderId = ''
      _body.tagsIds = []
      _body.description = null

      if (body) {
        _body = {
          ..._body,
          name: body.name,
          content: body.content
        }
      } else {
        _body.name = i18n.t('snippet.untitled')
        _body.folderId = folderStore.selectedId || ''
        _body.content = [
          {
            label: `${i18n.t('fragment')} 1`,
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
        label: `${i18n.t('fragment')} ${fragmentCount}`,
        language: folderStore.selected?.defaultLanguage || 'plain_text',
        value: ''
      })

      body.content = content

      await this.patchSnippetsById(id, body)
      this.fragment = content.length - 1
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
    async setSnippetsByAlias (alias: SystemFolderAlias) {
      const folderStore = useFolderStore()

      folderStore.selectedAlias = alias
      folderStore.selected = undefined
      folderStore.selectedId = undefined
      folderStore.selectedIds = undefined

      await this.getSnippets()

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
      sortSnippetsBy(this.snippets, this.sort)

      this.selected = snippets[0]

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
      const snippet = this.findSnippetById(id)
      if (snippet) this.selected = snippet
    },
    findSnippetById (id: string) {
      return this.all.find(i => i.id === id)
    },
    async emptyTrash () {
      const ids = this.all.filter(i => i.isDeleted).map(i => i.id)
      await this.deleteSnippetsByIds(ids)
    },
    search (query: string) {
      let q = query
      let isExactSearch = false

      // обрезка кавычек для точного поиска
      if (query.startsWith('"') && query.endsWith('"')) {
        isExactSearch = true
        q = query.slice(1, -1)
      }

      this.searchQueryEscaped = q

      if (!q) {
        this.setSnippetsByAlias('all')
        this.searchQueryEscaped = undefined
        return
      }

      const fuse = new Fuse(this.all, {
        includeScore: true,
        threshold: isExactSearch ? 0 : 0.4,
        ignoreLocation: true,
        keys: ['name', 'content.value', 'description']
      })

      const result = fuse.search(q)

      this.snippets = result.map(i => i.item)
      this.selected = this.snippets[0]
    },
    setSort (sort: SnippetsSort) {
      this.sort = sort
      store.app.set('sort', sort)

      sortSnippetsBy(this.snippets, this.sort)
    },
    togglePreview (type: PreviewType) {
      switch (type) {
        case 'markdown':
          this.isMarkdownPreview = !this.isMarkdownPreview
          this.isMindmapPreview = false
          this.isScreenshotPreview = false
          this.isCodePreview = false
          break
        case 'mindmap':
          this.isMarkdownPreview = false
          this.isMindmapPreview = !this.isMindmapPreview
          this.isScreenshotPreview = false
          this.isCodePreview = false
          break
        case 'screenshot':
          this.isMarkdownPreview = false
          this.isMindmapPreview = false
          this.isScreenshotPreview = !this.isScreenshotPreview
          this.isCodePreview = false
          break
        case 'code':
          this.isMarkdownPreview = false
          this.isMindmapPreview = false
          this.isScreenshotPreview = false
          this.isCodePreview = !this.isCodePreview
          break
      }
    }
  }
})
