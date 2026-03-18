import type { MarkdownFolderUIState } from './types'

export function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeFlag(value: unknown, fallback = 0): number {
  return normalizeNumber(value, fallback) ? 1 : 0
}

export function normalizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const integer = Math.trunc(parsed)
  return integer > 0 ? integer : null
}

export function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected storage error'
}

export function normalizeFolderUiState(
  value: unknown,
): Record<string, MarkdownFolderUIState> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const normalized: Record<string, MarkdownFolderUIState> = {}
  for (const [rawFolderId, rawUiState] of Object.entries(value)) {
    const folderId = normalizePositiveInteger(rawFolderId)
    if (!folderId) {
      continue
    }

    const isOpen
      = rawUiState && typeof rawUiState === 'object'
        ? normalizeFlag((rawUiState as { isOpen?: number }).isOpen)
        : 0

    normalized[String(folderId)] = { isOpen }
  }

  return normalized
}

export function normalizeFolderOrderIndices<
  T extends {
    id: number
    parentId: number | null
    orderIndex: number
  },
>(folders: T[]): void {
  const childrenByParent = new Map<number | null, T[]>()

  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parentId)
    if (siblings) {
      siblings.push(folder)
    }
    else {
      childrenByParent.set(folder.parentId, [folder])
    }
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) {
        return a.orderIndex - b.orderIndex
      }
      return a.id - b.id
    })

    for (let i = 0; i < siblings.length; i++) {
      siblings[i].orderIndex = i
    }
  }
}
