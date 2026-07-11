import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '~/renderer/services/api'
import { notes, selectedNoteRecord } from './useNotes'
import { notesBySearch } from './useNoteSearch'

// --- Module-level state ---

// Очереди не нужны в реактивности: на них никто не подписан, а операции
// выполняются на каждый keystroke.
const contentUpdateQueue = new Map<number, string>()
const contentUpdateTimers = new Map<number, ReturnType<typeof setTimeout>>()
const inFlightContentUpdateIds = new Set<number>()

const CONTENT_UPDATE_DEBOUNCE_MS = 500
const CONTENT_UPDATE_RETRY_MS = 2000

// Ретраится только временный сбой: 503 (файл ещё качается из облака) и
// сетевые ошибки без ответа. Окончательные отказы (404 удалённой заметки,
// 400) не зацикливают очередь.
function isRetriableSaveError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === undefined || status === 503
}

// --- Functions ---

function updateLocalNoteContent(noteId: number, content: string) {
  const now = Date.now()

  // Контент хранится только в полной записи выбранной заметки.
  // Мутация без замены объекта: редактор уже содержит этот текст,
  // реактивный каскад на каждый keystroke не нужен.
  const record = selectedNoteRecord.value
  if (record?.id === noteId) {
    record.content = content
    record.updatedAt = now
  }

  function touchCollection(collection?: { id: number, updatedAt: number }[]) {
    const note = collection?.find(item => item.id === noteId)
    if (note) {
      note.updatedAt = now
    }
  }

  touchCollection(notes.value)
  touchCollection(notesBySearch.value)
}

function scheduleContentUpdate(
  noteId: number,
  delayMs = CONTENT_UPDATE_DEBOUNCE_MS,
) {
  const currentTimer = contentUpdateTimers.get(noteId)
  if (currentTimer) {
    clearTimeout(currentTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.delete(noteId)
    void flushContentUpdate(noteId)
  }, delayMs)

  contentUpdateTimers.set(noteId, timer)
}

async function flushContentUpdate(noteId: number) {
  const content = contentUpdateQueue.get(noteId)
  if (content === undefined) {
    return
  }

  contentUpdateQueue.delete(noteId)
  inFlightContentUpdateIds.add(noteId)

  let shouldRetry = false
  try {
    markPersistedStorageMutation()
    await api.notes.patchNotesByIdContent(String(noteId), { content })
  }
  catch (error) {
    console.error(error)
    shouldRetry = isRetriableSaveError(error)
  }
  finally {
    inFlightContentUpdateIds.delete(noteId)

    // Временный сбой (503 на evicted-файле, сеть) возвращает payload в
    // очередь: набранный текст ретраится до успеха и не гибнет при
    // hydration refresh. Более свежий ввод, попавший в очередь во время
    // полёта, приоритетнее возвращаемого.
    if (shouldRetry && !contentUpdateQueue.has(noteId)) {
      contentUpdateQueue.set(noteId, content)
    }

    if (contentUpdateQueue.has(noteId)) {
      scheduleContentUpdate(
        noteId,
        shouldRetry ? CONTENT_UPDATE_RETRY_MS : undefined,
      )
    }
  }
}

function hasBusyNoteContentUpdates() {
  return contentUpdateQueue.size > 0 || inFlightContentUpdateIds.size > 0
}

function updateNoteContent(noteId: number, content: string) {
  updateLocalNoteContent(noteId, content)
  contentUpdateQueue.set(noteId, content)

  if (inFlightContentUpdateIds.has(noteId)) {
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
