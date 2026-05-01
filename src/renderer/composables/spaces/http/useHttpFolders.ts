import type {
  HttpFoldersResponse,
  HttpFoldersUpdate,
} from '@/services/api/generated'
import type { HttpFoldersTreeResponse } from './useHttpFolderTree'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { getContiguousSelection } from '@/utils'
import { useHttpApp } from './useHttpApp'
import {
  findParentFolderIds,
  flattenFolderTree,
  getFolderByIdFromTree,
} from './useHttpFolderTree'

export type HttpFolderItem = HttpFoldersResponse[number]

const folders = shallowRef<HttpFoldersTreeResponse>([])

const renameFolderId = ref<number | null>(null)
let isApplyingFolderSelection = false

const { httpState } = useHttpApp()

const selectedFolderIds = ref<number[]>(
  httpState.folderId ? [httpState.folderId] : [],
)
const lastSelectedFolderId = ref<number | undefined>(httpState.folderId)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0
  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match)
      return
    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })
  return `${normalizedBase} ${maxIndex + 1}`
}

function getNextUntitledFolderName(parentId?: number): string {
  const normalizedParentId = parentId ?? null
  const siblingNames = flattenFolderTree(folders.value)
    .filter(folder => (folder.parentId ?? null) === normalizedParentId)
    .map(folder => folder.name)

  return getNextIndexedName(i18n.t('folder.untitled'), siblingNames)
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
      if (seen.has(id))
        return false
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
      = httpState.folderId && folderOrderMap.value.has(httpState.folderId)
        ? httpState.folderId
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
  () => httpState.folderId,
  (folderId) => {
    if (isApplyingFolderSelection)
      return

    if (folderId === undefined) {
      selectedFolderIds.value = []
      lastSelectedFolderId.value = undefined
      return
    }

    if (selectedFolderIds.value.includes(folderId))
      return

    selectedFolderIds.value = [folderId]
    lastSelectedFolderId.value = folderId
  },
)

function clearFolderSelection() {
  isApplyingFolderSelection = true
  selectedFolderIds.value = []
  httpState.folderId = undefined
  httpState.requestId = undefined
  lastSelectedFolderId.value = undefined
  isApplyingFolderSelection = false
}

function setFolderSelection(ids: number[]) {
  if (!ids.length) {
    clearFolderSelection()
    return
  }

  const orderedSelection = sortFolderIdsByTreeOrder(ids)
  isApplyingFolderSelection = true
  selectedFolderIds.value = orderedSelection
  httpState.folderId = orderedSelection[0]
  lastSelectedFolderId.value = orderedSelection[orderedSelection.length - 1]
  isApplyingFolderSelection = false
}

function applySingleFolderSelection(folderId: number) {
  isApplyingFolderSelection = true
  selectedFolderIds.value = [folderId]
  httpState.folderId = folderId
  lastSelectedFolderId.value = folderId
  isApplyingFolderSelection = false
}

function applyRangeFolderSelection(folderId: number) {
  const orderedIds = flatFolderList.value.map(folder => folder.id)

  if (!orderedIds.length) {
    applySingleFolderSelection(folderId)
    return
  }

  const anchorId = httpState.folderId ?? selectedFolderIds.value[0] ?? folderId
  const rangeSelection = getContiguousSelection(orderedIds, anchorId, folderId)

  if (!rangeSelection.length) {
    applySingleFolderSelection(folderId)
    return
  }

  isApplyingFolderSelection = true
  selectedFolderIds.value = rangeSelection
  lastSelectedFolderId.value = folderId
  isApplyingFolderSelection = false
}

function applyToggleFolderSelection(folderId: number) {
  if (selectedFolderIds.value.includes(folderId)) {
    if (selectedFolderIds.value.length === 1)
      return

    isApplyingFolderSelection = true
    selectedFolderIds.value = selectedFolderIds.value.filter(
      id => id !== folderId,
    )
    httpState.folderId = selectedFolderIds.value[0]
    lastSelectedFolderId.value
      = selectedFolderIds.value[selectedFolderIds.value.length - 1]
    isApplyingFolderSelection = false
    return
  }

  isApplyingFolderSelection = true
  selectedFolderIds.value = sortFolderIdsByTreeOrder([
    ...selectedFolderIds.value,
    folderId,
  ])
  httpState.folderId = folderId
  lastSelectedFolderId.value = folderId
  isApplyingFolderSelection = false
}

async function ensureSelectedFolderIsVisible() {
  if (!httpState.folderId || !folders.value.length)
    return

  const parentIds = findParentFolderIds(
    httpState.folderId,
    flatFolderList.value,
  )

  if (parentIds.length === 0)
    return

  const foldersToOpen = parentIds.filter((parentId) => {
    const folder = flatFolderList.value.find(f => f.id === parentId)
    return folder && folder.isOpen === 0
  })

  if (foldersToOpen.length === 0)
    return

  try {
    await Promise.allSettled(
      foldersToOpen.map(folderId =>
        api.httpFolders.patchHttpFoldersById(String(folderId), {
          isOpen: 1,
        }),
      ),
    )
    await getHttpFolders(false)
  }
  catch (error) {
    console.error('Error while opening parent http folders:', error)
  }
}

async function getHttpFolders(shouldEnsureVisibility = true) {
  try {
    const { data } = await api.httpFolders.getHttpFoldersTree()
    folders.value = data as HttpFoldersTreeResponse
    syncSelectedFoldersWithTree()

    if (shouldEnsureVisibility) {
      await ensureSelectedFolderIsVisible()
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpFolder(parentId?: number) {
  try {
    const name = getNextUntitledFolderName(parentId)
    markPersistedStorageMutation()
    const { data } = await api.httpFolders.postHttpFolders({
      name,
      ...(parentId !== undefined && { parentId }),
    })

    if (parentId) {
      await updateHttpFolder(parentId, { isOpen: 1 })
    }

    await getHttpFolders(false)

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpFolderAndSelect(parentId?: number) {
  const id = await createHttpFolder(parentId)
  if (id) {
    await selectHttpFolder(id)
    renameFolderId.value = id
  }
}

async function updateHttpFolder(folderId: number, data: HttpFoldersUpdate) {
  try {
    markPersistedStorageMutation()
    await api.httpFolders.patchHttpFoldersById(String(folderId), data)
    await getHttpFolders(false)
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteHttpFolder(folderId: number, shouldRefresh = true) {
  try {
    markPersistedStorageMutation()
    await api.httpFolders.deleteHttpFoldersById(String(folderId))
    if (httpState.folderId === folderId) {
      httpState.folderId = undefined
    }
    if (shouldRefresh) {
      await getHttpFolders(false)
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

async function selectHttpFolder(
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
    httpState.requestId = undefined
  }

  if (folders.value.length && shouldEnsureVisibility) {
    await ensureSelectedFolderIsVisible()
  }
}

function resetHttpFoldersState() {
  folders.value = []
  renameFolderId.value = null
  clearFolderSelection()
}

export function useHttpFolders() {
  return {
    clearFolderSelection,
    createHttpFolder,
    createHttpFolderAndSelect,
    deleteHttpFolder,
    folders,
    getFolderByIdFromTree,
    getHttpFolders,
    lastSelectedFolderId,
    renameFolderId,
    resetHttpFoldersState,
    selectedFolderIds,
    selectHttpFolder,
    setFolderSelection,
    updateHttpFolder,
  }
}
