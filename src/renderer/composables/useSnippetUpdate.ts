import type {
  SnippetContentsAdd,
  SnippetsUpdate,
} from '../services/api/generated'
import { useDebounceFn } from '@vueuse/core'
import { useSnippets } from './useSnippets'
import { markUserEdit } from './useStorageMutation'

interface UpdateQueueItem {
  snippetId: number
  data: SnippetsUpdate
}

interface UpdateContentQueueItem {
  snippetId: number
  contentId: number
  data: SnippetContentsAdd
}

const UPDATE_DEBOUNCE_TIME = 500
const UPDATE_RETRY_TIME = 2000

const { updateSnippetContent, updateSnippet } = useSnippets()

const updateQueue = ref<Map<string, UpdateQueueItem>>(new Map())
const updateContentQueue = ref<Map<string, UpdateContentQueueItem>>(new Map())
const contentUpdateTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(
  new Map(),
)
const inFlightContentKeys = ref<Set<string>>(new Set())

// Ретраится только временный сбой: 503 (файл ещё качается из облака) и
// сетевые ошибки без ответа. Окончательные отказы (404 удалённого сниппета,
// 400) не зацикливают очередь.
function isRetriableSaveError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === undefined || status === 503
}

const updateDebounced = useDebounceFn((snippetId: number) => {
  void flushMetadataUpdate(snippetId)
}, UPDATE_DEBOUNCE_TIME)

async function flushMetadataUpdate(snippetId: number) {
  const key = `${snippetId}`
  const update = updateQueue.value.get(key)
  if (!update) {
    return
  }

  updateQueue.value.delete(key)

  try {
    await updateSnippet(update.snippetId, update.data)
  }
  catch (error) {
    console.error(error)

    // Временный сбой возвращает payload в очередь и ретраит: иначе правка
    // метаданных молча гибла бы. Более свежий ввод приоритетнее.
    if (isRetriableSaveError(error) && !updateQueue.value.has(key)) {
      updateQueue.value.set(key, update)
      setTimeout(() => {
        void flushMetadataUpdate(snippetId)
      }, UPDATE_RETRY_TIME)
    }
  }
}

function getContentUpdateKey(snippetId: number, contentId: number) {
  return `${snippetId}-${contentId}`
}

async function flushContentUpdate(key: string) {
  const update = updateContentQueue.value.get(key)
  if (!update) {
    return
  }

  updateContentQueue.value.delete(key)
  inFlightContentKeys.value.add(key)

  let shouldRetry = false
  try {
    await updateSnippetContent(update.snippetId, update.contentId, update.data)
  }
  catch (error) {
    console.error(error)
    shouldRetry = isRetriableSaveError(error)
  }
  finally {
    inFlightContentKeys.value.delete(key)

    // Временный сбой (503 на evicted-файле, сеть) возвращает payload в
    // очередь: набранный текст ретраится до успеха и не гибнет при
    // hydration refresh. Более свежий ввод приоритетнее возвращаемого.
    if (shouldRetry && !updateContentQueue.value.has(key)) {
      updateContentQueue.value.set(key, update)
    }

    if (updateContentQueue.value.has(key)) {
      scheduleContentUpdate(key, shouldRetry ? UPDATE_RETRY_TIME : undefined)
    }
  }
}

function scheduleContentUpdate(key: string, delayMs = UPDATE_DEBOUNCE_TIME) {
  const pendingTimer = contentUpdateTimers.value.get(key)
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.value.delete(key)
    void flushContentUpdate(key)
  }, delayMs)

  contentUpdateTimers.value.set(key, timer)
}

function addToUpdateQueue(snippetId: number, data: SnippetsUpdate) {
  markUserEdit()
  const key = `${snippetId}`
  updateQueue.value.set(key, { snippetId, data })
  updateDebounced(snippetId)
}

function addToUpdateContentQueue(
  snippetId: number,
  contentId: number,
  data: SnippetContentsAdd,
) {
  markUserEdit()
  const key = getContentUpdateKey(snippetId, contentId)
  updateContentQueue.value.set(key, { snippetId, contentId, data })

  if (inFlightContentKeys.value.has(key)) {
    return
  }

  scheduleContentUpdate(key)
}

function getPendingContentUpdate(snippetId: number, contentId: number) {
  const key = getContentUpdateKey(snippetId, contentId)
  return updateContentQueue.value.get(key)?.data
}

function isContentUpdateBusy(snippetId: number, contentId: number) {
  const key = getContentUpdateKey(snippetId, contentId)
  return (
    updateContentQueue.value.has(key) || inFlightContentKeys.value.has(key)
  )
}

function hasBusyContentUpdates() {
  return (
    updateContentQueue.value.size > 0 || inFlightContentKeys.value.size > 0
  )
}

export function useSnippetUpdate() {
  return {
    addToUpdateContentQueue,
    addToUpdateQueue,
    getPendingContentUpdate,
    hasBusyContentUpdates,
    isContentUpdateBusy,
  }
}
