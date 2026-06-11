import type { DrawingViewportState } from '~/main/store/types'
import { useDonations } from '@/composables/useDonations'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'
import { router, RouterName } from '@/router'

export interface DrawingItem {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export const DRAWINGS_CHANGED_EVENT = 'masscode:drawings-changed'

const drawings = ref<DrawingItem[]>([])
const activeDrawingId = ref<string | null>(null)
const activeDrawingContent = ref<string | null>(null)
const drawingViewports = ref<Record<string, DrawingViewportState>>({})
const sceneRevision = ref(0)
const imageExportRequest = ref(0)
let initialized = false
let lastSavedContent: string | null = null
let inFlightSaves = 0
let loadContentToken = 0

const activeDrawing = computed(() => {
  return drawings.value.find(item => item.id === activeDrawingId.value)
})

const activeDrawingViewport = computed(() => {
  return activeDrawingId.value
    ? (drawingViewports.value[activeDrawingId.value] ?? null)
    : null
})

function notifyDrawingsChanged(id?: string) {
  window.dispatchEvent(
    new CustomEvent(DRAWINGS_CHANGED_EVENT, { detail: { id } }),
  )
}

function sortDrawings() {
  drawings.value = [...drawings.value].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

function persistSelection() {
  store.app.set('drawings.activeDrawingId', activeDrawingId.value)
}

function persistViewports() {
  // Strip Vue reactivity proxies: contextBridge structured-clones the
  // payload and cannot serialize a Proxy.
  store.app.set(
    'drawings.viewport',
    JSON.parse(JSON.stringify(drawingViewports.value)),
  )
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
  const content = await ipc.invoke('spaces:drawings:read', { id })

  if (token !== loadContentToken) {
    return
  }

  activeDrawingContent.value = typeof content === 'string' ? content : null
  lastSavedContent = activeDrawingContent.value
  sceneRevision.value += 1
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

function pruneViewports() {
  const knownIds = new Set(drawings.value.map(item => item.id))
  const entries = Object.entries(drawingViewports.value)
  const pruned = entries.filter(([id]) => knownIds.has(id))

  if (pruned.length !== entries.length) {
    drawingViewports.value = Object.fromEntries(pruned)
    persistViewports()
  }
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
    drawingViewports.value
      = store.app.get<Record<string, DrawingViewportState>>(
        'drawings.viewport',
      ) ?? {}

    await loadDrawingsList()
    normalizeSelection()
    pruneViewports()
    await loadActiveDrawingContent()
  }

  function markDrawingsStale() {
    initialized = false
  }

  async function reloadFromDisk() {
    const previousId = activeDrawingId.value

    await loadDrawingsList()
    initialized = true
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

  async function openDrawing(id: string) {
    if (initialized) {
      if (drawings.value.some(item => item.id === id)) {
        await selectDrawing(id)
      }
    }
    else {
      // Initialize right away so the navigation history can capture the
      // opened drawing as soon as the route changes.
      store.app.set('drawings.activeDrawingId', id)
      await init()
    }

    await router.push({ name: RouterName.drawingsSpace })
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

    const viewport = drawingViewports.value[id]

    if (viewport && record.id !== id) {
      const { [id]: _removed, ...rest } = drawingViewports.value
      drawingViewports.value = { ...rest, [record.id]: viewport }
      persistViewports()
    }

    if (activeDrawingId.value === id) {
      activeDrawingId.value = record.id
      persistSelection()
    }

    notifyDrawingsChanged(id)
  }

  async function duplicateDrawing(id: string) {
    markPersistedStorageMutation()
    const record = await ipc.invoke('spaces:drawings:duplicate', { id })

    if (!record) {
      return
    }

    applyDrawingRecord(record)

    const viewport = drawingViewports.value[id]

    if (viewport) {
      drawingViewports.value = {
        ...drawingViewports.value,
        [record.id]: viewport,
      }
      persistViewports()
    }

    activeDrawingId.value = record.id
    persistSelection()
    await loadActiveDrawingContent()
  }

  async function deleteDrawing(id: string) {
    markPersistedStorageMutation()
    await ipc.invoke('spaces:drawings:delete', { id })

    drawings.value = drawings.value.filter(item => item.id !== id)

    if (drawingViewports.value[id]) {
      const { [id]: _removed, ...rest } = drawingViewports.value
      drawingViewports.value = rest
      persistViewports()
    }

    notifyDrawingsChanged(id)

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

      // The name and therefore the sort order never change on write:
      // patch the timestamp in place instead of re-sorting the list.
      if (record) {
        const item = drawings.value.find(entry => entry.id === id)

        if (item) {
          item.updatedAt = record.updatedAt
        }
      }

      notifyDrawingsChanged(id)
    }
    catch (error) {
      console.error(error)
    }
    finally {
      inFlightSaves -= 1
    }
  }

  function saveDrawingViewport(id: string, viewport: DrawingViewportState) {
    if (!drawings.value.some(item => item.id === id)) {
      return
    }

    drawingViewports.value = { ...drawingViewports.value, [id]: viewport }
    persistViewports()
  }

  function hasBusyDrawingUpdates() {
    return inFlightSaves > 0
  }

  return {
    drawings,
    activeDrawing,
    activeDrawingId,
    activeDrawingContent,
    activeDrawingViewport,
    sceneRevision,
    imageExportRequest,
    init,
    markDrawingsStale,
    reloadFromDisk,
    selectDrawing,
    openDrawing,
    exportDrawingImage,
    createDrawing,
    renameDrawing,
    duplicateDrawing,
    deleteDrawing,
    saveDrawingContent,
    saveDrawingViewport,
    hasBusyDrawingUpdates,
  }
}
