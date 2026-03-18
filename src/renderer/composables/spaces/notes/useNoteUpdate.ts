import { markUserEdit } from '@/composables/useStorageMutation'
import { useDebounceFn } from '@vueuse/core'
import { useNotes } from './useNotes'

interface NoteUpdateQueueItem {
  data: Parameters<ReturnType<typeof useNotes>['updateNote']>[1]
  noteId: number
}

const UPDATE_DEBOUNCE_TIME = 500

const { updateNote } = useNotes()
const updateQueue = ref<Map<string, NoteUpdateQueueItem>>(new Map())

const updateDebounced = useDebounceFn((noteId: number) => {
  const queueKey = `${noteId}`
  const update = updateQueue.value.get(queueKey)

  if (!update) {
    return
  }

  updateQueue.value.delete(queueKey)
  void updateNote(update.noteId, update.data)
}, UPDATE_DEBOUNCE_TIME)

function addToUpdateQueue(
  noteId: number,
  data: Parameters<ReturnType<typeof useNotes>['updateNote']>[1],
) {
  markUserEdit()
  const queueKey = `${noteId}`
  updateQueue.value.set(queueKey, {
    data,
    noteId,
  })
  updateDebounced(noteId)
}

export function useNoteUpdate() {
  return {
    addToUpdateQueue,
  }
}
