import { describe, expect, it, vi } from 'vitest'
import {
  getVisibleSelectedFolderIds,
  shouldHandleFolderClick,
} from '../notesSidebarSelection'

vi.mock('@/router', () => ({
  RouterName: {
    notesSpace: 'notes-space',
    notesDashboard: 'notes-space/dashboard',
    notesGraph: 'notes-space/graph',
  },
}))

describe('notesSidebarSelection', () => {
  it('returns selected folders only in the notes workspace route', () => {
    expect(getVisibleSelectedFolderIds('notes-space', [3, 7])).toEqual([3, 7])
    expect(
      getVisibleSelectedFolderIds('notes-space/dashboard', [3, 7]),
    ).toEqual([])
    expect(getVisibleSelectedFolderIds('notes-space/graph', [3, 7])).toEqual(
      [],
    )
  })

  it('handles folder clicks from non-workspace routes even when the folder id matches', () => {
    expect(shouldHandleFolderClick('notes-space/dashboard', 7, 7, 1)).toBe(
      true,
    )
    expect(shouldHandleFolderClick('notes-space/graph', 7, 7, 1)).toBe(true)
    expect(shouldHandleFolderClick('notes-space', 7, 7, 1)).toBe(false)
    expect(shouldHandleFolderClick('notes-space', 7, 7, 2)).toBe(true)
    expect(shouldHandleFolderClick('notes-space', 7, 9, 1)).toBe(true)
  })
})
