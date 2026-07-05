import type { TasksAutoCleanupInterval } from './store/types'
import { useNotesStorage } from './storage'
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

export function cleanupCompletedTasks(): number {
  const storage = useNotesStorage()
  const completed = storage.notes.getNotes({
    propertyType: 'task',
    propertyStatus: 'done',
  })

  let moved = 0

  for (const note of completed) {
    const result = storage.notes.updateNote(note.id, {
      folderId: null,
      isDeleted: 1,
    })

    if (!result.notFound && !result.invalidInput) {
      moved++
    }
  }

  return moved
}

export function runTasksCleanupNow(): number {
  const moved = cleanupCompletedTasks()
  store.app.set('notes.lastTasksCleanupAt', Date.now())

  return moved
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
