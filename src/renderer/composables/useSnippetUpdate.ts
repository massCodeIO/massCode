import type {
  SnippetContentsAdd,
  SnippetsUpdate,
} from '../services/api/generated'
import { useDebounceFn } from '@vueuse/core'
import { useSnippets } from './useSnippets'

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

const { updateSnippetContent, updateSnippet } = useSnippets()

const updateQueue = ref<Map<string, UpdateQueueItem>>(new Map())
const updateContentQueue = ref<Map<string, UpdateContentQueueItem>>(new Map())
const contentUpdateTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(
  new Map(),
)
const inFlightContentKeys = ref<Set<string>>(new Set())

const updateDebounced = useDebounceFn((snippetId: number) => {
  const key = `${snippetId}`
  const update = updateQueue.value.get(key)

  if (update) {
    updateSnippet(update.snippetId, update.data)
    updateQueue.value.delete(key)
  }
}, UPDATE_DEBOUNCE_TIME)

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

  try {
    await updateSnippetContent(update.snippetId, update.contentId, update.data)
  }
  catch (error) {
    console.error(error)
  }
  finally {
    inFlightContentKeys.value.delete(key)

    if (updateContentQueue.value.has(key)) {
      scheduleContentUpdate(key)
    }
  }
}

function scheduleContentUpdate(key: string) {
  const pendingTimer = contentUpdateTimers.value.get(key)
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }

  const timer = setTimeout(() => {
    contentUpdateTimers.value.delete(key)
    void flushContentUpdate(key)
  }, UPDATE_DEBOUNCE_TIME)

  contentUpdateTimers.value.set(key, timer)
}

function addToUpdateQueue(snippetId: number, data: SnippetsUpdate) {
  const key = `${snippetId}`
  updateQueue.value.set(key, { snippetId, data })
  updateDebounced(snippetId)
}

function addToUpdateContentQueue(
  snippetId: number,
  contentId: number,
  data: SnippetContentsAdd,
) {
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
