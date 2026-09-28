import type { DockBadgeSource } from '../store/types'

interface BadgeSnippet {
  folderId: number | null
  isDeleted: number
}

interface BadgeNote extends BadgeSnippet {
  properties: Record<string, unknown>
}

export interface DockBadgeCountsInput {
  notes: BadgeNote[]
  snippets: BadgeSnippet[]
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function getLocalDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = DATE_ONLY_RE.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  )
}

export function countDockBadge(
  source: DockBadgeSource,
  input: DockBadgeCountsInput,
  localToday: string,
): number {
  if (source === 'none') {
    return 0
  }

  if (source === 'codeInbox') {
    return input.snippets.filter(
      snippet => snippet.folderId === null && snippet.isDeleted === 0,
    ).length
  }

  if (source === 'notesInbox') {
    return input.notes.filter(
      note => note.folderId === null && note.isDeleted === 0,
    ).length
  }

  return input.notes.filter((note) => {
    const due = note.properties.due

    return (
      note.isDeleted === 0
      && note.properties.type === 'task'
      && note.properties.status !== 'done'
      && isValidDateOnly(due)
      && due <= localToday
    )
  }).length
}
