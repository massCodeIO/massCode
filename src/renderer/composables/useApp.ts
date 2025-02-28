import type { LibraryFilter } from './types'
import { useCssVar } from '@vueuse/core'

const { store } = window.electron

const libraryFilterSelected = ref<LibraryFilter>()
const selectedFolderId = ref<number>(store.app.get('selectedFolderId'))
const selectedSnippetId = ref<number>(store.app.get('selectedSnippetId'))

const sidebarWidth = useCssVar('--sidebar-width')
const snippetListWidth = useCssVar('--snippet-list-width')

sidebarWidth.value = `${store.app.get('sidebarWidth')}px`
snippetListWidth.value = `${store.app.get('snippetListWidth')}px`

function selectFolder(folderId: number) {
  selectedFolderId.value = folderId
  store.app.set('selectedFolderId', folderId)
}

export function useApp() {
  return {
    libraryFilterSelected,
    selectedFolderId,
    selectedSnippetId,
    sidebarWidth,
    snippetListWidth,
    selectFolder,
  }
}
