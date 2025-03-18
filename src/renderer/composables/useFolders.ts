import type { FoldersTreeResponse } from '@/services/api/generated'
import { useApp } from '@/composables'
import { store } from '@/electron'
import { api } from '@/services/api'

const {
  selectedFolderId,
  selectedLibrary,
  selectedSnippetContentIndex,
  selectedSnippetIdBeforeSearch,
} = useApp()

const folders = shallowRef<FoldersTreeResponse>()

async function getFolders() {
  const { data } = await api.folders.getFoldersTree()
  folders.value = data
}

function selectFolder(folderId: number) {
  selectedFolderId.value = folderId
  selectedLibrary.value = undefined
  selectedSnippetContentIndex.value = 0
  selectedSnippetIdBeforeSearch.value = undefined

  store.app.set('selectedFolderId', folderId)
  store.app.delete('selectedLibrary')
}

export function useFolders() {
  return {
    folders,
    getFolders,
    selectFolder,
  }
}
