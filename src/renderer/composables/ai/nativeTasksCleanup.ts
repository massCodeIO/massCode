import type { TaskMutation } from './taskUndo'
import type { TaskCleanupUndoResult } from '~/main/types/ipc'
import { useNotes } from '@/composables/spaces/notes/useNotes'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { ipc, store } from '@/electron'

export async function undoNativeTasksCleanup(
  receipt: Extract<TaskMutation, { kind: 'tasksCleanup' }>,
) {
  if (receipt.vault !== store.preferences.get('storage.vaultPath'))
    return ['tasksCleanup']
  const result = await ipc.invoke<{ id: string }, TaskCleanupUndoResult>(
    'system:tasks-cleanup-undo',
    { id: receipt.id },
  )
  receipt.undone = result.undone
  if (!result.restored)
    return result.conflicts
  markPersistedStorageMutation()
  const notes = useNotes()
  const loaded = await notes.getNotes()
  await notes.refreshSelectedNote()
  return loaded && notes.selectedNoteRecordStatus.value !== 'error'
    ? result.conflicts
    : [...result.conflicts, 'tasksCleanupRefresh']
}
