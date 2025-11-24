import type {
  FoldersTreeResponse,
  FoldersUpdate,
} from '@/services/api/generated'
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { getContiguousSelection, scrollToElement } from '../utils'

const { state } = useApp()

const folders = shallowRef<FoldersTreeResponse>()

const renameFolderId = ref<number | null>(null)

const selectedFolderIds = ref<number[]>(state.folderId ? [state.folderId] : [])
const lastSelectedFolderId = ref<number | undefined>(state.folderId)

function flattenFolderTree(
  nodes?: FoldersTreeResponse,
  acc: FoldersTreeResponse[0][] = [],
) {
  if (!nodes) {
    return acc
  }

  nodes.forEach((folder) => {
    acc.push(folder)

    if (folder.children?.length) {
      flattenFolderTree(folder.children, acc)
    }
  })

  return acc
}

const flatFolderList = computed(() => flattenFolderTree(folders.value))

const folderOrderMap = computed(() => {
  const map = new Map<number, number>()

  flatFolderList.value.forEach((folder, index) => {
    map.set(folder.id, index)
  })

  return map
})

function sortFolderIdsByTreeOrder(ids: number[]) {
  const seen = new Set<number>()

  return ids
    .filter((id) => {
      if (seen.has(id)) {
        return false
      }
      seen.add(id)
      return folderOrderMap.value.has(id)
    })
    .sort((a, b) => {
      const orderA = folderOrderMap.value.get(a) ?? Number.MAX_SAFE_INTEGER
      const orderB = folderOrderMap.value.get(b) ?? Number.MAX_SAFE_INTEGER

      return orderA - orderB
    })
}

function syncSelectedFoldersWithTree() {
  const orderedIds = flatFolderList.value.map(folder => folder.id)

  if (!orderedIds.length) {
    clearFolderSelection()
    return
  }

  const filteredSelection = selectedFolderIds.value.filter(id =>
    folderOrderMap.value.has(id),
  )

  if (!filteredSelection.length) {
    const fallbackId
      = state.folderId && folderOrderMap.value.has(state.folderId)
        ? state.folderId
        : orderedIds[0]

    if (fallbackId) {
      setFolderSelection([fallbackId])
    }
    else {
      clearFolderSelection()
    }

    return
  }

  setFolderSelection(filteredSelection)
}

watch(
  () => state.folderId,
  (folderId) => {
    if (folderId === undefined) {
      selectedFolderIds.value = []
      lastSelectedFolderId.value = undefined
      return
    }

    if (!selectedFolderIds.value.includes(folderId)) {
      selectedFolderIds.value = sortFolderIdsByTreeOrder([
        folderId,
        ...selectedFolderIds.value,
      ])
    }
  },
)

function clearFolderSelection() {
  selectedFolderIds.value = []
  state.folderId = undefined
  state.snippetId = undefined
  lastSelectedFolderId.value = undefined
}

function setFolderSelection(ids: number[]) {
  if (!ids.length) {
    clearFolderSelection()
    return
  }

  const orderedSelection = sortFolderIdsByTreeOrder(ids)
  selectedFolderIds.value = orderedSelection
  state.folderId = orderedSelection[0]
  lastSelectedFolderId.value = orderedSelection[orderedSelection.length - 1]
}

function applySingleFolderSelection(folderId: number) {
  selectedFolderIds.value = [folderId]
  state.folderId = folderId
  lastSelectedFolderId.value = folderId
}

function applyRangeFolderSelection(folderId: number) {
  const orderedIds = flatFolderList.value.map(folder => folder.id)

  if (!orderedIds.length) {
    applySingleFolderSelection(folderId)
    return
  }

  const anchorId = state.folderId ?? selectedFolderIds.value[0] ?? folderId
  const rangeSelection = getContiguousSelection(orderedIds, anchorId, folderId)

  if (!rangeSelection.length) {
    applySingleFolderSelection(folderId)
    return
  }

  selectedFolderIds.value = rangeSelection
  lastSelectedFolderId.value = folderId
}

function applyToggleFolderSelection(folderId: number) {
  if (selectedFolderIds.value.includes(folderId)) {
    if (selectedFolderIds.value.length === 1) {
      return
    }

    selectedFolderIds.value = selectedFolderIds.value.filter(
      id => id !== folderId,
    )
    state.folderId = selectedFolderIds.value[0]
    lastSelectedFolderId.value
      = selectedFolderIds.value[selectedFolderIds.value.length - 1]
    return
  }

  selectedFolderIds.value = sortFolderIdsByTreeOrder([
    ...selectedFolderIds.value,
    folderId,
  ])
  state.folderId = folderId
  lastSelectedFolderId.value = folderId
}

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

  const parentIds = findParentFolderIds(state.folderId, flatFolderList.value)

  if (parentIds.length === 0) {
    return
  }

  const foldersToOpen = parentIds.filter((parentId) => {
    const folder = flatFolderList.value.find(f => f.id === parentId)
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
    syncSelectedFoldersWithTree()

    if (shouldEnsureVisibility) {
      await ensureSelectedFolderIsVisible()
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function createFolder(parentId?: number) {
  try {
    const { data } = await api.folders.postFolders({
      name: i18n.t('folder.untitled'),
      ...(parentId !== undefined && { parentId }),
    })

    if (parentId) {
      await updateFolder(parentId, { isOpen: 1 })
    }

    await getFolders(false)

    return data.id
  }
  catch (error) {
    console.error(error)
  }
}

async function createFolderAndSelect(parentId?: number) {
  const { clearSnippetsState } = useSnippets()
  const id = await createFolder(parentId)

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

async function deleteFolder(folderId: number, shouldRefresh = true) {
  try {
    await api.folders.deleteFoldersById(String(folderId))
    if (shouldRefresh) {
      await getFolders(false)
    }
  }
  catch (error) {
    console.error(error)
  }
}

interface SelectFolderOptions {
  mode?: 'single' | 'range' | 'toggle'
  ensureVisibility?: boolean
}

async function selectFolder(
  folderId: number,
  options: SelectFolderOptions = {},
) {
  const mode = options.mode ?? 'single'
  const shouldEnsureVisibility = options.ensureVisibility ?? mode === 'single'

  if (mode === 'range') {
    applyRangeFolderSelection(folderId)
  }
  else if (mode === 'toggle') {
    applyToggleFolderSelection(folderId)
  }
  else {
    applySingleFolderSelection(folderId)
    state.libraryFilter = undefined
    state.tagId = undefined
    state.snippetId = undefined
  }

  if (folders.value?.length && shouldEnsureVisibility) {
    await ensureSelectedFolderIsVisible()
  }
}

export function useFolders() {
  return {
    createFolder,
    createFolderAndSelect,
    clearFolderSelection,
    deleteFolder,
    folders,
    getFolderByIdFromTree,
    getFolders,
    lastSelectedFolderId,
    renameFolderId,
    selectedFolderIds,
    setFolderSelection,
    selectFolder,
    updateFolder,
  }
}
