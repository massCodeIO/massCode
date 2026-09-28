import type { TasksAutoCleanupInterval } from './store/types'
import type { TaskCleanupResult, TaskCleanupUndoResult } from './types/ipc'
import { randomUUID } from 'node:crypto'
import { useNotesStorage } from './storage'
import { toNoteFileName } from './storage/providers/markdown/notes/runtime/notes'
import { getVaultPath } from './storage/providers/markdown/runtime/paths'
import { store } from './store'

const DAY_MS = 24 * 60 * 60 * 1000

const INTERVAL_MS: Record<
  Exclude<TasksAutoCleanupInterval, 'never'>,
  number
> = {
  '1d': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

interface CleanupPosition {
  folderId: number | null
  isDeleted: number
}
interface CleanupEntry {
  id: number
  before: CleanupPosition
  renamed?: { before: string, after: string }
  undone?: boolean
}
const cleanupReceipts = new Map<
  string,
  { vault: string, entries: CleanupEntry[] }
>()

export function cleanupCompletedTasks(
  recordMoved?: (entry: CleanupEntry) => void,
): number {
  const storage = useNotesStorage()
  const completed = storage.notes.getNotes({
    propertyType: 'task',
    propertyStatus: 'done',
  })

  let moved = 0

  for (const note of completed) {
    const before = {
      folderId: note.folder?.id ?? null,
      isDeleted: note.isDeleted,
    }
    let captured = false
    const capture = () => {
      const after = storage.notes.getNoteById(note.id)
      if (!captured && after?.isDeleted === 1 && !after.folder) {
        recordMoved?.({
          id: note.id,
          before,
          ...(after.name !== note.name
            ? { renamed: { before: note.name, after: after.name } }
            : {}),
        })
        captured = true
      }
    }
    try {
      const result = storage.notes.updateNote(note.id, {
        folderId: null,
        isDeleted: 1,
      })
      if (!result.notFound && !result.invalidInput) {
        moved++
        if (recordMoved) {
          capture()
          if (!captured)
            throw new Error('TASK_CLEANUP_FAILED')
        }
      }
      else if (recordMoved) {
        throw new Error('TASK_CLEANUP_FAILED')
      }
    }
    catch (error) {
      if (recordMoved)
        capture()
      throw error
    }
  }

  return moved
}

export function runTasksCleanupNow(): number {
  const moved = cleanupCompletedTasks()
  store.app.set('notes.lastTasksCleanupAt', Date.now())

  return moved
}

/** Opaque, vault-bound inverse for the same cleanup used by the manual action. */
export function runTasksCleanupWithUndo(
  expectedVault: string,
): TaskCleanupResult {
  const vault = getVaultPath()
  if (vault !== expectedVault)
    return { status: 'stale', count: 0 }
  const id = randomUUID()
  const receipt = { vault, entries: [] as CleanupEntry[] }
  // Keep only a bounded set of small positional receipts; no note content.
  if (cleanupReceipts.size >= 100)
    cleanupReceipts.delete(cleanupReceipts.keys().next().value!)
  cleanupReceipts.set(id, receipt)
  let failed = false
  try {
    cleanupCompletedTasks(entry => receipt.entries.push(entry))
  }
  catch {
    failed = true
  }
  try {
    store.app.set('notes.lastTasksCleanupAt', Date.now())
  }
  catch {
    failed = true
  }
  if (!receipt.entries.length)
    cleanupReceipts.delete(id)
  return {
    status: failed ? 'failed' : 'done',
    count: receipt.entries.length,
    ...(receipt.entries.length ? { receiptId: id } : {}),
  }
}

export function undoTasksCleanup(id: string): TaskCleanupUndoResult {
  const receipt = cleanupReceipts.get(id)
  if (!receipt || receipt.vault !== getVaultPath())
    return { undone: false, restored: 0, conflicts: ['tasksCleanup'] }
  const storage = useNotesStorage()
  const folders = new Set(
    storage.folders.getFolders().map(folder => folder.id),
  )
  const conflicts: string[] = []
  let restored = 0
  for (const entry of receipt.entries) {
    if (entry.undone)
      continue
    try {
      const note = storage.notes.getNoteById(entry.id)
      if (
        !note
        || note.isDeleted !== 1
        || note.folder
        || (entry.before.folderId !== null && !folders.has(entry.before.folderId))
      ) {
        conflicts.push(`note:${entry.id}`)
        continue
      }
      // Moving into the shared Trash can rename a task. Invert only that
      // cleanup-owned rename; a later manual name remains the user's choice.
      const name
        = entry.renamed && note.name === entry.renamed.after
          ? entry.renamed.before
          : note.name
      const targetFileName = toNoteFileName(name).toLowerCase()
      const collision = storage.notes
        .getNotes({ isDeleted: entry.before.isDeleted })
        .some(
          other =>
            other.id !== entry.id
            && (other.folder?.id ?? null) === entry.before.folderId
            && toNoteFileName(other.name).toLowerCase() === targetFileName,
        )
      if (collision) {
        conflicts.push(`note:${entry.id}`)
        continue
      }
      const result = storage.notes.updateNote(entry.id, {
        ...entry.before,
        ...(name !== note.name ? { name } : {}),
      })
      const after = storage.notes.getNoteById(entry.id)
      if (
        result.notFound
        || result.invalidInput
        || !after
        || after.name !== name
        || after.isDeleted !== entry.before.isDeleted
        || (after.folder?.id ?? null) !== entry.before.folderId
      ) {
        conflicts.push(`note:${entry.id}`)
        continue
      }
      entry.undone = true
      restored++
    }
    catch {
      conflicts.push(`note:${entry.id}`)
    }
  }
  return {
    undone: receipt.entries.every(entry => entry.undone),
    restored,
    conflicts,
  }
}

export function runTasksAutoCleanupIfDue(): void {
  const interval = store.preferences.get('tasks.autoCleanupCompleted') as
    | TasksAutoCleanupInterval
    | undefined

  if (!interval || interval === 'never') {
    return
  }

  const lastRunAt
    = (store.app.get('notes.lastTasksCleanupAt') as number | undefined) ?? 0
  const now = Date.now()

  if (now - lastRunAt < INTERVAL_MS[interval]) {
    return
  }

  cleanupCompletedTasks()
  store.app.set('notes.lastTasksCleanupAt', now)
}

export function startTasksCleanupScheduler(): void {
  runTasksAutoCleanupIfDue()

  if (timer) {
    return
  }

  timer = setInterval(runTasksAutoCleanupIfDue, CHECK_INTERVAL_MS)
}

export function stopTasksCleanupScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
