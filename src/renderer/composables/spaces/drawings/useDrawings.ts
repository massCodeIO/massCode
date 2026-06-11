import { useDonations } from '@/composables/useDonations'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'

export interface DrawingItem {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

const drawings = ref<DrawingItem[]>([])
const activeDrawingId = ref<string | null>(null)
const activeDrawingContent = ref<string | null>(null)
const isDrawingContentLoading = ref(false)
const sceneRevision = ref(0)
const imageExportRequest = ref(0)
let initialized = false
let lastSavedContent: string | null = null
let inFlightSaves = 0
let loadContentToken = 0

const activeDrawing = computed(() => {
  return drawings.value.find(item => item.id === activeDrawingId.value)
})

function sortDrawings() {
  drawings.value = [...drawings.value].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

function persistSelection() {
  store.app.set('drawings.activeDrawingId', activeDrawingId.value)
}

async function loadDrawingsList() {
  const items = await ipc.invoke('spaces:drawings:list', null)
  drawings.value = Array.isArray(items) ? items : []
}

async function loadActiveDrawingContent() {
  const id = activeDrawingId.value

  if (!id) {
    activeDrawingContent.value = null
    lastSavedContent = null
    return
  }

  const token = ++loadContentToken
  isDrawingContentLoading.value = true

  try {
    const content = await ipc.invoke('spaces:drawings:read', { id })

    if (token !== loadContentToken) {
      return
    }

    activeDrawingContent.value = typeof content === 'string' ? content : null
    lastSavedContent = activeDrawingContent.value
    sceneRevision.value += 1
  }
  finally {
    if (token === loadContentToken) {
      isDrawingContentLoading.value = false
    }
  }
}

function normalizeSelection() {
  if (
    activeDrawingId.value
    && !drawings.value.some(item => item.id === activeDrawingId.value)
  ) {
    activeDrawingId.value = drawings.value[0]?.id ?? null
    persistSelection()
    return true
  }

  if (!activeDrawingId.value && drawings.value.length > 0) {
    activeDrawingId.value = drawings.value[0].id
    persistSelection()
    return true
  }

  return false
}

function applyDrawingRecord(record: DrawingItem) {
  const index = drawings.value.findIndex(item => item.id === record.id)

  if (index === -1) {
    drawings.value = [...drawings.value, record]
  }
  else {
    drawings.value[index] = record
  }

  sortDrawings()
}

export function useDrawings() {
  async function init() {
    if (initialized) {
      return
    }
    initialized = true

    activeDrawingId.value
      = store.app.get<string | null>('drawings.activeDrawingId') ?? null

    await loadDrawingsList()
    normalizeSelection()
    await loadActiveDrawingContent()
  }

  async function reloadFromDisk() {
    const previousId = activeDrawingId.value

    await loadDrawingsList()
    const selectionChanged = normalizeSelection()

    if (selectionChanged || activeDrawingId.value !== previousId) {
      await loadActiveDrawingContent()
      return
    }

    if (!activeDrawingId.value) {
      return
    }

    const content = await ipc.invoke('spaces:drawings:read', {
      id: activeDrawingId.value,
    })

    if (typeof content === 'string' && content !== lastSavedContent) {
      activeDrawingContent.value = content
      lastSavedContent = content
      sceneRevision.value += 1
    }
  }

  async function selectDrawing(id: string) {
    if (activeDrawingId.value === id) {
      return
    }

    activeDrawingId.value = id
    persistSelection()
    await loadActiveDrawingContent()
  }

  async function exportDrawingImage(id: string) {
    await selectDrawing(id)
    await nextTick()
    imageExportRequest.value += 1
  }

  async function createDrawing() {
    markPersistedStorageMutation()
    const record = await ipc.invoke('spaces:drawings:create', null)

    if (!record) {
      return null
    }

    applyDrawingRecord(record)
    activeDrawingId.value = record.id
    persistSelection()
    await loadActiveDrawingContent()

    useDonations().incrementCreated('drawings')

    return record as DrawingItem
  }

  async function renameDrawing(id: string, name: string) {
    markPersistedStorageMutation()
    const record = await ipc.invoke('spaces:drawings:rename', { id, name })

    if (!record) {
      return
    }

    drawings.value = drawings.value.filter(item => item.id !== id)
    applyDrawingRecord(record)

    if (activeDrawingId.value === id) {
      activeDrawingId.value = record.id
      persistSelection()
    }
  }

  async function duplicateDrawing(id: string) {
    markPersistedStorageMutation()
    const record = await ipc.invoke('spaces:drawings:duplicate', { id })

    if (!record) {
      return
    }

    applyDrawingRecord(record)
    activeDrawingId.value = record.id
    persistSelection()
    await loadActiveDrawingContent()
  }

  async function deleteDrawing(id: string) {
    markPersistedStorageMutation()
    await ipc.invoke('spaces:drawings:delete', { id })

    drawings.value = drawings.value.filter(item => item.id !== id)

    if (activeDrawingId.value === id) {
      activeDrawingId.value = drawings.value[0]?.id ?? null
      persistSelection()
      await loadActiveDrawingContent()
    }
  }

  async function saveDrawingContent(id: string, content: string) {
    if (!drawings.value.some(item => item.id === id)) {
      return
    }

    if (id === activeDrawingId.value && content === lastSavedContent) {
      return
    }

    markUserEdit()
    markPersistedStorageMutation()
    inFlightSaves += 1

    try {
      const record = await ipc.invoke('spaces:drawings:write', { id, content })

      if (id === activeDrawingId.value) {
        lastSavedContent = content
      }

      if (record) {
        applyDrawingRecord(record)
      }
    }
    catch (error) {
      console.error(error)
    }
    finally {
      inFlightSaves -= 1
    }
  }

  function hasBusyDrawingUpdates() {
    return inFlightSaves > 0
  }

  return {
    drawings,
    activeDrawing,
    activeDrawingId,
    activeDrawingContent,
    isDrawingContentLoading,
    sceneRevision,
    imageExportRequest,
    init,
    reloadFromDisk,
    selectDrawing,
    exportDrawingImage,
    createDrawing,
    renameDrawing,
    duplicateDrawing,
    deleteDrawing,
    saveDrawingContent,
    hasBusyDrawingUpdates,
  }
}
