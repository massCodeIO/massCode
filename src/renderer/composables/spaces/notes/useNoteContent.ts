import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { isRetriableSaveError } from '@/utils'
import { api } from '~/renderer/services/api'
import { notes, selectedNoteRecord } from './useNotes'
import { notesBySearch } from './useNoteSearch'

// --- Module-level state ---

// Очереди не нужны в реактивности: на них никто не подписан, а операции
// выполняются на каждый keystroke.
const contentUpdateQueue = new Map<number, string>()
const contentUpdateTimers = new Map<number, ReturnType<typeof setTimeout>>()
const inFlightContentUpdates = new Map<number, Promise<void>>()
const versions = new Map<number, number>()

const CONTENT_UPDATE_DEBOUNCE_MS = 500
const CONTENT_UPDATE_RETRY_MS = 2000
// Backoff растёт экспоненциально до потолка: без него клиентская ошибка или
// лежащий API-сервер молотили бы PATCH каждые 2 секунды бесконечно.
const CONTENT_UPDATE_RETRY_MAX_MS = 60_000

const retryAttemptsByNoteId = new Map<number, number>()

function nextRetryDelay(noteId: number): number {
  const attempts = (retryAttemptsByNoteId.get(noteId) ?? 0) + 1
  retryAttemptsByNoteId.set(noteId, attempts)
  return Math.min(
    CONTENT_UPDATE_RETRY_MS * 2 ** (attempts - 1),
    CONTENT_UPDATE_RETRY_MAX_MS,
  )
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
    void flushContentUpdate(noteId).catch(console.error)
  }, delayMs)

  contentUpdateTimers.set(noteId, timer)
}

function flushContentUpdate(noteId: number): Promise<void> {
  const pending = inFlightContentUpdates.get(noteId)
  if (pending)
    return pending
  const content = contentUpdateQueue.get(noteId)
  if (content === undefined)
    return Promise.resolve()
  clearTimeout(contentUpdateTimers.get(noteId))
  contentUpdateTimers.delete(noteId)
  contentUpdateQueue.delete(noteId)
  const version = versions.get(noteId) ?? 0
  const request = (async () => {
    try {
      markPersistedStorageMutation()
      await api.notes.patchNotesByIdContent(String(noteId), { content })
      retryAttemptsByNoteId.delete(noteId)
      if (contentUpdateQueue.has(noteId))
        scheduleContentUpdate(noteId)
    }
    catch (error) {
      // Keep permanent failures too, but only retry transient errors automatically.
      if (!contentUpdateQueue.has(noteId))
        contentUpdateQueue.set(noteId, content)
      if ((versions.get(noteId) ?? 0) > version)
        scheduleContentUpdate(noteId)
      else if (isRetriableSaveError(error))
        scheduleContentUpdate(noteId, nextRetryDelay(noteId))
      throw error
    }
    finally {
      inFlightContentUpdates.delete(noteId)
    }
  })()
  inFlightContentUpdates.set(noteId, request)
  return request
}

// Drain only this note, including edits queued while its PATCH was in flight.
// Failure leaves the latest draft queued.
async function flushNoteContent(noteId: number): Promise<void> {
  while (contentUpdateQueue.has(noteId) || inFlightContentUpdates.has(noteId))
    await flushContentUpdate(noteId)
}

function hasBusyNoteContentUpdates() {
  return contentUpdateTimers.size > 0 || inFlightContentUpdates.size > 0
}

function updateNoteContent(noteId: number, content: string) {
  updateLocalNoteContent(noteId, content)
  contentUpdateQueue.set(noteId, content)
  const version = (versions.get(noteId) ?? 0) + 1
  versions.set(noteId, version)
  // Новый ввод сбрасывает backoff: пользователь активен, сохранение снова
  // пробуется быстро.
  retryAttemptsByNoteId.delete(noteId)

  if (inFlightContentUpdates.has(noteId)) {
    return
  }

  scheduleContentUpdate(noteId)
}

export function useNoteContent() {
  return { hasBusyNoteContentUpdates, flushNoteContent, updateNoteContent }
}
