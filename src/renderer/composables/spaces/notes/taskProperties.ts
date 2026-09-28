export const NoteTaskStatus = {
  Blocked: 'blocked',
  Done: 'done',
  InProgress: 'inProgress',
  Todo: 'todo',
} as const

export const NoteTaskPriority = {
  High: 'high',
  Low: 'low',
  Medium: 'medium',
} as const

export type NoteTaskStatusValue =
  (typeof NoteTaskStatus)[keyof typeof NoteTaskStatus]

export type NoteTaskPriorityValue =
  (typeof NoteTaskPriority)[keyof typeof NoteTaskPriority]

export type NoteProperties = Record<string, unknown>

export interface NoteTaskPropertyPatch {
  properties?: NoteProperties
  unset?: string[]
}

export interface NoteWithProperties {
  properties: NoteProperties
}

export function getNotePropertyString(
  properties: NoteProperties | undefined,
  key: string,
): string | undefined {
  const value = properties?.[key]
  return typeof value === 'string' ? value : undefined
}

export function isTaskNote(note: NoteWithProperties | undefined | null) {
  return getNotePropertyString(note?.properties, 'type') === 'task'
}

export function getTaskStatus(
  note: NoteWithProperties | undefined | null,
): NoteTaskStatusValue {
  const status = getNotePropertyString(note?.properties, 'status')

  if (
    status === NoteTaskStatus.InProgress
    || status === NoteTaskStatus.Done
    || status === NoteTaskStatus.Blocked
  ) {
    return status
  }

  return NoteTaskStatus.Todo
}

export function getTaskPriority(
  note: NoteWithProperties | undefined | null,
): NoteTaskPriorityValue | undefined {
  const priority = getNotePropertyString(note?.properties, 'priority')

  if (
    priority === NoteTaskPriority.Low
    || priority === NoteTaskPriority.Medium
    || priority === NoteTaskPriority.High
  ) {
    return priority
  }

  return undefined
}

export function getTaskDue(
  note: NoteWithProperties | undefined | null,
): string {
  return getNotePropertyString(note?.properties, 'due') || ''
}

export function createTaskCompletionPatch(
  note: NoteWithProperties,
): NoteTaskPropertyPatch {
  const nextStatus
    = getTaskStatus(note) === NoteTaskStatus.Done
      ? NoteTaskStatus.Todo
      : NoteTaskStatus.Done

  return {
    properties: {
      status: nextStatus,
      type: 'task',
    },
  }
}
