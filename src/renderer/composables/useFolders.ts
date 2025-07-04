import type {
  FoldersTreeResponse,
  FoldersUpdate,
} from '@/services/api/generated'
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { scrollToElement } from '../utils'

const { state } = useApp()

const folders = shallowRef<FoldersTreeResponse>()

const renameFolderId = ref<number | null>(null)

function findParentFolderIds(folderId: number, allFolders: any[]): number[] {
  const parentIds: number[] = []

  function findParents(currentFolderId: number) {
    const folder = allFolders.find(f => f.id === currentFolderId)
    if (folder && folder.parentId) {
      parentIds.push(folder.parentId)
      findParents(folder.parentId)
    }
  }

  findParents(folderId)
  return parentIds
}

async function ensureSelectedFolderIsVisible() {
  if (!state.folderId || !folders.value) {
    return
  }

  const flatFolders: any[] = []

  function flattenFolders(folderList: any[]) {
    folderList.forEach((folder) => {
      flatFolders.push(folder)
      if (folder.children && folder.children.length > 0) {
        flattenFolders(folder.children)
      }
    })
  }

  flattenFolders(folders.value)

  const parentIds = findParentFolderIds(state.folderId, flatFolders)

  if (parentIds.length === 0) {
    return
  }

  const foldersToOpen = parentIds.filter((parentId) => {
    const folder = flatFolders.find(f => f.id === parentId)
    return folder && folder.isOpen === 0
  })

  if (foldersToOpen.length === 0) {
    return
  }

  try {
    const updateResults = await Promise.allSettled(
      foldersToOpen.map(folderId =>
        api.folders.patchFoldersById(String(folderId), { isOpen: 1 }),
      ),
    )

    const failedUpdates = updateResults
      .map((result, index) => ({ result, folderId: foldersToOpen[index] }))
      .filter(({ result }) => result.status === 'rejected')

    if (failedUpdates.length > 0) {
      console.warn('Some folders failed to open:', failedUpdates)
    }

    await getFolders(false)
  }
  catch (error) {
    console.error('Error while opening parent folders:', error)
    try {
      await getFolders(false)
    }
    catch (fallbackError) {
      console.error('Failed to refresh folders:', fallbackError)
    }
  }
}

function getFolderByIdFromTree(
  nodes: any[] | undefined,
  id: number | null,
): FoldersTreeResponse[0] | undefined {
  if (!nodes || id === null) {
    return undefined
  }
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.children?.length) {
      const foundFolder = getFolderByIdFromTree(node.children, id)
      if (foundFolder) {
        return foundFolder
      }
    }
  }
}

async function getFolders(shouldEnsureVisibility = true) {
  try {
    const { data } = await api.folders.getFoldersTree()
    folders.value = data

    if (shouldEnsureVisibility) {
      await ensureSelectedFolderIsVisible()
    }
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

    await getFolders(false)

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
    await selectFolder(Number(id))
    clearSnippetsState()
    scrollToElement(`[id="${id}"]`)
    renameFolderId.value = Number(id)
  }
}

async function updateFolder(folderId: number, data: FoldersUpdate) {
  try {
    await api.folders.patchFoldersById(String(folderId), data)
    await getFolders(false)

    if (folderId === state.folderId) {
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
    await getFolders(false)
  }
  catch (error) {
    console.error(error)
  }
}
async function selectFolder(folderId: number) {
  state.folderId = folderId
  state.libraryFilter = undefined
  state.tagId = undefined
  state.snippetId = undefined

  if (folders.value && folders.value.length > 0) {
    await ensureSelectedFolderIsVisible()
  }
}

export function useFolders() {
  return {
    createFolder,
    createFolderAndSelect,
    deleteFolder,
    folders,
    getFolderByIdFromTree,
    getFolders,
    renameFolderId,
    selectFolder,
    updateFolder,
  }
}
