import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '~/renderer/services/api'
import { notes, notesBySearch } from './useNotes'

// --- Types ---

interface NoteTagInfo {
  id: number
  name: string
}

interface NoteFolderInfo {
  id: number
  name: string
}

interface NoteRecord {
  id: number
  name: string
  description: string | null
  content: string
  tags: NoteTagInfo[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

type NotesResponse = NoteRecord[]

// --- Module-level state ---

const contentUpdateQueue = ref<Map<number, string>>(new Map())
const contentUpdateTimers = ref<Map<number, ReturnType<typeof setTimeout>>>(
  new Map(),
)
const inFlightContentUpdateIds = ref<Set<number>>(new Set())

const CONTENT_UPDATE_DEBOUNCE_MS = 500

// --- Functions ---

function updateLocalNoteContent(noteId: number, content: string) {
  const now = Date.now()

  function updateCollection(collection?: NotesResponse) {
    const note = collection?.find(item => item.id === noteId)
    if (note) {
      note.content = content
      note.updatedAt = now
    }
  }

  updateCollection(notes.value)
  updateCollection(notesBySearch.value)
}

function scheduleContentUpdate(noteId: number) {
  const currentTimer = contentUpdateTimers.value.get(noteId)
  if (currentTimer) {
    clearTimeout(currentTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.value.delete(noteId)
    void flushContentUpdate(noteId)
  }, CONTENT_UPDATE_DEBOUNCE_MS)

  contentUpdateTimers.value.set(noteId, timer)
}

async function flushContentUpdate(noteId: number) {
  const content = contentUpdateQueue.value.get(noteId)
  if (content === undefined) {
    return
  }

  contentUpdateQueue.value.delete(noteId)
  inFlightContentUpdateIds.value.add(noteId)

  try {
    markPersistedStorageMutation()
    await api.notes.patchNotesByIdContent(String(noteId), { content })
  }
  catch (error) {
    console.error(error)
  }
  finally {
    inFlightContentUpdateIds.value.delete(noteId)

    if (contentUpdateQueue.value.has(noteId)) {
      scheduleContentUpdate(noteId)
    }
  }
}

function hasBusyNoteContentUpdates() {
  return (
    contentUpdateQueue.value.size > 0 || inFlightContentUpdateIds.value.size > 0
  )
}

function updateNoteContent(noteId: number, content: string) {
  updateLocalNoteContent(noteId, content)
  contentUpdateQueue.value.set(noteId, content)

  if (inFlightContentUpdateIds.value.has(noteId)) {
    return
  }

  scheduleContentUpdate(noteId)
}

export function useNoteContent() {
  return {
    hasBusyNoteContentUpdates,
    updateNoteContent,
  }
}
