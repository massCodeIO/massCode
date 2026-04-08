import type { NoteFoldersTreeResponse } from './useNoteFolderTree'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'

import { getContiguousSelection, scrollToElement } from '@/utils'

import {
  findParentFolderIds,
  flattenFolderTree,
  getFolderByIdFromTree,
} from './useNoteFolderTree'
import { useNotes } from './useNotes'
import { useNotesApp } from './useNotesApp'

const { notesState } = useNotesApp()

// --- Types ---

interface NoteFoldersUpdate {
  name?: string
  icon?: string | null
  parentId?: number | null
  isOpen?: number
  orderIndex?: number
}

// --- Module-level state ---

const folders = shallowRef<NoteFoldersTreeResponse>()

const renameFolderId = ref<number | null>(null)
let isApplyingFolderSelection = false

const selectedFolderIds = ref<number[]>(
  notesState.folderId ? [notesState.folderId] : [],
)
const lastSelectedFolderId = ref<number | undefined>(notesState.folderId)

// --- Utility functions ---

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
    if (!match) {
      return
    }

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
  if (notesState.libraryFilter) {
    return
  }

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
      = notesState.folderId && folderOrderMap.value.has(notesState.folderId)
        ? notesState.folderId
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
  () => notesState.folderId,
  (folderId) => {
    if (isApplyingFolderSelection) {
      return
    }

    if (folderId === undefined) {
      selectedFolderIds.value = []
      lastSelectedFolderId.value = undefined
      return
    }

    selectedFolderIds.value = [folderId]
    lastSelectedFolderId.value = folderId
  },
)

// --- Selection helpers ---

function clearFolderSelection() {
  isApplyingFolderSelection = true
  selectedFolderIds.value = []
  notesState.folderId = undefined
  notesState.noteId = undefined
  lastSelectedFolderId.value = undefined
  isApplyingFolderSelection = false
}

function resetNoteFoldersState() {
  folders.value = []
  renameFolderId.value = null
  clearFolderSelection()
}

function setFolderSelection(ids: number[]) {
  if (!ids.length) {
    clearFolderSelection()
    return
  }

  const orderedSelection = sortFolderIdsByTreeOrder(ids)
  isApplyingFolderSelection = true
  selectedFolderIds.value = orderedSelection
  notesState.folderId = orderedSelection[0]
  lastSelectedFolderId.value = orderedSelection[orderedSelection.length - 1]
  isApplyingFolderSelection = false
}

function applySingleFolderSelection(folderId: number) {
  isApplyingFolderSelection = true
  selectedFolderIds.value = [folderId]
  notesState.folderId = folderId
  lastSelectedFolderId.value = folderId
  isApplyingFolderSelection = false
}

function applyRangeFolderSelection(folderId: number) {
  const orderedIds = flatFolderList.value.map(folder => folder.id)

  if (!orderedIds.length) {
    applySingleFolderSelection(folderId)
    return
  }

  const anchorId
    = notesState.folderId ?? selectedFolderIds.value[0] ?? folderId
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
    if (selectedFolderIds.value.length === 1) {
      return
    }

    isApplyingFolderSelection = true
    selectedFolderIds.value = selectedFolderIds.value.filter(
      id => id !== folderId,
    )
    notesState.folderId = selectedFolderIds.value[0]
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
  notesState.folderId = folderId
  lastSelectedFolderId.value = folderId
  isApplyingFolderSelection = false
}

// --- Visibility helpers ---

async function ensureSelectedFolderIsVisible() {
  if (!notesState.folderId || !folders.value) {
    return
  }

  const parentIds = findParentFolderIds(
    notesState.folderId,
    flatFolderList.value,
  )

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
        api.noteFolders.patchNoteFoldersById(String(folderId), {
          isOpen: 1,
        }),
      ),
    )

    const failedUpdates = updateResults
      .map((result, index) => ({ result, folderId: foldersToOpen[index] }))
      .filter(({ result }) => result.status === 'rejected')

    if (failedUpdates.length > 0) {
      console.warn('Some note folders failed to open:', failedUpdates)
    }

    await getNoteFolders(false)
  }
  catch (error) {
    console.error('Error while opening parent note folders:', error)
    try {
      await getNoteFolders(false)
    }
    catch (fallbackError) {
      console.error('Failed to refresh note folders:', fallbackError)
    }
  }
}

// --- CRUD ---

async function getNoteFolders(shouldEnsureVisibility = true) {
  try {
    const { data } = await api.noteFolders.getNoteFoldersTree()
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

async function createNoteFolder(parentId?: number) {
  try {
    const nextFolderName = getNextUntitledFolderName(parentId)

    markPersistedStorageMutation()
    const { data } = await api.noteFolders.postNoteFolders({
      name: nextFolderName,
      ...(parentId !== undefined && { parentId }),
    })

    if (parentId) {
      await updateNoteFolder(parentId, { isOpen: 1 })
    }

    await getNoteFolders(false)

    return data.id
  }
  catch (error) {
    console.error(error)
  }
}

async function createNoteFolderAndSelect(parentId?: number) {
  const { clearNotesState } = useNotes()
  const id = await createNoteFolder(parentId)

  if (id) {
    await selectNoteFolder(Number(id))
    clearNotesState()
    scrollToElement(`[id="${id}"]`)
    renameFolderId.value = Number(id)
  }
}

async function updateNoteFolder(folderId: number, data: NoteFoldersUpdate) {
  try {
    markPersistedStorageMutation()
    await api.noteFolders.patchNoteFoldersById(String(folderId), data)
    await getNoteFolders(false)

    if (folderId === notesState.folderId) {
      const { getNotes } = useNotes()
      await getNotes({ folderId })
    }
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteNoteFolder(folderId: number, shouldRefresh = true) {
  try {
    markPersistedStorageMutation()
    await api.noteFolders.deleteNoteFoldersById(String(folderId))
    if (shouldRefresh) {
      await getNoteFolders(false)
    }
  }
  catch (error) {
    console.error(error)
  }
}

// --- Selection ---

interface SelectFolderOptions {
  mode?: 'single' | 'range' | 'toggle'
  ensureVisibility?: boolean
}

async function selectNoteFolder(
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
    notesState.libraryFilter = undefined
    notesState.tagId = undefined
    notesState.noteId = undefined
  }

  if (folders.value?.length && shouldEnsureVisibility) {
    await ensureSelectedFolderIsVisible()
  }
}

export function useNoteFolders() {
  return {
    clearFolderSelection,
    createNoteFolder,
    createNoteFolderAndSelect,
    deleteNoteFolder,
    folders,
    getFolderByIdFromTree,
    getNoteFolders,
    lastSelectedFolderId,
    renameFolderId,
    resetNoteFoldersState,
    selectedFolderIds,
    selectNoteFolder,
    setFolderSelection,
    updateNoteFolder,
  }
}
