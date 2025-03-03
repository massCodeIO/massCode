import type { LibraryFilter } from './types'
import { useCssVar } from '@vueuse/core'

const { store } = window.electron

const selectedLibrary = ref<
  (typeof LibraryFilter)[keyof typeof LibraryFilter] | undefined
>(
    store.app.get(
      'selectedLibrary',
    ) as (typeof LibraryFilter)[keyof typeof LibraryFilter],
    )
const selectedFolderId = ref(store.app.get('selectedFolderId'))
const selectedSnippetId = ref(store.app.get('selectedSnippetId'))
const highlightedFolderId = ref<number>()
const highlightedSnippetId = ref<number>()

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('snippetListWidth')}px`

function selectFolder(folderId: number) {
  selectedFolderId.value = folderId
  selectedLibrary.value = undefined
  store.app.set('selectedFolderId', folderId)
  store.app.delete('selectedLibrary')
}

watch(
  [highlightedFolderId, highlightedSnippetId],
  ([newFolderId, newSnippetId], [oldFolderId, oldSnippetId]) => {
    if (newFolderId !== oldFolderId && newFolderId !== undefined) {
      highlightedSnippetId.value = undefined
    }

    if (newSnippetId !== oldSnippetId && newSnippetId !== undefined) {
      highlightedFolderId.value = undefined
    }
  },
)

export function useApp() {
  return {
    selectedLibrary,
    selectedFolderId,
    selectedSnippetId,
    sidebarWidth,
    snippetListWidth,
    selectFolder,
    highlightedFolderId,
    highlightedSnippetId,
  }
}
