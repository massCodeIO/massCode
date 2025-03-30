import type { LibraryFilter } from './types'
import { store } from '@/electron'
import { useCssVar } from '@vueuse/core'
import { LibraryTab } from './types'

const selectedLibrary = ref<
  (typeof LibraryFilter)[keyof typeof LibraryFilter] | undefined
>(
    store.app.get(
      'selectedLibrary',
    ) as (typeof LibraryFilter)[keyof typeof LibraryFilter],
    )
const selectedLibraryTab = ref<(typeof LibraryTab)[keyof typeof LibraryTab]>(
  LibraryTab.Library,
)
const selectedFolderId = ref(store.app.get('selectedFolderId'))
const selectedSnippetId = ref(store.app.get('selectedSnippetId'))
const selectedTagId = ref<number>()
const selectedSnippetContentIndex = ref(0)

const selectedSnippetIdBeforeSearch = ref(store.app.get('selectedSnippetId'))
const selectedSnippetIdBeforeTagSelect = ref<number>()

const highlightedFolderId = ref<number>()
const highlightedSnippetIds = ref<Set<number>>(new Set())
const highlightedTagId = ref<number>()

const isFocusedSnippetName = ref(false)

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('snippetListWidth')}px`

export function useApp() {
  return {
    highlightedFolderId,
    highlightedSnippetIds,
    highlightedTagId,
    isFocusedSnippetName,
    selectedFolderId,
    selectedLibrary,
    selectedLibraryTab,
    selectedSnippetContentIndex,
    selectedSnippetId,
    selectedSnippetIdBeforeSearch,
    selectedSnippetIdBeforeTagSelect,
    selectedTagId,
    sidebarWidth,
    snippetListWidth,
  }
}
