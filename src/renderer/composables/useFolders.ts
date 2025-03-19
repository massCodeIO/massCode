import type {
  FoldersTreeResponse,
  FoldersUpdate,
} from '@/services/api/generated'
import { useApp, useSnippets } from '@/composables'
import { i18n, store } from '@/electron'
import { api } from '@/services/api'
import { scrollToElement } from '../utils'

const {
  selectedFolderId,
  selectedLibrary,
  selectedSnippetContentIndex,
  selectedSnippetIdBeforeSearch,
} = useApp()

const folders = shallowRef<FoldersTreeResponse>()

const renameFolderId = ref<number | null>(null)

async function getFolders() {
  try {
    const { data } = await api.folders.getFoldersTree()
    folders.value = data
  }
  catch (error) {
    console.error(error)
  }
}

async function createFolder() {
  try {
    const { data } = await api.folders.postFolders({
      name: i18n.t('folder.untitled'),
    })

    await getFolders()

    return data.id
  }
  catch (error) {
    console.error(error)
  }
}

async function createFolderAndSelect() {
  const { clearSnippetsState } = useSnippets()
  const id = await createFolder()

  if (id) {
    selectFolder(Number(id))
    clearSnippetsState()
    scrollToElement(`[id="${id}"]`)
    renameFolderId.value = Number(id)
  }
}

async function updateFolder(folderId: number, data: FoldersUpdate) {
  try {
    await api.folders.putFoldersById(String(folderId), data)
    await getFolders()

    if (folderId === selectedFolderId.value) {
      const { getSnippets } = useSnippets()
      await getSnippets({ folderId })
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteFolder(folderId: number) {
  try {
    await api.folders.deleteFoldersById(String(folderId))
    await getFolders()
  }
  catch (error) {
    console.error(error)
  }
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
    createFolder,
    createFolderAndSelect,
    deleteFolder,
    folders,
    getFolders,
    renameFolderId,
    selectFolder,
    updateFolder,
  }
}
