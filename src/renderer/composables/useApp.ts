import type { LibraryFilter } from './types'
import { store } from '@/electron'
import { useCssVar } from '@vueuse/core'

const selectedLibrary = ref<
  (typeof LibraryFilter)[keyof typeof LibraryFilter] | undefined
>(
    store.app.get(
      'selectedLibrary',
    ) as (typeof LibraryFilter)[keyof typeof LibraryFilter],
    )
const selectedFolderId = ref(store.app.get('selectedFolderId'))
const selectedSnippetId = ref(store.app.get('selectedSnippetId'))
const selectedSnippetIdBeforeSearch = ref(store.app.get('selectedSnippetId'))
const selectedSnippetContentIndex = ref(0)
const highlightedFolderId = ref<number>()
const highlightedSnippetIds = ref<Set<number>>(new Set())

const isFocusedSnippetName = ref(false)

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('snippetListWidth')}px`

export function useApp() {
  return {
    highlightedFolderId,
    highlightedSnippetIds,
    selectedFolderId,
    selectedLibrary,
    selectedSnippetContentIndex,
    selectedSnippetId,
    selectedSnippetIdBeforeSearch,
    sidebarWidth,
    snippetListWidth,
    isFocusedSnippetName,
  }
}
