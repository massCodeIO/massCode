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

const updateDebounced = useDebounceFn((snippetId: number) => {
  const key = `${snippetId}`
  const update = updateQueue.value.get(key)

  if (update) {
    updateSnippet(update.snippetId, update.data)
    updateQueue.value.delete(key)
  }
}, UPDATE_DEBOUNCE_TIME)

const updateContentDebounced = useDebounceFn(
  (snippetId: number, contentId: number) => {
    const key = `${snippetId}-${contentId}`
    const update = updateContentQueue.value.get(key)

    if (update) {
      updateSnippetContent(update.snippetId, update.contentId, update.data)
      updateContentQueue.value.delete(key)
    }
  },
  UPDATE_DEBOUNCE_TIME,
)

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
  const key = `${snippetId}-${contentId}`
  updateContentQueue.value.set(key, { snippetId, contentId, data })
  updateContentDebounced(snippetId, contentId)
}

export function useSnippetUpdate() {
  return {
    addToUpdateContentQueue,
    addToUpdateQueue,
  }
}
